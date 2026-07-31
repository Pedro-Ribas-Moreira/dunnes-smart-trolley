import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';

import DunnesImportPanel from '../components/DunnesImportPanel';
import DunnesCrawlerPanel from '../components/DunnesCrawlerPanel';

import {
  finishShoppingSession,
  loadShoppingSessions,
} from '../services/shoppingSessionApiService';

import {
  calculateCartPricing,
} from '../lib/promotionPricing';

const isDev = import.meta.env.DEV;
function formatSessionDate(value) {
  if (!value) {
    return 'Date unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat(
    'en-IE',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(date);
}

export default function CartPage({
  cartItems,
  user,
}) {
  const [activeView, setActiveView] =
    useState('cart');

  const [finishing, setFinishing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [completedSession, setCompletedSession] =
    useState(null);

  const [shoppingSessions, setShoppingSessions] =
    useState([]);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [historyError, setHistoryError] =
    useState('');

  const [expandedSessionId, setExpandedSessionId] =
    useState(null);

  const cartPricing = useMemo(
    () => calculateCartPricing(cartItems),
    [cartItems]
  );

  const cartTotal =
    cartPricing.finalTotal;

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

  const loadHistory = async () => {
    if (!user) {
      setShoppingSessions([]);
      return;
    }

    setLoadingHistory(true);
    setHistoryError('');

    try {
      const sessions =
        await loadShoppingSessions(user);

      setShoppingSessions(sessions);
    } catch (loadError) {
      console.error(
        'Shopping history error:',
        loadError
      );

      setHistoryError(
        loadError?.message ||
          'The shopping history could not be loaded.'
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

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

      setShoppingSessions(
        (currentSessions) => [
          session,
          ...currentSessions.filter(
            (existingSession) =>
              existingSession.id !==
              session.id
          ),
        ]
      );
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

  const handleStartNewShop = () => {
    setCompletedSession(null);
    setActiveView('cart');
  };

  const toggleSession = (sessionId) => {
    setExpandedSessionId(
      (currentId) =>
        currentId === sessionId
          ? null
          : sessionId
    );
  };

  const renderHistory = () => {
    if (loadingHistory) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Loader2
            size={36}
            className="animate-spin"
          />

          <p className="mt-3">
            Loading shopping history...
          </p>
        </div>
      );
    }

    if (historyError) {
      return (
        <div className="mt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm">
              {historyError}
            </p>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            className="w-full mt-4 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} />
            Try again
          </button>
        </div>
      );
    }

    if (shoppingSessions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <History
            size={48}
            className="mb-4 opacity-50"
          />

          <p>No completed shops yet.</p>

          <p className="text-sm mt-1 text-center">
            Finished shopping sessions will appear here.
          </p>
        </div>
      );
    }

    return (
      <>
        {isDev && (
          <>
            <DunnesImportPanel user={user} />
            <DunnesCrawlerPanel user={user} />
          </>
        )}

        <div className="mt-4 space-y-3">
        {shoppingSessions.map(
          (session) => {
            const isExpanded =
              expandedSessionId ===
              session.id;

            const sessionItems =
              Array.isArray(
                session.items
              )
                ? session.items
                : [];

            return (
              <div
                key={session.id}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    toggleSession(
                      session.id
                    )
                  }
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-gray-800">
                        <CalendarDays
                          size={18}
                          className="text-green-700 shrink-0"
                        />

                        <span className="font-semibold">
                          {formatSessionDate(
                            session.completedAt ||
                              session.createdAt
                          )}
                        </span>
                      </div>

                      <p className="text-sm text-gray-500 mt-2">
                        {Number(
                          session.itemCount ||
                            0
                        )}{' '}
                        items
                        {' · '}
                        {Number(
                          session.uniqueItemCount ||
                            sessionItems.length ||
                            0
                        )}{' '}
                        unique products
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-green-700">
                        €
                        {Number(
                          session.total ||
                            0
                        ).toFixed(2)}
                      </span>

                      {isExpanded ? (
                        <ChevronUp
                          size={20}
                          className="text-gray-400"
                        />
                      ) : (
                        <ChevronDown
                          size={20}
                          className="text-gray-400"
                        />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    {sessionItems.length ===
                    0 ? (
                      <p className="text-sm text-gray-500 py-4">
                        No product details were saved for this session.
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {sessionItems.map(
                          (
                            item,
                            index
                          ) => {
                            const price =
                              Number(
                                item.price ||
                                  0
                              );

                            const quantity =
                              Number(
                                item.quantity ||
                                  1
                              );

                            const subtotal =
                              Number(
                                item.subtotal ||
                                  price *
                                    quantity
                              );

                            return (
                              <div
                                key={
                                  item.id ||
                                  item.barcode ||
                                  `${session.id}-${index}`
                                }
                                className="py-4 flex gap-3"
                              >
                                {item.imageUrl ? (
                                  <img
                                    src={
                                      item.imageUrl
                                    }
                                    alt={
                                      item.name ||
                                      'Product'
                                    }
                                    className="w-14 h-14 rounded-xl object-contain bg-gray-50 shrink-0"
                                  />
                                ) : (
                                  <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                    <ShoppingCart
                                      size={
                                        21
                                      }
                                      className="text-gray-400"
                                    />
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-800">
                                    {item.name ||
                                      'Unknown product'}
                                  </p>

                                  {item.brand && (
                                    <p className="text-sm text-gray-500 mt-1">
                                      {
                                        item.brand
                                      }
                                    </p>
                                  )}

                                  <div className="flex justify-between gap-3 mt-2">
                                    <span className="text-sm text-gray-500">
                                      €
                                      {price.toFixed(
                                        2
                                      )}
                                      {' × '}
                                      {
                                        quantity
                                      }
                                    </span>

                                    <span className="font-semibold text-gray-800">
                                      €
                                      {subtotal.toFixed(
                                        2
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}

                    <div className="border-t border-gray-100 pt-4 flex justify-between">
                      <span className="font-semibold text-gray-700">
                        Session total
                      </span>

                      <span className="font-bold text-green-700">
                        €
                        {Number(
                          session.total ||
                            0
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
      </>
    );
  };

  const renderCart = () => {
    if (completedSession) {
      return (
        <div className="mt-4">
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
                    completedSession.total ||
                      0
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={
                handleStartNewShop
              }
              className="w-full mt-5 bg-green-700 text-white font-bold py-3 rounded-xl"
            >
              Start a new shop
            </button>

            <button
              type="button"
              onClick={() => {
                setCompletedSession(
                  null
                );
                setActiveView(
                  'history'
                );
              }}
              className="w-full mt-3 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl"
            >
              View shopping history
            </button>
          </div>
        </div>
      );
    }

    if (cartItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <ShoppingCart
            size={48}
            className="mb-4 opacity-50"
          />

          <p>Your cart is empty.</p>

          <p className="text-sm mt-1">
            Scan items to start your shop.
          </p>
        </div>
      );
    }

    return (
      <>
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
          {cartPricing.itemResults.map((item) => {
            const price = Number(
              item.price || 0
            );

            const quantity = Number(
              item.quantity || 1
            );

            const subtotal =
              item.finalSubtotal;

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
                      <p className="text-sm text-gray-500">
                        €
                        {price.toFixed(2)}
                        {' × '}
                        {quantity}
                      </p>

                      <div className="text-right">
                        {item.discount > 0 && (
                          <p className="text-xs text-gray-400 line-through">
                            €{item.regularSubtotal.toFixed(2)}
                          </p>
                        )}

                        <p className="font-bold text-green-700">
                          €{subtotal.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {item.appliedPromotions.length > 0 && (
                      <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                        {item.appliedPromotions
                          .map((promotion) => promotion.name)
                          .join(', ')}
                      </div>
                    )}
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
            <span className="text-gray-600">
              Regular subtotal
            </span>

            <span className="font-semibold text-gray-800">
              €{cartPricing.regularSubtotal.toFixed(2)}
            </span>
          </div>

          {cartPricing.promotionDiscount > 0 && (
            <div className="flex justify-between mt-3 text-green-700">
              <span className="font-semibold">
                Promotion savings
              </span>

              <span className="font-bold">
                -€{cartPricing.promotionDiscount.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between mt-3 border-t border-gray-100 pt-3">
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
      </>
    );
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-800">
        Shopping
      </h2>

      <div className="grid grid-cols-2 gap-2 mt-4 bg-gray-100 rounded-xl p-1">
        <button
          type="button"
          onClick={() =>
            setActiveView('cart')
          }
          className={`py-2.5 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 ${
            activeView === 'cart'
              ? 'bg-white text-green-700 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <ShoppingCart size={18} />
          Current Shop
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('history');

            if (
              shoppingSessions.length ===
                0 &&
              !loadingHistory
            ) {
              loadHistory();
            }
          }}
          className={`py-2.5 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 ${
            activeView === 'history'
              ? 'bg-white text-green-700 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <History size={18} />
          History
        </button>
      </div>

      {activeView === 'cart'
        ? renderCart()
        : renderHistory()}
    </div>
  );
}