import express from 'express';

import {
  authenticateUser,
} from '../middleware/authenticateUser.js';

import {
  importDunnesListing,
  importDunnesListings,
} from '../services/dunnesImportService.js';

import {
  getDunnesProductBySku,
} from '../services/dunnesStorefrontService.js';

import {
  crawlDunnesCatalogue,
} from '../services/dunnesCatalogueCrawlerService.js';

const router = express.Router();

const MAX_LISTINGS_PER_REQUEST = 25;

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

function isValidListingId(value) {
  return /^[a-zA-Z0-9-]{10,100}$/.test(
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
          message:
            error.message,
        },
      );

      return response
        .status(
          error.statusCode || 502,
        )
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
router.post(
  '/crawl-catalogue',
  authenticateUser,
  async (request, response) => {
    const seedSkus =
      request.body?.seedSkus;

    const storeId = String(
      request.body?.storeId || '258',
    ).trim();

    const maxProducts = Number(
      request.body?.maxProducts ||
        300,
    );

    if (
      !Array.isArray(seedSkus) ||
      seedSkus.length === 0
    ) {
      return response.status(400).json({
        success: false,

        error:
          'At least one seed SKU is required.',
      });
    }

    if (
      seedSkus.length > 20
    ) {
      return response.status(400).json({
        success: false,

        error:
          'A maximum of 20 seed SKUs is allowed.',
      });
    }

    const cleanedSeedSkus =
      seedSkus.map((sku) =>
        String(sku || '').trim(),
      );

    const invalidSkus =
      cleanedSeedSkus.filter(
        (sku) =>
          !isValidSku(sku),
      );

    if (
      invalidSkus.length > 0
    ) {
      return response.status(400).json({
        success: false,

        error:
          'One or more seed SKUs are invalid.',

        invalidSkus,
      });
    }

    if (
      !isValidStoreId(storeId)
    ) {
      return response.status(400).json({
        success: false,

        error:
          'A valid Dunnes store ID is required.',
      });
    }

    if (
      !Number.isInteger(
        maxProducts,
      ) ||
      maxProducts < 1 ||
      maxProducts > 2000
    ) {
      return response.status(400).json({
        success: false,

        error:
          'maxProducts must be between 1 and 2000.',
      });
    }

    try {
      const result =
        await crawlDunnesCatalogue({
          seedSkus:
            cleanedSeedSkus,

          storeId,

          maxProducts,
        });

      return response.status(201).json({
        success: true,

        crawl: result,
      });
    } catch (error) {
      console.error(
        'Dunnes catalogue crawl failed:',
        {
          seedSkus:
            cleanedSeedSkus,

          storeId,

          maxProducts,

          message:
            error.message,
        },
      );

      return response
        .status(
          error.statusCode || 500,
        )
        .json({
          success: false,

          error:
            error.message ||
            'The Dunnes catalogue crawl failed.',
        });
    }
  },
);
router.post(
  '/import-listing',
  authenticateUser,
  async (request, response) => {
    const listingId = String(
      request.body?.listingId || '',
    ).trim();

    const storeId = String(
      request.body?.storeId || '258',
    ).trim();

    if (
      !isValidListingId(
        listingId,
      )
    ) {
      return response.status(400).json({
        success: false,
        error:
          'A valid Dunnes listing ID is required.',
      });
    }

    if (
      !isValidStoreId(storeId)
    ) {
      return response.status(400).json({
        success: false,
        error:
          'A valid Dunnes store ID is required.',
      });
    }

    try {
      const result =
        await importDunnesListing({
          listingId,
          storeId,
        });

      return response.status(201).json({
        success: true,
        import: result,
      });
    } catch (error) {
      console.error(
        'Dunnes listing import failed:',
        {
          listingId,
          storeId,
          message:
            error.message,
        },
      );

      return response
        .status(
          error.statusCode || 500,
        )
        .json({
          success: false,
          error:
            error.message ||
            'The Dunnes listing could not be imported.',
        });
    }
  },
);

router.post(
  '/import-listings',
  authenticateUser,
  async (request, response) => {
    const listingIds =
      request.body?.listingIds;

    const storeId = String(
      request.body?.storeId || '258',
    ).trim();

    if (
      !Array.isArray(
        listingIds,
      ) ||
      listingIds.length === 0
    ) {
      return response.status(400).json({
        success: false,
        error:
          'At least one Dunnes listing ID is required.',
      });
    }

    if (
      listingIds.length >
      MAX_LISTINGS_PER_REQUEST
    ) {
      return response.status(400).json({
        success: false,
        error:
          `A maximum of ${MAX_LISTINGS_PER_REQUEST} listings can be imported per request.`,
      });
    }

    const cleanedListingIds =
      listingIds.map(
        (listingId) =>
          String(
            listingId || '',
          ).trim(),
      );

    const invalidListingIds =
      cleanedListingIds.filter(
        (listingId) =>
          !isValidListingId(
            listingId,
          ),
      );

    if (
      invalidListingIds.length >
      0
    ) {
      return response.status(400).json({
        success: false,
        error:
          'One or more Dunnes listing IDs are invalid.',
        invalidListingIds,
      });
    }

    if (
      !isValidStoreId(storeId)
    ) {
      return response.status(400).json({
        success: false,
        error:
          'A valid Dunnes store ID is required.',
      });
    }

    try {
      const result =
        await importDunnesListings({
          listingIds:
            cleanedListingIds,
          storeId,
        });

      return response.status(201).json({
        success: true,
        import: result,
      });
    } catch (error) {
      console.error(
        'Multiple Dunnes listing import failed:',
        {
          storeId,
          listingCount:
            cleanedListingIds.length,
          message:
            error.message,
        },
      );

      return response
        .status(
          error.statusCode || 500,
        )
        .json({
          success: false,
          error:
            error.message ||
            'The Dunnes listings could not be imported.',
        });
    }
  },
);

export default router;