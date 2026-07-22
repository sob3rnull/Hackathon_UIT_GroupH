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
| `/` | 119 dispatcher | Voice/text intake → AI triage → assign ambulance → rank hospitals → dispatch |
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

**Ambulance position** — from an on-board IoT unit reporting GPS to
`/api/ambulances/[id]`. **Certification is the gate:** a vehicle without a fitted
device reports no position, cannot be tracked, and is therefore never dispatchable —
even when it is the closest vehicle to the patient. A GPS fix older than 10 minutes
is treated as no fix at all, because dispatching on a stale position is worse than
not dispatching.

---

## How a recommendation is produced

**1. Triage** (`src/lib/mediroute/triage.ts`)

Free-text paramedic note → `{ condition, severity, requiredSpecialty, needsICU,
redFlags, confidence }`. Two paths, identical output shape:

- **Claude** via structured outputs — schema-guaranteed, no JSON parsing.
- **Keyword matcher** — used when `ANTHROPIC_API_KEY` is missing or the call fails.

The UI always states which one ran. Fallback output is never presented as AI.
`redFlags` carries the findings that drove the call, so the dispatcher can trace the
decision back to the note.

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

- **Voice input is the one part that needs the network.** `SpeechRecognition` streams
  audio to the browser vendor, and it is Chrome/Edge only. Everything else in
  MediRoute works offline; this doesn't. The typing field is always visible and is the
  fallback — demo the voice path first, but never make it load-bearing. A real
  in-ambulance device would want an on-device model anyway (noisy cabin, no
  connectivity, and clinical audio shouldn't leave the vehicle).

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
