-- APPLIED to the team's Supabase project on 2026-07-21.
-- Kept here as the record of what's live. If you rename the table or add
-- columns for the topic, edit this file, re-run it, and update
-- SUPABASE_TABLE in .env.local to match.

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  notes       text not null default '',
  status      text not null default 'new' check (status in ('new', 'active', 'done')),
  created_at  timestamptz not null default now()
);

create index if not exists items_created_at_idx
  on public.items (created_at desc);

alter table public.items enable row level security;

-- ⚠ HACKATHON-ONLY POLICY.
-- The app has no sign-in, so the anon role needs direct read/write and this
-- policy grants it unconditionally. Supabase's security linter flags it
-- (rls_policy_always_true) — that warning is expected and accepted here.
-- Anyone with the anon key, which ships in the browser bundle, can read and
-- write this table. Fine for demo data. Do NOT put anything real in it, and
-- replace this with user-scoped policies the moment you add auth.
drop policy if exists "anon full access" on public.items;
create policy "anon full access"
  on public.items
  for all
  to anon, authenticated
  using (true)
  with check (true);
