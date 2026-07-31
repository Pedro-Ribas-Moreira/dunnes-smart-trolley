import { Check, ImagePlus, PackageSearch } from 'lucide-react';

function matchPercentage(value) {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    return null;
  }

  return Math.round(Math.min(Math.max(score, 0), 1) * 100);
}

function ProductCandidateList({
  candidates,
  disabled,
  onSelect,
  onManualEntry,
  manualEntryLabel = 'None of these, enter manually',
}) {
  if (!candidates.length) {
    return null;
  }

  return (
    <section className="mt-5 rounded-3xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex items-start gap-3">
        <PackageSearch
          size={24}
          className="mt-0.5 shrink-0 text-blue-700"
        />

        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Select the matching Dunnes product
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Check the product name, pack size and image before selecting it.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {candidates.map((candidate) => {
          const percentage = matchPercentage(
            candidate.confidence ?? candidate.score,
          );
          const price = Number(candidate.price);
          const promotions = candidate.promotions ?? [];

          return (
            <button
              key={candidate.dunnesSku}
              type="button"
              onClick={() => onSelect(candidate)}
              disabled={disabled}
              className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-green-600 hover:shadow-md disabled:opacity-60"
            >
              <div className="flex gap-4">
                {candidate.imageUrl ? (
                  <img
                    src={candidate.imageUrl}
                    alt={candidate.name}
                    className="h-24 w-24 shrink-0 rounded-xl bg-gray-50 object-contain"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                    <ImagePlus size={28} className="text-gray-400" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {candidate.brand && (
                    <p className="text-sm text-gray-500">{candidate.brand}</p>
                  )}

                  <h3 className="mt-1 font-bold text-gray-900">
                    {candidate.name}
                  </h3>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="font-bold text-green-700">
                      {Number.isFinite(price)
                        ? `€${price.toFixed(2)}`
                        : 'Price unavailable'}
                    </span>

                    {percentage !== null && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {percentage}% match
                      </span>
                    )}

                    {promotions.length > 0 && (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        {promotions[0].name ||
                          promotions[0].description ||
                          'Promotion available'}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-gray-400">
                    Dunnes SKU: {candidate.dunnesSku}
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
        className="mt-4 w-full rounded-xl border border-gray-300 bg-white py-3 font-semibold text-gray-700"
      >
        {manualEntryLabel}
      </button>
    </section>
  );
}

export default ProductCandidateList;
