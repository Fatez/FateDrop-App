import { useEffect, useState } from 'react';
import { collectionCardQuote } from '@/lib/fate-collections-view';

import { fetchFatePrice, type FatePriceSnapshot } from '@/services/fate-market';

// Mounted card rows request an exact quote. FatePrice deduplicates and caches reads;
// virtualised lists avoid pricing thousands of off-screen cards at once.
export function useCollectionCardPrice(cardId: string, refreshKey: unknown) {
  const [quote, setQuote] = useState<{ cardId: string; refreshKey: unknown; price: FatePriceSnapshot['price'] } | null>(null);
  useEffect(() => {
    let current = true;
    if (!cardId) return;
    void fetchFatePrice(cardId).then((result) => {
      if (current) setQuote({ cardId, refreshKey, price: collectionCardQuote(result, cardId) });
    }).catch(() => {
      if (current) setQuote({ cardId, refreshKey, price: null });
    });
    return () => { current = false; };
  }, [cardId, refreshKey]);
  return quote?.cardId === cardId && quote.refreshKey === refreshKey ? quote.price : null;
}
