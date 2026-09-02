import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FATEDROP_WEB_URL } from '@/constants/api';
import { PUSH_TOKEN_KEY } from '@/lib/watchlist';
import { getStoredSessionToken, syncFateDropId, updateRemoteNotificationPreferences } from '@/services/fatedrop-id';

const PUSH_REGISTRATION_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

let lastRegistrationRefreshAt = 0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

function expoProjectId() {
  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    || Constants.expoConfig?.extra?.eas?.projectId
    || Constants.easConfig?.projectId
    || null;
}

async function ensureNotificationPermission() {
  if (!Device.isDevice) return { granted: false, reason: 'physical-device-required' as const };
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { granted: false, reason: 'permission-denied' as const };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('stock-alerts', {
      name: 'FateDrop alerts', importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250], lightColor: '#A855F7', sound: 'default',
    });
  }
  return { granted: true as const };
}

async function postPushEndpoint(sessionToken: string, token: string) {
  const response = await fetch(`${FATEDROP_WEB_URL}/api/mobile/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ token, platform: Platform.OS, deviceLabel: Device.modelName || null }),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || `Push registration failed with HTTP ${response.status}`);
}

async function retirePreviousEndpoint(sessionToken: string, previousToken: string | null, currentToken: string) {
  if (!previousToken || previousToken === currentToken) return;
  await fetch(`${FATEDROP_WEB_URL}/api/mobile/push`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ token: previousToken }),
  }).catch(() => null);
}

async function acquireAndPersistExpoPushToken(sessionToken: string) {
  const projectId = expoProjectId();
  if (!projectId) return { enabled: false, reason: 'eas-project-id-required' as const };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const previousToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

  // Register the replacement before retiring the old endpoint so a transient
  // network failure cannot leave the account with no enabled device endpoint.
  await postPushEndpoint(sessionToken, token);
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  await retirePreviousEndpoint(sessionToken, previousToken, token);
  lastRegistrationRefreshAt = Date.now();
  return { enabled: true, token };
}

export async function registerForStockAlerts() {
  const sessionToken = await getStoredSessionToken();
  if (!sessionToken) return { enabled: false, reason: 'fatedrop-id-required' };
  const permission = await ensureNotificationPermission();
  if (!permission.granted) return { enabled: false, reason: permission.reason };
  const registration = await acquireAndPersistExpoPushToken(sessionToken);
  if (!registration.enabled) return registration;
  await updateRemoteNotificationPreferences({ push: true });
  await syncFateDropId();
  return registration;
}

export async function refreshStockAlertRegistration({ force = false }: { force?: boolean } = {}) {
  if (!Device.isDevice) return { refreshed: false, reason: 'physical-device-required' as const };
  if (!force && Date.now() - lastRegistrationRefreshAt < PUSH_REGISTRATION_REFRESH_INTERVAL_MS) {
    return { refreshed: false, reason: 'recently-refreshed' as const };
  }
  const [sessionToken, permission] = await Promise.all([
    getStoredSessionToken(),
    Notifications.getPermissionsAsync(),
  ]);
  if (!sessionToken) return { refreshed: false, reason: 'fatedrop-id-required' as const };
  if (permission.status !== 'granted') return { refreshed: false, reason: 'permission-not-granted' as const };
  const registration = await acquireAndPersistExpoPushToken(sessionToken);
  return registration.enabled
    ? { refreshed: true, token: registration.token }
    : { refreshed: false, reason: registration.reason };
}

export async function stockAlertDeviceReadiness() {
  const permission = await Notifications.getPermissionsAsync();
  return {
    physicalDevice: Device.isDevice,
    permission: permission.status,
    iosAllowsAlert: permission.ios?.allowsAlert !== false,
    iosAllowsSound: permission.ios?.allowsSound !== false,
    iosAllowsBadge: permission.ios?.allowsBadge !== false,
    easProjectConfigured: Boolean(expoProjectId()),
  };
}

export async function unregisterStockAlerts() {
  const [sessionToken, token] = await Promise.all([getStoredSessionToken(), AsyncStorage.getItem(PUSH_TOKEN_KEY)]);
  if (sessionToken && token) {
    await fetch(`${FATEDROP_WEB_URL}/api/mobile/push`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ token }),
    }).catch(() => null);
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  if (sessionToken) await updateRemoteNotificationPreferences({ push: false }).catch(() => null);
  return { enabled: false };
}

export async function sendLocalRadarPresentationTest() {
  const permission = await ensureNotificationPermission();
  if (!permission.granted) return { sent: false, reason: permission.reason };

  const now = Date.now();
  const expectedFrom = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  const expectedTo = new Date(now + 48 * 60 * 60 * 1000).toISOString();
  const localIntelId = `local-radar-presentation-test:${now}`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Big Fate Signal · Echo',
      body: 'Official allocation intelligence names 2 participating branches inside your test radius.',
      sound: 'default',
      data: {
        route: 'local-radar',
        localIntelId,
        stage: 'ECHO',
        presentationType: 'big_fate_signal',
        physicalEvidenceState: 'expected',
        availabilityScope: 'physical_branch',
        availabilityVerified: false,
        retailerId: 'the-entertainer',
        retailerName: 'The Entertainer',
        retailerUrl: 'https://www.thetoyshop.com/pokemon-at-the-entertainer',
        ctaLabel: 'CHECK YOUR LOCAL ENTERTAINER',
        productTitle: '[TEST] Pokémon TCG 30th Celebration',
        expectedFrom,
        expectedTo,
        expectedLabel: 'TEST · Expected tomorrow',
        branchCount: 2,
        evidenceObservedAt: new Date(now).toISOString(),
        intelligenceSurfaceId: 'entertainer-pokemon-drop-hub',
        radiusTargeted: true,
        operatorIssue: 0,
        test: true,
        canary: true,
      },
    },
    trigger: null,
  });
  return { sent: true, localIntelId };
}
