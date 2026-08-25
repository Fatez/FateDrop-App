import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';

export function FateDropBrandHeader({
  title,
  subtitle,
  rightAction,
}: {
  title?: string;
  subtitle?: string;
  rightAction?: ReactNode;
}) {
  return (
    <View style={styles.headerShell}>
      <View style={styles.brandGroup}>
        <Image
          source={require('@/assets/images/fatedrop-wordmark.png')}
          style={styles.wordmark}
          contentFit="contain"
          contentPosition="left center"
        />
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.action}>{rightAction}</View>
      {title ? <Text style={styles.pageLabel}>{title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 78,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 12,
    zIndex: 2,
  },
  brandGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  wordmark: {
    width: 184,
    height: 50,
  },
  subtitle: {
    color: FateDropColors.secondary,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.35,
    marginTop: -3,
  },
  action: {
    marginLeft: 12,
  },
  pageLabel: {
    position: 'absolute',
    opacity: 0,
  },
});
