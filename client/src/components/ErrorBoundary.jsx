import React from 'react';
import { mobileLog } from '../lib/mobileLog';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      message: '',
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Unknown rendering error',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React rendering error:', error, errorInfo);

    mobileLog(
      'React rendering error',
      {
        name: error?.name || 'Unknown error',
        message: error?.message || String(error),
        stack: error?.stack || '',
        componentStack: errorInfo?.componentStack || '',
      },
      'ERROR'
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-red-200 rounded-2xl p-6 text-center">
            <h1 className="text-xl font-bold text-red-700">
              Something went wrong
            </h1>

            <p className="text-sm text-gray-600 mt-3">
              {this.state.message}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 w-full bg-green-700 text-white font-bold py-3 rounded-xl"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;