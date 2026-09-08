import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, PageNavigation } from '@/components/fatedrop-ui';
import { RetailerWorkspaceActions } from '@/components/retailer-workspace-actions';
import { FateDropColors } from '@/constants/theme';
import DevelopmentRetailerDashboard from '@/screens/retailer-dashboard-development-screen';

export default function RetailerDashboard() {
  const [preview, setPreview] = useState(false);
  if (__DEV__ && preview) return <>
    <Pressable accessibilityRole="button" onPress={() => setPreview(false)} style={styles.preview}><Text style={styles.previewText}>Close development preview</Text></Pressable>
    <DevelopmentRetailerDashboard />
  </>;
  return <SafeAreaView style={styles.safe}>
    <FateDropBackground />
    <ScrollView contentContainerStyle={styles.content}>
      <PageNavigation />
      <AbstractHero eyebrow="Fate Network · Retailer tools" title="Your shop. Connected to collectors." subtitle="See the collector attention and demand reaching your verified retailer workspace." icon="storefront" />
      <RetailerWorkspaceActions />
      <Text style={styles.heading}>One workspace for your business</Text>
      <Text style={styles.copy}>Your linked FateDrop ID selects your shop on the website. View measured retailer visits, catalogue visibility and aggregate FateMatch demand in the existing workspace.</Text>
      <Text style={styles.copy}>If your shop is not linked yet, apply to connect your business. Retailer access requires verification.</Text>
      <Text style={styles.copy}>Visits and collector interest are shown as activity, not confirmed purchases.</Text>
      {__DEV__ ? <Pressable accessibilityRole="button" onPress={() => setPreview(true)} style={styles.preview}><Text style={styles.previewText}>Open development catalogue preview</Text></Pressable> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 80 },
  heading: { color: FateDropColors.text, fontSize: 20, fontWeight: '800', marginTop: 10 },
  copy: { color: FateDropColors.secondary, fontSize: 14, lineHeight: 22, marginTop: 12 },
  preview: { minHeight: 44, padding: 14, marginTop: 20, backgroundColor: FateDropColors.cardElevated },
  previewText: { color: FateDropColors.goldBright, fontSize: 12 },
});
