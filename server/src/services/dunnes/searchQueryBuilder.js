import { cleanText } from './textUtils.js';

function createSearchQuery(externalProduct) {
  const name = cleanText(
    externalProduct?.name || externalProduct?.productName || '',
  );
  const brand = cleanText(externalProduct?.brand || '');
  const quantity = cleanText(externalProduct?.quantity || '');

  return [brand, name, quantity]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export function createSearchQueries(externalProduct) {
  const name = cleanText(externalProduct?.name || '');
  const brand = cleanText(externalProduct?.brand || '');
  const quantity = cleanText(externalProduct?.quantity || '');

  return [
    createSearchQuery(externalProduct),
    [name, quantity].filter(Boolean).join(' '),
    [brand, name].filter(Boolean).join(' '),
    name,
  ]
    .map((query) => query.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((query, index, queries) => queries.indexOf(query) === index)
    .slice(0, 4);
}
