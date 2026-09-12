const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = (path) => fs.readFileSync(path, 'utf8');
const voice = read('mobile/lib/companion-voice.ts');
const shell = read('mobile/app/_layout.tsx');
const routeVoice = read('mobile/components/companion-route-voice.tsx');
const home = read('mobile/components/home-personal-briefing.tsx');
const collections = read('mobile/components/fate-collections-ui.tsx');
const onboarding = read('mobile/app/onboarding.tsx');

test('companion voice is centralized and rendered by the app shell', () => {
  assert.match(shell, /CompanionRouteVoice/);
  assert.match(shell, /<CompanionRouteVoice pathname=\{pathname\} \/>/);
  assert.match(routeVoice, /companionRouteVoice\(pathname\)/);
  assert.match(routeVoice, /Dismiss companion note/);
});

test('FateFind watches conditions and FateMatch is reserved for successful qualification', () => {
  const fateFind = voice.match(/if \(path === '\/fatefind'\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  const fateMatch = voice.match(/if \(path === '\/fate-match'\) \{([\s\S]*?)\n  \}/)?.[1] || '';

  assert.match(fateFind, /True Price and the limits you choose/);
  assert.match(fateFind, /Nothing becomes a FateMatch until those rules are satisfied/);
  assert.doesNotMatch(fateFind, /found it|found this|conditions aligned/i);

  assert.match(fateMatch, /successful hunts return/);
  assert.match(fateMatch, /active FateFind's conditions are satisfied/);
});

test('new guardian roles are explicit without replacing canonical alert roles', () => {
  assert.match(voice, /companion: 'Morren'[\s\S]*collection is in good company/);
  assert.match(voice, /companion: 'Veyl'[\s\S]*Reading the market/);
  assert.match(voice, /companion: 'Taren'[\s\S]*Tracing the value/);
  assert.match(onboarding, /Morren looks after collections, Veyl reads market movement and Taren traces value/);
  assert.match(onboarding, /Oru, Fenn, Koru and Nyxen keep their signal roles/);
});

test('Home companion briefing is driven by derived evidence rather than decorative copy', () => {
  assert.match(home, /homeCompanionVoice\(\{/);
  assert.match(home, /state: signalState/);
  assert.match(home, /wantedLiveCount/);
  assert.match(home, /unreadEchoes: personalUnread\.ECHO/);
  assert.match(home, /unreadWhispers: personalUnread\.WHISPER/);
  assert.match(home, /unreadVanished: personalUnread\.VANISHED/);
  assert.match(voice, /Koru spotted something you saved live/);
  assert.match(voice, /Fenn heard the signal getting stronger/);
  assert.match(voice, /Oru heard something beginning/);
  assert.match(voice, /Nyxen marked an opportunity as gone/);
});

test('Collections consistently frame Morren as keeper without changing collection truth', () => {
  assert.match(collections, /Morren is opening Fate Collections/);
  assert.match(collections, /MORREN · FATE COLLECTIONS/);
  assert.match(voice, /Open the checklist to see exactly what still needs a home/);
  assert.match(voice, /Slabs stay separate from binder completion/);
});

test('passive saved items never imply active monitoring', () => {
  assert.match(voice, /Remembered, not monitored/);
  assert.match(voice, /Saved items stay passive until you explicitly create a FateFind/);
  assert.match(voice, /Search shows what FateDrop can see now\. It never starts monitoring by itself/);
});
