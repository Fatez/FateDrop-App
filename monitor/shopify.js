const fs = require('fs');
const path = require('path');
const { normaliseProduct, compareProducts, mergeEventHistory } = require('./compare');
const { sendStockNotifications } = require('../server/push');

const STORES = {
  'total-cards': {
    retailer: 'Total Cards',
    origin: 'https://totalcards.net',
    collection: 'pokemon-sealed-products',
  },
  'double-sleeved': {
    retailer: 'Double Sleeved',
    origin: 'https://www.doublesleeved.co.uk',
    collection: 'pokemon-tcg',
  },
  'cob-and-pip': {
    retailer: 'Cob & Pip',
    origin: 'https://cobandpip.co.uk',
    collection: 'all',
    pokemonOnly: true,
  },
};
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

function mapProduct(product, storeKey, store) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const available = variants.some((variant) => variant.available === true);
  const pricedVariant = variants.find((variant) => variant.available === true) || variants[0];
  return {
    sku: String(product.id),
    title: product.title,
    availability: available ? 'IN_STOCK' : 'OUT_OF_STOCK',
    price: Number.isFinite(Number(pricedVariant?.price)) ? Number(pricedVariant.price) : null,
    url: `${store.origin}/products/${product.handle}`,
    image: product.images?.[0]?.src || null,
    retailer: store.retailer,
    retailerKey: storeKey,
  };
}

async function collectStore(storeKey, store, master) {
  const products = {};
  const seenIds = new Set();
  const limit = 250;
  let page = 1;
  while (true) {
    const url = `${store.origin}/collections/${store.collection}/products.json?limit=${limit}&page=${page}`;
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'FateDrop catalogue monitor/1.0' } });
    if (!response.ok) throw new Error(`${store.retailer} page ${page} returned HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.products)) throw new Error(`${store.retailer} page ${page} contained no products array`);
    console.log(`${store.retailer} page ${page}: ${payload.products.length} products`);
    for (const source of payload.products) {
      if (store.pokemonOnly && !/^pokemon\b/i.test(source.product_type || '') && !/^pok[eé]mon\b/i.test(source.title || '')) continue;
      if (!source.id || !source.title || !source.handle) throw new Error(`${store.retailer} returned an incomplete product`);
      const id = String(source.id);
      if (seenIds.has(id)) throw new Error(`${store.retailer} returned duplicate product ${id}`);
      seenIds.add(id);
      const key = `${storeKey}:${id}`;
      products[key] = normaliseProduct(mapProduct(source, storeKey, store), master[key]);
    }
    if (payload.products.length < limit) break;
    page += 1;
    if (page > 100) throw new Error(`${store.retailer} exceeded the catalogue page safety limit`);
  }
  if (seenIds.size < 1) throw new Error(`${store.retailer} returned an empty catalogue`);
  return products;
}

async function run(storeKey) {
  const store = STORES[storeKey];
  if (!store) throw new Error(`Unknown Shopify store: ${storeKey}`);
  console.log(`\nFATEDROP ${store.retailer.toUpperCase()} IMPORT\n`);
  const master = readJson(FILES.products, {});
  const hasExistingStoreBaseline = Object.values(master).some((product) => product.retailerKey === storeKey);
  const state = readJson(FILES.state, {});
  const scanned = await collectStore(storeKey, store, master);
  const compared = compareProducts(master, scanned, { scanVerified: true, retailerKey: storeKey });
  const history = mergeEventHistory(readJson(FILES.events, []), compared.events);
  const now = new Date().toISOString();
  writeJsonAtomic(FILES.products, compared.products);
  writeJsonAtomic(FILES.events, history);
  writeJsonAtomic(FILES.state, {
    ...state,
    retailerStates: {
      ...(state.retailerStates || {}),
      [storeKey]: { lastSuccessfulScan: now, lastProductCount: Object.keys(scanned).length },
    },
  });
  if (hasExistingStoreBaseline) await sendStockNotifications(compared.events).catch((error) => console.error(`Push delivery failed: ${error.message}`));
  console.log(`Imported ${Object.keys(scanned).length} verified ${store.retailer} products and created ${compared.events.length} event(s).`);
  return compared;
}

if (require.main === module) run(process.argv[2]).catch((error) => {
  console.error(`\nSHOPIFY IMPORT FAILED: ${error.message}`);
  console.error('No files were changed unless the complete catalogue was verified.');
  process.exitCode = 1;
});

module.exports = { STORES, mapProduct, collectStore, run };
