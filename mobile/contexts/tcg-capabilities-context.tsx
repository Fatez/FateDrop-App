import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import type { TcgCode } from '@/constants/tcg-registry';
import type { TcgCapability } from '@/lib/tcg-capabilities';
import { FALLBACK_TCG_CAPABILITY_SNAPSHOT, fetchTcgCapabilitySnapshot } from '@/services/tcg-capabilities';

type TcgCapabilitiesContextValue = {
  capabilities: Record<TcgCode, TcgCapability>;
  source: 'cloud' | 'fallback';
  refreshing: boolean;
  refresh: () => Promise<void>;
  capabilityFor: (code: TcgCode) => TcgCapability;
};

const TcgCapabilitiesContext = createContext<TcgCapabilitiesContextValue | null>(null);

export function TcgCapabilitiesProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState(FALLBACK_TCG_CAPABILITY_SNAPSHOT);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setSnapshot(await fetchTcgCapabilitySnapshot());
    } catch {
      // The checked-in fallback preserves Pokémon and keeps every future TCG off.
      // A network failure must never promote an inactive game.
      setSnapshot(FALLBACK_TCG_CAPABILITY_SNAPSHOT);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const value = useMemo<TcgCapabilitiesContextValue>(() => ({
    capabilities: snapshot.capabilities,
    source: snapshot.source,
    refreshing,
    refresh,
    capabilityFor: (code) => snapshot.capabilities[code] ?? FALLBACK_TCG_CAPABILITY_SNAPSHOT.capabilities[code],
  }), [refresh, refreshing, snapshot]);

  return <TcgCapabilitiesContext.Provider value={value}>{children}</TcgCapabilitiesContext.Provider>;
}

export function useTcgCapabilities() {
  const context = useContext(TcgCapabilitiesContext);
  if (!context) throw new Error('useTcgCapabilities must be used inside TcgCapabilitiesProvider.');
  return context;
}
