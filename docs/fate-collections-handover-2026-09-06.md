# Fate Collections handover — 6 September 2026

Continue on `feat/fatecollections-ui-artwork-v2-2026-09-05`, App PR #192.
This extends `28da53cb03856c143e99f0d743d90c549348db47`; it does not replay old branches.

## Shipped in this update

- The five supplied design references guide the Collections dashboard, Personal Collection, Binders, binder detail and Graded cabinet. Starfield, serif headings, gold borders, orbital details and the existing FateDrop navigation are retained.
- The three separate transparent PNGs supplied by the owner are committed unchanged as `mobile/assets/images/fate-collections-{personal,binder,graded}.png`, and used by the shared artwork component. No image generation or brand reinterpretation.
- The dashboard keeps the three section tiles and the value overview. Combined value comes from the server; known ungraded and graded amounts are shown separately. Binder value is already included, never added twice.
- The Collections dashboard is compacted against the approved reference: smaller section artwork, shorter value and metric panels, aligned tile footers, clearer metric dividers and an earlier Collection Pulse handoff.
- Building checklists remain in the binder index. Search and Progress/Name sorting work. Completed means an available, non-empty, fully owned checklist.
- The preview-first Collectr CSV import now lives only in Binders. Confirmed exact raw cards update their matching binder progress; ambiguous and unresolved rows remain held. Personal Collection no longer presents the import entry point.
- Binder detail adds search, Number/Name sorting, an interleaved All view, server-supplied set values and direct Add Owned. Same-identity copies share a pocket; distinct variants remain distinct. Slabs never enter these pockets.
- Personal Collection and binder card rows read exact FatePrice quotes in GBP independently of the top-three movers. The lists are virtualised to limit off-screen image/quote work. An unsupported global value sort is removed.
- Graded sorting says Grader/Grade/Name and follows that choice. A link to an ungraded FatePrice is explicitly labelled an ungraded reference; no raw-price fallback for a slab.
- Signed-out users retain the account entry point. Shared loading state rejects responses from previous owners, routes and focus sessions. Adding/importing is guarded against repeated taps; an incomplete CSV preview cannot be confirmed.
- Mobile labels are larger and controls have more space. The existing bottom navigation now covers the Collections routes.

## Verification and remaining work

- Repository suite: 353/353 tests passed after the visual compaction and Collectr import move.
- Expo lint and TypeScript passed after the same final changes; check PR CI again after the remote commit.
- New behaviour tests cover unknown checklists, retained building binders, numeric ordering, duplicate quantities, graded exclusion, search, and exact GBP quotes.
- Native visual inspection is still required against the supplied screenshots. This repository excludes web from its supported Expo platforms, so a browser preview was not enabled or claimed as a native check.

## Existing data boundaries

- Exact per-slab valuation/history and graded top-three movers need their own server response. Current UI keeps them visibly unavailable/building. No invented amounts, authenticated-certificate claims or raw-price substitution.
- Full-set, owned-set and missing-set values remain unavailable wherever the server has no printing valuations. Missing previews are labelled checklist previews, not ranked by value.
- Personal best/worst set rankings and a value-sorted missing-card top three still need complete server rankings. Do not derive them from truncated global top-three lists.
- Artwork on actual trading cards requires an image URL supplied with the exact identity. Otherwise show the existing neutral placeholder.
- Collection reads retain the existing 2,000-entry API cap; full pagination and value sorting across larger collections remain follow-up work.

No Cloud changes, production data writes, deployment, or merge are part of this update.
