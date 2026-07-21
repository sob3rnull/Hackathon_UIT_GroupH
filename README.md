# Hackathon Shell

A pre-built Next.js frame to drop tomorrow's topic into. Runs with **zero setup** —
no keys, no database — and upgrades to Supabase by filling in `.env.local`.

```bash
npm run dev     # http://localhost:3000
```

---

## The 15-minute start

Once the topic is announced, do these in order. Nothing else is required to have
a working, demoable app.

**1. Rename everything** — [`src/config/project.ts`](src/config/project.ts)

Change `name`, `tagline`, `pitch`, `team`, and `entity`. The header, tab title,
hero, form labels, buttons and empty states all read from this one file.

**2. Reshape the record** — [`src/lib/types.ts`](src/lib/types.ts)

`Item` is a placeholder with `title / notes / status`. Add your fields to the
zod schema and the interface; TypeScript will then point you at every place
that needs updating.

**3. Add the topic logic** — [`src/app/api/items/route.ts`](src/app/api/items/route.ts)

There's a marked spot in `POST` between validation and the write. Call your
model, API, scraper or calculation there and persist the result.

**4. Update the form** — [`src/components/workspace.tsx`](src/components/workspace.tsx)

Add or remove `<Field>` blocks to match the new shape.

**5. (Optional) Turn on Supabase** — see below.

---

## Supabase — already connected

Wired to the team's Supabase project and verified: create, list and delete were
all exercised against the live database. `.env.local` (gitignored) holds the URL
and anon key; no service-role key is needed. Ask a teammate for the values, or
copy them from the Supabase dashboard.

Sanity check: `curl localhost:3000/api/health` → `{"store":"supabase"}`.
The header badge shows the same thing at a glance.

If the table changes shape for the topic, edit
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), re-run
it in the SQL editor, and update `SUPABASE_TABLE` in `.env.local` if you renamed
it.

> ⚠ **The RLS policy is wide open.** The app has no sign-in, so `items` grants
> the anon role unconditional read/write — and the anon key ships in the browser
> bundle. Anyone who opens devtools can read and write that table. That's an
> accepted trade for demo data on a one-day build; Supabase's security linter
> flags it deliberately. Don't put anything real in it, and replace the policy
> with user-scoped rules if this outlives the hackathon.

**The in-memory fallback is still there.** Blank the two env values and the app
keeps working with seed data — worth remembering if the venue wifi dies or the
project is paused mid-demo.

---

## What's in the box

```
src/
  config/project.ts        ← rename the product here, first thing
  app/
    layout.tsx             header, footer, no-flash dark mode
    page.tsx               hero + highlights + workspace
    globals.css            design tokens (change --accent to rebrand)
    api/health/route.ts    curl-able status check
    api/items/route.ts     ← topic logic goes here
    api/items/[id]/route.ts
  components/
    workspace.tsx          the working create → list → delete slice
    site-header.tsx        nav + store-mode badge + theme toggle
    ui/                    button, card, field, badge, states
  lib/
    store.ts               ← the only file that touches storage
    types.ts               zod schemas + Item type
    env.ts                 env access, never throws
    supabase/              browser + server + admin clients
supabase/migrations/       SQL to paste into Supabase
```

**Already handled so you don't spend time on it:** light/dark with no flash on
load, focus rings, loading skeletons, empty states, error states with retry,
optimistic delete, form validation on both sides, responsive layout,
reduced-motion support.

---

## Rebranding in one line

Every colour derives from `--accent` in
[`src/app/globals.css`](src/app/globals.css). Change it (and the `.dark`
counterpart) and buttons, links, badges, focus rings and the hero glow all
follow.

## Demo-day notes

- `npm run build` before you present — catches type errors `dev` lets slide.
- The `items` table is currently **empty**, so the app opens on its empty state.
  Insert a few believable topic rows before you present so it never looks bare.
- `seed()` in `src/lib/store.ts` only applies to the in-memory fallback, not to
  Supabase.
