import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AGENT_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dunnesSku: { type: 'string' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['dunnesSku', 'confidence', 'reason'],
        additionalProperties: false,
      },
    },
    noReliableMatch: { type: 'boolean' },
  },
  required: ['matches', 'noReliableMatch'],
  additionalProperties: false,
};

function formatProductForAgent(product) {
  return {
    dunnesSku: String(product.dunnesSku || ''),
    name: String(product.name || ''),
    brand: String(product.brand || ''),
    defaultCategory: String(product.defaultCategory || ''),
    unitPrice: String(product.unitPrice || ''),
    price: product.price == null ? null : Number(product.price),
  };
}

function buildPrompt(externalProduct, candidates) {
  const externalFields = {
    barcode: externalProduct.barcode || '',
    name: externalProduct.name || '',
    brand: externalProduct.brand || '',
    quantity: externalProduct.quantity || '',
    categories: Array.isArray(externalProduct.categories)
      ? externalProduct.categories
      : [],
    genericName: externalProduct.genericName || '',
    imageUrl: externalProduct.imageUrl || '',
    source: externalProduct.source || 'open-food-facts',
  };

  return [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text:
            'You are a product matching assistant. Your task is to rank candidate Dunnes products for an external grocery item. ' +
            'Do not invent SKUs. Only return SKUs included in the candidate list. ' +
            'If no reliable match exists, respond with noReliableMatch=true and an empty matches array.',
        },
        {
          type: 'input_text',
          text:
            'Match using this reasoning order: brand, product identity, package size, variant, category, then confidence. ' +
            'Allow minor brand formatting differences such as Coca-Cola / Coca Cola / CocaCola. ' +
            'Package sizes must not match if they differ meaningfully, such as 110g vs 180g or 500ml vs 1.5L.',
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text:
            'External product data:\n' +
            JSON.stringify(externalFields, null, 2) +
            '\n\nCandidate products:\n' +
            JSON.stringify(candidates, null, 2) +
            '\n\nReturn only valid JSON matching the schema: {"matches": [...], "noReliableMatch": boolean}. ' +
            'Confidence should be a number between 0 and 1. Only include candidates if confidence is at least 0.60. ' +
            'Do not return SKUs that are not in the candidate list. Provide a brief reason for each match.',
        },
      ],
    },
  ];
}

export async function rankDunnesCandidates({ externalProduct, candidates }) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('The OpenAI API key is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const validCandidates = candidates
    .map(formatProductForAgent)
    .filter((candidate) => candidate.dunnesSku);

  if (validCandidates.length === 0) {
    return {
      matches: [],
      noReliableMatch: true,
    };
  }

  const prompt = buildPrompt(externalProduct, validCandidates);

  const response = await openai.responses.create({
    model: process.env.OPENAI_MATCHING_MODEL || 'gpt-4.1-mini',
    input: prompt,
    text: {
      format: {
        type: 'json_schema',
        name: 'dunnes_candidate_ranking',
        strict: true,
        schema: AGENT_SCHEMA,
      },
    },
  });

  let parsed;
  try {
    parsed = JSON.parse(response.output_text);
  } catch (error) {
    const parseError = new Error('The AI matching response could not be parsed.');
    parseError.statusCode = 502;
    throw parseError;
  }

  const validSkus = new Set(validCandidates.map((candidate) => candidate.dunnesSku));

  const matches = Array.isArray(parsed.matches)
    ? parsed.matches
        .filter(
          (match) =>
            validSkus.has(String(match.dunnesSku || '').trim()) &&
            Number.isFinite(match.confidence) &&
            match.confidence >= 0.6 &&
            match.confidence <= 1 &&
            typeof match.reason === 'string',
        )
        .map((match) => ({
          dunnesSku: String(match.dunnesSku || '').trim(),
          confidence: Number(match.confidence),
          reason: String(match.reason || '').trim(),
        }))
    : [];

  return {
    matches,
    noReliableMatch:
      parsed.noReliableMatch || matches.length === 0,
  };
}
