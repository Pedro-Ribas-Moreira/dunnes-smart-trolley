import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../Firebase';

const appId = 'dunnes-trolley';

function getProductReference(barcode) {
  return doc(db, 'artifacts', appId, 'products', barcode);
}

function parseSavedPrice(value) {
  const price = Number(value);

  return Number.isFinite(price) && price > 0 ? price : null;
}

export async function getSavedProduct(barcode) {
  const productReference = getProductReference(barcode);

  const snapshot = await getDoc(productReference);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    barcode,
    name: data.name || '',
    brand: data.brand || '',
    imageUrl: data.imageUrl || '',
    price: parseSavedPrice(data.price),
    source: data.source || 'firebase',
  };
}

export async function getOpenFoodFactsProduct(barcode, signal) {
  const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Open Food Facts returned status ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== 1 || !data.product) {
    return null;
  }

  const productName =
    data.product.product_name?.trim() ||
    data.product.product_name_en?.trim() ||
    data.product.generic_name?.trim() ||
    '';

  if (!productName) {
    return null;
  }

  return {
    barcode,
    name: productName,
    brand: data.product.brands || '',
    imageUrl: data.product.image_front_small_url || data.product.image_url || '',
    price: null,
    source: 'open-food-facts',
  };
}

export async function saveProduct(product) {
  const productReference = getProductReference(product.barcode);

  await setDoc(
    productReference,
    {
      barcode: product.barcode,
      name: product.name,
      brand: product.brand || '',
      imageUrl: product.imageUrl || '',
      price: Number(product.price),
      source: product.source || 'manual',
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}
