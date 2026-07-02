import React from 'react';
import { User } from 'lucide-react';

export default function ProfilePage() {
  return (
    <div className="p-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-700 mb-4">
          <User size={40} />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Shopper Profile</h2>
        <p className="text-sm text-gray-500 mt-2 text-center">
          Profile details will go here.
        </p>
      </div>
    </div>
  );
}