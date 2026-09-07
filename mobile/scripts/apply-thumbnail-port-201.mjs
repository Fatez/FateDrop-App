// Trigger guarded PR #201 thumbnail port.
import fs from 'node:fs';

function replaceExact(path, from, to, expected = 1) {
  let text = fs.readFileSync(path, 'utf8');
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} matches, found ${count}: ${from.slice(0, 100)}`);
  text = expected === 1 ? text.replace(from, to) : text.split(from).join(to);
  fs.writeFileSync(path, text);
}

// New simplified FatePulse Overview.
replaceExact(
  'mobile/screens/fate-pulse-overview-screen.tsx',
  "import { FateDropBackground } from '@/components/fatedrop-ui';",
  "import { CanonicalThumbnail } from '@/components/canonical-thumbnail';\nimport { FateDropBackground } from '@/components/fatedrop-ui';",
);
replaceExact(
  'mobile/screens/fate-pulse-overview-screen.tsx',
  '<View style={[styles.cardThumb, { borderColor: `${accent}45` }]}><Ionicons name="card-outline" size={18} color={accent} /></View>',
  '<CanonicalThumbnail kind="card" setId={item.setCode} collectorNumber={item.collectorNumber} width={36} height={50} />',
);
replaceExact(
  'mobile/screens/fate-pulse-overview-screen.tsx',
  '<View style={styles.setIcon}><Ionicons name="layers-outline" size={19} color={FateDropColors.goldBright} /></View>',
  '<CanonicalThumbnail kind="set" setId={item.setCode} width={44} height={44} />',
);

// Routed FatePulse Sets/Cards/My Pulse depth screen.
replaceExact(
  'mobile/screens/fate-pulse-screen.tsx',
  "import { FateDropBackground } from '@/components/fatedrop-ui';",
  "import { CanonicalThumbnail } from '@/components/canonical-thumbnail';\nimport { FateDropBackground } from '@/components/fatedrop-ui';",
);
replaceExact(
  'mobile/screens/fate-pulse-screen.tsx',
  '<Text style={styles.compactRank}>{rank}</Text>\n      <View style={styles.compactSetCopy}>',
  '<Text style={styles.compactRank}>{rank}</Text>\n      <CanonicalThumbnail kind="set" setId={item.setCode} width={28} height={28} />\n      <View style={styles.compactSetCopy}>',
);
replaceExact(
  'mobile/screens/fate-pulse-screen.tsx',
  '<View style={[styles.thumb, { borderColor: `${accent}54` }]}><Ionicons name="layers-outline" size={17} color={accent} /></View>',
  '<CanonicalThumbnail kind="set" setId={item.setCode} width={38} height={38} />',
);
replaceExact(
  'mobile/screens/fate-pulse-screen.tsx',
  '<View style={[styles.cardThumb, { borderColor: `${accent}54` }]}><Ionicons name="sparkles-outline" size={16} color={accent} /></View>',
  '<CanonicalThumbnail kind="card" setId={item.setCode} collectorNumber={item.collectorNumber} width={34} height={44} />',
);

// Binders.
replaceExact(
  'mobile/screens/fate-binders-screen.tsx',
  "import { FateCollectionsArt } from '@/components/fate-collections-art';",
  "import { CanonicalThumbnail } from '@/components/canonical-thumbnail';\nimport { FateCollectionsArt } from '@/components/fate-collections-art';",
);
replaceExact(
  'mobile/screens/fate-binders-screen.tsx',
  '<FateCollectionsArt kind="binders" size={104} />',
  '<CanonicalThumbnail kind="set" setId={closest.setId} width={104} height={104} />',
);
replaceExact(
  'mobile/screens/fate-binders-screen.tsx',
  '<View style={styles.neededMiniArt}><Ionicons name="sparkles-outline" size={14} color={FateDropColors.echo} /></View>',
  '<CanonicalThumbnail kind="card" setId={card.setId} collectorNumber={card.collectorNumber} sourceUrl={card.thumbnailUrl || card.imageUrl} width={28} height={39} />',
);

// Personal Collection.
replaceExact(
  'mobile/screens/fate-collection-browser-screen.tsx',
  "import { Image } from 'expo-image';\n",
  '',
);
replaceExact(
  'mobile/screens/fate-collection-browser-screen.tsx',
  "import { CollectionsScreen } from '@/components/fate-collections-ui';",
  "import { CanonicalThumbnail } from '@/components/canonical-thumbnail';\nimport { CollectionsScreen } from '@/components/fate-collections-ui';",
);
replaceExact(
  'mobile/screens/fate-collection-browser-screen.tsx',
  '{art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="contain" cachePolicy="memory-disk" /> : <CardPlaceholder />}',
  '<CanonicalThumbnail kind="card" setId={card?.setId} collectorNumber={card?.collectorNumber} sourceUrl={art} width={48} height={68} />',
  2,
);
replaceExact(
  'mobile/screens/fate-collection-browser-screen.tsx',
  '<View style={styles.setIcon}><Ionicons name="albums-outline" size={24} color={FateDropColors.goldBright} /></View>',
  '<CanonicalThumbnail kind="set" setId={set.setId} width={48} height={48} />',
);
replaceExact(
  'mobile/screens/fate-collection-browser-screen.tsx',
  'function CardPlaceholder() { return <View style={styles.cardArtPlaceholder}><Ionicons name="sparkles-outline" size={18} color={FateDropColors.echo} /></View>; }\n\n',
  '',
);

// Graded.
replaceExact(
  'mobile/screens/fate-graded-collection-screen.tsx',
  "import { Image } from 'expo-image';\n",
  '',
);
replaceExact(
  'mobile/screens/fate-graded-collection-screen.tsx',
  "import { FateCollectionsArt } from '@/components/fate-collections-art';",
  "import { CanonicalThumbnail } from '@/components/canonical-thumbnail';\nimport { FateCollectionsArt } from '@/components/fate-collections-art';",
);
replaceExact(
  'mobile/screens/fate-graded-collection-screen.tsx',
  '{art ? <Image source={{ uri: art }} style={styles.slabArt} contentFit="contain" cachePolicy="memory-disk" /> : <View style={styles.slabArtPlaceholder}><Ionicons name="diamond-outline" size={22} color={FateDropColors.echo} /></View>}',
  '<CanonicalThumbnail kind="card" setId={card?.setId} collectorNumber={card?.collectorNumber} sourceUrl={art} width={54} height={79} />',
);

console.log('Thumbnail port applied to PR #201 branch.');
