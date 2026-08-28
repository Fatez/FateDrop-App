'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const notice = fs.readFileSync(path.join(__dirname, '..', 'components', 'local-physical-stock-notice.tsx'), 'utf8');
const radar = fs.readFileSync(path.join(__dirname, '..', 'app', 'local-radar.tsx'), 'utf8');

test('physical-stock notice requires Cloud confirmed state and Cloud alert id', () => {
  assert.match(notice, /localAvailability\?\.status !== 'confirmed'/);
  assert.match(notice, /confirmed\?\.alertId/);
  assert.doesNotMatch(notice, /legacy:|productIdentityId.*observedAt.*join/);
  assert.match(notice, /Physical stock confirmed nearby/);
  assert.match(notice, /Exact-branch physical availability was verified by FateDrop/);
});

test('physical-stock notice is one-time per Cloud alert and opens the exact store', () => {
  assert.match(notice, /fatedrop:local-physical-alert-seen:v1:/);
  assert.match(notice, /AsyncStorage\.multiGet/);
  assert.match(notice, /AsyncStorage\.setItem/);
  assert.match(notice, /onOpen\(notice\.shop\)/);
});

test('stable Local Radar native map remains unchanged while notice is presentation-only', () => {
  assert.match(radar, /<MapView style=\{StyleSheet\.absoluteFill\} region=\{region\} onRegionChangeComplete=\{setRegion\}/);
  assert.match(radar, /mappedShops\.map\(shop => <Marker key=\{shop\.id\}/);
  assert.match(radar, /<LocalPhysicalStockNotice shops=\{prioritizedShops\}/);
  assert.doesNotMatch(radar, /cluster|Cluster|supercluster/);
});
