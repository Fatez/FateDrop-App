const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

const source = (path) => readFileSync(new URL(path, `file://${__dirname}/`), 'utf8');

const presentation = source('./signal-presentation.ts');
const companion = source('./companion-contract.ts');
const notifications = source('./notifications.ts');
const identity = source('../services/fatedrop-id.ts');
const alerts = source('../screens/alerts-screen-v2.tsx');
const alertsService = source('../services/alerts.ts');
const truePrice = source('../app/true-price.tsx');

test('mobile preserves Whisper, Echo, Manifested and Vanished as distinct stages', () => {
  assert.match(presentation, /'WHISPER' \| 'ECHO' \| 'MANIFESTED' \| 'VANISHED'/);
  assert.match(presentation, /stage === 'WHISPER'/);
  assert.match(presentation, /label: 'Whisper'/);
  assert.match(presentation, /stage === 'ECHO'/);
  assert.match(presentation, /label: 'Echo'/);
  assert.doesNotMatch(presentation, /stage === 'WHISPER' \|\| stage === 'ECHO'/);
});

test('Companion uses anticipation for Whisper and readiness for Echo', () => {
  assert.match(companion, /\['whisper', 'drop_pulse'\]\.includes\(kind\)\) return 'watching'/);
  assert.match(companion, /\['echo', 'queue', 'security', 'traffic', 'access_readiness'\]\.includes\(kind\)\) return 'echo'/);
  assert.doesNotMatch(companion, /\[[^\]]*'whisper'[^\]]*\]\.includes\(kind\)\) return 'echo'/);
});

test('mobile account and development notification contracts expose Whisper independently', () => {
  assert.match(identity, /whisper:boolean/);
  assert.match(identity, /whisper:true/);
  assert.match(notifications, /DevelopmentSignalNotification = 'whisper' \| 'echo'/);
  assert.match(notifications, /FateDrop · Whisper detected/);
  assert.match(alerts, /'whisper' \| 'echo' \| 'manifested'/);
  assert.match(alerts, /'whisper', 'echo', 'manifested', 'vanished'/);
});

test('beta True Price retains the RRP-first main-branch improvement', () => {
  assert.match(truePrice, /Know the markup before you buy/);
  assert.match(truePrice, /useState<SortMode>\('item'\)/);
  assert.match(truePrice, /Authoritative RRP unavailable · no markup percentage shown/);
  assert.match(truePrice, /Below RRP/);
});

test('beta reconciliation keeps the authenticated canonical alert inbox instead of the superseded raw signal client', () => {
  assert.match(alerts, /loadCanonicalAlertInbox/);
  assert.doesNotMatch(alerts, /fetchNetworkSignals/);
  assert.match(alertsService, /\/api\/mobile\/alerts/);
  assert.match(alertsService, /authorization: `Bearer \$\{token\}`/);
  assert.match(alertsService, /\?id=\$\{encodeURIComponent\(alertId\)\}/);
});
