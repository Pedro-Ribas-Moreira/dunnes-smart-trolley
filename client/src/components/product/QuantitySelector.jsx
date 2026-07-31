import { Minus, Plus } from 'lucide-react';

function QuantitySelector({ quantity, disabled, onDecrease, onIncrease }) {
  return (
    <div className="mt-8">
      <p className="mb-3 text-sm font-semibold text-gray-700">Quantity</p>

      <div className="flex items-center justify-between rounded-2xl bg-gray-100 p-2">
        <button
          type="button"
          onClick={onDecrease}
          disabled={disabled}
          aria-label="Decrease quantity"
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm disabled:opacity-50"
        >
          <Minus size={22} />
        </button>

        <span className="text-2xl font-bold text-gray-800">{quantity}</span>

        <button
          type="button"
          onClick={onIncrease}
          disabled={disabled}
          aria-label="Increase quantity"
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm disabled:opacity-50"
        >
          <Plus size={22} />
        </button>
      </div>
    </div>
  );
}

export default QuantitySelector;
