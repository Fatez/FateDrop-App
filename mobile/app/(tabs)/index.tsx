import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityItem,
  FateDropBackground,
  FateDropHeader,
  IconButton,
  SectionHeader,
  StatCard,
  type StatusTone,
} from '@/components/fatedrop-ui';

import { FateDropColors } from '@/constants/theme';
import { API_BASE_URL } from '@/constants/api';
interface MarketSummary { productsTracked:number;inStockCount:number;retailerCount:number;retailers:{name:string;count:number}[]; }
interface LegacyProductSummary { retailer?:string;availability?:string;isCurrentlyListed?:boolean; }
interface MarketEvent { id:string;type?:string;fateStage?:string;title?:string;message?:string;retailer?:string;product?:{title?:string}; }
const activity = [
  {
    id: '1',
    type: 'Restock',
    title: 'Scarlet & Violet — 151',
    detail: 'Elite Trainer Box',
    retailer: 'Pokémon Center UK',
    time: '2m ago',
    tone: 'mint',
    icon: 'flash',
  },
  {
    id: '2',
    type: 'New SKU',
    title: 'Destined Rivals',
    detail: 'Booster Bundle',
    retailer: 'Pokémon Center UK',
    time: '18m ago',
    tone: 'blue',
    icon: 'sparkles',
  },
  {
    id: '3',
    type: 'Sold out',
    title: 'Prismatic Evolutions',
    detail: 'Super-Premium Collection',
    retailer: 'Pokémon Center UK',
    time: '41m ago',
    tone: 'red',
    icon: 'close-circle',
  },
  {
    id: '4',
    type: 'Price change',
    title: 'Holo Rares',
    detail: 'Display Case',
    retailer: 'Pokémon Center UK',
    time: '1h ago',
    tone: 'amber',
    icon: 'trending-up',
  },
  {
    id: '5',
    type: 'Launch-date change',
    title: 'Shrouded Fable',
    detail: 'Launch update',
    retailer: 'Pokémon Center UK',
    time: '3h ago',
    tone: 'violet',
    icon: 'calendar',
  },
] as const;

export default function HomeScreen() {
  const [productsTracked, setProductsTracked] = useState(0);
const [monitorLive, setMonitorLive] = useState(false);
const [retailerCount, setRetailerCount] = useState(0);
const [inStockCount, setInStockCount] = useState(0);
const [retailers, setRetailers] = useState<{name:string;count:number;initials:string;color:string}[]>([]);
const [recentEvents, setRecentEvents] = useState<MarketEvent[]>([]);
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/status`);
        const data = await response.json();
        setProductsTracked(data.monitor.productsTracked);
        setMonitorLive(data.monitor.baselineComplete);
        const summaryResponse = await fetch(`${API_BASE_URL}/api/market-summary`);
        const summary = await summaryResponse.json() as MarketSummary;
        setProductsTracked(summary.productsTracked);
        setRetailerCount(summary.retailerCount);
        setInStockCount(summary.inStockCount);
        const colors = [FateDropColors.violetLight, FateDropColors.blue, FateDropColors.mint];
        setRetailers(summary.retailers.map(({name,count},index)=>({name,count,initials:name.split(' ').map(word=>word[0]).slice(0,2).join(''),color:colors[index%colors.length]})));
        if (false) {
        const productsResponse = await fetch(`${API_BASE_URL}/api/products`);
        const productsData = await productsResponse.json();
        const products = (Array.isArray(productsData.products) ? productsData.products : Object.values(productsData.products || {})) as LegacyProductSummary[];
        setProductsTracked(products.length);
        setRetailerCount(new Set(products.map((product) => product.retailer || 'Pokémon Center UK')).size);
        setInStockCount(products.filter((product) => product.availability === 'IN_STOCK' && product.isCurrentlyListed !== false).length);
        const retailerMap = new Map<string, number>();
        products.forEach((product) => { const name = product.retailer || 'Pokémon Center UK'; retailerMap.set(name, (retailerMap.get(name) || 0) + 1); });
        setRetailers([...retailerMap.entries()].map(([name,count],index) => ({name,count,initials:name.split(' ').map(word=>word[0]).slice(0,2).join(''),color:colors[index%colors.length]})));
        }
        const eventsResponse = await fetch(`${API_BASE_URL}/api/events`);
        const eventsData = await eventsResponse.json();
        setRecentEvents(Array.isArray(eventsData.events) ? eventsData.events.slice(0,4) : []);
      } catch (error) {
        console.error('Failed to load FateDrop status:', error);
      }
    };

    loadStatus();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FateDropBackground />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <FateDropHeader
          subtitle="DROP INTELLIGENCE"
          rightAction={<IconButton icon="notifications-outline" badge={2} />}
        />

        <View style={styles.heroCard}>
          <Image
            source={require('@/assets/images/fatedropheader.png')}
            style={styles.promoImage}
            contentFit="cover"
          />

          <View style={styles.promoOverlay} />

          <View style={styles.promoCopy}>
            <View style={styles.livePill}>
              <View style={styles.liveDotSmall} />
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
            <Text style={styles.heroHeadline}>Know what drops next.</Text>
            <Text style={styles.heroSubhead}>Live Pokémon stock intelligence across trusted UK retailers.</Text>
            <Pressable onPress={() => router.push('/search')} style={({ pressed }) => [styles.stayAheadButton, pressed && styles.pressed]}>
              <Text style={styles.stayAheadText}>EXPLORE LIVE STOCK</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.monitorCard}>
          <Image source={require('@/assets/images/fatedrop-portal-hero.png')} style={styles.monitorArtwork} contentFit="cover" />
          <View style={styles.monitorShade} />
          <View style={styles.monitorGlow} />

          <View style={styles.monitorTop}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
           <Text style={styles.liveText}>
  {monitorLive ? 'MONITORING LIVE' : 'MONITOR OFFLINE'}
</Text>
            </View>

            <Ionicons name="radio-outline" size={22} color={FateDropColors.violetLight} />
          </View>

          <Text style={styles.monitorEyebrow}>MARKET PULSE</Text>
          <Text style={styles.monitorTitle}>Watching every signal.</Text>

          <Text style={styles.monitorDescription}>
            New listings, restocks and sell-outs are continuously mapped into one live feed.
          </Text>

          <View style={styles.monitorFooter}>
            <View style={styles.metricWrap}>
           <Text style={styles.monitorMetric}>{productsTracked}</Text>
              <Text style={styles.monitorLabel}>Products tracked</Text>
            </View>

            <View style={styles.verticalDivider} />

            <View style={styles.metricWrap}>
              <Text style={styles.monitorMetric}>24/7</Text>
              <Text style={styles.monitorLabel}>Active monitoring</Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Fate Encounters"
          onPress={() => router.push('/encounters')}
          style={({ pressed }) => [styles.encountersCard, pressed && styles.pressed]}
        >
          <View style={styles.encountersIcon}><Ionicons name="calendar" size={24} color={FateDropColors.violetLight} /></View>
          <View style={styles.encountersCopy}>
            <Text style={styles.encountersTitle}>Fate Encounters</Text>
            <Text style={styles.encountersSubtitle}>Discover card shows, vendors and collector events near you.</Text>
            <Text style={styles.encountersLine}>Some drops arrive online. Others are waiting nearby.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={FateDropColors.violetLight} />
        </Pressable>

        <SectionHeader title="Overview" action="Live data" />

        <View style={styles.statsRow}>
          <StatCard icon="storefront-outline" value={retailerCount.toString()} label="Retailers" color={FateDropColors.violetLight} />
          <StatCard icon="cube-outline" value={productsTracked.toString()} label="Products" color={FateDropColors.blue} />
          <StatCard icon="flash-outline" value={inStockCount.toString()} label="In stock" color={FateDropColors.mint} />
        </View>

        <SectionHeader title="Recent activity" action="View all" />

        <View style={styles.activityList}>
          {(recentEvents.length ? recentEvents.map((event,index) => ({id:event.id,type:event.type?.replaceAll('_',' ')||'Market signal',title:event.product?.title||event.title||'Catalogue update',detail:event.message||event.type,retailer:event.retailer||'Pokémon Center UK',time:index===0?'Latest':'Recent',tone:event.fateStage==='MANIFESTED'?'mint':event.fateStage==='VANISHED'?'red':event.fateStage==='ECHO'?'violet':'blue',icon:event.fateStage==='VANISHED'?'close-circle':event.fateStage==='ECHO'?'flash':'sparkles'})) : activity.slice(0,0)).map((item) => (
            <ActivityItem
              key={item.id}
              icon={item.icon as keyof typeof Ionicons.glyphMap}
              type={item.type}
              title={item.title}
              detail={item.detail || 'Latest market update'}
              retailer={item.retailer}
              time={item.time}
              tone={item.tone as StatusTone}
              unread={item.id === recentEvents[0]?.id}
            />
          ))}
        </View>

        <SectionHeader title="Retailers" action="Manage" />

        <View style={styles.retailerGrid}>
          {retailers.map((retailer) => (
            <View key={retailer.name} style={styles.retailerCard}>
              <View style={[styles.retailerLogo, { backgroundColor: `${retailer.color}20`, borderColor: `${retailer.color}55` }]}>
                <Text style={[styles.retailerLogoText, { color: retailer.color }]}>{retailer.initials}</Text>
              </View>
              <View style={styles.retailerContent}>
                <Text style={styles.retailerName}>{retailer.name}</Text>
                <Text style={styles.retailerProducts}>{retailer.count.toLocaleString()} products monitored</Text>
              </View>
              <View style={styles.onlineBadge}><View style={styles.onlineDot}/><Text style={styles.onlineText}>Live</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.comingSoonCard}>
          <Ionicons name="add-circle-outline" size={20} color={FateDropColors.muted} />

          <View style={styles.comingSoonContent}>
            <Text style={styles.comingSoonTitle}>More retailers coming</Text>
            <Text style={styles.comingSoonText}>Smyths, GAME, Magic Madhouse, Chaos Cards and Zavvi</Text>
          </View>

          <Text style={styles.soonBadge}>Soon</Text>
        </View>

        <SectionHeader title="Independent retailers" action="Partner programme" />
        <View style={styles.partnerCard}>
          <View style={styles.partnerGlow} />
          <View style={styles.partnerIcon}><Ionicons name="storefront" size={23} color={FateDropColors.cyan} /></View>
          <Text style={styles.partnerEyebrow}>SUPPORT SMALL BUSINESS</Text>
          <Text style={styles.partnerTitle}>Put your live catalogue on the FateDrop map.</Text>
          <Text style={styles.partnerCopy}>Independent Pokémon retailers can reach collectors through one worldwide view of products that are available right now.</Text>
          <View style={styles.partnerBenefits}>
            <View style={styles.partnerBenefit}><Ionicons name="globe-outline" size={15} color={FateDropColors.violetLight}/><Text style={styles.partnerBenefitText}>Worldwide discovery</Text></View>
            <View style={styles.partnerBenefit}><Ionicons name="flash-outline" size={15} color={FateDropColors.mint}/><Text style={styles.partnerBenefitText}>Live stock visibility</Text></View>
            <View style={styles.partnerBenefit}><Ionicons name="open-outline" size={15} color={FateDropColors.blue}/><Text style={styles.partnerBenefitText}>Direct shop traffic</Text></View>
          </View>
          <Pressable accessibilityRole="button" onPress={()=>router.push('/retailer-partners')} style={({pressed})=>[styles.partnerButton,pressed&&styles.pressed]}>
            <Text style={styles.partnerButtonText}>JOIN THE RETAILER WAITLIST</Text><Ionicons name="arrow-forward" size={16} color={FateDropColors.text}/>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: FateDropColors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 120,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    marginBottom: 16,
    height: 226,
    borderWidth: 1,
    borderColor: FateDropColors.border,
    backgroundColor: '#12141C',
    zIndex: 2,
  },
  promoImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  promoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 6, 12, 0.18)',
  },
  promoCopy: {
    position: 'absolute',
    left: 18,
    right: 112,
    bottom: 18,
    zIndex: 1,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: `${FateDropColors.mint}14`,
    borderWidth: 1,
    borderColor: `${FateDropColors.mint}4D`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  liveDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: FateDropColors.mint,
  },
  livePillText: {
    color: FateDropColors.mint,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroHeadline: {
    color: '#F5F7FA',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 32,
    marginBottom: 8,
  },
  heroSubhead: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 12,
  },
  stayAheadButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168, 85, 247, 0.9)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  stayAheadText: {
    color: '#F5F7FA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(21, 24, 32, 0.85)',
    borderWidth: 1,
    borderColor: FateDropColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FateDropColors.violetLight,
    borderWidth: 2,
    borderColor: '#12131A',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  monitorCard: {
    position: 'relative',
    backgroundColor: 'rgba(14, 16, 27, 0.94)',
    borderWidth: 1,
    borderColor: FateDropColors.border,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    overflow: 'hidden',
    marginBottom: 22,
    zIndex: 2,
  },
  monitorArtwork: {
    ...StyleSheet.absoluteFillObject,
    left: '42%',
    opacity: 0.5,
  },
  monitorShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 19, 0.48)',
  },
  encountersCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(29, 20, 44, 0.92)', borderWidth: 1,
    borderColor: `${FateDropColors.violetLight}66`, borderRadius: 22,
    padding: 18, marginBottom: 22, zIndex: 2,
    shadowColor: FateDropColors.violet,
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  encountersIcon: {
    width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${FateDropColors.violetLight}1F`,
  },
  encountersCopy: { flex: 1 },
  encountersTitle: { color: FateDropColors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  encountersSubtitle: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18 },
  encountersLine: { color: FateDropColors.violetLight, fontSize: 10, fontWeight: '700', marginTop: 7 },
  monitorGlow: {
    position: 'absolute',
    right: -20,
    top: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: `${FateDropColors.violetLight}20`,
  },
  monitorTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: FateDropColors.mint,
  },
  liveText: {
    color: FateDropColors.mint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  monitorTitle: {
    color: FateDropColors.text,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  monitorDescription: {
    color: FateDropColors.secondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  monitorEyebrow: {
    color: FateDropColors.cyan,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.7,
    marginBottom: 7,
  },
  monitorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: FateDropColors.border,
    paddingTop: 16,
  },
  metricWrap: {
    flex: 1,
  },
  monitorMetric: {
    color: FateDropColors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  monitorLabel: {
    color: FateDropColors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  verticalDivider: {
    width: 1,
    height: 42,
    backgroundColor: FateDropColors.border,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    zIndex: 2,
  },
  activityList: {
    marginBottom: 20,
    zIndex: 2,
  },
  retailerGrid: {
    gap: 10,
    marginBottom: 4,
  },
  retailerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 19, 26, 0.85)',
    borderWidth: 1,
    borderColor: FateDropColors.border,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    zIndex: 2,
  },
  retailerLogo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: `${FateDropColors.violetLight}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  retailerLogoText: {
    color: FateDropColors.violetLight,
    fontSize: 13,
    fontWeight: '800',
  },
  retailerContent: {
    flex: 1,
  },
  retailerName: {
    color: FateDropColors.text,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 2,
  },
  retailerProducts: {
    color: FateDropColors.muted,
    fontSize: 12,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${FateDropColors.mint}18`,
    borderWidth: 1,
    borderColor: `${FateDropColors.mint}52`,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: FateDropColors.mint,
  },
  onlineText: {
    color: FateDropColors.mint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  comingSoonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 16, 25, 0.72)',
    borderWidth: 1,
    borderColor: FateDropColors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  comingSoonContent: {
    flex: 1,
    marginLeft: 12,
  },
  comingSoonTitle: {
    color: FateDropColors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  comingSoonText: {
    color: FateDropColors.muted,
    fontSize: 12,
  },
  soonBadge: {
    color: FateDropColors.amber,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  partnerCard: {
    position: 'relative', overflow: 'hidden', backgroundColor: 'rgba(22,17,38,.96)',
    borderWidth: 1, borderColor: `${FateDropColors.violetLight}55`, borderRadius: 26,
    padding: 20, marginBottom: 10, shadowColor: FateDropColors.violet, shadowOpacity: .2,
    shadowRadius: 18, shadowOffset: { width: 0, height: 9 },
  },
  partnerGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -70, top: -80, backgroundColor: `${FateDropColors.violetLight}20` },
  partnerIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}12`, borderWidth: 1, borderColor: `${FateDropColors.cyan}38`, marginBottom: 16 },
  partnerEyebrow: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginBottom: 7 },
  partnerTitle: { color: FateDropColors.text, fontSize: 23, lineHeight: 29, fontWeight: '900', letterSpacing: -.6, maxWidth: '90%' },
  partnerCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 20, marginTop: 9 },
  partnerBenefits: { gap: 9, marginVertical: 17 },
  partnerBenefit: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  partnerBenefitText: { color: FateDropColors.text, fontSize: 12, fontWeight: '700' },
  partnerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: FateDropColors.violet, borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: FateDropColors.violetLight },
  partnerButtonText: { color: FateDropColors.text, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
});
