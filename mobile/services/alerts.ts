import type { MarketEvent } from '@/lib/signal-presentation';
import { getStoredSessionToken } from '@/services/fatedrop-id';

const DEFAULT_WEB_URL = 'https://fate-drop.com';

function baseUrl() {
  return (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/, '');
}

type AlertInboxResponse = {
  success?: boolean;
  premium?: boolean;
  alerts?: MarketEvent[];
  error?: string;
};

async function requestAlerts(query: string) {
  const token = await getStoredSessionToken();
  if (!token) throw new Error('FateDrop ID sign-in required.');

  const response = await fetch(`${baseUrl()}/api/mobile/alerts${query}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null) as AlertInboxResponse | null;
  if (!response.ok) throw new Error(data?.error || `Alert inbox failed with HTTP ${response.status}`);
  return data;
}

export async function loadCanonicalAlertInbox(alertId?: string | null) {
  const recentPromise = requestAlerts('?limit=30');
  const exactPromise = alertId
    ? requestAlerts(`?id=${encodeURIComponent(alertId)}`).catch(() => null)
    : Promise.resolve(null);
  const [recent, exact] = await Promise.all([recentPromise, exactPromise]);

  const merged = [...(exact?.alerts || []), ...(recent?.alerts || [])];
  const seen = new Set<string>();
  const alerts = merged.filter((alert) => {
    if (!alert?.id || seen.has(alert.id)) return false;
    seen.add(alert.id);
    return true;
  });

  return { alerts, premium: Boolean(recent?.premium ?? exact?.premium) };
}
