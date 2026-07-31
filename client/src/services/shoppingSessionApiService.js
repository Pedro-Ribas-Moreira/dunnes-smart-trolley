const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '';

async function readApiResponse(response) {
  const contentType =
    response.headers.get(
      'content-type',
    ) || '';

  if (
    !contentType.includes(
      'application/json',
    )
  ) {
    throw new Error(
      'The backend returned an invalid response.',
    );
  }

  return response.json();
}

async function getUserToken(user) {
  if (!user) {
    throw new Error(
      'You must be signed in.',
    );
  }

  return user.getIdToken(true);
}

export async function finishShoppingSession(
  user,
) {
  const idToken =
    await getUserToken(user);

  const response = await fetch(
    `${API_BASE_URL}/api/shopping-sessions/finish`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization:
          `Bearer ${idToken}`,
      },
    },
  );

  const data =
    await readApiResponse(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        'The shopping session could not be completed.',
    );
  }

  return data.session;
}

export async function loadShoppingSessions(
  user,
) {
  const idToken =
    await getUserToken(user);

  const response = await fetch(
    `${API_BASE_URL}/api/shopping-sessions`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization:
          `Bearer ${idToken}`,
      },
    },
  );

  const data =
    await readApiResponse(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        'The shopping history could not be loaded.',
    );
  }

  return Array.isArray(data.sessions)
    ? data.sessions
    : [];
}