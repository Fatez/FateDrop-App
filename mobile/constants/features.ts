export type FeatureFlag =
  | 'localRadar'
  | 'eventVendorMode'
  | 'reserveAndCollect'
  | 'retailerAnalytics'
  | 'catalogueImport'
  | 'dropPulse'
  | 'fateScore'
  | 'passport'
  | 'basketBreaker'
  | 'fateBounty'
  | 'demandSignal'
  | 'fateFair'
  | 'collections'
  | 'setCompletionBasket'
  | 'indieExclusives'
  | 'preorderConfidence'
  | 'releaseCommandCentre'
  | 'fateForecast'
  | 'fairDrop'
  | 'shopTrails'
  | 'eventCompanion'
  | 'collectorCompatibility'
  | 'sellToIndies';

/**
 * Product Spec v1 launch-facing flags.
 *
 * HOLD/PLANNED features remain implemented where useful, but are disabled from
 * ordinary collector journeys until their evidence, retailer adoption or
 * commercial model is mature enough to expose safely.
 */
export const featureFlags: Record<FeatureFlag, boolean> = {
  localRadar: true,
  eventVendorMode: false,
  reserveAndCollect: false,
  retailerAnalytics: true,
  catalogueImport: true,
  dropPulse: true,
  fateScore: false,
  passport: false,
  basketBreaker: false,
  fateBounty: false,
  demandSignal: false,
  fateFair: false,
  collections: false,
  setCompletionBasket: false,
  indieExclusives: false,
  preorderConfidence: false,
  releaseCommandCentre: false,
  fateForecast: false,
  fairDrop: false,
  shopTrails: false,
  eventCompanion: false,
  collectorCompatibility: false,
  sellToIndies: false,
};

export const isFeatureEnabled = (flag: FeatureFlag) => featureFlags[flag];
