const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '';

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

export async function matchProductPhoto(
  user,
  imageFile,
) {
  if (!user) {
    throw new Error(
      'You must be signed in to identify a product.',
    );
  }

  if (!imageFile) {
    throw new Error(
      'Please select or take a product photo.',
    );
  }

  const idToken =
    await user.getIdToken(true);

  const formData = new FormData();

  formData.append(
    'image',
    imageFile,
  );

  const response = await fetch(
    `${API_BASE_URL}/api/product-matching/photo`,
    {
      method: 'POST',

      headers: {
        Accept: 'application/json',
        Authorization:
          `Bearer ${idToken}`,
      },

      body: formData,
    },
  );

  const data =
    await readApiResponse(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        'The product photo could not be analysed.',
    );
  }

  return {
    label: data.label || null,

    matches: Array.isArray(data.matches)
      ? data.matches
      : [],

    catalogueProductsChecked:
      Number(
        data.catalogueProductsChecked || 0,
      ),
  };
}