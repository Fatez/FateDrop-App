import { SIGNAL_ENGINE_URL } from '@/constants/api';

export type AlertLanguageGroup =
  | 'english'
  | 'japanese'
  | 'korean'
  | 'simplified_chinese'
  | 'traditional_chinese'
  | 'other'
  | 'unknown';

export type AlertFacetOptions = {
  languages: { key: AlertLanguageGroup; label: string }[];
  sets: { key: string; name: string }[];
};

type AlertFacetOptionsResponse = AlertFacetOptions & {
  success?: boolean;
  available?: boolean;
  contractVersion?: number;
  source?: string;
};

export const FALLBACK_ALERT_LANGUAGES: AlertFacetOptions['languages'] = [
  { key: 'english', label: 'English' },
  { key: 'japanese', label: 'Japanese' },
  { key: 'korean', label: 'Korean' },
  { key: 'simplified_chinese', label: 'Simplified Chinese' },
  { key: 'traditional_chinese', label: 'Traditional Chinese' },
  { key: 'other', label: 'Other languages' },
  { key: 'unknown', label: 'Unknown language' },
];

const languageGroups = new Set<AlertLanguageGroup>(FALLBACK_ALERT_LANGUAGES.map(({ key }) => key));
const setKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function fetchAlertFacetOptions(): Promise<AlertFacetOptions> {
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/alert-facets`, {
    headers: { accept: 'application/json' },
  });
  const data = await response.json().catch(() => null) as AlertFacetOptionsResponse | null;
  if (
    !response.ok
    || data?.success !== true
    || data.available !== true
    || data.contractVersion !== 1
    || data.source !== 'FATEDROP_CLOUD'
    || !Array.isArray(data.languages)
    || !Array.isArray(data.sets)
  ) {
    throw new Error('The live FateDrop set registry is temporarily unavailable.');
  }

  const languages = data.languages.filter((item): item is { key: AlertLanguageGroup; label: string } => (
    Boolean(item)
    && languageGroups.has(item.key)
    && typeof item.label === 'string'
    && item.label.trim().length > 0
  ));
  const sets = data.sets.filter((item): item is { key: string; name: string } => (
    Boolean(item)
    && typeof item.key === 'string'
    && item.key.length <= 120
    && setKeyPattern.test(item.key)
    && typeof item.name === 'string'
    && item.name.trim().length > 0
  ));

  return {
    languages: languages.length ? languages : FALLBACK_ALERT_LANGUAGES,
    sets,
  };
}
