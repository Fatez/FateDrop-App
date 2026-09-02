import type { CanonicalAlertStage } from '@/services/canonical-alerts';

export type CanonicalAlertCountBasisItem = {
  fateStage: CanonicalAlertStage;
  tcgCode: string;
};

export function emptyCanonicalAlertCounts(): Record<CanonicalAlertStage, number>;
export function countCanonicalAlertBasisByStage(
  alerts: readonly CanonicalAlertCountBasisItem[],
  tcgCode?: string,
): Record<CanonicalAlertStage, number>;
