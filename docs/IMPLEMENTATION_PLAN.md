# Independent retailer network implementation plan

1. Domain and service foundation: strict models, feature flags, environment configuration, legacy adapter and repository boundary.
2. Scalable catalogue API: query validation, pagination, compact responses, caching metadata and typed client hooks.
3. Indies network: retailer directory, storefront routes, catalogue filters and explicit tracked retailer actions.
4. True Price: conservative matching, shipping-aware comparisons and tests.
5. FateFind and universal wishlist: persisted versioned schemas, migration, local matching and backend-ready alert interfaces.
6. Local Radar and Event Vendor Mode: permission-on-demand location adapter, list fallback and expiring event inventory.
7. Trust and intelligence: FateScore evidence states and tested Drop Pulse rules.
8. Retailer operations: reservation interface, CSV validation/preview, adapter contracts, outbound analytics and entitlement checks.
9. Passport foundation and final production-readiness review.

Every increment must pass mobile TypeScript/lint and configured Node tests. Backend-dependent features remain disabled through central feature flags until their real service exists.
