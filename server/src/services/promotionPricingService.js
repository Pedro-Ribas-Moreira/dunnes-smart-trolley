function roundMoney(value) {
  return Number(
    Number(
      value || 0,
    ).toFixed(2),
  );
}

function parsePromotionDate(
  value,
) {
  if (!value) {
    return null;
  }

  const directDate =
    new Date(value);

  if (
    !Number.isNaN(
      directDate.getTime(),
    )
  ) {
    return directDate;
  }

  const match =
    String(value).match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    );

  if (!match) {
    return null;
  }

  const [
    ,
    day,
    month,
    year,
  ] = match;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    23,
    59,
    59,
    999,
  );
}

function isPromotionActive(
  promotion,
  now = new Date(),
) {
  if (!promotion) {
    return false;
  }

  if (
    promotion.loyaltyBased ||
    promotion.pointsBased
  ) {
    return false;
  }

  const startDate =
    parsePromotionDate(
      promotion.startDateUtc ||
        promotion.startDate,
    );

  const endDate =
    parsePromotionDate(
      promotion.endDateUtc ||
        promotion.endDate,
    );

  if (
    startDate &&
    now < startDate
  ) {
    return false;
  }

  if (
    endDate &&
    now > endDate
  ) {
    return false;
  }

  return true;
}

function parseBulkOffer(
  promotion,
) {
  const structuredMinimumQuantity =
    Number(
      promotion
        ?.minimumQuantity,
    );

  const structuredBundlePrice =
    Number(
      promotion
        ?.bundlePrice,
    );

  if (
    Number.isFinite(
      structuredMinimumQuantity,
    ) &&
    structuredMinimumQuantity >= 2 &&
    Number.isFinite(
      structuredBundlePrice,
    ) &&
    structuredBundlePrice > 0
  ) {
    return {
      minimumQuantity:
        Math.floor(
          structuredMinimumQuantity,
        ),

      bundlePrice:
        roundMoney(
          structuredBundlePrice,
        ),
    };
  }

  const text = [
    promotion?.name,
    promotion?.description,
  ]
    .filter(Boolean)
    .join(' ');

  const match =
    text.match(
      /(?:buy\s+)?(\d+)\s+for\s+[€£]?\s*(\d+(?:[.,]\d{1,2})?)/i,
    );

  if (!match) {
    return null;
  }

  const minimumQuantity =
    Number(
      promotion.minimumQuantity ||
        match[1],
    );

  const bundlePrice =
    Number(
      match[2].replace(
        ',',
        '.',
      ),
    );

  if (
    !Number.isFinite(
      minimumQuantity,
    ) ||
    minimumQuantity < 2 ||
    !Number.isFinite(
      bundlePrice,
    ) ||
    bundlePrice <= 0
  ) {
    return null;
  }

  return {
    minimumQuantity:
      Math.floor(
        minimumQuantity,
      ),

    bundlePrice:
      roundMoney(
        bundlePrice,
      ),
  };
}

function getPromotionKey(
  promotion,
) {
  const id =
    String(
      promotion?.id || '',
    ).trim();

  if (id) {
    return id;
  }

  return [
    promotion?.name,
    promotion?.startDateUtc ||
      promotion?.startDate,
    promotion?.endDateUtc ||
      promotion?.endDate,
  ]
    .filter(Boolean)
    .join('|');
}

function getEligibleBulkPromotions(
  item,
) {
  const promotions =
    Array.isArray(
      item?.promotions,
    )
      ? item.promotions
      : [];

  return promotions
    .filter(
      (promotion) =>
        isPromotionActive(
          promotion,
        ),
    )
    .map(
      (promotion) => {
        const parsedOffer =
          parseBulkOffer(
            promotion,
          );

        if (!parsedOffer) {
          return null;
        }

        const key =
          getPromotionKey(
            promotion,
          );

        if (!key) {
          return null;
        }

        return {
          ...promotion,
          ...parsedOffer,
          key,
        };
      },
    )
    .filter(Boolean);
}

export function calculateCartPricing(
  cartItems,
) {
  const itemResults =
    (
      cartItems || []
    ).map(
      (item) => {
        const price =
          Number(
            item.price || 0,
          );

        const quantity =
          Math.max(
            1,
            Number(
              item.quantity ||
                1,
            ),
          );

        return {
          ...item,
          price,
          quantity,

          regularSubtotal:
            roundMoney(
              price * quantity,
            ),

          finalSubtotal:
            roundMoney(
              price * quantity,
            ),

          discount:
            0,

          appliedPromotions:
            [],
        };
      },
    );

  const promotionGroups =
    new Map();

  itemResults.forEach(
    (item, index) => {
      const promotions =
        getEligibleBulkPromotions(
          item,
        );

      promotions.forEach(
        (promotion) => {
          const currentGroup =
            promotionGroups.get(
              promotion.key,
            ) || {
              promotion,
              itemIndexes: [],
            };

          if (
            !currentGroup
              .itemIndexes
              .includes(index)
          ) {
            currentGroup
              .itemIndexes
              .push(index);
          }

          promotionGroups.set(
            promotion.key,
            currentGroup,
          );
        },
      );
    },
  );

  const appliedPromotions =
    [];

  const discountedUnits =
    new Set();

  promotionGroups.forEach(
    ({
      promotion,
      itemIndexes,
    }) => {
      const units = [];

      itemIndexes.forEach(
        (itemIndex) => {
          const item =
            itemResults[
              itemIndex
            ];

          for (
            let unitIndex = 0;
            unitIndex <
            item.quantity;
            unitIndex += 1
          ) {
            const unitKey =
              `${itemIndex}:${unitIndex}`;

            if (
              discountedUnits.has(
                unitKey,
              )
            ) {
              continue;
            }

            units.push({
              itemIndex,
              unitIndex,
              unitKey,

              unitPrice:
                item.price,
            });
          }
        },
      );

      units.sort(
        (
          first,
          second,
        ) =>
          second.unitPrice -
          first.unitPrice,
      );

      const groupCount =
        Math.floor(
          units.length /
            promotion
              .minimumQuantity,
        );

      if (
        groupCount < 1
      ) {
        return;
      }

      let totalDiscount = 0;

      let groupsActuallyApplied =
        0;

      const discountedByItem =
        new Map();

      for (
        let groupIndex = 0;
        groupIndex <
        groupCount;
        groupIndex += 1
      ) {
        const start =
          groupIndex *
          promotion
            .minimumQuantity;

        const groupUnits =
          units.slice(
            start,
            start +
              promotion
                .minimumQuantity,
          );

        const regularGroupTotal =
          groupUnits.reduce(
            (
              sum,
              unit,
            ) =>
              sum +
              unit.unitPrice,
            0,
          );

        const groupDiscount =
          Math.max(
            0,
            roundMoney(
              regularGroupTotal -
                promotion
                  .bundlePrice,
            ),
          );

        if (
          groupDiscount <= 0
        ) {
          continue;
        }

        groupsActuallyApplied +=
          1;

        totalDiscount =
          roundMoney(
            totalDiscount +
              groupDiscount,
          );

        const denominator =
          regularGroupTotal ||
          1;

        let allocatedDiscount =
          0;

        groupUnits.forEach(
          (
            unit,
            unitPosition,
          ) => {
            discountedUnits.add(
              unit.unitKey,
            );

            const isLastUnit =
              unitPosition ===
              groupUnits.length -
                1;

            const unitDiscount =
              isLastUnit
                ? roundMoney(
                    groupDiscount -
                      allocatedDiscount,
                  )
                : roundMoney(
                    groupDiscount *
                      (
                        unit.unitPrice /
                        denominator
                      ),
                  );

            allocatedDiscount =
              roundMoney(
                allocatedDiscount +
                  unitDiscount,
              );

            discountedByItem.set(
              unit.itemIndex,
              roundMoney(
                (
                  discountedByItem.get(
                    unit.itemIndex,
                  ) || 0
                ) +
                  unitDiscount,
              ),
            );
          },
        );
      }

      if (
        totalDiscount <= 0 ||
        groupsActuallyApplied <
          1
      ) {
        return;
      }

      discountedByItem.forEach(
        (
          discount,
          itemIndex,
        ) => {
          const item =
            itemResults[
              itemIndex
            ];

          item.discount =
            roundMoney(
              item.discount +
                discount,
            );

          item.finalSubtotal =
            roundMoney(
              item
                .regularSubtotal -
                item.discount,
            );

          item
            .appliedPromotions
            .push({
              id:
                promotion.id ||
                promotion.key,

              name:
                promotion.name ||
                promotion
                  .description ||
                'Promotion',
            });
        },
      );

      appliedPromotions.push({
        id:
          promotion.id ||
          promotion.key,

        name:
          promotion.name ||
          promotion
            .description ||
          'Promotion',

        minimumQuantity:
          promotion
            .minimumQuantity,

        bundlePrice:
          promotion
            .bundlePrice,

        groupsApplied:
          groupsActuallyApplied,

        discount:
          totalDiscount,
      });
    },
  );

  const regularSubtotal =
    roundMoney(
      itemResults.reduce(
        (
          sum,
          item,
        ) =>
          sum +
          item
            .regularSubtotal,
        0,
      ),
    );

  const promotionDiscount =
    roundMoney(
      itemResults.reduce(
        (
          sum,
          item,
        ) =>
          sum +
          item.discount,
        0,
      ),
    );

  return {
    regularSubtotal,
    promotionDiscount,

    finalTotal:
      roundMoney(
        regularSubtotal -
          promotionDiscount,
      ),

    itemResults,
    appliedPromotions,
  };
}