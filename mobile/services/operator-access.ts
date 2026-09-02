import { canSendGlobalEcho, type FateDropSyncSnapshot } from '@/services/fatedrop-id';

export type GlobalEchoAccessState = 'loading' | 'authorized' | 'denied';

export function globalEchoAccessState(input: {
  snapshot: FateDropSyncSnapshot | null;
  signedIn: boolean;
  loading: boolean;
  syncing: boolean;
  error: string | null;
}): GlobalEchoAccessState {
  if (input.loading || input.syncing) return 'loading';
  if (input.error) return 'denied';
  if (!input.signedIn) return 'denied';
  return canSendGlobalEcho(input.snapshot) ? 'authorized' : 'denied';
}
