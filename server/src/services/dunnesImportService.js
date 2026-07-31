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
  const parsedValue = Number(value);

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
    listingId,

    name: String(
      product.name || '',
    ).trim(),

    brand: String(
      product.brand || '',
    ).trim(),

    defaultCategory:
  typeof product.defaultCategory === 'string'
    ? product.defaultCategory
    : String(
        product.defaultCategory?.name ||
          product.defaultCategory?.category ||
          '',
      ),

    categories: Array.isArray(
      product.categories,
    )
      ? product.categories.map(
          (category) => ({
            id: String(
              category.categoryId || '',
            ),

            retailerId: String(
              category.retailerId || '',
            ),

            name: String(
              category.category || '',
            ),

            breadcrumb: String(
              category.categoryBreadcrumb ||
                '',
            ),
          }),
        )
      : [],

    price: parsePrice(
      product.priceNumeric,
    ),

    priceText: String(
      product.price || '',
    ),

    wasPrice: parsePrice(
      product.wasPriceNumeric,
    ),

    wasPriceText: String(
      product.wasPrice || '',
    ),

    unitPrice: String(
      product.pricePerUnit || '',
    ),

    imageUrl: String(
      product.image?.details ||
        product.image?.default ||
        product.image?.cell ||
        '',
    ),

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
    if (error.name === 'AbortError') {
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

async function saveProducts(
  products,
) {
  if (products.length === 0) {
    return 0;
  }

  const batch = adminDb.batch();

  const collectionReference =
    adminDb
      .collection('artifacts')
      .doc(APP_ID)
      .collection('dunnesProducts');

  products.forEach((product) => {
    if (!product.dunnesSku) {
      return;
    }

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
  });

  await batch.commit();

  return products.filter(
    (product) =>
      Boolean(product.dunnesSku),
  ).length;
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

  while (pageNumber < MAX_PAGES) {
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
      listingName;

    totalAvailable = Number(
      listingResponse.total || 0,
    );

    if (items.length === 0) {
      break;
    }

    const products = items.map(
      (product) =>
        normaliseListingProduct(
          product,
          storeId,
          listingId,
        ),
    );

    const savedCount =
      await saveProducts(products);

    importedCount += savedCount;
    pageNumber += 1;
    skip += items.length;

    console.log(
      `[DUNNES IMPORT] Page ${pageNumber}, saved ${savedCount}, total ${importedCount}`,
    );

    if (
      items.length < PAGE_SIZE ||
      (
        totalAvailable > 0 &&
        importedCount >=
          totalAvailable
      )
    ) {
      break;
    }
  }

  const importReference =
    adminDb
      .collection('artifacts')
      .doc(APP_ID)
      .collection('dunnesImports')
      .doc(listingId);

  await importReference.set(
    {
      listingId,
      listingName,
      storeId,
      importedCount,
      totalAvailable,
      pagesProcessed: pageNumber,
      lastImportedAt:
        FieldValue.serverTimestamp(),
      status: 'completed',
    },
    {
      merge: true,
    },
  );

  return {
    listingId,
    listingName,
    storeId,
    importedCount,
    totalAvailable,
    pagesProcessed: pageNumber,
  };
}