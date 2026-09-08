const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { stripTypeScriptTypes } = require('node:module');

function service({ storageFails = false, fetchFails = false, browserFails = false, supported = true } = {}) {
  const calls = [];
  const source = fs.readFileSync(path.join(__dirname, '../services/outbound-links.ts'), 'utf8');
  const code = stripTypeScriptTypes(source).replace(/^import .*;\r?$/gm, '').replace(/export async function/g, 'async function');
  const dependencies = {
    '@react-native-async-storage/async-storage': { getItem: async () => { if (storageFails) throw new Error('Storage unavailable'); return 'test-session'; } },
    'expo-web-browser': { WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' }, openBrowserAsync: async (url) => { calls.push(['browser', url]); if (browserFails) throw new Error('Browser unavailable'); } },
    'react-native': { Linking: { canOpenURL: async () => supported, openURL: async (url) => calls.push(['external', url]) } },
    '@/constants/api': { API_BASE_URL: 'https://api.example.test' },
    '@/lib/external-url-security': { safeExternalHttpsUrl: (value) => value === 'https://shop.example.test/card' ? value : null },
  };
  const api = new Function('AsyncStorage', 'openBrowserAsync', 'WebBrowserPresentationStyle', 'Linking', 'API_BASE_URL', 'safeExternalHttpsUrl', 'fetch', `${code}\nreturn { openTrackedRetailerLink, openExternalRetailerLink };`)(
    dependencies['@react-native-async-storage/async-storage'], dependencies['expo-web-browser'].openBrowserAsync,
    dependencies['expo-web-browser'].WebBrowserPresentationStyle, dependencies['react-native'].Linking,
    dependencies['@/constants/api'].API_BASE_URL, dependencies['@/lib/external-url-security'].safeExternalHttpsUrl,
    async () => { calls.push(['tracking']); if (fetchFails) throw new Error('Offline'); return {}; },
  );
  return { api, calls };
}
const input = { destinationUrl: 'https://shop.example.test/card', retailerId: 'shop', offerId: 'card', placement: 'fate-price-buy' };

test('a local analytics storage failure cannot block either retailer opening mode', async () => {
  const { api, calls } = service({ storageFails: true });
  await api.openTrackedRetailerLink(input);
  await api.openExternalRetailerLink(input);
  assert.deepEqual(calls, [['browser', input.destinationUrl], ['external', input.destinationUrl]]);
});
test('a failed analytics request leaves retailer navigation available', async () => {
  const { api, calls } = service({ fetchFails: true });
  await api.openTrackedRetailerLink(input);
  await new Promise(setImmediate);
  assert.ok(calls.some(([kind]) => kind === 'browser'));
});
test('rejected retailer URLs never reach tracking or navigation', async () => {
  const { api, calls } = service();
  for (const open of [api.openTrackedRetailerLink, api.openExternalRetailerLink]) await assert.rejects(open({ ...input, destinationUrl: 'http://localhost' }), /secure public/);
  assert.deepEqual(calls, []);
});
test('actual browser failures still reach the screen for recovery', async () => {
  await assert.rejects(service({ browserFails: true }).api.openTrackedRetailerLink(input), /Browser unavailable/);
  await assert.rejects(service({ supported: false }).api.openExternalRetailerLink(input), /cannot be opened/);
});
