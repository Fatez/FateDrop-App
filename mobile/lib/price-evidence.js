function itemRrpPercent(itemPrice, reference) {
  if (!Number.isFinite(itemPrice) || itemPrice <= 0 || !Number.isFinite(reference) || reference <= 0) return null;
  return ((itemPrice - reference) / reference) * 100;
}
function selectWishlistPrice(offers) {
  const known = offers.filter(offer => offer.deliveryKnown === true && Number.isFinite(offer.totalDeliveredGbp) && offer.totalDeliveredGbp >= 0)
    .sort((a, b) => a.totalDeliveredGbp - b.totalDeliveredGbp);
  if (known.length) return { offer: known[0], delivered: true };
  const items = offers.filter(offer => Number.isFinite(offer.priceGbp) && offer.priceGbp >= 0)
    .sort((a, b) => a.priceGbp - b.priceGbp);
  return { offer: items[0], delivered: false };
}
module.exports = { itemRrpPercent, selectWishlistPrice };
