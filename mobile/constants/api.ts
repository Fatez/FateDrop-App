const DEFAULT_SIGNAL_ENGINE_URL = 'https://fatedrop-cloud-production.up.railway.app';
const DEFAULT_FATEDROP_WEB_URL = 'https://fatedrop.co.uk';
const CANONICAL_FATEDROP_WEB_HOST = 'fatedrop.co.uk';

function trimBaseUrl(value: string) {
  return String(value || '').trim().replace(/\/$/, '');
}

function canonicalWebBaseUrl(value: string | undefined) {
  const candidate = trimBaseUrl(value || DEFAULT_FATEDROP_WEB_URL);
  try {
    const url = new URL(candidate);
    const canonicalOrigin = new URL(DEFAULT_FATEDROP_WEB_URL).origin;
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== CANONICAL_FATEDROP_WEB_HOST || url.origin !== canonicalOrigin) {
      return DEFAULT_FATEDROP_WEB_URL;
    }
    // The authenticated Web/account gateway is a production contract, not a
    // developer-selectable backend. Ignore stale paths/query/hash values as well
    // as stale hosts so an Expo/Codespaces env cannot strand mobile auth/alerts.
    return DEFAULT_FATEDROP_WEB_URL;
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
 * EXPO_PUBLIC_FATEDROP_WEB_URL may restate the canonical production origin, but
 * any stale/non-canonical host, port, path, query or hash fails safely back to
 * fatedrop.co.uk. This prevents old Expo/Codespace environment values from
 * silently breaking sign-in, sync, notification preferences or the alert inbox.
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
