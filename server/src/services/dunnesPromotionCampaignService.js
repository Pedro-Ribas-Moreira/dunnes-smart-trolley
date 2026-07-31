import {
  extractPromotionCampaigns,
} from './promotionExtractionAgentService.js';

import {
  getCachedPromotionsForSku,
  savePromotionDiscovery,
} from './promotionRepositoryService.js';

const MAX_AGENT_CANDIDATES =
  Number(
    process.env
      .MAX_PROMOTION_AGENT_CANDIDATES ||
      5,
  );

function normaliseSku(value) {
  const sku =
    String(value || '')
      .replace(/\D/g, '')
      .trim();

  return /^\d{6,15}$/.test(
    sku,
  )
    ? sku
    : '';
}

function mergeCandidatePromotions(
  candidate,
  cachedResult,
) {
  const existingPromotions =
    Array.isArray(
      candidate.promotions,
    )
      ? candidate.promotions
      : [];

  const cachedPromotions =
    Array.isArray(
      cachedResult?.promotions,
    )
      ? cachedResult.promotions
      : [];

  const promotionsById =
    new Map();

  [
    ...existingPromotions,
    ...cachedPromotions,
  ].forEach(
    (promotion) => {
      const key =
        String(
          promotion.id ||
            [
              promotion.name,
              promotion.startDateUtc,
              promotion.endDateUtc,
            ]
              .filter(Boolean)
              .join('|'),
        ).trim();

      if (!key) {
        return;
      }

      promotionsById.set(
        key,
        {
          ...promotionsById.get(
            key,
          ),

          ...promotion,
        },
      );
    },
  );

  const promotions = [
    ...promotionsById.values(),
  ];

  return {
    ...candidate,

    promotionIds:
      promotions
        .map(
          (promotion) =>
            String(
              promotion.id || '',
            ).trim(),
        )
        .filter(Boolean),

    promotions,

    hasPromotion:
      promotions.length > 0,

    totalNumberOfPromotions:
      promotions.length,

    priceSource:
      promotions.length > 0
        ? 'promotion'
        : candidate.priceSource ||
          'regular',
  };
}

export async function enrichCandidatesWithPromotionCampaigns(
  candidates,
) {
  const validCandidates =
    (
      Array.isArray(candidates)
        ? candidates
        : []
    ).filter(
      (candidate) =>
        normaliseSku(
          candidate.dunnesSku,
        ),
    );

  if (
    validCandidates.length === 0
  ) {
    return (
      Array.isArray(candidates)
        ? candidates
        : []
    );
  }

  const cacheResults =
    await Promise.all(
      validCandidates.map(
        async (candidate) => {
          const sku =
            normaliseSku(
              candidate.dunnesSku,
            );

          try {
            const cache =
              await getCachedPromotionsForSku(
                sku,
              );

            return {
              sku,
              cache,
            };
          } catch (error) {
            console.warn(
              'Could not read cached promotions:',
              {
                sku,

                message:
                  error.message,
              },
            );

            return {
              sku,

              cache: {
                sku,

                promotions:
                  [],

                promotionIds:
                  [],

                cacheFresh:
                  false,
              },
            };
          }
        },
      ),
    );

  const cacheBySku =
    new Map(
      cacheResults.map(
        (result) => [
          result.sku,
          result.cache,
        ],
      ),
    );

  const candidatesNeedingAgent =
    validCandidates
      .filter(
        (candidate) => {
          const sku =
            normaliseSku(
              candidate.dunnesSku,
            );

          const cache =
            cacheBySku.get(sku);

          return !cache?.cacheFresh;
        },
      )
      .slice(
        0,
        MAX_AGENT_CANDIDATES,
      );

  if (
    candidatesNeedingAgent.length >
    0
  ) {
    const requestedSkus =
      candidatesNeedingAgent.map(
        (candidate) =>
          normaliseSku(
            candidate.dunnesSku,
          ),
      );

    const agentResult =
      await extractPromotionCampaigns(
        candidatesNeedingAgent,
      );

    try {
      await savePromotionDiscovery({
        requestedSkus,

        campaigns:
          agentResult.campaigns,

        noPromotionSkus:
          agentResult
            .noPromotionSkus,
      });
    } catch (error) {
      console.error(
        'Could not save promotion campaigns:',
        {
          requestedSkus,

          message:
            error.message,
        },
      );
    }

    const refreshedCaches =
      await Promise.all(
        requestedSkus.map(
          async (sku) => ({
            sku,

            cache:
              await getCachedPromotionsForSku(
                sku,
              ),
          }),
        ),
      );

    refreshedCaches.forEach(
      ({ sku, cache }) => {
        cacheBySku.set(
          sku,
          cache,
        );
      },
    );
  }

  const enrichedCandidates =
    (
      Array.isArray(candidates)
        ? candidates
        : []
    ).map(
      (candidate) => {
        const sku =
          normaliseSku(
            candidate.dunnesSku,
          );

        if (!sku) {
          return candidate;
        }

        return mergeCandidatePromotions(
          candidate,
          cacheBySku.get(sku),
        );
      },
    );

  console.log(
    'Candidate promotion campaign enrichment completed:',
    {
      candidateCount:
        enrichedCandidates.length,

      agentCandidateCount:
        candidatesNeedingAgent.length,

      promotionCandidates:
        enrichedCandidates.filter(
          (candidate) =>
            candidate.hasPromotion,
        ).length,

      campaigns:
        enrichedCandidates
          .filter(
            (candidate) =>
              candidate.hasPromotion,
          )
          .map(
            (candidate) => ({
              sku:
                candidate.dunnesSku,

              promotionIds:
                candidate.promotionIds,

              promotions:
                candidate.promotions.map(
                  (promotion) =>
                    promotion.name,
                ),
            }),
          ),
    },
  );

  return enrichedCandidates;
}