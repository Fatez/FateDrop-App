import { FATEDROP_WEB_URL } from '@/constants/api';
import type { CanonicalMobileAlert } from '@/services/canonical-alerts';
import { getStoredSessionToken } from '@/services/fatedrop-id';

type AlertResponse = { success?: boolean; alerts?: CanonicalMobileAlert[]; error?: string };
type RetractionResponse = { success?: boolean; eventId?: string; error?: string };

function isManualGlobalEcho(alert: CanonicalMobileAlert) {
  return alert.fateStage === 'ECHO'
    && alert.signalKind === 'operator_readiness'
    && alert.operatorIntelligence?.availabilityScope === 'online_retailer_readiness'
    && alert.operatorIntelligence?.sourceType === 'operator_manual';
}

async function operatorFetch(path: string, init: RequestInit = {}) {
  const token = await getStoredSessionToken();
  if (!token) throw new Error('FateDrop ID sign-in required.');
  return fetch(`${FATEDROP_WEB_URL}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
      authorization: `Bearer ${token}`,
    },
  });
}

export async function listRetractableGlobalEchoes(limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const response = await operatorFetch(`/api/mobile/alerts?state=echo&limit=${safeLimit}`);
  const data = await response.json().catch(() => null) as AlertResponse | null;
  if (!response.ok) throw new Error(data?.error || `Global Echo history failed (${response.status}).`);
  if (!data?.success || !Array.isArray(data.alerts)) throw new Error('Global Echo history is unavailable.');
  return data.alerts.filter(isManualGlobalEcho);
}

export async function retractGlobalEcho(eventId: string, reason: string) {
  const cleanReason = reason.trim().slice(0, 300);
  if (!/^local-radar-operator:\d+$/.test(eventId.trim())) throw new Error('This Echo cannot be retracted.');
  if (cleanReason.length < 3) throw new Error('Add a short retraction reason.');
  const response = await operatorFetch('/api/operator/global-echo/retraction', {
    method: 'POST',
    body: JSON.stringify({ eventId: eventId.trim(), reason: cleanReason }),
  });
  const data = await response.json().catch(() => null) as RetractionResponse | null;
  if (!response.ok || !data?.success) throw new Error(data?.error || `Global Echo retraction failed (${response.status}).`);
  return data;
}
