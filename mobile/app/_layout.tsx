import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { router, Stack, type ErrorBoundaryProps, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import '@/lib/notifications';

import { ClosedBetaBoundary } from '@/components/closed-beta-boundary';
import { FirstRunTourBoundary } from '@/components/first-run-tour-boundary';
import { TcgOnboardingBoundary } from '@/components/tcg-onboarding-boundary';
import { PersistentBottomNav } from '@/components/persistent-bottom-nav';
import { PushRegistrationBoundary } from '@/components/push-registration-boundary';
import { LocalRadarOperatorNotice, type LocalRadarOperatorNoticeData } from '@/components/local-radar-operator-notice';
import { FateDropColors } from '@/constants/theme';
import { FateDropIdProvider, useFateDropId } from '@/contexts/fatedrop-id-context';
import { LocalRadarNoticeProvider, useLocalRadarNotice } from '@/contexts/local-radar-notice-context';
import { TcgCapabilitiesProvider } from '@/contexts/tcg-capabilities-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { safeExternalHttpsUrl } from '@/lib/external-url-security';
import { invalidateCanonicalAlertQueries } from '@/services/canonical-alert-query';
import type { CanonicalAlertStage } from '@/services/canonical-alerts';

export const unstable_settings = { anchor: '(tabs)' };

function notificationText(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function notificationCount(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0; }
function notificationBoolean(value: unknown) { return value === true || value === 'true' || value === 1 || value === '1'; }
function canonicalAlertStage(value: unknown): CanonicalAlertStage | null { const stage = notificationText(value).toUpperCase(); return stage === 'WHISPER' || stage === 'ECHO' || stage === 'MANIFESTED' || stage === 'VANISHED' ? stage : null; }

function operatorNoticeFromData(data: Record<string, unknown>): LocalRadarOperatorNoticeData {
  const stage = data.stage === 'WHISPER' || data.stage === 'ECHO' ? data.stage : '';
  return {
    localIntelId: notificationText(data.localIntelId),
    stage,
    presentationType: data.presentationType === 'big_fate_signal' ? 'big_fate_signal' : '',
    physicalEvidenceState: ['expected', 'reported', 'verified', 'expired'].includes(notificationText(data.physicalEvidenceState)) ? notificationText(data.physicalEvidenceState) as LocalRadarOperatorNoticeData['physicalEvidenceState'] : '',
    availabilityScope: notificationText(data.availabilityScope),
    availabilityVerified: notificationBoolean(data.availabilityVerified),
    retailerId: notificationText(data.retailerId),
    retailerName: notificationText(data.retailerName),
    retailerUrl: notificationText(data.retailerUrl),
    ctaLabel: notificationText(data.ctaLabel),
    productTitle: notificationText(data.productTitle),
    expectedFrom: notificationText(data.expectedFrom),
    expectedTo: notificationText(data.expectedTo),
    expectedLabel: notificationText(data.expectedLabel),
    branchCount: notificationCount(data.branchCount),
    evidenceObservedAt: notificationText(data.evidenceObservedAt),
    intelligenceSurfaceId: notificationText(data.intelligenceSurfaceId),
    radiusTargeted: notificationBoolean(data.radiusTargeted),
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

function FateDropShell() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const { snapshot } = useFateDropId();
  const { notice, collapsed, showNotice, collapseNotice, expandNotice, dismissNotice } = useLocalRadarNotice();
  const userId = snapshot?.user?.id ?? null;

  useEffect(() => {
    let active = true;
    let responseSubscription: { remove(): void } | undefined;
    let receivedSubscription: { remove(): void } | undefined;
    const handledResponses = new Set<string>();

    void import('expo-notifications')
      .then((Notifications) => {
        if (!active) return;

        const handleLocalRadarData = (data: Record<string, unknown>, navigateToRadar: boolean) => {
          showNotice(operatorNoticeFromData(data));
          if (navigateToRadar) router.push('/local-radar');
        };

        const invalidateAlertData = (data: Record<string, unknown>) => {
          if (!userId || data?.route !== 'alerts') return;
          invalidateCanonicalAlertQueries({
            accountId: userId,
            stage: canonicalAlertStage(data.stage),
            tcgCode: notificationText(data.tcgCode) || null,
          });
        };

        const handleOperatorEchoRetraction = (data: Record<string, unknown>) => {
          if (!userId || data.operatorEchoRetraction !== true) return false;
          invalidateCanonicalAlertQueries({ accountId: userId, stage: 'ECHO', tcgCode: null });
          return true;
        };

        const handleResponse = (response: Awaited<ReturnType<typeof Notifications.getLastNotificationResponseAsync>>) => {
          if (!active || !response) return;
          const identifier = response.notification.request.identifier;
          if (identifier && handledResponses.has(identifier)) return;
          if (identifier) handledResponses.add(identifier);

          const data = response.notification.request.content.data as Record<string, unknown>;
          if (handleOperatorEchoRetraction(data)) return;
          if (data?.route === 'local-radar') {
            handleLocalRadarData(data, true);
            return;
          }
          if (data?.route === 'local-radar-stock') {
            router.push('/local-radar-stock');
            return;
          }
          if (data?.route === 'alerts') {
            invalidateAlertData(data);
            router.push('/alerts');
            return;
          }
          const safeProductUrl = safeExternalHttpsUrl(response.notification.request.content.data?.productUrl);
          if (safeProductUrl) void Linking.openURL(safeProductUrl);
        };

        receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
          const data = notification.request.content.data as Record<string, unknown>;
          if (handleOperatorEchoRetraction(data)) return;
          if (data?.route === 'local-radar') handleLocalRadarData(data, false);
          if (data?.route === 'alerts') invalidateAlertData(data);
        });

        responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => { handleResponse(response); });

        void Notifications.getLastNotificationResponseAsync()
          .then((response) => {
            handleResponse(response);
            if (response) return Notifications.clearLastNotificationResponseAsync();
            return undefined;
          })
          .catch(() => null);
      })
      .catch(() => {
        // Expo Go does not provide full remote-push support on every platform.
        // Notification bootstrapping must never prevent the FateDrop shell from loading.
      });

    return () => {
      active = false;
      responseSubscription?.remove();
      receivedSubscription?.remove();
    };
  }, [showNotice, userId]);

  return <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="account" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="tcg-onboarding" options={{ headerShown: false, gestureEnabled: false }} />
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
      <Stack.Screen name="fate-price" options={{ headerShown: false }} />
      <Stack.Screen name="collection" options={{ headerShown: false }} />
      <Stack.Screen name="binder/[setId]" options={{ headerShown: false }} />
      <Stack.Screen name="graded-collection" options={{ headerShown: false }} />
      <Stack.Screen name="fatefind" options={{ headerShown: false }} />
      <Stack.Screen name="fate-match" options={{ headerShown: false }} />
      <Stack.Screen name="fate-trader" options={{ headerShown: false }} />
      <Stack.Screen name="local-radar" options={{ headerShown: false }} />
      <Stack.Screen name="local-radar-stock" options={{ headerShown: false }} />
      <Stack.Screen name="local-radar-events" options={{ headerShown: false }} />
      <Stack.Screen name="local-radar-store" options={{ headerShown: false }} />
      <Stack.Screen name="manual-echo-intake" options={{ headerShown: false }} />
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
    {pathname !== '/onboarding' && pathname !== '/tcg-onboarding' ? <PersistentBottomNav /> : null}
    {pathname === '/local-radar' && notice ? <LocalRadarOperatorNotice notice={notice} collapsed={collapsed} onCollapse={collapseNotice} onExpand={expandNotice} onDismiss={dismissNotice} /> : null}
    <StatusBar style="light" />
  </ThemeProvider>;
}

export default function RootLayout() {
  return <FateDropIdProvider><TcgCapabilitiesProvider>
    <PushRegistrationBoundary><ClosedBetaBoundary>
      <TcgOnboardingBoundary><FirstRunTourBoundary><LocalRadarNoticeProvider><FateDropShell /></LocalRadarNoticeProvider></FirstRunTourBoundary></TcgOnboardingBoundary>
    </ClosedBetaBoundary></PushRegistrationBoundary>
  </TcgCapabilitiesProvider></FateDropIdProvider>;
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
