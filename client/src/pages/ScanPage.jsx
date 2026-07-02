import React from 'react';
import { ScanLine } from 'lucide-react';

export default function ScanPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-6 space-y-6">
      <ScanLine size={48} className="mb-4 opacity-50" />
      <p>Scanner component will go here</p>
            <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2">
        <ScanLine size={24} />
        Scanner
      </button>
    </div>
  );
}