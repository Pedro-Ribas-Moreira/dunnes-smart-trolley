import express from 'express';

import {
  authenticateUser,
} from '../middleware/authenticateUser.js';

import {
  getDunnesProductBySku,
} from '../services/dunnesStorefrontService.js';

const router = express.Router();

function isValidSku(value) {
  return /^\d{6,15}$/.test(
    String(value || '').trim(),
  );
}

function isValidStoreId(value) {
  return /^\d{1,10}$/.test(
    String(value || '').trim(),
  );
}

router.get(
  '/products/:sku',
  authenticateUser,
  async (request, response) => {
    const sku = String(
      request.params.sku || '',
    ).trim();

    const storeId = String(
      request.query.storeId || '258',
    ).trim();

    if (!isValidSku(sku)) {
      return response.status(400).json({
        success: false,
        found: false,
        error:
          'A valid numeric Dunnes SKU is required.',
      });
    }

    if (!isValidStoreId(storeId)) {
      return response.status(400).json({
        success: false,
        found: false,
        error:
          'A valid Dunnes store ID is required.',
      });
    }

    try {
      const product =
        await getDunnesProductBySku(
          sku,
          storeId,
        );

      if (!product) {
        return response.status(404).json({
          success: false,
          found: false,
          error:
            'The Dunnes product was not found.',
        });
      }

      return response.json({
        success: true,
        found: true,
        product,
      });
    } catch (error) {
      console.error(
        'Dunnes product lookup failed:',
        {
          sku,
          storeId,
          message: error.message,
        },
      );

      return response
        .status(error.statusCode || 502)
        .json({
          success: false,
          found: false,
          error:
            error.message ||
            'The Dunnes product service is unavailable.',
        });
    }
  },
);

export default router;