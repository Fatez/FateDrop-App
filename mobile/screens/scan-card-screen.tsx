import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CollectionsScreen } from '@/components/fate-collections-ui';
import { CanonicalThumbnail } from '@/components/canonical-thumbnail';
import { FateDropColors as C, Fonts } from '@/constants/theme';
import { cardScanHints, scanCandidateMatches } from '@/lib/card-scan';
import { searchFatePriceCards, type FatePriceCard } from '@/services/fate-market';
import { addExactCardToCollector } from '@/services/fate-collector';

export default function ScanCardScreen() {
  const [photo, setPhoto] = useState('');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [cards, setCards] = useState<FatePriceCard[]>([]);
  const [selected, setSelected] = useState<FatePriceCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const operation = useRef(0);
  const lock = useRef(false);
  useEffect(() => () => { operation.current++; }, []);
  const clearMatch = () => { operation.current++; setCards([]); setSelected(null); setSaved(false); setSaveAttempted(false); };
  async function choosePhoto(camera: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); clearMatch(); setMessage(''); setPermissionBlocked(false);
    const token = operation.current;
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setPermissionBlocked(!permission.canAskAgain); setMessage('Camera access is off. Allow it in Settings or choose a photo instead.'); return; }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: true, exif: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || token !== operation.current) return;
      const uri = result.assets[0]?.uri;
      if (!uri) throw new Error('That photo could not be opened.');
      setPhoto(uri); setName(''); setNumber('');
      if (Platform.OS === 'web' || !NativeModules.TextRecognition) {
        setMessage('Photo reading is unavailable in this build. Enter the card name and number below to find it.'); return;
      }
      const recognition = (await import('@react-native-ml-kit/text-recognition')).default;
      const resultText = await recognition.recognize(uri);
      if (token !== operation.current) return;
      const hints = cardScanHints(resultText.text);
      setName(hints.name); setNumber(hints.number);
      setMessage(hints.name || hints.number ? 'Koru read these details. Check them, then find your card.' : 'Koru could not read this photo clearly. Try less glare, or enter the details below.');
    } catch {
      if (token === operation.current) setMessage('Koru could not read that photo. Try again, or enter the card details below.');
    } finally { lock.current = false; setBusy(false); }
  }
  async function findCard() {
    if (lock.current || !name.trim()) return;
    lock.current = true; setBusy(true); clearMatch(); setMessage('');
    const token = operation.current;
    try {
      const result = await searchFatePriceCards({ query: name.trim(), limit: 100 });
      if (token !== operation.current) return;
      const matches = result.cards.filter((card) => scanCandidateMatches(card, number));
      setCards(matches);
      setMessage(matches.length ? 'Choose the matching set and finish. Nothing is added automatically.' : 'No matching English card found. Check the details; some cards may still be missing from our catalogue.');
      if (result.cards.length >= 100 || result.count > result.cards.length) setMessage('Search results are limited. Use the full card name to narrow the matches, then check the set and finish.');
    } catch { if (token === operation.current) setMessage('The catalogue is temporarily unavailable. Your collection has not changed.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function addCard() {
    if (!selected || lock.current || saveAttempted) return;
    lock.current = true; setBusy(true); setSaveAttempted(true);
    try { await addExactCardToCollector(selected.id, { quantity: 1, conditionCode: 'unknown' }); setSaved(true); setMessage('Added one copy to your collection.'); }
    catch { setMessage('We could not confirm the save. Check My Collection before trying again, to avoid adding a duplicate.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const openPrice = () => selected && router.push({ pathname: '/fate-price', params: { cardId: selected.id, setId: selected.setId, name: selected.name || undefined, collectorNumber: selected.collectorNumber, tcg: 'pokemon' } });
  return <CollectionsScreen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Collections" style={styles.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/collections')}><Ionicons name="chevron-back" size={22} color={C.goldBright} /><Text style={styles.copy}>Collections</Text></Pressable>
    <Image source={require('../assets/images/profile-avatar-koru.png')} style={styles.koru} contentFit="contain" accessibilityLabel="Koru" />
    <Text style={styles.eyebrow}>KORU · ENGLISH POKÉMON</Text>
    <Text style={styles.title}>Scan a Card</Text>
    <Text style={styles.copy}>Let Koru help find your card. Keep the whole front in view, including the name and number, and avoid glare.</Text>
    {photo ? <Image source={{ uri: photo }} style={styles.photo} contentFit="contain" accessibilityLabel="Your selected card photo" /> : <View style={styles.frame}><Ionicons name="scan-outline" size={64} color={C.goldBright} /><Text style={styles.copy}>One card. A clearer picture.</Text></View>}
    <View style={styles.actions}><Action label="Take photo" icon="camera-outline" disabled={busy} onPress={() => void choosePhoto(true)} /><Action label="Choose photo" icon="images-outline" disabled={busy} onPress={() => void choosePhoto(false)} /></View>
    <Text style={styles.note}>Photo text is read on your device. Only your search details are sent to FateDrop.</Text>
    {permissionBlocked ? <Action label="Open Settings" icon="settings-outline" onPress={() => void Linking.openSettings()} /> : null}
    <Text style={styles.label}>Card name</Text><TextInput editable={!busy} value={name} onChangeText={(value) => { clearMatch(); setName(value); }} accessibilityLabel="Card name" placeholder="For example, Charizard ex" placeholderTextColor={C.secondary} style={styles.input} autoCorrect={false} maxLength={100} />
    <Text style={styles.label}>Collector number (optional)</Text><TextInput editable={!busy} value={number} onChangeText={(value) => { clearMatch(); setNumber(value); }} accessibilityLabel="Collector number" placeholder="For example, 199" placeholderTextColor={C.secondary} style={styles.input} autoCorrect={false} maxLength={12} />
    <Action label="Find my card" icon="search-outline" disabled={busy || !name.trim()} onPress={() => void findCard()} />
    {busy ? <ActivityIndicator style={styles.loading} color={C.goldBright} /> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
    {cards.map((card) => <Pressable key={card.id} disabled={busy || saveAttempted} accessibilityRole="button" accessibilityState={{ selected: selected?.id === card.id }} onPress={() => { setSelected(card); setSaved(false); }} style={[styles.result, selected?.id === card.id && styles.selected]}>
      <CanonicalThumbnail kind="card" setId={card.setId} collectorNumber={card.collectorNumber} width={60} height={84} />
      <View style={styles.flex}><Text style={styles.cardName}>{card.name}</Text><Text style={styles.copy}>{card.setName} · #{card.collectorNumber}</Text><Text style={styles.label}>{card.variantCode} · English</Text></View>
      <Ionicons name={selected?.id === card.id ? 'checkmark-circle' : 'chevron-forward'} size={20} color={C.goldBright} />
    </Pressable>)}
    {selected ? <View style={styles.confirm}>
      <Text style={styles.titleSmall}>Koru found this card</Text>
      <Text style={styles.copy}>{selected.name} · {selected.setName} · #{selected.collectorNumber} · {selected.variantCode}</Text>
      <Text style={styles.note}>Compare the artwork, set, number and finish with your card. A photo cannot reliably confirm foil or first edition. Add only if this exact version matches.</Text>
      <Action label={saved ? 'Added to collection' : 'Confirm match · add one copy'} icon="add-circle-outline" disabled={busy || saveAttempted} onPress={() => void addCard()} />
      <Action label="View price & history" icon="analytics-outline" disabled={busy} onPress={openPrice} />
    </View> : null}
    <Action label="My Collection" icon="albums-outline" disabled={busy} onPress={() => router.push('/collection')} />
  </ScrollView></CollectionsScreen>;
}
function Action({ label, icon, onPress, disabled = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && { opacity: .45 }]}><Ionicons name={icon} size={19} color={C.goldBright} /><Text style={styles.actionText}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20, paddingBottom: 140 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 5 },
  koru: { width: 78, height: 78, alignSelf: 'center', marginVertical: 12 },
  eyebrow: { color: C.goldBright, letterSpacing: 1.6, fontSize: 11, textAlign: 'center' },
  title: { color: C.ivory, fontFamily: Fonts.serif, fontSize: 34, textAlign: 'center', marginVertical: 10 },
  titleSmall: { color: C.goldBright, fontFamily: Fonts.serif, fontSize: 24, marginBottom: 10 },
  copy: { color: C.secondary, fontSize: 14, lineHeight: 21 },
  note: { color: C.secondary, fontSize: 12, lineHeight: 18, marginVertical: 12 },
  frame: { height: 210, borderWidth: 1, borderColor: C.goldBright, borderRadius: 24, marginVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 16 },
  photo: { width: '100%', height: 270, marginVertical: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  action: { minHeight: 48, flexDirection: 'row', gap: 9, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: C.borderSoft, marginVertical: 4 },
  actionText: { color: C.goldBright, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  label: { color: C.goldBright, fontSize: 12, marginTop: 12, marginBottom: 5 },
  input: { color: C.ivory, fontSize: 16, minHeight: 48, borderBottomWidth: 1, borderColor: C.borderSoft, padding: 8 },
  message: { color: C.ivory, fontSize: 14, lineHeight: 21, marginVertical: 16 },
  loading: { marginVertical: 12 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: C.borderSoft },
  selected: { backgroundColor: 'rgba(226,197,141,.08)' },
  flex: { flex: 1 }, cardName: { color: C.ivory, fontFamily: Fonts.serif, fontSize: 20 },
  confirm: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderColor: C.goldBright },
});
