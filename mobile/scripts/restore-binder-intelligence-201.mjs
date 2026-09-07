import fs from 'node:fs';

function replaceExact(path, from, to, expected = 1) {
  let text = fs.readFileSync(path, 'utf8');
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} matches, found ${count}`);
  text = text.replace(from, to);
  fs.writeFileSync(path, text);
}

const screen = 'mobile/screens/fate-binder-screen-v2.tsx';
const service = 'mobile/services/fate-collector.ts';

replaceExact(screen,
  "import { Image } from 'expo-image';\n",
  ""
);
replaceExact(screen,
  "import { FateCollectionsArt } from '@/components/fate-collections-art';",
  "import { CanonicalThumbnail } from '@/components/canonical-thumbnail';\nimport { FateCollectionsArt } from '@/components/fate-collections-art';"
);
replaceExact(screen,
  "{art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit=\"contain\" cachePolicy=\"memory-disk\" /> : <View style={styles.cardArtPlaceholder}><Ionicons name=\"sparkles-outline\" size={24} color={FateDropColors.echo} /></View>}",
  "<CanonicalThumbnail kind=\"card\" setId={card.setId} collectorNumber={card.collectorNumber} sourceUrl={art} width={76} height={106} />"
);
replaceExact(screen,
  "{art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit=\"contain\" cachePolicy=\"memory-disk\" /> : <View style={[styles.cardArtPlaceholder, styles.ownedArt]}><Ionicons name=\"checkmark-circle-outline\" size={24} color={FateDropColors.manifested} /></View>}",
  "<CanonicalThumbnail kind=\"card\" setId={card?.setId || setId} collectorNumber={card?.collectorNumber} sourceUrl={art} width={76} height={106} />"
);
replaceExact(screen,
  "{ icon: 'wallet-outline', value: money(binder?.value?.missingValue, currency), label: 'MISSING VALUE', color: FateDropColors.goldBright },",
  "{ icon: 'wallet-outline', value: money(binder?.value?.missingValue ?? binder?.value?.knownMissingValue, currency), label: binder?.value?.missingValue != null ? 'COST TO FINISH' : 'KNOWN REMAINDER', color: FateDropColors.goldBright },"
);
replaceExact(screen,
  "      ]} />\n\n      <View style={styles.valueBand}>",
  "      ]} />\n      <View style={styles.progressTruth}><Ionicons name=\"calculator-outline\" size={15} color={FateDropColors.goldBright} /><Text style={styles.progressTruthText}>{binder?.value?.missingExpectedCount != null ? binder.value.missingUnpricedCount === 0 ? `All ${binder.value.missingExpectedCount} missing slots have verified current prices. Cost to finish is fully covered.` : `${binder.value.missingPricedCount ?? 0} of ${binder.value.missingExpectedCount} missing slots are priced · ${binder.value.missingUnpricedCount ?? 0} still unpriced. FateDrop shows the known remainder and does not estimate the rest.` : 'Finish-cost coverage appears as verified price evidence becomes available.'}</Text></View>\n\n      <View style={styles.valueBand}>"
);
replaceExact(service,
  "export type FateCollectorBinderValue = {\n  fullSetValue: number | null;\n  ownedValue: number | null;\n  missingValue: number | null;\n  currencyCode: string;",
  "export type FateCollectorBinderValue = {\n  fullSetValue: number | null;\n  ownedValue: number | null;\n  missingValue: number | null;\n  knownMissingValue?: number | null;\n  missingExpectedCount?: number | null;\n  missingPricedCount?: number | null;\n  missingUnpricedCount?: number | null;\n  missingPriceCoveragePercent?: number | null;\n  currencyCode: string;"
);

console.log('Binder artwork and finish-cost coverage restored.');
