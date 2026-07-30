import {
  FieldValue,
} from 'firebase-admin/firestore';

import { adminDb } from '../config/firebaseAdmin.js';

const appId = 'dunnes-trolley';

function getProductReference(barcode) {
  return adminDb
    .collection('artifacts')
    .doc(appId)
    .collection('products')
    .doc(barcode);
}

function parseSavedPrice(value) {
  const price = Number(value);

  return Number.isFinite(price) && price > 0
    ? price
    : null;
}

export async function findSavedProduct(barcode) {
  const productSnapshot =
    await getProductReference(barcode).get();

  if (!productSnapshot.exists) {
    return null;
  }

  const data = productSnapshot.data();

  return {
    barcode,
    name: data.name || '',
    brand: data.brand || '',
    imageUrl: data.imageUrl || '',
    price: parseSavedPrice(data.price),
    source: 'firebase',
    originalSource:
      data.originalSource ||
      data.source ||
      'manual',
  };
}

export async function saveCatalogueProduct(
  product,
  userId,
) {
  const productReference =
    getProductReference(product.barcode);

  const existingSnapshot =
    await productReference.get();

  const documentData = {
    barcode: product.barcode,
    name: product.name,
    brand: product.brand || '',
    imageUrl: product.imageUrl || '',
    price: Number(product.price),
    originalSource:
      product.originalSource ||
      product.source ||
      'manual',
    source: 'firebase',
    updatedBy: userId,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!existingSnapshot.exists) {
    documentData.createdBy = userId;
    documentData.createdAt =
      FieldValue.serverTimestamp();
  }

  await productReference.set(
    documentData,
    {
      merge: true,
    },
  );

  return {
    barcode: product.barcode,
    name: product.name,
    brand: product.brand || '',
    imageUrl: product.imageUrl || '',
    price: Number(product.price),
    source: 'firebase',
    originalSource:
      documentData.originalSource,
  };
}