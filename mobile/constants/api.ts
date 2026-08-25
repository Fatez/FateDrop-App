const DEFAULT_SIGNAL_ENGINE_URL = 'https://fatedrop-cloud-production.up.railway.app';
const DEFAULT_FATEDROP_WEB_URL = 'https://fatedrop.co.uk';

/** Canonical market/network truth used by Search, Indies catalogue and True Price. */
export const SIGNAL_ENGINE_URL = (
  process.env.EXPO_PUBLIC_SIGNAL_ENGINE_URL || DEFAULT_SIGNAL_ENGINE_URL
).replace(/\/$/, '');

/** Shared authenticated/API gateway used by App and Web for cross-platform contracts. */
export const FATEDROP_WEB_URL = (
  process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || DEFAULT_FATEDROP_WEB_URL
).replace(/\/$/, '');

/**
 * Transitional app API for routes that have not moved to FateDrop Cloud yet.
 * Never fall back to a developer LAN address in a production/mobile install:
 * a missing transitional route should fail fast over HTTPS instead of leaving
 * the phone waiting for an unreachable private IP.
 */
export const APP_API_BASE_URL = (
  process.env.EXPO_PUBLIC_APP_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  DEFAULT_SIGNAL_ENGINE_URL
).replace(/\/$/, '');

/** Backward-compatible alias while legacy screens are migrated individually. */
export const API_BASE_URL = APP_API_BASE_URL;