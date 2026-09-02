import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import {
  clearStoredSession,
  getStoredSessionToken,
  hasCapability,
  loadCachedIdentitySnapshot,
  signInFateDropId,
  signOutFateDropId,
  syncFateDropId,
  type FateCapability,
  type FateDropSyncSnapshot,
} from '@/services/fatedrop-id';
import { clearCanonicalAlertQueryCache } from '@/services/canonical-alert-query';

type FateDropIdContextValue = {
  snapshot: FateDropSyncSnapshot | null;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  signedIn: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  forgetLocalSession(): Promise<void>;
  refresh(): Promise<void>;
  refreshIfStale(): Promise<void>;
  can(capability: FateCapability): boolean;
};

const FateDropIdContext = createContext<FateDropIdContextValue | null>(null);
const IDENTITY_REFRESH_FRESHNESS_MS = 30_000;

export function FateDropIdProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<FateDropSyncSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshFlight = useRef<Promise<void> | null>(null);
  const refreshGeneration = useRef(0);
  const lastRefreshAt = useRef(0);

  const runRefresh = useCallback((force: boolean) => {
    if (refreshFlight.current) return refreshFlight.current;
    if (!force && lastRefreshAt.current > 0 && Date.now() - lastRefreshAt.current < IDENTITY_REFRESH_FRESHNESS_MS) {
      return Promise.resolve();
    }

    const generation = refreshGeneration.current;
    setSyncing(true);
    const flight = (async () => {
      try {
        const next = await syncFateDropId();
        if (generation !== refreshGeneration.current) return;
        lastRefreshAt.current = Date.now();
        setSnapshot(next);
        setError(null);
      } catch (cause) {
        if (generation !== refreshGeneration.current) return;
        const message = cause instanceof Error ? cause.message : 'FateDrop ID could not sync.';
        if (/sign in|expired/i.test(message)) {
          clearCanonicalAlertQueryCache();
          setSnapshot(null);
        }
        setError(message);
      } finally {
        if (generation === refreshGeneration.current) {
          refreshFlight.current = null;
          setSyncing(false);
        }
      }
    })();
    refreshFlight.current = flight;
    return flight;
  }, []);

  const refresh = useCallback(() => runRefresh(true), [runRefresh]);
  const refreshIfStale = useCallback(() => runRefresh(false), [runRefresh]);

  const invalidateRefresh = useCallback(() => {
    refreshGeneration.current += 1;
    refreshFlight.current = null;
    lastRefreshAt.current = 0;
  }, []);

  useEffect(() => {
    let mounted = true;
    void Promise.all([loadCachedIdentitySnapshot(), getStoredSessionToken()]).then(([cached, token]) => {
      if (!mounted) return;
      setSnapshot(cached);
      setLoading(false);
      if (token) void refresh();
    }).catch(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
      refreshGeneration.current += 1;
      refreshFlight.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (!snapshot?.user) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshIfStale();
    });
    return () => subscription.remove();
  }, [refreshIfStale, snapshot?.user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    invalidateRefresh();
    clearCanonicalAlertQueryCache();
    setSyncing(true);
    try {
      const next = await signInFateDropId(email, password);
      setSnapshot(next);
      setError(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'FateDrop ID sign-in failed.');
      throw cause;
    } finally {
      setSyncing(false);
    }
  }, [invalidateRefresh, refresh]);

  const forgetLocalSession = useCallback(async () => {
    invalidateRefresh();
    clearCanonicalAlertQueryCache();
    await clearStoredSession();
    setSnapshot(null);
    setError(null);
    setSyncing(false);
  }, [invalidateRefresh]);

  const signOut = useCallback(async () => {
    invalidateRefresh();
    clearCanonicalAlertQueryCache();
    setSyncing(true);
    try {
      await signOutFateDropId();
      setSnapshot(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'FateDrop could not securely sign you out. Please try again.');
      throw cause;
    } finally {
      setSyncing(false);
    }
  }, [invalidateRefresh]);

  const value = useMemo<FateDropIdContextValue>(() => ({
    snapshot,
    loading,
    syncing,
    error,
    signedIn: Boolean(snapshot?.user),
    signIn,
    signOut,
    forgetLocalSession,
    refresh,
    refreshIfStale,
    can: (capability) => hasCapability(snapshot, capability),
  }), [error, forgetLocalSession, loading, refresh, refreshIfStale, signIn, signOut, snapshot, syncing]);

  return <FateDropIdContext.Provider value={value}>{children}</FateDropIdContext.Provider>;
}

export function useFateDropId() {
  const value = useContext(FateDropIdContext);
  if (!value) throw new Error('useFateDropId must be used inside FateDropIdProvider');
  return value;
}
