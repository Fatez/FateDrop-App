# FateDrop mobile dependency security exception

_Last reviewed: 21 August 2026_

This document records a temporary **private-beta** exception for upstream Expo/Metro build-tool advisories. It is not a claim that the dependency tree is vulnerability-free, and it must not be used to justify a scaled/public release without review.

## Current verified beta baseline

The protected FateDrop mobile candidate currently passes:

- repository tests;
- Expo lint and TypeScript;
- Expo Doctor 18/18;
- iOS Expo export;
- Android Expo export.

The exported Hermes application bundle is approximately 6.01 MB on both platforms. The successful native exports prove that the current SDK 54 application still bundles cleanly; they do not erase dependency advisories.

## Known upstream advisories

`npm audit --omit=dev --audit-level=high` currently reports advisories through the Expo/Metro/config toolchain, including:

- `image-size` — high-severity denial-of-service advisories in image parsers used by Metro tooling. At this review point npm has no non-breaking patched path for the installed Expo SDK and proposes a breaking Expo SDK 57 migration.
- `postcss` — source-map/file-read and CSS-stringify advisories. Patched PostCSS releases exist, but the installed Expo/Metro dependency chain constrains the transitive copy and npm again proposes a breaking Expo SDK migration rather than a compatible lockfile update.
- `uuid` — moderate advisory reached through Expo config/xcode tooling.

These packages are reached through the Node/Expo build and configuration toolchain. They are not FateDrop-authored application logic and are not represented as equivalent vulnerable Node modules inside the exported Hermes mobile runtime bundle.

## Private-beta decision

For the first controlled private beta, the project may continue on the currently verified Expo SDK 54 candidate provided that:

1. no `npm audit fix --force` or speculative major Expo migration is used merely to silence the audit;
2. EAS/local build inputs remain repository-controlled and trusted — no untrusted ICNS/JXL/HEIF/CSS/source-map inputs are accepted into the build pipeline;
3. the dependency audit remains visible in CI on every relevant change, even though this known upstream set is non-blocking for the private-beta verification job;
4. Expo Doctor, lint/typecheck and both native exports continue to pass;
5. any new advisory outside this documented Expo/Metro/config chain is reviewed before beta promotion;
6. the exception is reviewed again before wider public/App Store/Play Store release.

## Exit criteria

Remove this exception when one of the following is proven:

- the current supported Expo line publishes a compatible patched dependency chain and FateDrop upgrades without breaking its native/Companion work; or
- FateDrop deliberately migrates Expo SDK after isolated testing, with Expo Doctor, native exports, physical-device QA, notifications and Companion rendering all re-proven.

A future SDK migration is a planned compatibility/security task, not an emergency forced upgrade while the private beta candidate is otherwise stable.
