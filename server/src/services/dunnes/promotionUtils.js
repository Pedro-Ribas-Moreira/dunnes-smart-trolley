import { cleanText } from './textUtils.js';

export function normalisePromotion(
  promotion,
) {
  if (!promotion) {
    return null;
  }

  const name =
    cleanText(
      promotion.name ||
        promotion.description ||
        promotion.promotionDescription ||
        promotion.title ||
        promotion.displayName ||
        '',
    );

  if (!name) {
    return null;
  }

  const minimumQuantityValue =
    promotion.minimumQuantity ??
    promotion.minQuantity ??
    promotion.quantity ??
    null;

  const minimumQuantity =
    minimumQuantityValue === null
      ? null
      : Number(
          minimumQuantityValue,
        );

  return {
    id: String(
      promotion.id ||
        promotion.promotionId ||
        promotion.offerId ||
        '',
    ).trim(),

    name,

    description:
      cleanText(
        promotion.description ||
          name,
      ),

    type: String(
      promotion.promotionType ||
        promotion.type ||
        '',
    ).trim(),

    promotionType: String(
      promotion.promotionType ||
        promotion.type ||
        '',
    ).trim(),

    minimumQuantity:
      Number.isFinite(
        minimumQuantity,
      )
        ? minimumQuantity
        : null,

    startDate:
      promotion.startDate ||
      null,

    startDateUtc:
      promotion.startDateUtc ||
      null,

    endDate:
      promotion.endDate ||
      null,

    endDateUtc:
      promotion.endDateUtc ||
      null,

    limit:
      promotion.limit ??
      null,

    threshold:
      promotion.threshold ??
      null,

    limitPerSku:
      promotion.limitPerSku ??
      null,

    pointsBased:
      Boolean(
        promotion.pointsBased,
      ),

    loyaltyBased:
      Boolean(
        promotion.loyaltyBased,
      ),

    externalOffers:
      Boolean(
        promotion.externalOffers,
      ),

    isMoneyOff:
      promotion.isMoneyOff ===
      undefined
        ? true
        : Boolean(
            promotion.isMoneyOff,
          ),

    promotionSource:
      String(
        promotion.promotionSource ||
          '',
      ).trim(),
  };
}

export function deduplicatePromotions(
  promotions,
) {
  const promotionsByKey =
    new Map();

  promotions
    .filter(Boolean)
    .forEach(
      (promotion) => {
        const normalisedPromotion =
          normalisePromotion(
            promotion,
          );

        if (
          !normalisedPromotion
        ) {
          return;
        }

        const key =
          String(
            normalisedPromotion.id ||
              '',
          ).trim() ||
          [
            normalisedPromotion.name,
            normalisedPromotion
              .startDateUtc ||
              normalisedPromotion
                .startDate,
            normalisedPromotion
              .endDateUtc ||
              normalisedPromotion
                .endDate,
          ]
            .filter(Boolean)
            .join('|')
            .toLowerCase();

        if (!key) {
          return;
        }

        const existingPromotion =
          promotionsByKey.get(key);

        promotionsByKey.set(
          key,
          {
            ...existingPromotion,
            ...normalisedPromotion,
          },
        );
      },
    );

  return [
    ...promotionsByKey.values(),
  ];
}


function extractPromotionsFromProduct(
  product,
) {
  const regularPromotions = [];

  const promotionCollections = [
    product?.promotions,
    product?.offers,
    product?.promotionOffers,
    product?.activePromotions,
  ];

  promotionCollections.forEach(
    (collection) => {
      if (
        !Array.isArray(
          collection,
        )
      ) {
        return;
      }

      collection.forEach(
        (promotion) => {
          const normalised =
            normalisePromotion(
              promotion,
            );

          if (normalised) {
            regularPromotions.push(
              normalised,
            );
          }
        },
      );
    },
  );

  if (
    product?.promotion &&
    typeof product.promotion ===
      'object'
  ) {
    const normalised =
      normalisePromotion(
        product.promotion,
      );

    if (normalised) {
      regularPromotions.push(
        normalised,
      );
    }
  }

  const promotionalText =
    cleanText(
      product?.promotionText ||
        product?.promotionLabel ||
        product?.offerText ||
        product?.offerLabel ||
        product?.badgeText ||
        product?.tprInfo?.description ||
        product?.tprInfo?.name ||
        '',
    );

  if (promotionalText) {
    regularPromotions.push({
      id: String(
        product?.promotionId ||
          '',
      ).trim(),

      name:
        promotionalText,

      description:
        promotionalText,

      type:
        '',

      promotionType:
        '',

      minimumQuantity:
        null,

      startDate:
        null,

      startDateUtc:
        null,

      endDate:
        null,

      endDateUtc:
        null,

      limit:
        null,

      threshold:
        null,

      limitPerSku:
        null,

      pointsBased:
        false,

      loyaltyBased:
        false,

      externalOffers:
        false,

      isMoneyOff:
        true,

      promotionSource:
        'dunnes-api',
    });
  }

  return deduplicatePromotions(
    regularPromotions,
  );
}

