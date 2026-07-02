import React from 'react';
import { ShoppingCart } from 'lucide-react';

export default function CartPage() {
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Your Shopping Cart</h2>
      
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <ShoppingCart size={48} className="mb-4 opacity-50" />
        <p>Your cart is empty.</p>
        <p className="text-sm mt-1">Scan items to start your shop.</p>
      </div>
    </div>
  );
}