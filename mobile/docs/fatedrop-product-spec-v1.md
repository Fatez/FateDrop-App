# FateDrop Product Spec v1 — Mobile

This document is the mobile implementation authority aligned with the frozen FateDrop Web Product Spec v1.

## Locked collector navigation

The five primary tabs are:

1. Home
2. Search
3. Indies
4. Alerts
5. More

Do not add a new primary tab for every feature.

## Core collector jobs

### Find
- Search / Catalogue — CORE
- Search across all connected retailers, including participating independents.
- Product-first journey: search → product → offers → retailer checkout.

### Compare
- Compare Offers — CORE
- True Price — CORE
- Official RRP comparison — CORE
- Sort transparently by delivered cost where delivery is known.
- Unknown delivery remains unknown and must not be treated as free.

### Watch
- Universal Wishlist — KEEP
- FateFind — KEEP / premium candidate
- FateFind = the hunt the collector creates.
- FateMatch = a successful observed result satisfying a FateFind.
- Wishlist = I want this product; FateFind = actively hunt this under conditions.

### Detect
- Echo — public early/precursor intelligence; never a guarantee of stock or a drop.
- Manifested — confirmed meaningful availability/restock/event.
- Vanished — previously confirmed availability lost.
- Whisper — internal engine terminology only.
- Drop Pulse — contextual evidence badge, not a lifecycle state or destination.

### Discover
- Indies — CORE to the business model.
- Retailer storefronts — KEEP.
- Verified retailer status — objective identity/catalogue relationship only.
- Local Radar — KEEP, secondary.
- Events / Fate Encounters — KEEP.
- Event Vendor Mode — keep foundation, hide from the standard launch journey until meaningful vendor adoption exists.

### Receive
- Alerts — CORE, personal notification/hunt surface.
- Global Network Activity belongs on Home.
- Companion — identity + alert presentation layer, not a competing navigation pillar.
- Discord — delivery/community extension, not a second app UI.

## Collector screen responsibilities

### Home
Shows the FateDrop network heartbeat:
- recent Manifested
- meaningful Echo
- useful Vanished/price movement where relevant
- important FateFind activity
- one useful upcoming Fate Encounter/local card
- Companion reactions as the presentation layer grows

### Search
The main utility:
- search products
- group equivalent products
- compare retailer offers
- show price / RRP / markup
- show known postage / True Price
- save to Wishlist
- create FateFind
- buy directly from retailer

### Indies
- participating retailers
- retailer storefront/profile
- local discovery entry points
- catalogue/offers where connected
- no subjective paid ranking

### Alerts
Personal only:
- active FateFinds
- FateMatch history
- product/stock alerts sent to this user
- alert preferences
- delivery channel settings

Do not duplicate the global Network Activity feed here.

### More
Secondary collector tools only:
- Wishlist
- FateFind
- True Price explainer/deeper comparison
- Local Radar
- Events / Fate Encounters
- Companion/account/membership/settings when available

Backend/admin/retailer tooling must not appear in the normal collector More menu.

## Backend / retailer-only systems

Keep implementation but do not promote to ordinary collectors:
- retailer analytics
- retailer plans / entitlements
- catalogue import
- monitor health
- monitor orchestration
- outbound attribution
- feature flags
- demand aggregation

## Hold / future

Keep foundations, hide from launch navigation unless deliberately enabled later:
- FateScore public UI
- FateFair
- FateWindow
- Reserve & Collect
- Basket Breaker / future Optimise Basket
- Demand Signal collector UI
- FateBounty / Priority One
- Passport
- progression / tokens / XP
- Event Vendor Mode prominence

## Implementation rules

- Cloud / Signal Engine should become the canonical network truth.
- Do not invent stock, RRP, delivery, urgency, retailer verification or network metrics.
- Keep retailer checkout external to FateDrop.
- Preserve existing data when hiding or moving experimental features; do not destructively delete foundations.
- Feature status must be explicit: LIVE, BETA, DEMO, FOUNDATION, PLANNED or HOLD.
