import React, {
  useMemo,
  useState,
} from 'react';

import {
  CheckCircle2,
  Loader2,
  ShoppingCart,
} from 'lucide-react';

import {
  finishShoppingSession,
} from '../services/shoppingSessionApiService';

export default function CartPage({
  cartItems,
  user,
}) {
  const [finishing, setFinishing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [completedSession, setCompletedSession] =
    useState(null);

  const cartTotal = useMemo(() => {
    return cartItems.reduce(
      (sum, item) => {
        const price = Number(
          item.price || 0
        );

        const quantity = Number(
          item.quantity || 1
        );

        return (
          sum +
          price * quantity
        );
      },
      0
    );
  }, [cartItems]);

  const totalQuantity = useMemo(() => {
    return cartItems.reduce(
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
  }, [cartItems]);

  const handleFinishShop = async () => {
    const confirmed =
      window.confirm(
        'Finish this shop and save it to your shopping history?'
      );

    if (!confirmed) {
      return;
    }

    setError('');
    setCompletedSession(null);
    setFinishing(true);

    try {
      const session =
        await finishShoppingSession(
          user
        );

      setCompletedSession(session);
    } catch (finishError) {
      console.error(
        'Finish shop error:',
        finishError
      );

      setError(
        finishError?.message ||
          'The shop could not be completed.'
      );
    } finally {
      setFinishing(false);
    }
  };

  if (
    cartItems.length === 0 &&
    !completedSession
  ) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          Your Shopping Cart
        </h2>

        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <ShoppingCart
            size={48}
            className="mb-4 opacity-50"
          />

          <p>Your cart is empty.</p>

          <p className="text-sm mt-1">
            Scan items to start your shop.
          </p>
        </div>
      </div>
    );
  }

  if (completedSession) {
    return (
      <div className="p-4">
        <div className="bg-white border border-green-200 rounded-2xl p-6 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2
              size={34}
              className="text-green-700"
            />
          </div>

          <h2 className="text-xl font-bold text-gray-800 mt-4">
            Shop completed
          </h2>

          <p className="text-gray-500 mt-2">
            Your shopping session has been saved.
          </p>

          <div className="mt-5 bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                Items
              </span>

              <span className="font-semibold text-gray-800">
                {completedSession.itemCount}
              </span>
            </div>

            <div className="flex justify-between text-sm mt-3">
              <span className="text-gray-500">
                Total
              </span>

              <span className="font-bold text-green-700">
                €
                {Number(
                  completedSession.total || 0
                ).toFixed(2)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setCompletedSession(null)
            }
            className="w-full mt-5 bg-green-700 text-white font-bold py-3 rounded-xl"
          >
            Start a new shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-800">
        Your Shopping Cart
      </h2>

      <p className="text-sm text-gray-500 mt-1">
        Review your trolley before finishing.
      </p>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-700 text-sm">
            {error}
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {cartItems.map((item) => {
          const price = Number(
            item.price || 0
          );

          const quantity = Number(
            item.quantity || 1
          );

          const subtotal =
            price * quantity;

          return (
            <div
              key={item.id}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex gap-3">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 rounded-xl object-contain bg-gray-50"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center">
                    <ShoppingCart
                      size={24}
                      className="text-gray-400"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">
                    {item.name ||
                      'Unknown product'}
                  </h3>

                  {item.brand && (
                    <p className="text-sm text-gray-500 mt-1">
                      {item.brand}
                    </p>
                  )}

                  <div className="flex justify-between items-end mt-3">
                    <div>
                      <p className="text-sm text-gray-500">
                        €
                        {price.toFixed(2)}
                        {' × '}
                        {quantity}
                      </p>
                    </div>

                    <p className="font-bold text-green-700">
                      €
                      {subtotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">
            Total items
          </span>

          <span className="font-semibold text-gray-800">
            {totalQuantity}
          </span>
        </div>

        <div className="flex justify-between mt-3">
          <span className="font-semibold text-gray-800">
            Total
          </span>

          <span className="text-xl font-bold text-green-700">
            €{cartTotal.toFixed(2)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleFinishShop}
          disabled={
            finishing ||
            cartItems.length === 0
          }
          className="w-full mt-5 bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {finishing && (
            <Loader2
              size={20}
              className="animate-spin"
            />
          )}

          {finishing
            ? 'Finishing shop...'
            : 'Finish Shop'}
        </button>
      </div>
    </div>
  );
}