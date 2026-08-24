const { categoryOf, compactProduct, isAvailable } = require('./catalogue');
const { normalise } = require('./matching');

const EVIDENCE_FIELDS = [
  ['identityKey', 'string'],
  ['valueFamilyKey', 'string'],
  ['rrpGbp', 'positive'],
  ['rrpSource', 'string'],
  ['rrpKind', 'string'],
  ['rrpObservedAt', 'string'],
  ['rrpReferenceBasis', 'string'],
  ['unitRrpGbp', 'positive'],
  ['unitCount', 'positiveInteger'],
  ['unitKind', 'string'],
];

function evidenceValue(product, field, type) {
  const value = product?.[field];
  if (type === 'string') return typeof value === 'string' && value.trim() ? value.trim() : null;
  if (type === 'positive') return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  if (type === 'positiveInteger') return Number.isInteger(value) && value > 0 ? value : null;
  return null;
}

function sameEvidence(left, right) {
  if (typeof left === 'number' && typeof right === 'number') return Math.abs(left - right) <= 0.005;
  return left === right;
}

function mergeEvidence(group, product) {
  const conflicts = group._evidenceConflicts;
  for (const [field, type] of EVIDENCE_FIELDS) {
    const incoming = evidenceValue(product, field, type);
    if (incoming === null || conflicts.has(field)) continue;
    if (group[field] === undefined) {
      group[field] = incoming;
    } else if (!sameEvidence(group[field], incoming)) {
      delete group[field];
      conflicts.add(field);
    }
  }
}

function offerFromLegacy(product) {
  const compact = compactProduct(product);
  const shipping = Number.isFinite(product.shippingGbp) ? product.shippingGbp : undefined;
  return {
    id: `${compact.retailerKey}:${compact.sku}`,
    retailerId: compact.retailerKey,
    retailerName: compact.retailer,
    title: compact.title,
    priceGbp: compact.price,
    shippingGbp: shipping,
    totalDeliveredGbp: Number.isFinite(compact.price) && Number.isFinite(shipping) ? compact.price + shipping : undefined,
    deliveryKnown: Number.isFinite(shipping),
    freeShippingThresholdGbp: Number.isFinite(product.freeShippingThresholdGbp) ? product.freeShippingThresholdGbp : undefined,
    collectionAvailable: product.collectionAvailable === true,
    productUrl: /^https:\/\//i.test(compact.url || '') ? compact.url : undefined,
    imageUrl: /^https:\/\//i.test(compact.image || '') ? compact.image : undefined,
    lastCheckedAt: compact.lastSeen,
    stockStatus: compact.availability,
  };
}

function truePriceGroups(database, query = '') {
  const term = normalise(query).slice(0, 120);
  if (term.length < 2) return [];
  const matching = Object.values(database || {}).filter((product) => isAvailable(product) && normalise(product.title).includes(term));
  const groups = new Map();

  for (const product of matching) {
    const category = categoryOf(product.title);
    const key = `${category}:${normalise(product.title)}`;
    const offer = offerFromLegacy(product);
    const existing = groups.get(key) || {
      id: key,
      title: product.title,
      category,
      matchingConfidence: 0.85,
      offers: [],
      _evidenceConflicts: new Set(),
    };
    mergeEvidence(existing, product);
    existing.offers.push(offer);
    groups.set(key, existing);
  }

  return [...groups.values()].map((group) => {
    const known = group.offers
      .filter((offer) => offer.deliveryKnown)
      .sort((a, b) => a.totalDeliveredGbp - b.totalDeliveredGbp);
    const lowest = known[0]?.totalDeliveredGbp;
    const { _evidenceConflicts, ...publicGroup } = group;
    return {
      ...publicGroup,
      retailerCount: new Set(group.offers.map((offer) => offer.retailerId)).size,
      offers: group.offers.map((offer) => ({
        ...offer,
        isLowestKnownDelivered: lowest !== undefined && offer.totalDeliveredGbp === lowest,
      })),
    };
  }).sort((a, b) => b.retailerCount - a.retailerCount || a.title.localeCompare(b.title)).slice(0, 50);
}

module.exports = { offerFromLegacy, truePriceGroups };
