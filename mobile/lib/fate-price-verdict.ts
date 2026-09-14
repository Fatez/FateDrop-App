import type { FatePriceSnapshot } from '../services/fate-market';

/** Describes observed prices only. Never scores investment returns or retailer offers. */
export function fatePriceVerdict(snapshot: FatePriceSnapshot | null, now = Date.now()) {
  const unavailable = { title: 'Not enough evidence yet', detail: 'A current price and comparable 30-day history are needed before describing this card’s buying context.' };
  if (!snapshot?.available || !snapshot.price || !snapshot.marketScope) return unavailable;
  const { price, confidence } = snapshot;
  const age = now - price.asOf;
  if (!Number.isFinite(price.amount) || price.amount <= 0 || !Number.isFinite(age) || age < 0 || age > 48 * 60 * 60 * 1000 || !confidence || confidence.level === 'low') {
    return { title: 'Wait for stronger price evidence', detail: 'The available price is old or has limited confidence. Check fresh exact-card offers before drawing a buying conclusion.' };
  }
  const movement = snapshot.movement.d30;
  if (!movement.available || !Number.isFinite(movement.percent) || !Number.isFinite(movement.fromAmount) || movement.fromAmount! <= 0 || movement.toAmount !== price.amount) return unavailable;
  const percent = movement.percent!;
  if (percent < 0) return { title: 'Lower than 30 days ago', detail: `The verified market value is ${Math.abs(percent).toFixed(1)}% lower than its comparable 30-day reference. This may be worth comparing with live offers; it does not prove an offer is a bargain or that prices will recover.` };
  if (percent > 0) return { title: 'Higher than 30 days ago', detail: `The verified market value is ${percent.toFixed(1)}% higher than its comparable 30-day reference. Compare exact-condition offers before paying more; recent rises do not predict future gains.` };
  return { title: 'Unchanged against the 30-day reference', detail: 'The comparable market value is unchanged. Retailer price, condition and delivery costs can still make a difference.' };
}
