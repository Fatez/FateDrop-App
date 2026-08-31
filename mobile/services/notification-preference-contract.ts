export const LIFECYCLE_MARKET_STAGES = ['whisper', 'echo', 'manifested', 'vanished'] as const;
export type LifecycleMarketStage = typeof LIFECYCLE_MARKET_STAGES[number];

export const LIFECYCLE_MARKET_GROUPS = [
  'english',
  'japanese',
  'korean',
  'simplified_chinese',
  'traditional_chinese',
] as const;
export type LifecycleMarketGroup = typeof LIFECYCLE_MARKET_GROUPS[number];
export type LifecycleMarketSelection = 'all' | LifecycleMarketGroup[];
export type LifecycleMarketPreferences = Record<LifecycleMarketStage, LifecycleMarketSelection>;

export const DEFAULT_LIFECYCLE_MARKETS: LifecycleMarketPreferences = {
  whisper: 'all',
  echo: 'all',
  manifested: 'all',
  vanished: 'all',
};

const marketGroups = new Set<string>(LIFECYCLE_MARKET_GROUPS);

export function normalizeLifecycleMarkets(
  value: unknown,
  fallback: LifecycleMarketPreferences = DEFAULT_LIFECYCLE_MARKETS,
): LifecycleMarketPreferences {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { parsed = null; }
  }
  const input = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
  const normalized = { ...fallback };

  for (const stage of LIFECYCLE_MARKET_STAGES) {
    const selection = input[stage];
    if (selection === 'all') {
      normalized[stage] = 'all';
      continue;
    }
    if (!Array.isArray(selection)) continue;
    const groups = [...new Set(selection.filter((item): item is LifecycleMarketGroup => (
      typeof item === 'string' && marketGroups.has(item)
    )))];
    if (groups.length) normalized[stage] = groups;
  }

  return normalized;
}

export function nextLifecycleMarketSelection(
  current: LifecycleMarketSelection,
  option: 'all' | LifecycleMarketGroup,
): LifecycleMarketSelection {
  if (option === 'all') return 'all';
  const selected = current === 'all' ? [] : current;
  const next = selected.includes(option)
    ? selected.filter((group) => group !== option)
    : [...selected, option];
  return next.length ? next : 'all';
}
