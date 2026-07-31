const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '';

export async function importDunnesListing(
  user,
  listingId,
  storeId = '258',
) {
  if (!user) {
    throw new Error(
      'You must be signed in.',
    );
  }

  const idToken =
    await user.getIdToken(true);

  const response = await fetch(
    `${API_BASE_URL}/api/dunnes/import-listing`,
    {
      method: 'POST',

      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization:
          `Bearer ${idToken}`,
      },

      body: JSON.stringify({
        listingId,
        storeId,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        'The Dunnes listing could not be imported.',
    );
  }

  return data.import;
}

export async function crawlDunnesCatalogue(
  user,
  {
    seedSkus,
    storeId = '258',
    maxProducts = 100,
  },
) {
  if (!user) {
    throw new Error(
      'You must be signed in to crawl the catalogue.',
    );
  }

  const token =
    await user.getIdToken(true);

  const response = await fetch(
    `${API_BASE_URL}/api/dunnes/crawl-catalogue`,
    {
      method: 'POST',

      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        seedSkus,
        storeId,
        maxProducts,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        'The Dunnes catalogue crawl failed.',
    );
  }

  return data.crawl;
}