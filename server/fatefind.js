const { categoryOf, conditionOf, compactProduct, isAvailable } = require('./catalogue');
const { truePriceGroups } = require('./true-price');
const { compareGroups, rankGroups } = require('./fate-verdict');

function evaluateSavedSearch(product,search){const compact=compactProduct(product),missing=[];if(search.query&&!compact.title.toLowerCase().includes(String(search.query).toLowerCase()))return{matches:false,missing};if(search.preferredRetailerIds?.length&&!search.preferredRetailerIds.includes(compact.retailerKey))return{matches:false,missing};if(search.category&&categoryOf(compact.title)!==search.category)return{matches:false,missing};if(search.condition&&conditionOf(compact)!==search.condition)return{matches:false,missing};if(search.inStockOnly&&!isAvailable(compact))return{matches:false,missing};if(!search.includePreorders&&/pre[ -]?order/i.test(compact.title))return{matches:false,missing};if(Number.isFinite(search.maximumItemPriceGbp)&&(!Number.isFinite(compact.price)||compact.price>search.maximumItemPriceGbp))return{matches:false,missing};if(search.collectionOnly){if(product.collectionAvailable!==true)return{matches:false,missing};}if(Number.isFinite(search.maximumDeliveredPriceGbp)){if(!Number.isFinite(compact.price)||!Number.isFinite(product.shippingGbp)){missing.push('shipping');return{matches:false,missing};}if(compact.price+product.shippingGbp>search.maximumDeliveredPriceGbp)return{matches:false,missing};}if(Number.isFinite(search.maximumDistanceMiles)){missing.push('distance');return{matches:false,missing};}return{matches:true,missing};}

function fateVerdictSearch(database, search) {
  const query = typeof search?.query === 'string' ? search.query.trim() : '';
  const groups = truePriceGroups(database, query);
  const leftId = typeof search?.leftId === 'string' ? search.leftId : null;
  const rightId = typeof search?.rightId === 'string' ? search.rightId : null;
  const pairVerdict = leftId && rightId
    ? compareGroups(groups.find((group) => group.id === leftId), groups.find((group) => group.id === rightId))
    : null;
  return {
    mode: 'verdict',
    count: groups.length,
    groups,
    verdict: rankGroups(groups),
    pairVerdict,
    source: 'FATEDROP_CLOUD',
    rulesVersion: 'fate-verdict-v1',
    disclaimer: 'RRP percentage uses item price against the verified value baseline. True Price adds known mandatory delivery; unknown delivery remains provisional.',
  };
}

function findMatches(database,search,limit=100){
  if(search?.mode==='verdict')return fateVerdictSearch(database,search);
  const matches=[],missing=new Set();let total=0;for(const product of Object.values(database||{})){const result=evaluateSavedSearch(product,search);result.missing.forEach(value=>missing.add(value));if(result.matches){total++;if(matches.length<limit)matches.push(compactProduct(product));}}return{matches,total,missingDependencies:[...missing],source:'LOCAL_API'};
}
module.exports={conditionOf,evaluateSavedSearch,findMatches,fateVerdictSearch};
