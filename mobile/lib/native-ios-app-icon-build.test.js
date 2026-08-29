const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'assets', 'icon-source', 'fatedrop-ios-icon-512-q25');
const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const materializer = fs.readFileSync(path.join(root, 'scripts', 'materialize-ios-app-icon.cjs'), 'utf8');
const expectedParts = Array.from({ length: 6 }, (_, index) => `part-${String(index).padStart(2, '0')}.b64`);
const expectedSha256 = '2469a4706762dfd01bbc11a5d0aa3a70f0f521e7e81d11232a6e7ad09076ddbd';

test('committed final FateDrop icon source is complete and hash locked', () => {
  const parts = fs.readdirSync(sourceDir).filter((name) => name.endsWith('.b64')).sort();
  assert.deepEqual(parts, expectedParts);

  const encoded = parts.map((name) => fs.readFileSync(path.join(sourceDir, name), 'utf8').trim()).join('');
  const source = Buffer.from(encoded, 'base64');
  assert.equal(source.length, 17635);
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), expectedSha256);
  assert.deepEqual([...source.subarray(0, 3)], [0xff, 0xd8, 0xff]);
});

test('EAS build hook verifies and materializes the final iOS icon before native prebuild', () => {
  assert.equal(packageJson.scripts['eas-build-pre-install'], 'node ./scripts/materialize-ios-app-icon.cjs');
  assert.equal(appConfig.expo.icon, './assets/images/fatedrop-app-icon-final.png');
  assert.equal(appConfig.expo.ios?.icon, './assets/images/fatedrop-app-icon-final.png');

  assert.match(materializer, /expectedSourceSha256 = '2469a4706762dfd01bbc11a5d0aa3a70f0f521e7e81d11232a6e7ad09076ddbd'/);
  assert.match(materializer, /fatedrop-app-icon-final\.png/);
  assert.match(materializer, /1024x1024 opaque PNG/);
  assert.match(materializer, /hasAlpha/);
  assert.match(materializer, /\/usr\/bin\/sips/);

  const result = spawnSync(process.execPath, ['./scripts/materialize-ios-app-icon.cjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /source artwork verified/);
});
