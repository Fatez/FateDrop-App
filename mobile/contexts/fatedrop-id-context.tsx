import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import {
  clearStoredSession,
  hasCapability,
  loadCachedIdentitySnapshot,
  signInFateDropId,
  signOutFateDropId,
  syncFateDropId,
  type FateCapability,
  type FateDropSyncSnapshot,
} from '@/services/fatedrop-id';

type FateDropIdContextValue = {
  snapshot: FateDropSyncSnapshot | null;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  signedIn: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  can(capability: FateCapability): boolean;
};

const FateDropIdContext = createContext<FateDropIdContextValue | null>(null);

export function FateDropIdProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<FateDropSyncSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const next = await syncFateDropId();
      setSnapshot(next);
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'FateDrop ID could not sync.';
      if (/sign in|expired/i.test(message)) setSnapshot(null);
      setError(message);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadCachedIdentitySnapshot().then((cached) => {
      if (!mounted) return;
      setSnapshot(cached);
      setLoading(false);
      if (cached) void refresh();
    }).catch(() => setLoading(false));
    return () => { mounted = false; };
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
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
  }, [refresh]);

  const signOut = useCallback(async () => {
    setSyncing(true);
    try { await signOutFateDropId(); }
    finally {
      await clearStoredSession();
      setSnapshot(null);
      setError(null);
      setSyncing(false);
    }
  }, []);

  const value = useMemo<FateDropIdContextValue>(() => ({
    snapshot,
    loading,
    syncing,
    error,
    signedIn: Boolean(snapshot?.user),
    signIn,
    signOut,
    refresh,
    can: (capability) => hasCapability(snapshot, capability),
  }), [error, loading, refresh, signIn, signOut, snapshot, syncing]);

  return <FateDropIdContext.Provider value={value}>{children}</FateDropIdContext.Provider>;
}

export function useFateDropId() {
  const value = useContext(FateDropIdContext);
  if (!value) throw new Error('useFateDropId must be used inside FateDropIdProvider');
  return value;
}
