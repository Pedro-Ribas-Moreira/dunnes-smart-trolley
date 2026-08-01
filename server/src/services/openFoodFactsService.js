export async function findOpenFoodFactsProduct(barcode) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        barcode,
      )}.json`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'DunnesSmartTrolleyCollegeProject/1.0',
        },
      },
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(
        `Open Food Facts returned status ${response.status}`,
      );
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return null;
    }

    const productName =
      data.product.product_name?.trim() ||
      data.product.product_name_en?.trim() ||
      data.product.generic_name?.trim() ||
      data.product.generic_name_en?.trim() ||
      '';

    if (!productName) {
      return null;
    }

    return {
      barcode,
      name: productName,
      brand: data.product.brands || '',
      quantity: data.product.quantity || '',
      categories: Array.isArray(data.product.categories_tags)
        ? data.product.categories_tags.map((category) =>
            String(category || '').replace(/^en:/, ''),
          )
        : typeof data.product.categories === 'string'
        ? data.product.categories.split(',').map((category) => category.trim())
        : [],
      genericName:
        data.product.generic_name ||
        data.product.generic_name_en ||
        '',
      imageUrl:
        data.product.image_front_small_url ||
        data.product.image_url ||
        '',
      price: null,
      source: 'open-food-facts',
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'The product lookup took too long.',
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}