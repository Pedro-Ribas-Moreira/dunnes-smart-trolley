export function normaliseText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ignoredMatchWords = new Set([
  'the',
  'and',
  'with',
  'for',
  'new',
  'natural',
  'original',
  'classic',
  'fresh',
  'water',
  'product',
]);

export function getWords(value) {
  return normaliseText(value)
    .split(' ')
    .filter(
      (word) =>
        word.length > 1 &&
        !ignoredMatchWords.has(word),
    );
}

export function getNumbers(value) {
  return String(value || '')
    .match(/\d+(?:[.,]\d+)?/g)
    ?.map((number) =>
      number.replace(',', '.'),
    ) || [];
}

export function calculateCandidateScore(label, product) {
  const labelBrand = normaliseText(label.brand);
  const productBrand = normaliseText(product.brand);

  const labelNameWords = getWords(
    [label.productName, label.variant, label.sizeText].join(' '),
  );

  const productText = [
    product.name,
    product.brand,
    product.defaultCategory,
    product.unitPrice,
  ].join(' ');

  const productWords = getWords(productText);

  const brandMatches =
    Boolean(labelBrand) &&
    Boolean(productBrand) &&
    (labelBrand === productBrand ||
      productBrand.includes(labelBrand) ||
      labelBrand.includes(productBrand));

  if (labelBrand && productBrand && !brandMatches) {
    return 0;
  }

  const wordScore =
    productWords.length === 0 ||
    labelNameWords.length === 0
      ? 0
      : labelNameWords.filter((word) => productWords.includes(word)).length /
        Math.max(labelNameWords.length, 1);

  const sizeScore =
    getNumbers([label.sizeText, label.visibleText].join(' ')).length === 0
      ? 0
      : getNumbers([label.sizeText, label.visibleText].join(' ')).filter(
          (number) =>
            new Set(getNumbers(productText)).has(number),
        ).length / Math.max(getNumbers([label.sizeText, label.visibleText].join(' ')).length, 1);

  const normalizedProductName = normaliseText(product.name);
  const normalizedLabelName = normaliseText(label.productName);

  const exactNameBonus =
    normalizedLabelName.length > 4 &&
    normalizedProductName.includes(normalizedLabelName)
      ? 0.15
      : 0;

  const brandScore = brandMatches ? 1 : 0;

  const score = brandScore * 0.5 + wordScore * 0.35 + sizeScore * 0.15 + exactNameBonus;

  return Math.min(Number(score.toFixed(4)), 1);
}
