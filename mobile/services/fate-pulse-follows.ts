import AsyncStorage from '@react-native-async-storage/async-storage';
import { savedAccount, loadAppSavedItems, changeAppSavedItem } from '@/services/app-saved-items';

export type FatePulseCardFollow = {
  cardIdentityId: string;
  printingId: string;
  setId?: string;
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

async function loadLocalFollows(identity?: string | null): Promise<FatePulseFollows> {
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


function records(follows: FatePulseFollows): Record<string,unknown>[] {
  return [...follows.cards.map(item=>({...item,kind:'card'})),...follows.sets.map(item=>({...item,kind:'set'}))];
}
function followsFromRecords(items: Record<string,unknown>[]): FatePulseFollows {
  return {
    cards: items.filter(item=>item.kind==='card').map(parseCard).filter((item):item is FatePulseCardFollow=>Boolean(item)),
    sets: items.filter(item=>item.kind==='set').map(parseSet).filter((item):item is FatePulseSetFollow=>Boolean(item)),
  };
}
export async function loadFatePulseFollows(identity?: string | null): Promise<FatePulseFollows> {
  const account = await savedAccount(identity);
  const legacy = await loadLocalFollows(account.identity);
  return followsFromRecords(await loadAppSavedItems('insights',account,records(legacy)));
}
async function changeFollow(identity: string | null | undefined, input: {operation:'save';item:Record<string,unknown>}|{operation:'remove';key:string}) {
  const account = await savedAccount(identity);
  if(account.token) return followsFromRecords(await changeAppSavedItem('insights',account,input));
  const current = records(await loadLocalFollows(account.identity));
  const itemKey=(item:Record<string,unknown>)=>item.kind==='card'?'card:'+item.cardIdentityId:'set:'+item.key;
  const key=input.operation==='save'?itemKey(input.item):input.key;
  const next=current.filter(item=>itemKey(item)!==key);
  if(input.operation==='save') next.push(input.item);
  const follows=followsFromRecords(next);
  await AsyncStorage.setItem(storageKey(account.identity),JSON.stringify(follows));
  return follows;
}
export async function addFatePulseCardFollow(identity: string | null | undefined, follow: FatePulseCardFollow) { return changeFollow(identity,{operation:'save',item:{...follow,kind:'card'}}); }
export async function removeFatePulseCardFollow(identity: string | null | undefined, cardIdentityId: string) { return changeFollow(identity,{operation:'remove',key:'card:'+cardIdentityId}); }
export async function addFatePulseSetFollow(identity: string | null | undefined, follow: FatePulseSetFollow) { return changeFollow(identity,{operation:'save',item:{...follow,kind:'set'}}); }
export async function removeFatePulseSetFollow(identity: string | null | undefined, key: string) { return changeFollow(identity,{operation:'remove',key:'set:'+key}); }
