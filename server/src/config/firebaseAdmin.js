import 'dotenv/config';

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getFirebaseCredential() {
  const projectId = String(
    process.env.FIREBASE_PROJECT_ID || '',
  ).trim();

  const clientEmail = String(
    process.env.FIREBASE_CLIENT_EMAIL || '',
  ).trim();

  const privateKey = String(
    process.env.FIREBASE_PRIVATE_KEY || '',
  )
    .replace(/\\n/g, '\n')
    .trim();

  const hasServiceAccountCredentials =
    projectId &&
    clientEmail &&
    privateKey;

  if (hasServiceAccountCredentials) {
    return cert({
      projectId,
      clientEmail,
      privateKey,
    });
  }

  console.warn(
    'Firebase service-account environment variables were not found. Falling back to Application Default Credentials.',
  );

  return applicationDefault();
}

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential:
          getFirebaseCredential(),
      });

export const adminAuth =
  getAuth(firebaseApp);

export const adminDb =
  getFirestore(firebaseApp);