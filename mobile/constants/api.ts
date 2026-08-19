const DEFAULT_SIGNAL_ENGINE_URL = 'https://fatedrop-cloud-production.up.railway.app';
const DEFAULT_LEGACY_APP_API_URL = 'http://192.168.68.61:3000';

/** Canonical market/network truth used by Search, Indies catalogue and True Price. */
export const SIGNAL_ENGINE_URL = (
  process.env.EXPO_PUBLIC_SIGNAL_ENGINE_URL || DEFAULT_SIGNAL_ENGINE_URL
).replace(/\/$/, '');

/**
 * Transitional app API for routes that have not moved to FateDrop Cloud yet
 * (local/demo event data, legacy push registration, etc.).
 */
export const APP_API_BASE_URL = (
  process.env.EXPO_PUBLIC_APP_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  DEFAULT_LEGACY_APP_API_URL
).replace(/\/$/, '');

/** Backward-compatible alias while legacy screens are migrated individually. */
export const API_BASE_URL = APP_API_BASE_URL;
