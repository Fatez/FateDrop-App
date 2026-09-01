import { FATEDROP_WEB_URL } from '@/constants/api';
import { clearStoredSession, getStoredSessionToken } from '@/services/fatedrop-id';

export type AccountDeletionAcceptance = {
  accepted: true;
  status: 'pending' | 'processing';
  requestedAt: number;
};

export async function requestFateDropAccountDeletion(): Promise<AccountDeletionAcceptance> {
  const token = await getStoredSessionToken();
  if (!token) throw new Error('FateDrop ID sign-in required.');

  let response: Response;
  try {
    response = await fetch(`${FATEDROP_WEB_URL}/api/mobile/account/deletion-request`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error('FateDrop could not submit your deletion request. Check your connection and try again.');
  }

  const data = await response.json().catch(() => null) as (Partial<AccountDeletionAcceptance> & { error?: string }) | null;
  if (response.status === 401) await clearStoredSession();
  if (!response.ok || data?.accepted !== true) {
    throw new Error(data?.error || 'FateDrop could not submit your deletion request. Please try again.');
  }

  return {
    accepted: true,
    status: data.status === 'processing' ? 'processing' : 'pending',
    requestedAt: Number(data.requestedAt || Math.floor(Date.now() / 1000)),
  };
}
