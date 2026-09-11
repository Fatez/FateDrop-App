import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FateDropColors } from '@/constants/theme';

/** Only enabled catalogue languages belong in the active selection. */
export function BinderLanguageSelector() {
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityLabel="Binder language: English" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.trigger}>
      <Ionicons name="language-outline" size={18} color={FateDropColors.goldBright} />
      <Text style={styles.label}>English</Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={FateDropColors.goldBright} />
    </Pressable>
    {expanded ? <View style={styles.options}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: true }} onPress={() => setExpanded(false)} style={styles.option}>
        <Text style={styles.label}>English</Text><Ionicons name="checkmark" size={18} color={FateDropColors.goldBright} />
      </Pressable>
      <View accessible accessibilityLabel="Japanese, coming later" style={styles.option}><Text style={styles.future}>Japanese</Text><Text style={styles.future}>Coming later</Text></View>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { marginVertical: 10, alignItems: 'flex-start' },
  trigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: FateDropColors.goldBright },
  label: { color: FateDropColors.goldBright, fontSize: 14, fontWeight: '600' },
  options: { width: '100%', maxWidth: 320, paddingHorizontal: 12, backgroundColor: FateDropColors.background, borderBottomWidth: 1, borderColor: FateDropColors.borderSoft },
  option: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  future: { color: FateDropColors.secondary, fontSize: 13 },
});
