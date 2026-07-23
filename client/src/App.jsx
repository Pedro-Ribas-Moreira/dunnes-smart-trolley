import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import {
  Loader2,
  Lock,
  LogOut,
  Mail,
  ScanLine,
  ShoppingCart,
  User,
} from 'lucide-react';

import { auth, db } from './Firebase';

import ScanPage from './pages/ScanPage';
import ProductConfirmationPage from './pages/ProductConfirmationPage';
import CartPage from './pages/CartPage';

const appId = 'dunnes-trolley';

function ProfilePage({ user }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAnonymous = user ? user.isAnonymous : true;

  const handleAuth = async (event) => {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const credential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );

        await updateProfile(credential.user, {
          displayName: name,
        });

        const profileRef = doc(
          db,
          'artifacts',
          appId,
          'users',
          credential.user.uid,
          'profile',
          'details'
        );

        await setDoc(profileRef, {
          name,
          email,
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      }
    } catch (authError) {
      console.error(
        'Authentication error:',
        authError
      );

      setError(
        authError?.message
          ? authError.message.replace(
              'Firebase: ',
              ''
            )
          : 'Authentication failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (logoutError) {
      console.error(
        'Logout error:',
        logoutError
      );

      setError(
        'The account could not be logged out.'
      );
    }
  };

  if (!isAnonymous) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <User
                size={38}
                className="text-green-700"
              />
            </div>

            <h2 className="text-xl font-bold text-gray-800">
              {user.displayName || 'Shopper'}
            </h2>

            <p className="text-gray-500 mt-1">
              {user.email}
            </p>
          </div>

          {error && (
            <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-700 text-sm text-center">
                {error}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full mt-6 bg-red-50 text-red-600 font-bold py-3 rounded-xl flex justify-center items-center gap-2"
          >
            <LogOut size={20} />
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User
              size={30}
              className="text-green-700"
            />
          </div>

          <h2 className="text-xl font-bold text-gray-800">
            {isSignUp
              ? 'Create Account'
              : 'Welcome Back'}
          </h2>

          <p className="text-sm text-gray-500 mt-2">
            {isSignUp
              ? 'Save your trolley and shopping information.'
              : 'Log in to access your saved trolley.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm">
              {error}
            </p>
          </div>
        )}

        <form
          onSubmit={handleAuth}
          className="space-y-4"
        >
          {isSignUp && (
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Name
              </label>

              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Your name"
                  required
                  className="w-full border border-gray-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-green-600"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Email
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="name@example.com"
                required
                className="w-full border border-gray-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-green-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Password
            </label>

            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Enter your password"
                required
                minLength={6}
                className="w-full border border-gray-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-green-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && (
              <Loader2
                size={20}
                className="animate-spin"
              />
            )}

            {loading
              ? 'Processing...'
              : isSignUp
                ? 'Sign Up'
                : 'Log In'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsSignUp(
              (currentValue) =>
                !currentValue
            );

            setError('');
          }}
          className="w-full mt-4 text-sm text-green-700 font-semibold underline"
        >
          {isSignUp
            ? 'Already have an account? Log in'
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] =
    useState(true);

  const [activeTab, setActiveTab] =
    useState('scan');

  const [
    pendingBarcode,
    setPendingBarcode,
  ] = useState('');

  const [cartItems, setCartItems] =
    useState([]);

  const [cartError, setCartError] =
    useState('');

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          if (currentUser) {
            setUser(currentUser);
            setLoadingAuth(false);
            return;
          }

          try {
            await signInAnonymously(
              auth
            );
          } catch (authError) {
            console.error(
              'Anonymous authentication error:',
              authError
            );

            setLoadingAuth(false);
          }
        }
      );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setCartItems([]);
      return undefined;
    }

    setCartError('');

    const cartRef = collection(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'cart'
    );

    const unsubscribe = onSnapshot(
      cartRef,
      (snapshot) => {
        const items =
          snapshot.docs.map(
            (cartDocument) => ({
              id: cartDocument.id,
              ...cartDocument.data(),
            })
          );

        setCartItems(items);
      },
      (firestoreError) => {
        console.error(
          'Cart listener error:',
          firestoreError
        );

        setCartError(
          'Your trolley could not be loaded.'
        );
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  const handleBarcodeScanned =
    useCallback((barcode) => {
      setPendingBarcode(barcode);
      setActiveTab('confirm');
    }, []);

  const returnToScanner =
    useCallback(() => {
      setPendingBarcode('');
      setActiveTab('scan');
    }, []);

  const openCartAfterAdd =
    useCallback(() => {
      setPendingBarcode('');
      setActiveTab('cart');
    }, []);

  const openScanTab = () => {
    setPendingBarcode('');
    setActiveTab('scan');
  };

  const openCartTab = () => {
    setPendingBarcode('');
    setActiveTab('cart');
  };

  const openProfileTab = () => {
    setPendingBarcode('');
    setActiveTab('profile');
  };

  const cartTotal = cartItems.reduce(
    (sum, item) => {
      const price = Number(
        item.price || 0
      );

      const quantity = Number(
        item.quantity || 1
      );

      return (
        sum + price * quantity
      );
    },
    0
  );

  const totalQuantity =
    cartItems.reduce(
      (sum, item) => {
        return (
          sum +
          Number(
            item.quantity || 1
          )
        );
      },
      0
    );

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2
          size={40}
          className="text-green-700 animate-spin"
        />

        <p className="mt-4 text-gray-600 font-medium">
          Loading Dunnes Smart Trolley...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-md min-h-screen bg-white flex flex-col shadow-xl">
        <header className="bg-green-800 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">
              Dunnes Smart Trolley
            </h1>

            <p className="text-xs text-green-100 mt-1">
              {totalQuantity}{' '}
              {totalQuantity === 1
                ? 'item'
                : 'items'}{' '}
              in your trolley
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-green-100">
              Running total
            </p>

            <p className="text-xl font-bold">
              €{cartTotal.toFixed(2)}
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50 pb-24">
          {cartError && (
            <div className="m-4 bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-700 text-sm text-center">
                {cartError}
              </p>
            </div>
          )}

          <ScanPage
            user={user}
            active={
              activeTab === 'scan'
            }
            onBarcodeScanned={
              handleBarcodeScanned
            }
          />

          {activeTab ===
            'confirm' && (
            <ProductConfirmationPage
              barcode={
                pendingBarcode
              }
              user={user}
              onCancel={
                returnToScanner
              }
              onProductAdded={
                openCartAfterAdd
              }
            />
          )}

          {activeTab === 'cart' && (
            <CartPage
            cartItems={cartItems}
            user={user}
            />
          )}

          {activeTab ===
            'profile' && (
            <ProfilePage
              user={user}
            />
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-8 py-3 flex items-center justify-between z-50">
          <button
            type="button"
            onClick={openScanTab}
            className={`flex flex-col items-center gap-1 ${
              activeTab ===
                'scan' ||
              activeTab ===
                'confirm'
                ? 'text-green-700'
                : 'text-gray-400'
            }`}
          >
            <ScanLine size={24} />

            <span className="text-xs font-semibold">
              Scan
            </span>
          </button>

          <button
            type="button"
            onClick={openCartTab}
            className={`relative flex flex-col items-center gap-1 ${
              activeTab ===
              'cart'
                ? 'text-green-700'
                : 'text-gray-400'
            }`}
          >
            <ShoppingCart
              size={24}
            />

            {totalQuantity >
              0 && (
              <span className="absolute -top-2 -right-3 min-w-5 h-5 px-1 bg-green-700 text-white text-xs rounded-full flex items-center justify-center">
                {totalQuantity}
              </span>
            )}

            <span className="text-xs font-semibold">
              Cart
            </span>
          </button>

          <button
            type="button"
            onClick={
              openProfileTab
            }
            className={`flex flex-col items-center gap-1 ${
              activeTab ===
              'profile'
                ? 'text-green-700'
                : 'text-gray-400'
            }`}
          >
            <User size={24} />

            <span className="text-xs font-semibold">
              Profile
            </span>
          </button>
        </nav>
      </div>
    </div>
  );
}