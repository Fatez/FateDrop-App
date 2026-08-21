import { useEffect, useMemo, useState } from 'react';

import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { retailers } from '@/constants/retailers';

export type NetworkRetailerOption = {
  id: string;
  name: string;
  healthy?: boolean;
  baselineCompleted?: boolean;
};

type NetworkStatusResponse = {
  state?: {
    retailers?: NetworkRetailerOption[];
  };
};

const fallbackRetailers = retailers
  .filter((retailer) => !retailer.isDemo)
  .map((retailer) => ({ id: retailer.id, name: retailer.name }));

export function useNetworkRetailers() {
  const [liveRetailers, setLiveRetailers] = useState<NetworkRetailerOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${SIGNAL_ENGINE_URL}/api/status`);
        if (!response.ok) return;
        const data = await response.json() as NetworkStatusResponse;
        const next = Array.isArray(data.state?.retailers)
          ? data.state.retailers.filter((retailer) => retailer?.id && retailer?.name)
          : [];
        if (!cancelled && next.length) setLiveRetailers(next);
      } catch {
        // Static metadata remains a safe display fallback when Cloud status is unavailable.
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  return useMemo(
    () => [...(liveRetailers.length ? liveRetailers : fallbackRetailers)].sort((a, b) => a.name.localeCompare(b.name)),
    [liveRetailers],
  );
}
