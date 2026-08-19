import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'fatedrop:id:session:v1';
const SNAPSHOT_KEY = 'fatedrop:id:snapshot:v1';
const DEFAULT_WEB_URL = 'https://fatedrop.co.uk';

export type FateCapability =
  | 'browse_network'
  | 'selected_signals'
  | 'retailer_discovery'
  | 'true_price'
  | 'advanced_fate_match'
  | 'priority_alerts'
  | 'advanced_filters'
  | 'premium_discord'
  | 'fate_lock_eligibility';

export type FateDropIdentity = {
  id: string;
  fateId: string;
  email: string;
  handle: string | null;
  displayName: string | null;
  createdAt: number;
};

export type FateDropEntitlement = {
  configuredTier: 'free' | 'plus' | 'pro';
  effectiveTier: 'free' | 'plus' | 'pro';
  status: string;
  active: boolean;
  capabilities: FateCapability[];
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: number;
};

export type CrossPlatformWishlistItem = {
  id: string;
  userId: string;
  productIdentityId: string | null;
  query: string;
  title: string;
  tcg: string | null;
  imageUrl: string | null;
  source: string;
  createdAt: number;
  updatedAt: number;
};

export type CrossPlatformFateFind = Record<string, unknown> & { id: string; userId: string; enabled: boolean };

export type CrossPlatformNotificationPreferences = {
  echo: boolean;
  manifested: boolean;
  vanished: boolean;
  priceChange: boolean;
  fateMatch: boolean;
  web: boolean;
  push: boolean;
  discord: boolean;
  quietHours: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string;
  updatedAt: number;
};

export type FateDropSyncSnapshot = {
  contractVersion: 1;
  syncedAt: number;
  user: FateDropIdentity;
  entitlement: FateDropEntitlement;
  wishlist: CrossPlatformWishlistItem[];
  fateFinds: CrossPlatformFateFind[];
  notificationPreferences: CrossPlatformNotificationPreferences;
  pendingMigrations: string[];
};

type LoginResponse = FateDropSyncSnapshot & { sessionToken: string; expiresAt: number };

function baseUrl() {
  return (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/, '');
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error || `FateDrop request failed (${response.status})`);
  if (!data) throw new Error('FateDrop returned an empty response.');
  return data;
}

export async function getStoredSessionToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearStoredSession() {
  await Promise.all([AsyncStorage.removeItem(TOKEN_KEY), AsyncStorage.removeItem(SNAPSHOT_KEY)]);
}

export async function loadCachedIdentitySnapshot(): Promise<FateDropSyncSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FateDropSyncSnapshot;
    return parsed?.contractVersion === 1 ? parsed : null;
  } catch {
    return null;
  }
}

async function saveSnapshot(snapshot: FateDropSyncSnapshot) {
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export async function signInFateDropId(email: string, password: string) {
  const response = await fetch(`${baseUrl()}/api/mobile/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await parseJson<LoginResponse>(response);
  await AsyncStorage.setItem(TOKEN_KEY, result.sessionToken);
  const snapshot: FateDropSyncSnapshot = {
    contractVersion: 1,
    syncedAt: Math.floor(Date.now() / 1000),
    user: result.user,
    entitlement: result.entitlement,
    wishlist: result.wishlist || [],
    fateFinds: result.fateFinds || [],
    notificationPreferences: result.notificationPreferences,
    pendingMigrations: result.pendingMigrations || [],
  };
  return saveSnapshot(snapshot);
}

export async function signOutFateDropId() {
  const token = await getStoredSessionToken();
  if (token) {
    await fetch(`${baseUrl()}/api/mobile/session`, { method: 'DELETE', headers: { authorization: `Bearer ${token}`, accept: 'application/json' } }).catch(() => null);
  }
  await clearStoredSession();
}

export async function syncFateDropId(): Promise<FateDropSyncSnapshot> {
  const token = await getStoredSessionToken();
  if (!token) throw new Error('FateDrop ID sign-in required.');
  const response = await fetch(`${baseUrl()}/api/mobile/sync`, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (response.status === 401) {
    await clearStoredSession();
    throw new Error('Your FateDrop ID session expired. Please sign in again.');
  }
  return saveSnapshot(await parseJson<FateDropSyncSnapshot>(response));
}

export async function entitlementIsFresh(maxAgeSeconds = 300) {
  const snapshot = await loadCachedIdentitySnapshot();
  if (!snapshot) return false;
  return Math.floor(Date.now() / 1000) - snapshot.syncedAt <= maxAgeSeconds;
}

export function hasCapability(snapshot: FateDropSyncSnapshot | null, capability: FateCapability) {
  return Boolean(snapshot?.entitlement.active && snapshot.entitlement.capabilities.includes(capability));
}

async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const token = await getStoredSessionToken();
  if (!token) throw new Error('FateDrop ID sign-in required.');
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers, authorization: `Bearer ${token}` },
  });
  if (response.status === 401) await clearStoredSession();
  return response;
}

export async function saveRemoteWishlistItem(input: { productIdentityId?: string | null; query: string; title: string; tcg?: string | null; imageUrl?: string | null }) {
  const response = await authenticatedFetch('/api/wishlist', { method: 'POST', body: JSON.stringify(input) });
  await parseJson(response);
  return syncFateDropId();
}

export async function removeRemoteWishlistItem(id: string) {
  const response = await authenticatedFetch('/api/wishlist', { method: 'DELETE', body: JSON.stringify({ id }) });
  await parseJson(response);
  return syncFateDropId();
}

export async function saveRemoteFateFind(input: Record<string, unknown>) {
  const response = await authenticatedFetch('/api/fate-matches', { method: 'POST', body: JSON.stringify(input) });
  await parseJson(response);
  return syncFateDropId();
}

export async function updateRemoteNotificationPreferences(input: Partial<CrossPlatformNotificationPreferences>) {
  const response = await authenticatedFetch('/api/notification-preferences', { method: 'PATCH', body: JSON.stringify(input) });
  await parseJson(response);
  return syncFateDropId();
}
