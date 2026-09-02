'use strict';

function createAlertQueryCache({ freshnessMs = 20_000, now = () => Date.now() } = {}) {
  const entries = new Map();
  const listeners = new Set();

  function notify(key) {
    for (const listener of listeners) listener(key);
  }

  function getEntry(key) {
    let entry = entries.get(key);
    if (!entry) {
      entry = { data: undefined, updatedAt: 0, error: null, inFlight: null, generation: 0 };
      entries.set(key, entry);
    }
    return entry;
  }

  function peek(key) {
    const entry = entries.get(key);
    if (!entry) return { data: undefined, updatedAt: 0, error: null, fresh: false, refreshing: false };
    return {
      data: entry.data,
      updatedAt: entry.updatedAt,
      error: entry.error,
      fresh: entry.data !== undefined && now() - entry.updatedAt < freshnessMs,
      refreshing: Boolean(entry.inFlight),
    };
  }

  function request(key, fetcher, { force = false } = {}) {
    const entry = getEntry(key);
    if (entry.inFlight) return entry.inFlight;
    if (!force && entry.data !== undefined && now() - entry.updatedAt < freshnessMs) return Promise.resolve(entry.data);

    const generation = entry.generation;
    let promise;
    promise = Promise.resolve()
      .then(fetcher)
      .then((data) => {
        const current = entries.get(key);
        if (current && current === entry && current.generation === generation && current.inFlight === promise) {
          current.data = data;
          current.updatedAt = now();
          current.error = null;
          notify(key);
        }
        return data;
      })
      .catch((error) => {
        const current = entries.get(key);
        if (current && current === entry && current.generation === generation && current.inFlight === promise) {
          current.error = error;
          notify(key);
        }
        throw error;
      })
      .finally(() => {
        const current = entries.get(key);
        if (current && current === entry && current.generation === generation && current.inFlight === promise) {
          current.inFlight = null;
          notify(key);
        }
      });

    entry.inFlight = promise;
    entry.error = null;
    notify(key);
    return promise;
  }

  function invalidate(key) {
    const entry = entries.get(key);
    if (!entry) return;
    entry.generation += 1;
    entry.updatedAt = 0;
    entry.inFlight = null;
    notify(key);
  }

  function invalidateMatching(predicate) {
    for (const key of entries.keys()) {
      if (predicate(key)) invalidate(key);
    }
  }

  function clearMatching(predicate) {
    const removed = [];
    for (const key of entries.keys()) {
      if (!predicate(key)) continue;
      entries.delete(key);
      removed.push(key);
    }
    for (const key of removed) notify(key);
  }

  function clear() {
    const keys = [...entries.keys()];
    entries.clear();
    for (const key of keys) notify(key);
  }

  function keys() {
    return [...entries.keys()];
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { clear, clearMatching, invalidate, invalidateMatching, keys, peek, request, subscribe };
}

module.exports = { createAlertQueryCache };