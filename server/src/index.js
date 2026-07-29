import cors from 'cors';
import express from 'express';

import { scrapeDunnesProduct } from './scrapers/dunnesScraper.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (request, response) => {
  response.json({
    status: 'ok',
    service: 'Dunnes Smart Trolley API',
  });
});

app.get('/api/scrape-product', async (request, response) => {
  const { url } = request.query;

  if (!url) {
    return response.status(400).json({
      error: 'A Dunnes product URL is required.',
    });
  }

  try {
    const product = await scrapeDunnesProduct(url);

    return response.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('Scraping error:', error.message);

    return response.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(
    `Dunnes Smart Trolley API running on http://localhost:${port}`
  );
});