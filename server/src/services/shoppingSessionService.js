import {
  FieldValue,
} from 'firebase-admin/firestore';

import {
  adminDb,
} from '../config/firebaseAdmin.js';

const appId = 'dunnes-trolley';

function normaliseCartItem(cartDocument) {
  const data = cartDocument.data();

  const price = Number(data.price || 0);
  const quantity = Math.max(
    1,
    Number(data.quantity || 1),
  );

  return {
    id: cartDocument.id,
    barcode: String(data.barcode || ''),
    name: String(
      data.name || 'Unknown product',
    ),
    brand: String(data.brand || ''),
    imageUrl: String(data.imageUrl || ''),
    price,
    quantity,
    subtotal: Number(
      (price * quantity).toFixed(2),
    ),
  };
}

function serialiseTimestamp(timestamp) {
  if (!timestamp?.toDate) {
    return null;
  }

  return timestamp.toDate().toISOString();
}

function normaliseSession(sessionDocument) {
  const data = sessionDocument.data();

  return {
    id: sessionDocument.id,
    status: data.status || 'completed',
    items: Array.isArray(data.items)
      ? data.items
      : [],
    uniqueItemCount: Number(
      data.uniqueItemCount || 0,
    ),
    itemCount: Number(
      data.itemCount || 0,
    ),
    total: Number(data.total || 0),
    createdAt: serialiseTimestamp(
      data.createdAt,
    ),
    completedAt: serialiseTimestamp(
      data.completedAt,
    ),
  };
}

export async function finishShoppingSession(
  userId,
) {
  const userRef = adminDb
    .collection('artifacts')
    .doc(appId)
    .collection('users')
    .doc(userId);

  const cartRef =
    userRef.collection('cart');

  const sessionsRef =
    userRef.collection(
      'shoppingSessions',
    );

  return adminDb.runTransaction(
    async (transaction) => {
      const cartSnapshot =
        await transaction.get(cartRef);

      if (cartSnapshot.empty) {
        const error = new Error(
          'Your trolley is empty.',
        );

        error.statusCode = 400;

        throw error;
      }

      const items =
        cartSnapshot.docs.map(
          normaliseCartItem,
        );

      const itemCount = items.reduce(
        (total, item) =>
          total + item.quantity,
        0,
      );

      const total = Number(
        items
          .reduce(
            (sum, item) =>
              sum + item.subtotal,
            0,
          )
          .toFixed(2),
      );

      const sessionRef =
        sessionsRef.doc();

      const session = {
        status: 'completed',
        items,
        uniqueItemCount: items.length,
        itemCount,
        total,
        createdAt:
          FieldValue.serverTimestamp(),
        completedAt:
          FieldValue.serverTimestamp(),
      };

      transaction.set(
        sessionRef,
        session,
      );

      cartSnapshot.docs.forEach(
        (cartDocument) => {
          transaction.delete(
            cartDocument.ref,
          );
        },
      );

      return {
        id: sessionRef.id,
        status: 'completed',
        items,
        uniqueItemCount: items.length,
        itemCount,
        total,
        createdAt:
          new Date().toISOString(),
        completedAt:
          new Date().toISOString(),
      };
    },
  );
}

export async function getShoppingSessions(
  userId,
) {
  const sessionsSnapshot =
    await adminDb
      .collection('artifacts')
      .doc(appId)
      .collection('users')
      .doc(userId)
      .collection('shoppingSessions')
      .orderBy('completedAt', 'desc')
      .limit(50)
      .get();

  return sessionsSnapshot.docs.map(
    normaliseSession,
  );
}