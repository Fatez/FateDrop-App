import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { PersistentBottomNav } from '@/components/persistent-bottom-nav';
import { LocalRadarOperatorNotice, type LocalRadarOperatorNoticeData } from '@/components/local-radar-operator-notice';
import { FateDropColors } from '@/constants/theme';
import { FateDropIdProvider } from '@/contexts/fatedrop-id-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { safeExternalHttpsUrl } from '@/lib/external-url-security';

export const unstable_settings = {
  anchor: '(tabs)',
};

function notificationText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function notificationCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function operatorNoticeFromData(data: Record<string, unknown>): LocalRadarOperatorNoticeData {
  const stage = data.stage === 'WHISPER' || data.stage === 'ECHO' ? data.stage : '';
  return {
    localIntelId: notificationText(data.localIntelId),
    stage,
    retailerName: notificationText(data.retailerName),
    productTitle: notificationText(data.productTitle),
    expectedFrom: notificationText(data.expectedFrom),
    expectedTo: notificationText(data.expectedTo),
    expectedLabel: notificationText(data.expectedLabel),
    branchCount: notificationCount(data.branchCount),
  };
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <View style={errorStyles.screen}>
    <Text style={errorStyles.title}>The signal was interrupted</Text>
    <Text style={errorStyles.message}>FateDrop could not load this page. Try again, or return home.</Text>
    <Pressable onPress={retry} style={errorStyles.primary}><Text style={errorStyles.primaryText}>Try again</Text></Pressable>
    <Pressable onPress={() => router.replace('/')} style={errorStyles.secondary}><Text style={errorStyles.secondaryText}>Return home</Text></Pressable>
  </View>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [localRadarNotice, setLocalRadarNotice] = useState<LocalRadarOperatorNoticeData | null>(null);
  const [localRadarNoticeCollapsed, setLocalRadarNoticeCollapsed] = useState(false);

  useEffect(() => {
    let active = true;
    let subscription: { remove(): void } | undefined;

    void import('expo-notifications')
      .then((Notifications) => {
        if (!active) return;
        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as Record<string, unknown>;
          if (data?.route === 'local-radar') {
            setLocalRadarNotice(operatorNoticeFromData(data));
            setLocalRadarNoticeCollapsed(false);
            router.push('/local-radar');
            return;
          }
          const safeProductUrl = safeExternalHttpsUrl(response.notification.request.content.data?.productUrl);
          if (safeProductUrl) void Linking.openURL(safeProductUrl);
        });
      })
      .catch(() => {
        // Expo Go does not provide full remote-push support on every platform.
        // Notification bootstrapping must never prevent the FateDrop shell from loading.
      });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return (
    <FateDropIdProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="account" options={{ headerShown: false }} />
          <Stack.Screen name="companion/index" options={{ headerShown: false }} />
          <Stack.Screen name="profile-customisation" options={{ headerShown: false }} />
          <Stack.Screen name="stories" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="tools" options={{ headerShown: false }} />
          <Stack.Screen name="demo" options={{ headerShown: false }} />
          <Stack.Screen name="encounters/index" options={{ headerShown: false }} />
          <Stack.Screen name="encounters/detail" options={{ headerShown: false }} />
          <Stack.Screen name="encounters/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="retailer-partners" options={{ headerShown: false }} />
          <Stack.Screen name="retailers/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="true-price" options={{ headerShown: false }} />
          <Stack.Screen name="fatefind" options={{ headerShown: false }} />
          <Stack.Screen name="fate-match" options={{ headerShown: false }} />
          <Stack.Screen name="fate-trader" options={{ headerShown: false }} />
          <Stack.Screen name="local-radar" options={{ headerShown: false }} />
          <Stack.Screen name="local-radar-stock" options={{ headerShown: false }} />
          <Stack.Screen name="local-radar-events" options={{ headerShown: false }} />
          <Stack.Screen name="local-radar-store" options={{ headerShown: false }} />
          <Stack.Screen name="notification-preferences" options={{ headerShown: false }} />
          <Stack.Screen name="dashboard" options={{ headerShown: false }} />
          <Stack.Screen name="event-vendors" options={{ headerShown: false }} />
          <Stack.Screen name="retailer-dashboard" options={{ headerShown: false }} />
          <Stack.Screen name="fatescore" options={{ headerShown: false }} />
          <Stack.Screen name="reserve-demo" options={{ headerShown: false }} />
          <Stack.Screen name="basket-breaker" options={{ headerShown: false }} />
          <Stack.Screen name="fatebounty" options={{ headerShown: false }} />
          <Stack.Screen name="demand-signal" options={{ headerShown: false }} />
        </Stack>
        <PersistentBottomNav />
        {localRadarNotice ? <LocalRadarOperatorNotice
          notice={localRadarNotice}
          collapsed={localRadarNoticeCollapsed}
          onCollapse={() => setLocalRadarNoticeCollapsed(true)}
          onExpand={() => setLocalRadarNoticeCollapsed(false)}
          onDismiss={() => setLocalRadarNotice(null)}
        /> : null}
        <StatusBar style="light" />
      </ThemeProvider>
    </FateDropIdProvider>
  );
}

const errorStyles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: FateDropColors.background },
  title: { color: FateDropColors.text, fontSize: 24, fontWeight: '900' },
  message: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 20, marginVertical: 12 },
  primary: { alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: FateDropColors.violet },
  primaryText: { color: FateDropColors.text, fontWeight: '900' },
  secondary: { alignItems: 'center', padding: 14, marginTop: 9 },
  secondaryText: { color: FateDropColors.violetLight, fontWeight: '800' },
});
