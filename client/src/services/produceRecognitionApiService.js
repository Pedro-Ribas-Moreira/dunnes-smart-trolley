import { createApiUrl } from '../config/api';

async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error('The backend returned an invalid response.');
  }

  return response.json();
}

export async function identifyLooseProduce(user, imageFile) {
  if (!user) {
    throw new Error('You must be signed in to identify produce.');
  }

  if (!imageFile) {
    throw new Error('Please take or select a produce photo.');
  }

  const token = await user.getIdToken();
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch(createApiUrl('/api/product-matching/produce'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await readApiResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'The produce photo could not be analysed.');
  }

  return {
    recognition: data.recognition || null,
    matches: Array.isArray(data.matches) ? data.matches : [],
  };
}
