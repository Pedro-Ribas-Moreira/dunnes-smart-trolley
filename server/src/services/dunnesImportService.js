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
const PAGE_SIZE = 30;
const MAX_PAGES = 100;

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

  const parsedValue = Number(
    normalizedValue,
  );

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
}

function normalisePromotion(promotion) {
  if (!promotion) {
    return null;
  }

  return {
    id: String(
      promotion.id || '',
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
      promotion.promotionType || '',
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
      Boolean(promotion.isMoneyOff),

    loyaltyBased:
      Boolean(
        promotion.loyaltyBased,
      ),
  };
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

function normaliseListingProduct(
  product,
  storeId,
  listingId,
) {
  const promotions = Array.isArray(
    product.promotions,
  )
    ? product.promotions
        .map(normalisePromotion)
        .filter(Boolean)
    : [];

  return {
    dunnesSku: String(
      product.sku ||
        product.productId ||
        '',
    ),

    storeId,

    /*
     * Keep the latest listing for quick
     * reference.
     */
    lastListingId: listingId,

    /*
     * A product can appear in several
     * Dunnes categories. arrayUnion keeps
     * all listing IDs without duplicates.
     */
    listingIds:
      FieldValue.arrayUnion(
        listingId,
      ),

    name: String(
      product.name || '',
    ).trim(),

    brand: String(
      product.brand || '',
    ).trim(),

    defaultCategory:
      typeof product.defaultCategory ===
      'string'
        ? product.defaultCategory
        : String(
            product.defaultCategory?.name ||
              product.defaultCategory
                ?.category ||
              '',
          ),

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
              category.retailerId || '',
            ),

            name: String(
              category.category ||
                category.name ||
                '',
            ),

            breadcrumb: String(
              category.categoryBreadcrumb ||
                category.breadcrumb ||
                '',
            ),
          }),
        )
      : [],

    price:
      parsePrice(
        product.priceNumeric,
      ) ??
      parsePrice(
        product.price,
      ),

    priceText: String(
      product.price || '',
    ),

    wasPrice:
      parsePrice(
        product.wasPriceNumeric,
      ) ??
      parsePrice(
        product.wasPrice,
      ),

    wasPriceText: String(
      product.wasPrice || '',
    ),

    unitPrice: String(
      product.pricePerUnit ||
        product.unitPrice ||
        '',
    ),

    imageUrl:
      getImageUrl(product),

    available:
      product.available !== false,

    valid:
      product.isValid !== false,

    priceSource: String(
      product.priceSource || '',
    ),

    promotions,

    hasPromotion:
      promotions.length > 0,

    importedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),

    source: 'dunnes-storefront',
  };
}

async function fetchListingPage({
  listingId,
  storeId,
  skip,
}) {
  const endpoint =
    `${DUNNES_API_BASE_URL}` +
    `/api/stores/${encodeURIComponent(
      storeId,
    )}` +
    `/listing/${encodeURIComponent(
      listingId,
    )}` +
    `?q=*&take=${PAGE_SIZE}` +
    `&skip=${skip}&page=1`;

  const controller =
    new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    15000,
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

    if (!response.ok) {
      const error = new Error(
        `Dunnes returned HTTP ${response.status}.`,
      );

      error.statusCode = 502;

      throw error;
    }

    return response.json();
  } catch (error) {
    if (
      error.name === 'AbortError'
    ) {
      const timeoutError =
        new Error(
          'The Dunnes listing request timed out.',
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

  const batch = adminDb.batch();

  const collectionReference =
    adminDb
      .collection('artifacts')
      .doc(APP_ID)
      .collection('dunnesProducts');

  validProducts.forEach(
    (product) => {
      const productReference =
        collectionReference.doc(
          product.dunnesSku,
        );

      batch.set(
        productReference,
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

async function saveImportStatus(
  listingId,
  data,
) {
  const importReference =
    adminDb
      .collection('artifacts')
      .doc(APP_ID)
      .collection('dunnesImports')
      .doc(listingId);

  await importReference.set(
    {
      listingId,
      ...data,
      lastUpdatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}

export async function importDunnesListing({
  listingId,
  storeId = DEFAULT_STORE_ID,
}) {
  let skip = 0;
  let pageNumber = 0;
  let importedCount = 0;
  let listingName = '';
  let totalAvailable = null;

  await saveImportStatus(
    listingId,
    {
      storeId,
      status: 'running',
      startedAt:
        FieldValue.serverTimestamp(),
      error: null,
    },
  );

  try {
    while (
      pageNumber < MAX_PAGES
    ) {
      const listingResponse =
        await fetchListingPage({
          listingId,
          storeId,
          skip,
        });

      const items = Array.isArray(
        listingResponse.items,
      )
        ? listingResponse.items
        : [];

      listingName =
        listingResponse.name ||
        listingResponse.title ||
        listingName;

      const responseTotal = Number(
        listingResponse.total ??
          listingResponse.totalItems ??
          listingResponse.count ??
          0,
      );

      if (
        Number.isFinite(
          responseTotal,
        ) &&
        responseTotal > 0
      ) {
        totalAvailable =
          responseTotal;
      }

      if (
        items.length === 0
      ) {
        break;
      }

      const products =
        items.map(
          (product) =>
            normaliseListingProduct(
              product,
              storeId,
              listingId,
            ),
        );

      const savedCount =
        await saveProducts(
          products,
        );

      importedCount +=
        savedCount;

      pageNumber += 1;
      skip += items.length;

      console.log(
        `[DUNNES IMPORT] Listing ${listingId}, page ${pageNumber}, saved ${savedCount}, total ${importedCount}`,
      );

      await saveImportStatus(
        listingId,
        {
          listingName,
          storeId,
          importedCount,
          totalAvailable,
          pagesProcessed:
            pageNumber,
          status: 'running',
        },
      );

      if (
        items.length <
          PAGE_SIZE ||
        (
          totalAvailable !==
            null &&
          importedCount >=
            totalAvailable
        )
      ) {
        break;
      }
    }

    const reachedPageLimit =
      pageNumber >= MAX_PAGES &&
      (
        totalAvailable === null ||
        importedCount <
          totalAvailable
      );

    const status =
      reachedPageLimit
        ? 'page-limit-reached'
        : 'completed';

    await saveImportStatus(
      listingId,
      {
        listingName,
        storeId,
        importedCount,
        totalAvailable,
        pagesProcessed:
          pageNumber,
        lastImportedAt:
          FieldValue.serverTimestamp(),
        status,
        error: null,
      },
    );

    return {
      success: true,
      listingId,
      listingName,
      storeId,
      importedCount,
      totalAvailable,
      pagesProcessed:
        pageNumber,
      status,
    };
  } catch (error) {
    await saveImportStatus(
      listingId,
      {
        listingName,
        storeId,
        importedCount,
        totalAvailable,
        pagesProcessed:
          pageNumber,
        status: 'failed',
        error:
          error.message ||
          'Unknown import error',
        failedAt:
          FieldValue.serverTimestamp(),
      },
    );

    throw error;
  }
}

export async function importDunnesListings({
  listingIds,
  storeId = DEFAULT_STORE_ID,
}) {
  const uniqueListingIds = [
    ...new Set(
      listingIds.map(
        (listingId) =>
          String(
            listingId || '',
          ).trim(),
      ),
    ),
  ].filter(Boolean);

  const results = [];

  for (
    const listingId of
    uniqueListingIds
  ) {
    console.log(
      `[DUNNES IMPORT] Starting listing ${listingId}`,
    );

    try {
      const result =
        await importDunnesListing({
          listingId,
          storeId,
        });

      results.push(result);
    } catch (error) {
      console.error(
        `[DUNNES IMPORT] Listing ${listingId} failed:`,
        error.message,
      );

      results.push({
        success: false,
        listingId,
        storeId,
        importedCount: 0,
        status: 'failed',
        error:
          error.message ||
          'The listing could not be imported.',
      });
    }
  }

  const successfulImports =
    results.filter(
      (result) =>
        result.success,
    );

  const failedImports =
    results.filter(
      (result) =>
        !result.success,
    );

  const totalImported =
    successfulImports.reduce(
      (
        runningTotal,
        result,
      ) =>
        runningTotal +
        Number(
          result.importedCount ||
            0,
        ),
      0,
    );

  return {
    storeId,
    listingsRequested:
      uniqueListingIds.length,
    listingsCompleted:
      successfulImports.length,
    listingsFailed:
      failedImports.length,
    totalImported,
    results,
  };
}