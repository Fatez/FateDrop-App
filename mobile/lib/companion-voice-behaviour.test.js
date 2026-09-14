const assert = require('node:assert/strict');
const fs = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const test = require('node:test');
const source = fs.readFileSync(`${__dirname}/companion-voice.ts`, 'utf8');
const voice = import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);

test('Market tabs and their detail routes use the same guardian', async () => {
  const { companionRouteVoice: route } = await voice;
  for (const [area, path, guardian] of [['pulse', '/fate-pulse/cards', 'Veyl'], ['price', '/fate-price-buy', 'Taren'], ['collectors', '/binder/base1', 'Morren']]) {
    assert.equal(route('/market', area).companion, guardian);
    assert.equal(route(path).companion, guardian);
  }
  assert.equal(route('/graded-collection').companion, 'Morren');
  assert.equal(route('/alerts'), null);
});

test('inconsistent Home evidence cannot manufacture one live item or alert', async () => {
  const { homeCompanionVoice: home } = await voice;
  for (const state of ['manifested', 'echo', 'whisper', 'vanished']) {
    for (const count of [0, -1, NaN, Infinity]) {
      const result = home({ state, wantedLiveCount: count, unreadEchoes: count, unreadWhispers: count, unreadVanished: count });
      assert.equal(result.title, 'Your briefing is updating.');
    }
  }
  assert.equal(home({ state: 'manifested', wantedLiveCount: 2 }).title, 'Koru spotted 2 saved items live.');
});
