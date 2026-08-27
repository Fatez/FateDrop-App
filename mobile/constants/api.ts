const DEFAULT_SIGNAL_ENGINE_URL = 'https://fatedrop-cloud-production.up.railway.app';
const DEFAULT_FATEDROP_WEB_URL = 'https://fatedrop.co.uk';
const OBSOLETE_FATEDROP_WEB_HOSTS = new Set(['fate-drop.com', 'www.fate-drop.com']);

function trimBaseUrl(value: string) {
  return String(value || '').trim().replace(/\/$/, '');
}

function canonicalWebBaseUrl(value: string | undefined) {
  const candidate = trimBaseUrl(value || DEFAULT_FATEDROP_WEB_URL);
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    if (OBSOLETE_FATEDROP_WEB_HOSTS.has(host)) return DEFAULT_FATEDROP_WEB_URL;
    return candidate;
  } catch {
    return DEFAULT_FATEDROP_WEB_URL;
  }
}

/** Canonical market/network truth used by Search, catalogue, True Price and live signal activity. */
export const SIGNAL_ENGINE_URL = trimBaseUrl(
  process.env.EXPO_PUBLIC_SIGNAL_ENGINE_URL || DEFAULT_SIGNAL_ENGINE_URL,
);

/**
 * Canonical authenticated FateDrop Web/account gateway.
 * Known retired hosts fail safely to fatedrop.co.uk so an old Expo/Codespace env cannot
 * silently strand sign-in, sync, notification preferences or the personal alert inbox.
 */
export const FATEDROP_WEB_URL = canonicalWebBaseUrl(process.env.EXPO_PUBLIC_FATEDROP_WEB_URL);

/**
 * Transitional app API for routes that have not moved to FateDrop Cloud yet.
 * Never fall back to a developer LAN address in a production/mobile install:
 * a missing transitional route should fail fast over HTTPS instead of leaving
 * the phone waiting for an unreachable private IP.
 */
export const APP_API_BASE_URL = trimBaseUrl(
  process.env.EXPO_PUBLIC_APP_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  DEFAULT_SIGNAL_ENGINE_URL,
);

/** Backward-compatible alias while legacy screens are migrated individually. */
export const API_BASE_URL = APP_API_BASE_URL;
