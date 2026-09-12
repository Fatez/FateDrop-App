import type { HomeSignalKind } from '@/lib/home-signal-state';

export type CompanionVoiceName =
  | 'Koru'
  | 'Fenn'
  | 'Oru'
  | 'Nyxen'
  | 'Morren'
  | 'Veyl'
  | 'Taren'
  | 'Koru & Friends'
  | 'Your companion';

export type CompanionVoiceMessage = {
  companion: CompanionVoiceName;
  title: string;
  detail: string;
};

export type HomeCompanionVoiceInput = {
  state: HomeSignalKind;
  wantedLiveCount: number;
  unreadEchoes: number;
  unreadWhispers: number;
  unreadVanished: number;
};

const plural = (value: number, one: string, many = `${one}s`) => value === 1 ? one : many;

/**
 * Human-facing companion language for Home.
 *
 * These lines are downstream of already-derived evidence. They never invent a
 * match, price, alert or stock state; the character layer only explains what
 * the existing FateDrop state already proved.
 */
export function homeCompanionVoice(input: HomeCompanionVoiceInput): CompanionVoiceMessage {
  switch (input.state) {
    case 'manifested': {
      const count = Math.max(1, input.wantedLiveCount);
      return {
        companion: 'Koru',
        title: count === 1 ? 'Koru spotted something you saved live.' : `Koru spotted ${count} saved items live.`,
        detail: 'Open the verified live opportunities below to check the exact retailer evidence.',
      };
    }
    case 'echo': {
      const count = Math.max(1, input.unreadEchoes);
      return {
        companion: 'Fenn',
        title: 'Fenn heard the signal getting stronger.',
        detail: `${count} new ${plural(count, 'Echo')} ${count === 1 ? 'is' : 'are'} waiting for you.`,
      };
    }
    case 'pcuk':
      return {
        companion: 'Koru & Friends',
        title: 'The team picked up Pokémon Center UK activity.',
        detail: 'Open the signal detail before treating activity as a live-stock instruction.',
      };
    case 'whisper': {
      const count = Math.max(1, input.unreadWhispers);
      return {
        companion: 'Oru',
        title: 'Oru heard something beginning.',
        detail: `${count} new ${plural(count, 'Whisper')} ${count === 1 ? 'is' : 'are'} waiting for a look.`,
      };
    }
    case 'vanished': {
      const count = Math.max(1, input.unreadVanished);
      return {
        companion: 'Nyxen',
        title: count === 1 ? 'Nyxen marked an opportunity as gone.' : `Nyxen marked ${count} opportunities as gone.`,
        detail: 'The old live state is no longer being observed as available.',
      };
    }
    case 'loading':
      return {
        companion: 'Koru & Friends',
        title: 'The companions are checking the network.',
        detail: 'Your personal briefing will update when the evidence is ready.',
      };
    case 'error':
      return {
        companion: 'Koru & Friends',
        title: 'Part of the signal is unavailable.',
        detail: 'FateDrop will not fill the gap with a guess.',
      };
    case 'idle':
    default:
      return {
        companion: 'Koru & Friends',
        title: 'The companions are keeping watch.',
        detail: 'Nothing personal needs your attention right now.',
      };
  }
}

function cleanPath(pathname: string) {
  const value = pathname.trim().toLowerCase().replace(/\/+$/, '');
  return value || '/';
}

/**
 * Quiet route-level metaphor. This is deliberately conservative: it explains
 * what a surface does, rather than claiming a result exists merely because the
 * user opened that page.
 */
export function companionRouteVoice(pathname: string): CompanionVoiceMessage | null {
  const path = cleanPath(pathname);

  if (path === '/' || path === '/alerts' || path === '/onboarding' || path === '/tcg-onboarding') return null;

  if (path === '/search') {
    return {
      companion: 'Koru & Friends',
      title: 'Scouting the connected network.',
      detail: 'Search shows what FateDrop can see now. It never starts monitoring by itself.',
    };
  }

  if (path === '/watchlist') {
    return {
      companion: 'Koru & Friends',
      title: 'Remembered, not monitored.',
      detail: 'Saved items stay passive until you explicitly create a FateFind.',
    };
  }

  if (path === '/fatefind') {
    return {
      companion: 'Your companion',
      title: 'Set the hunt. Your conditions do the deciding.',
      detail: 'FateFind uses True Price and the limits you choose. Nothing becomes a FateMatch until those rules are satisfied.',
    };
  }

  if (path === '/fate-match') {
    return {
      companion: 'Your companion',
      title: 'This is where successful hunts return.',
      detail: "A FateMatch only exists when an active FateFind's conditions are satisfied.",
    };
  }

  if (path === '/market' || path === '/fate-pulse' || path.startsWith('/fate-pulse/')) {
    return {
      companion: 'Veyl',
      title: 'Reading the market.',
      detail: 'Movement appears only when dated, verified evidence supports it.',
    };
  }

  if (path === '/true-price' || path === '/fate-price' || path.startsWith('/fate-price-')) {
    return {
      companion: 'Taren',
      title: 'Tracing the value.',
      detail: 'Exact evidence stays exact. Unknown prices stay unknown.',
    };
  }

  if (path === '/collections' || path === '/collection') {
    return {
      companion: 'Morren',
      title: 'Your collection is in good company.',
      detail: 'Morren keeps the pieces together while FateDrop tracks ownership and evidence.',
    };
  }

  if (path === '/binders' || path.startsWith('/binder/')) {
    return {
      companion: 'Morren',
      title: 'Keeping watch over the gaps.',
      detail: 'Open the checklist to see exactly what still needs a home.',
    };
  }

  if (path === '/graded-collection') {
    return {
      companion: 'Morren',
      title: 'Your graded cards are accounted for.',
      detail: 'Slabs stay separate from binder completion while remaining part of your collection.',
    };
  }

  if (path === '/local-radar' || path.startsWith('/local-radar-')) {
    return {
      companion: 'Fenn',
      title: 'Listening nearby.',
      detail: 'Physical-store intelligence stays separate from online stock, and unknown stays unknown.',
    };
  }

  if (path === '/notification-preferences') {
    return {
      companion: 'Koru & Friends',
      title: 'You decide when we tap your shoulder.',
      detail: 'Notifications only follow the stages, markets and watches you enable.',
    };
  }

  if (path === '/network') {
    return {
      companion: 'Koru & Friends',
      title: 'Watching the FateDrop network.',
      detail: 'Signal evidence stays separate from your personal FateFind conditions.',
    };
  }

  return null;
}
