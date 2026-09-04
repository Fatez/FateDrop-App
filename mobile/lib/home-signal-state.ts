export type HomeSignalKind = 'loading' | 'error' | 'idle' | 'manifested' | 'echo' | 'pcuk' | 'whisper' | 'vanished';

export type HomeSignalEvidence = {
  signedIn: boolean;
  loading: boolean;
  error: boolean;
  wantedLiveCount: number;
  pokemonCenterActive: boolean;
  unreadEchoes: number;
  unreadWhispers: number;
  unreadVanished: number;
};

/**
 * The Home crystal is a personal attention signal, not a platform-health score.
 * Keep the priority deterministic so the same evidence always produces the
 * same state and broad network totals can never make the crystal light up.
 */
export function deriveHomeSignalKind(evidence: HomeSignalEvidence): HomeSignalKind {
  if (!evidence.signedIn) return 'idle';
  if (evidence.wantedLiveCount > 0) return 'manifested';
  if (evidence.unreadEchoes > 0) return 'echo';
  if (evidence.pokemonCenterActive) return 'pcuk';
  if (evidence.unreadWhispers > 0) return 'whisper';
  if (evidence.unreadVanished > 0) return 'vanished';
  if (evidence.loading) return 'loading';
  if (evidence.error) return 'error';
  return 'idle';
}
