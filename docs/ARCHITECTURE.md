# FateDrop architecture

## Current runtime

- `mobile/` is an Expo SDK 54 / React Native application using Expo Router and strict TypeScript.
- Device-owned state currently uses AsyncStorage for event saves, watchlist keys and the Expo push token.
- `server/` is a local Express API backed by JSON files in `data/`.
- `monitor/` contains retailer collectors, lifecycle comparison, event generation and the automatic worker.
- There is no production database, user authentication or retailer administration backend yet.

## Domain boundary

New network functionality uses the models in `mobile/types/domain.ts`. A canonical `Product` describes the underlying item. A `ProductOffer` describes a retailer-specific listing, price, shipping and availability. These concepts must remain separate.

Priority 1 extends that model with shopping lists/allocations, structured product requests/responses and anonymised demand aggregates. It deliberately reuses canonical products and offers. See `PRIORITY_ONE.md` for algorithm, privacy and backend-readiness boundaries.

`CatalogueRepository` is the client-facing data boundary. `ApiCatalogueRepository` adapts the existing flat product records without rewriting or deleting historical catalogue data. A hosted API or database implementation can replace this repository later.

## Legacy compatibility

Existing records are offer-shaped. Their stable offer identifier is `retailerKey:sku`. Canonical IDs derived from titles are provisional and conservative; production matching must use the dedicated matching service and confidence rules before offers are grouped.

## Known constraints

- `/api/products` still returns the complete catalogue and must gain server pagination before network-wide catalogue UI is expanded.
- The development API fallback is a LAN address. Configure `EXPO_PUBLIC_API_BASE_URL` for each environment.
- Push notifications require an EAS project ID and a development/production build on Android; Expo Go does not provide remote push support.
- Feature flags keep backend-dependent screens hidden until their contracts are genuinely available.
