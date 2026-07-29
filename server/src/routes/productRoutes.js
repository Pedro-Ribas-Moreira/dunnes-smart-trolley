import express from 'express';

import {
  findOpenFoodFactsProduct,
} from '../services/openFoodFactsService.js';

const router = express.Router();

function cleanBarcode(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidBarcode(barcode) {
  return [8, 12, 13, 14].includes(
    barcode.length,
  );
}

router.get('/:barcode', async (request, response) => {
  const barcode = cleanBarcode(
    request.params.barcode,
  );

  if (!isValidBarcode(barcode)) {
    return response.status(400).json({
      success: false,
      error:
        'The barcode must contain 8, 12, 13 or 14 digits.',
    });
  }

  try {
    const product =
      await findOpenFoodFactsProduct(barcode);

    if (!product) {
      return response.json({
        success: true,
        found: false,
        barcode,
        manualEntryRequired: true,
      });
    }

    return response.json({
      success: true,
      found: true,
      source: product.source,
      product,
      manualEntryRequired: false,
    });
  } catch (error) {
    console.error(
      'Product lookup failed:',
      error,
    );

    return response.status(502).json({
      success: false,
      found: false,
      barcode,
      error:
        error.message ||
        'The product lookup failed.',
      manualEntryRequired: true,
    });
  }
});

export default router;