import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { completeAppGuide } from '@/lib/onboarding-state';

const guideSlides = [
  {
    eyebrow: 'WELCOME TO FATEDROP',
    title: 'Read the signal. Know what to do.',
    body: 'FateDrop turns retailer changes into simple collector signals. This guide explains the core journey and exactly what each alert means.',
    action: 'You can replay this guide any time from More → App Guide.',
    accent: FateDropColors.cyan,
    source: require('@/assets/images/FDAlerts.png'),
  },
  {
    eyebrow: 'THE COLLECTOR JOURNEY',
    title: 'Search. Compare. Watch.',
    body: 'Search finds products and retailers. FateFind compares the live opportunity and True Price evidence. FateMatch watches your exact conditions when you want FateDrop to keep looking for you.',
    action: 'Alerts tell you when the situation changes. Local Radar handles physical-store intelligence separately.',
    accent: FateDropColors.violetLight,
    source: require('@/assets/images/home-koru-hero.webp'),
  },
  {
    eyebrow: 'WHISPER · ORU',
    title: 'Something may be starting.',
    body: 'Whisper is an early signal. FateDrop has noticed a meaningful change, but it is not a confirmed live-stock instruction.',
    action: 'What to do: keep watch, open the detail if the product matters, and be ready for stronger evidence.',
    accent: '#D2B66F',
    source: require('@/assets/images/alert-oru-hero-final.webp'),
  },
  {
    eyebrow: 'ECHO · FENN',
    title: 'The signal is getting stronger.',
    body: 'Echo means stronger evidence is building. It can include trusted preparation intelligence, but it still must not be treated as confirmed physical stock unless FateDrop says so explicitly.',
    action: 'What to do: get ready. Check the retailer, product and evidence so you can move quickly if it becomes Manifested.',
    accent: '#D9CDBB',
    source: require('@/assets/images/alert-fenn-hero-final.webp'),
  },
  {
    eyebrow: 'MANIFESTED · KORU',
    title: 'Confirmed live. This is the go alert.',
    body: 'Manifested means FateDrop has confirmed the product is live in the signal context shown to you. If you want it, this is the alert that says act now.',
    action: 'What to do: open the alert, check the exact retailer/product details, and go get it before the opportunity disappears.',
    accent: '#7C6EFF',
    source: require('@/assets/images/alert-koru-hero-final.webp'),
  },
  {
    eyebrow: 'VANISHED · NYXEN',
    title: 'The live opportunity has gone.',
    body: 'Vanished means a previously live opportunity is no longer being observed as available. It protects you from treating stale stock as current stock.',
    action: 'What to do: do not rely on the old live state. Keep the watch active if you still want the product.',
    accent: '#D95B67',
    source: require('@/assets/images/alert-nyxen-hero-final.webp'),
  },
  {
    eyebrow: 'LOCAL RADAR',
    title: 'Physical stores use their own truth.',
    body: 'Local Radar keeps nearby-store intelligence separate from online stock. Expected means credible incoming-store intelligence. Confirmed requires exact physical evidence. Unknown stays unknown.',
    action: 'Tap a Local Radar push to open the map and its incoming-stock panel. You are ready to use FateDrop.',
    accent: FateDropColors.blue,
    source: require('@/assets/images/fatedrop-portal-hero.png'),
  },
] as const;

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const slide = guideSlides[index];
  const last = index === guideSlides.length - 1;

  async function leaveGuide() {
    await completeAppGuide();
    router.replace('/');
  }

  function next() {
    if (last) {
      void leaveGuide();
      return;
    }
    setIndex((current) => Math.min(current + 1, guideSlides.length - 1));
  }

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <FateDropBackground />

    <View style={styles.topBar}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}><Ionicons name="sparkles" size={15} color={FateDropColors.text} /></View>
        <View><Text style={styles.brand}>FATEDROP</Text><Text style={styles.progressLabel}>APP GUIDE · {index + 1}/{guideSlides.length}</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Skip FateDrop app guide" onPress={() => void leaveGuide()} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
        <Text style={styles.skipText}>SKIP</Text>
      </Pressable>
    </View>

    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${((index + 1) / guideSlides.length) * 100}%`, backgroundColor: slide.accent }]} />
    </View>

    <View style={styles.content}>
      <View style={[styles.artFrame, { borderColor: `${slide.accent}38` }]}>
        <View style={[styles.artGlow, { backgroundColor: `${slide.accent}18` }]} />
        <Image source={slide.source} style={styles.heroImage} contentFit="contain" transition={160} />
      </View>

      <View style={styles.copyBlock}>
        <Text style={[styles.kicker, { color: slide.accent }]}>{slide.eyebrow}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.body}</Text>
        <View style={[styles.actionCard, { borderColor: `${slide.accent}30`, backgroundColor: `${slide.accent}0B` }]}>
          <Ionicons name={last ? 'navigate-outline' : 'flash-outline'} size={16} color={slide.accent} />
          <Text style={styles.actionText}>{slide.action}</Text>
        </View>
      </View>
    </View>

    <View style={styles.footer}>
      <View style={styles.dots}>
        {guideSlides.map((item, dotIndex) => <View key={item.eyebrow} style={[styles.dot, dotIndex === index && { width: 22, backgroundColor: slide.accent }]} />)}
      </View>
      <View style={styles.actions}>
        <Pressable disabled={index === 0} onPress={() => setIndex((current) => Math.max(0, current - 1))} style={({ pressed }) => [styles.secondaryButton, index === 0 && styles.disabled, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={16} color={FateDropColors.secondary} />
          <Text style={styles.secondaryText}>BACK</Text>
        </Pressable>
        <Pressable onPress={next} style={({ pressed }) => [styles.primaryButton, { backgroundColor: slide.accent }, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>{last ? 'ENTER FATEDROP' : 'NEXT'}</Text>
          <Ionicons name={last ? 'arrow-forward' : 'chevron-forward'} size={16} color="#090A0F" />
        </Pressable>
      </View>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: FateDropColors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, zIndex: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,110,255,.14)', borderWidth: 1, borderColor: 'rgba(124,110,255,.28)' },
  brand: { color: FateDropColors.text, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  progressLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '800', letterSpacing: .9, marginTop: 2 },
  skip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  skipText: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  progressTrack: { height: 2, marginHorizontal: 20, overflow: 'hidden', borderRadius: 2, backgroundColor: 'rgba(255,255,255,.06)' },
  progressFill: { height: 2, borderRadius: 2 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 18, justifyContent: 'center' },
  artFrame: { minHeight: 210, maxHeight: 300, flex: .92, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 26, borderWidth: 1, backgroundColor: 'rgba(8,10,16,.92)' },
  artGlow: { position: 'absolute', width: 230, height: 230, borderRadius: 115 },
  heroImage: { width: '100%', height: '100%' },
  copyBlock: { paddingTop: 22 },
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.45, marginBottom: 7 },
  title: { color: FateDropColors.text, fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -.8 },
  subtitle: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginTop: 10 },
  actionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, marginTop: 14, borderRadius: 14, borderWidth: 1 },
  actionText: { flex: 1, color: FateDropColors.text, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  dots: { height: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.15)' },
  actions: { flexDirection: 'row', gap: 10 },
  primaryButton: { flex: 1.35, minHeight: 48, borderRadius: 15, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#090A0F', fontSize: 9, fontWeight: '900', letterSpacing: .85 },
  secondaryButton: { flex: .8, minHeight: 48, borderRadius: 15, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  secondaryText: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  disabled: { opacity: .25 },
  pressed: { opacity: .78, transform: [{ scale: .985 }] },
});
