import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

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
    void Promise.all([loadCachedIdentitySnapshot(), getStoredSessionToken()]).then(([cached, token]) => {
      if (!mounted) return;
      setSnapshot(cached);
      setLoading(false);
      if (token) void refresh();
    }).catch(() => {
      if (mounted) setLoading(false);
    });
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
  }, []);

  const forgetLocalSession = useCallback(async () => {
    await clearStoredSession();
    setSnapshot(null);
    setError(null);
  }, []);

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
    can: (capability) => hasCapability(snapshot, capability),
  }), [error, forgetLocalSession, loading, refresh, signIn, signOut, snapshot, syncing]);

  return <FateDropIdContext.Provider value={value}>{children}</FateDropIdContext.Provider>;
}

export function useFateDropId() {
  const value = useContext(FateDropIdContext);
  if (!value) throw new Error('useFateDropId must be used inside FateDropIdProvider');
  return value;
}
