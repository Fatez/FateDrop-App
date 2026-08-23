function bestOffer(group) {
  const rows = [...(group?.offers || [])].sort((a, b) => {
    if (Boolean(a.deliveryKnown) !== Boolean(b.deliveryKnown)) return a.deliveryKnown ? -1 : 1;
    return (a.totalDeliveredGbp ?? a.priceGbp ?? Infinity) - (b.totalDeliveredGbp ?? b.priceGbp ?? Infinity);
  });
  return rows[0] || null;
}

function valuePosition(group) {
  const offer = bestOffer(group);
  if (!offer) return null;
  const itemPrice = Number.isFinite(offer.priceGbp) ? offer.priceGbp : null;
  const checkoutCost = offer.deliveryKnown && Number.isFinite(offer.totalDeliveredGbp)
    ? offer.totalDeliveredGbp
    : itemPrice;
  const rrpPercent = itemPrice != null && Number.isFinite(group?.rrpGbp) && group.rrpGbp > 0
    ? ((itemPrice - group.rrpGbp) / group.rrpGbp) * 100
    : null;
  const unitCost = checkoutCost != null && Number.isFinite(group?.unitCount) && group.unitCount > 0
    ? checkoutCost / group.unitCount
    : null;
  return {
    group,
    offer,
    itemPrice,
    checkoutCost,
    rrpPercent,
    unitCost,
    provisional: !offer.deliveryKnown,
  };
}

function compareValueGroups(leftGroup, rightGroup) {
  const left = valuePosition(leftGroup);
  const right = valuePosition(rightGroup);
  if (!left || !right || left.group.id === right.group.id) {
    return { left, right, winnerId: null, basis: null, gap: null, reason: 'Choose two different items.' };
  }

  if (left.rrpPercent != null && right.rrpPercent != null) {
    const winner = left.rrpPercent <= right.rrpPercent ? left : right;
    const loser = winner === left ? right : left;
    return {
      left,
      right,
      winnerId: winner.group.id,
      basis: 'rrp',
      gap: Math.abs(winner.rrpPercent - loser.rrpPercent),
      reason: 'Better value position versus verified RRP/reference based on item price.',
    };
  }

  if (left.unitCost != null && right.unitCost != null && left.group.unitKind && left.group.unitKind === right.group.unitKind) {
    const winner = left.unitCost <= right.unitCost ? left : right;
    return {
      left,
      right,
      winnerId: winner.group.id,
      basis: 'unit',
      gap: Math.abs(left.unitCost - right.unitCost),
      reason: `Lower observed cost per ${winner.group.unitKind === 'booster_pack' ? 'pack' : 'unit'}.`,
    };
  }

  return {
    left,
    right,
    winnerId: null,
    basis: null,
    gap: null,
    reason: 'FateDrop needs comparable verified RRP/reference or unit evidence before declaring a winner.',
  };
}

function rrpBasisLabel(group) {
  if (group?.rrpKind === 'component_reference') return 'Component RRP reference';
  if (group?.rrpKind === 'pack_reference') return 'Pack RRP reference';
  if (Number.isFinite(group?.rrpGbp)) return 'Verified official RRP';
  return 'Verified RRP unavailable';
}

module.exports = { bestOffer, valuePosition, compareValueGroups, rrpBasisLabel };
