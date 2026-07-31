import { adminDb } from '../config/firebaseAdmin.js';
import {
  calculateCandidateScore,
  getNumbers,
  getWords,
  normaliseText,
} from './productMatchingUtils.js';

const APP_ID = 'dunnes-trolley';
const MAX_CATALOGUE_PRODUCTS = 5000;
const MAX_SHORTLIST_SIZE = 20;

function serialiseCatalogueProduct(documentSnapshot) {
  const data = documentSnapshot.data();

  return {
    dunnesSku: String(data.dunnesSku || documentSnapshot.id).trim(),
    name: String(data.name || ''),
    brand: String(data.brand || ''),
    defaultCategory: String(data.defaultCategory || ''),
    unitPrice: String(data.unitPrice || ''),
    price: Number.isFinite(Number(data.price)) ? Number(data.price) : null,
    imageUrl: String(data.imageUrl || ''),
    available: data.available !== false,
    promotions: Array.isArray(data.promotions) ? data.promotions : [],
    hasPromotion: Boolean(data.hasPromotion),
    priceSource: String(data.priceSource || ''),
  };
}

function createSearchLabel(product) {
  const visibleText = [
    product.name,
    product.genericName,
    product.categories?.join(' '),
    product.quantity,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    productName: String(product.name || ''),
    brand: String(product.brand || ''),
    variant: String(product.genericName || ''),
    sizeText: String(product.quantity || ''),
    visibleText,
  };
}

function findShortlist(label, catalogue) {
  return catalogue
    .map((product) => ({
      ...product,
      matchScore: calculateCandidateScore(label, product),
    }))
    .filter((product) => product.matchScore > 0)
    .sort((first, second) => second.matchScore - first.matchScore)
    .slice(0, MAX_SHORTLIST_SIZE);
}

export async function loadDunnesCatalogue() {
  const snapshot = await adminDb
    .collection('artifacts')
    .doc(APP_ID)
    .collection('dunnesProducts')
    .limit(MAX_CATALOGUE_PRODUCTS)
    .get();

  return snapshot.docs.map(serialiseCatalogueProduct);
}

export function formatDunnesCandidates(catalogueProducts) {
  return catalogueProducts.map((product) => ({
    dunnesSku: product.dunnesSku,
    name: product.name,
    brand: product.brand,
    defaultCategory: product.defaultCategory,
    unitPrice: product.unitPrice,
    price: product.price,
    imageUrl: product.imageUrl,
    promotions: product.promotions,
    hasPromotion: product.hasPromotion,
    priceSource: product.priceSource,
    score: product.matchScore,
  }));
}

export async function findDunnesCandidates(openFoodFactsProduct) {
  const catalogue = await loadDunnesCatalogue();

  const label = createSearchLabel(openFoodFactsProduct);

  const shortlist = findShortlist(label, catalogue);

  return formatDunnesCandidates(shortlist);
}
