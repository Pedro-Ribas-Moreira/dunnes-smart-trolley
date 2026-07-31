import { LoaderCircle } from 'lucide-react';

function ProductLookupLoader({ barcode }) {
  return (
    <div
      className="min-h-full flex flex-col items-center justify-center p-6"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle
        size={42}
        className="animate-spin text-green-700"
      />

      <div className="mt-5 text-center">
        <h2 className="text-xl font-bold text-gray-900">
          Finding your product
        </h2>

        <p className="mt-2 text-gray-600">
          We are checking Open Food Facts, searching the Dunnes catalogue and
          looking for active promotions.
        </p>

        <p className="mt-3 text-sm text-gray-400">
          The first lookup for a new product can take up to a minute. Future
          scans will be much faster.
        </p>
      </div>

      <p className="mt-3 text-xs text-gray-400">Barcode: {barcode}</p>
    </div>
  );
}

export default ProductLookupLoader;
