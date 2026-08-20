import { companionReactionFromSignal, type CompanionReaction } from '@/lib/companion-contract';

export type SignalTone = 'mint' | 'red' | 'amber' | 'blue' | 'violet' | 'neutral';

export interface MarketEvent {
  id: string;
  type?: string;
  fateStage?: string;
  title?: string;
  message?: string;
  retailer?: string;
  detectedAt?: string;
  major?: boolean;
  product?: {
    title?: string;
    pricePence?: number | null;
    rrpPence?: number | null;
    deliveredPricePence?: number | null;
  };
}

export type SignalPresentation = {
  label: 'Echo' | 'Manifested' | 'Vanished' | 'Major' | 'Network activity';
  tone: SignalTone;
  icon: 'flash' | 'sparkles' | 'close-circle' | 'trophy' | 'radio';
  reaction: CompanionReaction;
};

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

  const confirmedRestock = stage === 'MANIFESTED' || (stage === 'ECHO' && /RESTOCK/.test(type)) || /RESTOCK|IN_STOCK|NEW_PRODUCT/.test(type);
  if (confirmedRestock) {
    return {
      label: 'Manifested',
      tone: 'mint',
      icon: 'sparkles',
      reaction: companionReactionFromSignal({ state: 'manifested', confirmedRestock: true }),
    };
  }

  if (stage === 'WHISPER' || stage === 'ECHO' || /QUEUE|SECURITY|TRAFFIC|PRECURSOR/.test(type)) {
    return {
      label: 'Echo',
      tone: 'violet',
      icon: 'flash',
      reaction: companionReactionFromSignal({ state: 'echo' }),
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
