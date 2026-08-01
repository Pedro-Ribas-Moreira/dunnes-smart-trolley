import { DEFAULT_STORE_ID } from './constants.js';
import {
  cleanText,
  createAbsoluteUrl,
  parsePrice,
} from './textUtils.js';
import {
  deduplicatePromotions,
    extractPromotionsFromProduct,
  normalisePromotion,
} from './promotionUtils.js';

export function getProductSku(product) {
  return String(
    product?.sku ||
      product?.productId ||
      product?.productID ||
      product?.id ||
      product?.code ||
      '',
  ).trim();
}

export function getProductName(product) {
  return cleanText(
    product?.name ||
      product?.productName ||
      product?.title ||
      product?.displayName ||
      '',
  );
}

function getProductBrand(product) {
  return cleanText(
    product?.brand?.name ||
      product?.brand ||
      product?.manufacturer ||
      '',
  );
}

function getProductCategory(
  product,
) {
  return cleanText(
    product?.defaultCategory?.name ||
      product?.defaultCategory
        ?.category ||
      product?.defaultCategory ||
      product?.category?.name ||
      product?.category ||
      '',
  );
}

function getProductImage(product) {
  return String(
    product?.primaryImage?.details ||
      product?.primaryImage?.default ||
      product?.primaryImage?.cell ||
      product?.image?.details ||
      product?.image?.default ||
      product?.image?.cell ||
      product?.image?.url ||
      product?.imageUrl ||
      (
        Array.isArray(
          product?.images,
        )
          ? product.images[0]?.url ||
            product.images[0]
              ?.imageUrl
          : ''
      ) ||
      '',
  ).trim();
}


export function normaliseProduct(
  product,
  storeId,
) {
  const dunnesSku =
    getProductSku(product);

  const name =
    getProductName(product);

  if (
    !/^\d{6,15}$/.test(
      dunnesSku,
    ) ||
    !name
  ) {
    return null;
  }

  const promotions =
    extractPromotionsFromProduct(
      product,
    );

  const pointsBasedPromotions =
    Array.isArray(
      product.pointsBasedPromotions,
    )
      ? product.pointsBasedPromotions
          .map(
            normalisePromotion,
          )
          .filter(Boolean)
      : [];

  const price =
    parsePrice(
      product.priceNumeric,
    ) ??
    parsePrice(
      product.currentPrice,
    ) ??
    parsePrice(
      product.price?.value,
    ) ??
    parsePrice(
      product.price,
    );

  const wasPrice =
    parsePrice(
      product.wasPriceNumeric,
    ) ??
    parsePrice(
      product.regularPrice,
    ) ??
    parsePrice(
      product.originalPrice,
    ) ??
    parsePrice(
      product.wasPrice,
    );

  return {
    dunnesSku,

    storeId:
      String(
        storeId ||
          DEFAULT_STORE_ID,
      ),

    name,

    brand:
      getProductBrand(
        product,
      ),

    defaultCategory:
      getProductCategory(
        product,
      ),

    price,

    wasPrice,

    priceLabel:
      cleanText(
        product.priceLabel ||
          '',
      ),

    unitPrice:
      cleanText(
        product.pricePerUnit ||
          product.unitPrice ||
          '',
      ),

    imageUrl:
      getProductImage(
        product,
      ),

    productUrl:
      createAbsoluteUrl(
        product.productUrl ||
          product.url ||
          product.href ||
          '',
      ),

    available:
      product.available !==
        false &&
      product.isAvailable !==
        false,

    promotions,

    pointsBasedPromotions,

    hasPromotion:
      promotions.length > 0 ||
      pointsBasedPromotions.length >
        0 ||
      Number(
        product.totalNumberOfPromotions ||
          0,
      ) > 0,

    totalNumberOfPromotions:
      Number(
        product.totalNumberOfPromotions ||
          promotions.length ||
          0,
      ),

    priceSource:
      String(
        product.priceSource ||
          (
            promotions.length > 0
              ? 'promotion'
              : 'regular'
          ),
      ),

    promotionInfo:
      product.promotionInfo ||
      product.tprInfo ||
      null,

    source:
      'dunnes-live-search',

    candidateSource:
      'dunnes-live-search',
  };
}


export function mergeProducts(
  firstProduct,
  secondProduct,
) {
  if (!firstProduct) {
    return {
      ...secondProduct,

      promotions:
        Array.isArray(
          secondProduct
            ?.promotions,
        )
          ? secondProduct.promotions
          : [],

      pointsBasedPromotions:
        Array.isArray(
          secondProduct
            ?.pointsBasedPromotions,
        )
          ? secondProduct
              .pointsBasedPromotions
          : [],
    };
  }

  if (!secondProduct) {
    return firstProduct;
  }

  const promotions =
    deduplicatePromotions([
      ...(
        Array.isArray(
          firstProduct.promotions,
        )
          ? firstProduct.promotions
          : []
      ),

      ...(
        Array.isArray(
          secondProduct.promotions,
        )
          ? secondProduct.promotions
          : []
      ),
    ]);

  const pointsBasedPromotions =
    deduplicatePromotions([
      ...(
        Array.isArray(
          firstProduct
            .pointsBasedPromotions,
        )
          ? firstProduct
              .pointsBasedPromotions
          : []
      ),

      ...(
        Array.isArray(
          secondProduct
            .pointsBasedPromotions,
        )
          ? secondProduct
              .pointsBasedPromotions
          : []
      ),
    ]);

  return {
    ...firstProduct,
    ...secondProduct,

    dunnesSku:
      secondProduct.dunnesSku ||
      firstProduct.dunnesSku,

    name:
      secondProduct.name ||
      firstProduct.name,

    brand:
      secondProduct.brand ||
      firstProduct.brand,

    defaultCategory:
      secondProduct.defaultCategory ||
      firstProduct.defaultCategory,

    price:
      secondProduct.price ??
      firstProduct.price ??
      null,

    wasPrice:
      secondProduct.wasPrice ??
      firstProduct.wasPrice ??
      null,

    imageUrl:
      secondProduct.imageUrl ||
      firstProduct.imageUrl,

    productUrl:
      secondProduct.productUrl ||
      firstProduct.productUrl ||
      '',

    unitPrice:
      secondProduct.unitPrice ||
      firstProduct.unitPrice,

    promotions,

    pointsBasedPromotions,

    hasPromotion:
      promotions.length > 0 ||
      pointsBasedPromotions.length >
        0 ||
      Boolean(
        firstProduct.hasPromotion,
      ) ||
      Boolean(
        secondProduct.hasPromotion,
      ),

    totalNumberOfPromotions:
      Math.max(
        Number(
          firstProduct
            .totalNumberOfPromotions ||
            0,
        ),

        Number(
          secondProduct
            .totalNumberOfPromotions ||
            0,
        ),

        promotions.length,
      ),

    promotionInfo:
      secondProduct.promotionInfo ||
      firstProduct.promotionInfo ||
      null,

    source:
      'dunnes-live-search',

    candidateSource:
      'dunnes-live-search',
  };
}

