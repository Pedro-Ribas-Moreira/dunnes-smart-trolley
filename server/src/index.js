import 'dotenv/config';

import cors from 'cors';
import express from 'express';

import dunnesRoutes from './routes/dunnesRoutes.js';
import productMatchRoutes from './routes/productMatchRoutes.js';
import productRoutes from './routes/productRoutes.js';
import shoppingSessionRoutes from './routes/shoppingSessionRoutes.js';

const app = express();

const port = process.env.PORT || 3001;

const productionClientOrigins = String(
  process.env.CLIENT_ORIGIN || '',
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  ...productionClientOrigins,
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      console.warn(
        `[CORS] Blocked origin: ${origin}`,
      );

      callback(
        new Error(
          'This origin is not allowed by CORS.',
        ),
      );
    },

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
  }),
);

app.use(express.json());

app.use((request, response, next) => {
  const startedAt = Date.now();

  console.log(
    `[REQUEST] ${request.method} ${request.originalUrl}`,
  );

  response.on('finish', () => {
    const duration =
      Date.now() - startedAt;

    console.log(
      `[RESPONSE] ${request.method} ${request.originalUrl} ${response.statusCode} ${duration}ms`,
    );
  });

  next();
});

app.get(
  '/api/health',
  (request, response) => {
    response.json({
      status: 'ok',
      service:
        'Dunnes Smart Trolley API',
      environment:
        process.env.NODE_ENV ||
        'development',
    });
  },
);

app.use(
  '/api/products',
  productRoutes,
);

app.use(
  '/api/product-matching',
  productMatchRoutes,
);

app.use(
  '/api/shopping-sessions',
  shoppingSessionRoutes,
);

app.use(
  '/api/dunnes',
  dunnesRoutes,
);

app.use(
  (
    error,
    request,
    response,
    next,
  ) => {
    if (
      error?.message ===
      'This origin is not allowed by CORS.'
    ) {
      return response.status(403).json({
        success: false,
        error:
          'The requesting website is not allowed to access this API.',
      });
    }

    console.error(
      'Unhandled server error:',
      error,
    );

    return response.status(500).json({
      success: false,
      error:
        'An unexpected server error occurred.',
    });
  },
);

app.use((request, response) => {
  response.status(404).json({
    success: false,
    error: 'Endpoint not found.',
  });
});

app.listen(port, () => {
  console.log(
    'OpenAI configured:',
    Boolean(
      process.env.OPENAI_API_KEY,
    ),
  );

  console.log(
    'Firebase service account configured:',
    Boolean(
      process.env
        .FIREBASE_PROJECT_ID &&
        process.env
          .FIREBASE_CLIENT_EMAIL &&
        process.env
          .FIREBASE_PRIVATE_KEY,
    ),
  );

  console.log(
    `Dunnes Smart Trolley API listening on port ${port}`,
  );
});