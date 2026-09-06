import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useFateDropId } from '@/contexts/fatedrop-id-context';

export function useCollectionsResource<T>(request: () => Promise<T>, resourceKey = '') {
  const { snapshot } = useFateDropId();
  const ownerId = snapshot?.user?.id || '';
  const key = `${ownerId}:${resourceKey}`;
  const generation = useRef(0);
  const activeKey = useRef<string | null>(null);
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: string }>({ key, data: null, loading: true, error: '' });
  const load = useCallback(async () => {
    if (activeKey.current !== key) return;
    const current = ++generation.current;
    if (!ownerId) return;
    setState((previous) => ({ key, data: previous.key === key ? previous.data : null, loading: true, error: '' }));
    try {
      const data = await request();
      if (current === generation.current) setState({ key, data, loading: false, error: '' });
    } catch (cause) {
      if (current !== generation.current) return;
      setState((previous) => ({ ...previous, loading: false, error: cause instanceof Error ? cause.message : 'Your collection could not be loaded. Please try again.' }));
    }
  }, [key, ownerId, request]);
  useFocusEffect(useCallback(() => {
    activeKey.current = key;
    void load();
    return () => { generation.current += 1; activeKey.current = null; };
  }, [key, load]));
  return {
    data: ownerId && state.key === key ? state.data : null,
    loading: Boolean(ownerId) && (state.key !== key || state.loading),
    error: state.key === key ? state.error : '',
    load,
  };
}
