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

import {
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Minus,
  PackageSearch,
  Plus,
  RefreshCw,
  ShoppingCart,
  X,
} from 'lucide-react';

import { db } from '../Firebase';
import { mobileLog } from '../lib/mobileLog';

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

function formatMatchPercentage(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.round(
    Math.min(
      Math.max(numericValue, 0),
      1,
    ) * 100,
  );
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

  const [photoFile, setPhotoFile] =
    useState(null);

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
      setPhotoFile(null);
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
        }, 10000);

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

    setPhotoFile(null);
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

    setPhotoFile(selectedFile);
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

  if (!product) {
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
            Product could not be loaded
          </h2>

          <p className="text-sm text-gray-600 mt-3">
            {error ||
              'Please return to the scanner and try again.'}
          </p>
        </div>
      </div>
    );
  }

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
        disabled={
          savingProduct ||
          analysingPhoto
        }
        className="flex items-center gap-2 text-gray-600 font-semibold disabled:opacity-50"
      >
        <ArrowLeft size={20} />
        Back to scanner
      </button>

      <div className="mt-6 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        {notice && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <PackageSearch
                size={20}
                className="text-blue-700 mt-0.5 shrink-0"
              />

              <p className="text-sm text-blue-800">
                {notice}
              </p>
            </div>
          </div>
        )}

        {manualEntry && (
          <div className="mb-7">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0">
                  <Camera
                    size={23}
                    className="text-green-700"
                  />
                </div>

                <div>
                  <h2 className="font-bold text-gray-800">
                    Identify from a photo
                  </h2>

                  <p className="text-sm text-gray-600 mt-1">
                    Take a clear photo of the front label. We will read the visible details and search the Dunnes catalogue.
                  </p>
                </div>
              </div>

              {!photoPreviewUrl && (
                <button
                  type="button"
                  onClick={openPhotoPicker}
                  disabled={
                    analysingPhoto ||
                    savingProduct
                  }
                  className="w-full mt-4 bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Camera size={20} />
                  Take Product Photo
                </button>
              )}

              {photoPreviewUrl && (
                <div className="mt-4">
                  <div className="relative">
                    <img
                      src={photoPreviewUrl}
                      alt="Selected product"
                      className="w-full max-h-72 object-contain rounded-2xl border border-green-200 bg-white"
                    />

                    {!analysingPhoto && (
                      <button
                        type="button"
                        onClick={clearPhotoResults}
                        aria-label="Remove selected photo"
                        className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>

                  {analysingPhoto ? (
                    <div className="mt-4 flex flex-col items-center py-4">
                      <Loader2
                        size={32}
                        className="animate-spin text-green-700"
                      />

                      <p className="font-semibold text-gray-700 mt-3">
                        Analysing product...
                      </p>

                      <p className="text-sm text-gray-500 mt-1 text-center">
                        Reading the label and searching the Dunnes catalogue
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={openPhotoPicker}
                      disabled={savingProduct}
                      className="w-full mt-4 border border-green-700 text-green-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <RefreshCw size={18} />
                      Take Another Photo
                    </button>
                  )}
                </div>
              )}

              {photoLabel && (
                <div className="mt-4 rounded-xl bg-white border border-green-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                    Label detected
                  </p>

                  <p className="font-semibold text-gray-800 mt-2">
                    {[
                      photoLabel.brand,
                      photoLabel.productName,
                      photoLabel.variant,
                      photoLabel.sizeText,
                    ]
                      .filter(Boolean)
                      .join(' · ') ||
                      'Product details detected'}
                  </p>

                  {catalogueProductsChecked >
                    0 && (
                    <p className="text-xs text-gray-400 mt-2">
                      Compared with{' '}
                      {catalogueProductsChecked}{' '}
                      Dunnes products
                    </p>
                  )}
                </div>
              )}
            </div>

            {photoMatches.length > 0 && (
              <div className="mt-5">
                <h2 className="text-lg font-bold text-gray-800">
                  Possible matches
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Select the product only if the name, size and packaging match.
                </p>

                <div className="mt-4 space-y-3">
                  {photoMatches.map(
                    (match) => {
                      const percentage =
                        formatMatchPercentage(
                          match.matchScore,
                        );

                      return (
                        <button
                          key={
                            match.dunnesSku
                          }
                          type="button"
                          onClick={() =>
                            selectPhotoMatch(
                              match,
                            )
                          }
                          disabled={
                            savingProduct
                          }
                          className="w-full border border-gray-200 rounded-2xl p-4 text-left bg-white hover:border-green-600 disabled:opacity-60"
                        >
                          <div className="flex gap-4">
                            {match.imageUrl ? (
                              <img
                                src={
                                  match.imageUrl
                                }
                                alt={
                                  match.name
                                }
                                className="w-20 h-20 rounded-xl object-contain bg-gray-50 shrink-0"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                <ImagePlus
                                  size={27}
                                  className="text-gray-400"
                                />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              {match.brand && (
                                <p className="text-sm text-gray-500">
                                  {match.brand}
                                </p>
                              )}

                              <h3 className="font-bold text-gray-800 mt-1">
                                {match.name}
                              </h3>

                              <div className="flex items-center justify-between gap-3 mt-3">
                                <span className="font-bold text-green-700">
                                  {Number.isFinite(
                                    Number(
                                      match.price,
                                    ),
                                  )
                                    ? `€${Number(
                                        match.price,
                                      ).toFixed(
                                        2,
                                      )}`
                                    : 'Price unavailable'}
                                </span>

                                {percentage !==
                                  null && (
                                  <span className="text-xs font-semibold bg-green-100 text-green-700 rounded-full px-3 py-1">
                                    {percentage}% match
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-gray-400 mt-2">
                                Dunnes SKU:{' '}
                                {match.dunnesSku}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-center gap-2 bg-green-700 text-white font-bold py-2.5 rounded-xl">
                            <Check size={18} />
                            This is my product
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>

                <button
                  type="button"
                  onClick={returnToManualEntry}
                  className="w-full mt-4 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl"
                >
                  None of these, enter manually
                </button>
              </div>
            )}

            {dunnesCandidates.length > 0 && lookupSource !== 'manual' && (
              <div className="mt-5">
                <h2 className="text-lg font-bold text-gray-800">
                  Dunnes candidate matches
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Choose the best Dunnes product candidate, or continue with manual entry.
                </p>

                <div className="mt-4 space-y-3">
                  {dunnesCandidates.map((candidate) => {
                    const percentage =
                      formatMatchPercentage(
                        candidate.confidence || candidate.score,
                      );

                    return (
                      <button
                        key={candidate.dunnesSku}
                        type="button"
                        onClick={() => {
                          setProduct({
                            barcode,
                            dunnesSku:
                              candidate.dunnesSku || '',
                            name:
                              candidate.name || '',
                            brand:
                              candidate.brand || '',
                            imageUrl:
                              candidate.imageUrl || '',
                            price:
                              Number.isFinite(
                                Number(candidate.price),
                              )
                                ? Number(candidate.price)
                                : null,
                            source:
                              'open-food-facts-ai',
                            originalSource:
                              'open-food-facts',
                            matchMethod:
                              'open-food-facts-ai',
                            matchConfidence:
                              Number.isFinite(
                                Number(candidate.confidence),
                              )
                                ? Number(
                                    candidate.confidence,
                                  )
                                : null,
                          });

                          setPrice(
                            Number.isFinite(
                              Number(candidate.price),
                            ) &&
                              Number(candidate.price) >
                                0
                              ? Number(
                                  candidate.price,
                                ).toFixed(2)
                              : '',
                          );

                          setLookupSource(
                            'dunnes-candidate-match',
                          );

                          setNotice(
                            'Dunnes candidate selected. Confirm the product and shelf price before adding it.',
                          );

                          setError('');
                        }}
                        disabled={savingProduct}
                        className="w-full border border-gray-200 rounded-2xl p-4 text-left bg-white hover:border-green-600 disabled:opacity-60"
                      >
                        <div className="flex gap-4">
                          {candidate.imageUrl ? (
                            <img
                              src={candidate.imageUrl}
                              alt={candidate.name}
                              className="w-20 h-20 rounded-xl object-contain bg-gray-50 shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                              <ImagePlus
                                size={27}
                                className="text-gray-400"
                              />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            {candidate.brand && (
                              <p className="text-sm text-gray-500">
                                {candidate.brand}
                              </p>
                            )}

                            <h3 className="font-bold text-gray-800 mt-1">
                              {candidate.name}
                            </h3>

                            <div className="flex items-center justify-between gap-3 mt-3">
                              <span className="font-bold text-green-700">
                                {Number.isFinite(
                                  Number(candidate.price),
                                )
                                  ? `€${Number(
                                      candidate.price,
                                    ).toFixed(2)}`
                                  : 'Price unavailable'}
                              </span>

                              {percentage !== null && (
                                <span className="text-xs font-semibold bg-green-100 text-green-700 rounded-full px-3 py-1">
                                  {percentage}% match
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-gray-400 mt-2">
                              Dunnes SKU: {candidate.dunnesSku}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-center gap-2 bg-green-700 text-white font-bold py-2.5 rounded-xl">
                          <Check size={18} />
                          Use this candidate
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={changeSelectedMatch}
                  className="w-full mt-4 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl"
                >
                  None of these, enter manually
                </button>
              </div>
            )}

            {photoMatchAttempted &&
              !analysingPhoto &&
              photoMatches.length === 0 && (
                <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <p className="font-semibold text-amber-800">
                    No close match found
                  </p>

                  <p className="text-sm text-amber-700 mt-1">
                    Try a clearer front-facing photo, or continue with manual entry below.
                  </p>
                </div>
              )}

            <div className="flex items-center gap-3 mt-7">
              <div className="h-px bg-gray-200 flex-1" />

              <span className="text-xs font-semibold text-gray-400 uppercase">
                Manual entry
              </span>

              <div className="h-px bg-gray-200 flex-1" />
            </div>
          </div>
        )}

        {product.imageUrl && (
          <div className="flex justify-center">
            <img
              src={product.imageUrl}
              alt={
                product.name || 'Product'
              }
              className="w-40 h-40 object-contain rounded-2xl border border-gray-100"
            />
          </div>
        )}

        {manualEntry ? (
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Enter product details
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Barcode: {product.barcode}
            </p>

            <div className="mt-6">
              <label
                htmlFor="product-name"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Product name
              </label>

              <input
                id="product-name"
                type="text"
                value={product.name}
                onChange={(event) =>
                  updateProductField(
                    'name',
                    event.target.value,
                  )
                }
                disabled={savingProduct}
                placeholder="Enter the product name"
                maxLength={200}
                className="w-full border border-gray-300 rounded-xl py-3 px-4 outline-none focus:border-green-600 disabled:opacity-60"
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="product-brand"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Brand
                <span className="font-normal text-gray-400">
                  {' '}
                  optional
                </span>
              </label>

              <input
                id="product-brand"
                type="text"
                value={product.brand}
                onChange={(event) =>
                  updateProductField(
                    'brand',
                    event.target.value,
                  )
                }
                disabled={savingProduct}
                placeholder="Enter the brand"
                maxLength={100}
                className="w-full border border-gray-300 rounded-xl py-3 px-4 outline-none focus:border-green-600 disabled:opacity-60"
              />
            </div>
          </div>
        ) : (
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

            {product.dunnesSku && (
              <p className="text-xs text-gray-400 mt-1">
                Dunnes SKU:{' '}
                {product.dunnesSku}
              </p>
            )}

            {lookupSource ===
              'dunnes-photo-match' && (
              <button
                type="button"
                onClick={
                  changeSelectedMatch
                }
                disabled={savingProduct}
                className="mt-4 text-sm font-semibold text-green-700 underline disabled:opacity-50"
              >
                This is not the correct product
              </button>
            )}
          </div>
        )}

        <div className="mt-6">
          <label
            htmlFor="product-price"
            className="block text-sm font-semibold text-gray-700 mb-2 text-center"
          >
            Shelf price
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

          <p className="text-xs text-gray-500 text-center mt-2">
            Confirm the price displayed on the
            shelf
          </p>
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Quantity
          </p>

          <div className="flex items-center justify-between bg-gray-100 rounded-2xl p-2">
            <button
              type="button"
              onClick={decreaseQuantity}
              disabled={savingProduct}
              aria-label="Decrease quantity"
              className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm disabled:opacity-50"
            >
              <Minus size={22} />
            </button>

            <span className="text-2xl font-bold text-gray-800">
              {quantity}
            </span>

            <button
              type="button"
              onClick={increaseQuantity}
              disabled={savingProduct}
              aria-label="Increase quantity"
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
          disabled={
            savingProduct ||
            analysingPhoto
          }
          className="w-full mt-6 bg-green-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {savingProduct ? (
            <>
              <Loader2
                size={20}
                className="animate-spin"
              />
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