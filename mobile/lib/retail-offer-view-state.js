// Presentation only: Cloud remains authoritative for offer eligibility and ranking.
function retailOfferViewState({ loading, status, visibleCount }) {
  if (loading) return 'loading';
  if (status === 'empty') return 'empty';
  if (status !== 'available') return 'unavailable';
  return visibleCount > 0 ? 'available' : 'filtered';
}
module.exports = { retailOfferViewState };
