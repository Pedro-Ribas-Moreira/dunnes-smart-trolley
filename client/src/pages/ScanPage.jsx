import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../Firebase';
import { ScanLine } from 'lucide-react';

const appId = 'dunnes-trolley';
const READER_ID = 'barcode-reader';

const PRODUCTS = {
  501234567890: { name: "Brennan's Sliced Pan", price: 1.95 },
  509876543210: { name: 'Avonmore Fresh Milk 2L', price: 2.29 },
};

export default function ScanPage({ user }) {
  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);

  const stopScan = async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      await scanner.stop().catch(() => {});
      scanner.clear();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleDecoded = async (barcode) => {
    await stopScan();
    const product = PRODUCTS[barcode] || { name: `Unknown item (${barcode})`, price: 0 };
    setLastScanned(product.name);
    if (user) {
      await setDoc(doc(collection(db, 'artifacts', appId, 'users', user.uid, 'cart')), {
        ...product,
        barcode,
        addedAt: new Date().toISOString(),
      });
    }
  };

  const startScan = async () => {
    setLastScanned(null);
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    setIsScanning(true);
    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.85);
            const height = Math.floor(width * 0.35);
            return { width, height };
          },
        },
        handleDecoded,
        () => {},
      );
    } catch (err) {
      console.error('Camera start failed:', err);
      setIsScanning(false);
    }
  };

  useEffect(
    () => () => {
      stopScan();
    },
    [],
  );

  return (
    <div className='flex flex-col items-center justify-center h-full text-gray-500 p-6 space-y-6'>
      <div
        id={READER_ID}
        className='w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden relative [&_video]:!absolute [&_video]:!inset-0 [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover'
      />
      {lastScanned && <p className='text-green-700 font-semibold'>Added: {lastScanned}</p>}
      <button
        onClick={isScanning ? stopScan : startScan}
        className='w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all active:scale-95'
      >
        <ScanLine size={24} />
        {isScanning ? 'Stop Scanning' : 'Start Scanning'}
      </button>
    </div>
  );
}
