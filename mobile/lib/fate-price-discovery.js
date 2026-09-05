function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(left, right) {
  return String(left || '').localeCompare(String(right || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function verifiedCards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.filter((card) => card && text(card.id) && card.verificationStatus === 'verified');
}

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function buildFatePriceDiscovery(cards, {
  tcgCode = '',
  setId = '',
  printingId = '',
} = {}) {
  const exact = verifiedCards(cards);
  const gameCounts = countBy(exact, (card) => text(card.tcgCode).toLowerCase());
  const games = [...gameCounts.entries()]
    .map(([code, identityCount]) => ({ code, identityCount }))
    .sort((left, right) => compareText(left.code, right.code));

  const selectedTcg = text(tcgCode).toLowerCase();
  const gameCards = selectedTcg
    ? exact.filter((card) => text(card.tcgCode).toLowerCase() === selectedTcg)
    : [];

  const setMap = new Map();
  for (const card of gameCards) {
    const id = text(card.setId);
    if (!id) continue;
    const current = setMap.get(id);
    if (current) {
      current.identityCount += 1;
      current.printingIds.add(text(card.printingId));
      continue;
    }
    setMap.set(id, {
      id,
      name: text(card.setName) || 'Verified set',
      seriesId: text(card.seriesId),
      seriesName: text(card.seriesName),
      identityCount: 1,
      printingIds: new Set([text(card.printingId)]),
    });
  }
  const sets = [...setMap.values()]
    .map((set) => ({
      id: set.id,
      name: set.name,
      seriesId: set.seriesId,
      seriesName: set.seriesName,
      identityCount: set.identityCount,
      cardCount: [...set.printingIds].filter(Boolean).length,
    }))
    .sort((left, right) => compareText(left.seriesName, right.seriesName) || compareText(left.name, right.name));

  const selectedSet = text(setId);
  const setCards = selectedSet
    ? gameCards.filter((card) => text(card.setId) === selectedSet)
    : [];

  const printingMap = new Map();
  for (const card of setCards) {
    const id = text(card.printingId);
    if (!id) continue;
    const current = printingMap.get(id);
    if (current) {
      current.identityCount += 1;
      current.variantCodes.add(text(card.variantCode) || 'standard');
      current.languageCodes.add(text(card.languageCode) || 'unknown');
      continue;
    }
    printingMap.set(id, {
      printingId: id,
      name: text(card.name) || 'Unknown card',
      collectorNumber: text(card.collectorNumber),
      rarity: text(card.rarity),
      supertype: text(card.supertype),
      identityCount: 1,
      variantCodes: new Set([text(card.variantCode) || 'standard']),
      languageCodes: new Set([text(card.languageCode) || 'unknown']),
    });
  }
  const cardOptions = [...printingMap.values()]
    .map((card) => ({
      printingId: card.printingId,
      name: card.name,
      collectorNumber: card.collectorNumber,
      rarity: card.rarity,
      supertype: card.supertype,
      identityCount: card.identityCount,
      variantCodes: [...card.variantCodes].sort(compareText),
      languageCodes: [...card.languageCodes].sort(compareText),
    }))
    .sort((left, right) => compareText(left.collectorNumber, right.collectorNumber) || compareText(left.name, right.name));

  const selectedPrinting = text(printingId);
  const variants = selectedPrinting
    ? setCards
      .filter((card) => text(card.printingId) === selectedPrinting)
      .sort((left, right) => compareText(left.variantCode, right.variantCode) || compareText(left.languageCode, right.languageCode) || compareText(left.id, right.id))
    : [];

  return Object.freeze({
    exactIdentityCount: exact.length,
    games: Object.freeze(games),
    sets: Object.freeze(sets),
    cards: Object.freeze(cardOptions),
    variants: Object.freeze(variants),
  });
}

function fatePriceVariantLabel(card) {
  const variant = (text(card?.variantCode) || 'standard').replaceAll('-', ' ').replaceAll('_', ' ');
  const language = (text(card?.languageCode) || 'unknown').toUpperCase();
  const rarity = text(card?.rarity);
  return [variant, language, rarity].filter(Boolean).join(' · ');
}

module.exports = { buildFatePriceDiscovery, fatePriceVariantLabel };
