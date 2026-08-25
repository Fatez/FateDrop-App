const STAGES = {
  WHISPER: "WHISPER",
  ECHO: "ECHO",
  MANIFESTED: "MANIFESTED",
  VANISHED: "VANISHED",
  UNKNOWN: "UNKNOWN",
};

const stock = (product) => product?.availability === "IN_STOCK";

function migrateProduct(product, now = new Date().toISOString()) {
  const firstSeen = product.firstSeen || product.lastSeen || now;
  const lastSeen = product.lastSeen || firstSeen;
  return {
    ...product,
    firstSeen,
    lastSeen,
    firstInStockAt: product.firstInStockAt || (stock(product) ? firstSeen : null),
    lastInStockAt: product.lastInStockAt || (stock(product) ? lastSeen : null),
    vanishedAt: product.vanishedAt || null,
    returnedAt: product.returnedAt || null,
    fateStage: product.fateStage || (stock(product) ? STAGES.MANIFESTED : STAGES.UNKNOWN),
    previousFateStage: product.previousFateStage || null,
    timesRestocked: Number.isInteger(product.timesRestocked) ? product.timesRestocked : 0,
    isCurrentlyListed: product.isCurrentlyListed !== false,
  };
}

function normaliseProduct(raw, oldProduct = null, now = new Date().toISOString()) {
  let availability = raw.availability_status ?? raw.availability ?? "UNKNOWN";
  if (Array.isArray(availability)) availability = availability[0];
  const validUrl = typeof raw.url === "string" && /^https?:\/\//i.test(raw.url) ? raw.url : null;
  return {
    ...(oldProduct || {}),
    sku: raw.pid || raw.sku,
    title: raw.title || raw.reporting_product_name || oldProduct?.title || "Unknown product",
    retailer: raw.retailer || oldProduct?.retailer || "Pokémon Center UK",
    retailerKey: raw.retailerKey || oldProduct?.retailerKey || "pokemon-center-uk",
    availability: availability || "UNKNOWN",
    price: raw.sale_price ?? raw.price ?? oldProduct?.price ?? null,
    launchDate: raw.launch_date ?? raw.launchDate ?? oldProduct?.launchDate ?? null,
    url: validUrl ?? oldProduct?.url ?? null,
    image: raw.primary_image_full_size || raw.primary_image || raw.thumb_image || raw.image || oldProduct?.image || null,
    firstSeen: oldProduct?.firstSeen || now,
    lastSeen: now,
    isCurrentlyListed: true,
  };
}

function makeEvent(type, stage, oldStage, product, previousValues, now) {
  const priority = ["RESTOCK", "NEW_PRODUCT_LIVE"].includes(type)
    ? "CRITICAL"
    : type === "NEW_PRODUCT"
      ? "EARLY"
      : type === "SOLD_OUT"
        ? "INFO"
        : "LOW";
  const names = {
    NEW_PRODUCT: "A whisper in the catalogue",
    NEW_PRODUCT_LIVE: "A new fate has manifested",
    RESTOCK: "A fate has manifested again",
    SOLD_OUT: "A fate has vanished",
    LISTING_REMOVED: "Listing no longer present",
    PRICE_CHANGE: "Price changed",
    RELEASE_DATE_CHANGE: "Release date changed",
  };
  const fingerprint = [
    product.retailerKey,
    product.sku,
    type,
    stage,
    JSON.stringify(previousValues),
    product.availability,
    product.price,
    product.launchDate,
  ].join("|");
  return {
    id: [fingerprint, now].join("|"),
    fingerprint,
    sku: product.sku,
    type,
    fateStage: stage,
    previousFateStage: oldStage || null,
    priority,
    detectedAt: now,
    retailer: product.retailer || "Pokémon Center UK",
    product: { ...product },
    title: names[type],
    message: `${names[type]}: ${product.title}`,
    previousValues,
  };
}

function transitionProduct(previous, current, now = new Date().toISOString()) {
  const oldProduct = previous ? migrateProduct(previous, now) : null;
  const product = normaliseProduct(current, oldProduct, now);
  const events = [];
  let stage = oldProduct?.fateStage || STAGES.UNKNOWN;
  let type = null;

  // Canonical lifecycle authority lives in Fatedrop-Cloud:
  // WHISPER = early catalogue movement before verified purchase availability.
  // ECHO = corroborated retailer preparation/readiness before purchase availability.
  // MANIFESTED = verified purchasable availability, including restocks.
  // VANISHED = previously verified purchasable availability lost.
  //
  // This legacy local comparison helper has no preparation/readiness evidence, so it must
  // never manufacture ECHO from a stock return. A restock is MANIFESTED.
  if (!oldProduct) {
    stage = stock(product) ? STAGES.MANIFESTED : STAGES.WHISPER;
    type = stock(product) ? "NEW_PRODUCT_LIVE" : "NEW_PRODUCT";
  } else if (!stock(oldProduct) && stock(product)) {
    stage = STAGES.MANIFESTED;
    type = oldProduct.vanishedAt || oldProduct.firstInStockAt ? "RESTOCK" : "NEW_PRODUCT_LIVE";
  } else if (stock(oldProduct) && !stock(product)) {
    stage = STAGES.VANISHED;
    type = "SOLD_OUT";
  }

  const isRestock = type === "RESTOCK";
  Object.assign(product, {
    previousFateStage: oldProduct?.fateStage || null,
    fateStage: stage,
    firstInStockAt: oldProduct?.firstInStockAt || (stock(product) ? now : null),
    lastInStockAt: stock(product) ? now : oldProduct?.lastInStockAt || null,
    vanishedAt: type === "SOLD_OUT" ? now : oldProduct?.vanishedAt || null,
    returnedAt: isRestock ? now : oldProduct?.returnedAt || null,
    timesRestocked: (oldProduct?.timesRestocked || 0) + (isRestock ? 1 : 0),
  });

  if (type) {
    events.push(makeEvent(type, stage, oldProduct?.fateStage, product, oldProduct ? { availability: oldProduct.availability } : {}, now));
  }
  if (oldProduct?.price != null && product.price != null && Number(oldProduct.price) !== Number(product.price)) {
    events.push(makeEvent("PRICE_CHANGE", stage, oldProduct.fateStage, product, { price: oldProduct.price }, now));
  }
  if (oldProduct?.launchDate && product.launchDate && oldProduct.launchDate !== product.launchDate) {
    events.push(makeEvent("RELEASE_DATE_CHANGE", stage, oldProduct.fateStage, product, { launchDate: oldProduct.launchDate }, now));
  }

  return { product, events };
}

function compareProducts(previous = {}, scanned = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  if (options.scanVerified !== true) return { committed: false, products: previous, events: [] };
  const products = {};
  const events = [];
  const scope = options.retailerKey || null;

  for (const [sku, product] of Object.entries(previous)) products[sku] = migrateProduct(product, now);
  for (const [sku, product] of Object.entries(scanned)) {
    const result = transitionProduct(products[sku], product, now);
    products[sku] = result.product;
    events.push(...result.events);
  }
  for (const [sku, product] of Object.entries(products)) {
    if (Object.prototype.hasOwnProperty.call(scanned, sku)) continue;
    if (scope && (product.retailerKey || "pokemon-center-uk") !== scope) continue;
    const listed = product.isCurrentlyListed !== false;
    const stage = stock(product) ? STAGES.VANISHED : product.fateStage;
    products[sku] = {
      ...product,
      isCurrentlyListed: false,
      fateStage: stage,
      previousFateStage: product.fateStage,
      vanishedAt: stock(product) ? now : product.vanishedAt,
    };
    if (listed) {
      events.push(makeEvent("LISTING_REMOVED", stage, product.fateStage, products[sku], { isCurrentlyListed: true }, now));
    }
  }
  return { committed: true, products, events };
}

function mergeEventHistory(existing, incoming, limit = 500) {
  const history = Array.isArray(existing) ? existing.filter((event) => event && event.id) : [];
  const seen = new Set(history.map((event) => event.fingerprint || event.id));
  return [...incoming.filter((event) => !seen.has(event.fingerprint || event.id)), ...history].slice(0, limit);
}

module.exports = {
  FATE_STAGES: STAGES,
  isInStock: stock,
  migrateProduct,
  normaliseProduct,
  transitionProduct,
  compareProducts,
  mergeEventHistory,
};