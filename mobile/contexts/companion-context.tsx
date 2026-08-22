import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { normalizeCompanionId, type CompanionId } from '@/lib/companion-contract';

export type CompanionVariant = CompanionId;

const STORAGE_KEY = '@fatedrop/selected-companion';
const DEFAULT_COMPANION: CompanionVariant = 'oru';

type CompanionContextValue = {
  selectedCompanion: CompanionVariant;
  hydrated: boolean;
  selectCompanion: (variant: CompanionVariant) => void;
};

const CompanionContext = createContext<CompanionContextValue | null>(null);

export function CompanionProvider({ children }: { children: ReactNode }) {
  const [selectedCompanion, setSelectedCompanion] = useState<CompanionVariant>(DEFAULT_COMPANION);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        // Old beta values (`male` / `female`) migrate safely into the new
        // roster instead of leaving a stale KAEL/NYRA selection behind.
        const migrated = normalizeCompanionId(stored);
        setSelectedCompanion(migrated);
        if (stored !== migrated) void AsyncStorage.setItem(STORAGE_KEY, migrated).catch(() => undefined);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectCompanion = useCallback((variant: CompanionVariant) => {
    setSelectedCompanion(variant);
    void AsyncStorage.setItem(STORAGE_KEY, variant).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ selectedCompanion, hydrated, selectCompanion }),
    [hydrated, selectCompanion, selectedCompanion],
  );

  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>;
}

export function useCompanion() {
  const value = useContext(CompanionContext);
  if (!value) throw new Error('useCompanion must be used inside CompanionProvider.');
  return value;
}
