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
  is_active    boolean not null default true,
  org_id       uuid references public.organizations(id) on delete set null,
  hospital_id  uuid references public.hospitals(id)     on delete set null,
  ambulance_id uuid references public.ambulances(id)    on delete set null,
  created_at   timestamptz not null default now(),

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

-- ─── Sync profiles -> app_metadata so those claims exist ────────────────
create or replace function public.sync_profile_claims() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update auth.users set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'role',         new.role,
      'hospital_id',  new.hospital_id,
      'ambulance_id', new.ambulance_id
    )
  where id = new.id;
  return new;
end $$;

drop trigger if exists profiles_sync_claims on public.profiles;
create trigger profiles_sync_claims
  after insert or update of role, hospital_id, ambulance_id on public.profiles
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

-- profiles: you read yourself. No other policy = nobody else can, as intended.
create policy "read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "orgs readable" on public.organizations
  for select to authenticated using (true);

-- ─── hospitals ──────────────────────────────────────────────────────────
-- everyone signed in reads capacity (dispatcher ranking, crew hospital list)
create policy "hospitals readable" on public.hospitals
  for select to authenticated using (true);

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

-- ─── Known limits, stated plainly ───────────────────────────────────────
-- 1. RLS is row-level, not column-level. "hospital staff edit own" lets staff
--    write ANY column on their own row, including total_beds. To restrict:
--      revoke update on public.hospitals from authenticated;
--      grant  update (available_beds, icu_beds_free, current_er_queue,
--                     doctors_on_duty) on public.hospitals to authenticated;
-- 2. "crew updates own dispatches" lets crew rewrite ambulance_id and hand the
--    job to another vehicle. Add a BEFORE UPDATE trigger rejecting that if it
--    matters operationally.
