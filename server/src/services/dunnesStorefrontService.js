const DUNNES_API_BASE_URL =
  'https://storefrontgateway.dunnesstoresgrocery.com';

const DEFAULT_STORE_ID = '258';

function parsePrice(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : null;
  }

  const cleanedValue = String(value || '')
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');

  const parsedValue = Number(cleanedValue);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
}

function normalisePromotion(promotion) {
  if (!promotion) {
    return null;
  }

  return {
    id:
      promotion.id ||
      promotion.promotionId ||
      null,

    name:
      promotion.name ||
      promotion.description ||
      promotion.promotionDescription ||
      '',

    type:
      promotion.promotionType ||
      promotion.type ||
      '',

    minimumQuantity: Number(
      promotion.minimumQuantity ||
        promotion.minQuantity ||
        promotion.quantity ||
        0,
    ),

    startDate:
      promotion.startDate || null,

    endDate:
      promotion.endDate || null,
  };
}

function getProductImage(data) {
  if (data.imageUrl) {
    return data.imageUrl;
  }

  if (typeof data.image === 'string') {
    return data.image;
  }

  if (Array.isArray(data.images)) {
    const firstImage = data.images[0];

    return (
      firstImage?.url ||
      firstImage?.imageUrl ||
      ''
    );
  }

  return '';
}

function normaliseDunnesProduct(
  data,
  storeId,
) {
  const promotions = Array.isArray(
    data.promotions,
  )
    ? data.promotions
        .map(normalisePromotion)
        .filter(Boolean)
    : [];

  return {
    dunnesSku: String(
      data.sku || data.id || '',
    ),

    storeId,

    name: String(data.name || ''),

    brand: String(
      data.brand?.name ||
        data.brand ||
        '',
    ),

    price: parsePrice(data.price),

    wasPrice: parsePrice(
      data.wasPrice,
    ),

    priceLabel: String(
      data.priceLabel || '',
    ),

    imageUrl: getProductImage(data),

    available:
      data.available ??
      data.isAvailable ??
      true,

    promotions,

    hasPromotion:
      promotions.length > 0,

    source: 'dunnes-storefront',
  };
}

export async function getDunnesProductBySku(
  sku,
  storeId = DEFAULT_STORE_ID,
) {
  const cleanSku = String(
    sku || '',
  ).trim();

  const cleanStoreId = String(
    storeId || DEFAULT_STORE_ID,
  ).trim();

  const controller =
    new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    10000,
  );

  const endpoint =
    `${DUNNES_API_BASE_URL}` +
    `/api/stores/${encodeURIComponent(
      cleanStoreId,
    )}` +
    `/products/${encodeURIComponent(
      cleanSku,
    )}`;

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
      return null;
    }

    if (!response.ok) {
      const error = new Error(
        `Dunnes returned HTTP ${response.status}.`,
      );

      error.statusCode = 502;

      throw error;
    }

    const data = await response.json();

    return normaliseDunnesProduct(
      data,
      cleanStoreId,
    );
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(
        'The request to Dunnes timed out.',
      );

      timeoutError.statusCode = 504;

      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}