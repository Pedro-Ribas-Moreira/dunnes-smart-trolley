import cors from 'cors';
import express from 'express';
import dunnesRoutes from './routes/dunnesRoutes.js';
import productRoutes from './routes/productRoutes.js';
import productMatchRoutes from './routes/productMatchRoutes.js';

import shoppingSessionRoutes from './routes/shoppingSessionRoutes.js';

const app = express();

const port = process.env.PORT || 3001;

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://localhost:5173',
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

app.get('/api/health', (request, response) => {
  response.json({
    status: 'ok',
    service: 'Dunnes Smart Trolley API',
  });
});
app.use('/api/products', productRoutes);
app.use(
  '/api/product-matching',
  productMatchRoutes,
);
app.use(
  '/api/shopping-sessions',
  shoppingSessionRoutes,
);
  app.use('/api/dunnes', dunnesRoutes);

app.use((request, response) => {
  response.status(404).json({
    success: false,
    error: 'Endpoint not found.',
  });
});

app.listen(port, () => {

  console.log(
  'OpenAI configured:',
  Boolean(process.env.OPENAI_API_KEY),
);
  console.log(
    `Dunnes Smart Trolley API running on http://localhost:${port}`,
  );
});