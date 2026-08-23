import type { TruePriceGroup, TruePriceOffer } from '../types/true-price';

export interface ValuePosition {
  group: TruePriceGroup;
  offer: TruePriceOffer;
  itemPrice: number | null;
  checkoutCost: number | null;
  rrpPercent: number | null;
  unitCost: number | null;
  provisional: boolean;
}

export interface ValueComparison {
  left: ValuePosition | null;
  right: ValuePosition | null;
  winnerId: string | null;
  basis: 'rrp' | 'unit' | null;
  gap: number | null;
  reason: string;
}

export function bestOffer(group: TruePriceGroup): TruePriceOffer | null;
export function valuePosition(group: TruePriceGroup): ValuePosition | null;
export function compareValueGroups(leftGroup: TruePriceGroup, rightGroup: TruePriceGroup): ValueComparison;
export function rrpBasisLabel(group: TruePriceGroup): string;
