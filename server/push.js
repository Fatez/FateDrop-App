const fs = require('fs');
const path = require('path');

const TOKENS_FILE = path.join(__dirname, '..', 'data', 'push-tokens.json');
const SUBSCRIPTIONS_FILE = path.join(__dirname, '..', 'data', 'push-subscriptions.json');
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function readTokens() {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')); } catch { return []; }
}
function saveToken(token) {
  if (!/^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(token)) return false;
  const tokens = [...new Set([...readTokens(), token])];
  const temporary = `${TOKENS_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(tokens, null, 2), 'utf8');
  fs.renameSync(temporary, TOKENS_FILE);
  return true;
}
function readSubscriptions() {
  try { return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8')); } catch { return {}; }
}
function saveWatchlist(token, productKeys) {
  if (!saveToken(token) || !Array.isArray(productKeys) || productKeys.some((key) => typeof key !== 'string')) return false;
  const subscriptions = readSubscriptions();
  subscriptions[token] = [...new Set(productKeys)].slice(0, 1000);
  const temporary = `${SUBSCRIPTIONS_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(subscriptions, null, 2), 'utf8');
  fs.renameSync(temporary, SUBSCRIPTIONS_FILE);
  return true;
}
function stockEvents(events) {
  return events.filter((event) => ['RESTOCK', 'NEW_PRODUCT_LIVE'].includes(event.type));
}
async function sendStockNotifications(events) {
  const tokens = readTokens();
  const subscriptions = readSubscriptions();
  const liveEvents = stockEvents(events);
  if (!tokens.length || !liveEvents.length) return { sent: 0 };
  const messages = liveEvents.flatMap((event) => {
    const productKey = `${event.product.retailerKey || 'pokemon-center-uk'}:${event.sku}`;
    return tokens.filter((token) => subscriptions[token]?.includes(productKey)).map((to) => ({
    to,
    sound: 'default',
    channelId: 'stock-alerts',
    priority: 'high',
    title: "It's Fate — your product's live",
    body: `${event.product.title} · ${event.retailer}${Number.isFinite(event.product.price) ? ` · £${event.product.price.toFixed(2)}` : ''}`,
    data: { productUrl: event.product.url, sku: event.sku, retailer: event.retailer, eventId: event.id },
    }));
  });
  if (!messages.length) return { sent: 0 };
  const response = await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(messages) });
  if (!response.ok) throw new Error(`Expo push service returned HTTP ${response.status}`);
  return { sent: messages.length, result: await response.json() };
}

module.exports = { readTokens, readSubscriptions, saveToken, saveWatchlist, stockEvents, sendStockNotifications };
