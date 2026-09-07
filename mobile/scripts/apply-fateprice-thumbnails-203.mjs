import fs from 'node:fs';

function replaceExact(path, from, to, expected = 1) {
  let text = fs.readFileSync(path, 'utf8');
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} matches, found ${count}`);
  text = text.replace(from, to);
  fs.writeFileSync(path, text);
}

const discovery = 'mobile/screens/fate-price-discovery-screen.tsx';
const setScreen = 'mobile/screens/fate-price-set-screen.tsx';
const variants = 'mobile/screens/fate-price-variants-screen.tsx';
const detail = 'mobile/screens/fate-price-screen.tsx';
const buy = 'mobile/screens/fate-price-buy-screen.tsx';

// Discovery: set matches, card matches, and verified-set rail.
replaceExact(discovery,
  "import { Ionicons } from '@expo/vector-icons';\n",
  "import { Ionicons } from '@expo/vector-icons';\n\nimport { CanonicalThumbnail } from '@/components/canonical-thumbnail';\n"
);
replaceExact(discovery, "  FatePriceCardGlyph,\n", '');
replaceExact(discovery,
  '<View style={styles.setArt}><View style={styles.setOrbit} /><Ionicons name="albums-outline" size={26} color={FateDropColors.goldBright} /></View>',
  '<View style={styles.setArt}><CanonicalThumbnail kind="set" setId={set.id} width={58} height={58} /></View>'
);
replaceExact(discovery,
  '<View style={styles.resultIcon}><Ionicons name="albums-outline" size={19} color={FateDropColors.goldBright} /></View>',
  '<CanonicalThumbnail kind="set" setId={set.id} width={38} height={38} />'
);
replaceExact(discovery,
  '<FatePriceCardGlyph collectorNumber={card.collectorNumber} />',
  '<CanonicalThumbnail kind="card" setId={card.setId} collectorNumber={card.collectorNumber} width={36} height={50} />'
);

// Set: set logo and canonical card grid art.
replaceExact(setScreen,
  "import { Ionicons } from '@expo/vector-icons';\n",
  "import { Ionicons } from '@expo/vector-icons';\n\nimport { CanonicalThumbnail } from '@/components/canonical-thumbnail';\n"
);
replaceExact(setScreen,
  "import { FatePriceCardGlyph, FatePriceScreenBackground, FatePriceTopBar, FatePriceTruth } from '@/components/fate-price-chrome';",
  "import { FatePriceScreenBackground, FatePriceTopBar, FatePriceTruth } from '@/components/fate-price-chrome';"
);
replaceExact(setScreen,
  '<View style={styles.setMark}><Ionicons name="albums-outline" size={26} color={FateDropColors.goldBright} /><View style={styles.setOrbit} /></View>',
  '<View style={styles.setMark}><CanonicalThumbnail kind="set" setId={setId} width={51} height={51} /></View>'
);
replaceExact(setScreen,
  '<View style={styles.glyphWrap}><FatePriceCardGlyph collectorNumber={group.collectorNumber} large /></View>',
  '<View style={styles.glyphWrap}><CanonicalThumbnail kind="card" setId={group.cards[0]?.setId || setId} collectorNumber={group.collectorNumber} width={84} height={118} /></View>'
);

// Variants: anchor artwork plus compact artwork on each exact identity row.
replaceExact(variants,
  "import { Ionicons } from '@expo/vector-icons';\n",
  "import { Ionicons } from '@expo/vector-icons';\n\nimport { CanonicalThumbnail } from '@/components/canonical-thumbnail';\n"
);
replaceExact(variants,
  "import { FatePriceCardGlyph, FatePriceScreenBackground, FatePriceTopBar, FatePriceTruth } from '@/components/fate-price-chrome';",
  "import { FatePriceScreenBackground, FatePriceTopBar, FatePriceTruth } from '@/components/fate-price-chrome';"
);
replaceExact(variants,
  '<FatePriceCardGlyph collectorNumber={collectorNumber} large />',
  '<CanonicalThumbnail kind="card" setId={anchor?.setId || setId} collectorNumber={collectorNumber} width={94} height={132} />'
);
replaceExact(variants,
  '        <View style={styles.variantIndex}><Text style={styles.variantIndexText}>{String(index + 1).padStart(2, \'0\')}</Text><View style={styles.variantLine} /></View>\n        <View style={styles.variantMain}>',
  '        <View style={styles.variantIndex}><Text style={styles.variantIndexText}>{String(index + 1).padStart(2, \'0\')}</Text><View style={styles.variantLine} /></View>\n        <CanonicalThumbnail kind="card" setId={card.setId} collectorNumber={card.collectorNumber} width={52} height={73} />\n        <View style={styles.variantMain}>'
);

// Exact-card detail: search results and selected canonical identity.
replaceExact(detail,
  "import { AddToFateCollectorAction } from '@/components/add-to-fate-collector-action';\n",
  "import { AddToFateCollectorAction } from '@/components/add-to-fate-collector-action';\nimport { CanonicalThumbnail } from '@/components/canonical-thumbnail';\n"
);
replaceExact(detail,
  "import { FatePriceCardGlyph, FatePriceScreenBackground, FatePriceTopBar } from '@/components/fate-price-chrome';",
  "import { FatePriceScreenBackground, FatePriceTopBar } from '@/components/fate-price-chrome';"
);
replaceExact(detail,
  '<View style={styles.resultGem}><Ionicons name="diamond-outline" size={15} color={FateDropColors.goldBright} /></View>',
  '<CanonicalThumbnail kind="card" setId={card.setId} collectorNumber={card.collectorNumber} width={36} height={50} />'
);
replaceExact(detail,
  '<FatePriceCardGlyph collectorNumber={selectedNumber} />',
  '<CanonicalThumbnail kind="card" setId={selectedCard?.setId || routeSetId} collectorNumber={selectedNumber} width={50} height={70} />'
);

// Retailer comparison: keep retailer evidence separate, but show the exact canonical card being compared.
replaceExact(buy,
  "import { Ionicons } from '@expo/vector-icons';\n",
  "import { Ionicons } from '@expo/vector-icons';\n\nimport { CanonicalThumbnail } from '@/components/canonical-thumbnail';\n"
);
replaceExact(buy,
  "import { FatePriceCardGlyph, FatePriceScreenBackground, FatePriceTopBar, FatePriceTruth } from '@/components/fate-price-chrome';",
  "import { FatePriceScreenBackground, FatePriceTopBar, FatePriceTruth } from '@/components/fate-price-chrome';"
);
replaceExact(buy,
  '<FatePriceCardGlyph collectorNumber={collectorNumber} />',
  '<CanonicalThumbnail kind="card" setId={card?.setId} collectorNumber={collectorNumber} width={54} height={76} />'
);

const integrationTest = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst files = [\n  'mobile/screens/fate-price-discovery-screen.tsx',\n  'mobile/screens/fate-price-set-screen.tsx',\n  'mobile/screens/fate-price-variants-screen.tsx',\n  'mobile/screens/fate-price-screen.tsx',\n  'mobile/screens/fate-price-buy-screen.tsx',\n];\n\ntest('FatePrice journey uses the shared canonical thumbnail boundary', () => {\n  for (const path of files) {\n    const source = fs.readFileSync(path, 'utf8');\n    assert.match(source, /CanonicalThumbnail/);\n  }\n});\n\ntest('FatePrice never introduces retailer or fuzzy image matching', () => {\n  const source = files.map((path) => fs.readFileSync(path, 'utf8')).join('\\n');\n  assert.doesNotMatch(source, /google images|fuzzy.*image|retailer.*imageUrl/i);\n  assert.match(source, /kind=\\"card\\"/);\n  assert.match(source, /kind=\\"set\\"/);\n});\n`;
fs.writeFileSync('mobile/lib/fateprice-thumbnails.test.js', integrationTest);

console.log('FatePrice canonical thumbnails wired across discovery, set, variants, detail and retailer comparison.');
