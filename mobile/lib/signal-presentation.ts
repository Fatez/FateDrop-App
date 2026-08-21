import { companionReactionFromSignal, type CompanionReaction } from '@/lib/companion-contract';

export type SignalTone = 'mint' | 'red' | 'amber' | 'blue' | 'violet' | 'neutral';
export type FatePriceVerdict = 'LOWEST_KNOWN' | 'BETTER_OFFER_FOUND' | 'NO_FAIR_COMPARISON';
export type CanonicalSignalStage = 'ECHO' | 'MANIFESTED' | 'VANISHED' | 'NETWORK';

export type CanonicalOfferLink = {
  offerId: string;
  retailerId: string;
  retailer: string;
  url: string;
  itemPricePence: number | null;
  deliveredPricePence: number | null;
  stockStatus: string | null;
};

export type CanonicalSignalThreadEntry = {
  id: string;
  state: string;
  fateStage: CanonicalSignalStage;
  retailer: string;
  occurredAt: string;
  reason: string;
  pricePence: number | null;
  stockStatus: string | null;
  previousStockStatus: string | null;
  url: string;
};

export interface MarketEvent {
  id: string;
  type?: string;
  fateStage?: string;
  productId?: string;
  offerId?: string;
  retailerId?: string;
  title?: string;
  message?: string;
  retailer?: string;
  detectedAt?: string;
  major?: boolean;
  confirmed?: boolean;
  confirmedRestock?: boolean;
  productUrl?: string;
  retailerUrl?: string;
  product?: {
    title?: string;
    url?: string;
    imageUrl?: string | null;
    pricePence?: number | null;
    rrpPence?: number | null;
    deliveredPricePence?: number | null;
  };
  priceIntelligence?: {
    rrpPence?: number | null;
    rrpDeltaPercent?: number | null;
    comparisonBasis?: 'item' | 'delivered';
    verdict?: FatePriceVerdict;
    currentComparisonPence?: number | null;
    lowestKnown?: {
      offerId?: string | null;
      retailerId?: string | null;
      retailer?: string | null;
      url?: string | null;
      itemPricePence?: number | null;
      deliveredPricePence?: number | null;
      comparisonPricePence?: number | null;
      stockStatus?: string | null;
    } | null;
    savingsPence?: number | null;
    savingsPercent?: number | null;
  };
  signalThread?: CanonicalSignalThreadEntry[];
  preparedLinks?: {
    primary: CanonicalOfferLink & {
      intent: 'inspect' | 'buy';
      label: string;
    };
    lowestKnown: CanonicalOfferLink | null;
    officialReference: CanonicalOfferLink | null;
    alternatives: CanonicalOfferLink[];
    compareQuery: string;
    fateFindQuery: string;
  };
  notification?: {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  };
}

export type SignalPresentation = {
  label: 'Echo' | 'Manifested' | 'Vanished' | 'Major' | 'Network activity';
  tone: SignalTone;
  icon: 'flash' | 'sparkles' | 'close-circle' | 'trophy' | 'radio';
  reaction: CompanionReaction;
};

export function retailerDestination(event: MarketEvent) {
  return event.product?.url ?? event.productUrl ?? event.retailerUrl ?? null;
}

export function signalPresentation(event: MarketEvent): SignalPresentation {
  const type = String(event.type || '').toUpperCase();
  const stage = String(event.fateStage || '').toUpperCase();

  if (event.major || stage === 'MAJOR') {
    return {
      label: 'Major',
      tone: 'amber',
      icon: 'trophy',
      reaction: companionReactionFromSignal({ major: true }),
    };
  }

  if (stage === 'VANISHED' || /SOLD_OUT|VANISH|REMOVED/.test(type)) {
    return {
      label: 'Vanished',
      tone: 'red',
      icon: 'close-circle',
      reaction: companionReactionFromSignal({ state: 'vanished' }),
    };
  }

  const explicitlyEarly = stage === 'WHISPER' || stage === 'ECHO';
  if (explicitlyEarly || /QUEUE|SECURITY|TRAFFIC|PRECURSOR/.test(type)) {
    return {
      label: 'Echo',
      tone: 'violet',
      icon: 'flash',
      reaction: companionReactionFromSignal({ state: 'echo' }),
    };
  }

  const confirmedAvailability =
    stage === 'MANIFESTED' ||
    event.confirmed === true ||
    event.confirmedRestock === true ||
    (!stage && /RESTOCK|IN_STOCK|NEW_PRODUCT/.test(type));

  if (confirmedAvailability) {
    return {
      label: 'Manifested',
      tone: 'mint',
      icon: 'sparkles',
      reaction: companionReactionFromSignal({ state: 'manifested', confirmedRestock: true }),
    };
  }

  return {
    label: 'Network activity',
    tone: 'blue',
    icon: 'radio',
    reaction: companionReactionFromSignal({ kind: type || stage }),
  };
}

export function companionLineForSignal(presentation: SignalPresentation) {
  switch (presentation.label) {
    case 'Echo':
      return 'Early movement detected. Watching for confirmation.';
    case 'Manifested':
      return 'Confirmed. Stock is live.';
    case 'Vanished':
      return 'Signal lost. The observed availability has gone.';
    case 'Major':
      return 'Major confirmed signal. This one matters.';
    default:
      return 'Network movement detected. Keeping watch.';
  }
}
