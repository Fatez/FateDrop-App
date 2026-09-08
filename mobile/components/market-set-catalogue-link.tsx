import { router } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { fetchFatePriceSets } from '@/services/fate-market';
import { exactMarketCatalogueSet } from '@/lib/fate-price-discovery';

export function MarketSetCatalogueLink({ tcgCode, setCode, name, children, style }: {
  tcgCode: string | null; setCode: string | null; name: string | null; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const pending = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const open = async () => {
    if (pending.current) return;
    if (!tcgCode || !setCode) {
      Alert.alert('Set catalogue unavailable', 'This market entry does not yet identify a verified catalogue set.');
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const { sets } = await fetchFatePriceSets({ tcgCode, limit: 1000 });
      if (!active.current) return;
      const set = exactMarketCatalogueSet(sets, tcgCode, setCode);
      if (!set) {
        Alert.alert('Set catalogue unavailable', 'The exact catalogue link is not available yet. Your market selection has been kept.');
        return;
      }
      router.push({ pathname: '/fate-price-set', params: { setId: set.id, setName: set.name, tcg: tcgCode } });
    } catch {
      if (active.current) Alert.alert('Could not open this set', 'Please try again. Your market selection has been kept.');
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={busy ? 'Opening set catalogue' : `View cards in ${name || setCode || 'this set'}`} accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void open()} style={[style, busy && { opacity: .55 }]}>{children}</Pressable>;
}
