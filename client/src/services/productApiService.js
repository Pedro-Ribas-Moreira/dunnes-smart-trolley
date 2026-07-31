import { createApiUrl } from '../config/api';

async function readApiResponse(response) {
  const contentType =
    response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(
      'The backend returned an invalid response.',
    );
  }

  return response.json();
}

export async function lookupProduct(
  barcode,
  signal,
) {
  const response = await fetch(
    createApiUrl(
      `/api/products/${encodeURIComponent(barcode)}`,
    ),
    {
      method: 'GET',
      signal,
      headers: {
        Accept: 'application/json',
      },
    },
  );

  const data = await readApiResponse(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        'The product lookup failed.',
    );
  }

  return data;
}

export async function saveProductViaApi(
  product,
  user,
) {
  if (!user) {
    throw new Error(
      'You must be signed in to save a product.',
    );
  }

  const idToken = await user.getIdToken(true);

  console.log('Saving product through backend', {
    endpoint: createApiUrl('/api/products'),
    barcode: product.barcode,
    userId: user.uid,
    hasToken: Boolean(idToken),
  });

  const response = await fetch(
    createApiUrl('/api/products'),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(product),
    },
  );

  const data = await readApiResponse(response);

  console.log('Product backend response', {
    status: response.status,
    success: data.success,
    error: data.error,
    errors: data.errors,
  });

  if (!response.ok) {
    const validationMessage =
      Array.isArray(data.errors)
        ? data.errors.join(' ')
        : '';

    throw new Error(
      validationMessage ||
        data.error ||
        'The product could not be saved.',
    );
  }

  return data.product;
}