import React from 'react';
import { ShoppingCart } from 'lucide-react';

export default function CartPage({ cartItems }) {
  return (
    <div className='p-4'>
      <h2 className='text-lg font-bold text-gray-800 mb-4'>
        Your Shopping Cart
      </h2>

      {cartItems.length === 0 ? (
        <div className='flex flex-col items-center justify-center h-64 text-gray-500'>
          <ShoppingCart size={48} className='mb-4 opacity-50' />

          <p>Your cart is empty.</p>

          <p className='text-sm mt-1'>
            Scan items to start your shop.
          </p>
        </div>
      ) : (
        <div className='space-y-3'>
          {cartItems.map((item) => (
            <div
              key={item.id}
              className='bg-white p-4 rounded-xl border border-gray-100 flex justify-between'
            >
              <span className='font-semibold'>
                {item.name}
              </span>

              <span className='font-bold text-green-700'>
                €{Number(item.price || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}