import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';
import { resolveCanonicalCardThumbnailUrl, resolveCanonicalSetThumbnailUrl, type CanonicalThumbnailKind } from '@/lib/canonical-thumbnails';

export function CanonicalThumbnail({
  kind,
  setId,
  collectorNumber,
  sourceUrl = null,
  width,
  height,
  cornerRadius,
}: {
  kind: CanonicalThumbnailKind;
  setId: string | null | undefined;
  collectorNumber?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  width: number;
  height: number;
  cornerRadius?: number;
}) {
  const canonicalUrl = useMemo(() => sourceUrl || (kind === 'set'
    ? resolveCanonicalSetThumbnailUrl(setId)
    : resolveCanonicalCardThumbnailUrl({ setId, collectorNumber })), [collectorNumber, kind, setId, sourceUrl]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const showImage = Boolean(canonicalUrl && canonicalUrl !== failedUrl);
  const radius = kind === 'card' ? Math.max(5, Math.round(width * 0.16)) : Math.max(8, Math.round(width * 0.22));

  return (
    <View style={[styles.frame, { width, height, borderRadius: cornerRadius ?? radius }]}>
      {showImage ? (
        <Image
          source={{ uri: canonicalUrl! }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={120}
          onError={() => setFailedUrl(canonicalUrl!)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name={kind === 'card' ? 'sparkles-outline' : 'albums-outline'} size={Math.max(14, Math.round(Math.min(width, height) * 0.42))} color={FateDropColors.echo} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(226,197,141,.34)',
    backgroundColor: 'rgba(9,16,30,.76)',
  },
});