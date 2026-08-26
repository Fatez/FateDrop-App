import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { FateDropColors } from '@/constants/theme';
import { FateDropIdProvider } from '@/contexts/fatedrop-id-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { safeExternalHttpsUrl } from '@/lib/safe-external-url';

export const unstable_settings = {
  anchor: '(tabs)',
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const safeMessage = __DEV__ && error.message ? error.message : 'FateDrop could not load this page.';
  return <View style={errorStyles.screen}>
    <Text style={errorStyles.title}>The signal was interrupted</Text>
    <Text style={errorStyles.message}>{safeMessage}</Text>
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
        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const productUrl = safeExternalHttpsUrl(response.notification.request.content.data?.productUrl);
          if (productUrl) void Linking.openURL(productUrl);
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
