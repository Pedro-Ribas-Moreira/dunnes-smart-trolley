import {
  DEFAULT_STORE_ID,
  MAX_SEARCH_RESULTS,
} from './constants.js';

import {
  createAbsoluteUrl,
  decodeHtml,
} from './textUtils.js';
import {
  mergeProducts,
  normaliseProduct,
} from './productNormaliser.js';

export function collectProductObjects(
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

export function extractProductsFromHtml(
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

