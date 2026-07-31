import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '../../config/firebaseAdmin.js';
import { APP_ID } from './constants.js';

export async function saveDiscoveredProducts(
  products,
) {
  if (
    !Array.isArray(products) ||
    products.length === 0
  ) {
    return;
  }

  const collectionReference =
    adminDb
      .collection(
        'artifacts',
      )
      .doc(APP_ID)
      .collection(
        'dunnesProducts',
      );

  const batch =
    adminDb.batch();

  products.forEach(
    (product) => {
      if (
        !product.dunnesSku
      ) {
        return;
      }

      const promotions =
        Array.isArray(
          product.promotions,
        )
          ? product.promotions
          : [];

      batch.set(
        collectionReference.doc(
          product.dunnesSku,
        ),
        {
          ...product,

          promotions,

          hasPromotion:
            promotions.length > 0,

          totalNumberOfPromotions:
            promotions.length,

          liveSearchUpdatedAt:
            FieldValue.serverTimestamp(),

          promotionUpdatedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),

          source:
            'dunnes-live-search',
        },
        {
          merge: true,
        },
      );
    },
  );

  await batch.commit();
}

