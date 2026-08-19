# FateDrop Mobile Audit — Product Spec v1

Branch: `fatedrop-mobile-product-spec-v1`

This audit reconciles the current Expo app with FateDrop Product Spec v1. It does not delete experimental foundations; it changes what ordinary collectors see and how features are described.

## Primary navigation — LOCKED

| Surface | Decision | Product role |
| --- | --- | --- |
| Home | KEEP / CORE | Global network heartbeat and useful personal highlights |
| Search | KEEP / CORE | Product-first market search and offer comparison |
| Indies | KEEP / CORE | Independent retailer discovery/storefront network |
| Alerts | KEEP / CORE / CHANGE | Personal FateFind/FateMatch/notification surface only |
| More | KEEP / CHANGE | Secondary collector tools; no backend/admin clutter |
| Watchlist tab route | KEEP route / HIDE tab | Universal Wishlist accessed through More/Search |

## Current routes

| Route | Decision | Notes |
| --- | --- | --- |
| `/(tabs)/index` | KEEP / CHANGE | Network Activity belongs here. Remove stale/fabricated fallback claims and hard-coded notification counts. |
| `/(tabs)/search` | KEEP / CORE / UPGRADE | Must search all connected retailers including independents. Evolve toward product → offers → buy. |
| `/(tabs)/indies` | KEEP / CORE | Keep retailer profiles/direct checkout. Avoid subjective ranking. |
| `/(tabs)/alerts` | KEEP / REBUILD | Personal hunts and notifications; no duplicate global feed. |
| `/(tabs)/watchlist` | KEEP / MOVE | Universal Wishlist only. FateFind is not a Wishlist item. |
| `/(tabs)/more` | KEEP / SIMPLIFY | Wishlist, FateFind, True Price, Local Radar, Events, later account/Companion. |
| `/true-price` | KEEP / CORE LAYER | Major USP. Unknown delivery remains unknown. Add RRP provenance/markup as Cloud exposes it. |
| `/fatefind` | KEEP / PREMIUM CANDIDATE | FateFind = hunt; FateMatch = qualifying result. Stop mirroring hunts into Wishlist. |
| `/local-radar` | KEEP / SECONDARY | Strong future differentiator; do not dominate primary navigation. |
| `/encounters` | KEEP | Fate Encounters / events. |
| `/retailers/[id]` | KEEP | Retailer storefront/profile. |
| `/retailer-partners` | KEEP / BUSINESS ENTRY | Retailer onboarding, not collector navigation. |
| `/retailer-dashboard` | KEEP CODE / RETAILER ONLY | Analytics/import/plans; remove from collector More. |
| `/event-vendors` | KEEP FOUNDATION / HIDE | Event Vendor Mode is later-stage. |
| `/reserve-demo` | HOLD / HIDE | Requires connected retailer-controlled reservation support. |
| `/basket-breaker` | HOLD / HIDE | Preserve foundation; future name should be Optimise Basket. |
| `/fatescore` | HOLD / HIDE | Do not expose until inputs can be explained objectively. |
| `/fatebounty` | HOLD / HIDE | Priority One/Bounty marketplace direction; avoid launch scope creep. |
| `/demand-signal` | B2B / HIDE | Aggregated demand belongs in retailer tooling only. |
| `/onboarding` | KEEP / REVIEW | Future onboarding should teach core jobs, not every experimental system. |

## Signal language

Public:
- **Echo** — meaningful early/precursor intelligence; not confirmed stock and never a guarantee.
- **Manifested** — confirmed meaningful availability/restock/event.
- **Vanished** — previously confirmed availability lost.
- **Drop Pulse** — contextual evidence/activity layer only.

Internal only:
- **Whisper** and lower-level observation names.

Legacy internal restock events named `ECHO` must be mapped to public Manifested when they represent confirmed returned stock.

## Saved intent

### Universal Wishlist
Simple product intent: **I want this.**

- stores products/offers regardless of retailer/stock state
- sold-out products remain saved
- optional product alerts may exist
- does not contain FateFind records in the consumer UI

### FateFind
Structured active hunt: **Go find this under these conditions.**

Examples:
- max item price
- max delivered price
- retailer preference
- condition
- preorder acceptance
- local/collection constraints

### FateMatch
A recorded result when a qualifying offer satisfies a FateFind.

## Features that must not occupy collector navigation

- monitor health
- monitor orchestration
- retailer analytics
- catalogue import
- retailer plan entitlements
- demand aggregation
- feature flags
- FateScore while held
- Reserve & Collect while held
- Basket Breaker while held
- Bounties while held
- Passport/progression/tokens/XP

## Known architecture gaps

1. `EXPO_PUBLIC_API_BASE_URL` still defaults to a LAN development server; Cloud migration/configuration must be handled deliberately rather than silently swapping endpoints.
2. Search is offer-first today; Product Spec target is grouped product-first comparison.
3. Mobile Wishlist/FateFind are local AsyncStorage foundations rather than the persistent cross-platform FateDrop ID model used by the website branch.
4. Push permission is currently requested on app startup; Product Spec target is explicit user-controlled alert setup/preferences.
5. True Price already handles unknown delivery conservatively but does not yet expose official RRP provenance/markup from the canonical Cloud response.
6. Home contains stale hard-coded presentation/claims that need to become evidence-backed network state.
7. Final 3D Companion assets and renderer do not exist in this app repository yet.

## Implementation rule

Do not delete held foundations merely to simplify navigation. Hide/move them, preserve data compatibility, and document the route so they can be revived intentionally later.
