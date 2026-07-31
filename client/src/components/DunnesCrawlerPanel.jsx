import {
  useState,
} from 'react';

import {
  Loader2,
  Network,
} from 'lucide-react';

import {
  crawlDunnesCatalogue,
} from '../services/dunnesApiService';

const seedSkus = [
  '100318450',
  '100332661',
  '100172239',
];

function DunnesCrawlerPanel({
  user,
}) {
  const [running, setRunning] =
    useState(false);

  const [result, setResult] =
    useState(null);

  const [error, setError] =
    useState('');

  const startCrawl = async () => {
    setRunning(true);
    setResult(null);
    setError('');

    try {
      const crawl =
        await crawlDunnesCatalogue(
          user,
          {
            seedSkus,
            storeId: '258',
            maxProducts: 600,
          },
        );

      setResult(crawl);
    } catch (crawlError) {
      setError(
        crawlError?.message ||
          'The catalogue crawl failed.',
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <h2 className="font-bold text-gray-800">
        Dunnes Catalogue Crawler
      </h2>

      <p className="text-sm text-gray-500 mt-1">
        Discover more products through Dunnes recommendations.
      </p>

      <button
        type="button"
        onClick={startCrawl}
        disabled={
          running ||
          !user
        }
        className="w-full mt-4 bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {running ? (
          <>
            <Loader2
              size={20}
              className="animate-spin"
            />
            Crawling catalogue...
          </>
        ) : (
          <>
            <Network size={20} />
            Crawl 100 Products
          </>
        )}
      </button>

      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
          <p>
            Processed:{' '}
            <strong>
              {result.processedCount}
            </strong>
          </p>

          <p>
            Products saved:{' '}
            <strong>
              {result.productsSaved}
            </strong>
          </p>

          <p>
            Unique SKUs discovered:{' '}
            <strong>
              {result.uniqueSkusDiscovered}
            </strong>
          </p>

          <p>
            Failed requests:{' '}
            <strong>
              {result.failedRequests}
            </strong>
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}

export default DunnesCrawlerPanel;