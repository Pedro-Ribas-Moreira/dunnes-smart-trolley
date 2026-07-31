import express from 'express';
import multer from 'multer';

import {
  authenticateUser,
} from '../middleware/authenticateUser.js';

import {
  matchProductPhoto,
} from '../services/productPhotoMatchService.js';

import { identifyLooseProduce } from '../services/produceRecognitionService.js';

const router = express.Router();

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (
    request,
    file,
    callback,
  ) => {
    if (
      !allowedMimeTypes.has(
        file.mimetype,
      )
    ) {
      callback(
        new Error(
          'Only JPEG, PNG and WebP images are supported.',
        ),
      );

      return;
    }

    callback(null, true);
  },
});

router.post(
  '/photo',

  authenticateUser,

  upload.single('image'),

  async (request, response) => {
    if (!request.file) {
      return response.status(400).json({
        success: false,

        error:
          'A product photo is required.',
      });
    }

    try {
      const result =
        await matchProductPhoto({
          imageBuffer:
            request.file.buffer,

          mimeType:
            request.file.mimetype,
        });

      return response.json({
        success: true,

        label: result.label,

        matches: result.matches,

        catalogueProductsChecked:
          result.catalogueProductsChecked,
      });
    } catch (error) {
      console.error(
        'Product photo matching failed:',
        {
          message: error.message,

          userId:
            request.user?.uid || null,

          mimeType:
            request.file?.mimetype,

          size:
            request.file?.size,
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
            'The product photo could not be analysed.',
        });
    }
  },
);


router.post(
  '/produce',
  authenticateUser,
  upload.single('image'),
  async (request, response) => {
    if (!request.file) {
      return response.status(400).json({
        success: false,
        error: 'A produce photo is required.',
      });
    }

    try {
      const result = await identifyLooseProduce({
        imageBuffer: request.file.buffer,
        mimeType: request.file.mimetype,
      });

      return response.json({
        success: true,
        recognition: result.recognition,
        matches: result.matches,
      });
    } catch (error) {
      console.error('Loose produce recognition failed:', {
        message: error.message,
        userId: request.user?.uid || null,
        mimeType: request.file?.mimetype,
        size: request.file?.size,
      });

      return response.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'The produce photo could not be analysed.',
      });
    }
  },
);

router.use(
  (
    error,
    request,
    response,
    next,
  ) => {
    if (
      error instanceof multer.MulterError
    ) {
      return response.status(400).json({
        success: false,

        error:
          error.code ===
          'LIMIT_FILE_SIZE'
            ? 'The image must be smaller than 8 MB.'
            : 'The image could not be uploaded.',
      });
    }

    if (error) {
      return response.status(400).json({
        success: false,

        error:
          error.message ||
          'The image could not be uploaded.',
      });
    }

    return next();
  },
);

export default router;