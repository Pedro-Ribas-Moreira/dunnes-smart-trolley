import { useState } from 'react';

import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ScanLine,
  User,
} from 'lucide-react';

import {
  continueAsGuest,
  createAccount,
  getAuthenticationErrorMessage,
  loginWithEmail,
  requestPasswordReset,
} from '../services/authService';

export default function AuthPage() {
  const [authMode, setAuthMode] =
    useState('login');

  const [name, setName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [
    passwordVisible,
    setPasswordVisible,
  ] = useState(false);

  const [error, setError] =
    useState('');

  const [successMessage, setSuccessMessage] =
    useState('');

  const [loadingAction, setLoadingAction] =
    useState('');

  const isSigningUp =
    authMode === 'signup';

  const isLoading =
    Boolean(loadingAction);

  const clearMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  const changeAuthMode = (newMode) => {
    if (isLoading) {
      return;
    }

    setAuthMode(newMode);
    setPassword('');
    setPasswordVisible(false);
    clearMessages();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    clearMessages();

    setLoadingAction(
      isSigningUp ? 'signup' : 'login',
    );

    try {
      if (isSigningUp) {
        await createAccount({
          name,
          email,
          password,
        });

        return;
      }

      await loginWithEmail({
        email,
        password,
      });
    } catch (authenticationError) {
      console.error(
        'Authentication failed:',
        authenticationError,
      );

      setError(
        getAuthenticationErrorMessage(
          authenticationError,
        ),
      );
    } finally {
      setLoadingAction('');
    }
  };

  const handleForgotPassword = async () => {
    clearMessages();
    setLoadingAction('reset-password');

    try {
      await requestPasswordReset(email);

      setSuccessMessage(
        'If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder.',
      );
    } catch (passwordResetError) {
      console.error(
        'Password reset failed:',
        passwordResetError,
      );

      setError(
        getAuthenticationErrorMessage(
          passwordResetError,
        ),
      );
    } finally {
      setLoadingAction('');
    }
  };

  const handleGuestContinue = async () => {
    clearMessages();
    setLoadingAction('guest');

    try {
      await continueAsGuest();
    } catch (guestError) {
      console.error(
        'Guest sign-in failed:',
        guestError,
      );

      setError(
        getAuthenticationErrorMessage(
          guestError,
        ),
      );
    } finally {
      setLoadingAction('');
    }
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible(
      (currentValue) => !currentValue,
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-200 shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <ScanLine
              size={30}
              className="text-green-700"
            />
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to Dunnes Smart Trolley
          </h1>

          <p className="mt-3 text-sm text-gray-500">
            Log in or continue as a guest to
            start scanning.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              changeAuthMode('login')
            }
            disabled={isLoading}
            className={`flex-1 rounded-2xl py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              authMode === 'login'
                ? 'bg-green-700 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Log In
          </button>

          <button
            type="button"
            onClick={() =>
              changeAuthMode('signup')
            }
            disabled={isLoading}
            className={`flex-1 rounded-2xl py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              authMode === 'signup'
                ? 'bg-green-700 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-5 text-green-700"
          >
            {successMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {isSigningUp && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Name
              </label>

              <div className="relative">
                <User
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Your name"
                  autoComplete="name"
                  required={isSigningUp}
                  disabled={isLoading}
                  className="w-full rounded-2xl border border-gray-200 py-3 pl-11 pr-4 outline-none focus:border-green-600 disabled:bg-gray-100"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Email
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);

                  if (
                    error ||
                    successMessage
                  ) {
                    clearMessages();
                  }
                }}
                placeholder="name@example.com"
                autoComplete="email"
                required
                disabled={isLoading}
                className="w-full rounded-2xl border border-gray-200 py-3 pl-11 pr-4 outline-none focus:border-green-600 disabled:bg-gray-100"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <label
                htmlFor="auth-password"
                className="block text-sm font-semibold text-gray-700"
              >
                Password
              </label>

              {!isSigningUp && (
                <button
                  type="button"
                  onClick={
                    handleForgotPassword
                  }
                  disabled={isLoading}
                  className="text-sm font-semibold text-green-700 hover:text-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingAction ===
                  'reset-password'
                    ? 'Sending...'
                    : 'Forgot password?'}
                </button>
              )}
            </div>

            <div className="relative">
              <Lock
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                id="auth-password"
                type={
                  passwordVisible
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="Enter your password"
                autoComplete={
                  isSigningUp
                    ? 'new-password'
                    : 'current-password'
                }
                required
                minLength={6}
                disabled={isLoading}
                className="w-full rounded-2xl border border-gray-200 py-3 pl-11 pr-12 outline-none focus:border-green-600 disabled:bg-gray-100"
              />

              <button
                type="button"
                onClick={
                  togglePasswordVisibility
                }
                disabled={isLoading}
                aria-label={
                  passwordVisible
                    ? 'Hide password'
                    : 'Show password'
                }
                aria-pressed={
                  passwordVisible
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {passwordVisible ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-green-700 py-3 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loadingAction !== 'guest' &&
              loadingAction !==
                'reset-password' &&
              isLoading && (
                <Loader2
                  size={19}
                  className="animate-spin"
                />
              )}

            {loadingAction === 'login'
              ? 'Logging in...'
              : loadingAction === 'signup'
                ? 'Creating account...'
                : isSigningUp
                  ? 'Create account'
                  : 'Log in'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />

          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Or
          </span>

          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={handleGuestContinue}
          disabled={isLoading}
          className="w-full rounded-2xl border border-green-700 py-3 text-sm font-bold text-green-700 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingAction === 'guest' && (
            <Loader2
              size={19}
              className="animate-spin"
            />
          )}

          {loadingAction === 'guest'
            ? 'Starting guest session...'
            : 'Continue as guest'}
        </button>

        <p className="mt-4 text-center text-xs leading-5 text-gray-400">
          Guest access lasts for the current
          browser session. Create an account to
          keep your trolley between visits.
        </p>
      </div>
    </div>
  );
}