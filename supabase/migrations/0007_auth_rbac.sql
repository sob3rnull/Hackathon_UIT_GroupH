-- Auth + RBAC (was 0005; renumbered to 0007 to sit after the donations work). NOT YET APPLIED — read the warning before running.
--
-- ⚠ THIS MIGRATION REMOVES THE "anon full access" POLICIES.
-- The app currently has no sign-in, so the moment this runs every page that
-- reads Supabase goes empty until you (a) create auth users, (b) insert a
-- matching public.profiles row for each, and (c) ship the login screen.
-- Apply it when you're ready to do all three, not before a demo.
--
-- Design notes:
--   * public.profiles is the source of truth for role + scope.
--   * A trigger mirrors those into auth.users.raw_app_meta_data, which Supabase
--     embeds in every JWT. Middleware and RLS therefore read the role for free
--     — no DB round-trip per request, no recursive-policy problem.
--   * Claims are stale until the user's token refreshes (~1h). For instant
--     revocation flip profiles.is_active, which policies read live.

-- ─── Organizations: EMS operators, hospital groups, dispatch centres ─────
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text not null check (kind in ('ems','hospital','dispatch_center')),
  created_at timestamptz not null default now()
);

alter table public.hospitals
  add column if not exists org_id uuid references public.organizations(id) on delete set null;
alter table public.ambulances
  add column if not exists org_id uuid references public.organizations(id) on delete set null;

-- ─── Profiles: one row per auth user ────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  role         text not null check (role in ('dispatcher','ambulance','hospital')),
  phone        text not null default '',
  organization text not null default '',
  -- The gate. A self-registered profile starts unverified and carries NO role
  -- claim in the JWT until an admin flips this in the Supabase dashboard. The
  -- column is NOT granted to the authenticated role (see grants below), so a
  -- registrant cannot set or change it — only the service role (dashboard) can.
  is_verified  boolean not null default false,
  is_active    boolean not null default true,
  org_id       uuid references public.organizations(id) on delete set null,
  hospital_id  uuid references public.hospitals(id)     on delete set null,
  ambulance_id uuid references public.ambulances(id)    on delete set null,
  created_at   timestamptz not null default now(),

  -- ambulance_id is a permanent binding, decided deliberately: a crew member
  -- belongs to one vehicle. If crews ever rotate per shift this becomes a
  -- crew_assignments table and the two crew policies below turn into
  -- subqueries against it, which costs an index lookup per row instead of the
  -- claim comparison they use today.

  -- each role carries exactly the scope it needs, and no other
  constraint profiles_scope_ck check (
    (role = 'dispatcher' and hospital_id is null and ambulance_id is null)
 or (role = 'ambulance'  and hospital_id is null)
 or (role = 'hospital'   and ambulance_id is null and hospital_id is not null)
  )
);

create index if not exists profiles_hospital_idx
  on public.profiles (hospital_id) where hospital_id is not null;
create index if not exists profiles_ambulance_idx
  on public.profiles (ambulance_id) where ambulance_id is not null;

-- ─── Mission status: needed for workflow steps 5-6 (accept / update) ─────
alter table public.dispatches
  add column if not exists status text not null default 'pending'
    check (status in ('pending','accepted','en_route','on_scene','transporting','arrived','cancelled')),
  add column if not exists accepted_at timestamptz,
  add column if not exists arrived_at  timestamptz,
  add column if not exists created_by  uuid references public.profiles(id) on delete set null;

create index if not exists dispatches_ambulance_idx on public.dispatches (ambulance_id, status);
create index if not exists dispatches_hospital_idx  on public.dispatches (hospital_id, status);

-- ─── Claim helpers. STABLE so the planner hoists them out of the row loop ─
create or replace function public.jwt_role() returns text
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

create or replace function public.jwt_hospital_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'hospital_id', '')::uuid
$$;

create or replace function public.jwt_ambulance_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'ambulance_id', '')::uuid
$$;

-- ─── Sync profiles -> app_metadata, GATED ON VERIFICATION ───────────────
-- Verified: the role + scope ride into the JWT. Unverified (or de-verified):
-- the claims are stripped, so revoking access is just flipping is_verified
-- back to false. This is why self-registration is safe — the role a user
-- picks at signup does nothing until an admin verifies the row.
create or replace function public.sync_profile_claims() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_verified then
    update auth.users set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'role',         new.role,
        'hospital_id',  new.hospital_id,
        'ambulance_id', new.ambulance_id
      )
    where id = new.id;
  else
    update auth.users set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb) - 'role' - 'hospital_id' - 'ambulance_id'
    where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists profiles_sync_claims on public.profiles;
create trigger profiles_sync_claims
  after insert or update of role, hospital_id, ambulance_id, is_verified on public.profiles
  for each row execute function public.sync_profile_claims();

-- ═══════════════════════════════════════════════════════════════════════
--  Row Level Security
-- ═══════════════════════════════════════════════════════════════════════

-- Remove the hackathon blanket grants. THIS IS THE IMPORTANT PART.
drop policy if exists "anon full access" on public.hospitals;
drop policy if exists "anon full access" on public.dispatches;
drop policy if exists "anon full access" on public.ambulances;

alter table public.profiles      enable row level security;
alter table public.organizations enable row level security;

-- profiles: you read, create and edit YOUR OWN row — nobody else's.
create policy "read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- Self-registration: a signed-in user may insert exactly one row, keyed to
-- their own auth id. They cannot invent a row for someone else.
create policy "create own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

-- Self-service edits. The row-check keeps it to your own row; the COLUMN grant
-- below is what keeps you from editing role / verification / scope.
create policy "update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Column-level guard rails. The row policies above say WHICH row; these say
-- WHICH columns. Default Supabase grants are broad, so revoke and re-grant:
--   * insert may set identity + requested role/scope + contact fields, but NOT
--     is_verified or is_active (they keep their safe defaults: false / true).
--   * update may only touch the contact fields. role, scope and is_verified
--     are therefore settable by the SERVICE ROLE only — i.e. you, in the
--     Supabase dashboard. That's the whole "admin verifies in Supabase" model.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, full_name, role, phone, organization, hospital_id, ambulance_id)
  on public.profiles to authenticated;
grant update (full_name, phone, organization)
  on public.profiles to authenticated;

create policy "orgs readable" on public.organizations
  for select to authenticated using (true);

-- ─── hospitals ──────────────────────────────────────────────────────────
-- Capacity is public: the "/" directory shows it to unauthenticated visitors,
-- and dispatcher ranking + crew hospital lists read it too. anon is included
-- deliberately; writes remain locked to hospital staff by the policy below.
create policy "hospitals readable" on public.hospitals
  for select to anon, authenticated using (true);

create policy "hospital staff edit own" on public.hospitals
  for update to authenticated
  using  ((select public.jwt_role()) = 'hospital' and id = (select public.jwt_hospital_id()))
  with check (id = (select public.jwt_hospital_id()));

-- ─── ambulances ─────────────────────────────────────────────────────────
create policy "fleet readable" on public.ambulances
  for select to authenticated using (true);

create policy "crew updates own vehicle" on public.ambulances
  for update to authenticated
  using  ((select public.jwt_role()) = 'ambulance' and id = (select public.jwt_ambulance_id()))
  with check (id = (select public.jwt_ambulance_id()));

-- dispatcher flips vehicles to 'dispatched' when assigning
create policy "dispatcher updates fleet" on public.ambulances
  for update to authenticated
  using  ((select public.jwt_role()) = 'dispatcher')
  with check ((select public.jwt_role()) = 'dispatcher');

-- ─── dispatches ─────────────────────────────────────────────────────────
create policy "dispatcher reads all" on public.dispatches
  for select to authenticated using ((select public.jwt_role()) = 'dispatcher');

create policy "dispatcher creates" on public.dispatches
  for insert to authenticated with check ((select public.jwt_role()) = 'dispatcher');

create policy "dispatcher reassigns" on public.dispatches
  for update to authenticated
  using  ((select public.jwt_role()) = 'dispatcher')
  with check ((select public.jwt_role()) = 'dispatcher');

-- crew sees ONLY dispatches routed to their vehicle
create policy "crew reads own dispatches" on public.dispatches
  for select to authenticated
  using ((select public.jwt_role()) = 'ambulance'
         and ambulance_id = (select public.jwt_ambulance_id()));

create policy "crew updates own dispatches" on public.dispatches
  for update to authenticated
  using  ((select public.jwt_role()) = 'ambulance'
          and ambulance_id = (select public.jwt_ambulance_id()))
  with check (ambulance_id = (select public.jwt_ambulance_id()));

-- hospital staff see inbound pre-alerts addressed to them
create policy "hospital reads inbound" on public.dispatches
  for select to authenticated
  using ((select public.jwt_role()) = 'hospital'
         and hospital_id = (select public.jwt_hospital_id()));

create policy "hospital confirms arrival" on public.dispatches
  for update to authenticated
  using  ((select public.jwt_role()) = 'hospital'
          and hospital_id = (select public.jwt_hospital_id()))
  with check (hospital_id = (select public.jwt_hospital_id()));

-- ─── donations ──────────────────────────────────────────────────────────
-- The donation flow is genuinely public: "/" is an unauthenticated directory
-- page with a donate form, so anon must keep INSERT and SELECT here. What anon
-- must NOT have is payer_phone, which is a real contact number that nothing in
-- the UI displays.
--
-- RLS is row-level only, so the row policies below are paired with a
-- column-level GRANT. Both have to pass: the policy decides which rows, the
-- grant decides which columns. A stray select('*') from the browser now fails
-- with "permission denied for column payer_phone" instead of quietly leaking.

drop policy if exists "anon full access" on public.donations;

create policy "donations readable" on public.donations
  for select to anon, authenticated using (true);

create policy "anyone may donate" on public.donations
  for insert to anon, authenticated with check (true);

-- Deliberately no UPDATE or DELETE policy: a donation is a receipt. Nobody
-- edits one through the API; corrections go through the service role.

revoke select on public.donations from anon, authenticated;
grant select (id, hospital_id, donor_name, amount, message, payment_method, created_at)
  on public.donations to anon, authenticated;

-- Realtime broadcasts the whole row to every subscriber and does not apply the
-- column grant above, so leaving donations in the publication would hand out
-- payer_phone through the websocket even with the REST path locked down. The
-- public page polls instead — see use-donations.ts.
alter publication supabase_realtime drop table public.donations;

-- ─── items ──────────────────────────────────────────────────────────────
-- Left over from the project template and unused by WheeYaw. Drop the open
-- policy so it isn't the one anon-writable table left standing; drop the table
-- entirely once you've confirmed nothing reads it.
drop policy if exists "anon full access" on public.items;

-- ─── Known limits, stated plainly ───────────────────────────────────────
-- 1. RLS is row-level, not column-level. "hospital staff edit own" lets staff
--    write ANY column on their own row, including total_beds. To restrict:
--      revoke update on public.hospitals from authenticated;
--      grant  update (available_beds, icu_beds_free, current_er_queue,
--                     doctors_on_duty) on public.hospitals to authenticated;
-- 2. "crew updates own dispatches" lets crew rewrite ambulance_id and hand the
--    job to another vehicle. Add a BEFORE UPDATE trigger rejecting that if it
--    matters operationally.
