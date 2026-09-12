// OCR only suggests search terms. It never creates or verifies an identity.
export function cardScanHints(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const number = text.match(/\b([A-Z]{0,3}\d{1,3})\s*\/\s*(?:[A-Z]{0,3}\d{1,3})\b/i)?.[1] || '';
  const name = lines.slice(0, 8).map((line) => line
    .replace(/\b(?:BASIC|STAGE\s*[12]|HP\s*\d+|\d+\s*HP)\b/gi, '').trim())
    .find((line) => /[a-z]{3}/i.test(line) && line.length <= 45 && !/evolves from|trainer|energy|pokemon|pokémon/i.test(line)) || '';
  return { name, number };
}
export function scanCandidateMatches(card: { tcgCode: string | null; languageCode: string; collectorNumber: string; verificationStatus: string }, number: string) {
  const normalize = (value: string) => value.trim().toUpperCase().replace(/^([A-Z]*)0+(?=\d)/, '$1');
  return card.tcgCode === 'pokemon' && card.languageCode === 'en' && card.verificationStatus === 'verified'
    && (!number.trim() || normalize(card.collectorNumber) === normalize(number));
}
