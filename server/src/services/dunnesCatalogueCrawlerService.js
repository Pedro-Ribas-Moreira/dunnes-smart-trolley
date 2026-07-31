import {
  FieldValue,
} from 'firebase-admin/firestore';

import {
  adminDb,
} from '../config/firebaseAdmin.js';

const DUNNES_API_BASE_URL =
  'https://storefrontgateway.dunnesstoresgrocery.com';

const APP_ID = 'dunnes-trolley';

const DEFAULT_STORE_ID = '258';

const DEFAULT_MAX_PRODUCTS = 300;
const ABSOLUTE_MAX_PRODUCTS = 2000;

const REQUEST_DELAY_MS = 150;
const REQUEST_TIMEOUT_MS = 15000;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function parsePrice(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const normalizedValue = String(value)
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');

  const parsedValue =
    Number(normalizedValue);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
}

function normaliseSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createSearchTokens(...values) {
  const ignoredWords = new Set([
    'the',
    'and',
    'with',
    'for',
    'new',
    'original',
    'classic',
  ]);

  return [
    ...new Set(
      normaliseSearchText(
        values.join(' '),
      )
        .split(' ')
        .filter(
          (word) =>
            word.length > 1 &&
            !ignoredWords.has(word),
        ),
    ),
  ];
}

function extractSearchNumbers(...values) {
  return [
    ...new Set(
      values
        .join(' ')
        .match(/\d+(?:[.,]\d+)?/g)
        ?.map((value) =>
          value.replace(',', '.'),
        ) || [],
    ),
  ];
}

function normalisePromotion(promotion) {
  if (!promotion) {
    return null;
  }

  return {
    id: String(
      promotion.id ||
        promotion.promotionId ||
        '',
    ),

    name: String(
      promotion.name ||
        promotion.description ||
        '',
    ).trim(),

    description: String(
      promotion.description || '',
    ).trim(),

    type: String(
      promotion.promotionType ||
        promotion.type ||
        '',
    ),

    minimumQuantity:
      promotion.minimumQuantity == null
        ? null
        : Number(
            promotion.minimumQuantity,
          ),

    startDate:
      promotion.startDate || null,

    startDateUtc:
      promotion.startDateUtc || null,

    endDate:
      promotion.endDate || null,

    endDateUtc:
      promotion.endDateUtc || null,

    isMoneyOff:
      Boolean(
        promotion.isMoneyOff,
      ),

    loyaltyBased:
      Boolean(
        promotion.loyaltyBased,
      ),
  };
}

function getCategoryName(product) {
  if (
    typeof product.defaultCategory ===
    'string'
  ) {
    return product.defaultCategory;
  }

  return String(
    product.defaultCategory?.name ||
      product.defaultCategory
        ?.category ||
      '',
  );
}

function getImageUrl(product) {
  return String(
    product.primaryImage?.details ||
      product.primaryImage?.default ||
      product.primaryImage?.cell ||
      product.image?.details ||
      product.image?.default ||
      product.image?.cell ||
      '',
  );
}

function normaliseRecommendedProduct(
  product,
  storeId,
  discoveredFromSku,
) {
  const sku = String(
    product.sku ||
      product.productId ||
      '',
  ).trim();

  const name = String(
    product.name || '',
  ).trim();

  const brand = String(
    product.brand || '',
  ).trim();

  const defaultCategory =
    getCategoryName(product);

  const promotions = Array.isArray(
    product.promotions,
  )
    ? product.promotions
        .map(normalisePromotion)
        .filter(Boolean)
    : [];

  const pointsBasedPromotions =
    Array.isArray(
      product.pointsBasedPromotions,
    )
      ? product.pointsBasedPromotions
          .map(normalisePromotion)
          .filter(Boolean)
      : [];

  const price =
    parsePrice(
      product.priceNumeric,
    ) ??
    parsePrice(
      product.price,
    );

  const tprPrice =
    parsePrice(
      product.tprPrice,
    );

  return {
    dunnesSku: sku,
    storeId,

    name,
    brand,
    defaultCategory,

    categories: Array.isArray(
      product.categories,
    )
      ? product.categories.map(
          (category) => ({
            id: String(
              category.categoryId ||
                category.id ||
                '',
            ),

            retailerId: String(
              category.retailerId ||
                '',
            ),

            name: String(
              category.category ||
                category.name ||
                '',
            ),

            breadcrumb: String(
              category
                .categoryBreadcrumb ||
                category.breadcrumb ||
                '',
            ),
          }),
        )
      : [],

    price,

    priceText: String(
      product.price || '',
    ),

    tprPrice,

    unitPrice: String(
      product.pricePerUnit ||
        '',
    ),

    priceLabel: String(
      product.priceLabel || '',
    ),

    priceSource: String(
      product.priceSource || '',
    ),

    imageUrl:
      getImageUrl(product),

    available:
      product.available !== false,

    valid:
      product.isValid !== false,

    promotions,

    pointsBasedPromotions,

    promotionInfo:
      product.promotionInfo || null,

    hasPromotion:
      promotions.length > 0 ||
      pointsBasedPromotions.length > 0 ||
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

    hasLoyaltyDiscount:
      Boolean(
        product.hasLoyaltyDiscount,
      ),

    searchName:
      normaliseSearchText(name),

    searchBrand:
      normaliseSearchText(brand),

    searchCategory:
      normaliseSearchText(
        defaultCategory,
      ),

    searchTokens:
      createSearchTokens(
        brand,
        name,
        defaultCategory,
        product.pricePerUnit,
      ),

    searchNumbers:
      extractSearchNumbers(
        name,
        product.pricePerUnit,
      ),

    recommendationSourceSkus:
      FieldValue.arrayUnion(
        discoveredFromSku,
      ),

    discoveredBy:
      'recommendation-crawler',

    importedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),

    source:
      'dunnes-storefront',
  };
}

async function fetchRecommendations({
  sku,
  storeId,
}) {
  const query =
    new URLSearchParams({
      ProductSku: sku,

      RecommendationName:
        'PDP_Recommendation_Container',

      PageReference:
        'page_product-detail',
    });

  const endpoint =
    `${DUNNES_API_BASE_URL}` +
    `/api/stores/${encodeURIComponent(
      storeId,
    )}` +
    '/locations/' +
    'PDP_Recommendation_Container/' +
    `recommendations?${query.toString()}`;

  const controller =
    new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      endpoint,
      {
        method: 'GET',

        headers: {
          Accept: 'application/json',

          Origin:
            'https://www.dunnesstoresgrocery.com',

          Referer:
            'https://www.dunnesstoresgrocery.com/',
        },

        signal: controller.signal,
      },
    );

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      const error = new Error(
        `Dunnes recommendations returned HTTP ${response.status}.`,
      );

      error.statusCode = 502;

      throw error;
    }

    const data =
      await response.json();

    return Array.isArray(data.items)
      ? data.items
      : [];
  } catch (error) {
    if (
      error.name === 'AbortError'
    ) {
      const timeoutError =
        new Error(
          `Recommendation request timed out for SKU ${sku}.`,
        );

      timeoutError.statusCode = 504;

      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function saveProducts(products) {
  const validProducts =
    products.filter(
      (product) =>
        Boolean(product.dunnesSku),
    );

  if (
    validProducts.length === 0
  ) {
    return 0;
  }

  const collectionReference =
    adminDb
      .collection('artifacts')
      .doc(APP_ID)
      .collection('dunnesProducts');

  const batch = adminDb.batch();

  validProducts.forEach(
    (product) => {
      batch.set(
        collectionReference.doc(
          product.dunnesSku,
        ),
        product,
        {
          merge: true,
        },
      );
    },
  );

  await batch.commit();

  return validProducts.length;
}

async function saveCrawlStatus(
  crawlId,
  data,
) {
  const reference =
    adminDb
      .collection('artifacts')
      .doc(APP_ID)
      .collection('dunnesCrawls')
      .doc(crawlId);

  await reference.set(
    {
      ...data,

      lastUpdatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}

export async function crawlDunnesCatalogue({
  seedSkus,
  storeId = DEFAULT_STORE_ID,
  maxProducts =
    DEFAULT_MAX_PRODUCTS,
}) {
  const cleanedSeedSkus = [
    ...new Set(
      seedSkus
        .map((sku) =>
          String(sku || '').trim(),
        )
        .filter(Boolean),
    ),
  ];

  const safeMaximum = Math.min(
    Math.max(
      Number(maxProducts) ||
        DEFAULT_MAX_PRODUCTS,
      1,
    ),
    ABSOLUTE_MAX_PRODUCTS,
  );

  const crawlId =
    `crawl-${Date.now()}`;

  const queue = [
    ...cleanedSeedSkus,
  ];

  const queuedSkus =
    new Set(cleanedSeedSkus);

  const processedSkus =
    new Set();

  let productsSaved = 0;
  let recommendationsFound = 0;
  let failedRequests = 0;

  const failures = [];

  await saveCrawlStatus(
    crawlId,
    {
      crawlId,
      storeId,

      seedSkus:
        cleanedSeedSkus,

      maxProducts:
        safeMaximum,

      status: 'running',

      processedCount: 0,
      productsSaved: 0,
      recommendationsFound: 0,
      failedRequests: 0,

      startedAt:
        FieldValue.serverTimestamp(),
    },
  );

  while (
    queue.length > 0 &&
    processedSkus.size <
      safeMaximum
  ) {
    const currentSku =
      queue.shift();

    if (
      processedSkus.has(
        currentSku,
      )
    ) {
      continue;
    }

    processedSkus.add(
      currentSku,
    );

    try {
      const recommendations =
        await fetchRecommendations({
          sku: currentSku,
          storeId,
        });

      recommendationsFound +=
        recommendations.length;

      const products =
        recommendations.map(
          (product) =>
            normaliseRecommendedProduct(
              product,
              storeId,
              currentSku,
            ),
        );

      productsSaved +=
        await saveProducts(products);

      for (
        const product of products
      ) {
        const recommendationSku =
          product.dunnesSku;

        if (
          !recommendationSku ||
          processedSkus.has(
            recommendationSku,
          ) ||
          queuedSkus.has(
            recommendationSku,
          )
        ) {
          continue;
        }

        queuedSkus.add(
          recommendationSku,
        );

        queue.push(
          recommendationSku,
        );
      }

      console.log(
        `[DUNNES CRAWL] SKU ${currentSku}, recommendations ${recommendations.length}, queue ${queue.length}, processed ${processedSkus.size}`,
      );
    } catch (error) {
      failedRequests += 1;

      failures.push({
        sku: currentSku,
        error:
          error.message ||
          'Unknown crawl error',
      });

      console.error(
        `[DUNNES CRAWL] SKU ${currentSku} failed:`,
        error.message,
      );
    }

    if (
      processedSkus.size %
        10 ===
      0
    ) {
      await saveCrawlStatus(
        crawlId,
        {
          status: 'running',

          processedCount:
            processedSkus.size,

          queueCount:
            queue.length,

          productsSaved,

          recommendationsFound,

          failedRequests,
        },
      );
    }

    await wait(
      REQUEST_DELAY_MS,
    );
  }

  const status =
    queue.length === 0
      ? 'completed'
      : 'limit-reached';

  const result = {
    crawlId,
    storeId,

    seedSkus:
      cleanedSeedSkus,

    maxProducts:
      safeMaximum,

    status,

    processedCount:
      processedSkus.size,

    remainingQueueCount:
      queue.length,

    uniqueSkusDiscovered:
      queuedSkus.size,

    productsSaved,

    recommendationsFound,

    failedRequests,

    failures:
      failures.slice(0, 25),
  };

  await saveCrawlStatus(
    crawlId,
    {
      ...result,

      completedAt:
        FieldValue.serverTimestamp(),
    },
  );

  return result;
}