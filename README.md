# WheeYaw — AI-Assisted Emergency Hospital Routing

Recommends the best hospital for an incoming ambulance — not the *nearest*, but the
nearest one that is actually **available and equipped** to treat this patient.

Group H · UIT — 24-hour hackathon build.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine + keyword-triage unit tests — run these before you trust a ranking
```

The app runs with **no configuration at all**: blank env vars give you an in-memory
hospital store, keyword triage, and a straight-line map. Add keys to upgrade each
piece independently — see [`.env.example`](.env.example).

---

## The screens

| Route | Who | What |
|---|---|---|
| `/` | Public | Hospital directory — live capacity on every card, a (demo) donation flow. First thing anyone sees, including judges. |
| `/dispatcher` | 119 call taker | Log an **optional** note + click the map for the incident, then assign the nearest dispatchable ambulance. That's the whole job. |
| `/ambulance` | Crew on board | Dictate (Burmese/English) or type the patient description, run triage themselves, pick the hospital, advance status through the run. |
| `/hospital` | *(stands in for the HIS feed)* | Live bed / ICU / roster / ER capacity |
| `/history` | Dispatcher | Every past incident, searchable, with what was recommended vs. what was chosen |
| `/fleet` | Dispatcher | Vehicle status, GPS freshness, certification |
| `/login` · `/register` | Anyone | Email/password sign-in and self-service sign-up. A new account has no role and waits on `/pending` until an admin assigns one. |

Changes on `/hospital` or `/fleet` re-rank `/dispatcher` and `/ambulance` instantly
over Supabase Realtime — no refresh, no socket server. **Run at least one panel on a
second machine during the demo.**

Once Supabase auth is enabled, the operational screens are gated by role — a crew
login can't open `/dispatcher`, a hospital login can't open `/fleet` — while `/` and
the donation flow stay public. See **Authentication & roles** below.

---

## Authentication & roles

Sign-in is **email/password via Supabase Auth**, with three roles — `dispatcher`,
`ambulance`, `hospital` — enforced at two layers:

- **Middleware** (`src/middleware.ts`) routes each session to its own dashboard and
  bounces cross-role access. UX only, not a security boundary.
- **Row Level Security** is the real enforcement. `public.profiles` holds each user's
  role + scope (which vehicle, which hospital); a trigger mirrors that into the JWT's
  `app_metadata`, so policies read it with no extra query. Dispatchers read all
  dispatches and create them; crews see only their own vehicle's; hospital staff edit
  only their own hospital. Hospital *capacity* stays publicly readable — the `/`
  directory shows it — but every write is role-scoped.

Roles are **admin-provisioned**: `/register` creates an account with no role, which
waits on `/pending`. An administrator assigns the role by inserting a `profiles` row.

**Current state:** implemented in code, **not yet applied to the live database.** The
live DB still runs the open hackathon policies (migrations `0001`–`0006`). To switch a
project over: create the demo users in the Supabase dashboard, then run
[`supabase/apply_auth_demo.sql`](supabase/apply_auth_demo.sql) — it applies the auth
schema + RLS (`0007`), seeds demo data (`0008`), and links the three profiles by email
in one transaction that rolls back if the users don't exist yet. With Supabase env
vars **blank**, the app stays in memory mode and skips auth entirely, so the offline
demo is unaffected.

---

## The flow

Ambulance selection and triage are **deliberately out of order** from what you'd
guess — and that's the point:

```
119 call
   │
   ├─ dispatcher logs an optional note + sets the incident on the map
   │
   ├─ ASSIGN AMBULANCE  ── nearest certified, available, GPS-fresh vehicle
   │     └─ response leg: ambulance → incident
   │     └─ needs nothing but the incident location — the dispatcher's job ends here
   │
   ├─ crew's own tablet, once they're rolling:
   │     ├─ dictate (Whisper server-side, or browser speech, Burmese/English) or type
   │     └─ Claude extracts { condition, severity, specialty, needsICU, redFlags }
   │
   ├─ RANK HOSPITALS    ── live capacity + transport time from the incident
   │     └─ transport leg: incident → hospital
   │
   └─ crew confirms → hospital pre-alert, real driving route drawn on their map
         total time to definitive care = response + transport
```

**Why ambulance selection happens before triage, not after:** the ranking engine's
`selectAmbulance()` only ever needed the incident's location — condition, severity
and specialty feed hospital ranking, not fleet ranking. Asking the dispatcher for a
full clinical picture before sending a vehicle was adding a step the algorithm never
used. The crew still runs real triage; it just happens where the patient actually is,
on the device that's actually with them, instead of secondhand over the radio.

Two legs, reported separately and summed. A vehicle 1 minute away pairing with a
hospital 15 minutes out is a different clinical picture from the reverse.

---

## The backend is an n8n workflow

**Workflow:** [WheeYaw API](https://dontwannacode.app.n8n.cloud/workflow/poWIRrVi6X58C8jH)
· ~25 nodes · published

| Route | Does |
|---|---|
| `POST /webhook/mediroute/triage` | Claude extracts structured triage; falls back to keyword matching |
| `POST /webhook/mediroute/plan` | Reads hospitals + fleet from Supabase, runs selection and ranking |
| `POST /webhook/mediroute/dispatch` | Dispatcher's write: creates the dispatch row with no hospital yet, marks the ambulance **dispatched** |
| `POST /webhook/mediroute/dispatch/confirm` | Crew's write: fills in the triage fields + hospital pick on the same row |
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
with identical exclusions. Ranking itself hasn't changed since — only who's
allowed to see triage before a hospital gets ranked.

### Before the AI triage route works

The Claude node is currently **disabled**, because its credential is a
placeholder — the workflow could not be published with it enabled, and the API
key is yours to enter, not something to hand round. Until then the triage route
answers with the keyword fallback and says so — on the **Ambulance** page now,
since that's where triage runs.

To turn it on: add an Anthropic credential in n8n, then enable
**Extract Triage With Claude** and publish. A disabled node passes data through,
which is why the route works either way.

---

## Voice intake

Two independent capture paths, best available wins, and the UI always says
which one is active — see [`voice-input.tsx`](src/components/mediroute/voice-input.tsx):

- **Server Whisper** (preferred when a key is configured) — the mic records
  locally with `MediaRecorder` and posts the clip to `/api/transcribe`. Works
  in any browser and on networks where the built-in speech service is
  blocked. Set `OPENAI_API_KEY` (whisper-1) or `GROQ_API_KEY`
  (whisper-large-v3, free tier, strong Burmese) — OpenAI wins if both are set.
- **Browser SpeechRecognition** (fallback) — no key needed, Chrome/Edge only,
  streams audio to the browser vendor's servers, fails with "Speech service
  unreachable" on Brave, VPNs and filtered venue wifi.

Typing always stays visible below either path — it's the one that works fully
offline. Language toggles between Burmese (`my-MM`) and English on the
**Ambulance** page's intake card, not the dispatcher's — the dispatcher's own
note field has no voice input at all, on purpose: it's optional, and real
intake happens where the patient is.

Seed Burmese medical-clause examples for the keyword fallback live in
[`training/burmese-patient-situations.jsonl`](training/burmese-patient-situations.jsonl);
schema and labeling notes are in [`training/README.md`](training/README.md).

---

## Real driving routes — a second, separate Google API

Two different Google Maps Platform calls do two different jobs, and mixing
them up costs money for nothing:

- **Ranking** (`computeRouteMatrix`) — duration + distance only, cheap, used
  by the local engine's `TravelOverrides` seam and by n8n's Fleet/Hospital
  Travel Times nodes. This is the ETA shown everywhere in the app.
- **The Ambulance page's own route map** (`computeRoutes`, via the new
  `POST /api/route` proxy) — actual road geometry (an encoded polyline),
  decoded client-side and drawn as the real path for whichever leg the crew
  is currently running (assigned→scene, or scene→hospital). This is a
  *rendering* concern, not part of ranking, and has no n8n equivalent —
  called once per leg change, debounced against GPS-heartbeat churn so it
  doesn't re-fire on unrelated polls.

The **dispatcher's** overview map still draws dashed straight-line connectors
on purpose — it's showing every vehicle and hospital at once, not one path,
and road geometry for six-plus pairs simultaneously isn't worth paying for.
Only the crew's single-leg map gets the real road.

---

## Google Maps Platform — keys and cost control

Two keys, opposite rules:

| Key | Env var | Visibility | Protection |
|---|---|---|---|
| Routes API | `GOOGLE_ROUTES_API_KEY` (+ inside n8n) | Server-side secret | Never `NEXT_PUBLIC_`; API-restrict to Routes API |
| Maps JavaScript | `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | **Public by design** — ships in the bundle | HTTP-referrer restriction (localhost + deploy domain) + API-restrict to Maps JS. **Set this in Cloud Console; it is the entire security model for this key.** |

Blank either one and the app degrades gracefully: no Maps key → offline SVG map
(dispatcher only — the Ambulance page's route map shows a text fallback with
the ETA still visible); no Routes key → haversine ETAs everywhere.

**Cost guards built into the code** (free tier is 10k events/month per SKU — the
$300 trial credit sits untouched behind that):

- *Maps JS bills per map instantiation*, not per interaction. Each map object —
  the dispatcher's overview, and separately each Ambulance page's route map —
  is created once per mount and only overlays update afterwards. Don't key or
  conditionally unmount either map component; every remount is a billable load.
- *Routes ranking bills per matrix element.* Each plan is two small matrices
  (fleet→incident, incident→hospitals), not one combined matrix.
- *Live re-planning is debounced 1.2s* — five rapid bed-count clicks on the
  hospital panel coalesce into one Routes call, not five.
- *The Ambulance page's route-map fetch is keyed on coordinates, not object
  identity* — polled data (fleet/dispatch feeds) hands the component a new
  object with the same lat/lng on every tick; without this guard that alone
  fired 7+ redundant `computeRoutes` calls per page load in testing.

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

**1. Triage** (`src/lib/mediroute/triage.ts`, `keyword-triage.ts`) — runs on the
**Ambulance** page, on the crew's own screen, once they've been assigned.

Free-text patient note → `{ condition, severity, requiredSpecialty, needsICU,
redFlags, confidence }`. Two paths, identical output shape:

- **Claude** via structured outputs — schema-guaranteed, no JSON parsing.
- **Bilingual Burmese/English keyword matcher** — used when `ANTHROPIC_API_KEY`
  is missing or the call fails.

The UI always states which one ran. Fallback output is never presented as AI.
`redFlags` carries the findings that drove the call, so the record is traceable
back to the note — and that note is now the crew's own, not the dispatcher's;
`POST /api/dispatch/confirm` persists it as the mission's real `patient_note`,
replacing whatever optional note the dispatcher logged.

**2. Ranking** (`src/lib/mediroute/engine.ts`) — pure function, no I/O, no clock.
Ambulance selection and hospital ranking are two separate calls into this file;
the former only ever reads the incident location.

```
FLEET: selectAmbulance(ambulances, incident) — no triage needed
  · certified, available, GPS fix < 10 min old
  · nearest first

HOSPITALS: recommend(hospitals, triage, incident)
  HARD FILTERS (excluded outright, with a reason shown)
    · lacks the required specialty
    · no available beds
    · critical only: no specialist on duty, or no ICU bed when one is needed

  SCORE (every term normalized 0..1, higher is better)
    travelScore = max(0, 1 - etaMinutes / 60)
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

> **Why travel is scored against a fixed 60-minute reference** rather than min-max
> normalized across candidates: min-max divides by zero when only one hospital is
> eligible, which happens in the mass-casualty case. (Raised from 45 once real
> Google Routes times replaced haversine estimates — measured Yangon driving times
> run roughly 1.7× the straight-line guess.)

**3. Confirm** — two separate writes, two separate people. The dispatcher's
`POST /api/dispatch` creates the row with a vehicle and no hospital. The crew's
`POST /api/dispatch/confirm` fills in real triage plus the hospital they picked.
`was_override` is derived server-side from that second write, so the agreement
statistic can't be skewed by the client. It's reported as *agreement*, never
"accuracy" — there is no ground truth about which hospital was actually correct.

---

## Layout

```
src/
  lib/mediroute/
    engine.ts           ← selectAmbulance + recommend (pure, tested)
    engine.test.ts       ← unit tests incl. both seeded demo scenarios
    triage.ts            ← Claude structured-output triage
    keyword-triage.ts     ← bilingual Burmese/English fallback matcher
    keyword-triage.test.ts
    transcribe.ts         ← server-side Whisper (OpenAI or Groq)
    describe.ts           ← hospital directory card blurb, with a fallback
    geo.ts                ← haversine + ETA
    polyline.ts           ← Google encoded-polyline decoder, for the route map
    maps-loader.ts         ← shared Google Maps <script> loader (one load, many maps)
    store.ts               ← the only module touching storage
    backend.ts              ← local routes vs. n8n webhooks, one seam
    feeds/
      hospital-feed.ts     ← the HIS seam: manual today, live feed later
    use-hospitals.ts | use-fleet.ts | use-dispatches.ts
      ← Realtime subscriptions, poll when Supabase is absent
    use-donations.ts   ← polls only; donations are off Realtime so payer_phone
                          can't ride the websocket past the column grant
    types.ts               ← zod schemas + shared types
    n8n-parity.test.ts     ← asserts n8n/ranking-core.js == engine.ts
  components/mediroute/
    dispatcher/            ← intake, ambulance list, assignment, timeline
      index.tsx             ← orchestrator: intake → assign, nothing else
    ambulance-dashboard.tsx ← triage, hospital pick, route map, status
    ambulance-route-map.tsx ← real road geometry for the crew's current leg
    hospital-choice-list.tsx, triage-summary.tsx, reasons.tsx
      ← shared between the ambulance page and (formerly) the dispatcher
    hospital-directory.tsx  ← public landing: capacity cards + donations
    voice-input.tsx         ← Whisper + browser-speech, typing always available
    fleet-panel.tsx | hospital-panel.tsx | history-panel.tsx
    google-map.tsx | map.tsx ← dispatcher overview (Google + offline SVG fallback)
    status.tsx               ← one status vocabulary, shared everywhere
  app/api/
    triage · transcribe · route · ambulances · ambulances/[id]
    hospitals · hospitals/[id] · recommend · dispatch · dispatch/confirm
    donations · donations/otp · health
  app/                    ← auth pages: login · register · reset-password ·
                            update-password · pending · auth/callback · auth/signout
  middleware.ts           ← session refresh + role routing
  lib/auth/roles.ts       ← Role type, route map, path guards
supabase/
  migrations/ ← schema + seed (0001–0008); donations 0004–0006,
                auth + RBAC 0007, demo data 0008
  apply_auth_demo.sql ← one-shot: applies 0007+0008 and links demo profiles by email
```

---

## Demo-day notes

- **The dispatcher overview map is deliberately not tile-based.** Tile maps fetch
  at render time, so bad venue wifi turns the panel into a grey box in front of
  judges. `map.tsx` projects lat/lng into an SVG as the offline fallback: no key,
  no network, cannot fail on stage. The Google basemap is the default when a key
  is configured; toggle to offline and back before demo day so the fallback path
  is rehearsed, not discovered live.
- **Run `/hospital` on a second machine.** Alt-tabbing to edit your own data
  undercuts the illusion that this is live inter-hospital state.
- **Run `npm test` before presenting.** The engine tests assert that the nearest
  hospital is *not* the recommendation in the seeded scenario. If that flips, the
  demo's whole thesis is broken and you want to know in the room, not on stage.
- **The offline path is real** — blank the env vars and everything still works with
  seeded data and keyword triage. Try it once before demo day so you've seen it.
- **Three things need the network, independently: voice, the n8n backend, and the
  real-route map.** Since the IoT units are always online, cloud dependencies are
  a fine production choice — the constraint is the demo room. If venue wifi is
  unreliable: blank `NEXT_PUBLIC_MEDIROUTE_API` to run the backend locally, and
  typing stays available even if voice or the route map degrade.

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
dispatchable at all.** This ranking runs the moment the dispatcher clicks "Find
ambulances" — before anyone has said a word about the patient's condition.

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

The three closest hospitals all lose. That is the entire pitch, on one screen —
now shown on the crew's tablet, after they've dictated or typed the description
themselves and confirmed the destination.

---

## Safety framing — say this out loud to judges

This is a **decision-support prototype**. It has no clinical validation, no regulatory
review, and uses no real patient data. It never auto-dispatches: the triage output is
editable by the crew before they confirm, and the final routing — both which vehicle
and which hospital — is always a human decision, made by two different people at two
different moments so neither call happens under time pressure alone.

> ⚠️ **Auth + RBAC exist in code but aren't applied to the live database yet.** Until
> [`supabase/apply_auth_demo.sql`](supabase/apply_auth_demo.sql) is run, the live DB
> still grants the anon role unconditional read/write (migrations `0001`–`0006`), and
> the anon key ships in the browser bundle. Fine for fictional demo data. Once `0007`
> is applied, `dispatches`, `ambulances` and hospital *writes* are role-scoped, and
> `donations.payer_phone` is stripped at the grant — but **never put real patient
> information in this database** regardless. See **Authentication & roles** above.

See [PLAN.md](PLAN.md) for the original build plan, cut list, and judging Q&A prep.
