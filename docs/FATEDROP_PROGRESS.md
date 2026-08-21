# FateDrop Product Progress

Last updated: 2026-08-20

This file is the working source of truth for product/engineering progress. A task is only marked complete when the implementation exists. Physical-device verification remains separate where required.

## Product truth

### Core purpose
FateDrop is a TCG intelligence platform that helps collectors understand what is moving, find where products can actually be bought, compare the true delivered cost against RRP, and discover independent TCG retailers.

### Core launch pillars
1. **Know first** — early signal intelligence and confirmed drops.
2. **Pay smarter** — RRP, markup and true delivered-price context.
3. **Find more places to buy** — broader independent-retailer discovery.

### Signal vocabulary
- **Echo** — early movement / precursor intelligence. Not confirmed stock.
- **Manifested** — confirmed availability / confirmed stock event.
- **Vanished** — observed availability has gone.
- **FateMatch** — an observed offer satisfies a user's hosted FateFind.
- **Major** — a separately qualified high-value/significant confirmed event. Celebrate is reserved for this state.

### Companion role
The intelligence is the product. The Companion is the reactive interface/personality layer that communicates that intelligence visually.

### Fate Encounters / Events
Events is a separate UK-wide TCG event-discovery product surface. It should contain upcoming card shows, conventions, tournaments, trade nights, prereleases and similar events across the UK, including date/time, location, entry price and booking/official links. Events are not the signal-alert feed.

---

## Companion + Alerts V1

| ID | Task | Status | Notes |
|---|---|---|---|
| CA-01 | Final visual polish of KAEL | IN PROGRESS | Native textured render now substantially improved; final polish remains. |
| CA-02 | Final visual polish of NYRA | IN PROGRESS | Native textured render now substantially improved; final polish remains. |
| CA-03 | Verify all 7 KAEL clips on physical iPhone | TODO | Idle, Notice, Echo, Manifested, Celebrate, Walk, Run. |
| CA-04 | Verify all 7 NYRA clips on physical iPhone | TODO | Idle, Notice, Echo, Manifested, Celebrate, Walk, Run. |
| CA-05 | Extract signal classification into one shared module | IN PROGRESS | `mobile/lib/signal-presentation.ts` added. Alerts uses it; Home migration remains. |
| CA-06 | Canonical signal -> Companion reaction mapping | COMPLETE | Uses Companion reaction contract; Echo/Manifested/Major remain distinct. |
| CA-07 | Persistent My Companion preference | COMPLETE | KAEL/NYRA selection stored with AsyncStorage via CompanionProvider. |
| CA-08 | Companion renderer on Alerts | IN PROGRESS | Live 3D Companion now rendered on Alerts. Dedicated compact layout still needs refinement. |
| CA-09 | Turn Alerts into Recent Signals / alert inbox | IN PROGRESS | Real network signal feed added; canonical personal alert-history API still required. |
| CA-10 | Populate Alerts from current event feed | COMPLETE (V1) | Uses existing `/api/events` transitional source. |
| CA-11 | Echo selection triggers Echo animation | COMPLETE (CODE) | Needs physical-device verification. |
| CA-12 | Manifested selection triggers Manifested animation | COMPLETE (CODE) | Needs physical-device verification. |
| CA-13 | Vanished uses Notice animation path, not Celebrate | COMPLETE (CODE) | Renderer maps `vanished` to Notice. Needs physical-device verification. |
| CA-14 | FateMatch uses Notice animation path | COMPLETE (CODE) | Selecting a FateMatch sends `fatematch`; renderer maps it to Notice. |
| CA-15 | Define qualification rules for Major alerts | TODO | Do not infer Major casually. Requires explicit product rule. |
| CA-16 | Reserve Celebrate for Major alerts | COMPLETE | Contract enforced by reaction mapping. |
| CA-17 | Show selected signal product/retailer/status/time by Companion | COMPLETE (V1) | Implemented on Alerts. |
| CA-18 | Show RRP / delivered-price context when supplied by event | COMPLETE (V1) | Conditional UI support added; backend event coverage may not yet supply all fields. |
| CA-19 | Companion response copy per signal state | COMPLETE (V1) | Echo, Manifested, Vanished, Major and generic network copy added. |
| CA-20 | Read/unread alert state | TODO | Requires canonical user alert records. |
| CA-21 | Expanded alert-detail view | TODO | Define after alert-feed V1 is device-tested. |
| CA-22 | Push notification opens corresponding Alert | TODO | Current root notification handler still opens product URL. |
| CA-23 | Push-open immediately triggers correct Companion state | TODO | Depends on CA-22 + canonical alert identifier. |
| CA-24 | Physical-iPhone verification of KAEL Alerts experience | TODO | Required before declaring alert Companion production-ready. |
| CA-25 | Physical-iPhone verification of NYRA Alerts experience | TODO | Required before declaring alert Companion production-ready. |
| CA-26 | Performance test signal feed + 3D renderer | TODO | Expo Go / iPhone test required. |
| CA-27 | Alerts Companion UX/accessibility polish | TODO | After functional device test. |

---

## Canonical Alerts Backend

| ID | Task | Status |
|---|---|---|
| AL-01 | Define canonical FateDrop alert/event schema | TODO |
| AL-02 | Standardise signal vocabulary across App/Web/Discord | IN PROGRESS |
| AL-03 | Store canonical signal stage | TODO |
| AL-04 | Associate alert with product identity | TODO |
| AL-05 | Associate alert with retailer | TODO |
| AL-06 | Store detected timestamp | TODO |
| AL-07 | Store delivered price / RRP context | TODO |
| AL-08 | Store FateFind/FateMatch relationship | TODO |
| AL-09 | Store delivery-channel state | TODO |
| AL-10 | Create canonical user alert-history API | TODO |
| AL-11 | Move mobile Alerts off transitional `/api/events` source | TODO |
| AL-12 | Connect website Alerts to canonical data | TODO |
| AL-13 | Connect Discord to canonical signal classification/data | TODO |

---

## Fate Encounters — UK TCG Events

### Data foundation
| ID | Task | Status |
|---|---|---|
| EV-01 | Define UK event schema | TODO |
| EV-02 | Event name | TODO |
| EV-03 | Event category/type | TODO |
| EV-04 | Supported TCG(s) | TODO |
| EV-05 | Start date/time | TODO |
| EV-06 | End date/time | TODO |
| EV-07 | Venue name | TODO |
| EV-08 | Full location/postcode | TODO |
| EV-09 | Town/city/region | TODO |
| EV-10 | Entry price | TODO |
| EV-11 | Correct free-event handling | TODO |
| EV-12 | Booking/ticket URL | TODO |
| EV-13 | Official event/info URL | TODO |
| EV-14 | Organiser | TODO |
| EV-15 | Description | TODO |
| EV-16 | Legally usable image/logo | TODO |
| EV-17 | Source attribution | TODO |
| EV-18 | Last-verified timestamp | TODO |

### UK coverage
| ID | Task | Status |
|---|---|---|
| EV-20 | Identify major UK card-show organisers | TODO |
| EV-21 | Identify UK TCG conventions | TODO |
| EV-22 | Pokémon competitive/event coverage | TODO |
| EV-23 | Magic event coverage | TODO |
| EV-24 | Yu-Gi-Oh! event coverage | TODO |
| EV-25 | One Piece event coverage | TODO |
| EV-26 | Lorcana event coverage | TODO |
| EV-27 | Other supported TCG event coverage | TODO |
| EV-28 | Independent-shop tournaments/prereleases | TODO |
| EV-29 | Card fairs / collector shows | TODO |
| EV-30 | Repeatable event discovery/import process | TODO |
| EV-31 | Cancellation/reschedule handling | TODO |
| EV-32 | Automatically expire completed events | TODO |
| EV-33 | Event deduplication | TODO |

### App experience
| ID | Task | Status |
|---|---|---|
| EV-40 | Upcoming-events list | FOUNDATION EXISTS |
| EV-41 | Chronological ordering | TODO |
| EV-42 | Filter by TCG | TODO |
| EV-43 | Filter by event type | TODO |
| EV-44 | Filter by UK region/location | TODO |
| EV-45 | Free/paid filter | TODO |
| EV-46 | Event card shows price clearly | TODO |
| EV-47 | Event card shows location clearly | TODO |
| EV-48 | Event card shows date/time clearly | TODO |
| EV-49 | Tickets / Book action | TODO |
| EV-50 | Official event-page action | TODO |
| EV-51 | Full event detail | TODO |
| EV-52 | Nearby events via location/Local Radar | TODO |
| EV-53 | This weekend view | TODO |
| EV-54 | Upcoming near me view | TODO |
| EV-55 | Empty-state handling | TODO |

---

## Guardrails

- Do not call an Echo confirmed stock.
- Do not use Celebrate for routine alerts.
- Do not fabricate live activity when the source is empty.
- Do not present transitional infrastructure as production-complete.
- Do not let the Companion become the core USP; it communicates the intelligence.
- Do not mix Fate Encounters with stock/signal Alerts.
- Prefer one shared signal vocabulary and one canonical event record across App, Web and Discord.
