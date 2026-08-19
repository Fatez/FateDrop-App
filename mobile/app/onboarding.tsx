import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropColors } from '@/constants/theme';
import { FateDropBackground } from '@/components/fatedrop-ui';

export default function OnboardingScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FateDropBackground />

      <View style={styles.content}>
        <Image
          source={require('@/assets/images/launchFD.png')}
          style={styles.heroImage}
          contentFit="contain"
        />

        <Text style={styles.kicker}>FateDrop</Text>
        <Text style={styles.title}>Stay ahead of every restock.</Text>
        <Text style={styles.subtitle}>
          Real-time retailer monitoring, launch alerts, and price-change detection all in one place.
        </Text>

        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Get started</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>View demo</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: FateDropColors.background,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090A0F',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 36,
    zIndex: 1,
  },
  heroImage: {
    width: '100%',
    height: 340,
    marginBottom: 18,
    borderRadius: 28,
  },
  kicker: {
    color: FateDropColors.violetLight,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: FateDropColors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 42,
    marginBottom: 12,
  },
  subtitle: {
    color: FateDropColors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: FateDropColors.violetLight,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: {
    color: '#F5F7FA',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    backgroundColor: 'rgba(18, 19, 26, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FateDropColors.border,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryText: {
    color: FateDropColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
