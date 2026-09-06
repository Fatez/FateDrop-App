import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export type FateMetricItem = {
  label: string;
  value: string;
  icon: IconName;
  color?: string;
  detail?: string;
};

export type FateJourneyStep = {
  label: string;
  detail?: string;
  icon: IconName;
  state?: 'idle' | 'active' | 'done';
};

export function FateSectionHeading({ eyebrow, title, copy, action, onAction }: { eyebrow: string; title: string; copy?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionCopyWrap}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        {copy ? <Text style={styles.sectionCopy}>{copy}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="arrow-forward" size={13} color={FateDropColors.goldBright} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function FateMetricStrip({ items }: { items: FateMetricItem[] }) {
  return (
    <View style={styles.metricStrip}>
      {items.map((item, index) => {
        const color = item.color || FateDropColors.goldBright;
        return (
          <View key={`${item.label}:${index}`} style={styles.metricCell}>
            <View style={[styles.metricIcon, { borderColor: `${color}38`, backgroundColor: `${color}0E` }]}>
              <Ionicons name={item.icon} size={15} color={color} />
            </View>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
            <Text style={styles.metricLabel}>{item.label}</Text>
            {item.detail ? <Text style={styles.metricDetail} numberOfLines={1}>{item.detail}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export function FateJourneyRail({ steps, compact = false }: { steps: FateJourneyStep[]; compact?: boolean }) {
  return (
    <View style={[styles.journey, compact && styles.journeyCompact]}>
      {steps.map((step, index) => {
        const state = step.state || 'idle';
        const color = state === 'done' ? FateDropColors.manifested : state === 'active' ? FateDropColors.goldBright : FateDropColors.muted;
        return (
          <View key={`${step.label}:${index}`} style={styles.journeySegment}>
            <View style={styles.journeyNodeWrap}>
              <View style={[styles.journeyNode, state === 'active' && styles.journeyNodeActive, { borderColor: `${color}70`, backgroundColor: `${color}10` }]}>
                <Ionicons name={state === 'done' ? 'checkmark' : step.icon} size={14} color={color} />
              </View>
              {index < steps.length - 1 ? <View style={[styles.journeyLine, state === 'done' && { backgroundColor: `${FateDropColors.manifested}66` }]} /> : null}
            </View>
            <Text style={[styles.journeyLabel, { color }]}>{step.label}</Text>
            {step.detail ? <Text style={styles.journeyDetail} numberOfLines={2}>{step.detail}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export function FateProgressRing({ value, size = 88, label = 'COMPLETE', color = FateDropColors.goldBright }: { value: number | null | undefined; size?: number; label?: string; color?: string }) {
  const numeric = value == null || !Number.isFinite(value) ? 0 : Math.min(100, Math.max(0, value));
  const known = value != null && Number.isFinite(value);
  const segment = (threshold: number) => numeric >= threshold ? color : 'rgba(226,197,141,.15)';
  const borderWidth = Math.max(5, Math.round(size * 0.065));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={known ? { min: 0, max: 100, now: Math.round(numeric) } : undefined}
      style={[
        styles.progressRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderTopColor: numeric > 0 ? color : segment(1),
          borderRightColor: segment(25),
          borderBottomColor: segment(50),
          borderLeftColor: segment(75),
        },
      ]}
    >
      <Text style={[styles.progressValue, { fontSize: Math.max(16, Math.round(size * 0.24)) }]}>{known ? `${Math.round(numeric)}%` : '—'}</Text>
      <Text style={styles.progressLabel}>{label}</Text>
    </View>
  );
}

export function FateGlassPanel({ children, accent = FateDropColors.goldBright, style }: { children: ReactNode; accent?: string; style?: object }) {
  return (
    <View style={[styles.glassPanel, { borderColor: `${accent}35` }, style]}>
      <View pointerEvents="none" style={[styles.glassGlow, { backgroundColor: `${accent}0A` }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 18, marginBottom: 10 },
  sectionCopyWrap: { flex: 1, minWidth: 0 },
  sectionEyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.35 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 22, lineHeight: 27, marginTop: 4 },
  sectionCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 560 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.goldBright}38`, backgroundColor: `${FateDropColors.goldBright}0B` },
  sectionActionText: { color: FateDropColors.goldBright, fontSize: 8.5, fontWeight: '900', letterSpacing: .55 },

  metricStrip: { flexDirection: 'row', borderRadius: 19, borderWidth: 1, borderColor: 'rgba(226,197,141,.22)', backgroundColor: 'rgba(7,12,20,.78)', overflow: 'hidden' },
  metricCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(226,197,141,.16)' },
  metricIcon: { width: 31, height: 31, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  metricValue: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900', maxWidth: '100%' },
  metricLabel: { color: FateDropColors.goldBright, fontSize: 6.8, fontWeight: '900', letterSpacing: .7, marginTop: 3, textAlign: 'center' },
  metricDetail: { color: FateDropColors.muted, fontSize: 7.5, marginTop: 2, maxWidth: '100%', textAlign: 'center' },

  journey: { flexDirection: 'row', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.20)', backgroundColor: 'rgba(7,12,20,.72)', paddingHorizontal: 10, paddingTop: 11, paddingBottom: 10, marginBottom: 12 },
  journeyCompact: { paddingTop: 9, paddingBottom: 8 },
  journeySegment: { flex: 1, minWidth: 0, paddingHorizontal: 3 },
  journeyNodeWrap: { height: 28, flexDirection: 'row', alignItems: 'center' },
  journeyNode: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  journeyNodeActive: { shadowColor: FateDropColors.goldBright, shadowOpacity: .22, shadowRadius: 9, elevation: 3 },
  journeyLine: { flex: 1, height: 1, marginLeft: 5, backgroundColor: 'rgba(226,197,141,.18)' },
  journeyLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: .45, marginTop: 4 },
  journeyDetail: { color: FateDropColors.muted, fontSize: 7.5, lineHeight: 11, marginTop: 2 },

  progressRing: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,10,17,.90)', shadowColor: '#000', shadowOpacity: .28, shadowRadius: 12, elevation: 4 },
  progressValue: { color: FateDropColors.ivory, fontWeight: '900', lineHeight: 24 },
  progressLabel: { color: FateDropColors.goldBright, fontSize: 6.5, fontWeight: '900', letterSpacing: .75, marginTop: 1 },

  glassPanel: { position: 'relative', overflow: 'hidden', borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(7,12,20,.84)' },
  glassGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -70, top: -100 },
  pressed: { opacity: .76, transform: [{ scale: .98 }] },
});
