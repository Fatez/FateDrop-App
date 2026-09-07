export const CANONICAL_THUMBNAIL_POLICY_VERSION = 'canonical-thumbnails:pilot-1' as const;

export type CanonicalThumbnailKind = 'set' | 'card';

type PilotSet = Readonly<{
  canonicalSetId: string;
  name: string;
  tcgdexSeriesCode: string;
  tcgdexSetId: string;
  languageCode: 'en';
  numericLocalIdWidth: 3;
  verifiedIdentityCount: number;
  verifiedPrintingCount: number;
}>;

/**
 * Bounded pilot allowlist. Every entry is anchored to an exact verified FateDrop
 * canonical set identity and reviewed TCGdex set mapping. Do not add name-based
 * aliases or fuzzy fallbacks here.
 *
 * The numeric local-id rule was checked against all 1,024 live TCGdex card-source
 * mappings in these four sets on 2026-09-07: 1,024/1,024 matched, 0 mismatches.
 */
export const CANONICAL_THUMBNAIL_PILOT_SETS: Readonly<Record<string, PilotSet>> = Object.freeze({
  fdset_20b6a6dcfa52bbe0cc54b919: Object.freeze({
    canonicalSetId: 'fdset_20b6a6dcfa52bbe0cc54b919',
    name: 'Prismatic Evolutions',
    tcgdexSeriesCode: 'sv',
    tcgdexSetId: 'sv08.5',
    languageCode: 'en',
    numericLocalIdWidth: 3,
    verifiedIdentityCount: 281,
    verifiedPrintingCount: 180,
  }),
  fdset_15b58d7fe24f94690c51184b: Object.freeze({
    canonicalSetId: 'fdset_15b58d7fe24f94690c51184b',
    name: 'Temporal Forces',
    tcgdexSeriesCode: 'sv',
    tcgdexSetId: 'sv05',
    languageCode: 'en',
    numericLocalIdWidth: 3,
    verifiedIdentityCount: 379,
    verifiedPrintingCount: 218,
  }),
  fdset_067d68020460e775d43ff0cb: Object.freeze({
    canonicalSetId: 'fdset_067d68020460e775d43ff0cb',
    name: '151',
    tcgdexSeriesCode: 'sv',
    tcgdexSetId: 'sv03.5',
    languageCode: 'en',
    numericLocalIdWidth: 3,
    verifiedIdentityCount: 362,
    verifiedPrintingCount: 207,
  }),
  fdset_373e293fbb2882e43122afde: Object.freeze({
    canonicalSetId: 'fdset_373e293fbb2882e43122afde',
    name: 'Darkness Ablaze',
    tcgdexSeriesCode: 'swsh',
    tcgdexSetId: 'swsh3',
    languageCode: 'en',
    numericLocalIdWidth: 3,
    verifiedIdentityCount: 2,
    verifiedPrintingCount: 1,
  }),
});

function text(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function assetRoot(setId: string | null | undefined) {
  const canonicalSetId = text(setId);
  const set = CANONICAL_THUMBNAIL_PILOT_SETS[canonicalSetId];
  if (!set) return null;
  return { set, root: `https://assets.tcgdex.net/${set.languageCode}/${encodeURIComponent(set.tcgdexSeriesCode)}/${encodeURIComponent(set.tcgdexSetId)}` };
}

export function resolveCanonicalSetThumbnailUrl(setId: string | null | undefined) {
  const resolved = assetRoot(setId);
  return resolved ? `${resolved.root}/logo.webp` : null;
}

export function resolveCanonicalCardThumbnailUrl({ setId, collectorNumber }: {
  setId: string | null | undefined;
  collectorNumber: string | null | undefined;
}) {
  const resolved = assetRoot(setId);
  const rawCollector = text(collectorNumber);
  if (!resolved || !rawCollector) return null;

  // This is not a guessed formatting convention: the rule is allowlisted only
  // for the four sets where every persisted exact TCGdex source mapping matched.
  const sourceLocalId = /^\d+$/.test(rawCollector)
    ? rawCollector.padStart(resolved.set.numericLocalIdWidth, '0')
    : rawCollector;
  return `${resolved.root}/${encodeURIComponent(sourceLocalId)}/low.webp`;
}

export function resolveCanonicalCardImageUrl({ setId, collectorNumber }: {
  setId: string | null | undefined;
  collectorNumber: string | null | undefined;
}) {
  const thumbnail = resolveCanonicalCardThumbnailUrl({ setId, collectorNumber });
  return thumbnail ? thumbnail.replace('/low.webp', '/high.webp') : null;
}

export function isCanonicalThumbnailPilotSet(setId: string | null | undefined) {
  return Boolean(CANONICAL_THUMBNAIL_PILOT_SETS[text(setId)]);
}
