# Catalogue import

CSV is the first supported import contract. The template is `docs/catalogue-import-template.csv`.

Rows are validated before any write. Required fields are `retailer_sku`, `title`, `category`, `price_gbp`, `stock_status`, `product_url`, and `updated_at`. Product URLs must use HTTPS. Invalid prices, duplicate retailer SKUs, missing required fields and unsafe URLs are returned as row-level errors and are never silently discarded.

Create/update identity uses retailer SKU. A canonical product URL may be used as a secondary identity in a future hosted implementation. Shopify, WooCommerce and generic JSON/XML adapters are typed but disabled until legitimate retailer credentials and endpoints are configured. Secrets must remain server-side.
