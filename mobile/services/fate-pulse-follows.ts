import AsyncStorage from '@react-native-async-storage/async-storage';

export type FatePulseCardFollow = {
  cardIdentityId: string;
  printingId: string;
  setId: string;
  tcgCode: string | null;
  name: string;
  setName: string;
  collectorNumber: string;
  addedAt: number;
};

export type FatePulseSetFollow = {
  key: string;
  tcgCode: string | null;
  setCode: string | null;
  setName: string;
  addedAt: number;
};

export type FatePulseFollows = {
  cards: FatePulseCardFollow[];
  sets: FatePulseSetFollow[];
};

const STORAGE_PREFIX = 'fatedrop:fate-pulse-follows:v1';

function storageKey(identity?: string | null) {
  return `${STORAGE_PREFIX}:${identity?.trim() || 'guest'}`;
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseCard(value: unknown): FatePulseCardFollow | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<FatePulseCardFollow>;
  const cardIdentityId = cleanString(source.cardIdentityId);
  if (!cardIdentityId) return null;
  return {
    cardIdentityId,
    printingId: cleanString(source.printingId),
    setId: cleanString(source.setId),
    tcgCode: cleanString(source.tcgCode) || null,
    name: cleanString(source.name) || 'Exact card',
    setName: cleanString(source.setName) || 'Verified set',
    collectorNumber: cleanString(source.collectorNumber),
    addedAt: typeof source.addedAt === 'number' && Number.isFinite(source.addedAt) ? source.addedAt : Date.now(),
  };
}

function parseSet(value: unknown): FatePulseSetFollow | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<FatePulseSetFollow>;
  const key = cleanString(source.key);
  if (!key) return null;
  return {
    key,
    tcgCode: cleanString(source.tcgCode) || null,
    setCode: cleanString(source.setCode) || null,
    setName: cleanString(source.setName) || 'Verified set',
    addedAt: typeof source.addedAt === 'number' && Number.isFinite(source.addedAt) ? source.addedAt : Date.now(),
  };
}

export async function loadFatePulseFollows(identity?: string | null): Promise<FatePulseFollows> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(identity));
    if (!raw) return { cards: [], sets: [] };
    const parsed = JSON.parse(raw) as Partial<FatePulseFollows>;
    return {
      cards: Array.isArray(parsed.cards) ? parsed.cards.map(parseCard).filter((item): item is FatePulseCardFollow => Boolean(item)) : [],
      sets: Array.isArray(parsed.sets) ? parsed.sets.map(parseSet).filter((item): item is FatePulseSetFollow => Boolean(item)) : [],
    };
  } catch {
    return { cards: [], sets: [] };
  }
}

export async function saveFatePulseFollows(identity: string | null | undefined, follows: FatePulseFollows) {
  await AsyncStorage.setItem(storageKey(identity), JSON.stringify(follows));
}

export async function addFatePulseCardFollow(identity: string | null | undefined, follow: FatePulseCardFollow) {
  const current = await loadFatePulseFollows(identity);
  const next: FatePulseFollows = {
    ...current,
    cards: [...current.cards.filter((item) => item.cardIdentityId !== follow.cardIdentityId), follow],
  };
  await saveFatePulseFollows(identity, next);
  return next;
}

export async function removeFatePulseCardFollow(identity: string | null | undefined, cardIdentityId: string) {
  const current = await loadFatePulseFollows(identity);
  const next: FatePulseFollows = { ...current, cards: current.cards.filter((item) => item.cardIdentityId !== cardIdentityId) };
  await saveFatePulseFollows(identity, next);
  return next;
}

export async function addFatePulseSetFollow(identity: string | null | undefined, follow: FatePulseSetFollow) {
  const current = await loadFatePulseFollows(identity);
  const next: FatePulseFollows = {
    ...current,
    sets: [...current.sets.filter((item) => item.key !== follow.key), follow],
  };
  await saveFatePulseFollows(identity, next);
  return next;
}

export async function removeFatePulseSetFollow(identity: string | null | undefined, key: string) {
  const current = await loadFatePulseFollows(identity);
  const next: FatePulseFollows = { ...current, sets: current.sets.filter((item) => item.key !== key) };
  await saveFatePulseFollows(identity, next);
  return next;
}
