import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiCatalogueRepository, type CatalogueQuery } from '@/services/catalogue';
import type { ProductOffer } from '@/types/domain';

const repository = new ApiCatalogueRepository();

type CatalogueHookQuery = Omit<CatalogueQuery, 'cursor'> & { enabled?: boolean };

export function useCatalogue(query: CatalogueHookQuery) {
  const { enabled = true, ...requestQuery } = query;
  const [offers, setOffers] = useState<ProductOffer[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const key = JSON.stringify(requestQuery);
  const stableQuery = useMemo(() => requestQuery, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (reset = true) => {
    if (!enabled) {
      request.current += 1;
      setOffers([]);
      setTotal(0);
      setNextCursor(undefined);
      setLoading(false);
      setLoadingMore(false);
      setError('');
      return;
    }
    const current = ++request.current;
    reset ? setLoading(true) : setLoadingMore(true);
    setError('');
    try {
      const page = await repository.list({ ...stableQuery, cursor: reset ? undefined : nextCursor });
      if (current !== request.current) return;
      setOffers((existing) => reset ? page.offers : [...existing, ...page.offers.filter((item) => !existing.some((old) => old.id === item.id))]);
      setTotal(page.total);
      setNextCursor(page.nextCursor);
    } catch {
      if (current === request.current) setError('The catalogue could not be loaded.');
    } finally {
      if (current === request.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [enabled, key, nextCursor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) {
      void load(true);
      return;
    }
    const timer = setTimeout(() => void load(true), 300);
    return () => clearTimeout(timer);
  }, [enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    offers,
    total,
    loading,
    loadingMore,
    error,
    hasMore: Boolean(nextCursor),
    retry: () => load(true),
    loadMore: () => nextCursor && !loadingMore ? load(false) : Promise.resolve(),
  };
}
