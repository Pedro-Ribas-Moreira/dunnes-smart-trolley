import OpenAI from 'openai';

import {
  adminDb,
} from '../config/firebaseAdmin.js';

const APP_ID = 'dunnes-trolley';

const MAX_CATALOGUE_PRODUCTS = 5000;
const MAX_MATCHES = 5;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normaliseText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ignoredMatchWords = new Set([
  'the',
  'and',
  'with',
  'for',
  'new',
  'natural',
  'original',
  'classic',
  'fresh',
  'water',
  'product',
]);

function getWords(value) {
  return normaliseText(value)
    .split(' ')
    .filter(
      (word) =>
        word.length > 1 &&
        !ignoredMatchWords.has(word),
    );
}
function getNumbers(value) {
  return String(value || '')
    .match(/\d+(?:[.,]\d+)?/g)
    ?.map((number) =>
      number.replace(',', '.'),
    ) || [];
}

function calculateWordOverlap(
  sourceWords,
  candidateWords,
) {
  if (
    sourceWords.length === 0 ||
    candidateWords.length === 0
  ) {
    return 0;
  }

  const candidateSet =
    new Set(candidateWords);

  const matches = sourceWords.filter(
    (word) => candidateSet.has(word),
  );

  return matches.length /
    Math.max(sourceWords.length, 1);
}

function calculateNumberMatch(
  labelText,
  candidateText,
) {
  const labelNumbers =
    getNumbers(labelText);

  if (labelNumbers.length === 0) {
    return 0;
  }

  const candidateNumbers =
    new Set(getNumbers(candidateText));

  const matches = labelNumbers.filter(
    (number) =>
      candidateNumbers.has(number),
  );

  return matches.length /
    labelNumbers.length;
}

function calculateCandidateScore(
  label,
  product,
) {
  const labelBrand =
    normaliseText(label.brand);

  const productBrand =
    normaliseText(product.brand);

  const labelNameWords = getWords(
    [
      label.productName,
      label.variant,
      label.sizeText,
    ].join(' '),
  );

  const productText = [
    product.name,
    product.brand,
    product.defaultCategory,
    product.unitPrice,
  ].join(' ');

  const productWords =
    getWords(productText);

  const brandMatches =
    Boolean(labelBrand) &&
    Boolean(productBrand) &&
    (
      labelBrand === productBrand ||
      productBrand.includes(labelBrand) ||
      labelBrand.includes(productBrand)
    );

  /*
   * If the image clearly detected a brand,
   * products from another brand should not
   * receive a useful match score.
   */
  if (
    labelBrand &&
    productBrand &&
    !brandMatches
  ) {
    return 0;
  }

  const wordScore =
    calculateWordOverlap(
      labelNameWords,
      productWords,
    );

  const sizeScore =
    calculateNumberMatch(
      [
        label.sizeText,
        label.visibleText,
      ].join(' '),
      productText,
    );

  const normalizedProductName =
    normaliseText(product.name);

  const normalizedLabelName =
    normaliseText(label.productName);

  const exactNameBonus =
    normalizedLabelName.length > 4 &&
    normalizedProductName.includes(
      normalizedLabelName,
    )
      ? 0.15
      : 0;

  const brandScore =
    brandMatches ? 1 : 0;

  const score =
    brandScore * 0.5 +
    wordScore * 0.35 +
    sizeScore * 0.15 +
    exactNameBonus;

  return Math.min(
    Number(score.toFixed(4)),
    1,
  );
}

function serialiseProduct(
  documentSnapshot,
) {
  const data = documentSnapshot.data();

  return {
    dunnesSku:
      data.dunnesSku ||
      documentSnapshot.id,

    name: String(data.name || ''),

    brand: String(data.brand || ''),

    price:
      Number.isFinite(
        Number(data.price),
      )
        ? Number(data.price)
        : null,

    priceText:
      String(data.priceText || ''),

    imageUrl:
      String(data.imageUrl || ''),

    defaultCategory:
      String(
        data.defaultCategory || '',
      ),

    unitPrice:
      String(data.unitPrice || ''),

    available:
      data.available !== false,

    promotions:
      Array.isArray(data.promotions)
        ? data.promotions
        : [],
  };
}

async function analyseProductLabel(
  imageBuffer,
  mimeType,
) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error(
      'The OpenAI API key is not configured.',
    );

    error.statusCode = 503;

    throw error;
  }

  const imageDataUrl =
    `data:${mimeType};base64,` +
    imageBuffer.toString('base64');

  const response =
    await openai.responses.create({
      model:
        process.env.OPENAI_VISION_MODEL ||
        'gpt-5',

      store: false,

      input: [
        {
          role: 'user',

          content: [
            {
              type: 'input_text',

              text:
                'Read the front label of this grocery product. ' +
                'Extract only information clearly visible in the image. ' +
                'Do not guess missing information.',
            },

            {
              type: 'input_image',
              image_url: imageDataUrl,
              detail: 'high',
            },
          ],
        },
      ],

      text: {
        format: {
          type: 'json_schema',

          name: 'product_label',

          strict: true,

          schema: {
            type: 'object',

            properties: {
              brand: {
                type: 'string',
              },

              productName: {
                type: 'string',
              },

              variant: {
                type: 'string',
              },

              sizeText: {
                type: 'string',
              },

              visibleText: {
                type: 'string',
              },

              confidence: {
                type: 'number',
              },
            },

            required: [
              'brand',
              'productName',
              'variant',
              'sizeText',
              'visibleText',
              'confidence',
            ],

            additionalProperties: false,
          },
        },
      },
    });

  try {
    return JSON.parse(
      response.output_text,
    );
  } catch {
    const error = new Error(
      'The product label could not be read.',
    );

    error.statusCode = 502;

    throw error;
  }
}

async function loadDunnesCatalogue() {
  const snapshot = await adminDb
    .collection('artifacts')
    .doc(APP_ID)
    .collection('dunnesProducts')
    .limit(MAX_CATALOGUE_PRODUCTS)
    .get();

  return snapshot.docs.map(
    serialiseProduct,
  );
}

function findBestMatches(
  label,
  catalogue,
) {
  return catalogue
    .map((product) => ({
      ...product,

      matchScore:
        calculateCandidateScore(
          label,
          product,
        ),
    }))

    .filter(
      (product) =>
        product.matchScore >= 0.6,
    )

    .sort(
      (firstProduct, secondProduct) =>
        secondProduct.matchScore -
        firstProduct.matchScore,
    )

    .slice(0, MAX_MATCHES);
}

export async function matchProductPhoto({
  imageBuffer,
  mimeType,
}) {
  const label =
    await analyseProductLabel(
      imageBuffer,
      mimeType,
    );

  const catalogue =
    await loadDunnesCatalogue();

  const matches =
    findBestMatches(
      label,
      catalogue,
    );

  return {
    label,

    catalogueProductsChecked:
      catalogue.length,

    matches,
  };
}