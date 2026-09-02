const assert = require('node:assert/strict');
const test = require('node:test');

const { createAlertQueryCache } = require('./alert-query-cache');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('two simultaneous identical consumers share one HTTP-shaped request', async () => {
  const cache = createAlertQueryCache();
  const gate = deferred();
  let calls = 0;
  const fetcher = () => { calls += 1; return gate.promise; };
  const first = cache.request('same', fetcher);
  const second = cache.request('same', fetcher);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  gate.resolve(['ok']);
  assert.deepEqual(await first, ['ok']);
});

test('fresh cached results return without another request inside the 20 second window', async () => {
  let time = 1_000;
  const cache = createAlertQueryCache({ freshnessMs: 20_000, now: () => time });
  let calls = 0;
  const fetcher = async () => ++calls;
  assert.equal(await cache.request('fresh', fetcher), 1);
  time += 19_999;
  assert.equal(await cache.request('fresh', fetcher), 1);
  assert.equal(calls, 1);
});

test('stale identical consumers cause only one revalidation', async () => {
  let time = 1_000;
  const cache = createAlertQueryCache({ freshnessMs: 20_000, now: () => time });
  let calls = 0;
  await cache.request('stale', async () => ++calls);
  time += 20_001;
  const gate = deferred();
  const fetcher = () => { calls += 1; return gate.promise; };
  const first = cache.request('stale', fetcher);
  const second = cache.request('stale', fetcher);
  assert.equal(first, second);
  assert.equal(calls, 2);
  gate.resolve(2);
  await first;
});

test('pull-to-refresh force produces exactly one forced request', async () => {
  const cache = createAlertQueryCache();
  let calls = 0;
  const fetcher = async () => ++calls;
  await cache.request('pull', fetcher);
  const first = cache.request('pull', fetcher, { force: true });
  const second = cache.request('pull', fetcher, { force: true });
  assert.equal(first, second);
  assert.equal(await first, 2);
  assert.equal(calls, 2);
});

test('different lifecycle filter and game keys remain isolated', async () => {
  const cache = createAlertQueryCache();
  await cache.request('user-a|pokemon|WHISPER|all', async () => ['w']);
  await cache.request('user-a|pokemon|ECHO|all', async () => ['e']);
  await cache.request('user-a|one-piece|WHISPER|all', async () => ['op']);
  assert.deepEqual(cache.peek('user-a|pokemon|WHISPER|all').data, ['w']);
  assert.deepEqual(cache.peek('user-a|pokemon|ECHO|all').data, ['e']);
  assert.deepEqual(cache.peek('user-a|one-piece|WHISPER|all').data, ['op']);
});

test('logout/account clearing removes only the targeted account cache synchronously', async () => {
  const cache = createAlertQueryCache();
  await cache.request('user-a|WHISPER', async () => ['a']);
  await cache.request('user-b|WHISPER', async () => ['b']);
  cache.clearMatching((key) => key.startsWith('user-a|'));
  assert.equal(cache.peek('user-a|WHISPER').data, undefined);
  assert.deepEqual(cache.peek('user-b|WHISPER').data, ['b']);
});

test('an invalidated slow old response can never overwrite a newer response', async () => {
  const cache = createAlertQueryCache();
  const oldGate = deferred();
  const newGate = deferred();
  const oldRequest = cache.request('race', () => oldGate.promise);
  await Promise.resolve();
  cache.invalidate('race');
  const newRequest = cache.request('race', () => newGate.promise);
  newGate.resolve(['new']);
  await newRequest;
  oldGate.resolve(['old']);
  await oldRequest;
  assert.deepEqual(cache.peek('race').data, ['new']);
});

test('failed revalidation preserves the last successful result and exposes the refresh error', async () => {
  let time = 1_000;
  const cache = createAlertQueryCache({ freshnessMs: 20_000, now: () => time });
  await cache.request('retain', async () => ['last-good']);
  time += 20_001;
  await assert.rejects(cache.request('retain', async () => { throw new Error('offline'); }), /offline/);
  const snapshot = cache.peek('retain');
  assert.deepEqual(snapshot.data, ['last-good']);
  assert.match(String(snapshot.error), /offline/);
});