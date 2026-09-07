async function stageOwnedTrade({ item, tradeQuantity, terms }, api) {
  if (!item?.id || !item.card || item.card.fateCardId !== item.fateCardId) throw new Error('Refresh your collection and choose a verified owned card.');
  if (!Number.isInteger(tradeQuantity) || tradeQuantity < 1 || tradeQuantity > item.quantity) throw new Error('Choose a whole number of copies between 1 and the quantity you own.');
  if (!Number.isInteger(item.revision) || item.revision < 1) throw new Error('Refresh this collection item before trading.');
  if (!terms.localTradeAllowed && !terms.postalTradeAllowed) throw new Error('Choose a local or postal trade method.');
  const binder = await api.fetchBinder(item.card.tcgCode);
  if (binder.items?.some((entry) => entry.collectionItemId === item.id)) return { alreadyPresent: true };
  // Check the revision even when the offered quantity appears unchanged locally.
  await api.updateTradeQuantity(item.id, { tradeQuantity, expectedRevision: item.revision });
  try {
    await api.createBinder({ ...terms, collectionItemId: item.id, visibility: 'private' });
  } catch (cause) {
    // Never delete an existing holding or blindly roll back after an uncertain response.
    throw new Error(`Your owned cards are unchanged. Trade availability may have been saved, but the Trade Binder could not be confirmed. Refresh and retry. ${cause instanceof Error ? cause.message : ''}`.trim());
  }
  return { alreadyPresent: false };
}

module.exports = { stageOwnedTrade };

