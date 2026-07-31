import React, {
  useState,
} from 'react';

import {
  CheckCircle2,
  Database,
  Loader2,
} from 'lucide-react';

import {
  importDunnesListing,
} from '../services/dunnesApiService';

const DEFAULT_LISTING_ID =
  'bce41299-e461-4613-a22e-e6a0cada6169';

export default function DunnesImportPanel({
  user,
}) {
  const [importing, setImporting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [result, setResult] =
    useState(null);

  const handleImport = async () => {
    const confirmed = window.confirm(
      'Import the current Dunnes listing into Firebase?',
    );

    if (!confirmed) {
      return;
    }

    setImporting(true);
    setError('');
    setResult(null);

    try {
      const importResult =
        await importDunnesListing(
          user,
          DEFAULT_LISTING_ID,
          '258',
        );

      setResult(importResult);
    } catch (importError) {
      console.error(
        'Dunnes catalogue import failed:',
        importError,
      );

      setError(
        importError?.message ||
          'The Dunnes catalogue could not be imported.',
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mt-5 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
          <Database
            size={22}
            className="text-green-700"
          />
        </div>

        <div>
          <h3 className="font-semibold text-gray-800">
            Dunnes Catalogue Import
          </h3>

          <p className="text-sm text-gray-500 mt-1">
            Import products and promotions from the selected Dunnes listing.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 size={20} />

            <p className="font-semibold">
              Import completed
            </p>
          </div>

          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">
                Products imported
              </span>

              <span className="font-semibold text-gray-800">
                {Number(
                  result.importedCount || 0,
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">
                Pages processed
              </span>

              <span className="font-semibold text-gray-800">
                {Number(
                  result.pagesProcessed || 0,
                )}
              </span>
            </div>

            {result.totalAvailable != null && (
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Products available
                </span>

                <span className="font-semibold text-gray-800">
                  {Number(
                    result.totalAvailable || 0,
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleImport}
        disabled={importing || !user}
        className="w-full mt-4 bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {importing ? (
          <>
            <Loader2
              size={20}
              className="animate-spin"
            />

            Importing catalogue...
          </>
        ) : (
          <>
            <Database size={20} />

            Import Dunnes Catalogue
          </>
        )}
      </button>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Temporary development tool
      </p>
    </div>
  );
}