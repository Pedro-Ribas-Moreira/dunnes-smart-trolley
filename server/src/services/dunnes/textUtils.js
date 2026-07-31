import { DUNNES_WEBSITE_BASE_URL } from './constants.js';

export function parsePrice(value) {
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

export function decodeHtml(value) {
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

export function cleanText(value) {
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

export function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createProductUrl(
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

export function createAbsoluteUrl(value) {
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

