function rrpBasisLabel(group) {
  if (group?.rrpKind === 'component_reference') return 'Component RRP reference';
  if (group?.rrpKind === 'pack_reference') return 'Pack RRP reference';
  if (group?.rrpKind === 'source_market_msrp') return 'Official source-market MSRP reference';
  if (group?.rrpKind === 'source_market_component_reference') return 'Source-market component reference';
  if (Number.isFinite(group?.rrpGbp)) return 'Verified official RRP';
  return 'Verified RRP unavailable';
}

module.exports = { rrpBasisLabel };
