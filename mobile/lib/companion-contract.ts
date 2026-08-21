export const COMPANION_SCHEMA_VERSION = 1 as const;

export type CompanionRenderMode = 'fallback-2d' | 'native-3d';
export type CompanionReaction = 'idle' | 'watching' | 'echo' | 'manifested' | 'vanished' | 'fatematch' | 'major';

export type CompanionLoadout = {
  base: 'scout' | 'runner' | 'warden';
  skin: 'light' | 'warm' | 'olive' | 'deep' | 'rich';
  hair: 'midnight-spikes' | 'violet-wave' | 'silver-fade' | 'cyan-crop' | 'ember-fringe';
  face: 'soft' | 'sharp' | 'friendly' | 'focused';
  eyes: 'violet' | 'cyan' | 'amber' | 'silver';
  outfit: 'signal-hoodie' | 'collector-jacket' | 'tournament-shell' | 'spectral-bomber';
  headwear: 'signal-cap' | 'headphones' | 'visor' | 'beanie';
  accessory: 'none' | 'chain' | 'card-charm' | 'signal-pin' | 'crossbody';
  gear: 'scanner' | 'binder' | 'slab-case' | 'none';
  companion: 'radar-drone' | 'signal-orb' | 'mini-beacon' | 'none';
  aura: 'violet' | 'cyan' | 'spectral' | 'gold';
  background: 'fate-network' | 'command-room' | 'card-vault' | 'tournament-floor' | 'neon-desk';
  tcgStyle: 'neutral' | 'pokemon' | 'one-piece' | 'lorcana' | 'magic' | 'yugioh';
};

export type CompanionAssetManifest = {
  version: typeof COMPANION_SCHEMA_VERSION;
  characterModelUrl: string | null;
  characterFormat: 'glb' | null;
  droidModelUrl: string | null;
  droidFormat: 'glb' | null;
  animationClips: Partial<Record<CompanionReaction, string>>;
  fallbackArtworkVersion: string;
};

export type CompanionRenderRequest = {
  loadout: CompanionLoadout;
  reaction: CompanionReaction;
  mode?: CompanionRenderMode;
  compact?: boolean;
  label?: string;
};

export const DEFAULT_COMPANION_LOADOUT: CompanionLoadout = {
  base: 'scout',
  skin: 'warm',
  hair: 'midnight-spikes',
  face: 'friendly',
  eyes: 'violet',
  outfit: 'signal-hoodie',
  headwear: 'signal-cap',
  accessory: 'signal-pin',
  gear: 'scanner',
  companion: 'radar-drone',
  aura: 'violet',
  background: 'command-room',
  tcgStyle: 'neutral',
};

export const DEFAULT_COMPANION_ASSET_MANIFEST: CompanionAssetManifest = {
  version: COMPANION_SCHEMA_VERSION,
  characterModelUrl: null,
  characterFormat: null,
  droidModelUrl: null,
  droidFormat: null,
  animationClips: {},
  fallbackArtworkVersion: 'mobile-companion-v1',
};

/**
 * Maps evidence states to Companion reactions without changing the public
 * lifecycle meaning. Whisper uses anticipation/watching, Echo uses readiness,
 * Manifested gets the confirmed-stock reaction, and the strongest celebration
 * remains reserved for explicit major/high-value confirmed signals.
 */
export function companionReactionFromSignal(input: {
  kind?: string | null;
  state?: string | null;
  fateMatch?: boolean;
  major?: boolean;
  confirmedRestock?: boolean;
}): CompanionReaction {
  if (input.fateMatch) return 'fatematch';
  if (input.major) return 'major';
  const kind = String(input.kind ?? input.state ?? '').toLowerCase();
  if (kind === 'vanished') return 'vanished';
  if (kind === 'manifested' || input.confirmedRestock) return 'manifested';
  if (['echo', 'queue', 'security', 'traffic', 'access_readiness'].includes(kind)) return 'echo';
  if (['whisper', 'drop_pulse'].includes(kind)) return 'watching';
  return kind ? 'watching' : 'idle';
}

export function companionRendererMode(manifest: CompanionAssetManifest = DEFAULT_COMPANION_ASSET_MANIFEST): CompanionRenderMode {
  return manifest.characterModelUrl && manifest.characterFormat === 'glb' ? 'native-3d' : 'fallback-2d';
}
