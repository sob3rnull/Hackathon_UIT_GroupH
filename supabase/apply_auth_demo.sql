-- ═══════════════════════════════════════════════════════════════════════════
--  WheeYaw — one-shot setup for the demo.
--
--  Applies migration 0007 (auth + RLS), 0008 (demo data), and creates the three
--  demo profiles by looking their user IDs up by email — so you never copy a
--  UUID by hand.
--
--  ── BEFORE YOU RUN THIS ────────────────────────────────────────────────────
--  1. Authentication → Providers → enable Email, switch OFF "Confirm email".
--  2. Authentication → URL Configuration → Site URL http://localhost:3000,
--     and add http://localhost:3000/auth/callback to Redirect URLs.
--  3. Authentication → Users → Add user, three times, with EXACTLY these
--     emails (any password you like):
--         dispatcher@wheeyaw.demo
--         crew@wheeyaw.demo
--         hospital@wheeyaw.demo
--
--  Then paste this whole file into the SQL editor and run it once.
--
--  It runs inside one transaction: if any of the three users is missing it
--  RAISES and rolls the entire thing back, so the app is never left half-locked
--  (RLS on, but no profiles to sign in with). Fix the emails and run again.
--  The script is idempotent — safe to run a second time after a partial fix.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ═══ 0007 — auth + RBAC ════════════════════════════════════════════════════

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

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  role         text not null check (role in ('dispatcher','ambulance','hospital')),
  is_active    boolean not null default true,
  org_id       uuid references public.organizations(id) on delete set null,
  hospital_id  uuid references public.hospitals(id)     on delete set null,
  ambulance_id uuid references public.ambulances(id)    on delete set null,
  created_at   timestamptz not null default now(),
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

alter table public.dispatches
  add column if not exists status text not null default 'pending'
    check (status in ('pending','accepted','en_route','on_scene','transporting','arrived','cancelled')),
  add column if not exists accepted_at timestamptz,
  add column if not exists arrived_at  timestamptz,
  add column if not exists created_by  uuid references public.profiles(id) on delete set null;

create index if not exists dispatches_ambulance_idx on public.dispatches (ambulance_id, status);
create index if not exists dispatches_hospital_idx  on public.dispatches (hospital_id, status);

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

-- ── RLS ─────────────────────────────────────────────────────────────────────
drop policy if exists "anon full access" on public.hospitals;
drop policy if exists "anon full access" on public.dispatches;
drop policy if exists "anon full access" on public.ambulances;

alter table public.profiles      enable row level security;
alter table public.organizations enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "orgs readable" on public.organizations;
create policy "orgs readable" on public.organizations
  for select to authenticated using (true);

drop policy if exists "hospitals readable" on public.hospitals;
create policy "hospitals readable" on public.hospitals
  for select to authenticated using (true);

drop policy if exists "hospital staff edit own" on public.hospitals;
create policy "hospital staff edit own" on public.hospitals
  for update to authenticated
  using  ((select public.jwt_role()) = 'hospital' and id = (select public.jwt_hospital_id()))
  with check (id = (select public.jwt_hospital_id()));

drop policy if exists "fleet readable" on public.ambulances;
create policy "fleet readable" on public.ambulances
  for select to authenticated using (true);

drop policy if exists "crew updates own vehicle" on public.ambulances;
create policy "crew updates own vehicle" on public.ambulances
  for update to authenticated
  using  ((select public.jwt_role()) = 'ambulance' and id = (select public.jwt_ambulance_id()))
  with check (id = (select public.jwt_ambulance_id()));

drop policy if exists "dispatcher updates fleet" on public.ambulances;
create policy "dispatcher updates fleet" on public.ambulances
  for update to authenticated
  using  ((select public.jwt_role()) = 'dispatcher')
  with check ((select public.jwt_role()) = 'dispatcher');

drop policy if exists "dispatcher reads all" on public.dispatches;
create policy "dispatcher reads all" on public.dispatches
  for select to authenticated using ((select public.jwt_role()) = 'dispatcher');

drop policy if exists "dispatcher creates" on public.dispatches;
create policy "dispatcher creates" on public.dispatches
  for insert to authenticated with check ((select public.jwt_role()) = 'dispatcher');

drop policy if exists "dispatcher reassigns" on public.dispatches;
create policy "dispatcher reassigns" on public.dispatches
  for update to authenticated
  using  ((select public.jwt_role()) = 'dispatcher')
  with check ((select public.jwt_role()) = 'dispatcher');

drop policy if exists "crew reads own dispatches" on public.dispatches;
create policy "crew reads own dispatches" on public.dispatches
  for select to authenticated
  using ((select public.jwt_role()) = 'ambulance'
         and ambulance_id = (select public.jwt_ambulance_id()));

drop policy if exists "crew updates own dispatches" on public.dispatches;
create policy "crew updates own dispatches" on public.dispatches
  for update to authenticated
  using  ((select public.jwt_role()) = 'ambulance'
          and ambulance_id = (select public.jwt_ambulance_id()))
  with check (ambulance_id = (select public.jwt_ambulance_id()));

drop policy if exists "hospital reads inbound" on public.dispatches;
create policy "hospital reads inbound" on public.dispatches
  for select to authenticated
  using ((select public.jwt_role()) = 'hospital'
         and hospital_id = (select public.jwt_hospital_id()));

drop policy if exists "hospital confirms arrival" on public.dispatches;
create policy "hospital confirms arrival" on public.dispatches
  for update to authenticated
  using  ((select public.jwt_role()) = 'hospital'
          and hospital_id = (select public.jwt_hospital_id()))
  with check (hospital_id = (select public.jwt_hospital_id()));

-- donations: public flow stays open, but payer_phone is stripped at the grant.
drop policy if exists "anon full access" on public.donations;

drop policy if exists "donations readable" on public.donations;
create policy "donations readable" on public.donations
  for select to anon, authenticated using (true);

drop policy if exists "anyone may donate" on public.donations;
create policy "anyone may donate" on public.donations
  for insert to anon, authenticated with check (true);

revoke select on public.donations from anon, authenticated;
grant select (id, hospital_id, donor_name, amount, message, payment_method, created_at)
  on public.donations to anon, authenticated;

-- Realtime ignores column grants, so drop donations from the publication or it
-- leaks payer_phone over the websocket. Guarded — it errors if already absent.
do $$
begin
  alter publication supabase_realtime drop table public.donations;
exception when others then null;
end $$;

drop policy if exists "anon full access" on public.items;

-- ═══ 0008 — demo data (idempotent) ═════════════════════════════════════════

insert into public.organizations (name, kind)
select v.name, v.kind
from (values
  ('Yangon City EMS',            'ems'),
  ('North District EMS',         'ems'),
  ('Yangon Public Hospitals',    'hospital'),
  ('Yangon Emergency Control',   'dispatch_center')
) as v(name, kind)
where not exists (select 1 from public.organizations o where o.name = v.name);

update public.ambulances a
set org_id = o.id
from public.organizations o
where o.name = a.operator and a.org_id is null;

update public.hospitals h
set org_id = o.id
from public.organizations o
where o.name = 'Yangon Public Hospitals' and h.org_id is null;

-- Only seeds dispatches when the table is empty, so re-running never duplicates.
insert into public.dispatches (
  patient_note, condition, severity, required_specialty, needs_icu,
  incident_lat, incident_lng, eta_minutes, response_eta_minutes,
  was_override, input_mode, status, accepted_at, arrived_at,
  ambulance_id, hospital_id, recommended_hospital_id
)
select
  v.patient_note, v.condition, v.severity, v.required_specialty, v.needs_icu,
  v.incident_lat, v.incident_lng, v.eta_minutes, v.response_eta_minutes,
  v.was_override, v.input_mode, v.status, v.accepted_after, v.arrived_after,
  (select id from public.ambulances where callsign  = v.callsign),
  (select id from public.hospitals  where short_name = v.hospital),
  (select id from public.hospitals  where short_name = v.recommended)
from (values
  ('Elderly man collapsed at the market, breathing but unresponsive.',
   'cardiac', 'critical', 'cardiology', true,
   16.7769, 96.1592, 0::numeric, null::numeric, false, 'text', 'pending',
   null::timestamptz, null::timestamptz, null::text, null::text, 'Thingangyun Sanpya'),
  ('Motorcycle collision on Pyay Road, open leg fracture, conscious.',
   'trauma', 'urgent', 'trauma', false,
   16.8021, 96.1385, 14::numeric, 6::numeric, false, 'voice', 'accepted',
   now() - interval '4 minutes', null::timestamptz, 'YGN-04', null::text, 'Insein'),
  ('Suspected stroke, facial droop noted, symptom onset ~40 min ago.',
   'neuro', 'critical', 'neurology', true,
   16.7912, 96.1631, 11::numeric, 3::numeric, false, 'text', 'transporting',
   now() - interval '18 minutes', null::timestamptz, 'YGN-02', 'Thingangyun Sanpya', 'Thingangyun Sanpya'),
  ('Kitchen scald to forearm, child, alert and crying.',
   'burns', 'stable', 'paediatrics', false,
   16.7854, 96.1442, 7::numeric, 5::numeric, false, 'text', 'arrived',
   now() - interval '3 hours', now() - interval '2 hours 40 minutes', 'YGN-01', 'Children''s', 'Children''s'),
  ('Chest pain radiating to left arm, diaphoretic, hypertensive.',
   'cardiac', 'critical', 'cardiology', true,
   16.8199, 96.1874, 9::numeric, 4::numeric, true, 'voice', 'arrived',
   now() - interval '6 hours', now() - interval '5 hours 42 minutes', 'YGN-11', 'North Okkalapa', 'Yangon General')
) as v(
  patient_note, condition, severity, required_specialty, needs_icu,
  incident_lat, incident_lng, eta_minutes, response_eta_minutes,
  was_override, input_mode, status, accepted_after, arrived_after,
  callsign, hospital, recommended
)
where not exists (select 1 from public.dispatches);

update public.ambulances set status = 'transporting' where callsign = 'YGN-02';
update public.ambulances set status = 'dispatched'   where callsign = 'YGN-04';

-- ═══ Profiles, keyed by email ══════════════════════════════════════════════

-- Fail loudly (and roll back everything above) if the accounts don't exist yet.
do $$
declare missing text;
begin
  select string_agg(e, ', ') into missing
  from (values
    ('dispatcher@wheeyaw.demo'),
    ('crew@wheeyaw.demo'),
    ('hospital@wheeyaw.demo')
  ) as x(e)
  where not exists (select 1 from auth.users u where u.email = x.e);

  if missing is not null then
    raise exception
      'Create these users first (Authentication → Users → Add user): %', missing;
  end if;
end $$;

-- crew → YGN-02 and hospital → Thingangyun Sanpya on purpose: YGN-02 is the
-- vehicle transporting the stroke patient TO Sanpya, so the crew and hospital
-- logins share one live mission for the demo.
insert into public.profiles (id, full_name, role, hospital_id, ambulance_id)
select u.id, p.full_name, p.role, p.hospital_id, p.ambulance_id
from (values
  ('dispatcher@wheeyaw.demo', 'Dispatch One', 'dispatcher',
     null::uuid, null::uuid),
  ('crew@wheeyaw.demo', 'Crew YGN-02', 'ambulance',
     null::uuid, (select id from public.ambulances where callsign = 'YGN-02')),
  ('hospital@wheeyaw.demo', 'Sanpya Staff', 'hospital',
     (select id from public.hospitals where short_name = 'Thingangyun Sanpya'), null::uuid)
) as p(email, full_name, role, hospital_id, ambulance_id)
join auth.users u on u.email = p.email
on conflict (id) do update
  set role         = excluded.role,
      full_name    = excluded.full_name,
      hospital_id  = excluded.hospital_id,
      ambulance_id = excluded.ambulance_id;

commit;

-- ── Verify: three rows, each with a non-null role. The claim sync ran if
--    raw_app_meta_data shows the role — users must sign in AFTER this for their
--    token to carry it.
select u.email, pr.role, pr.hospital_id, pr.ambulance_id,
       u.raw_app_meta_data ->> 'role' as claim_role
from public.profiles pr
join auth.users u on u.id = pr.id
order by pr.role;
