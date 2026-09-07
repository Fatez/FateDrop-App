const DAY = 86400000;
// Require the actual baseline day; two observations are not a 90-day return.
function storedPeriodMovement(points, days) {
  if (!Array.isArray(points) || !Number.isInteger(days) || days <= 0) return null;
  const dated = points.map(point => ({ ...point, day: /^\d{4}-\d{2}-\d{2}$/.test(point.marketDay || '') ? Date.parse(point.marketDay + 'T00:00:00Z') : NaN }))
    .filter(point => Number.isFinite(point.day)).sort((a, b) => a.day - b.day);
  const latest = dated.at(-1);
  if (!latest) return null;
  const baseline = dated.find(point => point.day === latest.day - days * DAY);
  if (!baseline || !Number.isFinite(baseline.amount) || baseline.amount <= 0 ||
      !Number.isFinite(latest.amount) || latest.amount < 0 ||
      !baseline.currencyCode || baseline.currencyCode !== latest.currencyCode) return null;
  return ((latest.amount - baseline.amount) / baseline.amount) * 100;
}
module.exports = { storedPeriodMovement };
