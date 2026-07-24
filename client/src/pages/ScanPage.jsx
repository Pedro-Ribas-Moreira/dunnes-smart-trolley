import React, { useEffect, useRef, useState } from 'react';

import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

import { Keyboard, Loader2, ScanLine, Search } from 'lucide-react';

import { mobileLog } from '../lib/mobileLog';

const READER_ID = 'barcode-reader';

function cleanBarcode(value) {
  return String(value).replace(/\D/g, '');
}

function isValidBarcode(barcode) {
  return [8, 12, 13, 14].includes(barcode.length);
}

function calculateQrbox(viewfinderWidth, viewfinderHeight) {
  const safeWidth = Math.max(50, Number(viewfinderWidth) || 50);

  const safeHeight = Math.max(50, Number(viewfinderHeight) || 50);

  const width = Math.max(50, Math.min(300, Math.floor(safeWidth * 0.85)));

  const height = Math.max(50, Math.min(140, Math.floor(safeHeight * 0.3)));

  return {
    width: Math.min(width, safeWidth),
    height: Math.min(height, safeHeight),
  };
}

function ScanPage({ user, active, onBarcodeScanned }) {
  const [cameraError, setCameraError] = useState('');

  const [manualBarcode, setManualBarcode] = useState('');

  const [manualError, setManualError] = useState('');

  const [showManualEntry, setShowManualEntry] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);

  const scannerRef = useRef(null);
  const scanLockedRef = useRef(false);
  const onBarcodeScannedRef = useRef(onBarcodeScanned);

  useEffect(() => {
    onBarcodeScannedRef.current = onBarcodeScanned;
  }, [onBarcodeScanned]);

  const submitBarcode = async (barcode, source) => {
    const cleanedBarcode = cleanBarcode(barcode);

    if (!isValidBarcode(cleanedBarcode)) {
      setManualError('Enter the 8, 12, 13 or 14 digit number printed below the barcode.');

      return;
    }

    if (scanLockedRef.current) {
      return;
    }

    scanLockedRef.current = true;

    setIsProcessing(true);
    setManualError('');

    await mobileLog('Barcode submitted', {
      barcode: cleanedBarcode,
      source,
    });

    onBarcodeScannedRef.current(cleanedBarcode);
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();

    await submitBarcode(manualBarcode, 'manual-entry');
  };

  useEffect(() => {
    if (!active || !user?.uid || scannerRef.current) {
      return undefined;
    }

    let cancelled = false;

    const startScanner = async () => {
      try {
        setCameraError('');
        setIsProcessing(false);

        scanLockedRef.current = false;

        await mobileLog('Starting scanner', {
          userId: user.uid,
        });

        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });

        if (cancelled) {
          return;
        }

        const readerElement = document.getElementById(READER_ID);

        if (!readerElement) {
          throw new Error('Scanner container was not found.');
        }

        const scanner = new Html5Qrcode(READER_ID);

        scannerRef.current = scanner;

        await scanner.start(
          {
            facingMode: 'environment',
          },
          {
            fps: 10,

            qrbox: (viewfinderWidth, viewfinderHeight) => calculateQrbox(viewfinderWidth, viewfinderHeight),

            aspectRatio: 1.777778,

            disableFlip: false,
          },
          async (decodedText) => {
            if (cancelled || scanLockedRef.current || !active) {
              return;
            }

            await submitBarcode(decodedText, 'camera');
          },
          () => {},
        );

        if (cancelled) {
          return;
        }

        await mobileLog('Scanner started successfully');
      } catch (error) {
        await mobileLog(
          'Camera start failed',
          {
            name: error?.name || 'Unknown error',

            message: error?.message || String(error),
          },
          'ERROR',
        );

        if (!cancelled) {
          setCameraError('The camera could not be started. You can enter the barcode manually below.');

          setShowManualEntry(true);
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      scanLockedRef.current = false;

      const scanner = scannerRef.current;

      scannerRef.current = null;

      if (!scanner) {
        return;
      }

      const stopScanner = async () => {
        try {
          const scannerState = scanner.getState();

          if (scannerState === Html5QrcodeScannerState.SCANNING || scannerState === Html5QrcodeScannerState.PAUSED) {
            await scanner.stop();

            await mobileLog('Scanner stopped');
          }
        } catch (error) {
          await mobileLog(
            'Scanner stop failed',
            {
              message: error?.message || String(error),
            },
            'ERROR',
          );
        }

        try {
          scanner.clear();

          await mobileLog('Scanner cleared');
        } catch (error) {
          await mobileLog(
            'Scanner clear failed',
            {
              message: error?.message || String(error),
            },
            'ERROR',
          );
        }
      };

      stopScanner();
    };
  }, [active, user?.uid]);

  return (
    <div className={active ? 'p-6' : 'hidden'}>
      <div className='text-center'>
        <div className='flex justify-center'>
          <div className='w-14 h-14 bg-green-100 text-green-700 rounded-2xl flex items-center justify-center'>
            <ScanLine size={30} />
          </div>
        </div>

        <h2 className='text-xl font-bold text-gray-800 mt-4'>Scan a product</h2>

        <p className='text-sm text-gray-500 mt-2'>Hold the barcode inside the camera frame.</p>
      </div>

      <div className='mt-6 relative w-full aspect-square bg-gray-100 rounded-3xl overflow-hidden border-2 border-gray-200 shadow-inner'>
        <div
          id={READER_ID}
          className='absolute inset-0 w-full h-full bg-black [&_video]:!absolute [&_video]:!inset-0 [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover'
        />

        {!isProcessing && !cameraError && (
          <div className='pointer-events-none absolute inset-0 z-10'>
            <div className='absolute left-6 right-6 top-1/2 h-0.5 bg-green-400 shadow-[0_0_8px_2px_rgba(34,197,94,0.6)] animate-pulse' />

            <div className='absolute left-6 right-6 top-[35%] bottom-[35%] border-2 border-white/70 rounded-2xl' />
          </div>
        )}

        {isProcessing && (
          <div className='absolute inset-0 z-20 bg-black/60 flex flex-col items-center justify-center text-white'>
            <Loader2 size={36} className='animate-spin' />

            <p className='font-semibold mt-3'>Barcode captured...</p>
          </div>
        )}
      </div>

      {cameraError ? (
        <div className='mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4'>
          <p className='text-sm text-amber-800 text-center'>{cameraError}</p>
        </div>
      ) : (
        <p className='text-sm text-gray-500 text-center mt-4'>
          The product will open automatically when the barcode is detected.
        </p>
      )}

      <div className='mt-6 border-t border-gray-200 pt-6'>
        {!showManualEntry ? (
          <button
            type='button'
            onClick={() => {
              setShowManualEntry(true);
              setManualError('');
            }}
            disabled={isProcessing}
            className='w-full border border-green-700 text-green-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50'
          >
            <Keyboard size={20} />
            Enter barcode manually
          </button>
        ) : (
          <form onSubmit={handleManualSubmit} className='bg-white border border-gray-200 rounded-2xl p-4'>
            <div className='flex items-start gap-3'>
              <Keyboard size={22} className='text-green-700 mt-0.5 shrink-0' />

              <div>
                <h3 className='font-bold text-gray-800'>Enter barcode number</h3>

                <p className='text-sm text-gray-500 mt-1'>Type the numbers printed below the barcode.</p>
              </div>
            </div>

            <label htmlFor='manual-barcode' className='block text-sm font-semibold text-gray-700 mt-5 mb-2'>
              Barcode number
            </label>

            <input
              id='manual-barcode'
              type='text'
              inputMode='numeric'
              autoComplete='off'
              value={manualBarcode}
              onChange={(event) => {
                const cleanedValue = cleanBarcode(event.target.value);

                setManualBarcode(cleanedValue.slice(0, 14));

                setManualError('');
              }}
              disabled={isProcessing}
              placeholder='Example: 5012345678900'
              maxLength={14}
              className='w-full border border-gray-300 rounded-xl py-3 px-4 text-lg tracking-wide outline-none focus:border-green-600 disabled:opacity-60'
            />

            {manualError && (
              <div className='mt-3 bg-red-50 border border-red-200 rounded-xl p-3'>
                <p className='text-sm text-red-700'>{manualError}</p>
              </div>
            )}

            <button
              type='submit'
              disabled={isProcessing || !manualBarcode}
              className='w-full mt-4 bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50'
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className='animate-spin' />
                  Finding product...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Find Product
                </>
              )}
            </button>

            {!cameraError && (
              <button
                type='button'
                onClick={() => {
                  setShowManualEntry(false);
                  setManualBarcode('');
                  setManualError('');
                }}
                disabled={isProcessing}
                className='w-full mt-3 text-sm text-gray-500 font-semibold'
              >
                Continue using camera
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default ScanPage;
