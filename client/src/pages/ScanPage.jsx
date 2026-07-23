import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2 } from 'lucide-react';

import { mobileLog } from '../lib/mobileLog';

function ScanPage({ user, active, onBarcodeScanned }) {
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const scannerRef = useRef(null);
  const scanLockedRef = useRef(false);

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
            if (
              cancelled ||
              scanLockedRef.current ||
              !active
            ) {
              return;
            }

            scanLockedRef.current = true;
            setIsProcessing(true);

            await mobileLog('Barcode detected', {
              barcode: decodedText,
            });

            onBarcodeScanned(decodedText);
          },
          () => {}
        );

        await mobileLog('Scanner started successfully');
      } catch (error) {
        await mobileLog(
          'Camera start failed',
          {
            name: error?.name || 'Unknown error',
            message: error?.message || String(error),
          },
          'ERROR'
        );

        if (!cancelled) {
          setCameraError(
            'The camera could not be started. Please allow camera access and try again.'
          );
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
          if (scanner.isScanning) {
            await scanner.stop();
            await mobileLog('Scanner stopped');
          }
        } catch (error) {
          await mobileLog(
            'Scanner stop failed',
            {
              message: error?.message || String(error),
            },
            'ERROR'
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
            'ERROR'
          );
        }
      };

      stopScanner();
    };
  }, [active, user?.uid, onBarcodeScanned]);

  return (
    <div
      className={`flex flex-col items-center justify-center h-full p-6 space-y-6 ${
        active ? 'block' : 'hidden'
      }`}
    >
      <div
        id="reader"
        className="w-full aspect-square bg-black rounded-3xl overflow-hidden shadow-inner border-2 border-gray-200 relative"
      >
        {!isProcessing && !cameraError && (
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

      {isProcessing ? (
        <div className="flex items-center gap-2 text-green-700">
          <Loader2 size={24} className="animate-spin" />

          <p className="font-bold">
            Barcode captured...
          </p>
        </div>
      ) : (
        <p className="text-gray-500 font-medium text-center">
          Point your camera at a barcode. It will scan automatically.
        </p>
      )}
    </div>
  );
}

export default ScanPage;