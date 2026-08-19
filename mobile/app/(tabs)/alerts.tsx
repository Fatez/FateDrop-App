import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FateDropHeader, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { registerForStockAlerts } from '@/lib/notifications';
import { fateFindSummary, listLocalFateMatches, LocalFateFindRepository } from '@/services/fatefind';
import type { AlertMatch, SavedSearch } from '@/types/domain';

const repository = new LocalFateFindRepository();
const ago = (value?: string) => {
  if (!value) return '';
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
};

type PushState = 'idle' | 'working' | 'enabled' | 'unavailable';

export default function AlertsScreen() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [matches, setMatches] = useState<AlertMatch[]>([]);
  const [pushState, setPushState] = useState<PushState>('idle');
  const [pushMessage, setPushMessage] = useState('Push is opt-in on this device.');

  useFocusEffect(useCallback(() => {
    void Promise.all([repository.list(), listLocalFateMatches()]).then(([saved, history]) => {
      setSearches(saved);
      setMatches(history);
    });
  }, []));

  const searchById = useMemo(() => new Map(searches.map((item) => [item.id, item])), [searches]);
  const active = searches.filter((item) => item.notificationsEnabled);

  const enablePush = async () => {
    setPushState('working');
    try {
      const result = await registerForStockAlerts();
      if (result.enabled) {
        setPushState('enabled');
        setPushMessage('Push notifications are enabled for this device.');
      } else {
        setPushState('unavailable');
        setPushMessage(`Push not enabled: ${result.reason.replaceAll('-', ' ')}.`);
      }
    } catch {
      setPushState('unavailable');
      setPushMessage('Push registration could not be completed.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader
          title="Alerts"
          rightAction={
            <Pressable accessibilityLabel="Create FateFind" onPress={() => router.push('/fatefind')} style={styles.headerAction}>
              <Ionicons name="telescope" size={18} color={FateDropColors.violetLight} />
            </Pressable>
          }
        />

        <AbstractHero
          eyebrow="Your alerts"
          title="Only the signals that matter to you."
          subtitle="Manage active FateFind hunts and review FateMatch results here. The global FateDrop network heartbeat belongs on Home."
          icon="notifications"
        />

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{active.length}</Text>
            <Text style={styles.statLabel}>Active FateFinds</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{matches.length}</Text>
            <Text style={styles.statLabel}>FateMatches</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>ACTIVE HUNTS</Text>
            <Text style={styles.sectionTitle}>FateFind</Text>
          </View>
          <Pressable onPress={() => router.push('/fatefind')}><Text style={styles.link}>Manage</Text></Pressable>
        </View>

        <View style={styles.list}>
          {searches.length ? searches.map((item) => (
            <Pressable key={item.id} onPress={() => router.push('/fatefind')} style={styles.card}>
              <View style={styles.iconWrap}><Ionicons name="telescope" size={17} color={FateDropColors.violetLight} /></View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardDetail}>{fateFindSummary(item)}</Text>
              </View>
              <StatusBadge label={item.notificationsEnabled ? 'Alerts on' : 'Paused'} color={item.notificationsEnabled ? FateDropColors.mint : FateDropColors.muted} />
            </Pressable>
          )) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No active hunt yet</Text>
              <Text style={styles.emptyText}>Create a FateFind such as “Destined Rivals ETB · max £65 delivered” and FateDrop can evaluate matching offers.</Text>
              <Pressable onPress={() => router.push('/fatefind')} style={styles.primary}><Text style={styles.primaryText}>Create FateFind</Text></Pressable>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>PERSONAL HISTORY</Text>
            <Text style={styles.sectionTitle}>FateMatch results</Text>
          </View>
        </View>

        <View style={styles.list}>
          {matches.length ? matches.slice(0, 30).map((match) => {
            const search = searchById.get(match.savedSearchId);
            return (
              <View key={match.id} style={styles.matchCard}>
                <View style={styles.matchIcon}><Ionicons name="checkmark" size={16} color={FateDropColors.mint} /></View>
                <View style={styles.cardCopy}>
                  <Text style={styles.matchLabel}>FATEMATCH</Text>
                  <Text style={styles.cardTitle}>{search?.name || 'Saved FateFind matched'}</Text>
                  <Text style={styles.cardDetail}>A qualifying offer matched this hunt · {ago(match.matchedAt)}</Text>
                </View>
              </View>
            );
          }) : (
            <View style={styles.emptyCompact}>
              <Text style={styles.emptyTitle}>No FateMatches yet</Text>
              <Text style={styles.emptyText}>When an evaluated offer satisfies one of your FateFind rules, the result belongs here.</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>DELIVERY</Text>
            <Text style={styles.sectionTitle}>Notification channels</Text>
          </View>
        </View>
        <View style={styles.preferenceNote}>
          <Ionicons name="phone-portrait-outline" size={18} color={FateDropColors.cyan} />
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Push notifications</Text>
            <Text style={styles.preferenceText}>{pushMessage}</Text>
            {pushState !== 'enabled' ? (
              <Pressable disabled={pushState === 'working'} onPress={() => void enablePush()} style={styles.pushButton}>
                <Text style={styles.pushButtonText}>{pushState === 'working' ? 'ENABLING…' : 'ENABLE PUSH ON THIS DEVICE'}</Text>
              </Pressable>
            ) : <StatusBadge label="Enabled" color={FateDropColors.mint} />}
          </View>
        </View>
        <View style={styles.preferenceNote}>
          <Ionicons name="options-outline" size={18} color={FateDropColors.cyan} />
          <Text style={styles.preferenceText}>Shared Echo, Manifested, Vanished, price-change, web and Discord preferences will connect here when FateDrop ID authentication is shared with the app.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  headerAction: { padding: 9, borderRadius: 12, backgroundColor: FateDropColors.glass },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  stat: { flex: 1, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  statValue: { color: FateDropColors.text, fontWeight: '900', fontSize: 22 },
  statLabel: { color: FateDropColors.muted, fontSize: 9, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 7, marginBottom: 10 },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: FateDropColors.text, fontWeight: '900', fontSize: 19, marginTop: 3 },
  link: { color: FateDropColors.violetLight, fontSize: 11, fontWeight: '900' },
  list: { gap: 9, marginBottom: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}14` },
  cardCopy: { flex: 1 },
  cardTitle: { color: FateDropColors.text, fontWeight: '900', fontSize: 13 },
  cardDetail: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  matchCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.mint}35`, backgroundColor: FateDropColors.glass },
  matchIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.mint}16` },
  matchLabel: { color: FateDropColors.mint, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginBottom: 3 },
  empty: { padding: 22, alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  emptyCompact: { padding: 18, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  emptyTitle: { color: FateDropColors.text, fontSize: 15, fontWeight: '900' },
  emptyText: { color: FateDropColors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 6 },
  primary: { marginTop: 13, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, backgroundColor: FateDropColors.violet },
  primaryText: { color: FateDropColors.text, fontWeight: '900', fontSize: 11 },
  preferenceNote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, marginBottom: 9 },
  preferenceText: { flex: 1, color: FateDropColors.muted, fontSize: 9, lineHeight: 15, marginTop: 4 },
  pushButton: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 10, backgroundColor: FateDropColors.violet },
  pushButtonText: { color: FateDropColors.text, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
});
