// Retailer-class metadata is not yet exposed by the public Signal Engine status
// endpoint, so keep the small national-chain exclusion explicit here. Connected
// specialist/independent retailers are otherwise discovered dynamically.
export const nationalRetailerKeys = new Set<string>([
  'pokemon-center-uk',
  'smyths-uk',
  'hamleys-uk',
  'asda-uk',
  'tesco-uk',
  'entertainer-uk',
  'game-uk',
  'argos-uk',
]);
