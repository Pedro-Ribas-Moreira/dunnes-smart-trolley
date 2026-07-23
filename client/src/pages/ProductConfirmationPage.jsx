import React, { useEffect, useState } from 'react';

import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import {
  ArrowLeft,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
} from 'lucide-react';

import { db } from '../Firebase';
import { mobileLog } from '../lib/mobileLog';

const appId = 'dunnes-trolley';

function ProductConfirmationPage({
  barcode,
  user,
  onCancel,
  onProductAdded,
}) {
  const [product, setProduct] = useState(null);
  const [price, setPrice] = useState('1.50');
  const [quantity, setQuantity] = useState(1);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!barcode) {
      setError('No barcode was provided.');
      setLoadingProduct(false);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    let timeoutId;

    const loadProduct = async () => {
      setLoadingProduct(true);
      setError('');

      await mobileLog('Starting product lookup', {
        barcode,
      });

      try {
        timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000);

        const response = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
            barcode
          )}.json`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Product API returned status ${response.status}`
          );
        }

        const data = await response.json();

        await mobileLog('Product data received', {
          found: data.status,
          productName: data.product?.product_name,
          hasProduct: Boolean(data.product),
        });

        if (data.status !== 1 || !data.product) {
          throw new Error(
            'Product not found in Open Food Facts.'
          );
        }

        const productName =
          data.product.product_name?.trim() ||
          data.product.product_name_en?.trim() ||
          data.product.generic_name?.trim() ||
          `Unknown product (${barcode})`;

        const productResult = {
          name: productName,
          price: 1.5,
          barcode,
          brand: data.product.brands || '',
          imageUrl:
            data.product.image_front_small_url ||
            data.product.image_url ||
            '',
        };

        if (!active) {
          return;
        }

        setProduct(productResult);
        setPrice(productResult.price.toFixed(2));

        await mobileLog('Product confirmation page ready', {
          barcode,
          productName,
        });
      } catch (lookupError) {
        if (!active) {
          return;
        }

        let message = 'The product could not be loaded.';

        if (lookupError?.name === 'AbortError') {
          message =
            'The product lookup took too long. Please try again.';
        } else if (lookupError?.message) {
          message = lookupError.message;
        }

        setError(message);

        await mobileLog(
          'Product lookup failed',
          {
            name: lookupError?.name || 'Unknown error',
            message:
              lookupError?.message || String(lookupError),
          },
          'ERROR'
        );
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (active) {
          setLoadingProduct(false);
        }
      }
    };

    loadProduct();

    return () => {
      active = false;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      controller.abort();
    };
  }, [barcode]);

  const handlePriceChange = (event) => {
    const value = event.target.value;

    if (/^\d*[.,]?\d{0,2}$/.test(value)) {
      setPrice(value);
      setError('');
    }
  };

  const getNumericPrice = () => {
    return Number(
      String(price).trim().replace(',', '.')
    );
  };

  const addProductToCart = async () => {
    if (!product || !user?.uid) {
      return;
    }

    const confirmedPrice = getNumericPrice();

    if (
      !Number.isFinite(confirmedPrice) ||
      confirmedPrice <= 0
    ) {
      setError('Please enter a valid price.');
      return;
    }

    setSavingProduct(true);
    setError('');

    try {
      const cartItemRef = doc(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'cart',
        product.barcode
      );

      await setDoc(
        cartItemRef,
        {
          ...product,
          price: confirmedPrice,
          quantity: increment(quantity),
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      await mobileLog('Product added to cart', {
        barcode: product.barcode,
        price: confirmedPrice,
        quantity,
      });

      onProductAdded();
    } catch (saveError) {
      setError(
        'The product could not be added to the cart.'
      );

      setSavingProduct(false);

      await mobileLog(
        'Cart save failed',
        {
          name: saveError?.name || 'Unknown error',
          message:
            saveError?.message || String(saveError),
        },
        'ERROR'
      );
    }
  };

  if (loadingProduct) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6">
        <Loader2
          size={40}
          className="animate-spin text-green-700"
        />

        <p className="mt-4 text-gray-600 font-semibold">
          Looking up product...
        </p>

        <p className="mt-1 text-xs text-gray-400">
          Barcode: {barcode}
        </p>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 text-gray-600 font-semibold"
        >
          <ArrowLeft size={20} />
          Back to scanner
        </button>

        <div className="mt-12 bg-white border border-red-200 rounded-2xl p-6 text-center">
          <h2 className="text-lg font-bold text-red-700">
            Product not found
          </h2>

          <p className="text-sm text-gray-600 mt-3">
            {error}
          </p>

          <p className="text-xs text-gray-400 mt-2">
            Barcode: {barcode}
          </p>

          <button
            type="button"
            onClick={onCancel}
            className="w-full mt-6 bg-green-700 text-white font-bold py-3 rounded-xl"
          >
            Scan another product
          </button>
        </div>
      </div>
    );
  }

  const numericPrice = getNumericPrice();

  const subtotal = Number.isFinite(numericPrice)
    ? numericPrice * quantity
    : 0;

  return (
    <div className="p-6">
      <button
        type="button"
        onClick={onCancel}
        disabled={savingProduct}
        className="flex items-center gap-2 text-gray-600 font-semibold disabled:opacity-50"
      >
        <ArrowLeft size={20} />
        Back to scanner
      </button>

      <div className="mt-6 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-center">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-40 h-40 object-contain rounded-2xl border border-gray-100"
            />
          ) : (
            <div className="w-40 h-40 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
              No image
            </div>
          )}
        </div>

        <div className="text-center mt-5">
          {product.brand && (
            <p className="text-sm text-gray-500">
              {product.brand}
            </p>
          )}

          <h2 className="text-xl font-bold text-gray-800 mt-1">
            {product.name}
          </h2>

          <p className="text-xs text-gray-400 mt-2">
            Barcode: {product.barcode}
          </p>
        </div>

        <div className="mt-6">
          <label
            htmlFor="product-price"
            className="block text-sm font-semibold text-gray-700 mb-2 text-center"
          >
            Product price
          </label>

          <div className="relative max-w-44 mx-auto">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl font-bold">
              €
            </span>

            <input
              id="product-price"
              type="text"
              inputMode="decimal"
              value={price}
              onChange={handlePriceChange}
              disabled={savingProduct}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-xl py-3 pl-10 pr-4 text-xl font-bold text-center text-green-700 outline-none focus:border-green-600 disabled:opacity-60"
            />
          </div>

          <p className="text-xs text-amber-600 text-center mt-2">
            Enter the shelf price shown in store
          </p>
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Quantity
          </p>

          <div className="flex items-center justify-between bg-gray-100 rounded-2xl p-2">
            <button
              type="button"
              onClick={() =>
                setQuantity((current) =>
                  Math.max(1, current - 1)
                )
              }
              disabled={savingProduct}
              className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm disabled:opacity-50"
            >
              <Minus size={22} />
            </button>

            <span className="text-2xl font-bold text-gray-800">
              {quantity}
            </span>

            <button
              type="button"
              onClick={() =>
                setQuantity((current) => current + 1)
              }
              disabled={savingProduct}
              className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm disabled:opacity-50"
            >
              <Plus size={22} />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6 py-4 border-y border-gray-100">
          <span className="font-semibold text-gray-600">
            Subtotal
          </span>

          <span className="text-2xl font-bold text-gray-900">
            €{subtotal.toFixed(2)}
          </span>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-700 text-center">
              {error}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={addProductToCart}
          disabled={savingProduct}
          className="w-full mt-6 bg-green-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {savingProduct ? (
            <>
              <Loader2
                size={20}
                className="animate-spin"
              />
              Adding...
            </>
          ) : (
            <>
              <ShoppingCart size={20} />
              Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default ProductConfirmationPage; 