import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { FateDropColors } from '@/constants/theme';
import { CompanionProvider } from '@/contexts/companion-context';
import { FateDropIdProvider } from '@/contexts/fatedrop-id-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <View style={errorStyles.screen}>
    <Text style={errorStyles.title}>The signal was interrupted</Text>
    <Text style={errorStyles.message}>{error.message || 'FateDrop could not load this page.'}</Text>
    <Pressable onPress={retry} style={errorStyles.primary}><Text style={errorStyles.primaryText}>Try again</Text></Pressable>
    <Pressable onPress={() => router.replace('/')} style={errorStyles.secondary}><Text style={errorStyles.secondaryText}>Return home</Text></Pressable>
  </View>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    let active = true;
    let subscription: { remove(): void } | undefined;

    void import('expo-notifications')
      .then((Notifications) => {
        if (!active) return;
        const handledNotificationIds = new Set<string>();

        const redirectFromResponse = (response: {
          notification: {
            request: {
              identifier: string;
              content: { data: Record<string, unknown> };
            };
          };
        }) => {
          const notificationId = response.notification.request.identifier;
          if (handledNotificationIds.has(notificationId)) return;
          handledNotificationIds.add(notificationId);

          const data = response.notification.request.content.data;
          if (data?.route === 'alerts') {
            const alertId = typeof data.alertId === 'string' ? data.alertId : null;
            if (alertId) router.push({ pathname: '/alerts', params: { alertId } });
            else router.push('/alerts');
          } else {
            const productUrl = data?.productUrl;
            if (typeof productUrl === 'string' && /^https?:\/\//i.test(productUrl)) void Linking.openURL(productUrl);
          }

          void Notifications.clearLastNotificationResponseAsync().catch(() => null);
        };

        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          redirectFromResponse(response);
        });

        // Expo recommends checking the initial response as well as listening for
        // future taps so a notification opened from a terminated app still lands
        // on the exact canonical alert.
        const initialResponse = Notifications.getLastNotificationResponse();
        if (initialResponse) redirectFromResponse(initialResponse);
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
      <CompanionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="account" options={{ headerShown: false }} />
            <Stack.Screen name="companion" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="encounters/index" options={{ headerShown: false }} />
            <Stack.Screen name="encounters/detail" options={{ headerShown: false }} />
            <Stack.Screen name="encounters/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="retailer-partners" options={{ headerShown: false }} />
            <Stack.Screen name="retailers/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="true-price" options={{ headerShown: false }} />
            <Stack.Screen name="fatefind" options={{ headerShown: false }} />
            <Stack.Screen name="local-radar" options={{ headerShown: false }} />
            <Stack.Screen name="event-vendors" options={{ headerShown: false }} />
            <Stack.Screen name="retailer-dashboard" options={{ headerShown: false }} />
            <Stack.Screen name="fatescore" options={{ headerShown: false }} />
            <Stack.Screen name="reserve-demo" options={{ headerShown: false }} />
            <Stack.Screen name="basket-breaker" options={{ headerShown: false }} />
            <Stack.Screen name="fatebounty" options={{ headerShown: false }} />
            <Stack.Screen name="demand-signal" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </CompanionProvider>
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