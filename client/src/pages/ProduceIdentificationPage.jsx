import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Loader2,
  RotateCcw,
  ShoppingCart,
} from 'lucide-react';

import { db } from '../Firebase';
import ProductCandidateList from '../components/product/ProductCandidateList';
import QuantitySelector from '../components/product/QuantitySelector';
import { identifyLooseProduce } from '../services/produceRecognitionApiService';

const appId = 'dunnes-trolley';
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

function ProduceIdentificationPage({ user, onCancel, onProductAdded }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [recognition, setRecognition] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const numericPrice = Number(String(price).replace(',', '.'));
  const subtotal = useMemo(() => {
    return Number.isFinite(numericPrice) ? numericPrice * quantity : 0;
  }, [numericPrice, quantity]);

  const resetPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setRecognition(null);
    setMatches([]);
    setSelectedProduct(null);
    setPrice('');
    setQuantity(1);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!allowedImageTypes.includes(file.type)) {
      setError('Please select a JPEG, PNG or WebP image.');
      event.target.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('The photo must be smaller than 8 MB.');
      event.target.value = '';
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setRecognition(null);
    setMatches([]);
    setSelectedProduct(null);
    setPrice('');
    setError('');
    setAnalysing(true);

    try {
      const result = await identifyLooseProduce(user, file);
      setRecognition(result.recognition);
      setMatches(result.matches);

      if (result.recognition?.needsBetterPhoto) {
        setError(
          result.recognition.message ||
            'Take another photo with one item centred in good lighting.',
        );
      } else if (result.matches.length === 0) {
        setError('The item was recognised, but no matching Dunnes product was found.');
      }
    } catch (photoError) {
      setError(photoError.message || 'The produce photo could not be analysed.');
    } finally {
      setAnalysing(false);
    }
  };

  const selectMatch = (candidate) => {
    const candidatePrice = Number(candidate.price);
    setSelectedProduct(candidate);
    setPrice(
      Number.isFinite(candidatePrice) && candidatePrice > 0
        ? candidatePrice.toFixed(2)
        : '',
    );
    setError('');
  };

  const addToCart = async () => {
    if (!selectedProduct) {
      setError('Select the matching Dunnes product first.');
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('Enter a valid price.');
      return;
    }

    const sku = String(selectedProduct.dunnesSku || '').trim();
    if (!sku) {
      setError('The selected product does not have a Dunnes SKU.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const cartItemRef = doc(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'cart',
        `loose-${sku}`,
      );

      const promotions = Array.isArray(selectedProduct.promotions)
        ? selectedProduct.promotions
        : [];

      await setDoc(
        cartItemRef,
        {
          barcode: '',
          dunnesSku: sku,
          name: selectedProduct.name || recognition?.itemName || 'Loose produce',
          brand: selectedProduct.brand || '',
          imageUrl: selectedProduct.imageUrl || previewUrl,
          price: numericPrice,
          quantity: increment(quantity),
          productType: 'loose-produce',
          recognitionName: recognition?.itemName || '',
          recognitionConfidence: Number(recognition?.confidence || 0),
          source: 'produce-photo-ai',
          originalSource: 'dunnes-live-search',
          promotions,
          hasPromotion: promotions.length > 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      onProductAdded();
    } catch (saveError) {
      setError(saveError.message || 'The produce item could not be added.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handlePhoto}
        className="hidden"
      />

      <button
        type="button"
        onClick={onCancel}
        disabled={analysing || saving}
        className="flex items-center gap-2 font-semibold text-gray-600 disabled:opacity-50"
      >
        <ArrowLeft size={20} />
        Back to scanner
      </button>

      <div className="mt-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-700">
            <Camera size={28} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Identify a loose item</h1>
          <p className="mt-2 text-sm text-gray-600">
            Photograph one fruit or vegetable in good lighting. We will identify it and find matching Dunnes products.
          </p>
        </div>

        {!previewUrl && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3 font-bold text-white"
          >
            <Camera size={20} />
            Take a photo
          </button>
        )}

        {previewUrl && (
          <div className="mt-6">
            <img
              src={previewUrl}
              alt="Loose produce"
              className="max-h-72 w-full rounded-2xl border border-gray-200 bg-gray-50 object-contain"
            />

            {analysing && (
              <div className="mt-5 flex flex-col items-center" role="status">
                <Loader2 size={34} className="animate-spin text-green-700" />
                <p className="mt-3 font-semibold text-gray-700">Identifying item and searching Dunnes...</p>
              </div>
            )}

            {!analysing && (
              <button
                type="button"
                onClick={resetPhoto}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700"
              >
                <RotateCcw size={18} />
                Take another photo
              </button>
            )}
          </div>
        )}

        {recognition?.recognised && !recognition.needsBetterPhoto && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-gray-600">Recognised item</p>
            <p className="mt-1 text-lg font-bold capitalize text-green-800">
              {[recognition.variety, recognition.itemName].filter(Boolean).join(' ')}
            </p>
            <p className="mt-1 text-xs text-green-700">
              {Math.round(Number(recognition.confidence || 0) * 100)}% confidence
            </p>
          </div>
        )}

        {!selectedProduct && matches.length > 0 && (
          <ProductCandidateList
            candidates={matches}
            disabled={analysing || saving}
            onSelect={selectMatch}
            onManualEntry={resetPhoto}
            manualEntryLabel="None of these, take another photo"
          />
        )}

        {selectedProduct && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <div className="flex gap-4">
              {selectedProduct.imageUrl ? (
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="h-24 w-24 rounded-xl bg-white object-contain"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-white">
                  <ImagePlus size={28} className="text-gray-400" />
                </div>
              )}
              <div>
                <p className="font-bold text-gray-900">{selectedProduct.name}</p>
                <p className="mt-1 text-sm text-gray-600">Dunnes SKU: {selectedProduct.dunnesSku}</p>
                {selectedProduct.unitPrice && (
                  <p className="mt-1 text-sm text-gray-600">{selectedProduct.unitPrice}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedProduct && (
          <>
            <div className="mt-6">
              <label htmlFor="produce-price" className="mb-2 block text-center text-sm font-semibold text-gray-700">
                Shelf price
              </label>
              <div className="relative mx-auto max-w-44">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">€</span>
                <input
                  id="produce-price"
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (/^\d*[.,]?\d{0,2}$/.test(value)) setPrice(value);
                  }}
                  disabled={saving}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-center text-xl font-bold text-green-700 outline-none focus:border-green-600"
                />
              </div>
            </div>

            <QuantitySelector
              quantity={quantity}
              disabled={saving}
              onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
              onIncrease={() => setQuantity((value) => value + 1)}
            />

            <div className="mt-6 flex items-center justify-between border-y border-gray-100 py-4">
              <span className="font-semibold text-gray-600">Subtotal</span>
              <span className="text-2xl font-bold text-gray-900">€{subtotal.toFixed(2)}</span>
            </div>
          </>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {selectedProduct && (
          <button
            type="button"
            onClick={addToCart}
            disabled={saving || analysing}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-4 font-bold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <ShoppingCart size={20} />}
            {saving ? 'Adding...' : 'Add to trolley'}
          </button>
        )}
      </div>
    </div>
  );
}

export default ProduceIdentificationPage;
