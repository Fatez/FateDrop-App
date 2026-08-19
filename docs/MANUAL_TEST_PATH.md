# Principal manual test path

Start the API from the repository root with `npm run server`. In a second terminal, change to `mobile` and run `npx expo start --clear`. Open the QR code in an SDK 54-compatible client, or select an Android/iOS development build.

1. **Home:** confirm the live tracked-product, retailer and in-stock totals load and no invented activity appears when the event feed is empty.
2. **Search:** search `Destined Rivals`, switch category and availability filters, paginate, bookmark an offer and open its retailer-specific HTTPS buy link.
3. **Indies:** filter online/physical, verified and collection stores. Open a retailer, inspect trust/delivery fallbacks and browse its paginated catalogue.
4. **More → True Price:** compare a shared product. Confirm unknown shipping is not labelled cheapest, free-delivery thresholds appear when supplied, and canonical-product saves reach Wishlist.
5. **More → FateFind:** create and edit a capped search, request matches, verify the local/API source label, then toggle alerts from Wishlist.
6. **More → Local Radar:** first use postcode fallback, then request device location. Deny permission once to confirm the list remains usable; inspect an event and a nearby demo shop.
7. **More → Fate Encounters:** open an event, save it, schedule a reminder, open tickets/directions, and enter its vendor inventory.
8. **More → Event Vendor Demo:** search temporary inventory, open a vendor, save an item and confirm event stock is labelled demo/scoped.
9. **More → Retailer Dashboard:** validate the documented CSV template and inspect row errors, mapping, import preview, real recorded analytics and unavailable metrics.
10. **More → Reserve & Collect Demo:** submit a request, confirm it remains pending rather than falsely confirmed, then cancel it.
11. **More:** inspect retailer health and send a local test stock alert. Remote push requires the EAS/project setup documented in `ENVIRONMENT.md`.

Also verify compact layouts on a small Android viewport and a modern iPhone viewport, including safe areas, keyboard entry, list scrolling and bottom-navigation labels.
