import fs from 'node:fs';

function patch(path, replacements) {
  let text = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`${path}: expected exactly one match, found ${count}: ${from.slice(0, 80)}`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(path, text);
}

patch('mobile/screens/fate-pulse-screen.tsx', [
  [
    "import { FateDropBackground } from '@/components/fatedrop-ui';",
    "import { CanonicalThumbnail } from '@/components/canonical-thumbnail';\nimport { FateDropBackground } from '@/components/fatedrop-ui';",
  ],
  [
    '<Text style={styles.compactRank}>{rank}</Text>\n      <View style={styles.compactSetCopy}>',
    '<Text style={styles.compactRank}>{rank}</Text>\n      <CanonicalThumbnail kind="set" setId={item.setCode} width={28} height={28} />\n      <View style={styles.compactSetCopy}>',
  ],
  [
    '<View style={[styles.thumb, { borderColor: `${accent}54` }]}><Ionicons name="layers-outline" size={17} color={accent} /></View>',
    '<CanonicalThumbnail kind="set" setId={item.setCode} width={38} height={38} />',
  ],
  [
    '<View style={[styles.cardThumb, { borderColor: `${accent}54` }]}><Ionicons name="sparkles-outline" size={16} color={accent} /></View>',
    '<CanonicalThumbnail kind="card" setId={item.setCode} collectorNumber={item.collectorNumber} width={34} height={44} />',
  ],
]);

patch('mobile/screens/fate-binders-screen.tsx', [
  [
    "import { FateCollectionsArt } from '@/components/fate-collections-art';",
    "import { CanonicalThumbnail } from '@/components/canonical-thumbnail';\nimport { FateCollectionsArt } from '@/components/fate-collections-art';",
  ],
  [
    '<FateCollectionsArt kind="binders" size={104} />',
    '<CanonicalThumbnail kind="set" setId={closest.setId} width={104} height={104} />',
  ],
  [
    '<View style={styles.neededMiniArt}><Ionicons name="sparkles-outline" size={14} color={FateDropColors.echo} /></View>',
    '<CanonicalThumbnail kind="card" setId={card.setId} collectorNumber={card.collectorNumber} sourceUrl={card.thumbnailUrl || card.imageUrl} width={28} height={39} />',
  ],
]);

patch('mobile/screens/fate-collection-browser-screen.tsx', [
  [
    "import { CollectionsScreen } from '@/components/fate-collections-ui';",
    "import { CanonicalThumbnail } from '@/components/canonical-thumbnail';\nimport { CollectionsScreen } from '@/components/fate-collections-ui';",
  ],
  [
    '{art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="contain" cachePolicy="memory-disk" /> : <CardPlaceholder />}',
    '<CanonicalThumbnail kind="card" setId={card.setId} collectorNumber={card.collectorNumber} sourceUrl={art} width={48} height={68} />',
  ],
  [
    '{art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="contain" cachePolicy="memory-disk" /> : <CardPlaceholder />}',
    '<CanonicalThumbnail kind="card" setId={card?.setId} collectorNumber={card?.collectorNumber} sourceUrl={art} width={48} height={68} />',
  ],
  [
    '<View style={styles.setIcon}><Ionicons name="albums-outline" size={24} color={FateDropColors.goldBright} /></View>',
    '<CanonicalThumbnail kind="set" setId={set.setId} width={48} height={48} />',
  ],
]);

patch('mobile/screens/fate-graded-collection-screen.tsx', [
  [
    "import { FateCollectionsArt } from '@/components/fate-collections-art';",
    "import { CanonicalThumbnail } from '@/components/canonical-thumbnail';\nimport { FateCollectionsArt } from '@/components/fate-collections-art';",
  ],
  [
    '{art ? <Image source={{ uri: art }} style={styles.slabArt} contentFit="contain" cachePolicy="memory-disk" /> : <View style={styles.slabArtPlaceholder}><Ionicons name="diamond-outline" size={22} color={FateDropColors.echo} /></View>}',
    '<CanonicalThumbnail kind="card" setId={card?.setId} collectorNumber={card?.collectorNumber} sourceUrl={art} width={54} height={79} />',
  ],
]);

console.log('Canonical thumbnail pilot applied to FatePulse, Binders, Personal Collection and Graded.');
