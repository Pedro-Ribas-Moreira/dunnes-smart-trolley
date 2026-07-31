import OpenAI from 'openai';

import { searchLiveDunnesProducts } from './dunnesLiveSearchService.js';
import { rankDunnesCandidates } from './productMatchingAgentService.js';
import { searchDunnesProduceWebsite } from './produceWebsiteSearchAgentService.js';

const WEBSITE_SEARCH_TIMEOUT_MS = Number(
  process.env.PRODUCE_WEBSITE_SEARCH_TIMEOUT_MS || 12000,
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const recognitionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'recognised',
    'itemName',
    'variety',
    'category',
    'confidence',
    'needsBetterPhoto',
    'message',
  ],
  properties: {
    recognised: { type: 'boolean' },
    itemName: { type: 'string' },
    variety: { type: 'string' },
    category: {
      type: 'string',
      enum: ['fruit', 'vegetable', 'herb', 'unknown'],
    },
    confidence: { type: 'number' },
    needsBetterPhoto: { type: 'boolean' },
    message: { type: 'string' },
  },
};

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function recogniseProduce(imageBuffer, mimeType) {
  if (!process.env.OPENAI_API_KEY) {
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
          {
            type: 'input_text',
            text:
              'Identify the loose fruit, vegetable or herb in this image. ' +
              'Only identify what is clearly visible. If the image is blurry, dark, too distant, obstructed, contains several different items, or is not loose produce, set needsBetterPhoto to true. ' +
              'Use a simple grocery name such as banana, red onion, avocado or broccoli. Do not invent a variety.',
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
        name: 'loose_produce_recognition',
        strict: true,
        schema: recognitionSchema,
      },
    },
  });

  let result;

  try {
    result = JSON.parse(response.output_text);
  } catch {
    const error = new Error('The produce photo could not be understood.');
    error.statusCode = 502;
    throw error;
  }

  const confidence = Math.max(0, Math.min(1, Number(result.confidence || 0)));
  const itemName = cleanText(result.itemName);
  const recognised = Boolean(result.recognised && itemName && confidence >= 0.55);
  const needsBetterPhoto = Boolean(result.needsBetterPhoto || !recognised);

  return {
    recognised,
    itemName: recognised ? itemName : '',
    variety: recognised ? cleanText(result.variety) : '',
    category: cleanText(result.category) || 'unknown',
    confidence,
    needsBetterPhoto,
    message:
      cleanText(result.message) ||
      (needsBetterPhoto
        ? 'Take another photo with one item centred in good lighting.'
        : ''),
  };
}

function createSearchProduct(recognition) {
  const name = [recognition.variety, recognition.itemName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    barcode: '',
    name,
    genericName: recognition.itemName,
    brand: '',
    quantity: 'loose',
    categories: [recognition.category, 'fresh produce', 'loose'],
    source: 'produce-photo',
  };
}

function mergeCandidates(...candidateGroups) {
  const candidatesBySku = new Map();

  candidateGroups.flat().forEach((candidate) => {
    const sku = String(candidate?.dunnesSku || '').trim();

    if (!sku) {
      return;
    }

    candidatesBySku.set(sku, {
      ...candidatesBySku.get(sku),
      ...candidate,
    });
  });

  return [...candidatesBySku.values()];
}

async function searchForProduce(externalProduct, recognition) {
  const websiteSearchController = new AbortController();
  const timeoutId = setTimeout(
    () => websiteSearchController.abort(),
    WEBSITE_SEARCH_TIMEOUT_MS,
  );

  try {
    const [catalogueResult, websiteResult] = await Promise.allSettled([
      searchLiveDunnesProducts(externalProduct),
      searchDunnesProduceWebsite(recognition, undefined, {
        signal: websiteSearchController.signal,
      }),
    ]);

    const catalogueCandidates =
      catalogueResult.status === 'fulfilled' ? catalogueResult.value : [];

    const websiteCandidates =
      websiteResult.status === 'fulfilled' ? websiteResult.value : [];

    if (catalogueResult.status === 'rejected') {
      console.warn('Normal Dunnes produce search failed:', {
        itemName: recognition.itemName,
        message: catalogueResult.reason?.message,
      });
    }

    if (websiteResult.status === 'rejected' && !websiteSearchController.signal.aborted) {
      console.warn('Produce website search failed:', {
        itemName: recognition.itemName,
        message: websiteResult.reason?.message,
      });
    }

    return mergeCandidates(catalogueCandidates, websiteCandidates);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function identifyLooseProduce({ imageBuffer, mimeType }) {
  const recognition = await recogniseProduce(imageBuffer, mimeType);

  if (recognition.needsBetterPhoto) {
    return {
      recognition,
      matches: [],
    };
  }

  const externalProduct = createSearchProduct(recognition);
  const candidates = await searchForProduce(externalProduct, recognition);

  if (candidates.length === 0) {
    return {
      recognition,
      matches: [],
    };
  }

  const ranking = await rankDunnesCandidates({
    externalProduct,
    candidates,
  });

  const candidateBySku = new Map(
    candidates.map((candidate) => [String(candidate.dunnesSku), candidate]),
  );

  const matches = ranking.matches.map((match) => ({
    ...candidateBySku.get(match.dunnesSku),
    ...match,
  }));

  return {
    recognition,
    matches,
  };
}
