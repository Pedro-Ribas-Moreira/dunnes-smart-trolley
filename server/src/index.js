import cors from 'cors';
import express from 'express';

import productRoutes from './routes/productRoutes.js';

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

app.get('/api/health', (request, response) => {
  response.json({
    status: 'ok',
    service: 'Dunnes Smart Trolley API',
  });
});

app.use('/api/products', productRoutes);

app.use((request, response) => {
  response.status(404).json({
    success: false,
    error: 'Endpoint not found.',
  });
});

app.listen(port, () => {
  console.log(
    `Dunnes Smart Trolley API running on http://localhost:${port}`,
  );
});