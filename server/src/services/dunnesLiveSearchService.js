import {
  FieldValue,
} from 'firebase-admin/firestore';

import {
  adminDb,
} from '../config/firebaseAdmin.js';

import {
  getDunnesProductBySku,
} from './dunnesStorefrontService.js';

const DUNNES_API_BASE_URL =
  'https://storefrontgateway.dunnesstoresgrocery.com';

const DUNNES_WEBSITE_BASE_URL =
  'https://www.dunnesstoresgrocery.com';

const APP_ID =
  'dunnes-trolley';

const DEFAULT_STORE_ID =
  '258';

const MAX_SEARCH_RESULTS =
  20;

const MAX_ENRICHED_RESULTS =
  20;

const REQUEST_TIMEOUT_MS =
  12000;

function parsePrice(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  if (
    typeof value === 'number'
  ) {
    return Number.isFinite(value)
      ? value
      : null;
  }

  const cleanedValue =
    String(value)
      .replace(/[^\d.,-]/g, '')
      .replace(',', '.');

  const parsedValue =
    Number(cleanedValue);

  return Number.isFinite(
    parsedValue,
  )
    ? parsedValue
    : null;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&euro;/gi, '€')
    .replace(/&#8364;/gi, '€')
    .replace(/&pound;/gi, '£')
    .replace(/&#163;/gi, '£')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanText(value) {
  return decodeHtml(
    String(value || ''),
  )
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      ' ',
    )
    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      ' ',
    )
    .replace(/<[^>]*>/g, ' ')
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
  product,
) {
  if (product?.productUrl) {
    return product.productUrl;
  }

  const sku = String(
    product?.dunnesSku || '',
  ).trim();

  if (!sku) {
    return '';
  }

  const nameSlug =
    slugify(
      product?.name ||
        'product',
    ) || 'product';

  return (
    `${DUNNES_WEBSITE_BASE_URL}` +
    `/product/${nameSlug}-id-${sku}`
  );
}

function createAbsoluteUrl(value) {
  const url =
    decodeHtml(value).trim();

  if (!url) {
    return '';
  }

  if (
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url;
  }

  if (url.startsWith('/')) {
    return (
      DUNNES_WEBSITE_BASE_URL +
      url
    );
  }

  return (
    `${DUNNES_WEBSITE_BASE_URL}/` +
    url
  );
}

function normalisePromotion(
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

function deduplicatePromotions(
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

function getProductSku(product) {
  return String(
    product?.sku ||
      product?.productId ||
      product?.productID ||
      product?.id ||
      product?.code ||
      '',
  ).trim();
}

function getProductName(product) {
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

function normaliseProduct(
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

function collectProductObjects(
  value,
) {
  const products = [];
  const visited =
    new Set();

  function visit(
    current,
    depth = 0,
  ) {
    if (
      current === null ||
      current === undefined ||
      depth > 12
    ) {
      return;
    }

    if (
      typeof current ===
      'object'
    ) {
      if (
        visited.has(
          current,
        )
      ) {
        return;
      }

      visited.add(
        current,
      );
    }

    if (
      Array.isArray(
        current,
      )
    ) {
      current.forEach(
        (item) => {
          visit(
            item,
            depth + 1,
          );
        },
      );

      return;
    }

    if (
      typeof current !==
      'object'
    ) {
      return;
    }

    const sku =
      getProductSku(
        current,
      );

    const name =
      getProductName(
        current,
      );

    if (
      /^\d{6,15}$/.test(
        sku,
      ) &&
      name
    ) {
      products.push(
        current,
      );
    }

    Object.values(
      current,
    ).forEach(
      (child) => {
        visit(
          child,
          depth + 1,
        );
      },
    );
  }

  visit(value);

  return products;
}

function extractJsonScripts(
  html,
) {
  const jsonValues = [];

  const scriptPattern =
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

  let scriptMatch =
    scriptPattern.exec(html);

  while (scriptMatch) {
    const scriptTag =
      scriptMatch[0];

    const scriptContent =
      decodeHtml(
        scriptMatch[1],
      ).trim();

    const shouldAttemptJson =
      /type=["']application\/(?:json|ld\+json)["']/i.test(
        scriptTag,
      ) ||
      /id=["']__NEXT_DATA__["']/i.test(
        scriptTag,
      ) ||
      scriptContent.startsWith(
        '{',
      ) ||
      scriptContent.startsWith(
        '[',
      );

    if (
      shouldAttemptJson &&
      scriptContent
    ) {
      try {
        jsonValues.push(
          JSON.parse(
            scriptContent,
          ),
        );
      } catch (error) {
        // Ignore scripts that are not valid JSON.
      }
    }

    scriptMatch =
      scriptPattern.exec(html);
  }

  return jsonValues;
}

function extractProductLinks(
  html,
) {
  const linksBySku =
    new Map();

  const productLinkPattern =
    /(?:href|data-href)=["']([^"']*\/product\/[^"'?#\s]+?(?:-id-|-)(\d{6,15})\/?(?:[?#][^"']*)?)["']/gi;

  let linkMatch =
    productLinkPattern.exec(
      html,
    );

  while (linkMatch) {
    const productUrl =
      createAbsoluteUrl(
        linkMatch[1],
      );

    const sku =
      String(
        linkMatch[2] || '',
      ).trim();

    if (
      sku &&
      productUrl
    ) {
      linksBySku.set(
        sku,
        productUrl,
      );
    }

    linkMatch =
      productLinkPattern.exec(
        html,
      );
  }

  return linksBySku;
}

function extractProductsFromHtml(
  html,
  storeId,
) {
  const productsBySku =
    new Map();

  const productLinks =
    extractProductLinks(
      html,
    );

  const jsonValues =
    extractJsonScripts(
      html,
    );

  jsonValues.forEach(
    (jsonValue) => {
      collectProductObjects(
        jsonValue,
      ).forEach(
        (product) => {
          const normalisedProduct =
            normaliseProduct(
              product,
              storeId,
            );

          if (
            !normalisedProduct
          ) {
            return;
          }

          const existingProduct =
            productsBySku.get(
              normalisedProduct
                .dunnesSku,
            );

          productsBySku.set(
            normalisedProduct
              .dunnesSku,
            mergeProducts(
              existingProduct,
              {
                ...normalisedProduct,

                productUrl:
                  normalisedProduct
                    .productUrl ||
                  productLinks.get(
                    normalisedProduct
                      .dunnesSku,
                  ) ||
                  '',
              },
            ),
          );
        },
      );
    },
  );

  productLinks.forEach(
    (
      productUrl,
      sku,
    ) => {
      const existingProduct =
        productsBySku.get(
          sku,
        );

      productsBySku.set(
        sku,
        mergeProducts(
          existingProduct,
          {
            dunnesSku:
              sku,

            storeId:
              String(
                storeId ||
                  DEFAULT_STORE_ID,
              ),

            name:
              '',

            brand:
              '',

            defaultCategory:
              '',

            price:
              null,

            wasPrice:
              null,

            priceLabel:
              '',

            unitPrice:
              '',

            imageUrl:
              '',

            productUrl,

            available:
              true,

            promotions:
              [],

            pointsBasedPromotions:
              [],

            hasPromotion:
              false,

            totalNumberOfPromotions:
              0,

            priceSource:
              '',

            promotionInfo:
              null,

            source:
              'dunnes-live-search',

            candidateSource:
              'dunnes-live-search',
          },
        ),
      );
    },
  );

  return [
    ...productsBySku.values(),
  ].slice(
    0,
    MAX_SEARCH_RESULTS,
  );
}

function mergeProducts(
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

function createSearchQuery(
  externalProduct,
) {
  const productName =
    cleanText(
      externalProduct?.name ||
        externalProduct
          ?.productName ||
        '',
    );

  const brand =
    cleanText(
      externalProduct?.brand ||
        '',
    );

  const quantity =
    cleanText(
      externalProduct?.quantity ||
        '',
    );

  return [
    brand,
    productName,
    quantity,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function createSearchQueries(
  externalProduct,
) {
  const mainQuery =
    createSearchQuery(
      externalProduct,
    );

  const name =
    cleanText(
      externalProduct?.name ||
        '',
    );

  const brand =
    cleanText(
      externalProduct?.brand ||
        '',
    );

  const quantity =
    cleanText(
      externalProduct?.quantity ||
        '',
    );

  const queries = [
    mainQuery,

    [
      name,
      quantity,
    ]
      .filter(Boolean)
      .join(' '),

    [
      brand,
      name,
    ]
      .filter(Boolean)
      .join(' '),

    name,
  ]
    .map(
      (query) =>
        query
          .replace(/\s+/g, ' ')
          .trim(),
    )
    .filter(Boolean);

  return [
    ...new Set(
      queries,
    ),
  ].slice(0, 4);
}

async function fetchWithTimeout(
  endpoint,
  options = {},
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS,
    );

  try {
    return await fetch(
      endpoint,
      {
        ...options,

        signal:
          controller.signal,
      },
    );
  } finally {
    clearTimeout(
      timeoutId,
    );
  }
}

async function fetchJson(
  endpoint,
) {
  try {
    const response =
      await fetchWithTimeout(
        endpoint,
        {
          method:
            'GET',

          headers: {
            Accept:
              'application/json',

            Origin:
              DUNNES_WEBSITE_BASE_URL,

            Referer:
              `${DUNNES_WEBSITE_BASE_URL}/`,

            'User-Agent':
              'Mozilla/5.0 DunnesSmartTrolley/1.0',
          },
        },
      );

    if (
      !response.ok
    ) {
      return null;
    }

    const contentType =
      String(
        response.headers.get(
          'content-type',
        ) || '',
      );

    if (
      !contentType.includes(
        'application/json',
      )
    ) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

async function fetchHtml(
  endpoint,
) {
  if (!endpoint) {
    return '';
  }

  try {
    const response =
      await fetchWithTimeout(
        endpoint,
        {
          method:
            'GET',

          redirect:
            'follow',

          headers: {
            Accept:
              'text/html,application/xhtml+xml',

            'Accept-Language':
              'en-IE,en;q=0.9',

            'Cache-Control':
              'no-cache',

            Pragma:
              'no-cache',

            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150.0.0.0 Safari/537.36',
          },
        },
      );

    if (
      !response.ok
    ) {
      return '';
    }

    return await response.text();
  } catch (error) {
    return '';
  }
}

async function fetchSearchHtml(
  query,
) {
  const resultEndpoints = [
    `${DUNNES_WEBSITE_BASE_URL}/results?page=1&q=${encodeURIComponent(
      query,
    )}&skip=0`,

    `${DUNNES_WEBSITE_BASE_URL}/search?q=${encodeURIComponent(
      query,
    )}`,
  ];

  for (
    const endpoint of resultEndpoints
  ) {
    const html =
      await fetchHtml(
        endpoint,
      );

    if (html) {
      return html;
    }
  }

  return '';
}

function getMonthNumber(
  value,
) {
  const monthName =
    String(value || '')
      .trim()
      .slice(0, 3)
      .toLowerCase();

  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  return months[monthName] ??
    null;
}

function parseDunnesDate(
  value,
  endOfDay = false,
) {
  if (!value) {
    return {
      displayDate:
        null,

      utcDate:
        null,
    };
  }

  const cleanedDate =
    cleanText(value)
      .replace(
        /(\d+)(st|nd|rd|th)/gi,
        '$1',
      )
      .replace(/,/g, '')
      .trim();

  const match =
    cleanedDate.match(
      /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/,
    );

  if (!match) {
    return {
      displayDate:
        cleanText(value),

      utcDate:
        null,
    };
  }

  const day =
    Number(match[1]);

  const month =
    getMonthNumber(
      match[2],
    );

  const year =
    Number(match[3]);

  if (
    !Number.isInteger(day) ||
    month === null ||
    !Number.isInteger(year)
  ) {
    return {
      displayDate:
        cleanText(value),

      utcDate:
        null,
    };
  }

  const date =
    endOfDay
      ? new Date(
          Date.UTC(
            year,
            month,
            day,
            23,
            59,
            59,
            999,
          ),
        )
      : new Date(
          Date.UTC(
            year,
            month,
            day,
            0,
            0,
            0,
            0,
          ),
        );

  return {
    displayDate:
      cleanText(value),

    utcDate:
      date.toISOString(),
  };
}

function extractMinimumQuantity(
  promotionName,
) {
  const match =
    cleanText(
      promotionName,
    ).match(
      /(?:buy\s+)?(\d+)\s+for\s+[€£]?\s*\d/i,
    );

  if (!match) {
    return null;
  }

  const quantity =
    Number(match[1]);

  return Number.isFinite(
    quantity,
  ) && quantity > 0
    ? quantity
    : null;
}

function extractProductPagePrice(
  pageText,
) {
  const prices = [
    ...pageText.matchAll(
      /€\s*(\d+(?:[.,]\d{1,2})?)/g,
    ),
  ]
    .map(
      (match) =>
        parsePrice(
          match[1],
        ),
    )
    .filter(
      (price) =>
        Number.isFinite(price),
    );

  return prices.length > 0
    ? prices[0]
    : null;
}

function extractPromotionName(
  pageText,
) {
  const patterns = [
    /\bBuy\s+\d+\s+for\s+€\s*\d+(?:[.,]\d{1,2})?\b/i,

    /\b\d+\s+for\s+€\s*\d+(?:[.,]\d{1,2})?\b/i,

    /\bSave\s+€\s*\d+(?:[.,]\d{1,2})?\b/i,

    /\bHalf\s+Price\b/i,

    /\bBetter\s+Than\s+Half\s+Price\b/i,

    /\bBuy\s+One\s+Get\s+One\s+Free\b/i,

    /\bBOGOF\b/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      pageText.match(
        pattern,
      );

    if (match?.[0]) {
      return cleanText(
        match[0],
      );
    }
  }

  return '';
}

function extractPromotionDates(
  pageText,
) {
  const fullDateMatch =
    pageText.match(
      /Sales?\s+price\s+valid\s+from\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})\s+until\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i,
    );

  if (fullDateMatch) {
    return {
      start:
        parseDunnesDate(
          fullDateMatch[1],
          false,
        ),

      end:
        parseDunnesDate(
          fullDateMatch[2],
          true,
        ),
    };
  }

  const shortDateMatch =
    pageText.match(
      /Offer\s+Valid:\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+)\s*-\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+)/i,
    );

  if (!shortDateMatch) {
    return {
      start: {
        displayDate:
          null,

        utcDate:
          null,
      },

      end: {
        displayDate:
          null,

        utcDate:
          null,
      },
    };
  }

  const currentYear =
    new Date().getUTCFullYear();

  return {
    start:
      parseDunnesDate(
        `${shortDateMatch[1]} ${currentYear}`,
        false,
      ),

    end:
      parseDunnesDate(
        `${shortDateMatch[2]} ${currentYear}`,
        true,
      ),
  };
}

function createWebPromotionId(
  promotionName,
  startDate,
  endDate,
) {
  const promotionKey =
    [
      slugify(
        promotionName,
      ),

      startDate ||
        'no-start',

      endDate ||
        'no-end',
    ]
      .filter(Boolean)
      .join('_');

  return (
    `WEB_${promotionKey}` ||
    'WEB_PROMOTION'
  );
}

function extractPromotionFromProductPage(
  html,
) {
  if (!html) {
    return {
      price:
        null,

      promotions:
        [],
    };
  }

  const pageText =
    cleanText(html);

  const promotionName =
    extractPromotionName(
      pageText,
    );

  if (!promotionName) {
    return {
      price:
        extractProductPagePrice(
          pageText,
        ),

      promotions:
        [],
    };
  }

  const promotionDates =
    extractPromotionDates(
      pageText,
    );

  const minimumQuantity =
    extractMinimumQuantity(
      promotionName,
    );

  const promotionType =
    minimumQuantity
      ? 'BulkPromotion'
      : 'ProductPromotion';

  const promotion = {
    id:
      createWebPromotionId(
        promotionName,
        promotionDates.start
          .utcDate,
        promotionDates.end
          .utcDate,
      ),

    name:
      promotionName,

    description:
      promotionName,

    type:
      promotionType,

    promotionType,

    minimumQuantity,

    startDate:
      promotionDates.start
        .displayDate,

    startDateUtc:
      promotionDates.start
        .utcDate,

    endDate:
      promotionDates.end
        .displayDate,

    endDateUtc:
      promotionDates.end
        .utcDate,

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
      'dunnes-product-page',
  };

  return {
    price:
      extractProductPagePrice(
        pageText,
      ),

    promotions: [
      promotion,
    ],
  };
}

async function fetchProductPagePromotion(
  product,
) {
  const productUrl =
    createProductUrl(
      product,
    );

  if (!productUrl) {
    return {
      productUrl:
        '',

      price:
        null,

      promotions:
        [],
    };
  }

  const html =
    await fetchHtml(
      productUrl,
    );

  const pagePromotion =
    extractPromotionFromProductPage(
      html,
    );

  return {
    productUrl,

    price:
      pagePromotion.price,

    promotions:
      pagePromotion.promotions,
  };
}

async function searchGateway(
  query,
  storeId,
) {
  const encodedQuery =
    encodeURIComponent(
      query,
    );

  const encodedStoreId =
    encodeURIComponent(
      storeId,
    );

  const endpoints = [
    `${DUNNES_API_BASE_URL}/api/stores/${encodedStoreId}/search?q=${encodedQuery}&take=${MAX_SEARCH_RESULTS}&skip=0&page=1`,

    `${DUNNES_API_BASE_URL}/api/stores/${encodedStoreId}/products/search?q=${encodedQuery}&take=${MAX_SEARCH_RESULTS}&skip=0&page=1`,

    `${DUNNES_API_BASE_URL}/api/stores/${encodedStoreId}/listing/search?q=${encodedQuery}&take=${MAX_SEARCH_RESULTS}&skip=0&page=1`,
  ];

  const productsBySku =
    new Map();

  for (
    const endpoint of endpoints
  ) {
    const responseData =
      await fetchJson(
        endpoint,
      );

    if (!responseData) {
      continue;
    }

    collectProductObjects(
      responseData,
    ).forEach(
      (product) => {
        const normalisedProduct =
          normaliseProduct(
            product,
            storeId,
          );

        if (
          !normalisedProduct
        ) {
          return;
        }

        const existingProduct =
          productsBySku.get(
            normalisedProduct
              .dunnesSku,
          );

        productsBySku.set(
          normalisedProduct
            .dunnesSku,
          mergeProducts(
            existingProduct,
            normalisedProduct,
          ),
        );
      },
    );

    if (
      productsBySku.size >=
      MAX_SEARCH_RESULTS
    ) {
      break;
    }
  }

  return [
    ...productsBySku.values(),
  ].slice(
    0,
    MAX_SEARCH_RESULTS,
  );
}

async function searchWebsite(
  query,
  storeId,
) {
  const html =
    await fetchSearchHtml(
      query,
    );

  if (!html) {
    return [];
  }

  return extractProductsFromHtml(
    html,
    storeId,
  );
}

async function enrichProducts(
  products,
  storeId,
) {
  const enrichedProducts = [];

  for (
    const product of products.slice(
      0,
      MAX_ENRICHED_RESULTS,
    )
  ) {
    let mergedProduct =
      product;

    try {
      const storefrontProduct =
        await getDunnesProductBySku(
          product.dunnesSku,
          storeId,
        );

      mergedProduct =
        mergeProducts(
          storefrontProduct,
          mergedProduct,
        );
    } catch (error) {
      console.warn(
        'Could not enrich Dunnes product from storefront API:',
        {
          sku:
            product.dunnesSku,

          message:
            error.message,
        },
      );
    }

    try {
      const pageResult =
        await fetchProductPagePromotion(
          mergedProduct,
        );

      mergedProduct =
        mergeProducts(
          mergedProduct,
          {
            ...mergedProduct,

            productUrl:
              pageResult.productUrl ||
              mergedProduct
                .productUrl ||
              '',

            price:
              mergedProduct.price ??
              pageResult.price ??
              null,

            promotions:
              deduplicatePromotions([
                ...(
                  Array.isArray(
                    mergedProduct
                      .promotions,
                  )
                    ? mergedProduct
                        .promotions
                    : []
                ),

                ...pageResult.promotions,
              ]),

            hasPromotion:
              (
                Array.isArray(
                  mergedProduct
                    .promotions,
                ) &&
                mergedProduct
                  .promotions.length >
                  0
              ) ||
              pageResult.promotions
                .length > 0,
          },
        );

      if (
        pageResult.promotions
          .length > 0
      ) {
        console.log(
          'Promotion found on Dunnes product page:',
          {
            sku:
              product.dunnesSku,

            productUrl:
              pageResult.productUrl,

            promotions:
              pageResult.promotions.map(
                (promotion) =>
                  promotion.name,
              ),
          },
        );
      }
    } catch (error) {
      console.warn(
        'Could not inspect Dunnes product page promotion:',
        {
          sku:
            product.dunnesSku,

          message:
            error.message,
        },
      );
    }

    enrichedProducts.push({
      ...mergedProduct,

      hasPromotion:
        Array.isArray(
          mergedProduct.promotions,
        ) &&
        mergedProduct.promotions
          .length > 0,

      totalNumberOfPromotions:
        Array.isArray(
          mergedProduct.promotions,
        )
          ? mergedProduct
              .promotions.length
          : 0,

      priceSource:
        Array.isArray(
          mergedProduct.promotions,
        ) &&
        mergedProduct.promotions
          .length > 0
          ? 'promotion'
          : mergedProduct
              .priceSource ||
            'regular',

      source:
        'dunnes-live-search',

      candidateSource:
        'dunnes-live-search',
    });
  }

  return enrichedProducts;
}

function deduplicateProducts(
  products,
) {
  const productsBySku =
    new Map();

  products.forEach(
    (product) => {
      const sku =
        String(
          product?.dunnesSku ||
            '',
        ).trim();

      if (!sku) {
        return;
      }

      const existingProduct =
        productsBySku.get(
          sku,
        );

      productsBySku.set(
        sku,
        mergeProducts(
          existingProduct,
          product,
        ),
      );
    },
  );

  return [
    ...productsBySku.values(),
  ].slice(
    0,
    MAX_SEARCH_RESULTS,
  );
}

async function saveDiscoveredProducts(
  products,
) {
  if (
    !Array.isArray(products) ||
    products.length === 0
  ) {
    return;
  }

  const collectionReference =
    adminDb
      .collection(
        'artifacts',
      )
      .doc(APP_ID)
      .collection(
        'dunnesProducts',
      );

  const batch =
    adminDb.batch();

  products.forEach(
    (product) => {
      if (
        !product.dunnesSku
      ) {
        return;
      }

      const promotions =
        Array.isArray(
          product.promotions,
        )
          ? product.promotions
          : [];

      batch.set(
        collectionReference.doc(
          product.dunnesSku,
        ),
        {
          ...product,

          promotions,

          hasPromotion:
            promotions.length > 0,

          totalNumberOfPromotions:
            promotions.length,

          liveSearchUpdatedAt:
            FieldValue.serverTimestamp(),

          promotionUpdatedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),

          source:
            'dunnes-live-search',
        },
        {
          merge: true,
        },
      );
    },
  );

  await batch.commit();
}

export async function searchLiveDunnesProducts(
  externalProduct,
  storeId = DEFAULT_STORE_ID,
) {
  const cleanStoreId =
    String(
      storeId ||
        DEFAULT_STORE_ID,
    ).trim();

  const searchQueries =
    createSearchQueries(
      externalProduct,
    );

  if (
    searchQueries.length === 0
  ) {
    return [];
  }

  const allProducts = [];

  for (
    const query of searchQueries
  ) {
    const [
      gatewayProducts,
      websiteProducts,
    ] =
      await Promise.all([
        searchGateway(
          query,
          cleanStoreId,
        ),

        searchWebsite(
          query,
          cleanStoreId,
        ),
      ]);

    allProducts.push(
      ...gatewayProducts,
      ...websiteProducts,
    );

    const uniqueProductCount =
      new Set(
        allProducts.map(
          (product) =>
            product.dunnesSku,
        ),
      ).size;

    if (
      uniqueProductCount >=
      MAX_SEARCH_RESULTS
    ) {
      break;
    }
  }

  const discoveredProducts =
    deduplicateProducts(
      allProducts,
    );

  const enrichedProducts =
    await enrichProducts(
      discoveredProducts,
      cleanStoreId,
    );

  const finalProducts =
    deduplicateProducts(
      enrichedProducts,
    );

  await saveDiscoveredProducts(
    finalProducts,
  );

  const promotionalProducts =
    finalProducts.filter(
      (product) =>
        Array.isArray(
          product.promotions,
        ) &&
        product.promotions.length >
          0,
    );

  console.log(
    'Dunnes live search completed:',
    {
      query:
        searchQueries[0],

      queries:
        searchQueries,

      resultCount:
        finalProducts.length,

      promotionCount:
        promotionalProducts.length,

      promotionProducts:
        promotionalProducts.map(
          (product) => ({
            sku:
              product.dunnesSku,

            name:
              product.name,

            price:
              product.price,

            productUrl:
              product.productUrl,

            promotions:
              product.promotions.map(
                (promotion) => ({
                  id:
                    promotion.id,

                  name:
                    promotion.name,

                  minimumQuantity:
                    promotion
                      .minimumQuantity,

                  startDateUtc:
                    promotion
                      .startDateUtc,

                  endDateUtc:
                    promotion
                      .endDateUtc,

                  source:
                    promotion
                      .promotionSource,
                }),
              ),
          }),
        ),
    },
  );

  return finalProducts;
}