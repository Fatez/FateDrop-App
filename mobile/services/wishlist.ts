import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WishlistItem } from '@/types/domain';

const KEY = 'fatedrop:wishlist:v2';

export class LocalWishlistRepository {
  async list(): Promise<WishlistItem[]> {
    try {
      const value = JSON.parse(await AsyncStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  async save(item: WishlistItem) {
    const current = await this.list();
    await AsyncStorage.setItem(KEY, JSON.stringify([item, ...current.filter((value) => value.id !== item.id)]));
  }

  async remove(id: string) {
    await AsyncStorage.setItem(KEY, JSON.stringify((await this.list()).filter((item) => item.id !== id)));
  }
}

export async function migrateLegacyWatchlist(keys: string[]): Promise<WishlistItem[]> {
  const repository = new LocalWishlistRepository();
  const current = await repository.list();
  const known = new Set(current.map((item) => item.migratedFromLegacyKey));
  const additions: WishlistItem[] = keys
    .filter((key) => !known.has(key))
    .map((key) => ({
      id: `offer:${key}`,
      targetType: 'OFFER',
      targetId: key,
      // Wishlist is passive memory. Legacy bookmarks must never become
      // monitoring rules simply because they were migrated to the new store.
      alertsEnabled: false,
      createdAt: new Date().toISOString(),
      migratedFromLegacyKey: key,
    }));
  if (additions.length) await AsyncStorage.setItem(KEY, JSON.stringify([...current, ...additions]));
  return [...current, ...additions];
}
