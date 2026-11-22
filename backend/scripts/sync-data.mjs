// Copies the app's seed catalog (../src/data) into backend/src/data so the API serves
// exactly the same products. The copies are committed because Cloud Run source deploys
// upload only the backend/ folder; when ../src/data isn't there, the committed copies are used.
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../../src/data/', import.meta.url));
const to = fileURLToPath(new URL('../src/data/', import.meta.url));

if (!existsSync(from)) {
  console.log('[sync-data] ../src/data not found; using committed copies.');
} else {
  for (const file of ['products.json', 'categories.json']) copyFileSync(from + file, to + file);
  console.log('[sync-data] copied products.json, categories.json');
}
