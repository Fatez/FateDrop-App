import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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

  const value = useMemo<LocalRadarNoticeContextValue>(() => ({
    notice,
    collapsed,
    showNotice: (nextNotice) => {
      setNotice(nextNotice);
      setCollapsed(false);
    },
    collapseNotice: () => setCollapsed(true),
    expandNotice: () => setCollapsed(false),
    dismissNotice: () => {
      setNotice(null);
      setCollapsed(false);
    },
  }), [notice, collapsed]);

  return <LocalRadarNoticeContext.Provider value={value}>{children}</LocalRadarNoticeContext.Provider>;
}

export function useLocalRadarNotice() {
  const context = useContext(LocalRadarNoticeContext);
  if (!context) throw new Error('useLocalRadarNotice must be used inside LocalRadarNoticeProvider');
  return context;
}
