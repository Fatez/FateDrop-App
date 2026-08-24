function rrpBasisLabel(group) {
  if (group?.rrpKind === 'component_reference') return 'Component RRP reference';
  if (group?.rrpKind === 'pack_reference') return 'Pack RRP reference';
  if (Number.isFinite(group?.rrpGbp)) return 'Verified official RRP';
  return 'Verified RRP unavailable';
}

module.exports = { rrpBasisLabel };
