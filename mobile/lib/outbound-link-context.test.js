const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../services/outbound-links.ts'), 'utf8');

test('retailer outbound links preserve FateDrop context with the in-app browser', () => {
  assert.match(source, /expo-web-browser/);
  assert.match(source, /WebBrowser\.openBrowserAsync\(destinationUrl\)/);
  assert.match(source, /safeExternalHttpsUrl/);
  assert.doesNotMatch(source, /Linking\.openURL/);
});
