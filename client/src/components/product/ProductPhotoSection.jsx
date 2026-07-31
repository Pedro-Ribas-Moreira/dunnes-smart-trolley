import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';

function matchPercentage(value) {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    return null;
  }

  return Math.round(Math.min(Math.max(score, 0), 1) * 100);
}

function ProductPhotoSection({
  previewUrl,
  label,
  matches,
  matchAttempted,
  productsChecked,
  analysing,
  disabled,
  onOpenPicker,
  onClear,
  onSelectMatch,
  onManualEntry,
}) {
  return (
    <div className="mb-7">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
            <Camera size={23} className="text-green-700" />
          </div>

          <div>
            <h2 className="font-bold text-gray-800">Identify from a photo</h2>
            <p className="mt-1 text-sm text-gray-600">
              Take a clear photo of the front label. We will read the visible
              details and search the Dunnes catalogue.
            </p>
          </div>
        </div>

        {!previewUrl && (
          <button
            type="button"
            onClick={onOpenPicker}
            disabled={analysing || disabled}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3 font-bold text-white disabled:opacity-60"
          >
            <Camera size={20} />
            Take Product Photo
          </button>
        )}

        {previewUrl && (
          <div className="mt-4">
            <div className="relative">
              <img
                src={previewUrl}
                alt="Selected product"
                className="max-h-72 w-full rounded-2xl border border-green-200 bg-white object-contain"
              />

              {!analysing && (
                <button
                  type="button"
                  onClick={onClear}
                  aria-label="Remove selected photo"
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {analysing ? (
              <div className="mt-4 flex flex-col items-center py-4" role="status">
                <Loader2 size={32} className="animate-spin text-green-700" />
                <p className="mt-3 font-semibold text-gray-700">
                  Analysing product...
                </p>
                <p className="mt-1 text-center text-sm text-gray-500">
                  Reading the label and searching the Dunnes catalogue
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenPicker}
                disabled={disabled}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-green-700 py-3 font-bold text-green-700 disabled:opacity-60"
              >
                <RefreshCw size={18} />
                Take Another Photo
              </button>
            )}
          </div>
        )}

        {label && (
          <div className="mt-4 rounded-xl border border-green-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-green-700">
              Label detected
            </p>
            <p className="mt-2 font-semibold text-gray-800">
              {[label.brand, label.productName, label.variant, label.sizeText]
                .filter(Boolean)
                .join(' · ') || 'Product details detected'}
            </p>

            {productsChecked > 0 && (
              <p className="mt-2 text-xs text-gray-400">
                Compared with {productsChecked} Dunnes products
              </p>
            )}
          </div>
        )}
      </div>

      {matches.length > 0 && (
        <div className="mt-5">
          <h2 className="text-lg font-bold text-gray-800">Possible matches</h2>
          <p className="mt-1 text-sm text-gray-500">
            Select the product only if the name, size and packaging match.
          </p>

          <div className="mt-4 space-y-3">
            {matches.map((match) => {
              const percentage = matchPercentage(match.matchScore);
              const price = Number(match.price);

              return (
                <button
                  key={match.dunnesSku}
                  type="button"
                  onClick={() => onSelectMatch(match)}
                  disabled={disabled}
                  className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left hover:border-green-600 disabled:opacity-60"
                >
                  <div className="flex gap-4">
                    {match.imageUrl ? (
                      <img
                        src={match.imageUrl}
                        alt={match.name}
                        className="h-20 w-20 shrink-0 rounded-xl bg-gray-50 object-contain"
                      />
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                        <ImagePlus size={27} className="text-gray-400" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      {match.brand && (
                        <p className="text-sm text-gray-500">{match.brand}</p>
                      )}
                      <h3 className="mt-1 font-bold text-gray-800">
                        {match.name}
                      </h3>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="font-bold text-green-700">
                          {Number.isFinite(price)
                            ? `€${price.toFixed(2)}`
                            : 'Price unavailable'}
                        </span>

                        {percentage !== null && (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            {percentage}% match
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-gray-400">
                        Dunnes SKU: {match.dunnesSku}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-green-700 py-2.5 font-bold text-white">
                    <Check size={18} />
                    This is my product
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onManualEntry}
            className="mt-4 w-full rounded-xl border border-gray-300 py-3 font-semibold text-gray-700"
          >
            None of these, enter manually
          </button>
        </div>
      )}

      {matchAttempted && !analysing && matches.length === 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-800">No close match found</p>
          <p className="mt-1 text-sm text-amber-700">
            Try a clearer front-facing photo, or continue with manual entry
            below.
          </p>
        </div>
      )}

      <div className="mt-7 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-semibold uppercase text-gray-400">
          Manual entry
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
    </div>
  );
}

export default ProductPhotoSection;
