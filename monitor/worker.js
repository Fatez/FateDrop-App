const fs = require('fs');
const path = require('path');
const { run: runShopify, STORES } = require('./shopify');

const HEALTH_FILE = path.join(__dirname, '..', 'data', 'monitor-health.json');
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const AUTOMATIC_STORES = ['total-cards', 'double-sleeved', 'cob-and-pip'];

function readHealth() {
  try { return JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8')); } catch { return { retailers: {} }; }
}
function writeHealth(health) {
  const temporary = `${HEALTH_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(health, null, 2), 'utf8');
  fs.renameSync(temporary, HEALTH_FILE);
}
function updateRetailerHealth(storeKey, update) {
  const health = readHealth();
  health.updatedAt = new Date().toISOString();
  health.retailers = { ...(health.retailers || {}), [storeKey]: { ...(health.retailers?.[storeKey] || {}), ...update } };
  writeHealth(health);
  return health.retailers[storeKey];
}

async function runStore(storeKey, runImporter = runShopify) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  updateRetailerHealth(storeKey, { retailer: STORES[storeKey]?.retailer || storeKey, status: 'running', startedAt, lastError: null });
  try {
    const result = await runImporter(storeKey);
    const listedProducts = Object.values(result.products).filter((product) => product.retailerKey === storeKey && product.isCurrentlyListed !== false);
    const productCount = listedProducts.length;
    const inStockCount = listedProducts.filter((product) => product.availability === 'IN_STOCK').length;
    updateRetailerHealth(storeKey, { status: 'healthy', lastSuccessAt: new Date().toISOString(), durationMs: Date.now() - started, productCount, inStockCount, unavailableCount: productCount - inStockCount, eventsCreated: result.events.length, consecutiveFailures: 0 });
    return { storeKey, success: true, productCount, inStockCount, eventsCreated: result.events.length };
  } catch (error) {
    const previous = readHealth().retailers?.[storeKey];
    updateRetailerHealth(storeKey, { status: 'failed', lastFailureAt: new Date().toISOString(), durationMs: Date.now() - started, lastError: error instanceof Error ? error.message : String(error), consecutiveFailures: (previous?.consecutiveFailures || 0) + 1 });
    return { storeKey, success: false, error };
  }
}

async function runCycle(stores = AUTOMATIC_STORES, runImporter = runShopify) {
  const results = [];
  for (const storeKey of stores) results.push(await runStore(storeKey, runImporter));
  return results;
}

async function startWorker() {
  const once = process.argv.includes('--once');
  const configured = Number(process.env.MONITOR_INTERVAL_MS);
  const intervalMs = Number.isFinite(configured) && configured >= 60000 ? configured : DEFAULT_INTERVAL_MS;
  let running = false;
  const cycle = async () => {
    if (running) return console.log('Skipping cycle because the previous scan is still running.');
    running = true;
    console.log(`\nFateDrop automatic cycle started ${new Date().toISOString()}`);
    try {
      const results = await runCycle();
      console.log(`Cycle complete: ${results.filter((result) => result.success).length}/${results.length} retailers healthy.`);
    } finally { running = false; }
  };
  await cycle();
  if (once) return;
  console.log(`Automatic monitoring active every ${Math.round(intervalMs / 60000)} minute(s).`);
  setInterval(() => void cycle(), intervalMs);
}

if (require.main === module) startWorker().catch((error) => { console.error(`Worker failed: ${error.message}`); process.exitCode = 1; });
module.exports = { AUTOMATIC_STORES, readHealth, updateRetailerHealth, runStore, runCycle };
