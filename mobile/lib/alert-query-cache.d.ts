export type AlertQueryCacheSnapshot<T> = {
  data: T | undefined;
  updatedAt: number;
  error: unknown;
  fresh: boolean;
  refreshing: boolean;
};

export type AlertQueryCache = {
  clear(): void;
  clearMatching(predicate: (key: string) => boolean): void;
  invalidate(key: string): void;
  invalidateMatching(predicate: (key: string) => boolean): void;
  keys(): string[];
  peek<T>(key: string): AlertQueryCacheSnapshot<T>;
  request<T>(key: string, fetcher: () => Promise<T>, options?: { force?: boolean }): Promise<T>;
  subscribe(listener: (key: string) => void): () => void;
};

export function createAlertQueryCache(options?: { freshnessMs?: number; now?: () => number }): AlertQueryCache;