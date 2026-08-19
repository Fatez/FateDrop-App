# Priority 1: commercial core

## Architecture and readiness

Basket Breaker reuses canonical product identifiers and `ProductOffer` records. Shopping lists use the versioned `fatedrop:shopping-lists:v1` AsyncStorage boundary; invalid records are ignored and writes are validated. Calculation is performed by the bounded, deterministic server engine in `server/basket-breaker.js`, outside React render paths. Purchases remain individual tracked HTTPS actions to retailer websites.

FateBounty and Demand Signal are backend-ready foundations, not production services. Their app flags default to off, their demo API routes return 404 when `NODE_ENV=production`, and every development record is fictional and labelled. Production requires authentication, retailer tenancy, moderation/rate limits, durable transactional storage, notifications, audit logs, and consent/retention controls.

## Basket algorithm

For each list item, the engine filters offers by canonical identity, stock state, condition, preorder preference, unit-price cap, retailer exclusions, verification and collection requirements. It sorts candidates deterministically, keeps at most 12 per item, expands allocations subject to the one-store/maximum-retailer constraint, and retains at most 5,000 partial states at each step. Each complete state is scored separately for lowest subtotal, lowest known delivered total, fewest retailers, collection focus and balanced cost/store count.

Shipping is calculated once per retailer allocation. An evidenced free-shipping threshold makes delivery zero only when the retailer subtotal reaches it. Missing shipping remains unknown, never zero; such a solution has no delivered total and is labelled `MATERIAL_SHIPPING_UNKNOWN`. Missing products produce a partial solution. This bounded search is responsive for realistic lists and 10,000 input offers, but it is intentionally an approximation when candidate or state caps are reached.

## FateBounty privacy and workflow

The public retailer transform includes product criteria, capped prices, broad region only when collection is relevant, fulfilment and expiry. It excludes name, email, precise address and exact location. Matching requires known delivery when a delivered-price cap is present. The service rejects duplicate active responses for the same request/retailer/offer. Production must additionally enforce authenticated verified-retailer access, per-retailer response limits, blocking/reporting, immutable accepted-price snapshots and re-confirmation after price changes.

## Demand Signal privacy

Signals are deduplicated per anonymous user, action, product and UTC day before aggregation. Output uses product/action/broad-region cohorts. Cohorts below the configurable minimum (five in development) are marked `INSUFFICIENT`, with their signal count suppressed. The aggregator distinguishes `REAL`, `DEMO` and `INSUFFICIENT`; no metric is fabricated. Production must add consent-aware ingestion, bot/abuse scoring, retention windows and server-side tenant authorization.

Entitlements are central: Free has no Demand Signal data, Indie has `DEMAND_SIGNAL_BASIC`, and Indie Pro adds `DEMAND_SIGNAL_DETAILED` and `BOUNTY_RESPONSES`.

## Production checklist

- Basket Breaker is usable against connected catalogue data, subject to retailer shipping completeness.
- FateBounty needs accounts, retailer verification enforcement, moderation, rate limits, notifications and persistent APIs.
- Demand Signal needs a consented event pipeline, stable anonymous identity, abuse controls and a hosted aggregation store.
- No new credentials, environment variables or database migrations are required at this checkpoint.
- Local storage migration is additive: the new v1 key does not alter or delete wishlist/FateFind data.
