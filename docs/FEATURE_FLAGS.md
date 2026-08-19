# Feature flags

Central flags live in `mobile/constants/features.ts`.

Priority 1 adds `basketBreaker` (enabled) plus `fateBounty` and `demandSignal` (disabled until authenticated production services exist). All later requested flags are declared centrally but remain disabled; declaring a flag does not expose its route.

- `localRadar`, `eventVendorMode`, `retailerAnalytics`, `catalogueImport`, `dropPulse`, `fateScore` and `reserveAndCollect` currently expose working app or clearly marked development experiences.
- `passport` remains disabled and non-prominent.

Flags indicate UI availability, not production backend readiness. Event vendors, reservations and some retailer tooling are labelled demo/development where applicable.
