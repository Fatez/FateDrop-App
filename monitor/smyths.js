const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { normaliseProduct, compareProducts, mergeEventHistory } = require('./compare');
const { sendStockNotifications } = require('../server/push');

const RETAILER = 'Smyths Toys';
const RETAILER_KEY = 'smyths-toys';
const CATALOGUE_URL = 'https://www.smythstoys.com/uk/en-gb/toys/action-figures-and-playsets/pokemon-toys/pokemon-trading-card-game-tcg/c/SM0601011202';
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES = {
  products: path.join(DATA_DIR, 'products.json'),
  events: path.join(DATA_DIR, 'events.json'),
  state: path.join(DATA_DIR, 'state.json'),
};

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  const raw = fs.readFileSync(file, 'utf8').trim();
  return raw ? JSON.parse(raw) : fallback;
}

function writeJsonAtomic(file, data) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temporary, file);
}

function parseProductSchema(schemas, expectedUrl) {
  for (const source of schemas) {
    try {
      const parsed = JSON.parse(source);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const product = candidates.find((item) => item?.['@type'] === 'Product');
      if (!product) continue;
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      if (!product.sku || !product.name || !offer) throw new Error('Product schema is incomplete');
      return {
        sku: String(product.sku),
        title: product.name,
        availability: String(offer.availability || '').endsWith('/InStock') ? 'IN_STOCK' : 'OUT_OF_STOCK',
        price: Number.isFinite(Number(offer.price)) ? Number(offer.price) : null,
        url: offer.url || expectedUrl,
        image: Array.isArray(product.image) ? product.image[0] : product.image || null,
        retailer: RETAILER,
        retailerKey: RETAILER_KEY,
      };
    } catch (error) {
      if (error.message === 'Product schema is incomplete') throw error;
    }
  }
  throw new Error(`No valid Product schema found at ${expectedUrl}`);
}

async function collectCatalogue(context, master) {
  const catalogue = await context.newPage();
  await catalogue.goto(CATALOGUE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await catalogue.locator('#plp-content').waitFor({ state: 'visible', timeout: 30000 });

  const countText = await catalogue.getByText(/\d+ Products/).first().textContent();
  const expectedCount = Number(countText?.match(/\d+/)?.[0]);
  if (!Number.isInteger(expectedCount) || expectedCount < 1) throw new Error('Smyths did not report a valid product total');

  const links = await catalogue.locator('#plp-content a.flex-grow[href*="/p/"]').evaluateAll((anchors) =>
    [...new Set(anchors.map((anchor) => anchor.href))],
  );
  await catalogue.close();
  if (links.length !== expectedCount) throw new Error(`Incomplete Smyths listing: found ${links.length}/${expectedCount} product links`);

  const products = {};
  let nextIndex = 0;
  async function worker() {
    const page = await context.newPage();
    try {
      while (nextIndex < links.length) {
        const index = nextIndex++;
        const url = links[index];
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
        const raw = parseProductSchema(schemas, url);
        const key = `${RETAILER_KEY}:${raw.sku}`;
        if (products[key]) throw new Error(`Duplicate Smyths SKU ${raw.sku}`);
        products[key] = normaliseProduct(raw, master[key]);
        console.log(`Smyths ${Object.keys(products).length}/${expectedCount}: ${raw.sku} ${raw.availability}`);
      }
    } finally {
      await page.close();
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, links.length) }, () => worker()));
  if (Object.keys(products).length !== expectedCount) throw new Error('Smyths detail scan did not match its catalogue total');
  return { products, expectedCount };
}

async function run() {
  console.log('\nFATEDROP SMYTHS IMPORT\n');
  const master = readJson(FILES.products, {});
  const state = readJson(FILES.state, {});
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  if (!context) throw new Error('No Chrome context found');

  const scan = await collectCatalogue(context, master);
  const compared = compareProducts(master, scan.products, { scanVerified: true, retailerKey: RETAILER_KEY });
  const history = mergeEventHistory(readJson(FILES.events, []), compared.events);
  const now = new Date().toISOString();
  writeJsonAtomic(FILES.products, compared.products);
  writeJsonAtomic(FILES.events, history);
  writeJsonAtomic(FILES.state, {
    ...state,
    retailerStates: {
      ...(state.retailerStates || {}),
      [RETAILER_KEY]: { lastSuccessfulScan: now, lastProductCount: scan.expectedCount },
    },
  });
  await sendStockNotifications(compared.events).catch((error) => console.error(`Push delivery failed: ${error.message}`));
  console.log(`Imported ${scan.expectedCount} verified Smyths products and created ${compared.events.length} event(s).`);
  await browser.close();
  return compared;
}

if (require.main === module) run().catch((error) => {
  console.error(`\nSMYTHS IMPORT FAILED: ${error.message}`);
  console.error('No files were changed unless the full catalogue and every product detail were verified.');
  process.exitCode = 1;
});

module.exports = { run, collectCatalogue, parseProductSchema };
