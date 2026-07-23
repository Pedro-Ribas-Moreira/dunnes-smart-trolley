import React from 'react';
import { ShoppingCart } from 'lucide-react';

export default function CartPage({ cartItems }) {
  if (cartItems.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          Your Shopping Cart
        </h2>

        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <ShoppingCart
            size={48}
            className="mb-4 opacity-50"
          />

          <p>Your cart is empty.</p>

          <p className="text-sm mt-1">
            Scan items to start your shop.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">
        Your Shopping Cart
      </h2>

      <div className="space-y-3">
        {cartItems.map((item) => {
          const price = Number(item.price || 0);
          const quantity = Number(item.quantity || 1);
          const subtotal = price * quantity;

          return (
            <div
              key={item.id}
              className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
            >
              <div className="flex gap-3">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-contain border border-gray-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400 text-center">
                    No image
                  </div>
                )}

                <div className="flex-1">
                  {item.brand && (
                    <p className="text-xs text-gray-500">
                      {item.brand}
                    </p>
                  )}

                  <h3 className="font-semibold text-gray-800">
                    {item.name}
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    €{price.toFixed(2)} × {quantity}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-green-700">
                    €{subtotal.toFixed(2)}
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    Qty: {quantity}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}