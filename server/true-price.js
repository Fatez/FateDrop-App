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

const SEARCH_ALIASES = [
  [/\betb\b/g, 'elite trainer box'],
  [/\bpc etb\b/g, 'pokemon center elite trainer box'],
  [/\bbooster display\b/g, 'booster box'],
  [/\bdisplay box\b/g, 'booster box'],
  [/\bcollection box\b/g, 'collection'],
];

function searchText(value) {
  let text = normalise(String(value || '')).slice(0, 180);
  for (const [pattern, replacement] of SEARCH_ALIASES) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, ' ').trim();
}

function queryMatchScore(title, query) {
  const wanted = searchText(query);
  const candidate = searchText(title);
  if (wanted.length < 2 || candidate.length < 2) return 0;
  if (candidate === wanted) return 1;
  if (candidate.includes(wanted)) return 0.98;
  const wantedTokens = [...new Set(wanted.split(' ').filter((token) => token.length > 1))];
  const candidateTokens = new Set(candidate.split(' ').filter(Boolean));
  if (!wantedTokens.length) return 0;
  const matched = wantedTokens.filter((token) => candidateTokens.has(token)).length;
  if (matched === wantedTokens.length) return 0.93;
  if (wantedTokens.length >= 3 && matched >= 2) {
    const coverage = matched / wantedTokens.length;
    if (coverage >= 0.67) return 0.68 + (coverage * 0.18);
  }
  return 0;
}

function matchesSearchText(title, query) { return queryMatchScore(title, query) > 0; }
function evidenceValue(product, field, type) {
  const value = product?.[field];
  if (type === 'string') return typeof value === 'string' && value.trim() ? value.trim() : null;
  if (type === 'positive') return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  if (type === 'positiveInteger') return Number.isInteger(value) && value > 0 ? value : null;
  return null;
}
function sameEvidence(left, right) { return typeof left === 'number' && typeof right === 'number' ? Math.abs(left - right) <= 0.005 : left === right; }
function mergeEvidence(group, product) {
  const conflicts = group._evidenceConflicts;
  for (const [field, type] of EVIDENCE_FIELDS) {
    const incoming = evidenceValue(product, field, type);
    if (incoming === null || conflicts.has(field)) continue;
    if (group[field] === undefined) group[field] = incoming;
    else if (!sameEvidence(group[field], incoming)) { delete group[field]; conflicts.add(field); }
  }
}
function discardRrpEvidence(group) { for (const field of ['rrpGbp','rrpSource','rrpKind','rrpObservedAt','rrpReferenceBasis','unitRrpGbp']) delete group[field]; }
function hasVerifiedRrpEvidence(group) {
  const source = evidenceValue(group, 'rrpSource', 'string');
  if (!source) return false;
  const direct = evidenceValue(group, 'rrpGbp', 'positive');
  const unit = evidenceValue(group, 'unitRrpGbp', 'positive');
  const count = evidenceValue(group, 'unitCount', 'positiveInteger');
  const scaled = unit !== null && count !== null ? unit * count : null;
  if (direct !== null && scaled !== null && Math.abs(direct - scaled) > 0.005) return false;
  return direct !== null || scaled !== null;
}
function offerFromLegacy(product) {
  const compact = compactProduct(product);
  const shipping = Number.isFinite(product.shippingGbp) ? product.shippingGbp : undefined;
  return { id:`${compact.retailerKey}:${compact.sku}`,retailerId:compact.retailerKey,retailerName:compact.retailer,title:compact.title,priceGbp:compact.price,shippingGbp:shipping,totalDeliveredGbp:Number.isFinite(compact.price)&&Number.isFinite(shipping)?compact.price+shipping:undefined,deliveryKnown:Number.isFinite(shipping),freeShippingThresholdGbp:Number.isFinite(product.freeShippingThresholdGbp)?product.freeShippingThresholdGbp:undefined,collectionAvailable:product.collectionAvailable===true,productUrl:/^https:\/\//i.test(compact.url||'')?compact.url:undefined,imageUrl:/^https:\/\//i.test(compact.image||'')?compact.image:undefined,lastCheckedAt:compact.lastSeen,stockStatus:compact.availability };
}
function truePriceGroups(database, query = '') {
  const term = searchText(query).slice(0,120); if (term.length < 2) return [];
  const matching = Object.values(database||{}).filter((product)=>isAvailable(product)).map((product)=>({product,score:queryMatchScore(product.title,term)})).filter(({score})=>score>0).sort((a,b)=>b.score-a.score);
  const groups = new Map();
  for (const {product,score} of matching) {
    const category=categoryOf(product.title), identityKey=evidenceValue(product,'identityKey','string'), key=identityKey?`identity:${identityKey}`:`${category}:${normalise(product.title)}`, offer=offerFromLegacy(product);
    const existing=groups.get(key)||{id:key,title:product.title,category,matchingConfidence:score,offers:[],_evidenceConflicts:new Set()};
    existing.matchingConfidence=Math.max(existing.matchingConfidence||0,score); mergeEvidence(existing,product); existing.offers.push(offer); groups.set(key,existing);
  }
  return [...groups.values()].map((group)=>{const known=group.offers.filter((offer)=>offer.deliveryKnown).sort((a,b)=>a.totalDeliveredGbp-b.totalDeliveredGbp),lowest=known[0]?.totalDeliveredGbp;const{_evidenceConflicts,...publicGroup}=group;if(!hasVerifiedRrpEvidence(publicGroup))discardRrpEvidence(publicGroup);return{...publicGroup,retailerCount:new Set(group.offers.map((offer)=>offer.retailerId)).size,offers:group.offers.map((offer)=>({...offer,isLowestKnownDelivered:lowest!==undefined&&offer.totalDeliveredGbp===lowest}))};}).sort((a,b)=>b.matchingConfidence-a.matchingConfidence||b.retailerCount-a.retailerCount||a.title.localeCompare(b.title)).slice(0,50);
}
module.exports={offerFromLegacy,truePriceGroups,queryMatchScore,matchesSearchText,searchText};
