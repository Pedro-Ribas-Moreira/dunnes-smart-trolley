import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  onAuthStateChanged,
} from 'firebase/auth';

import {
  collection,
  onSnapshot,
} from 'firebase/firestore';

import {
  Loader2,
  ScanLine,
  ShoppingCart,
  User,
} from 'lucide-react';

import { auth, db } from './Firebase';

import CartPage from './pages/CartPage';
import AuthPage from './pages/AuthPage';
import ProductConfirmationPage from './pages/ProductConfirmationPage';
import ProfilePage from './pages/ProfilePage';
import ScanPage from './pages/ScanPage';

import {
  hasActiveGuestSession,
  logoutUser,
} from './services/authService';

const appId = 'dunnes-trolley';

export default function App() {
  const [user, setUser] =
    useState(null);

  const [authResolved, setAuthResolved] =
    useState(false);

  const [
    splashComplete,
    setSplashComplete,
  ] = useState(false);

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
    const splashTimer = window.setTimeout(
      () => {
        setSplashComplete(true);
      },
      1200,
    );

    return () => {
      window.clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    let listenerActive = true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          try {
            const restoredGuestWithoutSession =
              currentUser?.isAnonymous &&
              !hasActiveGuestSession();

            if (
              restoredGuestWithoutSession
            ) {
              await logoutUser();

              if (listenerActive) {
                setUser(null);
                setCartItems([]);
                setCartError('');
              }

              return;
            }

            if (listenerActive) {
              setUser(currentUser);

              if (!currentUser) {
                setCartItems([]);
                setCartError('');
                setActiveTab('scan');
                setPendingBarcode('');
              }
            }
          } catch (authStateError) {
            console.error(
              'Authentication state error:',
              authStateError,
            );

            if (listenerActive) {
              setUser(null);
              setCartItems([]);
            }
          } finally {
            if (listenerActive) {
              setAuthResolved(true);
            }
          }
        },
      );

    return () => {
      listenerActive = false;
      unsubscribe();
    };
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
      'cart',
    );

    const unsubscribe = onSnapshot(
      cartRef,
      (snapshot) => {
        const items =
          snapshot.docs.map(
            (cartDocument) => ({
              id: cartDocument.id,
              ...cartDocument.data(),
            }),
          );

        setCartItems(items);
      },
      (firestoreError) => {
        console.error(
          'Cart listener error:',
          firestoreError,
        );

        setCartError(
          'Your trolley could not be loaded.',
        );
      },
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

  const cartTotal = useMemo(() => {
    return cartItems.reduce(
      (sum, item) => {
        const price = Number(
          item.price || 0,
        );

        const quantity = Number(
          item.quantity || 1,
        );

        return (
          sum + price * quantity
        );
      },
      0,
    );
  }, [cartItems]);

  const totalQuantity =
    useMemo(() => {
      return cartItems.reduce(
        (sum, item) => {
          return (
            sum +
            Number(
              item.quantity || 1,
            )
          );
        },
        0,
      );
    }, [cartItems]);

  if (!authResolved) {
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

  if (!splashComplete) {
    return (
      <div className="min-h-screen bg-green-700 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center text-white">
          <div className="mb-8">
            <div className="mx-auto w-24 h-24 rounded-full bg-white/15 flex items-center justify-center">
              <ScanLine
                size={36}
                className="text-white"
              />
            </div>
          </div>

          <h1 className="text-4xl font-bold">
            Dunnes Smart Trolley
          </h1>

          <p className="mt-4 text-base text-green-100/90">
            Shop faster with barcode scanning,
            Dunnes matches and smart cart
            tracking.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
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

          {activeTab === 'scan' && (
            <ScanPage
              user={user}
              active
              onBarcodeScanned={
                handleBarcodeScanned
              }
            />
          )}

          {activeTab === 'confirm' && (
            <ProductConfirmationPage
              barcode={pendingBarcode}
              user={user}
              onCancel={returnToScanner}
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

          {activeTab === 'profile' && (
            <ProfilePage user={user} />
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-8 py-3 flex items-center justify-between z-50">
          <button
            type="button"
            onClick={openScanTab}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'scan' ||
              activeTab === 'confirm'
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
              activeTab === 'cart'
                ? 'text-green-700'
                : 'text-gray-400'
            }`}
          >
            <ShoppingCart size={24} />

            {totalQuantity > 0 && (
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
            onClick={openProfileTab}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'profile'
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