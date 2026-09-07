import fs from 'node:fs';

// One-shot guarded port: exact top-missing Binder UI on PR #201.
function replaceExact(path, from, to, expected = 1) {
  let text = fs.readFileSync(path, 'utf8');
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} matches, found ${count}`);
  text = text.replace(from, to);
  fs.writeFileSync(path, text);
}

const screen = 'mobile/screens/fate-binder-screen-v2.tsx';
const service = 'mobile/services/fate-collector.ts';

replaceExact(service,
  "  missingCards?: FateCollectorMissingCard[];\n  value?: FateCollectorBinderValue | null;",
  "  missingCards?: FateCollectorMissingCard[];\n  topMissingCards?: FateCollectorMissingCard[];\n  value?: FateCollectorBinderValue | null;"
);
replaceExact(service,
  "  languageCode: string | null;\n};\n\nexport type FateCollectorValueCoverage",
  "  languageCode: string | null;\n  currentPrice?: number | null;\n  currencyCode?: string | null;\n  priceObservedAt?: number | null;\n};\n\nexport type FateCollectorValueCoverage"
);
replaceExact(screen,
  "  const currency = binder?.value?.currencyCode || 'GBP';",
  "  const currency = binder?.value?.currencyCode || 'GBP';\n  const topMissing = binder?.topMissingCards?.slice(0, 3) || [];\n  const missingPriceCoverageComplete = binder?.value?.missingExpectedCount != null && binder?.value?.missingUnpricedCount === 0;"
);
replaceExact(screen,
  "      <View style={styles.valueBand}>",
  "      {topMissing.length ? <>\n        <FateSectionHeading eyebrow=\"FINISH THE SET\" title={missingPriceCoverageComplete ? '3 most expensive cards left' : 'Highest-priced known cards left'} copy={missingPriceCoverageComplete ? 'The three highest current FatePrice values among the exact cards you still need.' : 'Price coverage is incomplete, so these are the highest-priced missing cards FateDrop can verify right now.'} />\n        <View style={styles.topMissingRail}>\n          {topMissing.map((card) => <Pressable key={`top:${card.fateCardId}`} accessibilityRole=\"button\" onPress={() => router.push({ pathname: '/fate-price', params: { cardId: card.fateCardId, name: card.name || undefined, collectorNumber: card.collectorNumber || undefined, setId: card.setId, setName: card.setName || undefined, tcg: card.tcgCode || undefined } })} style={({ pressed }) => [styles.topMissingCard, pressed && styles.pressed]}>\n            <CanonicalThumbnail kind=\"card\" setId={card.setId} collectorNumber={card.collectorNumber} sourceUrl={card.thumbnailUrl || card.imageUrl} width={54} height={76} />\n            <Text style={styles.topMissingName} numberOfLines={2}>{card.name || 'Verified card'}</Text>\n            <Text style={styles.topMissingNumber}>#{card.collectorNumber || '—'}</Text>\n            <Text style={styles.topMissingPrice}>{money(card.currentPrice, card.currencyCode || currency)}</Text>\n          </Pressable>)}\n        </View>\n      </> : null}\n\n      <View style={styles.valueBand}>"
);
replaceExact(screen,
  "  card: { minHeight: 290,",
  "  topMissingRail: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 }, topMissingCard: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, padding: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(226,197,141,.28)', backgroundColor: 'rgba(5,9,20,.82)' }, topMissingName: { color: FateDropColors.ivory, fontSize: 9.5, fontWeight: '800', textAlign: 'center', marginTop: 3 }, topMissingNumber: { color: FateDropColors.muted, fontSize: 7.5 }, topMissingPrice: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', marginTop: 2 },\n  card: { minHeight: 290,"
);

console.log('Binder top-missing UI wired.');
