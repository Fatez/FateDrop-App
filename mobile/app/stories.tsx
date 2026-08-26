import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';

const INTRO_VIDEO = require('@/assets/stories/intro/gemini_generated_video_BF2DED27.mp4');

const MANGA_PAGES = [
  require('@/assets/stories/manga/page-01.webp'),
  require('@/assets/stories/manga/page-02.webp'),
  require('@/assets/stories/manga/page-03.webp'),
  require('@/assets/stories/manga/page-04.webp'),
  require('@/assets/stories/manga/page-05.webp'),
  require('@/assets/stories/manga/page-06.webp'),
  require('@/assets/stories/manga/page-07.webp'),
  require('@/assets/stories/manga/page-08.webp'),
  require('@/assets/stories/manga/page-09.webp'),
  require('@/assets/stories/manga/page-10.webp'),
];

export default function StoriesScreen() {
  const [started, setStarted] = useState(false);

  return (
    <View style={styles.screenRoot}>
      <FateDropBackground />
      {started ? <MangaReader /> : <StoriesIntro onBegin={() => setStarted(true)} />}
    </View>
  );
}

function StoriesIntro({ onBegin }: { onBegin: () => void }) {
  const player = useVideoPlayer(INTRO_VIDEO, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  return (
    <View style={styles.introRoot}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      </View>
      <View pointerEvents="none" style={styles.introShade} />
      <View pointerEvents="none" style={styles.introGlow} />

      <SafeAreaView style={styles.introSafe} edges={['top', 'bottom']}>
        <View style={styles.introTopRow}>
          <CircleButton icon="close" label="Close Stories" onPress={() => router.back()} />
          <Pressable accessibilityRole="button" accessibilityLabel="Skip Stories introduction" onPress={onBegin} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
            <Text style={styles.skipText}>SKIP</Text>
          </Pressable>
        </View>

        <View style={styles.introCopy}>
          <View style={styles.introKicker}>
            <Ionicons name="book-outline" size={13} color={FateDropColors.goldBright} />
            <Text style={styles.introKickerText}>FATEDROP STORIES</Text>
          </View>
          <Image source={require('@/assets/images/fatedrop-wordmark.png')} style={styles.introWordmark} contentFit="contain" contentPosition="left center" />
          <Text style={styles.introTitle}>How FateDrop works.</Text>
          <Text style={styles.introDetail}>A ten-page journey through FateFind, verification, True Price and the signal behind the search.</Text>

          <Pressable accessibilityRole="button" accessibilityLabel="Begin FateDrop Story" onPress={onBegin} style={({ pressed }) => [styles.beginButton, pressed && styles.pressed]}>
            <View>
              <Text style={styles.beginLabel}>TAP TO BEGIN</Text>
              <Text style={styles.beginMeta}>10-page manga · sound off</Text>
            </View>
            <View style={styles.beginArrow}>
              <Ionicons name="arrow-forward" size={18} color="#0A0D12" />
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function MangaReader() {
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<number>>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);

  const goToPage = useCallback((nextIndex: number) => {
    const safeIndex = Math.max(0, Math.min(MANGA_PAGES.length - 1, nextIndex));
    listRef.current?.scrollToOffset({ offset: safeIndex * width, animated: true });
    setPageIndex(safeIndex);
  }, [width]);

  const onMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.max(0, Math.min(MANGA_PAGES.length - 1, Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1))));
    setPageIndex(nextIndex);
  }, [width]);

  return (
    <View style={styles.readerRoot}>
      <FlatList
        ref={listRef}
        data={MANGA_PAGES}
        keyExtractor={(_, index) => `story-page-${index + 1}`}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={3}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`FateDrop Story page ${index + 1} of ${MANGA_PAGES.length}. Tap to ${controlsVisible ? 'hide' : 'show'} reader controls.`}
            onPress={() => setControlsVisible((visible) => !visible)}
            style={{ width, height }}>
            <Image source={item} style={styles.mangaPage} contentFit="contain" transition={110} />
          </Pressable>
        )}
      />

      {controlsVisible ? (
        <SafeAreaView pointerEvents="box-none" style={styles.readerOverlay} edges={['top', 'bottom']}>
          <View style={styles.readerTopRow}>
            <CircleButton icon="arrow-back" label="Back to Profile" onPress={() => router.back()} />
            <View style={styles.pageCounter}>
              <Text style={styles.pageCounterText}>{pageIndex + 1} / {MANGA_PAGES.length}</Text>
            </View>
          </View>

          <View style={styles.readerBottomWrap}>
            <Text style={styles.swipeHint}>SWIPE TO TURN PAGES · TAP TO HIDE CONTROLS</Text>
            <View style={styles.readerControls}>
              <ReaderButton icon="chevron-back" label="Previous" disabled={pageIndex === 0} onPress={() => goToPage(pageIndex - 1)} />
              <View style={styles.pageTicks}>
                {MANGA_PAGES.map((_, index) => (
                  <View key={`tick-${index}`} style={[styles.pageTick, index === pageIndex && styles.pageTickActive]} />
                ))}
              </View>
              <ReaderButton icon="chevron-forward" label="Next" disabled={pageIndex === MANGA_PAGES.length - 1} onPress={() => goToPage(pageIndex + 1)} />
            </View>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

function CircleButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={FateDropColors.ivory} />
    </Pressable>
  );
}

function ReaderButton({ icon, label, disabled, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.readerButton, disabled && styles.readerButtonDisabled, pressed && !disabled && styles.pressed]}>
      <Ionicons name={icon} size={19} color={disabled ? 'rgba(255,255,255,.25)' : FateDropColors.goldBright} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: '#030407' },
  introRoot: { flex: 1, backgroundColor: '#07090E' },
  introShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,5,10,.31)' },
  introGlow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%', backgroundColor: 'rgba(4,6,12,.53)' },
  introSafe: { flex: 1, justifyContent: 'space-between' },
  introTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6 },
  circleButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', backgroundColor: 'rgba(4,8,14,.66)' },
  skipButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,.14)', backgroundColor: 'rgba(4,8,14,.54)' },
  skipText: { color: FateDropColors.ivory, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  introCopy: { paddingHorizontal: 22, paddingBottom: 18 },
  introKicker: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.gold}55`, backgroundColor: 'rgba(6,9,15,.58)' },
  introKickerText: { color: FateDropColors.goldBright, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.25 },
  introWordmark: { width: 190, height: 52, marginTop: 12 },
  introTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 29, lineHeight: 34, fontWeight: '800', marginTop: 4 },
  introDetail: { color: 'rgba(245,242,235,.76)', fontSize: 13, lineHeight: 19, marginTop: 8, maxWidth: 390 },
  beginButton: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 18, paddingLeft: 17, paddingRight: 10, paddingVertical: 9, borderRadius: 19, borderWidth: 1, borderColor: `${FateDropColors.gold}77`, backgroundColor: 'rgba(8,12,19,.86)' },
  beginLabel: { color: FateDropColors.ivory, fontSize: 12.5, fontWeight: '900', letterSpacing: 1.15 },
  beginMeta: { color: FateDropColors.secondary, fontSize: 9.5, marginTop: 4 },
  beginArrow: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.goldBright },

  readerRoot: { flex: 1, backgroundColor: '#030407' },
  mangaPage: { width: '100%', height: '100%', backgroundColor: '#030407' },
  readerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  readerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 5 },
  pageCounter: { minWidth: 62, height: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)', backgroundColor: 'rgba(3,6,10,.76)' },
  pageCounterText: { color: FateDropColors.ivory, fontSize: 11, fontWeight: '900', letterSpacing: .8 },
  readerBottomWrap: { paddingHorizontal: 15, paddingBottom: 8 },
  swipeHint: { color: 'rgba(255,255,255,.48)', fontSize: 7.5, fontWeight: '800', letterSpacing: .8, textAlign: 'center', marginBottom: 7 },
  readerControls: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', backgroundColor: 'rgba(3,6,10,.83)' },
  readerButton: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}44`, backgroundColor: `${FateDropColors.gold}0D` },
  readerButtonDisabled: { borderColor: 'rgba(255,255,255,.08)', backgroundColor: 'rgba(255,255,255,.03)' },
  pageTicks: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingHorizontal: 7 },
  pageTick: { width: 5, height: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.22)' },
  pageTickActive: { width: 15, backgroundColor: FateDropColors.goldBright },
  pressed: { opacity: .68 },
});