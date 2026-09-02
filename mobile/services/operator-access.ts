import { canRetractGlobalEcho, canSendGlobalEcho, type FateDropSyncSnapshot } from '@/services/fatedrop-id';

export type GlobalEchoAccessState = 'loading' | 'authorized' | 'denied';

type OperatorAccessInput = {
  snapshot: FateDropSyncSnapshot | null;
  signedIn: boolean;
  loading: boolean;
  syncing: boolean;
  error: string | null;
};

function accessState(input: OperatorAccessInput, authorized: boolean): GlobalEchoAccessState {
  if (input.loading || input.syncing) return 'loading';
  if (input.error) return 'denied';
  if (!input.signedIn) return 'denied';
  return authorized ? 'authorized' : 'denied';
}

export function globalEchoAccessState(input: OperatorAccessInput): GlobalEchoAccessState {
  return accessState(input, canSendGlobalEcho(input.snapshot));
}

export function globalEchoRetractionAccessState(input: OperatorAccessInput): GlobalEchoAccessState {
  return accessState(input, canRetractGlobalEcho(input.snapshot));
}
