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

export async function registerForStockAlerts() {
  const sessionToken = await getStoredSessionToken();
  if (!sessionToken) return { enabled: false, reason: 'fatedrop-id-required' };
  if (!Device.isDevice) return { enabled: false, reason: 'physical-device-required' };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('stock-alerts', {
      name: 'FateDrop alerts', importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250], lightColor: '#A855F7', sound: 'default',
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { enabled: false, reason: 'permission-denied' };
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

export async function sendVanishedPresentationTest() {
  if (!Device.isDevice) return { sent: false, reason: 'physical-device-required' };
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { sent: false, reason: 'permission-denied' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('stock-alerts', {
      name: 'FateDrop alerts', importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250], lightColor: '#A855F7', sound: 'default',
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '[TEST] FateDrop · Vanished',
      body: 'Vanished presentation test — a previously verified signal is no longer available.',
      sound: 'default',
      data: { stage: 'VANISHED', test: true },
    },
    trigger: null,
  });
  return { sent: true };
}
