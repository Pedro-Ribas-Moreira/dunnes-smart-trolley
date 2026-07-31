import express from 'express';

import {
  authenticateUser,
} from '../middleware/authenticateUser.js';

import {
  findOpenFoodFactsProduct,
} from '../services/openFoodFactsService.js';

import {
  findSavedProduct,
  saveCatalogueProduct,
} from '../services/productCatalogueService.js';

import {
  findDunnesCandidates,
} from '../services/dunnesCatalogueMatchService.js';

import {
  rankDunnesCandidates,
} from '../services/productMatchingAgentService.js';

import {
  searchLiveDunnesProducts,
} from '../services/dunnesLiveSearchService.js';

import {
  enrichCandidatesWithPromotionCampaigns,
} from '../services/dunnesPromotionCampaignService.js';

const router =
  express.Router();

function cleanBarcode(
  value,
) {
  return String(
    value || '',
  ).replace(
    /\D/g,
    '',
  );
}

function isValidBarcode(
  barcode,
) {
  return [
    8,
    12,
    13,
    14,
  ].includes(
    barcode.length,
  );
}

function parsePrice(
  value,
) {
  const normalizedValue =
    String(value)
      .trim()
      .replace(
        ',',
        '.',
      );

  if (
    !normalizedValue
  ) {
    return Number.NaN;
  }

  return Number(
    normalizedValue,
  );
}

function validateProduct(
  requestBody,
) {
  const barcode =
    cleanBarcode(
      requestBody.barcode,
    );

  const name =
    String(
      requestBody.name ||
        '',
    ).trim();

  const brand =
    String(
      requestBody.brand ||
        '',
    ).trim();

  const imageUrl =
    String(
      requestBody.imageUrl ||
        '',
    ).trim();

  const source =
    String(
      requestBody.source ||
        'manual',
    ).trim();

  const dunnesSku =
    String(
      requestBody.dunnesSku ||
        '',
    ).trim();

  const matchMethod =
    String(
      requestBody.matchMethod ||
        '',
    ).trim();

  const matchConfidence =
    Number(
      requestBody.matchConfidence,
    );

  const price =
    parsePrice(
      requestBody.price,
    );

  const promotions =
    Array.isArray(
      requestBody.promotions,
    )
      ? requestBody.promotions
      : [];

  const promotionIds =
    Array.isArray(
      requestBody.promotionIds,
    )
      ? requestBody.promotionIds
          .map(
            (id) =>
              String(
                id || '',
              ).trim(),
          )
          .filter(Boolean)
      : promotions
          .map(
            (promotion) =>
              String(
                promotion.id ||
                  '',
              ).trim(),
          )
          .filter(Boolean);

  const errors = [];

  if (
    !isValidBarcode(
      barcode,
    )
  ) {
    errors.push(
      'The barcode must contain 8, 12, 13 or 14 digits.',
    );
  }

  if (!name) {
    errors.push(
      'The product name is required.',
    );
  }

  if (
    name.length > 200
  ) {
    errors.push(
      'The product name is too long.',
    );
  }

  if (
    !Number.isFinite(
      price,
    ) ||
    price <= 0
  ) {
    errors.push(
      'The product price must be greater than zero.',
    );
  }

  if (
    dunnesSku &&
    !/^\d{6,15}$/.test(
      dunnesSku,
    )
  ) {
    errors.push(
      'The Dunnes SKU must be a numeric SKU between 6 and 15 digits.',
    );
  }

  if (
    requestBody.matchConfidence !=
      null &&
    (
      !Number.isFinite(
        matchConfidence,
      ) ||
      matchConfidence < 0 ||
      matchConfidence > 1
    )
  ) {
    errors.push(
      'matchConfidence must be a number between 0 and 1.',
    );
  }

  if (
    price > 10000
  ) {
    errors.push(
      'The product price is too high.',
    );
  }

  return {
    errors,

    product: {
      barcode,
      name,
      brand,
      imageUrl,
      price,
      source,

      originalSource:
        source,

      dunnesSku,
      matchMethod,
      matchConfidence,
      promotionIds,
      promotions,

      hasPromotion:
        promotions.length > 0,
    },
  };
}

router.get(
  '/:barcode',

  async (
    request,
    response,
  ) => {
    const barcode =
      cleanBarcode(
        request.params.barcode,
      );

    if (
      !isValidBarcode(
        barcode,
      )
    ) {
      return response
        .status(400)
        .json({
          success: false,

          error:
            'The barcode must contain 8, 12, 13 or 14 digits.',
        });
    }

    try {
      const savedProduct =
        await findSavedProduct(
          barcode,
        );

      if (
        savedProduct
      ) {
        let enrichedSavedProduct =
          savedProduct;

        if (
          savedProduct.dunnesSku
        ) {
          try {
            const [
              campaignProduct,
            ] =
              await enrichCandidatesWithPromotionCampaigns(
                [
                  savedProduct,
                ],
              );

            if (
              campaignProduct
            ) {
              enrichedSavedProduct =
                campaignProduct;
            }
          } catch (error) {
            console.warn(
              'Saved product promotion enrichment failed:',
              {
                barcode,

                dunnesSku:
                  savedProduct
                    .dunnesSku,

                message:
                  error.message,
              },
            );
          }
        }

        return response.json({
          success: true,
          found: true,

          source:
            'firebase',

          product:
            enrichedSavedProduct,

          manualEntryRequired:
            false,
        });
      }

      const openFoodFactsProduct =
        await findOpenFoodFactsProduct(
          barcode,
        );

      if (
        !openFoodFactsProduct
      ) {
        return response.json({
          success: true,
          found: false,
          barcode,
          source: null,

          manualEntryRequired:
            true,
        });
      }

      const [
        savedCandidatesResult,
        liveCandidatesResult,
      ] =
        await Promise.allSettled(
          [
            findDunnesCandidates(
              openFoodFactsProduct,
            ),

            searchLiveDunnesProducts(
              openFoodFactsProduct,
            ),
          ],
        );

      const savedCandidates =
        savedCandidatesResult.status ===
        'fulfilled'
          ? savedCandidatesResult.value
          : [];

      const liveCandidates =
        liveCandidatesResult.status ===
        'fulfilled'
          ? liveCandidatesResult.value
          : [];

      if (
        liveCandidatesResult.status ===
        'rejected'
      ) {
        console.warn(
          'Dunnes live search failed. Continuing with saved catalogue candidates:',

          liveCandidatesResult.reason,
        );
      }

      const candidateBySku =
        new Map();

      [
        ...savedCandidates,
        ...liveCandidates,
      ].forEach(
        (candidate) => {
          const sku =
            String(
              candidate.dunnesSku ||
                '',
            ).trim();

          if (!sku) {
            return;
          }

          const existingCandidate =
            candidateBySku.get(
              sku,
            );

          const existingPromotions =
            Array.isArray(
              existingCandidate
                ?.promotions,
            )
              ? existingCandidate
                  .promotions
              : [];

          const newPromotions =
            Array.isArray(
              candidate.promotions,
            )
              ? candidate.promotions
              : [];

          candidateBySku.set(
            sku,
            {
              ...existingCandidate,
              ...candidate,

              promotions:
                newPromotions.length > 0
                  ? newPromotions
                  : existingPromotions,

              hasPromotion:
                newPromotions.length > 0 ||
                existingPromotions.length >
                  0 ||
                Boolean(
                  candidate.hasPromotion,
                ) ||
                Boolean(
                  existingCandidate
                    ?.hasPromotion,
                ),
            },
          );
        },
      );

      const dunnesCandidates =
        [
          ...candidateBySku.values(),
        ];

      const rankedCandidates =
        await rankDunnesCandidates(
          {
            externalProduct:
              openFoodFactsProduct,

            candidates:
              dunnesCandidates,
          },
        );

      const matchedCandidates =
        rankedCandidates.matches.map(
          (match) => ({
            ...candidateBySku.get(
              match.dunnesSku,
            ),

            ...match,
          }),
        );

      let enrichedCandidates =
        matchedCandidates;

      try {
        enrichedCandidates =
          await enrichCandidatesWithPromotionCampaigns(
            matchedCandidates,
          );
      } catch (error) {
        console.error(
          'Promotion campaign enrichment failed. Returning product matches without campaign enrichment:',
          {
            barcode,

            message:
              error.message,
          },
        );
      }

      console.log(
        'Product candidate lookup completed:',
        {
          barcode,

          productName:
            openFoodFactsProduct.name,

          savedCandidates:
            savedCandidates.length,

          liveCandidates:
            liveCandidates.length,

          rankedCandidates:
            enrichedCandidates.length,

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

      return response.json({
        success: true,
        found: true,

        source:
          'open-food-facts',

        product:
          openFoodFactsProduct,

        manualEntryRequired:
          false,

        confirmationRequired:
          true,

        dunnesCandidates:
          enrichedCandidates,

        noReliableMatch:
          rankedCandidates.noReliableMatch,
      });
    } catch (error) {
      console.error(
        'Product lookup failed:',
        error,
      );

      return response
        .status(502)
        .json({
          success: false,
          found: false,
          barcode,

          error:
            error.message ||
            'The product lookup failed.',

          manualEntryRequired:
            true,
        });
    }
  },
);

router.post(
  '/',

  authenticateUser,

  async (
    request,
    response,
  ) => {
    const {
      errors,
      product,
    } =
      validateProduct(
        request.body,
      );

    if (
      errors.length > 0
    ) {
      return response
        .status(400)
        .json({
          success: false,
          errors,
        });
    }

    try {
      const savedProduct =
        await saveCatalogueProduct(
          product,
          request.user.uid,
        );

      return response
        .status(201)
        .json({
          success: true,

          message:
            'The product was saved successfully.',

          product:
            savedProduct,
        });
    } catch (error) {
      console.error(
        'Product save failed:',
        error,
      );

      return response
        .status(500)
        .json({
          success: false,

          error:
            'The product could not be saved.',
        });
    }
  },
);

export default router;