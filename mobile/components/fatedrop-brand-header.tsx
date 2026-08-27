import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';

/**
 * Functional page header.
 *
 * The full FateDrop wordmark is intentionally reserved for high-value identity
 * surfaces such as Home and Profile. Utility pages use their actual page title
 * so the brand stays premium rather than being repeated as UI furniture.
 */
export function FateDropBrandHeader({
  title = 'FateDrop',
  subtitle,
  rightAction,
}: {
  title?: string;
  subtitle?: string;
  rightAction?: ReactNode;
}) {
  return (
    <View style={styles.headerShell}>
      <View style={styles.copy}>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {rightAction ? <View style={styles.action}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 12,
    zIndex: 2,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    color: FateDropColors.goldBright,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  title: {
    color: FateDropColors.ivory,
    fontFamily: Fonts?.serif,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '700',
  },
  action: {
    marginLeft: 12,
  },
});
