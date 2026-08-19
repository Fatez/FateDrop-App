# FateFind, wishlist and alerts

FateFind persists versioned searches locally and matches query, price, delivered-price, retailer, condition, category, preorder, collection and stock constraints. Delivered-price caps require a known delivery price. Match fingerprints prevent duplicate local alerts.

The current FateFind screen explicitly labels matches as local development behaviour. Continuous server-side FateFind monitoring is not available until a hosted authenticated backend exists.

Legacy watchlist keys are copied into the universal wishlist schema. They are not deleted. Unresolved and sold-out items remain saved. Existing server stock push notifications are scoped to the device token's offer keys. Android remote push requires an EAS development or production build.
