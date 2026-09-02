'use strict';

const STAGES = ['WHISPER', 'ECHO', 'MANIFESTED', 'VANISHED'];

function emptyCanonicalAlertCounts() {
  return { WHISPER: 0, ECHO: 0, MANIFESTED: 0, VANISHED: 0 };
}

function countCanonicalAlertBasisByStage(alerts, tcgCode = 'all') {
  const counts = emptyCanonicalAlertCounts();
  const requestedTcg = typeof tcgCode === 'string' ? tcgCode.trim().toLowerCase() : 'all';

  for (const alert of Array.isArray(alerts) ? alerts : []) {
    if (!alert || !STAGES.includes(alert.fateStage)) continue;
    if (requestedTcg !== 'all' && String(alert.tcgCode || '').toLowerCase() !== requestedTcg) continue;
    counts[alert.fateStage] += 1;
  }

  return counts;
}

module.exports = { countCanonicalAlertBasisByStage, emptyCanonicalAlertCounts };
