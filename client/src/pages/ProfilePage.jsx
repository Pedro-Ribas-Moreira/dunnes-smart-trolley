import { useState } from 'react';

import {
  Loader2,
  LogOut,
  User,
} from 'lucide-react';

import {
  getAuthenticationErrorMessage,
  logoutUser,
} from '../services/authService';

export default function ProfilePage({
  user,
}) {
  const [error, setError] =
    useState('');

  const [loggingOut, setLoggingOut] =
    useState(false);

  const isGuest =
    user?.isAnonymous === true;

  const handleLogout = async () => {
    setError('');
    setLoggingOut(true);

    try {
      await logoutUser();
    } catch (logoutError) {
      console.error(
        'Logout failed:',
        logoutError,
      );

      setError(
        getAuthenticationErrorMessage(
          logoutError,
        ),
      );
    } finally {
      setLoggingOut(false);
    }
  };

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
            {isGuest
              ? 'Guest Shopper'
              : user?.displayName ||
                'Shopper'}
          </h2>

          <p className="text-gray-500 mt-1">
            {isGuest
              ? 'Temporary guest session'
              : user?.email}
          </p>

          {isGuest && (
            <div className="mt-5 w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="text-sm font-semibold text-amber-800">
                You are shopping as a guest
              </p>

              <p className="mt-1 text-sm leading-5 text-amber-700">
                Your guest account is available
                only during the current browser
                session.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 bg-red-50 border border-red-200 rounded-xl p-3"
          >
            <p className="text-red-700 text-sm text-center">
              {error}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full mt-6 bg-red-50 text-red-600 font-bold py-3 rounded-xl flex justify-center items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? (
            <Loader2
              size={20}
              className="animate-spin"
            />
          ) : (
            <LogOut size={20} />
          )}

          {loggingOut
            ? 'Logging out...'
            : isGuest
              ? 'End Guest Session'
              : 'Log Out'}
        </button>
      </div>
    </div>
  );
}