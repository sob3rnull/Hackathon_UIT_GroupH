# WheeYaw — AI-Assisted Emergency Hospital Routing

Recommends the best hospital for an incoming ambulance — not the *nearest*, but the
nearest one that is actually *available and equipped* to treat this patient, based on
live bed occupancy, specialist availability, and ER load.

**Team:** Group H · UIT · 24-hour build

> Revised from the original outline. Changes are marked **[CHANGED]**, **[ADDED]**,
> or **[CUT]** with the reasoning, so you can overrule any of them.

> **This is an hour-0 planning document, not a spec.** The build has since gone past
> it in several places — a public landing page with a hospital directory and demo
> donations was added, email/password auth with three roles and RLS was built (§6
> originally skipped it), and ambulance selection now happens *before* triage (the
> ranking engine never needed triage to pick a vehicle, only the incident location),
> so triage and the hospital pick moved to the crew's own screen instead of staying
> on the dispatcher's. **[README.md](README.md) describes what's actually built and
> is the one to trust for architecture.** The reasoning below — why the AI has to be
> in the intake, why the scoring formula is shaped the way it is, why the map is an
> SVG — is all still the live design; only the demo script, API surface and screen
> ownership below have moved on.

---

## 1. Problem statement

Emergency routing today optimizes for distance and traffic alone. Ambulances arrive at
the "nearest" hospital to find no available beds, no specialist on duty, or an
overloaded ER — burning minutes inside a resuscitation window. WheeYaw matches
patient condition against live hospital capacity and travel time in one ranked
recommendation, with a human dispatcher always able to override.

**Target user:** the **ambulance dispatcher** (and the paramedic feeding them patient
data) — not hospital staff. Hospital staff appear in the demo only as the source of
live capacity updates.

> **[CHANGED]** This was stretch item #14, which was the wrong place for it — it's a
> positioning statement, not a feature. Its wording also contradicted the pitch: it
> said "find the nearest hospital with availability criteria," but the entire thesis
> is that nearest ≠ best. And the user is a dispatcher, not "medical staff."

---

## 2. Scope — MVP

Ordered by build sequence. **Everything through #5 is the demo.** 6–8 are what make it
land.

1. **Free-text patient intake with AI triage** — paramedic types or dictates a plain
   description ("55M, chest pain radiating to left arm, diaphoretic, BP 90/60"). An
   LLM extracts condition category, severity, and required specialty into a typed
   object. A manual override dropdown sits next to it for when the model is wrong or
   the network is down. **[CHANGED] — see §4, this is the biggest change in this doc.**
2. **Hospital capacity panel** — a second screen where "hospital staff" update bed
   count, specialists on duty, and ER queue live during the demo. This is your data
   source; no real hospital API needed.
3. **Matching & ranking engine** — hard-filters on eligibility, then ranks by a
   weighted score. **[CHANGED] — the formula had a bug, see §5.**
4. **Recommendation screen** — top-ranked hospital with a plain-language breakdown of
   *why* ("8 min away · 3 ICU beds free · cardiologist on duty · ER at 40%").
5. **Live re-ranking** — capacity changes on the hospital panel instantly re-rank the
   dispatcher's view and flag what changed. **This is your best demo moment — protect
   the time for it.**
6. **Dispatcher override** — accept the recommendation or pick any hospital from the
   ranked list. Log which was chosen.
7. **Hospital pre-alert** — on dispatch, the chosen hospital's panel shows an incoming
   patient with ETA and condition summary.
8. **Map view** — hospitals as pins, ambulance as a pin, straight line to the selected
   hospital.

> **[CHANGED]** The original had a *simulated ambulance moving along a route* as MVP
> item #2. Route-following animation is a genuine time sink (route geometry,
> interpolation, timers) for very little judge value — nobody scores you on a smooth
> pin. If you want motion, linear-interpolate between two points on a `setInterval`;
> that's 15 lines. Do it in the polish window, not before the ranking engine works.

## 3. Stretch — only if MVP is done and rehearsed

9. **Mass-casualty load balancer** — submit 3+ patients at once, show the system
   distributing them across hospitals instead of sending all to the single best one.
   *This is the strongest stretch: it's visually obvious and impossible to fake.*
10. **Road-hazard flag** — toggle a "flooded road" event that forces a reroute.
    Regionally relevant, cheap to build (multiply travel time for affected hospitals).
11. **Blood availability check** — for trauma, cross-reference mock blood-type stock.
12. **Override-rate readout** — after a demo run, show how often the dispatcher took
    the recommendation vs. overrode it. **[CHANGED]** — the original called this an
    "accuracy" stat. It isn't. You have no ground truth about which hospital was
    actually correct, so calling agreement "accuracy" is exactly the overclaiming the
    outline elsewhere warns against. "Dispatcher agreement rate" is honest and just as
    interesting.

> **[CUT] — the ML wait-time predictor (original stretch #9).** The original called
> this "your strongest answer if judges ask where's the AI." It's the weakest. You'd
> train a regression model on data you fabricated, so it learns your own generator's
> assumptions and predicts nothing real. A judge who probes for two questions will
> find that, and it costs hours you won't have at hour 21. §4 replaces it with an AI
> component that does real work on real input.

---

## 4. The "where's the AI?" problem — solve it in the MVP, not as a stretch

Be honest with yourselves: **a weighted sum is not AI.** It's arithmetic. The original
outline knew this and deferred the answer to stretch #9 at hours 21–23 — which, on a
24-hour build, means it will not exist.

**The fix: make the intake itself the AI.** A paramedic doesn't pick from a dropdown
mid-emergency; they talk. So take free text and have Claude extract structured triage:

```ts
// src/lib/triage.ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Triage = z.object({
  condition: z.enum(["cardiac", "trauma", "stroke", "burn", "obstetric", "general"]),
  severity: z.enum(["critical", "urgent", "stable"]),
  requiredSpecialty: z.string(),
  needsICU: z.boolean(),
  redFlags: z.array(z.string()),   // what drove the call — show this in the UI
  confidence: z.number().min(0).max(1),
});

const client = new Anthropic();

export async function triage(note: string) {
  const res = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system:
      "You are a triage assistant for ambulance dispatch. Extract structured triage " +
      "data from the paramedic's note. This is decision support for a trained " +
      "dispatcher who reviews every result — never the final decision. If the note " +
      "is ambiguous, choose the higher severity and say why in redFlags.",
    messages: [{ role: "user", content: note }],
    output_config: { format: zodOutputFormat(Triage) },
  });
  return res.parsed_output;   // null if parsing failed — fall back to the dropdown
}
```

Why this is the right call:

- **It's real AI doing real work** — unstructured clinical language → typed decision
  input. Not a model trained on data you invented.
- **It demos beautifully.** Typing "55M crushing chest pain, sweating, BP 90/60" and
  watching it resolve to `cardiac / critical / cardiology / ICU: yes` with the red
  flags listed is a better 20 seconds than any chart.
- **It's ~45 minutes of work**, not 3 hours, because structured outputs guarantee the
  shape — no JSON parsing, no retry logic.
- **`redFlags` is your explainability story.** The model says *why*, and you display
  it. That directly answers "how do we know it's not hallucinating?"

**Non-negotiables for a medical demo:**

- The dropdown override stays visible at all times. The model proposes; the human
  disposes. Say this out loud during the demo.
- Cache one or two triage results as fixtures. If venue wifi dies, the demo still
  runs. **Do this before you sleep tomorrow night, not at the venue.**
- `parsed_output` can be `null`. Fall back to the dropdown, don't crash.

Setup: `npm i @anthropic-ai/sdk` and put `ANTHROPIC_API_KEY` in `.env.local`
(gitignored — the repo is public). Call it from a route handler, never the browser, or
you ship your key to every visitor.

> If demo latency matters more than extraction quality, swap `claude-opus-4-8` for
> `claude-haiku-4-5` — same code, noticeably faster, $1/$5 per Mtok vs $5/$25. Try
> Opus first; only downgrade if the pause is visibly awkward on stage.

---

## 5. Ranking engine — the original formula had a bug

**The bug.** The original read:

```
travelTimeScore = f(distance(ambulanceLocation, hospital.location))
weightedScore   = 0.4*travelTimeScore + 0.25*bedScore + 0.2*doctorScore + 0.15*erLoadScore
sort descending by weightedScore
```

`f` is never defined. Every other term is "higher is better" (more beds → higher
score), so whoever implements this at 3am writes `travelTimeScore = distance` — and
because you sort **descending**, the system now recommends the **farthest** hospital.
It will look like it's working. It will produce a ranked list. It will be backwards.

**Second gap: `severity` is collected but never used.** It's an input to the algorithm
in step 1 and appears nowhere in the math. A stable patient and a coding patient get
routed identically.

**Third: `doctorScore` as a 0/1 term doesn't do what you want.** A hospital with *no*
cardiologist scores 0 on a term weighted 0.2 — it loses 20% and can still rank first.
For a critical cardiac patient, "no cardiologist" isn't a penalty, it's a disqualifier.

### Corrected engine

```
1. INPUT: { condition, severity, requiredSpecialty, needsICU, ambulanceLocation }

2. HARD FILTERS (eligibility — not scored, excluded outright)
   - hospital.specialties includes requiredSpecialty
   - hospital.availableBeds > 0
   - if severity == "critical":
       - hospital.doctorsOnDuty[requiredSpecialty] > 0
       - if needsICU: hospital.icuBedsFree > 0
   If zero hospitals survive, relax the critical-only filters and flag the
   recommendation "NO FULLY-EQUIPPED HOSPITAL AVAILABLE — nearest capable shown."
   (Handle this case. Judges will ask about it, and it's a one-line branch.)

3. SCORE each surviving hospital — every term normalized to 0..1, higher = better
   travelScore = max(0, 1 - travelMinutes / 45)      // 45 min = unacceptable
   bedScore    = availableBeds / totalBeds
   doctorScore = min(doctorsOnDuty[requiredSpecialty] / 2, 1)   // 2+ = full marks
   erLoadScore = 1 - min(currentERQueue / erCapacity, 1)

4. WEIGHTS BY SEVERITY
   critical : travel .50  beds .20  doctors .20  erLoad .10   // time dominates
   urgent   : travel .40  beds .25  doctors .20  erLoad .15   // original weights
   stable   : travel .25  beds .30  doctors .15  erLoad .30   // avoid clogged ERs

5. SORT DESCENDING, return with a human-readable reason per hospital
```

`travelScore` uses a fixed 45-minute reference rather than min-max normalizing across
the candidate set. Min-max divides by zero when only one hospital is eligible — which
*will* happen in your mass-casualty demo.

**Tune the weights during your practice run** so the demo scenario clearly favors the
obviously-right hospital over the obviously-wrong-but-closer one. That's not cheating,
it's calibration — but know your numbers so you can answer "why 0.5?" with reasoning
rather than a shrug.

---

## 6. Stack — use the shell that already exists

> **[CHANGED] — read this before anyone runs `npm create vite`.**

The original specified React (Vite) + Express + Socket.io + in-memory objects. There is
already a **built and verified** Next.js 16 + React 19 + Tailwind 4 + Supabase shell in
this repo, with layout, theming, forms, loading/empty/error states, and a working
create→list→delete slice against a live database.

**Keep the shell.** Rebuilding that in Vite + Express costs 3–4 hours to arrive at
something you already have.

| Layer | Original | Use instead | Why |
|---|---|---|---|
| Framework | React + Vite | **Next.js (this repo)** | Already built and verified. UI + API in one app, one deploy, no CORS. |
| Backend | Express | **Next.js route handlers** | `src/app/api/*` already works. No second server, no second port. |
| Real-time | Socket.io | **Supabase Realtime** | Already wired. Postgres `LISTEN/NOTIFY` over websockets — subscribe to the `hospitals` table and the dispatcher view updates when staff change a bed count. **No socket server to write.** |
| Storage | In-memory only | **`src/lib/store.ts` (both)** | Already falls back to in-memory when env vars are blank. You get the "no DB setup" benefit *and* persistence, switchable by editing `.env.local`. |
| Distance | Haversine | **Haversine** ✓ | Correct call. 10 lines, no API key, no network. Keep it. |
| Maps | Mapbox / Google | **Mapbox** — but see below | |

**The one real risk in this stack: the map needs the network.** Map tiles are fetched
at render time. If venue wifi is bad, your map is a grey box during judging. Mitigate:
screenshot the map early as a fallback slide, and make sure the app is *usable and
demoable with the map panel collapsed*. The ranking engine is the substance; the map is
decoration. Don't let decoration take the demo down.

**Explicitly skipped:** ~~auth~~, real hospital integrations, mobile app, production
hardening. Add: **no PHI, no real patient data, ever** — use obviously fictional names.

> **[CHANGED — auth was un-skipped.]** Email/password sign-in with three roles
> (`dispatcher`, `ambulance`, `hospital`) and real RLS was built after this doc:
> `profiles` holds role + scope, mirrored into the JWT so policies cost no extra
> query. It's off by default — blank Supabase env vars = memory mode, no auth — and
> the live DB isn't switched over yet. See README **Authentication & roles**.

---

## 7. Data model

```ts
type Hospital = {
  id: string;
  name: string;
  lat: number; lng: number;
  specialties: string[];              // ["cardiac","trauma",...]
  totalBeds: number; availableBeds: number;
  icuBedsFree: number;
  doctorsOnDuty: Record<string, number>;   // { cardiology: 2, trauma: 0 }
  erCapacity: number; currentERQueue: number;
};
```

**Seed with 5–6 real Yangon hospitals** — real names and real coordinates. It costs ten
minutes and makes the map instantly credible to local judges in a way that
"General Hospital A" never will. Set up their capacity so the demo scenario has an
obvious right answer and an obvious trap:

- one **close but full** (0 beds — gets hard-filtered, prove the filter works)
- one **close, has beds, no cardiologist** (the trap — closest eligible, wrong choice)
- one **mid-distance, beds + cardiologist on duty** (the right answer)
- two more for the mass-casualty stretch

---

## 8. API surface

> **[SUPERSEDED]** — this table is the hour-0 sketch. What's actually built, split
> across two writes because two different people make two different decisions:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/triage` | Free text → structured triage. Called from the **Ambulance** page, not the dispatcher's. |
| `POST` | `/api/ambulances` | Rank the fleet for an incident — needs only the location |
| `POST` | `/api/recommend` | Rank hospitals against a triage — the crew's call, not the dispatcher's |
| `GET` / `PATCH` | `/api/hospitals`, `/api/hospitals/:id` | Live status; staff panel updates beds/doctors/queue |
| `PATCH` | `/api/ambulances/:id` | Crew's own status buttons (on scene / transporting / complete) |
| `POST` | `/api/dispatch` | **Dispatcher's write.** Body has an ambulance and an incident, no hospital yet |
| `POST` | `/api/dispatch/confirm` | **Crew's write.** Same row, now with real triage + the hospital they picked |
| `POST` | `/api/route` | Real road geometry for the crew's own route map (separate Google endpoint from ranking) |
| `POST` | `/api/transcribe` | Server-side Whisper transcription for voice intake |

Real-time replaces the three WS events in the original — subscribe to Supabase table
changes on the client instead of hand-rolling `hospital:update` / `ambulance:location` /
`recommendation:update` broadcasts.

---

## 9. Timeline

Assumes **4 people**. If you're 2, cut items 7 and 8 from the MVP immediately and say
so at hour 0 — don't discover it at hour 20.

| Hours | Work | Who |
|---|---|---|
| 0–1 | Rename shell via `src/config/project.ts`, agree the `Hospital` type, seed data, assign roles | all |
| 1–4 | Engine: haversine, filters, scoring, weights + **unit tests on the scoring function** | dev A |
| 1–4 | Hospital capacity panel (form + PATCH) | dev B |
| 1–4 | Triage endpoint + intake form with dropdown fallback | dev C |
| 4–8 | Dispatcher view: ranked list, "why" breakdown, override | dev A+D |
| 8–11 | Supabase Realtime subscription → live re-rank | dev B |
| 11–14 | Map with pins; pre-alert screen on hospital side | dev C+D |
| 14–17 | **Cache demo fixtures. Test with wifi off.** Polish. | all |
| 17–19 | **Rehearse end to end, twice, out loud, timed** | all |
| 19–22 | Stretch #9 (mass casualty) — *only if 17–19 went clean* | A+B |
| 22–24 | Buffer + final rehearsal | all |

**Write unit tests for the scoring function.** It's a pure function — inputs to a
number. Three test cases (closest-but-ineligible loses; critical weights travel higher;
one-eligible-hospital doesn't divide by zero) take 20 minutes and are the only thing
standing between you and demoing a backwards ranking.

**Rehearsal at 17–19 is not optional and not movable.** A demo that works but is
narrated badly scores below a smaller demo delivered cleanly.

---

## 10. Demo script (~3 min)

> **[SUPERSEDED]** — the original had one person doing everything on one screen.
> The build now splits this across two screens on purpose, which is a *better* demo
> beat, not a worse one: it makes the "two independent human decisions" safety story
> physically visible instead of asserted.

1. On `/dispatcher`: log the incident location (note is optional — you can skip
   straight to it), click "Find ambulances." **Land this explicitly:** *"The
   dispatcher's only job is picking a vehicle — that's all the algorithm needs at
   this point."* Assign the nearest one.
2. Cut to `/ambulance` on a second device — the crew's tablet. Dictate or type the
   patient description, run triage, show it resolving to condition, severity,
   specialty, red flags. *"This is how a paramedic actually talks — and it happens
   where the patient is, not secondhand over the radio."*
3. Show the ranked hospitals with the reason breakdown. **Land the core thesis:**
   *"The closest hospital is 4 minutes away. The system recommends the one 8 minutes
   away, because the closer one has no cardiologist on duty."*
4. Have a teammate mark beds taken on the hospital panel — the ranking updates live,
   no refresh, visible on the crew's screen mid-decision.
5. Confirm on the ambulance page → hospital receives the pre-alert with ETA and
   condition; the dispatcher's screen updates to show what the crew chose, without
   ever having been asked to choose it themselves.
6. Close on the two decision points: *"The system recommends twice — which vehicle,
   which hospital. A human decides both, and it's never the same person under the
   same time pressure."*

Whoever runs the hospital panel in step 4 should be a **third person on a third
machine**. Alt-tabbing to change your own data undercuts the whole illusion.

---

## 11. Judging Q&A

- **"Where's the AI?"** → Lead with the triage extraction: unstructured clinical
  language into structured decision input, with red flags surfaced for explainability.
  Then describe the ranking engine accurately as *deterministic, explainable
  decision-support* — and say so plainly. Judges respect a team that knows which parts
  of their system are AI and which are arithmetic; they punish teams who blur it.
- **"What if the AI is wrong?"** → Two independent safeguards, run by two different
  people. The triage output is editable by the crew before they confirm it, and
  either the vehicle pick or the hospital pick can be overridden by the human making
  that specific call. The system never auto-dispatches. Show an override, don't just
  describe it.
- **"How does this get real hospital data?"** → It needs hospital-side integration and
  buy-in. The capacity panel stands in for an HIS feed. Be straight that this is the
  hard part of the real problem — a team that names its own biggest obstacle reads as
  credible, not weak.
- **"Is this safe to deploy?"** → It isn't, and say so. It's a decision-support
  prototype with no clinical validation, no regulatory review, and no real patient
  data. What it demonstrates is that capacity-aware routing beats distance-only
  routing. Overclaiming on a medical system is the fastest way to lose a technical
  judge.

---

## 12. Cut list — when you're behind

Decide this now, calmly, not at hour 19 in a panic. Cut in this order:

1. Map view (#8) → static list with distances. Costs you nothing in substance.
2. Pre-alert screen (#7) → a toast on the dispatcher side saying "St. Mary's notified."
3. Mass casualty (#9) → describe it as future work.
4. Live re-ranking (#5) → a "Refresh" button. **Cut this last** — it's the demo's peak.

**Never cut:** the ranking engine, the "why" breakdown, or either override button
(vehicle pick, hospital pick — now two, on two screens). Those *are* the project.

---

## Open questions — settle at hour 0

- [ ] Team size, and who owns which track from §9?
- [ ] Final weight values — start with §5's and tune during rehearsal.
- [ ] Which 5–6 Yangon hospitals, and which one "should" win the demo scenario?
- [ ] Opus or Haiku for triage — decide after you've felt the latency once.
- [ ] Who is the second person driving the hospital panel during the demo?
