import { useState } from 'react';
import { deleteDoc, doc, increment, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { db } from '../Firebase';
const appId = 'dunnes-trolley';

export default function CartPage({ cartItems, user }) {
  const [updatingItemId, setUpdatingItemId] = useState('');
  const [error, setError] = useState('');

  const getCartItemRef = (itemId) => {
    return doc(db, 'artifacts', appId, 'users', user.uid, 'cart', itemId);
  };

  const increaseQuantity = async (item) => {
    if (!user?.uid) {
      return;
    }

    setUpdatingItemId(item.id);
    setError('');

    try {
      await updateDoc(getCartItemRef(item.id), {
        quantity: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (updateError) {
      console.error('Increase quantity error:', updateError);
      setError('The quantity could not be updated.');
    } finally {
      setUpdatingItemId('');
    }
  };

  const decreaseQuantity = async (item) => {
    if (!user?.uid) {
      return;
    }

    setUpdatingItemId(item.id);
    setError('');

    try {
      const quantity = Number(item.quantity || 1);
      const itemRef = getCartItemRef(item.id);

      if (quantity <= 1) {
        await deleteDoc(itemRef);
      } else {
        await updateDoc(itemRef, {
          quantity: increment(-1),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (updateError) {
      console.error('Decrease quantity error:', updateError);
      setError('The quantity could not be updated.');
    } finally {
      setUpdatingItemId('');
    }
  };

  const removeItem = async (item) => {
    if (!user?.uid) {
      return;
    }

    const confirmed = window.confirm(`Remove ${item.name} from your cart?`);

    if (!confirmed) {
      return;
    }

    setUpdatingItemId(item.id);
    setError('');

    try {
      await deleteDoc(getCartItemRef(item.id));
    } catch (deleteError) {
      console.error('Remove item error:', deleteError);
      setError('The item could not be removed.');
    } finally {
      setUpdatingItemId('');
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className='p-4'>
        <h2 className='text-lg font-bold text-gray-800 mb-4'>Your Shopping Cart</h2>

        <div className='flex flex-col items-center justify-center h-64 text-gray-500'>
          <ShoppingCart size={48} className='mb-4 opacity-50' />

          <p>Your cart is empty.</p>

          <p className='text-sm mt-1'>Scan items to start your shop.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='p-4'>
      <h2 className='text-lg font-bold text-gray-800 mb-4'>Your Shopping Cart</h2>

      {error && (
        <div className='mb-4 bg-red-50 border border-red-200 rounded-xl p-3'>
          <p className='text-sm text-red-700 text-center'>{error}</p>
        </div>
      )}

      <div className='space-y-3'>
        {cartItems.map((item) => {
          const price = Number(item.price || 0);
          const quantity = Number(item.quantity || 1);
          const subtotal = price * quantity;
          const isUpdating = updatingItemId === item.id;

          return (
            <div key={item.id} className='bg-white p-4 rounded-2xl border border-gray-100 shadow-sm'>
              <div className='flex gap-3'>
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className='w-16 h-16 rounded-xl object-contain border border-gray-100'
                  />
                ) : (
                  <div className='w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400 text-center'>
                    No image
                  </div>
                )}

                <div className='flex-1 min-w-0'>
                  {item.brand && <p className='text-xs text-gray-500'>{item.brand}</p>}

                  <h3 className='font-semibold text-gray-800'>{item.name}</h3>

                  <p className='text-sm text-gray-500 mt-1'>€{price.toFixed(2)} each</p>
                </div>

                <button
                  type='button'
                  onClick={() => removeItem(item)}
                  disabled={isUpdating}
                  aria-label={`Remove ${item.name}`}
                  className='self-start p-2 text-red-500 bg-red-50 rounded-lg disabled:opacity-50'
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className='flex items-center justify-between mt-4 pt-4 border-t border-gray-100'>
                <div className='flex items-center gap-3'>
                  <button
                    type='button'
                    onClick={() => decreaseQuantity(item)}
                    disabled={isUpdating}
                    aria-label={`Reduce quantity of ${item.name}`}
                    className='w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center disabled:opacity-50'
                  >
                    <Minus size={18} />
                  </button>

                  <div className='w-8 text-center'>
                    {isUpdating ? (
                      <Loader2 size={18} className='animate-spin mx-auto text-green-700' />
                    ) : (
                      <span className='text-lg font-bold text-gray-800'>{quantity}</span>
                    )}
                  </div>

                  <button
                    type='button'
                    onClick={() => increaseQuantity(item)}
                    disabled={isUpdating}
                    aria-label={`Increase quantity of ${item.name}`}
                    className='w-10 h-10 bg-green-100 text-green-700 rounded-xl flex items-center justify-center disabled:opacity-50'
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <div className='text-right'>
                  <p className='text-xs text-gray-500'>Subtotal</p>

                  <p className='text-lg font-bold text-green-700'>€{subtotal.toFixed(2)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
