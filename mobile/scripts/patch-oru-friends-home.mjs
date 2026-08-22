import { readFileSync, writeFileSync } from 'node:fs';

const path = 'mobile/app/(tabs)/index.tsx';
const source = readFileSync(path, 'utf8');

if (source.includes('<SectionHeader title="Oru & Friends" action="Signal guides" />')) {
  console.log('Oru & Friends Home section already present.');
  process.exit(0);
}

const startMarker = '        <SectionHeader title="FateDrop companions" action="Signal identities" />';
const endMarker = '        <SectionHeader title="Network activity" action={recentEvents.length ? \'Observed\' : undefined} />';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) {
  throw new Error('Expected legacy Home companion section markers were not found. Refusing a speculative patch.');
}

const replacement = `        <SectionHeader title="Oru & Friends" action="Signal guides" />
        <View style={styles.companionPanel}>
          <View style={styles.companionIntro}>
            <View style={styles.companionSignalIcon}>
              <Ionicons name="sparkles" size={18} color={FateDropColors.cyan} />
            </View>
            <View style={styles.companionIntroCopy}>
              <Text style={styles.companionEyebrow}>ORU LEADS THE SIGNAL</Text>
              <Text style={styles.companionIntroText}>Meet Oru, Nyxen, Solix and Aeris. They react to FateDrop’s evidence without changing what Whisper, Echo, Manifested or Vanished actually mean.</Text>
            </View>
          </View>

          <View style={styles.companionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Oru companion"
              onPress={() => router.push({ pathname: '/companion', params: { variant: 'oru' } })}
              style={({ pressed }) => [styles.companionCard, pressed && styles.pressed]}
            >
              <View style={styles.companionCardGlow} />
              <View style={styles.companionAvatar}>
                <Ionicons name="sparkles" size={28} color={FateDropColors.violetLight} />
              </View>
              <Text style={styles.companionCode}>MASCOT</Text>
              <Text style={styles.companionName}>ORU</Text>
              <Text style={styles.companionRole}>FateDrop guide</Text>
              <View style={styles.companionState}><View style={styles.companionStateDot} /><Text style={styles.companionStateText}>READY</Text></View>
              <View style={styles.companionOpenRow}><Text style={styles.companionOpenText}>MEET ORU</Text><Ionicons name="arrow-forward" size={13} color={FateDropColors.cyan} /></View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Nyxen companion"
              onPress={() => router.push({ pathname: '/companion', params: { variant: 'nyxen' } })}
              style={({ pressed }) => [styles.companionCard, pressed && styles.pressed]}
            >
              <View style={[styles.companionCardGlow, styles.companionCardGlowCyan]} />
              <View style={[styles.companionAvatar, styles.companionAvatarCyan]}><Ionicons name="eye-outline" size={28} color={FateDropColors.cyan} /></View>
              <Text style={styles.companionCode}>K-13</Text>
              <Text style={styles.companionName}>NYXEN</Text>
              <Text style={styles.companionRole}>Whisper watcher</Text>
              <View style={styles.companionState}><View style={styles.companionStateDot} /><Text style={styles.companionStateText}>READY</Text></View>
              <View style={styles.companionOpenRow}><Text style={styles.companionOpenText}>VIEW FRIEND</Text><Ionicons name="arrow-forward" size={13} color={FateDropColors.cyan} /></View>
            </Pressable>
          </View>

          <View style={[styles.companionRow, { marginTop: 10 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Solix companion"
              onPress={() => router.push({ pathname: '/companion', params: { variant: 'solix' } })}
              style={({ pressed }) => [styles.companionCard, pressed && styles.pressed]}
            >
              <View style={styles.companionCardGlow} />
              <View style={styles.companionAvatar}><Ionicons name="flash-outline" size={28} color={FateDropColors.violetLight} /></View>
              <Text style={styles.companionCode}>K-12</Text>
              <Text style={styles.companionName}>SOLIX</Text>
              <Text style={styles.companionRole}>Manifested spark</Text>
              <View style={styles.companionState}><View style={styles.companionStateDot} /><Text style={styles.companionStateText}>READY</Text></View>
              <View style={styles.companionOpenRow}><Text style={styles.companionOpenText}>VIEW FRIEND</Text><Ionicons name="arrow-forward" size={13} color={FateDropColors.cyan} /></View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Aeris companion"
              onPress={() => router.push({ pathname: '/companion', params: { variant: 'aeris' } })}
              style={({ pressed }) => [styles.companionCard, pressed && styles.pressed]}
            >
              <View style={[styles.companionCardGlow, styles.companionCardGlowCyan]} />
              <View style={[styles.companionAvatar, styles.companionAvatarCyan]}><Ionicons name="radio-outline" size={28} color={FateDropColors.cyan} /></View>
              <Text style={styles.companionCode}>K-14</Text>
              <Text style={styles.companionName}>AERIS</Text>
              <Text style={styles.companionRole}>Signal scout</Text>
              <View style={styles.companionState}><View style={styles.companionStateDot} /><Text style={styles.companionStateText}>READY</Text></View>
              <View style={styles.companionOpenRow}><Text style={styles.companionOpenText}>VIEW FRIEND</Text><Ionicons name="arrow-forward" size={13} color={FateDropColors.cyan} /></View>
            </Pressable>
          </View>
        </View>

`;

writeFileSync(path, source.slice(0, start) + replacement + source.slice(end));
console.log('Replaced legacy KAEL/NYRA Home cards with Oru & Friends.');
