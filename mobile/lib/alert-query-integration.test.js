const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const query = fs.readFileSync(path.join(__dirname, '../services/canonical-alert-query.ts'), 'utf8');
const screen = fs.readFileSync(path.join(__dirname, '../screens/alerts-screen-v4.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '../app/(tabs)/_layout.tsx'), 'utf8');
const root = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
const identityContext = fs.readFileSync(path.join(__dirname, '../contexts/fatedrop-id-context.tsx'), 'utf8');

test('shared alert query keys isolate account game lifecycle filters page size and cursor', () => {
  assert.match(query, /accountId: query\.accountId/);
  assert.match(query, /tcgs: normalizedTcgs\(query\.selectedTcgCodes\)/);
  assert.match(query, /stage: query\.stage/);
  assert.match(query, /filterKey: query\.filterKey/);
  assert.match(query, /limit: query\.limit/);
  assert.match(query, /cursor: query\.cursor \?\? null/);
  assert.doesNotMatch(query, /AsyncStorage|SecureStore/);
});

test('Alerts screen and bottom badge reuse the same shared read-basis cache owner', () => {
  assert.match(screen, /queryCanonicalAlertReadBasis\(readBasisQuery/);
  assert.match(layout, /queryCanonicalAlertReadBasis\(readBasisQuery/);
  assert.match(screen, /peekCanonicalAlertReadBasis\(readBasisQuery\)/);
  assert.match(layout, /peekCanonicalAlertReadBasis\(readBasisQuery\)/);
});

test('normal Alerts navigation fetches only the selected lifecycle plus the independent unread basis', () => {
  assert.match(screen, /queryCanonicalAlertPage\(pageQuery/);
  assert.match(screen, /useFocusEffect[\s\S]*loadSelectedStage\(false\)[\s\S]*updateUnreadFromBasis\(true, false\)/);
  assert.doesNotMatch(screen, /fetchCanonicalAlerts\(100\)/);
  const selectedLoad = screen.slice(screen.indexOf('const loadSelectedStage'), screen.indexOf('useFocusEffect'));
  assert.doesNotMatch(selectedLoad, /refresh\(/);
});

test('old badge polling loop is removed and foreground only revalidates stale cached queries', () => {
  assert.doesNotMatch(layout, /setInterval|setTimeout/);
  assert.match(layout, /state !== 'active'/);
  assert.match(layout, /revalidateStaleCanonicalAlertQueries\(userId\)/);
  assert.match(query, /snapshot\.data !== undefined && !snapshot\.fresh/);
});

test('pull to refresh forces one selected lifecycle request and one shared unread-basis request', () => {
  assert.match(screen, /Promise\.all\(\[loadSelectedStage\(true\), updateUnreadFromBasis\(true, true\)\]\)/);
  assert.match(query, /cache\.request<CanonicalAlertPage>\(key, \(\) => fetchStagePage\(query\), options\)/);
  assert.match(query, /cache\.request<CanonicalAlertReadBasisItem\[]>\(key, fetchReadBasis, options\)/);
});

test('initial history is 20 Whisper 20 Echo 100 Manifested and 20 Vanished', () => {
  assert.match(query, /WHISPER: 20/);
  assert.match(query, /ECHO: 20/);
  assert.match(query, /MANIFESTED: 100/);
  assert.match(query, /VANISHED: 20/);
  assert.match(screen, /limit: INITIAL_ALERT_LIMITS\[stage\]/);
});

test('lifecycle totals come from the complete lightweight read basis, never the bounded rendered page', () => {
  assert.match(screen, /countCanonicalAlertBasisByStage\(alertReadBasis, tcgFilter\)/);
  assert.match(screen, /signedIn \? counts\[value\] : '—'/);
  assert.match(screen, /styles\.sectionCount\}>\{counts\[stage\]\}/);
  assert.doesNotMatch(screen, /styles\.tabCount\}>\{[^}]*filtered\.length/);
  assert.doesNotMatch(screen, /styles\.sectionCount\}>\{filtered\.length\}/);
});

test('late lifecycle responses cannot place one lifecycle card inside another lifecycle screen', () => {
  assert.match(screen, /const pageRequestGeneration = useRef\(0\)/);
  assert.match(screen, /generation !== pageRequestGeneration\.current/);
  assert.match(screen, /alert\.fateStage === pageQuery\.stage/);
  assert.match(screen, /alert\.fateStage === stage/);
});

test('marking the visible page read cannot cancel an in-flight total-count basis request', () => {
  assert.match(screen, /readBasisRequestGeneration\.current \+= 1/);
  assert.match(screen, /const generation = readBasisRequestGeneration\.current/);
  assert.doesNotMatch(screen, /const generation = \+\+readBasisRequestGeneration\.current/);
});

test('Whisper Echo and Vanished load earlier history in explicit 20-row cursor pages without duplicates', () => {
  assert.match(query, /EARLIER_ALERT_PAGE_SIZE = 20/);
  assert.match(screen, /View earlier Whispers/);
  assert.match(screen, /View earlier Echoes/);
  assert.match(screen, /View earlier Vanished/);
  assert.match(screen, /stage === 'MANIFESTED'/);
  assert.match(screen, /limit: EARLIER_ALERT_PAGE_SIZE, cursor: nextCursor/);
  assert.match(screen, /const scoped = previous\.filter\(\(alert\) => alert\.fateStage === requestedStage\)/);
  assert.match(screen, /const seen = new Set\(scoped\.map\(\(alert\) => alert\.id\)\)/);
  assert.match(screen, /page\.alerts\.filter\(\(alert\) => alert\.fateStage === requestedStage && !seen\.has\(alert\.id\)\)/);
});

test('pagination never deletes canonical history or marks earlier pages read', () => {
  assert.match(screen, /return \[\.\.\.scoped, \.\.\.page\.alerts\.filter/);
  assert.match(screen, /filtered\.slice\(0, INITIAL_ALERT_LIMITS\[stage\]\)/);
  assert.match(screen, /markCanonicalAlertStageSeen\(userId, stage, visibleAlerts\)/);
  assert.doesNotMatch(screen, /splice\(|deleteCanonical|markCanonicalAlertStageSeen\(userId, stage, filtered\)/);
});

test('Manifested keeps its 100-record action window on a virtualized FlatList', () => {
  assert.match(screen, /FlatList/);
  assert.match(screen, /renderItem=\{\(\{ item \}\) => <AlertRow alert=\{item\} \/>\}/);
  assert.match(query, /MANIFESTED: 100/);
  assert.doesNotMatch(screen, /filtered\.map\(\(alert\) => <AlertRow/);
});

test('logout account changes and expired sessions synchronously clear in-memory alert data', () => {
  assert.match(identityContext, /clearCanonicalAlertQueryCache\(\);[\s\S]*signInFateDropId/);
  assert.match(identityContext, /const forgetLocalSession[\s\S]*clearCanonicalAlertQueryCache\(\);/);
  assert.match(identityContext, /const signOut[\s\S]*clearCanonicalAlertQueryCache\(\);/);
  assert.match(identityContext, /expired[\s\S]*clearCanonicalAlertQueryCache\(\)/);
});

test('canonical push receipt invalidates only the signed-in account and supplied lifecycle/game hint', () => {
  assert.match(root, /invalidateCanonicalAlertQueries\(\{/);
  assert.match(root, /accountId: userId/);
  assert.match(root, /stage: canonicalAlertStage\(data\.stage\)/);
  assert.match(root, /tcgCode: notificationText\(data\.tcgCode\) \|\| null/);
  assert.match(root, /addNotificationReceivedListener[\s\S]*route === 'alerts'[\s\S]*invalidateAlertData\(data\)/);
});

test('the performance patch adds no polling timer or plaintext alert-payload persistence', () => {
  assert.doesNotMatch(screen, /setInterval|setTimeout|AsyncStorage/);
  assert.doesNotMatch(layout, /setInterval|setTimeout|AsyncStorage/);
  assert.doesNotMatch(query, /setInterval|setTimeout|AsyncStorage/);
});
