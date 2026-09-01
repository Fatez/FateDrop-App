const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const layout = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
const notice = fs.readFileSync(path.join(__dirname, '../components/local-radar-operator-notice.tsx'), 'utf8');
const context = fs.readFileSync(path.join(__dirname, '../contexts/local-radar-notice-context.tsx'), 'utf8');

const hardenedProductExpression = 'safeExternalHttpsUrl(response.notification.request.content.data?.productUrl)';

test('Local Radar operator notification routes into the stable Local Radar screen', () => {
  assert.match(layout, /data\?\.route === 'local-radar'/);
  assert.match(layout, /router\.push\('\/local-radar'\)/);
  assert.match(layout, /handleLocalRadarData\(data, true\)/);
});

test('Local Radar routing preserves the descriptive Cloud and Web operator payload', () => {
  assert.match(layout, /operatorNoticeFromData\(data\)/);
  assert.match(layout, /retailerName: notificationText\(data\.retailerName\)/);
  assert.match(layout, /productTitle: notificationText\(data\.productTitle\)/);
  assert.match(layout, /expectedFrom: notificationText\(data\.expectedFrom\)/);
  assert.match(layout, /expectedTo: notificationText\(data\.expectedTo\)/);
  assert.match(layout, /expectedLabel: notificationText\(data\.expectedLabel\)/);
  assert.match(layout, /branchCount: notificationCount\(data\.branchCount\)/);
  assert.match(layout, /presentationType: data\.presentationType === 'big_fate_signal'/);
  assert.match(layout, /physicalEvidenceState:/);
  assert.match(layout, /retailerUrl: notificationText\(data\.retailerUrl\)/);
  assert.match(layout, /radiusTargeted: notificationBoolean\(data\.radiusTargeted\)/);
});

test('Local Radar alert is recovered on cold start and captured while the app is foregrounded', () => {
  assert.match(layout, /getLastNotificationResponseAsync\(\)/);
  assert.match(layout, /clearLastNotificationResponseAsync\(\)/);
  assert.match(layout, /addNotificationReceivedListener/);
  assert.match(layout, /handleLocalRadarData\(data, false\)/);
  assert.match(layout, /addNotificationResponseReceivedListener/);
});

test('incoming-stock panel renders only on Local Radar and can minimise to a persistent map tab', () => {
  assert.match(layout, /usePathname\(\)/);
  assert.match(layout, /pathname === '\/local-radar' && notice/);
  assert.match(layout, /collapsed=\{collapsed\}/);
  assert.match(layout, /onCollapse=\{collapseNotice\}/);
  assert.match(layout, /onExpand=\{expandNotice\}/);
  assert.match(layout, /onDismiss=\{dismissNotice\}/);
  assert.match(context, /const showNotice = useCallback\(\(nextNotice: LocalRadarOperatorNoticeData\) =>/);
  assert.match(context, /setNotice\(nextNotice\)/);
  assert.match(context, /setCollapsed\(false\)/);
  assert.match(context, /collapseNotice = useCallback\(\(\) => setCollapsed\(true\)/);
  assert.match(notice, /BIG FATE SIGNAL · ECHO/);
  assert.match(notice, /IN-STORE CONFIRMED/);
  assert.match(notice, /NO LONGER CONFIRMED/);
  assert.match(notice, /Official allocation is preparation evidence, not live shelf stock/);
  assert.match(notice, /SHOW LOCAL RADAR/);
  assert.match(notice, /openTrackedRetailerLink/);
  assert.match(notice, /placement: 'big_fate_signal'/);
  assert.match(notice, /position: 'absolute'/);
});

test('Local Radar routing is checked before the normal product URL handoff', () => {
  const routeCheck = layout.indexOf("data?.route === 'local-radar'");
  const productCheck = layout.indexOf(hardenedProductExpression);
  assert.ok(routeCheck >= 0, 'Local Radar route check must exist');
  assert.ok(productCheck > routeCheck, 'product URL fallback must run after Local Radar routing');
});

test('canonical lifecycle push routes to Alerts before the external product fallback', () => {
  const routeCheck = layout.indexOf("data?.route === 'alerts'");
  const alertsPush = layout.indexOf("router.push('/alerts')");
  const productCheck = layout.indexOf(hardenedProductExpression);
  assert.ok(routeCheck >= 0, 'canonical alerts route check must exist');
  assert.ok(alertsPush > routeCheck, 'canonical lifecycle push must route into Alerts');
  assert.ok(productCheck > alertsPush, 'product URL fallback must run after canonical Alerts routing');
});

test('normal product notifications keep the exact hardened external URL path', () => {
  assert.ok(layout.includes(hardenedProductExpression));
  assert.match(layout, /Linking\.openURL\(safeProductUrl\)/);
});
