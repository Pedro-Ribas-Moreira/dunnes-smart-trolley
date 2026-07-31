import OpenAI from 'openai';

import { getLooseProduceCatalogue } from './looseProduceCatalogueService.js';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const recognitionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'recognised',
    'itemName',
    'category',
    'confidence',
    'matchedSku',
    'needsBetterPhoto',
    'message',
    'reason',
  ],
  properties: {
    recognised: { type: 'boolean' },
    itemName: { type: 'string' },
    category: {
      type: 'string',
      enum: ['fruit', 'vegetable', 'herb', 'unknown'],
    },
    confidence: { type: 'number' },
    matchedSku: { type: 'string' },
    needsBetterPhoto: { type: 'boolean' },
    message: { type: 'string' },
    reason: { type: 'string' },
  },
};

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function createCataloguePrompt(catalogue) {
  const options = catalogue.map((item) => ({
    sku: item.dunnesSku,
    name: item.name,
    canonicalName: item.canonicalName,
    category: item.category,
    aliases: item.aliases,
    visualHints: item.visualHints,
  }));

  return `
Identify the single loose fruit, vegetable or herb in the image and match it to the curated Dunnes catalogue below.

Curated catalogue:
${JSON.stringify(options)}

Rules:
1. matchedSku must be one of the supplied catalogue SKUs or an empty string.
2. Never invent a SKU or product.
3. Use aliases and visual hints when names differ, for example bell pepper and red pepper.
4. Select a SKU only when the visible colour, shape and item type agree with the catalogue entry.
5. If the image is blurry, dark, obstructed, too distant, contains several different items, or is not loose produce, set needsBetterPhoto to true.
6. If the item is clear but is not represented in the curated catalogue, set recognised to true, matchedSku to an empty string and explain that no curated match is available.
7. Confidence must be between 0 and 1.
`.trim();
}

async function recogniseFromCatalogue(imageBuffer, mimeType, catalogue) {
  if (!openai) {
    const error = new Error('The OpenAI API key is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  const response = await openai.responses.create({
    model: process.env.OPENAI_VISION_MODEL || 'gpt-5',
    store: false,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: createCataloguePrompt(catalogue) },
          { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'curated_loose_produce_match',
        strict: true,
        schema: recognitionSchema,
      },
    },
  });

  try {
    return JSON.parse(response.output_text);
  } catch {
    const error = new Error('The produce photo could not be understood.');
    error.statusCode = 502;
    throw error;
  }
}

function createRecognition(result, matchedProduct) {
  const confidence = Math.max(0, Math.min(1, Number(result.confidence || 0)));
  const itemName = cleanText(result.itemName);
  const recognised = Boolean(result.recognised && itemName && confidence >= 0.55);
  const needsBetterPhoto = Boolean(result.needsBetterPhoto || !recognised);

  return {
    recognised,
    itemName: recognised ? itemName : '',
    variety: '',
    category: cleanText(result.category) || 'unknown',
    confidence,
    matchedSku: matchedProduct?.dunnesSku || '',
    needsBetterPhoto,
    reason: cleanText(result.reason),
    message:
      cleanText(result.message) ||
      (needsBetterPhoto
        ? 'Take another photo with one item centred in good lighting.'
        : matchedProduct
          ? ''
          : 'The item was recognised, but it is not in the curated Dunnes catalogue yet.'),
  };
}

function createCandidate(product, confidence, reason) {
  return {
    ...product,
    confidence,
    score: confidence,
    matchMethod: 'curated-produce-vision',
    matchReason: reason,
    candidateSource: 'curated-loose-produce',
    productType: 'loose-produce',
    promotions: Array.isArray(product.promotions) ? product.promotions : [],
    hasPromotion: Array.isArray(product.promotions) && product.promotions.length > 0,
  };
}

export async function identifyLooseProduce({ imageBuffer, mimeType }) {
  const catalogue = await getLooseProduceCatalogue();

  if (catalogue.length === 0) {
    const error = new Error('The loose-produce catalogue is empty.');
    error.statusCode = 503;
    throw error;
  }

  const result = await recogniseFromCatalogue(imageBuffer, mimeType, catalogue);
  const matchedProduct = catalogue.find(
    (item) => item.dunnesSku === String(result.matchedSku || '').trim(),
  );
  const recognition = createRecognition(result, matchedProduct);

  console.log('Curated loose-produce recognition completed:', {
    itemName: recognition.itemName,
    matchedSku: recognition.matchedSku,
    confidence: recognition.confidence,
    catalogueSize: catalogue.length,
  });

  return {
    recognition,
    matches:
      matchedProduct && !recognition.needsBetterPhoto
        ? [createCandidate(matchedProduct, recognition.confidence, recognition.reason)]
        : [],
  };
}
