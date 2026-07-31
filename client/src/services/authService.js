import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import {
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { auth, db } from '../Firebase';

const appId = 'dunnes-trolley';

const guestSessionKey =
  'dunnes-smart-trolley-guest-session';

const clearGuestSessionMarker = () => {
  sessionStorage.removeItem(guestSessionKey);
};

const setGuestSessionMarker = () => {
  sessionStorage.setItem(
    guestSessionKey,
    'active',
  );
};

export const hasActiveGuestSession = () => {
  return (
    sessionStorage.getItem(
      guestSessionKey,
    ) === 'active'
  );
};

const signOutCurrentAnonymousUser =
  async () => {
    if (!auth.currentUser?.isAnonymous) {
      return;
    }

    clearGuestSessionMarker();
    await signOut(auth);
  };

export const loginWithEmail = async ({
  email,
  password,
}) => {
  await signOutCurrentAnonymousUser();

  await setPersistence(
    auth,
    browserLocalPersistence,
  );

  const credential =
    await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );

  clearGuestSessionMarker();

  return credential.user;
};

export const createAccount = async ({
  name,
  email,
  password,
}) => {
  await signOutCurrentAnonymousUser();

  await setPersistence(
    auth,
    browserLocalPersistence,
  );

  const cleanEmail = email.trim();
  const cleanName = name.trim();

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      password,
    );

  await updateProfile(credential.user, {
    displayName: cleanName,
  });

  const profileRef = doc(
    db,
    'artifacts',
    appId,
    'users',
    credential.user.uid,
    'profile',
    'details',
  );

  await setDoc(profileRef, {
    name: cleanName,
    email: cleanEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  clearGuestSessionMarker();

  return credential.user;
};

export const requestPasswordReset =
  async (email) => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      const error = new Error(
        'Enter your email address first.',
      );

      error.code = 'auth/missing-email';

      throw error;
    }

    auth.useDeviceLanguage();

    await sendPasswordResetEmail(
      auth,
      cleanEmail,
    );
  };

export const continueAsGuest = async () => {
  if (
    auth.currentUser &&
    !auth.currentUser.isAnonymous
  ) {
    return auth.currentUser;
  }

  if (auth.currentUser?.isAnonymous) {
    await signOut(auth);
  }

  clearGuestSessionMarker();

  await setPersistence(
    auth,
    browserSessionPersistence,
  );

  setGuestSessionMarker();

  try {
    const credential =
      await signInAnonymously(auth);

    return credential.user;
  } catch (error) {
    clearGuestSessionMarker();
    throw error;
  }
};

export const logoutUser = async () => {
  clearGuestSessionMarker();
  await signOut(auth);
};

export const getAuthenticationErrorMessage = (
  error,
) => {
  const errorCode = error?.code || '';

  const errorMessages = {
    'auth/missing-email':
      'Enter your email address first.',
    'auth/invalid-credential':
      'The email or password is incorrect.',
    'auth/invalid-login-credentials':
      'The email or password is incorrect.',
    'auth/user-not-found':
      'The email or password is incorrect.',
    'auth/wrong-password':
      'The email or password is incorrect.',
    'auth/invalid-email':
      'Enter a valid email address.',
    'auth/email-already-in-use':
      'An account already exists with this email.',
    'auth/weak-password':
      'Use a password with at least six characters.',
    'auth/too-many-requests':
      'Too many attempts were made. Please try again later.',
    'auth/network-request-failed':
      'A network problem occurred. Check your connection and try again.',
    'auth/operation-not-allowed':
      'This authentication method is not enabled.',
  };

  return (
    errorMessages[errorCode] ||
    'Authentication failed. Please try again.'
  );
};