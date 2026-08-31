const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = (path) => fs.readFileSync(path, 'utf8');
const onboarding = read('mobile/app/onboarding.tsx');
const onboardingState = read('mobile/lib/onboarding-state.ts');
const boundary = read('mobile/components/first-run-tour-boundary.tsx');
const rootLayout = read('mobile/app/_layout.tsx');
const more = read('mobile/screens/more-screen-v2.tsx');

test('app guide stores only a versioned local completion flag', () => {
  assert.match(onboardingState, /APP_GUIDE_VERSION = 1/);
  assert.match(onboardingState, /fatedrop\.app-guide\.v\$\{APP_GUIDE_VERSION\}\.complete/);
  assert.match(onboardingState, /setItem\(APP_GUIDE_STORAGE_KEY, '1'\)/);
  assert.doesNotMatch(onboardingState, /fateId|email|displayName|session|token|snapshot/i);
});

test('first-run guide is downstream of canonical closed-beta approval', () => {
  assert.match(boundary, /!snapshot\?\.user \|\| !snapshot\.accessAllowed/);
  assert.match(boundary, /pathname === '\/onboarding'/);
  assert.match(boundary, /router\.replace\('\/onboarding'\)/);
  assert.match(rootLayout, /<ClosedBetaBoundary>[\s\S]*<FirstRunTourBoundary>/);
});

test('guide is skippable and replayable from More without persistent bottom nav', () => {
  assert.match(onboarding, /accessibilityLabel="Skip FateDrop app guide"/);
  assert.match(onboarding, /completeAppGuide\(\)/);
  assert.match(more, /title: 'App Guide'/);
  assert.match(more, /path: '\/onboarding'/);
  assert.match(
    rootLayout,
    /pathname !== '\/onboarding' && pathname !== '\/tcg-onboarding' \? <PersistentBottomNav \/>/,
  );
});

test('guide preserves the four canonical alert meanings', () => {
  assert.match(onboarding, /WHISPER · ORU/);
  assert.match(onboarding, /not a confirmed live-stock instruction/);
  assert.match(onboarding, /ECHO · FENN/);
  assert.match(onboarding, /stronger evidence is building/);
  assert.match(onboarding, /still must not be treated as confirmed physical stock/);
  assert.match(onboarding, /MANIFESTED · KORU/);
  assert.match(onboarding, /Confirmed live\. This is the go alert\./);
  assert.match(onboarding, /this is the alert that says act now/);
  assert.match(onboarding, /VANISHED · NYXEN/);
  assert.match(onboarding, /previously live opportunity is no longer being observed as available/);
});

test('Local Radar guide keeps Expected Confirmed and Unknown physically scoped', () => {
  assert.match(onboarding, /Local Radar keeps nearby-store intelligence separate from online stock/);
  assert.match(onboarding, /Expected means credible incoming-store intelligence/);
  assert.match(onboarding, /Confirmed requires exact physical evidence/);
  assert.match(onboarding, /Unknown stays unknown/);
});
