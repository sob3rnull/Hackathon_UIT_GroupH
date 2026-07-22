-- Ambulance fleet. APPLIED to the team's Supabase project on 2026-07-22.
--
-- Vehicles carry an on-board IoT unit that reports GPS and status. Certification
-- is granted only once that device is fitted and reporting — an uncertified
-- vehicle reports no position, cannot be tracked, and is therefore never
-- dispatchable, however close it happens to be to the patient.

create table if not exists public.ambulances (
  id            uuid primary key default gen_random_uuid(),
  callsign      text not null,
  operator      text not null default '',
  device_id     text unique,
  certified     boolean not null default false,
  lat           double precision,
  lng           double precision,
  gps_fix_at    timestamptz,
  status        text not null default 'available'
                check (status in ('available','dispatched','on_scene','transporting','offline')),
  crew_level    text not null default 'basic'
                check (crew_level in ('basic','advanced')),
  updated_at    timestamptz not null default now()
);

create index if not exists ambulances_status_idx on public.ambulances (status);

-- A dispatch now records both legs (response + transport), the incident
-- location, the vehicle that ran it, and how the note was captured.
alter table public.dispatches
  add column if not exists ambulance_id uuid references public.ambulances(id) on delete set null,
  add column if not exists incident_lat double precision,
  add column if not exists incident_lng double precision,
  add column if not exists response_eta_minutes numeric,
  add column if not exists input_mode text not null default 'text';

alter table public.ambulances enable row level security;

-- ⚠ HACKATHON-ONLY, same trade as the other tables: no auth, so anon needs
-- access. Never put real operational fleet data here.
drop policy if exists "anon full access" on public.ambulances;
create policy "anon full access" on public.ambulances
  for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table public.ambulances;

-- ── Seed: the two vehicles CLOSEST to the incident are both unusable ──────
-- Incident is Sule Pagoda (16.7769, 96.1592). YGN-09 is parked essentially on
-- top of it but has no IoT unit; YGN-02 is metres away but already carrying a
-- patient. The winner, YGN-01, is 1 minute out.

insert into public.ambulances
  (callsign, operator, device_id, certified, lat, lng, gps_fix_at, status, crew_level)
values
  ('YGN-01', 'Yangon City EMS',    'IOT-8841', true,  16.7801, 96.1571, now(), 'available',    'advanced'),
  ('YGN-04', 'Yangon City EMS',    'IOT-8844', true,  16.7712, 96.1683, now(), 'available',    'basic'),
  ('YGN-02', 'Yangon City EMS',    'IOT-8842', true,  16.7775, 96.1601, now(), 'transporting', 'advanced'),
  ('YGN-09', 'Private operator',    null,      false, 16.7769, 96.1594, null,  'available',    'basic'),
  ('YGN-06', 'Yangon City EMS',    'IOT-8846', true,  16.8100, 96.1500, now() - interval '2 hours', 'offline', 'basic'),
  ('YGN-11', 'North District EMS', 'IOT-8851', true,  16.8650, 96.1720, now(), 'available',    'advanced');
