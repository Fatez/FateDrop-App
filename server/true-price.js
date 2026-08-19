const { categoryOf, compactProduct, isAvailable } = require('./catalogue');
const { normalise } = require('./matching');

function offerFromLegacy(product) {
  const compact=compactProduct(product), shipping=Number.isFinite(product.shippingGbp)?product.shippingGbp:undefined;
  return { id:`${compact.retailerKey}:${compact.sku}`,retailerId:compact.retailerKey,retailerName:compact.retailer,title:compact.title,priceGbp:compact.price,shippingGbp:shipping,totalDeliveredGbp:Number.isFinite(compact.price)&&Number.isFinite(shipping)?compact.price+shipping:undefined,deliveryKnown:Number.isFinite(shipping),freeShippingThresholdGbp:Number.isFinite(product.freeShippingThresholdGbp)?product.freeShippingThresholdGbp:undefined,collectionAvailable:product.collectionAvailable===true,productUrl:/^https:\/\//i.test(compact.url||'')?compact.url:undefined,imageUrl:/^https:\/\//i.test(compact.image||'')?compact.image:undefined,lastCheckedAt:compact.lastSeen,stockStatus:compact.availability};
}
function truePriceGroups(database,query='') {
  const term=normalise(query).slice(0,120);if(term.length<2)return[];
  const matching=Object.values(database||{}).filter(product=>isAvailable(product)&&normalise(product.title).includes(term));
  const groups=new Map();for(const product of matching){const category=categoryOf(product.title),key=`${category}:${normalise(product.title)}`,offer=offerFromLegacy(product);const existing=groups.get(key)||{id:key,title:product.title,category,matchingConfidence:.85,offers:[]};existing.offers.push(offer);groups.set(key,existing);}
  return [...groups.values()].map(group=>{const known=group.offers.filter(offer=>offer.deliveryKnown).sort((a,b)=>a.totalDeliveredGbp-b.totalDeliveredGbp),lowest=known[0]?.totalDeliveredGbp;return{...group,retailerCount:new Set(group.offers.map(offer=>offer.retailerId)).size,offers:group.offers.map(offer=>({...offer,isLowestKnownDelivered:lowest!==undefined&&offer.totalDeliveredGbp===lowest}))};}).sort((a,b)=>b.retailerCount-a.retailerCount||a.title.localeCompare(b.title)).slice(0,50);
}
module.exports={offerFromLegacy,truePriceGroups};
