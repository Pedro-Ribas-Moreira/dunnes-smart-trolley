import React, { useEffect, useRef, useState } from 'react';

import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { Html5Qrcode } from 'html5-qrcode';
import { Loader2 } from 'lucide-react';

import { db } from '../Firebase';
import { mobileLog } from '../lib/mobileLog';

const appId = 'dunnes-trolley';

function ScanPage({ user, setActiveTab }) {
  const [cameraError, setCameraError] = useState('');
  const [scanError, setScanError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);

  const addProductToCart = async () => {
    if (!scannedProduct || !user) {
      return;
    }

    setIsProcessing(true);
    setScanError('');

    await mobileLog('Adding product to cart', {
      barcode: scannedProduct.barcode,
      quantity,
    });

    try {
      const cartItemRef = doc(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'cart',
        scannedProduct.barcode
      );

      await setDoc(
        cartItemRef,
        {
          ...scannedProduct,
          quantity: increment(quantity),
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      await mobileLog('Product added to cart', {
        barcode: scannedProduct.barcode,
        quantity,
      });

      setScannedProduct(null);
      setQuantity(1);
      setActiveTab('cart');
    } catch (error) {
      console.error('Cart error:', error);

      await mobileLog(
        'Cart save failed',
        {
          message: error.message,
          stack: error.stack,
        },
        'ERROR'
      );

      setScanError('The product could not be added to the cart.');
      setIsProcessing(false);
    }
  };

  const closeProductModal = async () => {
    await mobileLog('Product modal closed');

    setScannedProduct(null);
    setQuantity(1);
    setScanError('');
    setIsProcessing(false);

    isProcessingRef.current = false;

    try {
      if (scannerRef.current?.isPaused()) {
        scannerRef.current.resume();
        await mobileLog('Scanner resumed');
      }
    } catch (error) {
      console.error('Scanner resume error:', error);

      await mobileLog(
        'Scanner resume failed',
        {
          message: error.message,
        },
        'ERROR'
      );
    }
  };

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      if (!user || scannerRef.current) {
        return;
      }

      try {
        setCameraError('');
        setScanError('');

        await mobileLog('Starting scanner');

        const scanner = new Html5Qrcode('reader');
        scannerRef.current = scanner;

        await scanner.start(
          {
            facingMode: 'environment',
          },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 350,
            },
          },
          async (decodedText) => {
            if (isProcessingRef.current) {
              return;
            }

            isProcessingRef.current = true;

            if (isMounted) {
              setIsProcessing(true);
              setScanError('');
            }

            await mobileLog('Barcode detected', {
              barcode: decodedText,
            });

            try {
              const controller = new AbortController();

              const timeoutId = setTimeout(() => {
                controller.abort();
              }, 10000);

              const response = await fetch(
                `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
                  decodedText
                )}.json`,
                {
                  signal: controller.signal,
                }
              );

              clearTimeout(timeoutId);

              await mobileLog('Open Food Facts response received', {
                status: response.status,
                ok: response.ok,
              });

              if (!response.ok) {
                throw new Error(
                  `Product API returned status ${response.status}`
                );
              }

              const data = await response.json();

              await mobileLog('Product data received', {
                found: data.status,
                productName: data.product?.product_name,
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
                `Unknown product (${decodedText})`;

              const product = {
                name: productName,
                price: 1.5,
                barcode: decodedText,
                brand: data.product.brands || '',
                imageUrl:
                  data.product.image_front_small_url ||
                  data.product.image_url ||
                  '',
              };

              scanner.pause(true);

              await mobileLog('Scanner paused');

              if (isMounted) {
                setScannedProduct(product);
                setQuantity(1);
                setIsProcessing(false);
              }

              await mobileLog('Opening product modal', product);
            } catch (error) {
              console.error('Product processing error:', error);

              let errorMessage = 'The product could not be scanned.';

              if (error.name === 'AbortError') {
                errorMessage =
                  'The product lookup took too long. Please try again.';
              } else if (error.message) {
                errorMessage = error.message;
              }

              await mobileLog(
                'Product processing failed',
                {
                  message: error.message,
                  name: error.name,
                  stack: error.stack,
                },
                'ERROR'
              );

              if (isMounted) {
                setScanError(errorMessage);
                setIsProcessing(false);
              }

              isProcessingRef.current = false;

              try {
                if (scanner.isPaused()) {
                  scanner.resume();
                  await mobileLog('Scanner resumed after error');
                }
              } catch (resumeError) {
                console.error(
                  'Scanner resume error:',
                  resumeError
                );

                await mobileLog(
                  'Scanner resume failed after error',
                  {
                    message: resumeError.message,
                  },
                  'ERROR'
                );
              }
            }
          },
          () => {}
        );

        await mobileLog('Scanner started successfully');
      } catch (error) {
        console.error('Camera start error:', error);

        await mobileLog(
          'Camera start failed',
          {
            message: error.message,
            stack: error.stack,
          },
          'ERROR'
        );

        if (isMounted) {
          setCameraError(
            'The camera could not be started. Please allow camera access and try again.'
          );
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      isProcessingRef.current = false;

      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (!scanner) {
        return;
      }

      const cleanUpScanner = async () => {
        try {
          if (scanner.isScanning) {
            await scanner.stop();
          }
        } catch (error) {
          console.error('Scanner stop error:', error);
        }

        try {
          scanner.clear();
        } catch (error) {
          console.error('Scanner clear error:', error);
        }
      };

      cleanUpScanner();
    };
  }, [user]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-6">
      <div
        id="reader"
        className="w-full aspect-square bg-black rounded-3xl overflow-hidden shadow-inner border-2 border-gray-200 relative"
      >
        {!isProcessing &&
          !cameraError &&
          !scannedProduct && (
            <div className="absolute w-full h-0.5 bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.6)] top-1/2 animate-pulse z-10" />
          )}
      </div>

      {cameraError && (
        <div className="w-full rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-red-700 text-sm font-semibold text-center">
            {cameraError}
          </p>
        </div>
      )}

      {scanError && !scannedProduct && (
        <div className="w-full rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-amber-800 text-sm font-semibold text-center">
            {scanError}
          </p>
        </div>
      )}

      {isProcessing && !scannedProduct ? (
        <div className="flex items-center gap-2 text-green-700">
          <Loader2
            className="animate-spin"
            size={24}
          />

          <p className="font-bold">
            Looking up product...
          </p>
        </div>
      ) : (
        !scannedProduct && (
          <p className="text-gray-500 font-medium text-center">
            Point your camera at a barcode. It will scan automatically.
          </p>
        )
      )}

      {scannedProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="w-full max-w-md bg-white rounded-t-3xl p-6">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />

            <div className="flex gap-4">
              {scannedProduct.imageUrl ? (
                <img
                  src={scannedProduct.imageUrl}
                  alt={scannedProduct.name}
                  className="w-24 h-24 rounded-xl object-contain border border-gray-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm text-center">
                  No image
                </div>
              )}

              <div className="flex-1">
                {scannedProduct.brand && (
                  <p className="text-xs text-gray-500">
                    {scannedProduct.brand}
                  </p>
                )}

                <h2 className="text-lg font-bold text-gray-800 mt-1">
                  {scannedProduct.name}
                </h2>

                <p className="text-2xl font-bold text-green-700 mt-2">
                  €{Number(scannedProduct.price).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Quantity
              </p>

              <div className="flex items-center justify-between bg-gray-100 rounded-xl p-2">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.max(1, current - 1)
                    )
                  }
                  className="w-12 h-12 bg-white rounded-lg text-2xl font-bold shadow-sm"
                >
                  −
                </button>

                <span className="text-xl font-bold">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) => current + 1)
                  }
                  className="w-12 h-12 bg-white rounded-lg text-2xl font-bold shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <span className="text-gray-600 font-medium">
                Subtotal
              </span>

              <span className="text-xl font-bold text-gray-900">
                €
                {(
                  Number(scannedProduct.price) * quantity
                ).toFixed(2)}
              </span>
            </div>

            {scanError && (
              <p className="text-red-600 text-sm mt-4 text-center">
                {scanError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={closeProductModal}
                disabled={isProcessing}
                className="py-3 rounded-xl border border-gray-300 font-bold text-gray-700 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={addProductToCart}
                disabled={isProcessing}
                className="py-3 rounded-xl bg-green-700 text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isProcessing && (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                )}

                {isProcessing
                  ? 'Adding...'
                  : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScanPage;