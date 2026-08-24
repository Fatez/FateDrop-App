import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { FateDropColors } from '@/constants/theme';

export type StatusTone = 'mint' | 'red' | 'amber' | 'blue' | 'violet' | 'neutral';

export const statusColors: Record<StatusTone, string> = {
  mint: FateDropColors.mint,
  red: FateDropColors.coral,
  amber: FateDropColors.amber,
  blue: FateDropColors.blue,
  violet: FateDropColors.violet,
  neutral: FateDropColors.muted,
};

export function ScreenBackground() {
  return (
    <View pointerEvents="none" style={styles.backgroundLayer}>
      <Image
        source={require('@/assets/images/app-background-cosmic.webp')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      <View style={styles.backgroundOverlay} />
    </View>
  );
}

export const FateDropBackground = ScreenBackground;

export function AbstractHero({ eyebrow, title, subtitle, icon = 'sparkles' }: { eyebrow: string; title: string; subtitle: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.abstractHero}>
      <Image source={require('@/assets/images/app-background-cosmic.webp')} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <View style={styles.abstractHeroShade} />
      <View style={styles.abstractHeroIcon}><Ionicons name={icon} size={19} color={FateDropColors.cyan} /></View>
      <Text style={styles.abstractEyebrow}>{eyebrow}</Text>
      <Text style={styles.abstractTitle}>{title}</Text>
      <Text style={styles.abstractSubtitle}>{subtitle}</Text>
    </View>
  );
}

export function PageNavigation({ rightAction }: { rightAction?: ReactNode }) {
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/');
  return (
    <View style={styles.pageNavigation}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={({ pressed }) => [styles.pageNavigationButton, pressed && styles.pressed]}>
        <Ionicons name="arrow-back" size={18} color={FateDropColors.text} />
        <Text style={styles.pageNavigationText}>Back</Text>
      </Pressable>
      <View style={styles.pageNavigationRight}>
        {rightAction}
        <Pressable accessibilityRole="button" accessibilityLabel="Go to Home" onPress={() => router.replace('/')} style={({ pressed }) => [styles.pageNavigationButton, pressed && styles.pressed]}>
          <Ionicons name="home" size={17} color={FateDropColors.violetLight} />
          <Text style={styles.pageNavigationHomeText}>Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

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
        <View style={styles.headerLogoShell}><Image source={require('@/assets/images/fatedrop-emblem.webp')} style={styles.headerLogo} contentFit="contain" /></View>
        <View style={styles.brandTextWrap}>
          <Image source={require('@/assets/images/fatedrop-wordmark.png')} style={styles.headerWordmark} contentFit="contain" contentPosition="left center" />
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.headerAction}>{rightAction}</View>
      {title ? <Text style={styles.pageLabel}>{title}</Text> : null}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: string;
}) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  active = false,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  active?: boolean;
  badge?: string | number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        active && styles.iconButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={active ? FateDropColors.violetLight : FateDropColors.text} />
      {badge ? <View style={styles.iconBadge}><Text style={styles.iconBadgeText}>{badge}</Text></View> : null}
    </Pressable>
  );
}

export function FilterChip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ label, color = FateDropColors.mint }: { label: string; color?: string }) {
  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: `${color}1A`,
          borderColor: `${color}4D`,
        },
      ]}
    >
      <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function ActivityCard({
  icon,
  type,
  title,
  detail,
  retailer,
  time,
  tone,
  unread = false,
  compact = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  type: string;
  title: string;
  detail: string;
  retailer: string;
  time: string;
  tone: StatusTone;
  unread?: boolean;
  compact?: boolean;
}) {
  const color = statusColors[tone];

  return (
    <View
      style={[
        styles.activityItem,
        compact && styles.activityCompact,
        unread && { borderLeftWidth: 2, borderLeftColor: FateDropColors.violetLight },
      ]}
    >
      <View style={[styles.activityIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>

      <View style={styles.activityContent}>
        <View style={styles.activityMetaRow}>
          <Text style={[styles.activityType, { color }]}>{type}</Text>
          <Text style={styles.activityTime}>{time}</Text>
        </View>

        <Text style={styles.activityTitle} numberOfLines={1}>
          {title}
        </Text>

        <Text style={styles.activityDetail} numberOfLines={1}>
          {detail} · {retailer}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} />
    </View>
  );
}

export const ActivityItem = ActivityCard;

export function ProductCard({
  title,
  retailer,
  price,
  stockLabel,
  stockTone,
  inWatchlist = false,
  onToggleWatchlist,
  lastChange,
  alertLabel,
  imageSource,
  fateLabel,
  fateTone = 'neutral',
  productUrl,
  buyLabel,
  onOpenProduct,
  details,
}: {
  title: string;
  retailer: string;
  price: string;
  stockLabel: string;
  stockTone: StatusTone;
  inWatchlist?: boolean;
  onToggleWatchlist?: () => void;
  lastChange?: string;
  alertLabel?: string;
  imageSource?: ImageSourcePropType;
  fateLabel?: string;
  fateTone?: StatusTone;
  productUrl?: string;
  buyLabel?: string;
  onOpenProduct?: () => void;
  details?: string;
}) {
  const stockColor = statusColors[stockTone];

  return (
    <View style={[styles.productCard, inWatchlist && styles.productCardWatchlist]}>
      <View style={styles.productMedia}>
        {imageSource ? (
          <Image source={imageSource} style={styles.productImage} contentFit="cover" />
        ) : (
          <View style={styles.productPlaceholder}>
            <View style={styles.productGlow} />
            <View style={styles.productStub}>
              <Ionicons name="cube-outline" size={18} color={FateDropColors.violetLight} />
            </View>
          </View>
        )}
      </View>

      <View style={styles.productBody}>
        <View style={styles.productTopRow}>
          <View style={styles.productInfo}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.productRetailer} numberOfLines={1}>
              {retailer}
            </Text>
            {details ? <Text style={styles.productDetails} numberOfLines={1}>{details}</Text> : null}
          </View>

          <View style={styles.rightStack}>
            <Pressable
              style={({ pressed }) => [
                styles.watchToggle,
                {
                  backgroundColor: inWatchlist ? `${FateDropColors.violetLight}1A` : '#1A1D26',
                  borderColor: inWatchlist ? `${FateDropColors.violetLight}66` : '#2B2F3B',
                },
                pressed && styles.pressed,
              ]}
              onPress={onToggleWatchlist}
            >
              <Ionicons
                name={inWatchlist ? 'bookmark' : 'bookmark-outline'}
                size={15}
                color={inWatchlist ? FateDropColors.violetLight : FateDropColors.text}
              />
            </Pressable>

            {alertLabel ? (
              <View style={styles.alertPill}>
                <Ionicons name="notifications" size={10} color={FateDropColors.text} />
                <Text style={styles.alertPillText}>{alertLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.productMetaRow}>
          <Text style={styles.productPrice}>{price}</Text>
          <View style={styles.productBadges}>
            {fateLabel ? <StatusBadge label={fateLabel} color={statusColors[fateTone]} /> : null}
            <StatusBadge label={stockLabel} color={stockColor} />
          </View>
        </View>

        <View style={styles.productFooter}>
          {lastChange ? <Text style={styles.lastChange}>Last change {lastChange}</Text> : <View />}
          {productUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`View ${title} at ${retailer}`}
              onPress={onOpenProduct ?? (() => void Linking.openURL(productUrl))}
              style={({ pressed }) => [styles.viewItemButton, pressed && styles.pressed]}
            >
              <Text style={styles.viewItemText}>{buyLabel ?? `Buy at ${retailer}`}</Text>
              <Ionicons name="open-outline" size={13} color={FateDropColors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function EmptyWatchlistState({
  title = 'You are not tracking anything yet',
  subtitle = 'Use search to save products and get release alerts.',
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Image
        source={require('@/assets/images/watchlistempty.png')}
        style={styles.emptyArt}
        contentFit="contain"
      />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  abstractHero: {
    minHeight: 166, borderRadius: 26, overflow: 'hidden', padding: 20, justifyContent: 'flex-end',
    borderWidth: 1, borderColor: `${FateDropColors.violetLight}55`, marginBottom: 18,
    shadowColor: FateDropColors.violet, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 5,
  },
  abstractHeroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,7,15,0.44)' },
  abstractHeroIcon: { position: 'absolute', right: 18, top: 18, width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,24,40,.78)', borderWidth: 1, borderColor: `${FateDropColors.cyan}44` },
  abstractEyebrow: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 7 },
  abstractTitle: { color: FateDropColors.text, fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.7, maxWidth: '82%' },
  abstractSubtitle: { color: '#CBD5E1', fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: '88%' },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 5, 11, 0.34)',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  brandTextWrap: {
    justifyContent: 'center',
    flex: 1,
  },
  headerWordmark: {
    width: 136,
    height: 42,
  },
  headerLogo: {
    width: 44,
    height: 44,
  },
  headerLogoShell: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 17, 40, 0.82)',
    borderWidth: 1,
    borderColor: `${FateDropColors.violetLight}48`,
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
    left: 82,
    bottom: 5,
    color: FateDropColors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  statCard: {
    flex: 1,
    minWidth: 98,
    backgroundColor: FateDropColors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FateDropColors.border,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    color: FateDropColors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  statLabel: {
    marginTop: 4,
    color: FateDropColors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: FateDropColors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FateDropColors.border,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  activityCompact: {
    paddingVertical: 12,
    marginBottom: 10,
  },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  activityType: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  activityTime: {
    color: FateDropColors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  activityTitle: {
    color: FateDropColors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  activityDetail: {
    color: FateDropColors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(18, 19, 26, 0.82)',
    borderWidth: 1,
    borderColor: FateDropColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconButtonActive: {
    backgroundColor: `${FateDropColors.violetLight}1A`,
    borderColor: `${FateDropColors.violetLight}66`,
  },
  iconBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: FateDropColors.violetLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#12131A',
  },
  iconBadgeText: {
    color: FateDropColors.text,
    fontSize: 9,
    fontWeight: '800',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(18, 19, 26, 0.82)',
    borderWidth: 1,
    borderColor: FateDropColors.border,
  },
  filterChipActive: {
    backgroundColor: `${FateDropColors.violetLight}1A`,
    borderColor: `${FateDropColors.violetLight}66`,
  },
  filterText: {
    color: FateDropColors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filterTextActive: {
    color: FateDropColors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 12,
    paddingHorizontal: 2,
    zIndex: 2,
  },
  sectionTitle: {
    color: FateDropColors.text,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionAction: {
    color: FateDropColors.violetLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    backgroundColor: `${FateDropColors.violetLight}14`,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 19, 26, 0.82)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FateDropColors.border,
    padding: 8,
    minHeight: 140,
    height: 140,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  productCardWatchlist: {
    minHeight: 148,
    height: 148,
  },
  productMedia: {
    position: 'relative',
    width: 72,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#151922',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: FateDropColors.border,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#111720',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productGlow: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: `${FateDropColors.violetLight}22`,
    top: 8,
    left: 13,
  },
  productStub: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#1D2230',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${FateDropColors.violetLight}40`,
    zIndex: 1,
  },
  productBody: {
    flex: 1,
    justifyContent: 'center',
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  productInfo: {
    flex: 1,
    marginRight: 6,
  },
  productTitle: {
    color: FateDropColors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 3,
  },
  productRetailer: {
    color: FateDropColors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  rightStack: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 2,
  },
  watchToggle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${FateDropColors.violetLight}1A`,
    borderWidth: 1,
    borderColor: `${FateDropColors.violetLight}66`,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  alertPillText: {
    color: FateDropColors.text,
    fontSize: 9,
    fontWeight: '800',
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 10,
  },
  productPrice: {
    color: FateDropColors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  productDetails: {
    color: FateDropColors.muted,
    fontSize: 9,
    marginTop: 3,
  },
  productFooter: {
    minHeight: 24,
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 9,
    backgroundColor: FateDropColors.violet,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  viewItemText: {
    color: FateDropColors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  pageNavigation: {
    minHeight: 52,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#20222C',
    backgroundColor: '#030305',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  pageNavigationRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageNavigationButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  pageNavigationText: { color: FateDropColors.text, fontSize: 12, fontWeight: '800' },
  pageNavigationHomeText: { color: FateDropColors.violetLight, fontSize: 12, fontWeight: '800' },
  productBadges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  lastChange: {
    color: FateDropColors.secondary,
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 5,
  },
  emptyState: {
    backgroundColor: 'rgba(18, 19, 26, 0.9)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: FateDropColors.border,
    padding: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  emptyArt: {
    width: 176,
    height: 176,
    marginBottom: 10,
  },
  emptyTitle: {
    color: FateDropColors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: FateDropColors.muted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
});
