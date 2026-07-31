function ProductDetailsForm({
  product,
  manualEntry,
  lookupSource,
  disabled,
  onFieldChange,
  onChangeMatch,
}) {
  return (
    <>
      {product.imageUrl && (
        <div className="flex justify-center">
          <img
            src={product.imageUrl}
            alt={product.name || 'Product'}
            className="h-40 w-40 rounded-2xl border border-gray-100 object-contain"
          />
        </div>
      )}

      {manualEntry ? (
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Enter product details
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Barcode: {product.barcode}
          </p>

          <div className="mt-6">
            <label
              htmlFor="product-name"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Product name
            </label>
            <input
              id="product-name"
              type="text"
              value={product.name}
              onChange={(event) => onFieldChange('name', event.target.value)}
              disabled={disabled}
              placeholder="Enter the product name"
              maxLength={200}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:opacity-60"
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="product-brand"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Brand <span className="font-normal text-gray-400">optional</span>
            </label>
            <input
              id="product-brand"
              type="text"
              value={product.brand}
              onChange={(event) => onFieldChange('brand', event.target.value)}
              disabled={disabled}
              placeholder="Enter the brand"
              maxLength={100}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:opacity-60"
            />
          </div>
        </div>
      ) : (
        <div className="mt-5 text-center">
          {product.brand && (
            <p className="text-sm text-gray-500">{product.brand}</p>
          )}
          <h2 className="mt-1 text-xl font-bold text-gray-800">
            {product.name}
          </h2>
          <p className="mt-2 text-xs text-gray-400">
            Barcode: {product.barcode}
          </p>
          {product.dunnesSku && (
            <p className="mt-1 text-xs text-gray-400">
              Dunnes SKU: {product.dunnesSku}
            </p>
          )}

          {lookupSource === 'dunnes-photo-match' && (
            <button
              type="button"
              onClick={onChangeMatch}
              disabled={disabled}
              className="mt-4 text-sm font-semibold text-green-700 underline disabled:opacity-50"
            >
              This is not the correct product
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default ProductDetailsForm;
