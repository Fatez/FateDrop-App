import type { MarketEvent } from '@/lib/signal-presentation';

export const canonicalAlertFixture: MarketEvent = {
  id: 'sig_test_alert_intelligence',
  type: 'MANIFESTED',
  fateStage: 'MANIFESTED',
  retailer: 'Retailer A',
  title: 'Example Elite Trainer Box',
  detectedAt: new Date(0).toISOString(),
  product: {
    title: 'Example Elite Trainer Box',
    pricePence: 5999,
    rrpPence: 4999,
    deliveredPricePence: 6499,
  },
  priceIntelligence: {
    rrpPence: 4999,
    rrpDeltaPercent: 20,
    comparisonBasis: 'delivered',
    verdict: 'BETTER_OFFER_FOUND',
    currentComparisonPence: 6499,
    lowestKnown: {
      retailer: 'Retailer B',
      comparisonPricePence: 5499,
      deliveredPricePence: 5499,
    },
    savingsPence: 1000,
    savingsPercent: 15.4,
  },
};
