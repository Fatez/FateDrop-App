# FateDrop Product Spec v1 — Mobile

This document is the mobile implementation authority. Shared Web/Cloud behaviour must use the same product meanings and canonical FateFind/Fate Verdict intelligence.

## Locked collector navigation

The five primary navigation positions are:

1. Home
2. Alerts
3. FateDrop centre action
4. Network
5. Profile

The centre FateDrop action opens three jobs:

- FateFind
- FateMatches
- Search live database

Do not add a new primary tab for every feature. Do not introduce a separate user-facing True Price tool beside FateFind.

## Canonical collector model

### Search — browse

Search answers: **“What is available?”**

- Search connected retailer catalogues, including participating independents.
- Show genuinely comparable offers.
- Show retailer, stock, item price, verified RRP/reference and item-price difference from that reference.
- Show delivery only when known.
- Show True Price when mandatory purchase costs are known.
- Allow direct retailer checkout.
- Search does not independently own the canonical winner decision and does not start monitoring by itself.

### Wishlist — remember

Wishlist answers: **“Remember this item for me.”**

- Passive collector interest.
- Saving an item must not silently enable monitoring or notifications.
- A Wishlist item can later launch FateFind.
- FateDrop ID/Cloud sync is the desired persistence model; legacy local storage may remain during migration.

### FateFind — find this for me

FateFind is a flagship FateDrop tool and the branded home of the True Price/value model.

It combines immediate intelligent search with optional hosted monitoring:

1. Resolve correct/equivalent product identity and configuration.
2. Establish a verified RRP/reference. Never fabricate one.
3. Scale the RRP/reference correctly for quantity/bundles.
4. Compare item price against that verified basis and expose £/% above or below it.
5. Keep delivery/mandatory fees separate from the RRP calculation.
6. Calculate visible True Price when mandatory purchase costs are known.
7. Use stock/freshness/retailer evidence as appropriate.
8. Return one canonical Fate Verdict from FateDrop Cloud.
9. If the user sets acceptable conditions and nothing qualifies now, keep the FateFind active in Cloud until a qualifying observed offer appears.

A hosted FateFind may include:

- product/query
- quantity/configuration where relevant
- maximum item price
- maximum True Price
- RRP only/below RRP/maximum percentage above RRP
- stock requirement
- online/local/retailer preferences
- notification channels
- chosen companion for the personal result alert

### True Price — visible evidence inside FateFind

True Price remains visible because it answers a separate customer question from RRP position:

- **RRP/reference position:** Is the retailer's item price fair for this exact configuration?
- **True Price:** What will actually leave the customer's bank account once known mandatory delivery/fees are included?

Rules:

- RRP % uses item price only.
- True Price includes known mandatory purchase costs.
- Unknown delivery stays UNKNOWN/provisional; never convert it to £0/free.
- True Price is not a competing navigation destination or separate winner engine.

### Fate Verdict — explain the answer

Fate Verdict is the canonical explanation produced by the shared FateFind intelligence engine.

App and Web must render the same Cloud-owned verdict. Clients may format/sort presentation data but must not independently calculate different authoritative winners.

### FateMatch — FateFind succeeded

FateMatch answers: **“We found it.”**

- FateMatch is an outcome/event, not another configurator or advanced Wishlist.
- The user creates a FateFind, not a FateMatch rule.
- When an observed offer satisfies an active FateFind, the successful result becomes a FateMatch.
- FateMatch surfaces show successful results/history and may also show the active FateFind that produced them.

Canonical journey:

**Search → Wishlist (optional) → FateFind → FateMatch → Buy**

Canonical sentence:

> You create a FateFind. FateDrop searches the network. When the conditions align, you receive a FateMatch.

## Companion system

A user may choose which companion delivers a personal FateMatch created by their FateFind:

- Koru
- Fenn
- Oru
- Nyxen

This is an alert presentation preference and does not change the companions' locked network lifecycle roles:

- Whisper → Oru
- Echo → Fenn
- Manifested → Koru
- Vanished → Nyxen

Companions provide personality and presentation around real evidence; they must never imply evidence the system does not have.

## Network lifecycle intelligence

These describe what FateDrop itself is observing across the network and remain separate from personal FateFind/FateMatch intent:

- **Whisper / Oru** — earliest credible precursor evidence; not a guarantee of stock.
- **Echo / Fenn** — stronger developing signal/evidence.
- **Manifested / Koru** — confirmed meaningful live availability/event.
- **Vanished / Nyxen** — previously confirmed availability has disappeared.
- **Drop Pulse** — contextual evidence badge, not a lifecycle state or navigation destination.

Precision, freshness, duplicate prevention and honest uncertainty are more important than notification volume.

## Collector screen responsibilities

### Home

Shows the FateDrop network heartbeat:
- recent Manifested
- meaningful Echo/Whisper where evidence supports it
- useful Vanished/price movement
- important personal FateFind/FateMatch context where appropriate
- one useful upcoming Fate Encounter/local card
- companion presentation without obscuring data

### Alerts

Personal notification surface:
- lifecycle alerts delivered to this user
- FateMatch results
- notification preferences/channel settings
- deep links into the relevant product/FateFind/FateMatch

Do not turn Alerts into a second global Network feed.

### FateFind

Primary intelligent value/hunt experience:
- search product
- compare equivalent configurations
- show verified RRP/reference and scaling basis
- show item-price £/% position
- show delivery evidence
- show visible True Price
- render one Cloud Fate Verdict
- save product passively to Wishlist
- configure/activate a persistent FateFind
- choose the companion who will deliver the resulting FateMatch
- buy directly from retailer when a suitable current offer exists

### FateMatches

Outcome/history surface:
- active FateFinds still searching
- recent successful FateMatches
- direct route to the matched retailer offer
- do not present a second independent watch-rule builder

### Network

Discovery/network layer:
- participating independent retailers and storefronts
- Local Radar
- retailer/network discovery
- Fate Encounters/events where appropriate
- transparent retailer evidence; no subjective paid ranking disguised as quality

### Profile

Account/identity layer:
- FateDrop ID
- membership/entitlements
- Wishlist access
- preferences
- companion/account settings as appropriate
- sign-in/sync state

## Backend / retailer-only systems

Keep implementation but do not promote to ordinary collectors:
- retailer analytics
- retailer plans / entitlements
- catalogue import
- monitor health/orchestration
- outbound attribution
- feature flags
- demand aggregation

Legacy internal names such as `/api/fate-matches`, `fatedrop_fate_matches` or `advanced_fate_match` may remain temporarily for compatibility. They must not leak into user-facing product semantics: persisted rules are FateFinds; qualifying observed hits are FateMatches.

## Hold / future

Keep foundations, hide from launch navigation unless deliberately enabled later:
- FateScore public UI
- FateFair
- FateWindow
- Reserve & Collect
- Basket Breaker / future Optimise Basket
- Demand Signal collector UI
- FateBounty / Priority One
- Passport/progression/tokens/XP
- Event Vendor Mode prominence

## Implementation rules

- FateDrop Cloud / Signal Engine is canonical network/value truth.
- Do not invent stock, RRP, delivery, urgency, retailer verification or network metrics.
- Preserve correct product identity/configuration before comparing value.
- Keep retailer checkout external to FateDrop.
- Preserve existing data when hiding/moving experimental features; do not destructively delete foundations.
- Feature status must be explicit where relevant: LIVE, BETA, DEMO, FOUNDATION, PLANNED or HOLD.