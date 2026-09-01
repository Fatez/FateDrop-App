import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { TCG_REGISTRY } from '@/constants/tcg-registry';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { registerForStockAlerts, sendLocalRadarPresentationTest, stockAlertDeviceReadiness, unregisterStockAlerts } from '@/lib/notifications';
import {
  FALLBACK_ALERT_LANGUAGES,
  FALLBACK_ALERT_MARKETS,
  fetchAlertFacetOptions,
  type AlertFacetOptions,
  type AlertLanguageGroup,
} from '@/services/alert-facets';
import { updateRemoteNotificationPreferences } from '@/services/fatedrop-id';
import {
  LIFECYCLE_MARKET_GROUPS,
  nextLifecycleMarketSelection,
  type LifecycleMarketGroup,
  type LifecycleMarketStage,
} from '@/services/notification-preference-contract';

type PreferenceKey = 'whisper' | 'echo' | 'manifested' | 'vanished' | 'fateMatch' | 'priceChange' | 'manifestedReminders' | 'sealedTcg' | 'singleCards' | 'accessories' | 'merchandise' | 'unknownProducts' | 'english' | 'japanese' | 'korean' | 'simplifiedChinese' | 'traditionalChinese' | 'otherLanguages' | 'unknownLanguage' | 'allSets' | 'unknownSets' | 'web' | 'discord';

const signalRows: { key: PreferenceKey; title: string; detail: string }[] = [
  { key: 'whisper', title: 'Whisper', detail: 'Product or catalogue movement before stock is confirmed.' },
  { key: 'echo', title: 'Echo', detail: 'Retailer readiness, credible physical movement and branch stock intelligence.' },
  { key: 'manifested', title: 'Manifested', detail: 'Verified purchasable availability.' },
  { key: 'vanished', title: 'Vanished', detail: 'Previously verified availability is no longer present.' },
  { key: 'fateMatch', title: 'FateMatch', detail: 'A FateMatch hunt has found a qualifying live offer.' },
  { key: 'priceChange', title: 'Price change', detail: 'Relevant movement in observed item pricing.' },
];
const productRows: { key: PreferenceKey; title: string; detail: string }[] = [
  { key: 'sealedTcg', title: 'Sealed TCG & decks', detail: 'ETBs, booster products, tins, collections and deck products.' },
  { key: 'singleCards', title: 'Single & promo cards', detail: 'Individual card and promo-card alerts.' },
  { key: 'accessories', title: 'Accessories', detail: 'Sleeves, binders, playmats, deck boxes and protection.' },
  { key: 'merchandise', title: 'Merchandise', detail: 'Pins, plush, figures, clothing and other non-TCG merchandise.' },
  { key: 'unknownProducts', title: 'Unknown products', detail: 'Keep ambiguous listings visible until FateDrop can classify them confidently.' },
];
const surfaceRows: { key: PreferenceKey; title: string; detail: string }[] = [
  { key: 'web', title: 'Web inbox', detail: 'Keep eligible alert history available on the FateDrop dashboard.' },
  { key: 'discord', title: 'Discord', detail: 'Allow eligible alerts to use your linked Discord delivery preferences.' },
];
const lifecycleMarketRows: { key: LifecycleMarketStage; title: string; detail: string }[] = [
  { key: 'whisper', title: 'Whisper', detail: 'Early product and catalogue evidence.' },
  { key: 'echo', title: 'Echo', detail: 'Retailer readiness and traffic evidence.' },
  { key: 'manifested', title: 'Manifested', detail: 'Verified purchasable stock.' },
  { key: 'vanished', title: 'Vanished', detail: 'Previously verified stock ending.' },
];
const languagePreferenceKey: Record<AlertLanguageGroup, PreferenceKey> = {
  english: 'english',
  japanese: 'japanese',
  korean: 'korean',
  simplified_chinese: 'simplifiedChinese',
  traditional_chinese: 'traditionalChinese',
  other: 'otherLanguages',
  unknown: 'unknownLanguage',
};

function pushStatusMessage(result: { enabled: boolean; reason?: string }) {
  if (result.enabled) return 'Push notifications enabled on this device.';
  if (result.reason === 'permission-denied') return 'Push is off because notification permission was denied on this device.';
  if (result.reason === 'physical-device-required') return 'Push registration requires a physical device.';
  if (result.reason === 'fatedrop-id-required') return 'Sign in with FateDrop ID before enabling push.';
  if (result.reason === 'eas-project-id-required') return 'Push setup is incomplete: this app build is missing its Expo/EAS project ID.';
  return 'Push notifications disabled on this device.';
}

export default function NotificationPreferencesScreen() {
  const { snapshot, signedIn, refresh, syncing } = useFateDropId();
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [facetOptions, setFacetOptions] = useState<AlertFacetOptions>({ languages: FALLBACK_ALERT_LANGUAGES, markets: FALLBACK_ALERT_MARKETS, sets: [] });
  const [facetError, setFacetError] = useState<string | null>(null);
  const [setSearch, setSetSearch] = useState('');
  const [deviceWarning, setDeviceWarning] = useState<string | null>(null);
  const preferences = snapshot?.notificationPreferences;
  const visibleSets = useMemo(() => {
    const query = setSearch.trim().toLowerCase();
    if (!query) return facetOptions.sets;
    return facetOptions.sets.filter((set) => set.name.toLowerCase().includes(query) || set.key.includes(query));
  }, [facetOptions.sets, setSearch]);
  const marketOptions = useMemo(() => {
    const labels = new Map((facetOptions.markets ?? FALLBACK_ALERT_MARKETS).map(({ key, label }) => [key, label]));
    return LIFECYCLE_MARKET_GROUPS.map((key) => ({ key, label: labels.get(key) ?? key }));
  }, [facetOptions.markets]);

  useEffect(() => {
    let active = true;
    fetchAlertFacetOptions()
      .then((options) => { if (active) { setFacetOptions(options); setFacetError(null); } })
      .catch((cause) => { if (active) setFacetError(cause instanceof Error ? cause.message : 'The live set registry is temporarily unavailable.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void stockAlertDeviceReadiness().then((readiness) => {
      if (!active) return;
      if (!readiness.physicalDevice) setDeviceWarning('Push requires a physical device.');
      else if (!readiness.easProjectConfigured) setDeviceWarning('This build is not linked to the canonical FateDrop push project.');
      else if (readiness.permission !== 'granted') setDeviceWarning('iPhone notification permission is not granted.');
      else if (!readiness.iosAllowsAlert) setDeviceWarning('iPhone banners and Notification Centre alerts are disabled for FateDrop.');
      else if (!readiness.iosAllowsSound) setDeviceWarning('FateDrop alarms may arrive silently because iPhone sounds are disabled.');
      else setDeviceWarning(null);
    }).catch(() => null);
    return () => { active = false; };
  }, [preferences?.push]);

  const toggle = async (key: PreferenceKey) => {
    if (!preferences || working) return;
    setWorking(key);
    setMessage(null);
    try {
      await updateRemoteNotificationPreferences({ [key]: !preferences[key] });
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Preference could not be updated.');
    } finally {
      setWorking(null);
    }
  };

  const toggleSet = async (setKey: string) => {
    if (!preferences || working) return;
    const selectedSetKeys = preferences.selectedSetKeys.includes(setKey)
      ? preferences.selectedSetKeys.filter((key) => key !== setKey)
      : [...preferences.selectedSetKeys, setKey].sort();
    setWorking(`set:${setKey}`);
    setMessage(null);
    try {
      await updateRemoteNotificationPreferences({ selectedSetKeys });
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Set preference could not be updated.');
    } finally {
      setWorking(null);
    }
  };

  const setReminderCap=async(value:number)=>{if(!preferences||working)return;setWorking('manifested-reminder-cap');setMessage(null);try{await updateRemoteNotificationPreferences({manifestedRemindersMaxPerDay:value});await refresh();}catch(cause){setMessage(cause instanceof Error?cause.message:'Reminder cap could not be updated.');}finally{setWorking(null);}};

  const toggleLifecycleMarket = async (stage: LifecycleMarketStage, market: 'all' | LifecycleMarketGroup) => {
    if (!preferences || working) return;
    const next = nextLifecycleMarketSelection(preferences.lifecycleMarkets[stage], market);
    setWorking(`market:${stage}:${market}`);
    setMessage(null);
    try {
      await updateRemoteNotificationPreferences({ lifecycleMarkets: { [stage]: next } });
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Market preference could not be updated.');
    } finally {
      setWorking(null);
    }
  };

  const togglePush = async () => {
    if (!preferences || working) return;
    setWorking('push');
    setMessage(null);
    try {
      const result = preferences.push ? await unregisterStockAlerts() : await registerForStockAlerts();
      setMessage(pushStatusMessage(result));
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Push preference could not be updated.');
    } finally {
      setWorking(null);
    }
  };

  const testLocalRadar = async () => {
    if (working) return;
    setWorking('test-local-radar');
    setMessage(null);
    try {
      const result = await sendLocalRadarPresentationTest();
      if (result.sent) setMessage('Big Fate Signal TEST alert sent. Tap the banner to inspect the Echo card, retailer link and Local Radar handoff.');
      else if (result.reason === 'permission-denied') setMessage('Local Radar test could not run because iOS notification permission is off.');
      else setMessage('Local Radar test requires a physical device.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Local Radar test could not be sent.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader title="Notifications" subtitle="DELIVERY PREFERENCES" rightAction={<Pressable onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={19} color={FateDropColors.text} /></Pressable>} />
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>CONTROL DELIVERY · NOT DETECTION</Text>
          <Text style={styles.title}>Choose what reaches you.</Text>
          <Text style={styles.copy}>The Signal Engine can still observe network activity when a delivery preference is off. These settings control your notification surfaces, not the underlying evidence.</Text>
        </View>

        {!signedIn || !preferences ? <View style={styles.empty}><Text style={styles.emptyTitle}>FateDrop ID required</Text><Text style={styles.emptyCopy}>Sign in before changing account-level delivery preferences.</Text><Pressable onPress={() => router.push('/account')} style={styles.primary}><Text style={styles.primaryText}>SIGN IN</Text></Pressable></View> : <>
          <Text style={styles.sectionLabel}>MY TCGS</Text>
          <View style={styles.explainer}><Text style={styles.explainerTitle}>{(snapshot?.tcgPreferences.selectedTcgCodes ?? ['pokemon']).map((code) => TCG_REGISTRY.find((entry) => entry.code === code)?.shortName ?? code).join(' · ')}</Text><Text style={styles.explainerCopy}>Change your selected games and each game’s lifecycle choices. This never turns the entire app into a global game mode.</Text><Pressable onPress={() => router.push('/tcg-onboarding')} style={styles.primary}><Text style={styles.primaryText}>EDIT MY TCGS & ALERTS</Text></Pressable></View>

          <Text style={styles.sectionLabel}>DEVICE</Text>
          <PreferenceRow title="Push on this device" detail="Native device alert permission and FateDrop push registration." enabled={Boolean(preferences.push)} disabled={Boolean(working)} onPress={() => void togglePush()} />
          {deviceWarning ? <Pressable onPress={() => void Linking.openSettings()} style={styles.deviceWarning}><Ionicons name="warning-outline" size={17} color={FateDropColors.manifested} /><View style={styles.rowCopy}><Text style={styles.deviceWarningTitle}>IPHONE DELIVERY NEEDS ATTENTION</Text><Text style={styles.rowDetail}>{deviceWarning} Tap to open Settings.</Text></View></Pressable> : null}
          <Pressable disabled={Boolean(working)} onPress={() => void testLocalRadar()} style={({ pressed }) => [styles.localRadarTestRow, pressed && styles.pressed]}>
            <View style={styles.localRadarTestIcon}><Ionicons name="radio-outline" size={17} color={FateDropColors.cyan} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.localRadarTestTitle}>{working === 'test-local-radar' ? 'Sending Local Radar test…' : 'TEST LOCAL RADAR ALERT'}</Text>
              <Text style={styles.rowDetail}>QA only · fires the real Big Fate Signal route and Echo card without creating stock data or claiming availability.</Text>
            </View>
          </Pressable>

          <Text style={styles.sectionLabel}>ALERT TYPES</Text>
          {signalRows.map((row) => <PreferenceRow key={row.key} title={row.title} detail={row.detail} enabled={Boolean(preferences[row.key])} disabled={Boolean(working)} onPress={() => void toggle(row.key)} />)}

          <Text style={styles.sectionLabel}>MANIFESTED AVAILABILITY REMINDERS</Text>
          <View style={styles.explainer}><Text style={styles.explainerTitle}>Keep outstanding stock visible without inventing another drop.</Text><Text style={styles.explainerCopy}>Off by default. A reminder requires the same open canonical stock episode and fresh re-confirmation; it never creates a second Manifested event.</Text></View>
          <PreferenceRow title="Still observed available" detail="Optional, quiet-hours-aware engagement reminder." enabled={preferences.manifestedReminders} disabled={Boolean(working)} onPress={() => void toggle('manifestedReminders')} />
          {preferences.manifestedReminders?<View style={styles.marketStage}><View style={styles.marketStageHead}><View style={styles.rowCopy}><Text style={styles.rowTitle}>Daily cap</Text><Text style={styles.rowDetail}>Maximum reminders in a rolling 24-hour window.</Text></View></View><View style={styles.marketPills}>{[1,2,3].map((value)=><MarketPill key={value} title={`${value}/day`} enabled={preferences.manifestedRemindersMaxPerDay===value} disabled={Boolean(working)} onPress={()=>void setReminderCap(value)}/>)}</View></View>:null}

          <Text style={styles.sectionLabel}>SMART PRODUCT FILTER</Text>
          <View style={styles.explainer}><Text style={styles.explainerTitle}>Monitor everything. Interrupt selectively.</Text><Text style={styles.explainerCopy}>Accessories and merchandise default off. Unknown products stay on so uncertain classification fails safely.</Text></View>
          {productRows.map((row) => <PreferenceRow key={row.key} title={row.title} detail={row.detail} enabled={Boolean(preferences[row.key])} disabled={Boolean(working)} onPress={() => void toggle(row.key)} />)}

          <Text style={styles.sectionLabel}>CARD MARKETS BY ALERT</Text>
          <View style={styles.explainer}><Text style={styles.explainerTitle}>Choose source markets independently for every signal.</Text><Text style={styles.explainerCopy}>Market comes from verified identity and memory—not listing language. An English-written Gem Pack listing can still remain Mainland China.</Text></View>
          {lifecycleMarketRows.map((row) => {
            const selection = preferences.lifecycleMarkets[row.key];
            return <View key={row.key} style={styles.marketStage}>
              <View style={styles.marketStageHead}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{row.title}</Text><Text style={styles.rowDetail}>{row.detail}</Text></View><Text style={styles.marketStageStatus}>{selection === 'all' ? 'ALL MARKETS' : `${selection.length} SELECTED`}</Text></View>
              <View style={styles.marketPills}>
                <MarketPill title="All" enabled={selection === 'all'} disabled={Boolean(working)} onPress={() => void toggleLifecycleMarket(row.key, 'all')} />
                {marketOptions.map((market) => <MarketPill key={market.key} title={market.label} enabled={selection !== 'all' && selection.includes(market.key)} disabled={Boolean(working)} onPress={() => void toggleLifecycleMarket(row.key, market.key)} />)}
              </View>
            </View>;
          })}

          <Text style={styles.sectionLabel}>LISTING LANGUAGE</Text>
          <View style={styles.explainer}><Text style={styles.explainerTitle}>Control language separately from market.</Text><Text style={styles.explainerCopy}>Language can filter delivery, but it never decides which market or country a product belongs to.</Text></View>
          {facetOptions.languages.map((language) => {
            const key = languagePreferenceKey[language.key];
            const detail = language.key === 'english' ? 'Listings verified as English-language products.' : language.key === 'unknown' ? 'Listings whose product language cannot yet be verified.' : `${language.label} language products.`;
            return <PreferenceRow key={language.key} title={language.label} detail={detail} enabled={Boolean(preferences[key])} disabled={Boolean(working)} onPress={() => void toggle(key)} />;
          })}

          <Text style={styles.sectionLabel}>SETS</Text>
          <View style={styles.explainer}><Text style={styles.explainerTitle}>Follow everything or build a precise set watch.</Text><Text style={styles.explainerCopy}>Set matching comes from Cloud evidence. Products without a reliable match remain Unknown.</Text></View>
          <PreferenceRow title="All recognised sets" detail="Automatically include current and newly added sets." enabled={preferences.allSets} disabled={Boolean(working)} onPress={() => void toggle('allSets')} />
          {!preferences.allSets ? <>
            <PreferenceRow title="Unknown sets" detail="Keep products visible when FateDrop cannot safely identify their set." enabled={preferences.unknownSets} disabled={Boolean(working)} onPress={() => void toggle('unknownSets')} />
            <View style={styles.setSummary}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{preferences.selectedSetKeys.length} selected</Text><Text style={styles.rowDetail}>{facetOptions.sets.length ? 'Choose recognised sets below.' : 'Saved selections are preserved while the live registry is unavailable.'}</Text></View></View>
            {facetOptions.sets.length ? <TextInput accessibilityLabel="Search sets" autoCapitalize="none" autoCorrect={false} onChangeText={setSetSearch} placeholder="Search recognised sets" placeholderTextColor={FateDropColors.muted} style={styles.search} value={setSearch} /> : null}
            {visibleSets.map((set) => <SetRow key={set.key} title={set.name} setKey={set.key} enabled={preferences.selectedSetKeys.includes(set.key)} disabled={Boolean(working)} onPress={() => void toggleSet(set.key)} />)}
            {facetOptions.sets.length && visibleSets.length === 0 ? <Text style={styles.noSets}>No recognised sets match that search.</Text> : null}
            {facetError ? <Text style={styles.facetError}>{facetError}</Text> : null}
          </> : null}

          <Text style={styles.sectionLabel}>SURFACES</Text>
          {surfaceRows.map((row) => <PreferenceRow key={row.key} title={row.title} detail={row.detail} enabled={Boolean(preferences[row.key])} disabled={Boolean(working)} onPress={() => void toggle(row.key)} />)}

          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Text style={styles.sync}>{syncing ? 'Syncing with FateDrop ID…' : 'Preferences are stored against your FateDrop ID.'}</Text>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function PreferenceRow({ title, detail, enabled, disabled, onPress }: { title: string; detail: string; enabled: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><View style={[styles.switch, enabled && styles.switchOn]}><View style={[styles.knob, enabled && styles.knobOn]} /></View></Pressable>;
}

function SetRow({ title, setKey, enabled, disabled, onPress }: { title: string; setKey: string; enabled: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.setRow, pressed && styles.pressed]}><View style={[styles.checkbox, enabled && styles.checkboxOn]}>{enabled ? <Ionicons name="checkmark" size={14} color={FateDropColors.text} /> : null}</View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{setKey}</Text></View></Pressable>;
}

function MarketPill({ title, enabled, disabled, onPress }: { title: string; enabled: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: enabled, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.marketPill, enabled && styles.marketPillOn, pressed && styles.pressed]}><Text style={[styles.marketPillText, enabled && styles.marketPillTextOn]}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 80 },
  close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  hero: { padding: 20, marginBottom: 20, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(168,85,247,.22)', backgroundColor: 'rgba(10,11,18,.92)' },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: FateDropColors.text, fontSize: 27, lineHeight: 30, fontWeight: '900', letterSpacing: -0.7, marginTop: 7 },
  copy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 8 },
  sectionLabel: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.4, marginTop: 8, marginBottom: 7 },
  explainer: { padding: 14, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: `${FateDropColors.cyan}22`, backgroundColor: `${FateDropColors.cyan}08` },
  explainerTitle: { color: FateDropColors.text, fontSize: 11, fontWeight: '900' },
  explainerCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.9)' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 7, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.9)' },
  marketStage: { padding: 14, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.9)' },
  marketStageHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11 },
  marketStageStatus: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: .7 },
  marketPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  marketPill: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  marketPillOn: { borderColor: FateDropColors.violet, backgroundColor: 'rgba(124,58,237,.24)' },
  marketPillText: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '900' },
  marketPillTextOn: { color: FateDropColors.text },
  setSummary: { flexDirection: 'row', padding: 13, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  search: { minHeight: 44, paddingHorizontal: 13, marginBottom: 8, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, color: FateDropColors.text, fontSize: 11 },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: '#252938' },
  checkboxOn: { borderColor: FateDropColors.violet, backgroundColor: 'rgba(124,58,237,.72)' },
  noSets: { color: FateDropColors.secondary, fontSize: 9, padding: 12, textAlign: 'center' },
  facetError: { color: FateDropColors.warning, fontSize: 9, lineHeight: 14, marginBottom: 8 },
  localRadarTestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: `${FateDropColors.cyan}55`, backgroundColor: `${FateDropColors.cyan}0D` },
  localRadarTestIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.cyan}55` },
  localRadarTestTitle: { color: FateDropColors.cyan, fontSize: 11, fontWeight: '900', letterSpacing: .5 },
  deviceWarning: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, marginBottom: 8, borderRadius: 15, borderWidth: 1, borderColor: `${FateDropColors.manifested}55`, backgroundColor: `${FateDropColors.manifested}0D` },
  deviceWarningTitle: { color: FateDropColors.manifested, fontSize: 10, fontWeight: '900', letterSpacing: .45 },
  rowCopy: { flex: 1 },
  rowTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  rowDetail: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 4 },
  switch: { width: 42, height: 24, borderRadius: 12, padding: 3, backgroundColor: '#252938', justifyContent: 'center' },
  switchOn: { backgroundColor: 'rgba(124,58,237,.72)' },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: FateDropColors.muted },
  knobOn: { alignSelf: 'flex-end', backgroundColor: FateDropColors.text },
  empty: { alignItems: 'center', padding: 28, borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  emptyTitle: { color: FateDropColors.text, fontSize: 15, fontWeight: '900' },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 10, marginTop: 6, textAlign: 'center' },
  primary: { marginTop: 14, backgroundColor: FateDropColors.violet, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  primaryText: { color: FateDropColors.text, fontSize: 9, fontWeight: '900' },
  message: { color: FateDropColors.cyan, fontSize: 9, marginTop: 10 },
  sync: { color: FateDropColors.muted, fontSize: 8, marginTop: 10, marginBottom: 20 },
  pressed: { opacity: 0.75 },
});
