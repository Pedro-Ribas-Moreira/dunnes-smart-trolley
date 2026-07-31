import { readFileSync } from 'node:fs';

import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '../config/firebaseAdmin.js';
import { getDunnesProductBySku } from './dunnesStorefrontService.js';

const APP_ID = 'dunnes-trolley';
const DEFAULT_STORE_ID = '258';

const seedCatalogue = JSON.parse(
  readFileSync(
    new URL('../data/looseProduceCatalogue.json', import.meta.url),
    'utf8',
  ),
).items;

function getCollection() {
  return adminDb
    .collection('artifacts')
    .doc(APP_ID)
    .collection('looseProduce');
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normaliseSku(value) {
  const sku = String(value || '').replace(/\D/g, '');
  return /^\d{6,15}$/.test(sku) ? sku : '';
}

function normaliseList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanText).filter(Boolean))];
}

function normaliseItem(item) {
  const dunnesSku = normaliseSku(item.dunnesSku);
  const name = cleanText(item.name);

  if (!dunnesSku || !name) {
    return null;
  }

  return {
    ...item,
    dunnesSku,
    name,
    canonicalName: cleanText(item.canonicalName || name),
    category: cleanText(item.category || 'unknown'),
    subcategory: cleanText(item.subcategory),
    pricingType: cleanText(item.pricingType || 'each'),
    unitLabel: cleanText(item.unitLabel || 'each'),
    price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
    aliases: normaliseList(item.aliases),
    visualHints: normaliseList(item.visualHints),
    promotions: Array.isArray(item.promotions) ? item.promotions : [],
    productType: 'loose-produce',
    source: 'dunnes-curated',
  };
}

function getSeedCatalogue() {
  return seedCatalogue.map(normaliseItem).filter(Boolean);
}

export async function getLooseProduceCatalogue() {
  try {
    const snapshot = await getCollection().get();

    if (!snapshot.empty) {
      return snapshot.docs
        .map((document) => normaliseItem({ dunnesSku: document.id, ...document.data() }))
        .filter(Boolean);
    }
  } catch (error) {
    console.warn('Could not load the loose-produce catalogue from Firebase:', {
      message: error.message,
    });
  }

  return getSeedCatalogue();
}

async function enrichSeedItem(item, storeId) {
  try {
    const storefrontProduct = await getDunnesProductBySku(item.dunnesSku, storeId);

    return normaliseItem({
      ...item,
      ...storefrontProduct,
      dunnesSku: item.dunnesSku,
      canonicalName: item.canonicalName,
      category: item.category,
      subcategory: item.subcategory,
      pricingType: item.pricingType,
      unitLabel: item.unitLabel,
      aliases: item.aliases,
      visualHints: item.visualHints,
      productUrl: storefrontProduct.productUrl || item.productUrl,
      price: storefrontProduct.price ?? item.price,
      source: 'dunnes-curated',
    });
  } catch (error) {
    console.warn('Could not refresh curated produce item from Dunnes:', {
      sku: item.dunnesSku,
      message: error.message,
    });

    return item;
  }
}

export async function importLooseProduceCatalogue(storeId = DEFAULT_STORE_ID) {
  const items = [];

  for (const item of getSeedCatalogue()) {
    items.push(await enrichSeedItem(item, storeId));
  }

  const batch = adminDb.batch();

  items.forEach((item) => {
    batch.set(
      getCollection().doc(item.dunnesSku),
      {
        ...item,
        importedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  await batch.commit();

  return items;
}
