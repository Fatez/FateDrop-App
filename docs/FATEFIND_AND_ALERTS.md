# FateFind, True Price, Wishlist and FateMatch

This document is the product contract for the native app. Legacy route, API and storage names may remain temporarily for backwards compatibility, but they must not change these user-facing meanings.

## Search — browse the live database

Search is broad catalogue discovery. It can show retailer, stock, item price, verified RRP/reference, item-price difference from that reference, known delivery, True Price and a direct purchase route. Search does not own the canonical best-value decision and does not create monitoring by itself.

## Wishlist — remember this item

Wishlist is passive collector intent: **“Remember this item for me.”**

Saving a product to Wishlist must not silently create an alert, a hosted hunt or a FateMatch rule. Wishlist entries may later sync through FateDrop ID, but monitoring remains an explicit FateFind action.

## FateFind — find this for me

FateFind is FateDrop's flagship intelligent value finder and personal hunting system.

It has two connected jobs:

1. **Find now.** Query the live network, resolve comparable product identity/configuration, apply verified RRP/reference evidence, scale the RRP basis correctly for bundles, show visible True Price evidence and return one canonical Fate Verdict from FateDrop Cloud.
2. **Keep hunting.** When the user chooses acceptable conditions, persist a hosted FateFind through FateDrop ID. If nothing qualifies now, FateDrop continues evaluating observed offers after the app closes.

A persistent FateFind may include product identity/query, maximum item price, maximum True Price, maximum percentage above verified RRP, stock requirement, retailer/scope preferences and notification preferences.

### RRP intelligence

RRP percentage uses **item price only** against the correct verified RRP/reference basis. Bundle quantities must scale the reference before comparison. Never fabricate RRP/reference data.

### True Price

True Price is a visible core calculation inside FateFind, not a competing standalone tool.

- **RRP/reference position** explains whether the retailer's item price is fair.
- **True Price** explains what the collector will actually pay when mandatory delivery/fees are known.
- Unknown delivery remains **UNKNOWN/provisional**. It must never become £0 or free delivery.

The canonical value decision remains owned by FateDrop Cloud so App and Web render the same Fate Verdict rather than calculating separate winners.

## Fate Verdict — explain the answer

Fate Verdict is the canonical explanation/result returned by the shared FateFind intelligence engine. It must make the evidence understandable: identity/configuration, verified RRP/reference basis, item-price position, known True Price and any provisional/unknown evidence.

## FateMatch — FateFind succeeded

FateMatch is **not another configurator or watchlist**. It is the successful observed result/event produced when an active FateFind's conditions are satisfied.

Canonical journey:

**Search → Wishlist (optional) → FateFind → FateMatch → Buy**

Or, in plain language:

> You create a FateFind. FateDrop searches the network. When the conditions align, you receive a FateMatch.

The internal hosted-monitoring endpoint may retain the legacy `/api/fate-matches` name during migration, but user-facing setup must say FateFind. FateMatch surfaces should show successful results/history, not ask the user to create a second set of watch rules.

## Companion delivery

A hosted FateFind can record the companion selected to deliver its personal FateMatch alert:

- Koru
- Fenn
- Oru
- Nyxen

This personal alert choice does not alter the companions' canonical network-signal roles:

- Whisper → Oru
- Echo → Fenn
- Manifested → Koru
- Vanished → Nyxen

## Network lifecycle alerts

Whisper, Echo, Manifested and Vanished describe what FateDrop itself is observing across the network. They are separate from personal FateFind/FateMatch intent. Lifecycle precision and duplicate prevention remain more important than notification volume.

## Legacy local storage

Older local FateFind/watchlist repositories may remain temporarily for migration/backwards compatibility. They must not become a second source of authoritative winner logic or silently re-enable monitoring for passive Wishlist items. Hosted FateFind monitoring and account state are owned by FateDrop ID/Cloud.