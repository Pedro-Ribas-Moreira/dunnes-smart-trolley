import express from 'express';

import {
  authenticateUser,
} from '../middleware/authenticateUser.js';

import {
  findOpenFoodFactsProduct,
} from '../services/openFoodFactsService.js';

import {
  findSavedProduct,
  saveCatalogueProduct,
} from '../services/productCatalogueService.js';

import {
  findDunnesCandidates,
} from '../services/dunnesCatalogueMatchService.js';

import {
  rankDunnesCandidates,
} from '../services/productMatchingAgentService.js';

const router = express.Router();

function cleanBarcode(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidBarcode(barcode) {
  return [8, 12, 13, 14].includes(
    barcode.length,
  );
}

function parsePrice(value) {
  const normalizedValue = String(value)
    .trim()
    .replace(',', '.');

  if (!normalizedValue) {
    return Number.NaN;
  }

  return Number(normalizedValue);
}

function validateProduct(requestBody) {
  const barcode = cleanBarcode(
    requestBody.barcode,
  );

  const name = String(
    requestBody.name || '',
  ).trim();

  const brand = String(
    requestBody.brand || '',
  ).trim();

  const imageUrl = String(
    requestBody.imageUrl || '',
  ).trim();

  const source = String(
    requestBody.source || 'manual',
  ).trim();

  const dunnesSku = String(
    requestBody.dunnesSku || '',
  ).trim();

  const matchMethod = String(
    requestBody.matchMethod || '',
  ).trim();

  const matchConfidence = Number(
    requestBody.matchConfidence,
  );

  const price = parsePrice(
    requestBody.price,
  );

  const errors = [];

  if (!isValidBarcode(barcode)) {
    errors.push(
      'The barcode must contain 8, 12, 13 or 14 digits.',
    );
  }

  if (!name) {
    errors.push(
      'The product name is required.',
    );
  }

  if (name.length > 200) {
    errors.push(
      'The product name is too long.',
    );
  }

  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    errors.push(
      'The product price must be greater than zero.',
    );
  }
  if (dunnesSku && !/^\d{6,15}$/.test(dunnesSku)) {
    errors.push(
      'The Dunnes SKU must be a numeric SKU between 6 and 15 digits.',
    );
  }

  if (
    requestBody.matchConfidence != null &&
    (!Number.isFinite(matchConfidence) ||
      matchConfidence < 0 ||
      matchConfidence > 1)
  ) {
    errors.push(
      'matchConfidence must be a number between 0 and 1.',
    );
  }
  if (price > 10000) {
    errors.push(
      'The product price is too high.',
    );
  }

  return {
    errors,
    product: {
      barcode,
      name,
      brand,
      imageUrl,
      price,
      source,
      originalSource: source,
      dunnesSku,
      matchMethod,
      matchConfidence,
    },
  };
}

router.get(
  '/:barcode',
  async (request, response) => {
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
      const savedProduct =
        await findSavedProduct(barcode);

      if (savedProduct) {
        return response.json({
          success: true,
          found: true,
          source: 'firebase',
          product: savedProduct,
          manualEntryRequired: false,
        });
      }

      const openFoodFactsProduct =
        await findOpenFoodFactsProduct(
          barcode,
        );

      if (!openFoodFactsProduct) {
        return response.json({
          success: true,
          found: false,
          barcode,
          source: null,
          manualEntryRequired: true,
        });
      }

      const dunnesCandidates =
        await findDunnesCandidates(
          openFoodFactsProduct,
        );

      const rankedCandidates =
        await rankDunnesCandidates({
          externalProduct:
            openFoodFactsProduct,
          candidates: dunnesCandidates,
        });

      return response.json({
        success: true,
        found: true,
        source: 'open-food-facts',
        product: openFoodFactsProduct,
        manualEntryRequired: false,
        confirmationRequired: true,
        dunnesCandidates: rankedCandidates.matches,
        noReliableMatch:
          rankedCandidates.noReliableMatch,
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
  },
);

router.post(
  '/',
  authenticateUser,
  async (request, response) => {
    const {
      errors,
      product,
    } = validateProduct(request.body);

    if (errors.length > 0) {
      return response.status(400).json({
        success: false,
        errors,
      });
    }

    try {
      const savedProduct =
        await saveCatalogueProduct(
          product,
          request.user.uid,
        );

      return response.status(201).json({
        success: true,
        message:
          'The product was saved successfully.',
        product: savedProduct,
      });
    } catch (error) {
      console.error(
        'Product save failed:',
        error,
      );

      return response.status(500).json({
        success: false,
        error:
          'The product could not be saved.',
      });
    }
  },
);

export default router;