import express from 'express';

import {
  authenticateUser,
} from '../middleware/authenticateUser.js';

import {
  finishShoppingSession,
  getShoppingSessions,
} from '../services/shoppingSessionService.js';

const router = express.Router();

router.get(
  '/',
  authenticateUser,
  async (request, response) => {
    try {
      const sessions =
        await getShoppingSessions(
          request.user.uid,
        );

      return response.json({
        success: true,
        sessions,
      });
    } catch (error) {
      console.error(
        'Shopping history loading failed:',
        error,
      );

      return response.status(500).json({
        success: false,
        error:
          'The shopping history could not be loaded.',
      });
    }
  },
);

router.post(
  '/finish',
  authenticateUser,
  async (request, response) => {
    try {
      const session =
        await finishShoppingSession(
          request.user.uid,
        );

      return response.status(201).json({
        success: true,
        session,
      });
    } catch (error) {
      console.error(
        'Shopping session creation failed:',
        error,
      );

      return response
        .status(error.statusCode || 500)
        .json({
          success: false,
          error:
            error.message ||
            'The shopping session could not be completed.',
        });
    }
  },
);

export default router;