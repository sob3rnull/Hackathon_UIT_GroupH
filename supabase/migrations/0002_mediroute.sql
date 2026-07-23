-- WheeYaw schema. APPLIED to the team's Supabase project on 2026-07-22.
-- Run this in the SQL editor to rebuild from scratch, then run the seed below.

create table if not exists public.hospitals (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  short_name        text not null,
  lat               double precision not null,
  lng               double precision not null,
  specialties       text[] not null default '{}',
  total_beds        int not null default 0,
  available_beds    int not null default 0,
  icu_beds_free     int not null default 0,
  doctors_on_duty   jsonb not null default '{}'::jsonb,
  er_capacity       int not null default 20,
  current_er_queue  int not null default 0,
  updated_at        timestamptz not null default now()
);

create table if not exists public.dispatches (
  id                      uuid primary key default gen_random_uuid(),
  hospital_id             uuid references public.hospitals(id) on delete set null,
  recommended_hospital_id uuid references public.hospitals(id) on delete set null,
  patient_note            text not null default '',
  condition               text not null default 'general',
  severity                text not null default 'urgent',
  required_specialty      text not null default 'general',
  needs_icu               boolean not null default false,
  eta_minutes             numeric not null default 0,
  was_override            boolean not null default false,
  created_at              timestamptz not null default now()
);

create index if not exists dispatches_created_at_idx on public.dispatches (created_at desc);

alter table public.hospitals  enable row level security;
alter table public.dispatches enable row level security;

-- ⚠ HACKATHON-ONLY. The app has no sign-in, so the anon role gets unconditional
-- read/write — and the anon key ships in the browser bundle. Supabase's linter
-- flags this (rls_policy_always_true); that warning is expected and accepted.
-- Fine for fictional demo data. NEVER put real patient information here.
drop policy if exists "anon full access" on public.hospitals;
create policy "anon full access" on public.hospitals
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.dispatches;
create policy "anon full access" on public.dispatches
  for all to anon, authenticated using (true) with check (true);

-- Realtime: the dispatcher view subscribes to capacity changes so the ranking
-- updates the instant hospital staff free a bed on another machine.
alter publication supabase_realtime add table public.hospitals;

-- ── Seed: real Yangon hospitals, arranged so the demo has an obvious trap ──
-- Incident is Sule Pagoda (16.7769, 96.1592). For a critical cardiac patient
-- the three CLOSEST hospitals are all ineligible; the winner is 15 min away.

insert into public.hospitals
  (name, short_name, lat, lng, specialties, total_beds, available_beds, icu_beds_free, doctors_on_duty, er_capacity, current_er_queue)
values
  ('Yangon General Hospital', 'Yangon General', 16.7797, 96.1500,
   '{cardiology,trauma,neurology,burns,general}', 600, 0, 0,
   '{"cardiology":3,"trauma":2,"neurology":1,"general":6}'::jsonb, 40, 45),

  ('New Yangon General Hospital', 'New Yangon', 16.7743, 96.1420,
   '{cardiology,obstetrics,general}', 300, 6, 0,
   '{"cardiology":0,"obstetrics":1,"general":2}'::jsonb, 30, 26),

  ('Yangon Children''s Hospital', 'Children''s', 16.7856, 96.1436,
   '{paediatrics,obstetrics,general}', 250, 40, 3,
   '{"paediatrics":3,"obstetrics":2,"general":4}'::jsonb, 20, 5),

  ('Thingangyun Sanpya General Hospital', 'Thingangyun Sanpya', 16.8206, 96.1897,
   '{cardiology,neurology,general}', 220, 22, 4,
   '{"cardiology":2,"neurology":1,"general":3}'::jsonb, 28, 9),

  ('North Okkalapa General Hospital', 'North Okkalapa', 16.9086, 96.1706,
   '{cardiology,trauma,general}', 400, 55, 6,
   '{"cardiology":1,"trauma":2,"general":5}'::jsonb, 35, 12),

  ('Insein General Hospital', 'Insein', 16.8944, 96.1053,
   '{trauma,orthopaedics,general}', 300, 30, 2,
   '{"trauma":3,"orthopaedics":1,"general":4}'::jsonb, 25, 8);
