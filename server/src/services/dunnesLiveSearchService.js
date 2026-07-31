import { getDunnesProductBySku } from './dunnesStorefrontService.js';
import {
  DEFAULT_STORE_ID,
  DUNNES_API_BASE_URL,
  MAX_ENRICHED_RESULTS,
  MAX_SEARCH_RESULTS,
} from './dunnes/constants.js';
import { deduplicatePromotions } from './dunnes/promotionUtils.js';
import {
  mergeProducts,
  normaliseProduct,
} from './dunnes/productNormaliser.js';
import {
  collectProductObjects,
  extractProductsFromHtml,
} from './dunnes/htmlParser.js';
import {
  fetchJson,
  fetchProductPagePromotion,
  fetchSearchHtml,
} from './dunnes/httpClient.js';
import { saveDiscoveredProducts } from './dunnes/productRepository.js';
import { createSearchQueries } from './dunnes/searchQueryBuilder.js';

async function searchGateway(query, storeId) {
  const encodedQuery = encodeURIComponent(query);
  const encodedStoreId = encodeURIComponent(storeId);
  const endpoints = [
    `${DUNNES_API_BASE_URL}/api/stores/${encodedStoreId}/search?q=${encodedQuery}&take=${MAX_SEARCH_RESULTS}&skip=0&page=1`,
    `${DUNNES_API_BASE_URL}/api/stores/${encodedStoreId}/products/search?q=${encodedQuery}&take=${MAX_SEARCH_RESULTS}&skip=0&page=1`,
    `${DUNNES_API_BASE_URL}/api/stores/${encodedStoreId}/listing/search?q=${encodedQuery}&take=${MAX_SEARCH_RESULTS}&skip=0&page=1`,
  ];
  const productsBySku = new Map();

  for (const endpoint of endpoints) {
    const responseData = await fetchJson(endpoint);
    if (!responseData) continue;

    collectProductObjects(responseData).forEach((product) => {
      const normalisedProduct = normaliseProduct(product, storeId);
      if (!normalisedProduct) return;

      const currentProduct = productsBySku.get(normalisedProduct.dunnesSku);
      productsBySku.set(
        normalisedProduct.dunnesSku,
        mergeProducts(currentProduct, normalisedProduct),
      );
    });

    if (productsBySku.size >= MAX_SEARCH_RESULTS) break;
  }

  return [...productsBySku.values()].slice(0, MAX_SEARCH_RESULTS);
}

async function searchWebsite(query, storeId) {
  const html = await fetchSearchHtml(query);
  return html ? extractProductsFromHtml(html, storeId) : [];
}

async function enrichProduct(product, storeId) {
  let enrichedProduct = product;

  try {
    const storefrontProduct = await getDunnesProductBySku(
      product.dunnesSku,
      storeId,
    );
    enrichedProduct = mergeProducts(storefrontProduct, enrichedProduct);
  } catch (error) {
    console.warn('Could not enrich Dunnes product from storefront API:', {
      sku: product.dunnesSku,
      message: error.message,
    });
  }

  try {
    const pageResult = await fetchProductPagePromotion(enrichedProduct);
    const promotions = deduplicatePromotions([
      ...(enrichedProduct.promotions || []),
      ...pageResult.promotions,
    ]);

    enrichedProduct = mergeProducts(enrichedProduct, {
      ...enrichedProduct,
      productUrl: pageResult.productUrl || enrichedProduct.productUrl || '',
      price: enrichedProduct.price ?? pageResult.price ?? null,
      promotions,
      hasPromotion: promotions.length > 0,
    });

    if (pageResult.promotions.length > 0) {
      console.log('Promotion found on Dunnes product page:', {
        sku: product.dunnesSku,
        productUrl: pageResult.productUrl,
        promotions: pageResult.promotions.map((promotion) => promotion.name),
      });
    }
  } catch (error) {
    console.warn('Could not inspect Dunnes product page promotion:', {
      sku: product.dunnesSku,
      message: error.message,
    });
  }

  const promotions = enrichedProduct.promotions || [];
  return {
    ...enrichedProduct,
    hasPromotion: promotions.length > 0,
    totalNumberOfPromotions: promotions.length,
    priceSource:
      promotions.length > 0
        ? 'promotion'
        : enrichedProduct.priceSource || 'regular',
    source: 'dunnes-live-search',
    candidateSource: 'dunnes-live-search',
  };
}

async function enrichProducts(products, storeId) {
  const results = [];

  for (const product of products.slice(0, MAX_ENRICHED_RESULTS)) {
    results.push(await enrichProduct(product, storeId));
  }

  return results;
}

function deduplicateProducts(products) {
  const productsBySku = new Map();

  products.forEach((product) => {
    const sku = String(product?.dunnesSku || '').trim();
    if (!sku) return;

    productsBySku.set(
      sku,
      mergeProducts(productsBySku.get(sku), product),
    );
  });

  return [...productsBySku.values()].slice(0, MAX_SEARCH_RESULTS);
}

export async function searchLiveDunnesProducts(
  externalProduct,
  storeId = DEFAULT_STORE_ID,
) {
  const cleanStoreId = String(storeId || DEFAULT_STORE_ID).trim();
  const searchQueries = createSearchQueries(externalProduct);
  if (searchQueries.length === 0) return [];

  const allProducts = [];

  for (const query of searchQueries) {
    const [gatewayProducts, websiteProducts] = await Promise.all([
      searchGateway(query, cleanStoreId),
      searchWebsite(query, cleanStoreId),
    ]);

    allProducts.push(...gatewayProducts, ...websiteProducts);

    const uniqueProductCount = new Set(
      allProducts.map((product) => product.dunnesSku),
    ).size;

    if (uniqueProductCount >= MAX_SEARCH_RESULTS) break;
  }

  const discoveredProducts = deduplicateProducts(allProducts);
  const enrichedProducts = await enrichProducts(
    discoveredProducts,
    cleanStoreId,
  );
  const finalProducts = deduplicateProducts(enrichedProducts);

  await saveDiscoveredProducts(finalProducts);

  const promotionalProducts = finalProducts.filter(
    (product) => product.promotions?.length > 0,
  );

  console.log('Dunnes live search completed:', {
    query: searchQueries[0],
    queries: searchQueries,
    resultCount: finalProducts.length,
    promotionCount: promotionalProducts.length,
    promotionProducts: promotionalProducts.map((product) => ({
      sku: product.dunnesSku,
      name: product.name,
      price: product.price,
      productUrl: product.productUrl,
      promotions: product.promotions.map((promotion) => ({
        id: promotion.id,
        name: promotion.name,
        minimumQuantity: promotion.minimumQuantity,
        startDateUtc: promotion.startDateUtc,
        endDateUtc: promotion.endDateUtc,
        source: promotion.promotionSource,
      })),
    })),
  });

  return finalProducts;
}
