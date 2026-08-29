import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FATEDROP_WEB_URL } from '@/constants/api';
import { PUSH_TOKEN_KEY } from '@/lib/watchlist';
import { getStoredSessionToken, syncFateDropId, updateRemoteNotificationPreferences } from '@/services/fatedrop-id';

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

export async function registerForStockAlerts() {
  const sessionToken = await getStoredSessionToken();
  if (!sessionToken) return { enabled: false, reason: 'fatedrop-id-required' };
  const permission = await ensureNotificationPermission();
  if (!permission.granted) return { enabled: false, reason: permission.reason };
  const projectId = expoProjectId();
  if (!projectId) return { enabled: false, reason: 'eas-project-id-required' };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const response = await fetch(`${FATEDROP_WEB_URL}/api/mobile/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ token, platform: Platform.OS, deviceLabel: Device.modelName || null }),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || `Push registration failed with HTTP ${response.status}`);
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  await updateRemoteNotificationPreferences({ push: true });
  await syncFateDropId();
  return { enabled: true, token };
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
      title: '[TEST] FateDrop · Local Radar · Incoming stock',
      body: 'Test Pokémon stock expected at 2 participating stores. Tap to inspect the Local Radar alert.',
      sound: 'default',
      data: {
        route: 'local-radar',
        localIntelId,
        stage: 'ECHO',
        retailerId: 'test-retailer',
        retailerName: 'Test Retailer',
        productTitle: '[TEST] Pokémon TCG incoming stock',
        expectedFrom,
        expectedTo,
        expectedLabel: 'TEST · Expected tomorrow',
        branchCount: 2,
        operatorIssue: 0,
        test: true,
        canary: true,
      },
    },
    trigger: null,
  });
  return { sent: true, localIntelId };
}
