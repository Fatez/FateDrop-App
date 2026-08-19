import AsyncStorage from '@react-native-async-storage/async-storage';

import { fateFindSummary, matchesFateFind } from '@/lib/fatefind';
import { LocalWishlistRepository } from '@/services/wishlist';
import type { AlertMatch, ProductOffer, SavedSearch } from '@/types/domain';

const KEY = 'fatedrop:fatefind:v1';
const MATCH_KEY = 'fatedrop:fatefind-matches:v1';

export interface FateFindRepository {
  list(): Promise<SavedSearch[]>;
  save(search: SavedSearch): Promise<void>;
  remove(id: string): Promise<void>;
}

export class LocalFateFindRepository implements FateFindRepository {
  async list() {
    try {
      const value = JSON.parse(await AsyncStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value as SavedSearch[] : [];
    } catch {
      return [];
    }
  }

  async save(search: SavedSearch) {
    const current = await this.list();
    const next = [search, ...current.filter((item) => item.id !== search.id)];
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }

  async remove(id: string) {
    await AsyncStorage.setItem(KEY, JSON.stringify((await this.list()).filter((item) => item.id !== id)));
    // Remove any legacy FateFind row that older builds mirrored into Wishlist.
    await new LocalWishlistRepository().remove(`fatefind:${id}`);
  }
}

export async function listLocalFateMatches(): Promise<AlertMatch[]> {
  try {
    const value = JSON.parse(await AsyncStorage.getItem(MATCH_KEY) || '[]');
    return Array.isArray(value) ? value as AlertMatch[] : [];
  } catch {
    return [];
  }
}

export async function recordLocalMatches(search: SavedSearch, offers: ProductOffer[]) {
  const existing = await listLocalFateMatches();
  const fingerprints = new Set(existing.map((item) => item.fingerprint));
  const created = offers
    .filter((offer) => matchesFateFind(search, offer))
    .map((offer) => ({
      id: `${search.id}:${offer.id}`,
      savedSearchId: search.id,
      offerId: offer.id,
      source: 'LOCAL' as const,
      matchedAt: new Date().toISOString(),
      fingerprint: `${search.id}:${offer.id}`,
    }))
    .filter((item) => !fingerprints.has(item.fingerprint));

  await AsyncStorage.setItem(MATCH_KEY, JSON.stringify([...created, ...existing].slice(0, 1000)));
  return created;
}

export { fateFindSummary, matchesFateFind };
