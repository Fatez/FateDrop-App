const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'constants/api.ts'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '../.env.example'), 'utf8');
const alerts = fs.readFileSync(path.join(root, 'services/canonical-alerts.ts'), 'utf8');
const identity = fs.readFileSync(path.join(root, 'services/fatedrop-id.ts'), 'utf8');
const signals = fs.readFileSync(path.join(root, 'services/network-signals.ts'), 'utf8');
const notifications = fs.readFileSync(path.join(root, 'lib/notifications.ts'), 'utf8');

test('canonical Web/account gateway is pinned to fatedrop.co.uk', () => {
  assert.match(api, /DEFAULT_FATEDROP_WEB_URL = 'https:\/\/fatedrop\.co\.uk'/);
  assert.match(api, /CANONICAL_FATEDROP_WEB_HOST = 'fatedrop\.co\.uk'/);
  assert.match(api, /url\.protocol !== 'https:'/);
  assert.match(api, /url\.hostname\.toLowerCase\(\) !== CANONICAL_FATEDROP_WEB_HOST/);
  assert.match(api, /url\.origin !== canonicalOrigin/);
  assert.match(api, /return DEFAULT_FATEDROP_WEB_URL/);
  assert.match(envExample, /EXPO_PUBLIC_FATEDROP_WEB_URL=https:\/\/fatedrop\.co\.uk/);
  assert.doesNotMatch(envExample, /EXPO_PUBLIC_FATEDROP_WEB_URL=https:\/\/fate-drop\.com/);
});

test('stale Expo/Codespaces Web overrides cannot redirect authenticated App traffic', () => {
  assert.match(api, /canonicalWebBaseUrl\(process\.env\.EXPO_PUBLIC_FATEDROP_WEB_URL\)/);
  assert.match(api, /stale\/non-canonical host, port, path, query or hash fails safely back/);
  assert.doesNotMatch(api, /OBSOLETE_FATEDROP_WEB_HOSTS/);
});

test('Web-backed App services consume one canonical exported endpoint', () => {
  for (const source of [alerts, identity, signals, notifications]) {
    assert.match(source, /FATEDROP_WEB_URL/);
    assert.doesNotMatch(source, /process\.env\.EXPO_PUBLIC_FATEDROP_WEB_URL/);
    assert.doesNotMatch(source, /DEFAULT_WEB_URL/);
  }
});

test('personal alert inbox is fetched from the canonical authenticated mobile route', () => {
  assert.match(alerts, /FATEDROP_WEB_URL.*\/api\/mobile\/alerts\?limit=/s);
  assert.match(alerts, /authorization: `Bearer \$\{token\}`/);
});

test('push registration cannot fall back to a retired or arbitrary Web host', () => {
  assert.match(notifications, /FATEDROP_WEB_URL.*\/api\/mobile\/push/s);
  assert.doesNotMatch(notifications, /https:\/\/fate-drop\.com/);
});

test('network truth remains Cloud-owned rather than routed through Web diagnostics', () => {
  assert.match(signals, /SIGNAL_ENGINE_URL/);
  assert.match(signals, /\/api\/signal-summary/);
  assert.match(signals, /\/api\/signals/);
  assert.doesNotMatch(signals, /\/api\/mobile\/signal-health/);
});
