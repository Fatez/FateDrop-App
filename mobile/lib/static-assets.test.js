const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mobileRoot = path.resolve(__dirname, '..');
const sourceRoots = ['app', 'screens', 'components'];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

test('every statically required mobile image exists on disk', () => {
  const missing = [];

  for (const root of sourceRoots) {
    const rootPath = path.join(mobileRoot, root);
    if (!fs.existsSync(rootPath)) continue;

    for (const file of walk(rootPath)) {
      const source = fs.readFileSync(file, 'utf8');
      const requirePattern = /require\((['"])([^'"]+\.(?:png|jpe?g|webp|gif))\1\)/g;

      for (const match of source.matchAll(requirePattern)) {
        const requiredPath = path.resolve(path.dirname(file), match[2]);
        if (!fs.existsSync(requiredPath)) {
          missing.push(`${path.relative(mobileRoot, file)} -> ${match[2]}`);
        }
      }
    }
  }

  assert.deepEqual(missing, [], `Missing static assets:\n${missing.join('\n')}`);
});
