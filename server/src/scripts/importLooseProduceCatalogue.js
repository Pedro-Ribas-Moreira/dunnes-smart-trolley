import 'dotenv/config';

import { importLooseProduceCatalogue } from '../services/looseProduceCatalogueService.js';

try {
  const items = await importLooseProduceCatalogue();

  console.log(`Imported ${items.length} loose-produce items into Firebase.`);
  items.forEach((item) => {
    console.log(`${item.dunnesSku}  ${item.name}`);
  });

  process.exit(0);
} catch (error) {
  console.error('Loose-produce catalogue import failed:', error);
  process.exit(1);
}
