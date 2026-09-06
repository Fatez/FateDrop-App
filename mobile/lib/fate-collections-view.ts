import type { FateCollectorItem, FateCollectorMissingCard, FateCollectorSetBinder } from '../services/fate-collector';
import type { FatePriceSnapshot } from '../services/fate-market';

export function collectionCardQuote(snapshot: FatePriceSnapshot, cardId: string) {
  return snapshot.available && snapshot.cardIdentityId === cardId && snapshot.price?.currencyCode === 'GBP'
    && Number.isFinite(snapshot.price.amount) && snapshot.price.amount >= 0 ? snapshot.price : null;
}

// Presentation only: completion and prices remain server-owned.
export function isBinderComplete(binder: FateCollectorSetBinder | null | undefined) {
  return Boolean(binder && binder.status === 'available' && Number.isInteger(binder.totalCount)
    && Number(binder.totalCount) > 0 && binder.missingCount === 0 && binder.ownedCount === binder.totalCount);
}

export function orderBinders(sets: FateCollectorSetBinder[], query = '', sort: 'progress' | 'name' = 'progress') {
  const search = query.trim().toLocaleLowerCase();
  return sets.filter((set) => !search || `${set.setName || ''} ${set.tcgCode || ''}`.toLocaleLowerCase().includes(search))
    .sort((a, b) => {
      const name = String(a.setName || a.setId).localeCompare(String(b.setName || b.setId));
      if (sort === 'name') return name;
      const progress = (set: FateCollectorSetBinder) => set.status === 'available' && Number.isFinite(set.completionPercent) ? set.completionPercent! : -1;
      return progress(b) - progress(a) || name;
    });
}

export type BinderEntry = { key: string; state: 'owned'; item: FateCollectorItem } | { key: string; state: 'needed'; card: FateCollectorMissingCard };

export function binderEntries(items: FateCollectorItem[], missing: FateCollectorMissingCard[], setId: string, view: 'all' | 'owned' | 'needed', query = '', sort: 'number' | 'name' = 'number') {
  // Several conditions can own the same exact card; show one card pocket and its copy count.
  // Do not infer printing equivalence from names/numbers or combine different variants.
  const owned = new Map<string, FateCollectorItem>();
  for (const item of items) {
    if (item.copyState !== 'raw' || item.card?.setId !== setId) continue;
    const previous = owned.get(item.fateCardId);
    owned.set(item.fateCardId, previous ? { ...previous, quantity: previous.quantity + item.quantity, conditionCode: previous.conditionCode === item.conditionCode ? previous.conditionCode : 'mixed' } : item);
  }
  const entries: BinderEntry[] = [];
  if (view !== 'needed') for (const item of owned.values()) entries.push({ key: `owned:${item.fateCardId}`, state: 'owned', item });
  if (view !== 'owned') for (const card of missing) {
    if (card.setId === setId && !owned.has(card.fateCardId)) entries.push({ key: `needed:${card.fateCardId}`, state: 'needed', card });
  }
  const search = query.trim().toLocaleLowerCase();
  const identity = (entry: BinderEntry) => entry.state === 'owned' ? entry.item.card : entry.card;
  return entries.filter((entry) => {
    const card = identity(entry);
    return !search || [card?.name, card?.collectorNumber, card?.variantCode, card?.rarity].join(' ').toLocaleLowerCase().includes(search);
  }).sort((a, b) => {
    const left = identity(a); const right = identity(b);
    const name = String(left?.name || '').localeCompare(String(right?.name || ''));
    const number = String(left?.collectorNumber || '').localeCompare(String(right?.collectorNumber || ''), undefined, { numeric: true });
    return (sort === 'name' ? name || number : number || name) || a.key.localeCompare(b.key);
  });
}

export function formatCollectionMoney(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null || !Number.isFinite(value) || !currency) return '—';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${value.toFixed(2)} ${currency}`; }
}

export function formatCollectionPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
}
