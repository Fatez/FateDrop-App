export function itemRrpPercent(itemPrice: number | null | undefined, reference: number | null | undefined): number | null;
export function selectWishlistPrice<T extends { deliveryKnown?: boolean; totalDeliveredGbp?: number; priceGbp?: number }>(offers: readonly T[]): { offer: T | undefined; delivered: boolean };
