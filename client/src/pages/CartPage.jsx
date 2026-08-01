import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  deleteDoc,
  doc,
} from 'firebase/firestore';

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Info,
  Loader2,
  RefreshCw,
  ShoppingCart,
  TicketPercent,
  Trash2,
} from 'lucide-react';

import DunnesImportPanel from '../components/DunnesImportPanel';
import DunnesCrawlerPanel from '../components/DunnesCrawlerPanel';

import { db } from '../Firebase';

import {
  finishShoppingSession,
  loadShoppingSessions,
} from '../services/shoppingSessionApiService';

import {
  calculateCartPricing,
} from '../lib/promotionPricing';

const isDev = import.meta.env.DEV;
const appId = 'dunnes-trolley';

const HALF_VOUCHER_THRESHOLD = 25;
const FULL_VOUCHER_THRESHOLD = 50;

function calculateVoucherProgress(total) {
  const totalCents = Math.max(
    0,
    Math.round(
      (Number(total) || 0) * 100,
    ),
  );

  const halfThresholdCents =
    HALF_VOUCHER_THRESHOLD * 100;

  const fullThresholdCents =
    FULL_VOUCHER_THRESHOLD * 100;

  const tenEuroVoucherCount =
    Math.floor(
      totalCents /
        fullThresholdCents,
    );

  const currentCycleCents =
    totalCents %
    fullThresholdCents;

  const hasFiveEuroVoucher =
    currentCycleCents >=
    halfThresholdCents;

  const fiveEuroVoucherCount =
    hasFiveEuroVoucher
      ? 1
      : 0;

  const nextThresholdCents =
    hasFiveEuroVoucher
      ? fullThresholdCents
      : halfThresholdCents;

  const remainingCents =
    nextThresholdCents -
    currentCycleCents;

  return {
    tenEuroVoucherCount,
    fiveEuroVoucherCount,

    currentCycleTotal:
      currentCycleCents / 100,

    progressPercent:
      Math.min(
        100,
        (
          currentCycleCents /
          fullThresholdCents
        ) * 100,
      ),

    remaining:
      Math.max(
        0,
        remainingCents / 100,
      ),

    hasFiveEuroVoucher,
  };
}

function VoucherTracker({
  total,
}) {
  const [showInformation, setShowInformation] =
    useState(false);

  const {
    tenEuroVoucherCount,
    fiveEuroVoucherCount,
    currentCycleTotal,
    progressPercent,
    remaining,
    hasFiveEuroVoucher,
  } = calculateVoucherProgress(
    total,
  );

  const hasAnyVoucher =
    tenEuroVoucherCount > 0 ||
    fiveEuroVoucherCount > 0;

  const nextVoucherMessage =
    hasFiveEuroVoucher
      ? `€${remaining.toFixed(
          2,
        )} to upgrade to €10 off €50`
      : `€${remaining.toFixed(
          2,
        )} to your next €5 off €25`;

  return (
    <div className="mt-5 overflow-visible rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <TicketPercent
              size={22}
            />
          </div>

          <div>
            <h3 className="font-bold text-gray-800">
              Voucher tracker
            </h3>

            <p className="mt-0.5 text-xs text-gray-500">
              Estimated from your trolley total
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setShowInformation(
                (currentValue) =>
                  !currentValue,
              )
            }
            aria-label="Voucher eligibility information"
            aria-expanded={
              showInformation
            }
            title="Voucher eligibility information"
            className="flex h-9 w-9 items-center justify-center rounded-full text-green-700 transition hover:bg-green-100 focus:bg-green-100 focus:outline-none"
          >
            <Info size={19} />
          </button>

          {showInformation && (
            <div
              role="tooltip"
              className="absolute right-0 top-11 z-30 w-72 max-w-[calc(100vw-3rem)] rounded-xl bg-gray-900 px-4 py-3 text-left text-xs leading-5 text-white shadow-xl"
            >
              Voucher progress is an
              estimate. Alcohol, tobacco
              and other excluded products
              may not count. Final
              eligibility is confirmed at
              checkout.
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Vouchers earned
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          {!hasAnyVoucher && (
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-500">
              No voucher yet
            </span>
          )}

          {tenEuroVoucherCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-700 px-3 py-1.5 text-sm font-bold text-white">
              <CheckCircle2
                size={16}
              />

              {tenEuroVoucherCount}
              {' × €10 off €50'}
            </span>
          )}

          {fiveEuroVoucherCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-green-100 px-3 py-1.5 text-sm font-bold text-green-800">
              <CheckCircle2
                size={16}
              />

              1 × €5 off €25
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Current €50 cycle
            </p>

            <p className="mt-1 text-lg font-bold text-gray-800">
              €
              {currentCycleTotal.toFixed(
                2,
              )}
            </p>
          </div>

          <p className="text-right text-xs font-semibold text-gray-500">
            €50.00 target
          </p>
        </div>

        <div className="relative mt-7">
          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-700 transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </div>

          <div
            className={`absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-sm ${
              hasFiveEuroVoucher
                ? 'border-green-700 bg-green-700 text-white'
                : 'border-green-300 bg-white text-green-700'
            }`}
          >
            {hasFiveEuroVoucher ? (
              <CheckCircle2
                size={15}
              />
            ) : (
              <span className="text-[10px] font-bold">
                €5
              </span>
            )}
          </div>

          <div className="absolute right-0 top-1/2 flex h-7 w-7 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-green-300 bg-white text-green-700 shadow-sm">
            <span className="text-[9px] font-bold">
              €10
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 text-xs font-semibold">
          <span className="text-left text-gray-400">
            €0
          </span>

          <span
            className={`text-center ${
              hasFiveEuroVoucher
                ? 'text-green-700'
                : 'text-gray-500'
            }`}
          >
            €5 off €25
          </span>

          <span className="text-right text-gray-500">
            €10 off €50
          </span>
        </div>

        <div className="mt-5 rounded-xl bg-green-50 px-4 py-3">
          <p className="text-center text-sm font-bold text-green-900">
            {nextVoucherMessage}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatSessionDate(value) {
  if (!value) {
    return 'Date unavailable';
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
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
    },
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

  const [
    completedSession,
    setCompletedSession,
  ] = useState(null);

  const [
    shoppingSessions,
    setShoppingSessions,
  ] = useState([]);

  const [
    loadingHistory,
    setLoadingHistory,
  ] = useState(false);

  const [
    historyError,
    setHistoryError,
  ] = useState('');

  const [
    expandedSessionId,
    setExpandedSessionId,
  ] = useState(null);

  const [
    removingItemId,
    setRemovingItemId,
  ] = useState(null);

  const cartPricing = useMemo(
    () =>
      calculateCartPricing(
        cartItems,
      ),
    [cartItems],
  );

  const cartTotal =
    cartPricing.finalTotal;

  const totalQuantity =
    useMemo(() => {
      return cartItems.reduce(
        (
          sum,
          item,
        ) =>
          sum +
          Number(
            item.quantity || 1,
          ),
        0,
      );
    }, [cartItems]);

  const loadHistory =
    async () => {
      if (!user) {
        setShoppingSessions([]);
        return;
      }

      setLoadingHistory(true);
      setHistoryError('');

      try {
        const sessions =
          await loadShoppingSessions(
            user,
          );

        setShoppingSessions(
          sessions,
        );
      } catch (loadError) {
        console.error(
          'Shopping history error:',
          loadError,
        );

        setHistoryError(
          loadError?.message ||
            'The shopping history could not be loaded.',
        );
      } finally {
        setLoadingHistory(false);
      }
    };

  useEffect(() => {
    loadHistory();
  }, [user]);

  const handleFinishShop =
    async () => {
      const confirmed =
        window.confirm(
          'Finish this shop and save it to your shopping history?',
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
            user,
          );

        setCompletedSession(
          session,
        );

        setShoppingSessions(
          (
            currentSessions,
          ) => [
            session,
            ...currentSessions.filter(
              (
                existingSession,
              ) =>
                existingSession.id !==
                session.id,
            ),
          ],
        );
      } catch (finishError) {
        console.error(
          'Finish shop error:',
          finishError,
        );

        setError(
          finishError?.message ||
            'The shop could not be completed.',
        );
      } finally {
        setFinishing(false);
      }
    };

  const handleStartNewShop =
    () => {
      setCompletedSession(null);
      setActiveView('cart');
    };

  const handleRemoveItem =
    async (item) => {
      if (!user) {
        setError(
          'You must be signed in to remove an item.',
        );
        return;
      }

      const itemId = String(
        item.id ||
          item.barcode ||
          '',
      ).trim();

      if (!itemId) {
        setError(
          'This item could not be removed.',
        );
        return;
      }

      const confirmed =
        window.confirm(
          `Remove ${
            item.name ||
            'this item'
          } from your trolley?`,
        );

      if (!confirmed) {
        return;
      }

      setError('');
      setRemovingItemId(
        itemId,
      );

      try {
        const cartItemReference =
          doc(
            db,
            'artifacts',
            appId,
            'users',
            user.uid,
            'cart',
            itemId,
          );

        await deleteDoc(
          cartItemReference,
        );
      } catch (removeError) {
        console.error(
          'Remove cart item error:',
          removeError,
        );

        setError(
          removeError?.message ||
            'The item could not be removed.',
        );
      } finally {
        setRemovingItemId(
          null,
        );
      }
    };

  const toggleSession =
    (sessionId) => {
      setExpandedSessionId(
        (currentId) =>
          currentId ===
          sessionId
            ? null
            : sessionId,
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
            Loading shopping
            history...
          </p>
        </div>
      );
    }

    if (historyError) {
      return (
        <div className="mt-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              {historyError}
            </p>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700"
          >
            <RefreshCw
              size={18}
            />
            Try again
          </button>
        </div>
      );
    }

    if (
      shoppingSessions.length ===
      0
    ) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <History
            size={48}
            className="mb-4 opacity-50"
          />

          <p>
            No completed shops yet.
          </p>

          <p className="mt-1 text-center text-sm">
            Finished shopping
            sessions will appear
            here.
          </p>
        </div>
      );
    }

    return (
      <>
        {isDev && (
          <>
            <DunnesImportPanel
              user={user}
            />

            <DunnesCrawlerPanel
              user={user}
            />
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
                  session.items,
                )
                  ? session.items
                  : [];

              return (
                <div
                  key={session.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() =>
                      toggleSession(
                        session.id,
                      )
                    }
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-gray-800">
                          <CalendarDays
                            size={18}
                            className="shrink-0 text-green-700"
                          />

                          <span className="font-semibold">
                            {formatSessionDate(
                              session.completedAt ||
                                session.createdAt,
                            )}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-gray-500">
                          {Number(
                            session.itemCount ||
                              0,
                          )}{' '}
                          items
                          {' · '}
                          {Number(
                            session.uniqueItemCount ||
                              sessionItems.length ||
                              0,
                          )}{' '}
                          unique products
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-bold text-green-700">
                          €
                          {Number(
                            session.total ||
                              0,
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
                        <p className="py-4 text-sm text-gray-500">
                          No product
                          details were
                          saved for this
                          session.
                        </p>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {sessionItems.map(
                            (
                              item,
                              index,
                            ) => {
                              const price =
                                Number(
                                  item.price ||
                                    0,
                                );

                              const quantity =
                                Number(
                                  item.quantity ||
                                    1,
                                );

                              const subtotal =
                                Number(
                                  item.subtotal ||
                                    price *
                                      quantity,
                                );

                              return (
                                <div
                                  key={
                                    item.id ||
                                    item.barcode ||
                                    `${session.id}-${index}`
                                  }
                                  className="flex gap-3 py-4"
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
                                      className="h-14 w-14 shrink-0 rounded-xl bg-gray-50 object-contain"
                                    />
                                  ) : (
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                                      <ShoppingCart
                                        size={
                                          21
                                        }
                                        className="text-gray-400"
                                      />
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-800">
                                      {item.name ||
                                        'Unknown product'}
                                    </p>

                                    {item.brand && (
                                      <p className="mt-1 text-sm text-gray-500">
                                        {
                                          item.brand
                                        }
                                      </p>
                                    )}

                                    <div className="mt-2 flex justify-between gap-3">
                                      <span className="text-sm text-gray-500">
                                        €
                                        {price.toFixed(
                                          2,
                                        )}
                                        {' × '}
                                        {
                                          quantity
                                        }
                                      </span>

                                      <span className="font-semibold text-gray-800">
                                        €
                                        {subtotal.toFixed(
                                          2,
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      )}

                      <div className="flex justify-between border-t border-gray-100 pt-4">
                        <span className="font-semibold text-gray-700">
                          Session total
                        </span>

                        <span className="font-bold text-green-700">
                          €
                          {Number(
                            session.total ||
                              0,
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            },
          )}
        </div>
      </>
    );
  };

  const renderCart = () => {
    if (completedSession) {
      return (
        <div className="mt-4">
          <div className="rounded-2xl border border-green-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2
                size={34}
                className="text-green-700"
              />
            </div>

            <h2 className="mt-4 text-xl font-bold text-gray-800">
              Shop completed
            </h2>

            <p className="mt-2 text-gray-500">
              Your shopping session
              has been saved.
            </p>

            <div className="mt-5 rounded-xl bg-gray-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Items
                </span>

                <span className="font-semibold text-gray-800">
                  {
                    completedSession.itemCount
                  }
                </span>
              </div>

              <div className="mt-3 flex justify-between text-sm">
                <span className="text-gray-500">
                  Total
                </span>

                <span className="font-bold text-green-700">
                  €
                  {Number(
                    completedSession.total ||
                      0,
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={
                handleStartNewShop
              }
              className="mt-5 w-full rounded-xl bg-green-700 py-3 font-bold text-white"
            >
              Start a new shop
            </button>

            <button
              type="button"
              onClick={() => {
                setCompletedSession(
                  null,
                );

                setActiveView(
                  'history',
                );
              }}
              className="mt-3 w-full rounded-xl border border-gray-300 py-3 font-semibold text-gray-700"
            >
              View shopping history
            </button>
          </div>
        </div>
      );
    }

    if (
      cartItems.length ===
      0
    ) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <ShoppingCart
            size={48}
            className="mb-4 opacity-50"
          />

          <p>
            Your cart is empty.
          </p>

          <p className="mt-1 text-sm">
            Scan items to start
            your shop.
          </p>
        </div>
      );
    }

    return (
      <>
        <p className="mt-1 text-sm text-gray-500">
          Review your trolley
          before finishing.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">
              {error}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {cartPricing.itemResults.map(
            (item) => {
              const price =
                Number(
                  item.price ||
                    0,
                );

              const quantity =
                Number(
                  item.quantity ||
                    1,
                );

              const subtotal =
                item.finalSubtotal;

              const appliedPromotions =
                Array.isArray(
                  item.appliedPromotions,
                )
                  ? item.appliedPromotions
                  : [];

              const itemId =
                String(
                  item.id ||
                    item.barcode ||
                    '',
                );

              const isRemoving =
                removingItemId ===
                itemId;

              return (
                <div
                  key={
                    item.id ||
                    item.barcode
                  }
                  className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex gap-3">
                    {item.imageUrl ? (
                      <img
                        src={
                          item.imageUrl
                        }
                        alt={
                          item.name ||
                          'Product'
                        }
                        className="h-16 w-16 rounded-xl bg-gray-50 object-contain"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100">
                        <ShoppingCart
                          size={24}
                          className="text-gray-400"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-gray-800">
                        {item.name ||
                          'Unknown product'}
                      </h3>

                      {item.brand && (
                        <p className="mt-1 text-sm text-gray-500">
                          {
                            item.brand
                          }
                        </p>
                      )}

                      <div className="mt-3 flex items-end justify-between">
                        <p className="text-sm text-gray-500">
                          €
                          {price.toFixed(
                            2,
                          )}
                          {' × '}
                          {quantity}
                        </p>

                        <div className="text-right">
                          {item.discount >
                            0 && (
                            <p className="text-xs text-gray-400 line-through">
                              €
                              {item.regularSubtotal.toFixed(
                                2,
                              )}
                            </p>
                          )}

                          <p className="font-bold text-green-700">
                            €
                            {subtotal.toFixed(
                              2,
                            )}
                          </p>
                        </div>
                      </div>

                      {appliedPromotions.length >
                        0 && (
                        <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                          {appliedPromotions
                            .map(
                              (
                                promotion,
                              ) =>
                                promotion.name,
                            )
                            .join(
                              ', ',
                            )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveItem(
                            item,
                          )
                        }
                        disabled={
                          isRemoving
                        }
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Remove ${
                          item.name ||
                          'item'
                        } from trolley`}
                      >
                        {isRemoving ? (
                          <Loader2
                            size={17}
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2
                            size={17}
                          />
                        )}

                        {isRemoving
                          ? 'Removing...'
                          : 'Remove item'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            },
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">
              Total items
            </span>

            <span className="font-semibold text-gray-800">
              {totalQuantity}
            </span>
          </div>

          <div className="mt-3 flex justify-between">
            <span className="text-gray-600">
              Regular subtotal
            </span>

            <span className="font-semibold text-gray-800">
              €
              {cartPricing.regularSubtotal.toFixed(
                2,
              )}
            </span>
          </div>

          {cartPricing.promotionDiscount >
            0 && (
            <div className="mt-3 flex justify-between text-green-700">
              <span className="font-semibold">
                Promotion savings
              </span>

              <span className="font-bold">
                -€
                {cartPricing.promotionDiscount.toFixed(
                  2,
                )}
              </span>
            </div>
          )}

          <div className="mt-3 flex justify-between border-t border-gray-100 pt-3">
            <span className="font-semibold text-gray-800">
              Total
            </span>

            <span className="text-xl font-bold text-green-700">
              €
              {cartTotal.toFixed(
                2,
              )}
            </span>
          </div>

          <VoucherTracker
            total={cartTotal}
          />

          <button
            type="button"
            onClick={
              handleFinishShop
            }
            disabled={
              finishing ||
              cartItems.length ===
                0
            }
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3 font-bold text-white disabled:opacity-60"
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

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() =>
            setActiveView(
              'cart',
            )
          }
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${
            activeView ===
            'cart'
              ? 'bg-white text-green-700 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <ShoppingCart
            size={18}
          />
          Current Shop
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView(
              'history',
            );

            if (
              shoppingSessions.length ===
                0 &&
              !loadingHistory
            ) {
              loadHistory();
            }
          }}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${
            activeView ===
            'history'
              ? 'bg-white text-green-700 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <History size={18} />
          History
        </button>
      </div>

      {activeView ===
      'cart'
        ? renderCart()
        : renderHistory()}
    </div>
  );
}