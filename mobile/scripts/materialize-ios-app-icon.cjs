const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'assets', 'icon-source', 'fatedrop-ios-icon-512-q25');
const outputPath = path.join(root, 'assets', 'images', 'fatedrop-app-icon-final.png');
const tempJpegPath = path.join(root, 'assets', 'images', '.fatedrop-ios-icon-source.jpg');
const expectedSourceSha256 = '2469a4706762dfd01bbc11a5d0aa3a70f0f521e7e81d11232a6e7ad09076ddbd';
const expectedParts = Array.from({ length: 6 }, (_, index) => `part-${String(index).padStart(2, '0')}.b64`);

function fail(message) {
  throw new Error(`[FateDrop iOS icon] ${message}`);
}

function loadVerifiedSource() {
  const actualParts = fs.readdirSync(sourceDir).filter((name) => name.endsWith('.b64')).sort();
  if (JSON.stringify(actualParts) !== JSON.stringify(expectedParts)) {
    fail(`source chunks changed: expected ${expectedParts.join(', ')}, got ${actualParts.join(', ')}`);
  }

  const encoded = actualParts.map((name) => fs.readFileSync(path.join(sourceDir, name), 'utf8').trim()).join('');
  const source = Buffer.from(encoded, 'base64');
  const digest = crypto.createHash('sha256').update(source).digest('hex');
  if (digest !== expectedSourceSha256) fail(`source SHA-256 mismatch: ${digest}`);
  if (source.length !== 17635) fail(`source artwork size changed: ${source.length} bytes`);
  if (source[0] !== 0xff || source[1] !== 0xd8 || source[2] !== 0xff) fail('source artwork is not a JPEG');
  return source;
}

function assertPngStructure(filePath) {
  const png = fs.readFileSync(filePath);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!png.subarray(0, 8).equals(signature)) fail('materialized icon is not a PNG');
  if (png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024) {
    fail(`materialized icon is ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}, expected 1024x1024`);
  }
}

const source = loadVerifiedSource();

// EAS iOS builders are macOS. Linux CI verifies the committed source/hash;
// the native iOS builder materializes and validates the final PNG.
if (process.platform !== 'darwin') {
  console.log('[FateDrop iOS icon] source artwork verified; macOS will materialize the final 1024x1024 PNG.');
  process.exit(0);
}

try {
  fs.writeFileSync(tempJpegPath, source);
  execFileSync('/usr/bin/sips', ['-z', '1024', '1024', '-s', 'format', 'png', tempJpegPath, '--out', outputPath], { stdio: 'inherit' });
  assertPngStructure(outputPath);

  const properties = execFileSync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'hasAlpha', outputPath], { encoding: 'utf8' });
  if (!/pixelWidth:\s*1024\b/.test(properties) || !/pixelHeight:\s*1024\b/.test(properties)) {
    fail(`macOS reports unexpected icon dimensions:\n${properties}`);
  }
  if (!/hasAlpha:\s*no\b/i.test(properties)) {
    fail(`iOS app icon must be opaque; macOS reports:\n${properties}`);
  }

  console.log(`[FateDrop iOS icon] materialized verified 1024x1024 opaque PNG at ${path.relative(root, outputPath)}.`);
} finally {
  if (fs.existsSync(tempJpegPath)) fs.unlinkSync(tempJpegPath);
}
