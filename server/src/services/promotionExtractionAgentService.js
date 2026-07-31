import OpenAI from 'openai';

const OPENAI_MODEL =
  process.env.OPENAI_PROMOTION_MODEL ||
  'gpt-5-mini';

const DUNNES_WEBSITE_BASE_URL =
  'https://www.dunnesstoresgrocery.com';

const openai =
  process.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey:
          process.env.OPENAI_API_KEY,
      })
    : null;

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createProductUrl(
  candidate,
) {
  if (candidate.productUrl) {
    return String(
      candidate.productUrl,
    ).trim();
  }

  const sku = String(
    candidate.dunnesSku || '',
  ).trim();

  if (!sku) {
    return '';
  }

  const nameSlug =
    slugify(
      candidate.name ||
        'product',
    ) || 'product';

  return (
    `${DUNNES_WEBSITE_BASE_URL}` +
    `/product/${nameSlug}-id-${sku}`
  );
}

function normaliseSku(value) {
  const sku = String(
    value || '',
  )
    .replace(/\D/g, '')
    .trim();

  return /^\d{6,15}$/.test(sku)
    ? sku
    : '';
}

function normaliseNullableNumber(
  value,
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue,
  )
    ? numberValue
    : null;
}

function normaliseIsoDate(
  value,
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function normaliseCampaign(
  campaign,
  requestedSkus,
) {
  const name =
    cleanText(
      campaign.name,
    );

  if (!name) {
    return null;
  }

  const eligibleSkus = [
    ...new Set(
      (
        Array.isArray(
          campaign.eligibleSkus,
        )
          ? campaign.eligibleSkus
          : []
      )
        .map(normaliseSku)
        .filter(Boolean),
    ),
  ];

  const matchingRequestedSkus =
    requestedSkus.filter(
      (sku) =>
        eligibleSkus.includes(
          sku,
        ),
    );

  if (
    matchingRequestedSkus.length ===
    0
  ) {
    return null;
  }

  const minimumQuantity =
    normaliseNullableNumber(
      campaign.minimumQuantity,
    );

  const bundlePrice =
    normaliseNullableNumber(
      campaign.bundlePrice,
    );

  const confidence =
    Math.max(
      0,
      Math.min(
        1,
        Number(
          campaign.confidence || 0,
        ),
      ),
    );

  return {
    reportedId:
      cleanText(
        campaign.reportedId,
      ),

    name,

    description:
      cleanText(
        campaign.description ||
          name,
      ),

    promotionType:
      cleanText(
        campaign.promotionType ||
          (
            minimumQuantity
              ? 'BulkPromotion'
              : 'ProductPromotion'
          ),
      ),

    minimumQuantity:
      minimumQuantity !== null &&
      minimumQuantity > 0
        ? Math.floor(
            minimumQuantity,
          )
        : null,

    bundlePrice:
      bundlePrice !== null &&
      bundlePrice > 0
        ? Number(
            bundlePrice.toFixed(2),
          )
        : null,

    startDateUtc:
      normaliseIsoDate(
        campaign.startDateUtc,
      ),

    endDateUtc:
      normaliseIsoDate(
        campaign.endDateUtc,
      ),

    loyaltyBased:
      Boolean(
        campaign.loyaltyBased,
      ),

    pointsBased:
      Boolean(
        campaign.pointsBased,
      ),

    isMoneyOff:
      campaign.isMoneyOff !==
      false,

    eligibleSkus,

    confidence,

    evidence:
      cleanText(
        campaign.evidence,
      ),

    sourceUrls: [
      ...new Set(
        (
          Array.isArray(
            campaign.sourceUrls,
          )
            ? campaign.sourceUrls
            : []
        )
          .map(
            (url) =>
              String(
                url || '',
              ).trim(),
          )
          .filter(
            (url) =>
              url.startsWith(
                'https://',
              ),
          ),
      ),
    ],
  };
}

function createAgentInput(
  candidates,
) {
  const candidateDetails =
    candidates.map(
      (candidate) => ({
        sku:
          String(
            candidate.dunnesSku ||
              '',
          ),

        name:
          cleanText(
            candidate.name,
          ),

        brand:
          cleanText(
            candidate.brand,
          ),

        price:
          Number.isFinite(
            Number(
              candidate.price,
            ),
          )
            ? Number(
                candidate.price,
              )
            : null,

        productUrl:
          createProductUrl(
            candidate,
          ),
      }),
    );

  return `
You are a retail promotion research agent for an Irish grocery trolley application.

Investigate the exact Dunnes Stores Grocery products listed below.

Use web search and open the supplied product URLs when possible. Search the Dunnes Stores Grocery website only.

Products:
${JSON.stringify(candidateDetails, null, 2)}

Your tasks:

1. Determine whether each SKU currently belongs to an active or upcoming promotion campaign.
2. Extract the exact promotion name, such as "Buy 2 for €10".
3. Extract the real Dunnes promotion or campaign ID when the website exposes one.
4. Extract minimum quantity, bundle price, start date and end date.
5. Find other Dunnes SKUs that clearly belong to the same campaign.
6. Put all linked SKUs into eligibleSkus.
7. Only link SKUs when the promotion name, terms and campaign dates match.
8. Do not infer a promotion merely because two products are in the same category.
9. Do not treat a normal product price as a promotion.
10. If there is not enough evidence for a SKU, include it in noPromotionSkus.
11. Use ISO 8601 UTC dates when dates are available.
12. Include source URLs and short evidence explaining what was found.

Important rules:

• Only return Dunnes Stores Grocery promotions.
• Never invent a promotion ID.
• reportedId must be an empty string when no real ID is visible.
• eligibleSkus must contain numeric Dunnes SKUs only.
• confidence must be from 0 to 1.
• A promotion must include at least one requested SKU.
• Do not include expired promotions.
• Loyalty-only or points-only promotions must be identified using the relevant booleans.
`.trim();
}

const promotionResponseSchema = {
  type:
    'object',

  additionalProperties:
    false,

  required: [
    'campaigns',
    'noPromotionSkus',
  ],

  properties: {
    campaigns: {
      type:
        'array',

      items: {
        type:
          'object',

        additionalProperties:
          false,

        required: [
          'reportedId',
          'name',
          'description',
          'promotionType',
          'minimumQuantity',
          'bundlePrice',
          'startDateUtc',
          'endDateUtc',
          'loyaltyBased',
          'pointsBased',
          'isMoneyOff',
          'eligibleSkus',
          'confidence',
          'evidence',
          'sourceUrls',
        ],

        properties: {
          reportedId: {
            type:
              'string',
          },

          name: {
            type:
              'string',
          },

          description: {
            type:
              'string',
          },

          promotionType: {
            type:
              'string',
          },

          minimumQuantity: {
            type: [
              'integer',
              'null',
            ],
          },

          bundlePrice: {
            type: [
              'number',
              'null',
            ],
          },

          startDateUtc: {
            type: [
              'string',
              'null',
            ],
          },

          endDateUtc: {
            type: [
              'string',
              'null',
            ],
          },

          loyaltyBased: {
            type:
              'boolean',
          },

          pointsBased: {
            type:
              'boolean',
          },

          isMoneyOff: {
            type:
              'boolean',
          },

          eligibleSkus: {
            type:
              'array',

            items: {
              type:
                'string',
            },
          },

          confidence: {
            type:
              'number',
          },

          evidence: {
            type:
              'string',
          },

          sourceUrls: {
            type:
              'array',

            items: {
              type:
                'string',
            },
          },
        },
      },
    },

    noPromotionSkus: {
      type:
        'array',

      items: {
        type:
          'string',
      },
    },
  },
};

export async function extractPromotionCampaigns(
  candidates,
) {
  const validCandidates =
    (
      Array.isArray(candidates)
        ? candidates
        : []
    ).filter(
      (candidate) =>
        /^\d{6,15}$/.test(
          String(
            candidate.dunnesSku ||
              '',
          ),
        ),
    );

  if (
    validCandidates.length === 0
  ) {
    return {
      campaigns: [],
      noPromotionSkus: [],
    };
  }

  if (!openai) {
    console.warn(
      'Promotion agent skipped because OPENAI_API_KEY is not configured.',
    );

    return {
      campaigns: [],
      noPromotionSkus:
        validCandidates.map(
          (candidate) =>
            String(
              candidate.dunnesSku,
            ),
        ),
    };
  }

  const requestedSkus =
    validCandidates.map(
      (candidate) =>
        String(
          candidate.dunnesSku,
        ),
    );

  try {
    const response =
      await openai.responses.create({
        model:
          OPENAI_MODEL,

        store:
          false,

        tools: [
          {
            type:
              'web_search',

            search_context_size:
              'high',

            user_location: {
              type:
                'approximate',

              country:
                'IE',

              city:
                'Dublin',

              region:
                'Dublin',

              timezone:
                'Europe/Dublin',
            },
          },
        ],

        text: {
          format: {
            type:
              'json_schema',

            name:
              'dunnes_promotion_campaigns',

            description:
              'Structured Dunnes promotion campaigns and SKU links.',

            strict:
              true,

            schema:
              promotionResponseSchema,
          },
        },

        input:
          createAgentInput(
            validCandidates,
          ),
      });

    const outputText =
      response.output_text;

    if (!outputText) {
      throw new Error(
        'The promotion agent returned no structured output.',
      );
    }

    const parsedResult =
      JSON.parse(
        outputText,
      );

    const campaigns =
      (
        Array.isArray(
          parsedResult.campaigns,
        )
          ? parsedResult.campaigns
          : []
      )
        .map(
          (campaign) =>
            normaliseCampaign(
              campaign,
              requestedSkus,
            ),
        )
        .filter(Boolean)
        .filter(
          (campaign) =>
            campaign.confidence >=
            0.75,
        );

    const noPromotionSkus = [
      ...new Set(
        (
          Array.isArray(
            parsedResult.noPromotionSkus,
          )
            ? parsedResult.noPromotionSkus
            : []
        )
          .map(normaliseSku)
          .filter(
            (sku) =>
              requestedSkus.includes(
                sku,
              ),
          ),
      ),
    ];

    console.log(
      'Promotion extraction agent completed:',
      {
        requestedSkus,

        campaignCount:
          campaigns.length,

        campaigns:
          campaigns.map(
            (campaign) => ({
              name:
                campaign.name,

              eligibleSkus:
                campaign.eligibleSkus,

              confidence:
                campaign.confidence,
            }),
          ),

        noPromotionSkus,
      },
    );

    return {
      campaigns,
      noPromotionSkus,
    };
  } catch (error) {
    console.error(
      'Promotion extraction agent failed:',
      {
        requestedSkus,

        message:
          error.message,
      },
    );

    return {
      campaigns: [],
      noPromotionSkus: [],
    };
  }
}