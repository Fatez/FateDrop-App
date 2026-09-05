import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';

export type CollectionArtKind = 'collection' | 'binders' | 'graded';

export function FateCollectionsArt({ kind, size = 96 }: { kind: CollectionArtKind; size?: number }) {
  const scale = size / 96;
  return (
    <View pointerEvents="none" style={[styles.stage, { width: size, height: size }]}> 
      <View style={[styles.orbitOuter, { width: 86 * scale, height: 86 * scale, borderRadius: 43 * scale }]} />
      <View style={[styles.orbitInner, { width: 58 * scale, height: 58 * scale, borderRadius: 29 * scale }]} />
      <View style={[styles.starTop, { transform: [{ scale }] }]}><Ionicons name="sparkles-outline" size={11} color={FateDropColors.goldBright} /></View>
      {kind === 'collection' ? <CollectionStack scale={scale} /> : null}
      {kind === 'binders' ? <BinderBook scale={scale} /> : null}
      {kind === 'graded' ? <SlabCase scale={scale} /> : null}
    </View>
  );
}

function CollectionStack({ scale }: { scale: number }) {
  return (
    <View style={styles.artCenter}>
      <View style={[styles.cardGhost, styles.cardGhostLeft, { width: 38 * scale, height: 52 * scale, borderRadius: 6 * scale, transform: [{ rotate: '-12deg' }, { translateX: -12 * scale }] }]} />
      <View style={[styles.cardGhost, styles.cardGhostRight, { width: 38 * scale, height: 52 * scale, borderRadius: 6 * scale, transform: [{ rotate: '12deg' }, { translateX: 12 * scale }] }]} />
      <View style={[styles.cardFace, { width: 42 * scale, height: 58 * scale, borderRadius: 7 * scale }]}> 
        <View style={[styles.cardFaceInner, { margin: 5 * scale, borderRadius: 4 * scale }]}>
          <Ionicons name="diamond-outline" size={18 * scale} color={FateDropColors.goldBright} />
        </View>
      </View>
    </View>
  );
}

function BinderBook({ scale }: { scale: number }) {
  return (
    <View style={styles.artCenter}>
      <View style={[styles.binderShadow, { width: 48 * scale, height: 59 * scale, borderRadius: 6 * scale, transform: [{ translateX: 8 * scale }, { rotate: '6deg' }] }]} />
      <View style={[styles.binderFace, { width: 52 * scale, height: 63 * scale, borderRadius: 7 * scale }]}> 
        <View style={[styles.binderSpine, { left: 7 * scale, top: 4 * scale, bottom: 4 * scale, width: 4 * scale }]} />
        <View style={[styles.binderEmblem, { width: 28 * scale, height: 28 * scale, borderRadius: 14 * scale }]}> 
          <Ionicons name="albums-outline" size={15 * scale} color={FateDropColors.goldBright} />
        </View>
      </View>
    </View>
  );
}

function SlabCase({ scale }: { scale: number }) {
  return (
    <View style={styles.artCenter}>
      <View style={[styles.slabGlow, { width: 58 * scale, height: 72 * scale, borderRadius: 8 * scale }]} />
      <View style={[styles.slabOuter, { width: 49 * scale, height: 67 * scale, borderRadius: 7 * scale }]}> 
        <View style={[styles.slabLabel, { marginHorizontal: 5 * scale, marginTop: 5 * scale, height: 10 * scale, borderRadius: 3 * scale }]} />
        <View style={[styles.slabCard, { marginHorizontal: 6 * scale, marginTop: 4 * scale, marginBottom: 6 * scale, borderRadius: 4 * scale }]}> 
          <Ionicons name="sparkles-outline" size={17 * scale} color={FateDropColors.goldBright} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  orbitOuter: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.42)' },
  orbitInner: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)' },
  starTop: { position: 'absolute', top: 3, right: 10 },
  artCenter: { alignItems: 'center', justifyContent: 'center' },
  cardGhost: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(124,110,255,.58)', backgroundColor: 'rgba(33,24,94,.52)' },
  cardGhostLeft: { left: -18 },
  cardGhostRight: { right: -18 },
  cardFace: { borderWidth: 1, borderColor: 'rgba(226,197,141,.74)', backgroundColor: 'rgba(9,13,37,.96)', shadowColor: '#7C6EFF', shadowOpacity: .5, shadowRadius: 13, shadowOffset: { width: 0, height: 0 } },
  cardFaceInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.62)', backgroundColor: 'rgba(124,110,255,.07)' },
  binderShadow: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(124,110,255,.42)', backgroundColor: 'rgba(30,20,84,.55)' },
  binderFace: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(226,197,141,.72)', backgroundColor: 'rgba(8,12,34,.98)', shadowColor: '#7C6EFF', shadowOpacity: .35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  binderSpine: { position: 'absolute', borderRadius: 2, backgroundColor: 'rgba(226,197,141,.28)' },
  binderEmblem: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.56)', backgroundColor: 'rgba(124,110,255,.08)' },
  slabGlow: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(124,110,255,.35)', backgroundColor: 'rgba(124,110,255,.06)', shadowColor: '#7C6EFF', shadowOpacity: .8, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  slabOuter: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(226,197,141,.72)', backgroundColor: 'rgba(205,220,245,.08)' },
  slabLabel: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.46)', backgroundColor: 'rgba(226,197,141,.10)' },
  slabCard: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.54)', backgroundColor: 'rgba(5,8,25,.92)' },
});
