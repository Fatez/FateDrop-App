import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PUSH_TOKEN_KEY } from '@/lib/watchlist';
import { getStoredSessionToken, syncFateDropId, updateRemoteNotificationPreferences } from '@/services/fatedrop-id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

const website = (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || 'https://fatedrop-web.fatedrop-web.workers.dev').replace(/\/$/, '');

export type DevelopmentSignalNotification = 'echo' | 'manifested' | 'vanished' | 'fatematch' | 'major';

const developmentNotificationCopy: Record<DevelopmentSignalNotification, { title: string; body: string }> = {
  echo: {
    title: 'FateDrop · Echo detected',
    body: 'Early movement detected. KAEL / NYRA is watching the signal.',
  },
  manifested: {
    title: 'FateDrop · Manifested',
    body: 'Confirmed availability detected. Stock is live.',
  },
  vanished: {
    title: 'FateDrop · Vanished',
    body: 'Observed availability has disappeared.',
  },
  fatematch: {
    title: 'FateDrop · FateMatch',
    body: 'An observed offer matches one of your hosted hunts.',
  },
  major: {
    title: 'FateDrop · Major signal',
    body: 'A high-priority confirmed signal has been detected.',
  },
};

async function ensureNotificationPermission() {
  if (!Device.isDevice) return { granted: false as const, reason: 'physical-device-required' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('stock-alerts', {
      name: 'FateDrop alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#A855F7',
      sound: 'default',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { granted: false as const, reason: 'permission-denied' };
  return { granted: true as const };
}

export async function scheduleDevelopmentSignalNotification(signal: DevelopmentSignalNotification, delaySeconds = 5) {
  if (!__DEV__) throw new Error('Development notification tests are disabled in production builds.');

  const permission = await ensureNotificationPermission();
  if (!permission.granted) return { scheduled: false as const, reason: permission.reason };

  const copy = developmentNotificationCopy[signal];
  const seconds = Math.max(1, Math.floor(delaySeconds));
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      sound: 'default',
      data: {
        route: 'alerts',
        testSignal: signal,
        source: 'development-local-notification',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
      ...(Platform.OS === 'android' ? { channelId: 'stock-alerts' } : {}),
    },
  });

  return { scheduled: true as const, identifier, delaySeconds: seconds };
}

export async function registerForStockAlerts() {
  const sessionToken = await getStoredSessionToken();
  if (!sessionToken) return { enabled: false, reason: 'fatedrop-id-required' };

  const permission = await ensureNotificationPermission();
  if (!permission.granted) return { enabled: false, reason: permission.reason };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { enabled: false, reason: 'eas-project-id-required' };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const response = await fetch(`${website}/api/mobile/push`, {
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
    await fetch(`${website}/api/mobile/push`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ token }),
    }).catch(() => null);
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  if (sessionToken) await updateRemoteNotificationPreferences({ push: false }).catch(() => null);
  return { enabled: false };
}
