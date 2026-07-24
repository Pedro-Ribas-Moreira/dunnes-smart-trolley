import { useEffect, useMemo, useState } from 'react';
import { doc, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowLeft, Loader2, Minus, PackageSearch, Plus, ShoppingCart } from 'lucide-react';
import { db } from '../Firebase';
import { mobileLog } from '../lib/mobileLog';
import { getOpenFoodFactsProduct, getSavedProduct, saveProduct } from '../services/productService';

const appId = 'dunnes-trolley';

function parsePrice(value) {
  const normalizedValue = String(value).trim().replace(',', '.');

  if (!normalizedValue) {
    return Number.NaN;
  }

  return Number(normalizedValue);
}

function createManualProduct(barcode) {
  return {
    barcode,
    name: '',
    brand: '',
    imageUrl: '',
    price: null,
    source: 'manual',
  };
}

function ProductConfirmationPage({ barcode, user, onCancel, onProductAdded }) {
  const [product, setProduct] = useState(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [lookupSource, setLookupSource] = useState('');

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [loadingProduct, setLoadingProduct] = useState(true);

  const [savingProduct, setSavingProduct] = useState(false);

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
      setProduct(null);
      setPrice('');
      setError('');
      setNotice('');
      setLookupSource('');

      await mobileLog('Starting product lookup', {
        barcode,
      });

      try {
        try {
          const savedProduct = await getSavedProduct(barcode);

          if (savedProduct && active) {
            setProduct(savedProduct);

            setPrice(savedProduct.price ? savedProduct.price.toFixed(2) : '');

            setLookupSource('firebase');

            setNotice('Saved product found. Confirm that the shelf price is still correct.');

            await mobileLog('Product loaded from Firebase', {
              barcode,
              productName: savedProduct.name,
              price: savedProduct.price,
            });

            return;
          }
        } catch (firebaseError) {
          await mobileLog(
            'Firebase product lookup failed',
            {
              barcode,
              message: firebaseError?.message || String(firebaseError),
            },
            'ERROR',
          );
        }

        timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000);

        const openFoodFactsProduct = await getOpenFoodFactsProduct(barcode, controller.signal);

        if (!active) {
          return;
        }

        if (openFoodFactsProduct) {
          setProduct(openFoodFactsProduct);
          setPrice('');
          setLookupSource('open-food-facts');

          setNotice('Product details found. Enter the shelf price before adding it to your trolley.');

          await mobileLog('Product loaded from Open Food Facts', {
            barcode,
            productName: openFoodFactsProduct.name,
          });

          return;
        }

        setProduct(createManualProduct(barcode));
        setPrice('');
        setLookupSource('manual');

        setNotice('This product was not found. Enter its details and shelf price to save it for future scans.');

        await mobileLog('Manual product entry required', {
          barcode,
        });
      } catch (lookupError) {
        if (!active) {
          return;
        }

        setProduct(createManualProduct(barcode));
        setPrice('');
        setLookupSource('manual');

        if (lookupError?.name === 'AbortError') {
          setNotice('The online lookup took too long. Enter the product details manually.');
        } else {
          setNotice('The online product lookup was unavailable. Enter the product details manually.');
        }

        await mobileLog(
          'Online product lookup failed',
          {
            barcode,
            name: lookupError?.name || 'Unknown error',
            message: lookupError?.message || String(lookupError),
          },
          'ERROR',
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

  const numericPrice = useMemo(() => {
    return parsePrice(price);
  }, [price]);

  const subtotal = Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice * quantity : 0;

  const updateProductField = (fieldName, fieldValue) => {
    setProduct((currentProduct) => {
      if (!currentProduct) {
        return currentProduct;
      }

      return {
        ...currentProduct,
        [fieldName]: fieldValue,
      };
    });

    setError('');
  };

  const handlePriceChange = (event) => {
    const newPrice = event.target.value;

    if (/^\d*[.,]?\d{0,2}$/.test(newPrice)) {
      setPrice(newPrice);
      setError('');
    }
  };

  const addProductToCart = async () => {
    if (!product || !user?.uid) {
      setError('You must be signed in to add a product.');
      return;
    }

    const productName = product.name.trim();
    const productBrand = product.brand?.trim() || '';

    if (!productName) {
      setError('Please enter the product name.');
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('Please enter a valid product price.');
      return;
    }

    setSavingProduct(true);
    setError('');

    const confirmedProduct = {
      barcode: product.barcode,
      name: productName,
      brand: productBrand,
      imageUrl: product.imageUrl || '',
      price: numericPrice,
      source: product.source || (lookupSource === 'manual' ? 'manual' : 'open-food-facts'),
    };

    try {
      await saveProduct(confirmedProduct);

      await mobileLog('Product saved to Firebase catalogue', {
        barcode: confirmedProduct.barcode,
        productName: confirmedProduct.name,
        price: confirmedProduct.price,
        source: confirmedProduct.source,
      });

      const cartItemReference = doc(db, 'artifacts', appId, 'users', user.uid, 'cart', confirmedProduct.barcode);

      await setDoc(
        cartItemReference,
        {
          ...confirmedProduct,
          quantity: increment(quantity),
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      await mobileLog('Product added to cart', {
        barcode: confirmedProduct.barcode,
        price: confirmedProduct.price,
        quantity,
      });

      onProductAdded();
    } catch (saveError) {
      setError('The product could not be saved. Please try again.');

      await mobileLog(
        'Product save failed',
        {
          barcode,
          name: saveError?.name || 'Unknown error',
          message: saveError?.message || String(saveError),
        },
        'ERROR',
      );

      setSavingProduct(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className='min-h-full flex flex-col items-center justify-center p-6'>
        <Loader2 size={40} className='animate-spin text-green-700' />

        <p className='mt-4 text-gray-600 font-semibold'>Checking saved products...</p>

        <p className='mt-1 text-xs text-gray-400'>Barcode: {barcode}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className='p-6'>
        <button type='button' onClick={onCancel} className='flex items-center gap-2 text-gray-600 font-semibold'>
          <ArrowLeft size={20} />
          Back to scanner
        </button>

        <div className='mt-12 bg-white border border-red-200 rounded-2xl p-6 text-center'>
          <h2 className='text-lg font-bold text-red-700'>Product could not be loaded</h2>

          <p className='text-sm text-gray-600 mt-3'>{error || 'Please return to the scanner and try again.'}</p>
        </div>
      </div>
    );
  }

  const manualEntry = lookupSource === 'manual';

  return (
    <div className='p-6'>
      <button
        type='button'
        onClick={onCancel}
        disabled={savingProduct}
        className='flex items-center gap-2 text-gray-600 font-semibold disabled:opacity-50'
      >
        <ArrowLeft size={20} />
        Back to scanner
      </button>

      <div className='mt-6 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm'>
        {notice && (
          <div className='mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4'>
            <div className='flex items-start gap-3'>
              <PackageSearch size={20} className='text-blue-700 mt-0.5 shrink-0' />

              <p className='text-sm text-blue-800'>{notice}</p>
            </div>
          </div>
        )}

        {product.imageUrl && !manualEntry && (
          <div className='flex justify-center'>
            <img
              src={product.imageUrl}
              alt={product.name}
              className='w-40 h-40 object-contain rounded-2xl border border-gray-100'
            />
          </div>
        )}

        {manualEntry ? (
          <div>
            <h2 className='text-xl font-bold text-gray-800'>Enter product details</h2>

            <p className='text-sm text-gray-500 mt-1'>Barcode: {product.barcode}</p>

            <div className='mt-6'>
              <label htmlFor='product-name' className='block text-sm font-semibold text-gray-700 mb-2'>
                Product name
              </label>

              <input
                id='product-name'
                type='text'
                value={product.name}
                onChange={(event) => updateProductField('name', event.target.value)}
                disabled={savingProduct}
                placeholder='Enter the product name'
                className='w-full border border-gray-300 rounded-xl py-3 px-4 outline-none focus:border-green-600 disabled:opacity-60'
              />
            </div>

            <div className='mt-4'>
              <label htmlFor='product-brand' className='block text-sm font-semibold text-gray-700 mb-2'>
                Brand
                <span className='font-normal text-gray-400'> optional</span>
              </label>

              <input
                id='product-brand'
                type='text'
                value={product.brand}
                onChange={(event) => updateProductField('brand', event.target.value)}
                disabled={savingProduct}
                placeholder='Enter the brand'
                className='w-full border border-gray-300 rounded-xl py-3 px-4 outline-none focus:border-green-600 disabled:opacity-60'
              />
            </div>
          </div>
        ) : (
          <div className='text-center mt-5'>
            {product.brand && <p className='text-sm text-gray-500'>{product.brand}</p>}

            <h2 className='text-xl font-bold text-gray-800 mt-1'>{product.name}</h2>

            <p className='text-xs text-gray-400 mt-2'>Barcode: {product.barcode}</p>
          </div>
        )}

        <div className='mt-6'>
          <label htmlFor='product-price' className='block text-sm font-semibold text-gray-700 mb-2 text-center'>
            Shelf price
          </label>

          <div className='relative max-w-44 mx-auto'>
            <span className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl font-bold'>€</span>

            <input
              id='product-price'
              type='text'
              inputMode='decimal'
              value={price}
              onChange={handlePriceChange}
              disabled={savingProduct}
              placeholder='0.00'
              className='w-full border border-gray-300 rounded-xl py-3 pl-10 pr-4 text-xl font-bold text-center text-green-700 outline-none focus:border-green-600 disabled:opacity-60'
            />
          </div>

          <p className='text-xs text-gray-500 text-center mt-2'>Confirm the price displayed on the shelf</p>
        </div>

        <div className='mt-8'>
          <p className='text-sm font-semibold text-gray-700 mb-3'>Quantity</p>

          <div className='flex items-center justify-between bg-gray-100 rounded-2xl p-2'>
            <button
              type='button'
              onClick={() => setQuantity((currentQuantity) => Math.max(1, currentQuantity - 1))}
              disabled={savingProduct}
              className='w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm disabled:opacity-50'
            >
              <Minus size={22} />
            </button>

            <span className='text-2xl font-bold text-gray-800'>{quantity}</span>

            <button
              type='button'
              onClick={() => setQuantity((currentQuantity) => currentQuantity + 1)}
              disabled={savingProduct}
              className='w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm disabled:opacity-50'
            >
              <Plus size={22} />
            </button>
          </div>
        </div>

        <div className='flex justify-between items-center mt-6 py-4 border-y border-gray-100'>
          <span className='font-semibold text-gray-600'>Subtotal</span>

          <span className='text-2xl font-bold text-gray-900'>€{subtotal.toFixed(2)}</span>
        </div>

        {error && (
          <div className='mt-4 bg-red-50 border border-red-200 rounded-xl p-3'>
            <p className='text-sm text-red-700 text-center'>{error}</p>
          </div>
        )}

        <button
          type='button'
          onClick={addProductToCart}
          disabled={savingProduct}
          className='w-full mt-6 bg-green-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60'
        >
          {savingProduct ? (
            <>
              <Loader2 size={20} className='animate-spin' />
              Saving...
            </>
          ) : (
            <>
              <ShoppingCart size={20} />
              Save and Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default ProductConfirmationPage;
