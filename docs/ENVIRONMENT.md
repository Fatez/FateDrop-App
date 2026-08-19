# Environment and platforms

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to the reachable FateDrop API origin. This value is public and embedded in the Expo bundle; never place secrets in an `EXPO_PUBLIC_` variable.

The current Express/JSON server has no production authentication or tenant isolation and must not be exposed as a retailer administration API. Shopify, WooCommerce and generic-feed credentials belong in a future hosted server environment.

## Android and iOS

Run `npm run server` from the repository root, then `npm start` from `mobile/`. A physical phone must be on a network that can reach the configured API URL. Location is requested only from Local Radar. Remote Expo push requires an EAS project ID and a development/production build; local notification previews work without it.
