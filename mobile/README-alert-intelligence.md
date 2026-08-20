# Canonical alert intelligence

This feature branch keeps the known-good mobile rescue baseline intact while validating the canonical FateDrop alert inbox.

The Alerts screen reads authenticated canonical signals from the FateDrop website API, displays item price, delivered price when known, RRP delta, and a same-product best-offer verdict. Unknown delivery is never treated as free delivery. Push-open routing accepts a canonical `alertId` so the selected signal also drives the existing Companion reaction mapping.

This file is branch documentation only and can be omitted when the implementation is squashed or merged.
