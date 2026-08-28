'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = fs.readFileSync(path.join(__dirname, '..', 'services', 'outbound-links.ts'), 'utf8');
const search = fs.readFileSync(path.join(__dirname, '..', 'screens', 'search-screen-v2.tsx'), 'utf8');
const fateFind = fs.readFileSync(path.join(__dirname, '..', 'screens', 'fatefind-live-screen-v2.tsx'), 'utf8');
const storefront = fs.readFileSync(path.join(__dirname, '..', 'app', 'retailers', '[id].tsx'), 'utf8');
const alerts = fs.readFileSync(path.join(__dirname, '..', 'screens', 'alerts-screen-v4.tsx'), 'utf8');

test('tracked retailer links use the in-app browser and never silently eject through Linking', () => {
  assert.match(service, /openBrowserAsync/);
  assert.match(service, /WebBrowserPresentationStyle\.PAGE_SHEET/);
  assert.match(service, /safeExternalHttpsUrl/);
  assert.doesNotMatch(service, /Linking\.openURL|Linking\.canOpenURL|from 'react-native'/);
});

test('current purchase surfaces route through the same tracked browser helper', () => {
  assert.match(search, /openTrackedRetailerLink/);
  assert.match(fateFind, /openTrackedRetailerLink/);
  assert.match(storefront, /openTrackedRetailerLink/);
  assert.match(storefront, /placement: 'retailer-storefront-profile'/);
  assert.match(storefront, /placement: 'retailer-storefront'/);
});

test('lifecycle alert rows intentionally hand off to the device browser with clear instruction copy', () => {
  assert.match(alerts, /alert\.productUrl \? void Linking\.openURL\(alert\.productUrl\)/);
  assert.match(alerts, /Tap an alert to open the retailer in your browser\./);
});
