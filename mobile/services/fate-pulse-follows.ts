import AsyncStorage from '@react-native-async-storage/async-storage';

export type FatePulseCardFollow = {
  cardIdentityId: string;
  printingId: string;
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
const EMPTY_FOLLOWS: FatePulseFollows = { cards: [], sets: [] };

function storageKey(identity?: string | null) {
  return `${STORAGE_PREFIX}:${identity?.trim() || 'guest'}`;
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseCard(value: unknown): FatePulseCardFollow | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<FatePulseCardFollow>;
  const cardIdentityId = safeString(source.cardIdentityId);
  if (!cardIdentityId) return null;
  return {
    cardIdentityId,
    printingId: safeString(source.printingId),
    tcgCode: safeString(source.tcgCode) || null,
    name: safeString(source.name) || 'Exact card',
    setName: safeString(source.setName) || 'Verified set',
    collectorNumber: safeString(source.collectorNumber),
    addedAt: typeof source.addedAt === 'number' && Number.isFinite(source.addedAt) ? source.addedAt : Date.now(),
  };
}

function parseSet(value: unknown): FatePulseSetFollow | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<FatePulseSetFollow>;
  const key = safeString(source.key);
  if (!key) return null;
  return {
    key,
    tcgCode: safeString(source.tcgCode) || null,
    setCode: safeString(source.setCode) || null,
    setName: safeString(source.setName) || 'Verified set',
    addedAt: typeof source.addedAt === 'number' && Number.isFinite(source.addedAt) ? source.addedAt : Date.now(),
  };
}

export async function loadFatePulseFollows(identity?: string | null): Promise<FatePulseFollows> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(identity));
    if (!raw) return EMPTY_FOLLOWS;
    const parsed = JSON.parse(raw) as Partial<FatePulseFollows>;
    return {
      cards: Array.isArray(parsed.cards) ? parsed.cards.map(parseCard).filter((item): item is FatePulseCardFollow => Boolean(item)) : [],
      sets: Array.isArray(parsed.sets) ? parsed.sets.map(parseSet).filter((item): item is FatePulseSetFollow => Boolean(item)) : [],
    };
  } catch {
    return EMPTY_FOLLOWS;
  }
}

export async function saveFatePulseFollows(identity: string | null | undefined, follows: FatePulseFollows): Promise<void> {
  await AsyncStorage.setItem(storageKey(identity), JSON.stringify(follows));
}

export async function addFatePulseCardFollow(identity: string | null | undefined, follow: FatePulseCardFollow): Promise<FatePulseFollows> {
  const current = await loadFatePulseFollows(identity);
  const next = {
    ...current,
    cards: [...current.cards.filter((item) => item.cardIdentityId !== follow.cardIdentityId), follow],
  };
  await saveFatePulseFollows(identity, next);
  return next;
}

export async function removeFatePulseCardFollow(identity: string | null | undefined, cardIdentityId: string): Promise<FatePulseFollows> {
  const current = await loadFatePulseFollows(identity);
  const next = { ...current, cards: current.cards.filter((item) => item.cardIdentityId !== cardIdentityId) };
  await saveFatePulseFollows(identity, next);
  return next;
}

export async function addFatePulseSetFollow(identity: string | null | undefined, follow: FatePulseSetFollow): Promise<FatePulseFollows> {
  const current = await loadFatePulseFollows(identity);
  const next = {
    ...current,
    sets: [...current.sets.filter((item) => item.key !== follow.key), follow],
  };
  await saveFatePulseFollows(identity, next);
  return next;
}

export async function removeFatePulseSetFollow(identity: string | null | undefined, key: string): Promise<FatePulseFollows> {
  const current = await loadFatePulseFollows(identity);
  const next = { ...current, sets: current.sets.filter((item) => item.key !== key) };
  await saveFatePulseFollows(identity, next);
  return next;
}
