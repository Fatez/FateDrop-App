import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WishlistItem } from '@/types/domain';
import { changeAppSavedItem, loadAppSavedItems, savedAccount } from '@/services/app-saved-items';

const KEY = 'fatedrop:wishlist:v2';
async function localItems(): Promise<WishlistItem[]> {
  const value = JSON.parse(await AsyncStorage.getItem(KEY) || '[]');
  return Array.isArray(value) ? value : [];
}
export class LocalWishlistRepository {
  async list(): Promise<WishlistItem[]> {
    const account = await savedAccount();
    const legacy = account.token ? [] : await localItems();
    return await loadAppSavedItems('wishlist',account,legacy as unknown as Record<string,unknown>[]) as unknown as WishlistItem[];
  }
  async save(item: WishlistItem) {
    const account = await savedAccount();
    if (account.token) { await changeAppSavedItem('wishlist',account,{operation:'save',item:item as unknown as Record<string,unknown>}); return; }
    const current = await localItems();
    await AsyncStorage.setItem(KEY,JSON.stringify([item,...current.filter(value=>value.id!==item.id)]));
  }
  async remove(id: string) {
    const account = await savedAccount();
    if (account.token) { await changeAppSavedItem('wishlist',account,{operation:'remove',key:id}); return; }
    await AsyncStorage.setItem(KEY,JSON.stringify((await localItems()).filter(item=>item.id!==id)));
  }
}
export async function migrateLegacyWatchlist(keys: string[]): Promise<WishlistItem[]> {
  const repository = new LocalWishlistRepository();
  const current = await repository.list();
  const account = await savedAccount();
  // The old shared device store has no owner. Import only on an explicit action.
  if (account.token) return current;
  const known = new Set(current.map(item=>item.targetId));
  const additions: WishlistItem[] = keys.filter(key=>!known.has(key)).map(key=>({id:`offer:${key}`,targetType:'OFFER',targetId:key,alertsEnabled: false,createdAt:new Date().toISOString(),migratedFromLegacyKey:key}));
  if (additions.length) await AsyncStorage.setItem(KEY,JSON.stringify([...current,...additions]));
  return [...current,...additions];
}
export async function importDeviceWishlist() {
  const account = await savedAccount();
  if (!account.token) throw new Error('Sign in before importing device bookmarks.');
  const raw = JSON.parse(await AsyncStorage.getItem('fatedrop:watchlist:v1') || '[]');
  const items = await localItems();
  for (const id of Array.isArray(raw) ? raw.filter(value=>typeof value==='string') : []) {
    if (!items.some(item=>item.targetType==='OFFER'&&item.targetId===id)) items.push({id:`offer:${id}`,targetType:'OFFER',targetId:id,alertsEnabled: false,createdAt:new Date().toISOString(),migratedFromLegacyKey:id});
  }
  for (let i=0;i<items.length;i+=25) await changeAppSavedItem('wishlist',account,{operation:'import',items:items.slice(i,i+25) as unknown as Record<string,unknown>[]});
  return items.length;
}
