import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';
import { companionRouteVoice, type CompanionVoiceName } from '@/lib/companion-voice';

function accentFor(companion: CompanionVoiceName) {
  if (companion === 'Oru') return FateDropColors.whisper;
  if (companion === 'Fenn') return FateDropColors.echo;
  if (companion === 'Koru') return FateDropColors.manifested;
  if (companion === 'Nyxen') return FateDropColors.vanished;
  if (companion === 'Veyl') return FateDropColors.cyan;
  if (companion === 'Taren') return FateDropColors.amber;
  if (companion === 'Morren') return FateDropColors.goldBright;
  return FateDropColors.violetLight;
}

export function CompanionRouteVoice({ pathname }: { pathname: string }) {
  const voice = useMemo(() => companionRouteVoice(pathname), [pathname]);
  const [dismissedPath, setDismissedPath] = useState('');

  useEffect(() => {
    setDismissedPath('');
  }, [pathname]);

  if (!voice || dismissedPath === pathname) return null;

  const accent = accentFor(voice.companion);

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View accessibilityLiveRegion="polite" style={[styles.card, { borderColor: `${accent}4D` }]}>
        <View style={[styles.mark, { borderColor: `${accent}66`, backgroundColor: `${accent}14` }]}>
          <Ionicons name="sparkles-outline" size={16} color={accent} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.companion, { color: accent }]}>{voice.companion.toUpperCase()}</Text>
          <Text style={styles.title}>{voice.title}</Text>
          <Text style={styles.detail}>{voice.detail}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss companion note"
          hitSlop={8}
          onPress={() => setDismissedPath(pathname)}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={16} color={FateDropColors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 88,
    zIndex: 90,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 620,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(5,8,17,.96)',
    shadowColor: '#000',
    shadowOpacity: .34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  companion: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 2,
    color: FateDropColors.ivory,
    fontFamily: Fonts.serif,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  detail: {
    marginTop: 2,
    color: FateDropColors.secondary,
    fontSize: 10,
    lineHeight: 14,
  },
  dismiss: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -5,
  },
  pressed: { opacity: .58 },
});
