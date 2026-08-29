import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { LocalRadarOperatorNoticeData } from '@/components/local-radar-operator-notice';

type LocalRadarNoticeContextValue = {
  notice: LocalRadarOperatorNoticeData | null;
  collapsed: boolean;
  showNotice: (notice: LocalRadarOperatorNoticeData) => void;
  collapseNotice: () => void;
  expandNotice: () => void;
  dismissNotice: () => void;
};

const LocalRadarNoticeContext = createContext<LocalRadarNoticeContextValue | null>(null);

export function LocalRadarNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<LocalRadarOperatorNoticeData | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const showNotice = useCallback((nextNotice: LocalRadarOperatorNoticeData) => {
    setNotice(nextNotice);
    setCollapsed(false);
  }, []);
  const collapseNotice = useCallback(() => setCollapsed(true), []);
  const expandNotice = useCallback(() => setCollapsed(false), []);
  const dismissNotice = useCallback(() => {
    setNotice(null);
    setCollapsed(false);
  }, []);

  const value = useMemo<LocalRadarNoticeContextValue>(() => ({
    notice,
    collapsed,
    showNotice,
    collapseNotice,
    expandNotice,
    dismissNotice,
  }), [notice, collapsed, showNotice, collapseNotice, expandNotice, dismissNotice]);

  return <LocalRadarNoticeContext.Provider value={value}>{children}</LocalRadarNoticeContext.Provider>;
}

export function useLocalRadarNotice() {
  const context = useContext(LocalRadarNoticeContext);
  if (!context) throw new Error('useLocalRadarNotice must be used inside LocalRadarNoticeProvider');
  return context;
}
