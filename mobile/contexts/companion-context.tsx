import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type CompanionVariant = 'male' | 'female';

const STORAGE_KEY = '@fatedrop/selected-companion';
const DEFAULT_COMPANION: CompanionVariant = 'male';

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
        if (!active) return;
        if (stored === 'male' || stored === 'female') setSelectedCompanion(stored);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectCompanion = useCallback((variant: CompanionVariant) => {
    setSelectedCompanion(variant);
    void AsyncStorage.setItem(STORAGE_KEY, variant);
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
