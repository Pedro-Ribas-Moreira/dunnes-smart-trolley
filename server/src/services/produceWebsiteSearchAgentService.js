import OpenAI from 'openai';

import { getDunnesProductBySku } from './dunnesStorefrontService.js';

const DUNNES_DOMAIN = 'www.dunnesstoresgrocery.com';
const DEFAULT_STORE_ID = '258';
const MAX_RESULTS = 8;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const searchResultSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['matches'],
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dunnesSku', 'name', 'productUrl', 'confidence', 'evidence'],
        properties: {
          dunnesSku: { type: 'string' },
          name: { type: 'string' },
          productUrl: { type: 'string' },
          confidence: { type: 'number' },
          evidence: { type: 'string' },
        },
      },
    },
  },
};

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normaliseSku(value) {
  const sku = String(value || '').replace(/\D/g, '');
  return /^\d{6,15}$/.test(sku) ? sku : '';
}

function isDunnesUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === DUNNES_DOMAIN && url.pathname.includes('/product/');
  } catch {
    return false;
  }
}

function createSearchPrompt(recognition) {
  const produceName = [recognition.variety, recognition.itemName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return `
Search the Dunnes Stores Grocery website for the loose produce item below.

Recognised item: ${produceName}
Category: ${recognition.category}

Search only ${DUNNES_DOMAIN} product pages. Try Irish and UK grocery wording and useful synonyms. For example, bell pepper may be listed as red pepper, scallion as spring onion, courgette as zucchini, and aubergine as eggplant.

Return likely product pages for the same visible produce item. Prefer loose, each, single-item or weight-based products. Do not return multipacks, prepared meals, frozen products, sauces or unrelated products unless there is no closer result.

The Dunnes SKU must be taken from the product page URL or page content. Never guess or invent a SKU. A typical product URL contains "-id-" followed by the numeric SKU.

Return at most ${MAX_RESULTS} matches, ordered from most likely to least likely. If no reliable Dunnes product page is found, return an empty matches array.
`.trim();
}

function normaliseAgentMatches(value) {
  const matches = Array.isArray(value?.matches) ? value.matches : [];
  const matchesBySku = new Map();

  matches.forEach((match) => {
    const dunnesSku = normaliseSku(match.dunnesSku);
    const productUrl = String(match.productUrl || '').trim();
    const confidence = Math.max(0, Math.min(1, Number(match.confidence || 0)));

    if (!dunnesSku || !isDunnesUrl(productUrl) || confidence < 0.55) {
      return;
    }

    matchesBySku.set(dunnesSku, {
      dunnesSku,
      name: cleanText(match.name),
      productUrl,
      confidence,
      evidence: cleanText(match.evidence),
    });
  });

  return [...matchesBySku.values()].slice(0, MAX_RESULTS);
}

async function findProductPages(recognition) {
  if (!openai) {
    console.warn('Produce website search skipped because OPENAI_API_KEY is not configured.');
    return [];
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_PRODUCE_SEARCH_MODEL || 'gpt-5-mini',
    store: false,
    tools: [
      {
        type: 'web_search',
        search_context_size: 'high',
        user_location: {
          type: 'approximate',
          country: 'IE',
          city: 'Dublin',
          region: 'Dublin',
          timezone: 'Europe/Dublin',
        },
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'dunnes_produce_search_results',
        strict: true,
        schema: searchResultSchema,
      },
    },
    input: createSearchPrompt(recognition),
  });

  if (!response.output_text) {
    return [];
  }

  try {
    return normaliseAgentMatches(JSON.parse(response.output_text));
  } catch {
    return [];
  }
}

async function verifyMatch(match, storeId) {
  try {
    const product = await getDunnesProductBySku(match.dunnesSku, storeId);
    if (!product?.dunnesSku || !product.name) {
      return null;
    }

    return {
      ...product,
      productUrl: match.productUrl,
      websiteSearchConfidence: match.confidence,
      websiteSearchEvidence: match.evidence,
      source: 'dunnes-website-agent',
      candidateSource: 'dunnes-website-agent',
    };
  } catch (error) {
    console.warn('Could not verify produce SKU found by website agent:', {
      sku: match.dunnesSku,
      message: error.message,
    });
    return null;
  }
}

export async function searchDunnesProduceWebsite(
  recognition,
  storeId = DEFAULT_STORE_ID,
) {
  try {
    const agentMatches = await findProductPages(recognition);
    const verifiedMatches = (
      await Promise.all(agentMatches.map((match) => verifyMatch(match, storeId)))
    ).filter(Boolean);

    console.log('Produce website search agent completed:', {
      itemName: recognition.itemName,
      agentMatches: agentMatches.length,
      verifiedMatches: verifiedMatches.length,
      products: verifiedMatches.map((product) => ({
        sku: product.dunnesSku,
        name: product.name,
        productUrl: product.productUrl,
      })),
    });

    return verifiedMatches;
  } catch (error) {
    console.error('Produce website search agent failed:', {
      itemName: recognition.itemName,
      message: error.message,
    });
    return [];
  }
}
