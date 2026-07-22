# MediRoute — AI-Assisted Emergency Hospital Routing

Recommends the best hospital for an incoming ambulance — not the *nearest*, but the
nearest one that is actually **available and equipped** to treat this patient.

Group H · UIT — 24-hour hackathon build.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine unit tests — run these before you trust a ranking
```

The app runs with **no configuration at all**: blank env vars give you an in-memory
hospital store and keyword triage. Add keys to upgrade each piece independently.

---

## The three screens

| Route | Who | What |
|---|---|---|
| `/` | 119 dispatcher | Voice/text intake → speech-to-text analysis → AI triage → assign ambulance → rank hospitals → dispatch |
| `/fleet` | *(stands in for the IoT units)* | Vehicle status, GPS freshness, certification |
| `/hospital` | *(stands in for the HIS feed)* | Live bed / ICU / roster / ER capacity |

Changes on either panel re-rank `/` instantly over Supabase Realtime — no refresh, no
socket server. **Run at least one panel on a second machine during the demo.**

---

## The flow

```
119 call
   │
   ├─ dispatcher dictates or types what the caller reports
   │     ├─ speech-to-text analysis turns dictation into the patient note
   │     └─ Claude extracts { condition, severity, specialty, needsICU, redFlags }
   │
   ├─ ASSIGN AMBULANCE  ── nearest certified, available, GPS-fresh vehicle
   │     └─ response leg: ambulance → incident
   │
   ├─ RANK HOSPITALS    ── live capacity + transport time from the incident
   │     └─ transport leg: incident → hospital
   │
   └─ dispatcher confirms or overrides → hospital pre-alert
         total time to definitive care = response + transport
```

Two legs, reported separately and summed. A vehicle 1 minute away pairing with a
hospital 15 minutes out is a different clinical picture from the reverse, and the
dispatcher sees both numbers rather than one blended ETA.

---

## The backend is an n8n workflow

**Workflow:** [MediRoute API](https://dontwannacode.app.n8n.cloud/workflow/poWIRrVi6X58C8jH)
· 17 nodes · published

| Route | Does |
|---|---|
| `POST /webhook/mediroute/triage` | Claude extracts structured triage; falls back to keyword matching |
| `POST /webhook/mediroute/plan` | Reads hospitals + fleet from Supabase, runs selection and ranking |
| `POST /webhook/mediroute/dispatch` | Records the dispatch, marks the ambulance transporting |
| *Schedule, every 2 min* | IoT heartbeat — refreshes GPS fixes for reporting vehicles |

Switch the frontend between backends with one env var:

```bash
# n8n backend
NEXT_PUBLIC_MEDIROUTE_API=https://dontwannacode.app.n8n.cloud/webhook
# blank = local Next.js route handlers
NEXT_PUBLIC_MEDIROUTE_API=
```

A badge on the dispatcher says which one is live, so you always know what you're
demoing. The local routes are kept deliberately: n8n Cloud is a network
dependency, and if the venue drops it you flip one variable instead of losing
the backend.

### The two copies problem, and how it's handled

Moving ranking into an n8n Code node means the logic the tests cover is no
longer the logic that runs. Two copies of the most important algorithm in the
project would drift silently.

So there is exactly one source: [`n8n/ranking-core.js`](n8n/ranking-core.js).
That file is embedded verbatim in the workflow's Code node **and** loaded by
[`n8n-parity.test.ts`](src/lib/mediroute/n8n-parity.test.ts), which asserts it
returns the same scores, ordering, reasons and rejection strings as the
TypeScript engine across every severity, ICU flag and edge case. Change one,
change both, re-run `npm test`, redeploy.

Verified live: for the seeded critical-cardiac scenario, n8n and the local
engine both return Thingangyun Sanpya at `0.619` and North Okkalapa at `0.269`,
with identical exclusions.

### Before the AI triage route works

The Claude node is currently **disabled**, because its credential is a
placeholder — the workflow could not be published with it enabled, and the API
key is yours to enter, not something to hand round. Until then the triage route
answers with the keyword fallback and says so.

To turn it on: add an Anthropic credential in n8n, then enable
**Extract Triage With Claude** and publish. A disabled node passes data through,
which is why the route works either way.

---

## Google Maps Platform — keys and cost control

Two keys, opposite rules:

| Key | Env var | Visibility | Protection |
|---|---|---|---|
| Routes API | `GOOGLE_ROUTES_API_KEY` (+ inside n8n) | Server-side secret | Never `NEXT_PUBLIC_`; API-restrict to Routes API |
| Maps JavaScript | `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | **Public by design** — ships in the bundle | HTTP-referrer restriction (localhost + deploy domain) + API-restrict to Maps JS. **Set this in Cloud Console; it is the entire security model for this key.** |

Blank either one and the app degrades gracefully: no Maps key → offline SVG map;
no Routes key → haversine ETAs.

**Cost guards built into the code** (free tier is 10k events/month per SKU — the
$300 trial credit sits untouched behind that):

- *Maps JS bills per map instantiation*, not per interaction. The map object is
  created once per page load and only overlays update afterwards. Don't key or
  conditionally unmount `GoogleIncidentMap` — every remount is a billable load.
- *Routes bills per matrix element.* Each plan is two small matrices
  (fleet→incident, incident→hospitals: 6+6 = 12 elements), not one combined
  7×7 = 49.
- *Live re-planning is debounced 1.2s* — five rapid bed-count clicks on the
  hospital panel coalesce into one Routes call, not five.
- *Route lines are straight connectors on purpose.* The ETAs are real Routes
  times, but drawable road geometry is a separate billable call per pair —
  decoration not worth paying for.

Rough demo-day math: a full day of rehearsing ≈ tens of map loads + a few
hundred Routes elements. The free tier covers this ~50× over.

---

## Where the data comes from

**Hospital availability** — the prototype uses a table edited by hand on `/hospital`.
The real design reads it from each hospital's own information system: most Yangon
hospitals are already digitalised, so the data exists; what's missing is the
integration and the agreement to expose it.

`src/lib/mediroute/feeds/hospital-feed.ts` is the seam. The engine, API and UI all
talk to a `HospitalFeed` interface and cannot tell which implementation is behind it,
so moving one hospital from manual entry to a live feed is a config change, not a
rewrite. The production adapter is declared and documented but **deliberately not
faked** — it throws rather than returning invented data.

The hard parts there are not code: one integration per HIS vendor, a data-sharing
agreement per hospital, and a staleness policy. A dead feed must degrade to
*unknown* — never to "zero beds" (which silently hides a hospital that could help)
and never to a cached optimistic number (which sends an ambulance to a full hospital).

**Ambulance position** — from an on-board IoT unit. The units are **always
online**, reporting position continuously. **Certification is the gate:** a
vehicle without a fitted device reports no position, cannot be tracked, and is
therefore never dispatchable — even when it is the closest vehicle to the
patient. A GPS fix older than 10 minutes is treated as no fix at all, because
dispatching on a stale position is worse than not dispatching.

> That staleness rule bit during testing and is worth knowing about. The seed
> stamps `gps_fix_at` once, so ten minutes later **every vehicle was rejected as
> stale and the fleet list was empty.** The n8n schedule now refreshes fixes
> every 2 minutes, standing in for the devices' own reporting. If you re-seed
> and the fleet looks empty, that's why — check the fix ages on `/fleet`.

---

## How a recommendation is produced

**1. Triage** (`src/lib/mediroute/triage.ts`)

Free-text paramedic note → `{ condition, severity, requiredSpecialty, needsICU,
redFlags, confidence }`. Two paths, identical output shape:

- **Claude** via structured outputs — schema-guaranteed, no JSON parsing.
- **Burmese/English keyword matcher** — used when `ANTHROPIC_API_KEY` is missing or the call fails.

The UI always states which one ran. Fallback output is never presented as AI.
`redFlags` carries the findings that drove the call, so the dispatcher can trace the
decision back to the note.

Speech input defaults to Burmese (`my-MM`) and can be toggled to English in the
dispatcher intake card. Seed Burmese medical-clause examples live in
[`training/burmese-patient-situations.jsonl`](training/burmese-patient-situations.jsonl);
the schema and labeling notes are in [`training/README.md`](training/README.md).

**2. Ranking** (`src/lib/mediroute/engine.ts`) — pure function, no I/O, no clock.

```
HARD FILTERS (excluded outright, with a reason shown)
  · lacks the required specialty
  · no available beds
  · critical only: no specialist on duty, or no ICU bed when one is needed

SCORE (every term normalized 0..1, higher is better)
  travelScore = max(0, 1 - etaMinutes / 45)
  bedScore    = availableBeds / totalBeds
  doctorScore = min(specialistsOnDuty / 2, 1)
  erLoadScore = 1 - currentERQueue / erCapacity

WEIGHTS BY SEVERITY (each profile sums to 1)
  critical  travel .50  beds .20  doctors .20  erLoad .10
  urgent    travel .40  beds .25  doctors .20  erLoad .15
  stable    travel .25  beds .30  doctors .15  erLoad .30
```

If nothing survives the critical-only filters, the engine relaxes them and raises a
red banner rather than returning an empty list.

> **Why travel is scored against a fixed 45-minute reference** rather than min-max
> normalized across candidates: min-max divides by zero when only one hospital is
> eligible, which happens in the mass-casualty case.

**3. Dispatch** — the dispatcher accepts or overrides. `was_override` is derived
server-side, so the agreement statistic can't be skewed by the client. It's reported
as *dispatcher agreement*, never "accuracy" — there is no ground truth about which
hospital was actually correct.

---

## Layout

```
src/
  lib/mediroute/
    engine.ts        ← selectAmbulance + recommend (pure, tested)
    engine.test.ts   ← 27 tests incl. both seeded demo scenarios
    triage.ts        ← Claude + keyword fallback
    geo.ts           ← haversine + ETA
    store.ts         ← the only module touching storage
    feeds/
      hospital-feed.ts  ← the HIS seam: manual today, live feed later
    use-hospitals.ts ← Realtime subscription, polls when Supabase is absent
    use-fleet.ts     ← same, for ambulances
    types.ts         ← zod schemas + shared types
  components/mediroute/
    dispatcher.tsx   ← intake, triage, ambulance assignment, hospital ranking
    voice-input.tsx  ← browser SpeechRecognition, typing always available
    fleet-panel.tsx  ← stands in for the IoT units
    hospital-panel.tsx
    map.tsx          ← dependency-free SVG map, both route legs
  app/api/
    triage · ambulances · ambulances/[id] · hospitals · hospitals/[id]
    recommend · dispatch
supabase/migrations/ ← schema + seed
```

---

## Demo-day notes

- **The map is deliberately not Mapbox.** Tile maps fetch at render time, so bad
  venue wifi turns the panel into a grey box in front of judges, and they need a key
  in the client bundle. `map.tsx` projects lat/lng into an SVG: no key, no network,
  cannot fail on stage.
- **Run `/hospital` on a second machine.** Alt-tabbing to edit your own data
  undercuts the illusion that this is live inter-hospital state.
- **Run `npm test` before presenting.** The engine tests assert that the nearest
  hospital is *not* the recommendation in the seeded scenario. If that flips, the
  demo's whole thesis is broken and you want to know in the room, not on stage.
- **The offline path is real** — blank the env vars and everything still works with
  seeded data and keyword triage. Try it once before demo day so you've seen it.

- **Voice input needs the network, and so does the n8n backend.** Since the IoT
  units are always online, cloud speech is a fine production choice — the
  constraint is the demo room, not the product. `SpeechRecognition` is Chrome/Edge
  only, so the typing field stays visible as the fallback. If the venue network is
  unreliable, blank `NEXT_PUBLIC_MEDIROUTE_API` to run the backend locally; only
  voice is then unavailable.

### Seeded fleet scenario

Incident at Sule Pagoda:

| Vehicle | Response | Outcome |
|---|---|---|
| YGN-09 | ~0 min | **Rejected** — no IoT unit fitted, not certified |
| YGN-02 | ~0 min | **Rejected** — already transporting |
| **YGN-01** | **1 min** | **Assigned** — certified, available, fresh GPS |
| YGN-04 | 3 min | Available, ranked second |
| YGN-06 | — | **Rejected** — offline, GPS 2 hours stale |
| YGN-11 | 26 min | Available, ranked third |

The two vehicles physically closest to the patient are both unusable. That is the
certification argument in one screen: **fitting the device is what makes a vehicle
dispatchable at all.**

### Seeded hospital scenario (real Yangon hospitals)

Incident at Sule Pagoda, critical cardiac patient needing ICU:

| Hospital | ETA | Outcome |
|---|---|---|
| Yangon General | 3 min | **Excluded** — no available beds |
| Yangon Children's | 5 min | **Excluded** — no cardiology service |
| New Yangon General | 5 min | **Excluded** — no cardiologist on duty |
| **Thingangyun Sanpya** | **15 min** | **Recommended** — 2 cardiologists, 4 ICU beds |
| North Okkalapa | 38 min | Eligible, ranked second |
| Insein | 37 min | **Excluded** — no cardiology service |

The three closest hospitals all lose. That is the entire pitch, on one screen.

---

## Safety framing — say this out loud to judges

This is a **decision-support prototype**. It has no clinical validation, no regulatory
review, and uses no real patient data. It never auto-dispatches: the triage output is
editable and the final routing is a human decision. What it demonstrates is that
capacity-aware routing beats distance-only routing — not that it is deployable.

> ⚠️ **The RLS policies are wide open.** No auth exists, so `hospitals` and
> `dispatches` grant the anon role unconditional read/write, and the anon key ships in
> the browser bundle. Fine for fictional demo data; replace before this outlives the
> hackathon. Never put real patient information in this database.

See [PLAN.md](PLAN.md) for the build plan, cut list, and judging Q&A prep.
