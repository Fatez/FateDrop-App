import { useEffect, useSyncExternalStore } from 'react';

import { useFateDropId } from '@/contexts/fatedrop-id-context';

type Preferences = { query: string; sort: 'number' | 'name'; view: 'needed' | 'owned' | 'all' };
type Binder = { setId: string; setName: string };
const defaults: Preferences = { query: '', sort: 'number', view: 'needed' };
const preferences = new Map<string, Preferences>();
const recent = new Map<string, Binder>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const emit = () => listeners.forEach(listener => listener());
const keyFor = (owner: string, setId: string) => JSON.stringify([owner, setId]);

export function useBinderSession(setId = '', setName = '') {
  const { snapshot, signedIn } = useFateDropId();
  const owner = signedIn ? snapshot?.user.id || '' : '';
  const key = keyFor(owner, setId);
  const value = useSyncExternalStore(subscribe, () => owner ? preferences.get(key) || defaults : defaults, () => defaults);
  const lastBinder = useSyncExternalStore(subscribe, () => owner ? recent.get(owner) || null : null, () => null);
  useEffect(() => {
    if (!owner || !setId) return;
    const previous = recent.get(owner);
    if (previous?.setId === setId && previous.setName === setName) return;
    recent.set(owner, { setId, setName });
    emit();
  }, [owner, setId, setName]);
  const update = (patch: Partial<Preferences>) => {
    if (!owner || !setId) return;
    preferences.set(key, { ...preferences.get(key) || defaults, ...patch });
    emit();
  };
  const prepareNeeded = (target: Binder) => {
    if (!owner) return;
    const targetKey = keyFor(owner, target.setId);
    preferences.set(targetKey, { ...preferences.get(targetKey) || defaults, view: 'needed', query: '' });
    recent.set(owner, target);
    emit();
  };
  return { ...value, lastBinder, prepareNeeded, setQuery: (query: string) => update({ query }), setSort: (sort: Preferences['sort']) => update({ sort }), setView: (view: Preferences['view']) => update({ view }) };
}
