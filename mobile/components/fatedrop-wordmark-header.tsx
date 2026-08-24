import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';

export function FateDropHeader({
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
        <View style={styles.brandTextWrap}>
          <Image
            source={require('@/assets/images/fatedrop-wordmark.png')}
            style={styles.headerWordmark}
            contentFit="contain"
            contentPosition="left center"
          />
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.headerAction}>{rightAction}</View>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    zIndex: 2,
  },
  brandGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headerWordmark: {
    width: 172,
    height: 48,
  },
  headerSubtitle: {
    color: FateDropColors.secondary,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: 2,
  },
  headerAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageLabel: {
    position: 'absolute',
    left: 20,
    bottom: 5,
    color: FateDropColors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
