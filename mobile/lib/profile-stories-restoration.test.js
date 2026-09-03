const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const layout = read('app/_layout.tsx');
const profile = read('screens/profile-screen-v2.tsx');
const stories = read('app/stories.tsx');
const packageJson = read('package.json');
const appJson = read('app.json');

test('Profile customisation and Stories are registered without losing hardened routes', () => {
  assert.match(layout, /name="profile-customisation"/);
  assert.match(layout, /name="stories"/);
  assert.match(layout, /name="fate-trader"/);
  assert.match(layout, /name="local-radar-stock"/);
  assert.match(layout, /name="local-radar-events"/);
  assert.match(layout, /name="local-radar-store"/);
});

test('Profile exposes approved customisation and FateDrop Stories entry points', () => {
  assert.match(profile, /Change wallpaper/);
  assert.match(profile, /Edit avatar/);
  assert.match(profile, /Manage companions/);
  assert.match(profile, /FateDrop Stories/);
  assert.match(profile, /\/stories/);
});

test('Stories retains bundled video intro and ten-page manga reader', () => {
  assert.match(stories, /useVideoPlayer/);
  assert.match(stories, /gemini_generated_video_BF2DED27\.mp4/);
  for (let page = 1; page <= 10; page += 1) {
    assert.match(stories, new RegExp(`page-${String(page).padStart(2, '0')}\\.webp`));
  }
});

test('Expo video is explicitly configured for the restored Stories experience', () => {
  assert.match(packageJson, /"expo-video": "~57\.0\.3"/);
  assert.match(appJson, /"expo-video"/);
});
