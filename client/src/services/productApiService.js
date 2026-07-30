const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3001';

export async function lookupProduct(barcode, signal) {
  const response = await fetch(
    `${API_BASE_URL}/api/products/${encodeURIComponent(
      barcode,
    )}`,
    {
      signal,
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || 'The product lookup failed.',
    );
  }

  return data;
}