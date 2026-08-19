const crypto = require('crypto');
const { dropPulse } = require('./drop-pulse');

const CATEGORY_RULES = [
  ['GRADED', /\b(graded|psa|cgc|bgs)\b/i],
  ['SINGLE', /(^|\s)#\d+|\b(single|near mint|lightly played)\b/i],
  ['ACCESSORY', /\b(sleeve|binder|deck box|playmat|accessor)/i],
  ['PREORDER', /\bpre[ -]?order\b/i],
  ['SEALED', /\b(booster|elite trainer|collection|tin|box|pack|bundle|deck)\b/i],
];

function categoryOf(title = '') {
  return CATEGORY_RULES.find(([, expression]) => expression.test(title))?.[0] || 'OTHER';
}
function isAvailable(product) {
  return product.isCurrentlyListed !== false && product.availability === 'IN_STOCK';
}
function conditionOf(product){const title=String(product.title||'');if(/near mint|\bnm\b/i.test(title))return'NEAR_MINT';if(/lightly played|\blp\b/i.test(title))return'LIGHTLY_PLAYED';if(/moderately played|\bmp\b/i.test(title))return'MODERATELY_PLAYED';if(/heavily played|\bhp\b/i.test(title))return'HEAVILY_PLAYED';if(/damaged/i.test(title))return'DAMAGED';if(/psa|cgc|bgs/i.test(title))return'GRADED';return categoryOf(title)==='SINGLE'?'UNKNOWN':'NEW';}
function compactProduct(product) {
  return {
    id: product.sku,
    sku: product.sku,
    title: product.title,
    retailer: product.retailer || 'Pokémon Center UK',
    retailerKey: product.retailerKey || 'pokemon-center-uk',
    availability: product.availability || 'UNKNOWN',
    price: Number.isFinite(product.price) ? product.price : null,
    url: typeof product.url === 'string' ? product.url : null,
    image: typeof product.image === 'string' ? product.image : null,
    lastSeen: product.lastSeen || null,
    isCurrentlyListed: product.isCurrentlyListed !== false,
    category: categoryOf(product.title),
    condition: product.condition || conditionOf(product),
    setName: product.setName || null,
    cardNumber: product.cardNumber || null,
    shippingGbp: Number.isFinite(product.shippingGbp) ? product.shippingGbp : null,
    collectionAvailable: product.collectionAvailable === true,
    pulseLabels: dropPulse(product),
  };
}
function parseLimit(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(100, Math.max(1, parsed)) : 50;
}
function queryCatalogue(database, query = {}) {
  const limit = parseLimit(query.limit);
  const offset = Math.max(0, Number.parseInt(query.cursor, 10) || 0);
  const term = String(query.q || '').trim().toLowerCase().slice(0, 120);
  const retailer = String(query.retailer || '').trim();
  const category = String(query.category || '').trim().toUpperCase();
  const condition = String(query.condition || '').trim().toUpperCase();
  const setName = String(query.set || '').trim().toLowerCase().slice(0,120);
  const minimumPrice = Number(query.minPrice), maximumPrice = Number(query.maxPrice);
  const excludedRetailers = new Set(String(query.excludeRetailers || '').split(',').filter(Boolean));
  let products = Object.values(database || {}).map(compactProduct);
  if (term) products = products.filter((product) => product.title.toLowerCase().includes(term) || String(product.sku).toLowerCase().includes(term));
  if (retailer) products = products.filter((product) => product.retailerKey === retailer);
  if (excludedRetailers.size) products = products.filter((product) => !excludedRetailers.has(product.retailerKey));
  if (category) products = products.filter((product) => product.category === category);
  if (condition) products = products.filter((product) => product.condition === condition);
  if (setName) products = products.filter((product) => String(product.setName||'').toLowerCase().includes(setName));
  if (query.minPrice!==undefined&&Number.isFinite(minimumPrice)) products=products.filter(product=>Number.isFinite(product.price)&&product.price>=minimumPrice);
  if (query.maxPrice!==undefined&&Number.isFinite(maximumPrice)) products=products.filter(product=>Number.isFinite(product.price)&&product.price<=maximumPrice);
  if (query.inStock === 'true') products = products.filter(isAvailable);
  if (query.inStock === 'false') products = products.filter((product) => !isAvailable(product));
  if(query.sort==='price')products.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity)||a.title.localeCompare(b.title));
  else if(query.sort==='newest')products.sort((a,b)=>String(b.lastSeen||'').localeCompare(String(a.lastSeen||'')));
  else products.sort((a, b) => a.title.localeCompare(b.title) || a.retailer.localeCompare(b.retailer));
  const page = products.slice(offset, offset + limit);
  const updatedAt = products.reduce((latest, product) => product.lastSeen && product.lastSeen > latest ? product.lastSeen : latest, '');
  const etag = crypto.createHash('sha1').update(`${products.length}:${updatedAt}:${offset}:${limit}`).digest('hex');
  return { products: page, total: products.length, count: page.length, nextCursor: offset + limit < products.length ? String(offset + limit) : null, updatedAt: updatedAt || null, etag };
}

module.exports = { categoryOf, conditionOf, compactProduct, isAvailable, parseLimit, queryCatalogue };
