import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { ArrowLeft, Loader2, PackageSearch, ShoppingCart } from 'lucide-react';

import { db } from '../Firebase';
import { mobileLog } from '../lib/mobileLog';
import ProductCandidateList from '../components/product/ProductCandidateList';
import ProductDetailsForm from '../components/product/ProductDetailsForm';
import ProductLookupLoader from '../components/product/ProductLookupLoader';
import ProductPhotoSection from '../components/product/ProductPhotoSection';
import QuantitySelector from '../components/product/QuantitySelector';

import {
  lookupProduct,
  saveProductViaApi,
} from '../services/productApiService';

import {
  matchProductPhoto,
} from '../services/productPhotoMatchApiService';

const appId = 'dunnes-trolley';

function parsePrice(value) {
  const normalizedValue = String(value)
    .trim()
    .replace(',', '.');

  if (!normalizedValue) {
    return Number.NaN;
  }

  return Number(normalizedValue);
}

function createManualProduct(barcode) {
  return {
    barcode,
    dunnesSku: '',
    name: '',
    brand: '',
    imageUrl: '',
    price: null,
    source: 'manual',
  };
}

function ProductConfirmationPage({
  barcode,
  user,
  onCancel,
  onProductAdded,
}) {
  const photoInputReference = useRef(null);

  const [product, setProduct] = useState(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [lookupSource, setLookupSource] =
    useState('');

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [dunnesCandidates, setDunnesCandidates] =
    useState([]);

  const [loadingProduct, setLoadingProduct] =
    useState(true);

  const [savingProduct, setSavingProduct] =
    useState(false);

  const [analysingPhoto, setAnalysingPhoto] =
    useState(false);


  const [photoPreviewUrl, setPhotoPreviewUrl] =
    useState('');

  const [photoLabel, setPhotoLabel] =
    useState(null);

  const [photoMatches, setPhotoMatches] =
    useState([]);

  const [photoMatchAttempted, setPhotoMatchAttempted] =
    useState(false);

  const [catalogueProductsChecked, setCatalogueProductsChecked] =
    useState(0);

  useEffect(() => {
    if (!barcode) {
      setError('No barcode was provided.');
      setLoadingProduct(false);

      return undefined;
    }

    const controller = new AbortController();

    let componentActive = true;
    let timeoutId;

    const loadProduct = async () => {
      setLoadingProduct(true);
      setProduct(null);
      setPrice('');
      setQuantity(1);
      setLookupSource('');
      setNotice('');
      setError('');
      setDunnesCandidates([]);
      setPhotoPreviewUrl('');
      setPhotoLabel(null);
      setPhotoMatches([]);
      setPhotoMatchAttempted(false);
      setCatalogueProductsChecked(0);

      await mobileLog(
        'Starting backend product lookup',
        {
          barcode,
        },
      );

      try {
        timeoutId = setTimeout(() => {
          controller.abort();
        }, 120000);

        const lookupResult =
          await lookupProduct(
            barcode,
            controller.signal,
          );

        if (!componentActive) {
          return;
        }

        if (
          lookupResult.found &&
          lookupResult.product
        ) {
          const foundProduct =
            lookupResult.product;

          const foundPrice = Number(
            foundProduct.price,
          );

          setProduct(foundProduct);

          setPrice(
            Number.isFinite(foundPrice) &&
              foundPrice > 0
              ? foundPrice.toFixed(2)
              : '',
          );

          setLookupSource(
            lookupResult.source ||
              foundProduct.source ||
              '',
          );

          const candidates =
            Array.isArray(
              lookupResult.dunnesCandidates,
            )
              ? lookupResult.dunnesCandidates
              : [];

          setDunnesCandidates(candidates);

          if (
            lookupResult.source === 'firebase'
          ) {
            setNotice(
              'Saved product found. Confirm that the shelf price is still correct.',
            );
          } else if (
            candidates.length > 0 &&
            !lookupResult.noReliableMatch
          ) {
            setNotice(
              'We found likely Dunnes matches for this product. Select the best one, or continue with manual entry.',
            );
          } else if (
            lookupResult.noReliableMatch
          ) {
            setNotice(
              'We could not identify a reliable Dunnes match. Please confirm the product manually.',
            );
          } else {
            setNotice(
              'Product details found. Enter the shelf price before adding it to your trolley.',
            );
          }

          await mobileLog(
            'Product returned by backend',
            {
              barcode,
              productName:
                foundProduct.name,
              source:
                lookupResult.source,
              price:
                foundProduct.price,
              dunnesCandidates:
                candidates.length,
              noReliableMatch:
                lookupResult.noReliableMatch,
            },
          );

          return;
        }

        setProduct(
          createManualProduct(barcode),
        );

        setLookupSource('manual');

        setNotice(
          'This barcode was not found. Take a photo of the front label and we will look for possible Dunnes matches.',
        );

        await mobileLog(
          'Manual product entry required',
          {
            barcode,
          },
        );
      } catch (lookupError) {
        if (!componentActive) {
          return;
        }

        setProduct(
          createManualProduct(barcode),
        );

        setLookupSource('manual');

        if (
          lookupError?.name ===
          'AbortError'
        ) {
          setNotice(
            'The product lookup took too long. You can try identifying the product from a photo or enter its details manually.',
          );
        } else {
          setNotice(
            'The product service is currently unavailable. You can try identifying the product from a photo or enter its details manually.',
          );
        }

        await mobileLog(
          'Backend product lookup failed',
          {
            barcode,
            name:
              lookupError?.name ||
              'Unknown error',
            message:
              lookupError?.message ||
              String(lookupError),
          },
          'ERROR',
        );
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (componentActive) {
          setLoadingProduct(false);
        }
      }
    };

    loadProduct();

    return () => {
      componentActive = false;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      controller.abort();
    };
  }, [barcode]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(
          photoPreviewUrl,
        );
      }
    };
  }, [photoPreviewUrl]);

  const numericPrice = useMemo(() => {
    return parsePrice(price);
  }, [price]);

  const subtotal =
    Number.isFinite(numericPrice) &&
    numericPrice > 0
      ? numericPrice * quantity
      : 0;

  const manualEntry =
    lookupSource === 'manual';

  const updateProductField = (
    fieldName,
    fieldValue,
  ) => {
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

  const decreaseQuantity = () => {
    setQuantity((currentQuantity) =>
      Math.max(1, currentQuantity - 1),
    );
  };

  const increaseQuantity = () => {
    setQuantity(
      (currentQuantity) =>
        currentQuantity + 1,
    );
  };

  const clearPhotoResults = () => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(
        photoPreviewUrl,
      );
    }

    setPhotoPreviewUrl('');
    setPhotoLabel(null);
    setPhotoMatches([]);
    setPhotoMatchAttempted(false);
    setCatalogueProductsChecked(0);
    setError('');

    if (photoInputReference.current) {
      photoInputReference.current.value = '';
    }
  };

  const openPhotoPicker = () => {
    setError('');

    photoInputReference.current?.click();
  };

  const handlePhotoSelected = async (
    event,
  ) => {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp',
      ].includes(selectedFile.type)
    ) {
      setError(
        'Please select a JPEG, PNG or WebP image.',
      );

      event.target.value = '';

      return;
    }

    if (
      selectedFile.size >
      8 * 1024 * 1024
    ) {
      setError(
        'The photo must be smaller than 8 MB.',
      );

      event.target.value = '';

      return;
    }

    if (photoPreviewUrl) {
      URL.revokeObjectURL(
        photoPreviewUrl,
      );
    }

    const previewUrl =
      URL.createObjectURL(
        selectedFile,
      );

    setPhotoPreviewUrl(previewUrl);
    setPhotoLabel(null);
    setPhotoMatches([]);
    setPhotoMatchAttempted(false);
    setCatalogueProductsChecked(0);
    setError('');
    setAnalysingPhoto(true);

    await mobileLog(
      'Starting product photo analysis',
      {
        barcode,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
      },
    );

    try {
      const result =
        await matchProductPhoto(
          user,
          selectedFile,
        );

      setPhotoLabel(result.label);
      setPhotoMatches(result.matches);
      setPhotoMatchAttempted(true);

      setCatalogueProductsChecked(
        result.catalogueProductsChecked,
      );

      if (result.matches.length > 0) {
        setNotice(
          'We found possible Dunnes products. Select the correct match, or continue with manual entry.',
        );
      } else {
        setNotice(
          'We could not find a confident Dunnes match. Try another photo or enter the product details manually.',
        );
      }

      await mobileLog(
        'Product photo analysis completed',
        {
          barcode,
          extractedBrand:
            result.label?.brand || '',
          extractedProductName:
            result.label?.productName ||
            '',
          matches:
            result.matches.length,
          catalogueProductsChecked:
            result.catalogueProductsChecked,
        },
      );
    } catch (photoError) {
      setPhotoMatchAttempted(true);

      setError(
        photoError?.message ||
          'The product photo could not be analysed.',
      );

      await mobileLog(
        'Product photo analysis failed',
        {
          barcode,
          name:
            photoError?.name ||
            'Unknown error',
          message:
            photoError?.message ||
            String(photoError),
        },
        'ERROR',
      );
    } finally {
      setAnalysingPhoto(false);
    }
  };

  const selectPhotoMatch = (
    match,
  ) => {
    const matchedPrice = Number(
      match.price,
    );

    setProduct({
      barcode,
      dunnesSku:
        match.dunnesSku || '',
      name:
        match.name || '',
      brand:
        match.brand || '',
      imageUrl:
        match.imageUrl || '',
      price:
        Number.isFinite(
          matchedPrice,
        )
          ? matchedPrice
          : null,
      promotions:
        Array.isArray(
          match.promotions,
        )
          ? match.promotions
          : [],
      source:
        'dunnes-photo-match',
      originalSource:
        'dunnes-storefront',
    });

    setPrice(
      Number.isFinite(matchedPrice) &&
        matchedPrice > 0
        ? matchedPrice.toFixed(2)
        : '',
    );

    setLookupSource(
      'dunnes-photo-match',
    );

    setNotice(
      'Dunnes product selected. Confirm that the product and shelf price are correct before adding it.',
    );

    setError('');
  };

  const returnToManualEntry = () => {
    const extractedName = [
      photoLabel?.productName,
      photoLabel?.variant,
      photoLabel?.sizeText,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    setProduct({
      ...createManualProduct(
        barcode,
      ),
      name: extractedName,
      brand:
        photoLabel?.brand || '',
    });

    setPrice('');
    setLookupSource('manual');
    setDunnesCandidates([]);

    setNotice(
      'Enter or correct the product details and shelf price manually.',
    );

    setError('');
  };

  const changeSelectedMatch = () => {
    setProduct(
      createManualProduct(barcode),
    );

    setPrice('');
    setLookupSource('manual');
    setDunnesCandidates([]);

    setNotice(
      'Select another suggested product, take a new photo or enter the details manually.',
    );

    setError('');
  };

  const selectDunnesCandidate = (candidate) => {
    const candidatePrice = Number(candidate.price);
    const promotions = candidate.promotions ?? [];

    setProduct({
      barcode,
      dunnesSku: candidate.dunnesSku || '',
      name: candidate.name || '',
      brand: candidate.brand || '',
      imageUrl: candidate.imageUrl || '',
      price: Number.isFinite(candidatePrice) ? candidatePrice : null,
      source: 'open-food-facts-ai',
      originalSource: 'open-food-facts',
      matchMethod: 'open-food-facts-ai',
      matchConfidence: Number.isFinite(Number(candidate.confidence))
        ? Number(candidate.confidence)
        : null,
      promotions,
      hasPromotion: promotions.length > 0,
    });

    setPrice(
      Number.isFinite(candidatePrice) && candidatePrice > 0
        ? candidatePrice.toFixed(2)
        : '',
    );
    setLookupSource('dunnes-candidate-match');
    setNotice(
      'Dunnes product selected. Confirm the product and price before adding it to your trolley.',
    );
    setError('');
  };

  const continueWithManualEntry = () => {
    setDunnesCandidates([]);
    setLookupSource('manual');
    setProduct((currentProduct) => ({
      ...createManualProduct(barcode),
      name: currentProduct?.name || '',
      brand: currentProduct?.brand || '',
      imageUrl: currentProduct?.imageUrl || '',
    }));
    setPrice('');
    setNotice('No Dunnes match selected. Enter the shelf price manually.');
  };

  const addProductToCart = async () => {
    if (!product) {
      setError(
        'The product details are unavailable.',
      );

      return;
    }

    if (!user?.uid) {
      setError(
        'You must be signed in to add a product.',
      );

      return;
    }

    const productName = String(
      product.name || '',
    ).trim();

    const productBrand = String(
      product.brand || '',
    ).trim();

    if (!productName) {
      setError(
        'Please enter the product name.',
      );

      return;
    }

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      setError(
        'Please enter a valid product price.',
      );

      return;
    }

    const originalSource =
      product.originalSource ||
      product.source ||
      (manualEntry
        ? 'manual'
        : 'open-food-facts');

    const confirmedProduct = {
      barcode: product.barcode,
      dunnesSku:
        product.dunnesSku || '',
      name: productName,
      brand: productBrand,
      imageUrl:
        product.imageUrl || '',
      price: numericPrice,
      source: originalSource,
      originalSource,
      matchMethod:
        product.matchMethod ||
        (product.dunnesSku
          ? 'open-food-facts-ai'
          : 'open-food-facts'),
      matchConfidence:
        Number.isFinite(product.matchConfidence)
          ? Number(product.matchConfidence)
          : product.dunnesSku
          ? 0.0
          : null,
      promotions:
        Array.isArray(product.promotions)
          ? product.promotions
          : [],
    };

    setSavingProduct(true);
    setError('');

    try {
      const savedProduct =
        await saveProductViaApi(
          confirmedProduct,
          user,
        );

      await mobileLog(
        'Product saved through backend',
        {
          barcode:
            confirmedProduct.barcode,
          dunnesSku:
            confirmedProduct.dunnesSku,
          productName:
            confirmedProduct.name,
          price:
            confirmedProduct.price,
          source:
            confirmedProduct.source,
        },
      );

      const cartItemReference = doc(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'cart',
        confirmedProduct.barcode,
      );

      await setDoc(
        cartItemReference,
        {
          ...confirmedProduct,
          source:
            savedProduct?.source ||
            confirmedProduct.source,
          originalSource:
            savedProduct?.originalSource ||
            confirmedProduct.originalSource,
          dunnesSku:
            savedProduct?.dunnesSku ||
            confirmedProduct.dunnesSku ||
            '',
          promotions:
            Array.isArray(savedProduct?.promotions)
              ? savedProduct.promotions
              : confirmedProduct.promotions,
          hasPromotion:
            Array.isArray(savedProduct?.promotions)
              ? savedProduct.promotions.length > 0
              : confirmedProduct.promotions.length > 0,
          quantity: increment(quantity),
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      await mobileLog(
        'Product added to cart',
        {
          barcode:
            confirmedProduct.barcode,
          dunnesSku:
            confirmedProduct.dunnesSku,
          price:
            confirmedProduct.price,
          quantity,
        },
      );

      onProductAdded();
    } catch (saveError) {
      setError(
        saveError?.message ||
          'The product could not be saved. Please try again.',
      );

      await mobileLog(
        'Product save failed',
        {
          barcode,
          name:
            saveError?.name ||
            'Unknown error',
          message:
            saveError?.message ||
            String(saveError),
        },
        'ERROR',
      );
    } finally {
      setSavingProduct(false);
    }
  };

  if (loadingProduct) {
    return <ProductLookupLoader barcode={barcode} />;
  }

  if (!product) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 font-semibold text-gray-600"
        >
          <ArrowLeft size={20} />
          Back to scanner
        </button>

        <div className="mt-12 rounded-2xl border border-red-200 bg-white p-6 text-center">
          <h2 className="text-lg font-bold text-red-700">
            Product could not be loaded
          </h2>
          <p className="mt-3 text-sm text-gray-600">
            {error || 'Please return to the scanner and try again.'}
          </p>
        </div>
      </div>
    );
  }

  const showDunnesCandidates =
    dunnesCandidates.length > 0 &&
    lookupSource !== 'manual' &&
    lookupSource !== 'dunnes-candidate-match';

  return (
    <div className="p-6">
      <input
        ref={photoInputReference}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handlePhotoSelected}
        className="hidden"
      />

      <button
        type="button"
        onClick={onCancel}
        disabled={savingProduct || analysingPhoto}
        className="flex items-center gap-2 font-semibold text-gray-600 disabled:opacity-50"
      >
        <ArrowLeft size={20} />
        Back to scanner
      </button>

      <div className="mt-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        {notice && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <PackageSearch
                size={20}
                className="mt-0.5 shrink-0 text-blue-700"
              />
              <p className="text-sm text-blue-800">{notice}</p>
            </div>
          </div>
        )}

        {showDunnesCandidates && (
          <ProductCandidateList
            candidates={dunnesCandidates}
            disabled={savingProduct}
            onSelect={selectDunnesCandidate}
            onManualEntry={continueWithManualEntry}
          />
        )}

        {manualEntry && (
          <ProductPhotoSection
            previewUrl={photoPreviewUrl}
            label={photoLabel}
            matches={photoMatches}
            matchAttempted={photoMatchAttempted}
            productsChecked={catalogueProductsChecked}
            analysing={analysingPhoto}
            disabled={savingProduct}
            onOpenPicker={openPhotoPicker}
            onClear={clearPhotoResults}
            onSelectMatch={selectPhotoMatch}
            onManualEntry={returnToManualEntry}
          />
        )}

        <ProductDetailsForm
          product={product}
          manualEntry={manualEntry}
          lookupSource={lookupSource}
          disabled={savingProduct}
          onFieldChange={updateProductField}
          onChangeMatch={changeSelectedMatch}
        />

        <div className="mt-6">
          <label
            htmlFor="product-price"
            className="mb-2 block text-center text-sm font-semibold text-gray-700"
          >
            Shelf price
          </label>

          <div className="relative mx-auto max-w-44">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">
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
              className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-center text-xl font-bold text-green-700 outline-none focus:border-green-600 disabled:opacity-60"
            />
          </div>

          <p className="mt-2 text-center text-xs text-gray-500">
            Confirm the price displayed on the shelf
          </p>
        </div>

        <QuantitySelector
          quantity={quantity}
          disabled={savingProduct}
          onDecrease={decreaseQuantity}
          onIncrease={increaseQuantity}
        />

        <div className="mt-6 flex items-center justify-between border-y border-gray-100 py-4">
          <span className="font-semibold text-gray-600">Subtotal</span>
          <span className="text-2xl font-bold text-gray-900">
            €{subtotal.toFixed(2)}
          </span>
        </div>

        {error && (
          <div
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3"
            role="alert"
          >
            <p className="text-center text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={addProductToCart}
          disabled={savingProduct || analysingPhoto}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-4 font-bold text-white disabled:opacity-60"
        >
          {savingProduct ? (
            <>
              <Loader2 size={20} className="animate-spin" />
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
