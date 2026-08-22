import { readFileSync, writeFileSync } from 'node:fs';

// One-shot deterministic migration: this helper is removed after the Alerts
// change lands so the feature branch stays clean.
const path = 'mobile/screens/alerts-screen-v2.tsx';
let source = readFileSync(path, 'utf8');

const oldImport = "import type { CompanionReaction } from '@/lib/companion-contract';";
const newImport = "import { ACTIVE_COMPANION_ROSTER, companionDefinition, type CompanionReaction } from '@/lib/companion-contract';";
if (source.includes(oldImport)) source = source.replace(oldImport, newImport);

const oldIdentity = "  const companionName = selectedCompanion === 'male' ? 'KAEL' : 'NYRA';\n  const companionCode = selectedCompanion === 'male' ? 'K-01' : 'N-02';";
const newIdentity = "  const activeCompanion = companionDefinition(selectedCompanion);\n  const companionName = activeCompanion.name.toUpperCase();\n  const companionCode = activeCompanion.code;";
if (source.includes(oldIdentity)) source = source.replace(oldIdentity, newIdentity);

const oldChooser = `        <View style={styles.companionChooser}>
          <Pressable onPress={() => selectCompanion('male')} style={[styles.companionChoice, selectedCompanion === 'male' && styles.companionChoiceActive]}>
            <Text style={[styles.companionChoiceText, selectedCompanion === 'male' && styles.companionChoiceTextActive]}>KAEL</Text>
          </Pressable>
          <Pressable onPress={() => selectCompanion('female')} style={[styles.companionChoice, selectedCompanion === 'female' && styles.companionChoiceActive]}>
            <Text style={[styles.companionChoiceText, selectedCompanion === 'female' && styles.companionChoiceTextActive]}>NYRA</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: '/companion', params: { variant: selectedCompanion } })} style={styles.companionManage}>
            <Text style={styles.companionManageText}>OPEN COMPANION</Text>
            <Ionicons name="arrow-forward" size={12} color={FateDropColors.cyan} />
          </Pressable>
        </View>`;

const newChooser = `        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.companionChooser}>
          {ACTIVE_COMPANION_ROSTER.map((companion) => {
            const active = selectedCompanion === companion.id;
            return (
              <Pressable key={companion.id} onPress={() => selectCompanion(companion.id)} style={[styles.companionChoice, active && styles.companionChoiceActive]}>
                <Text style={[styles.companionChoiceText, active && styles.companionChoiceTextActive]}>{companion.name.toUpperCase()}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => router.push({ pathname: '/companion', params: { variant: selectedCompanion } })} style={styles.companionManage}>
            <Text style={styles.companionManageText}>OPEN GUIDE</Text>
            <Ionicons name="arrow-forward" size={12} color={FateDropColors.cyan} />
          </Pressable>
        </ScrollView>`;
if (source.includes(oldChooser)) source = source.replace(oldChooser, newChooser);

source = source.replace(
  "  companionChooser: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },",
  "  companionChooser: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingRight: 14, marginBottom: 10 },",
);
source = source.replace(
  "  companionManage: { marginLeft: 'auto', flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 9 },",
  "  companionManage: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9 },",
);

if (source.includes("selectCompanion('male')") || source.includes("selectCompanion('female')")) {
  throw new Error('Legacy KAEL/NYRA chooser survived patch. Refusing to write.');
}
if (!source.includes('ACTIVE_COMPANION_ROSTER.map')) {
  throw new Error('Oru & Friends chooser was not installed. Refusing to write.');
}

writeFileSync(path, source);
console.log('Alerts companion picker migrated to Oru & Friends.');
