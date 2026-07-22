-- Public donations + hospital blurbs. Run this in the SQL editor after 0002/0003.
-- NOTE: the app selects the description column, so apply this before deploying
-- a build that includes the public directory page.

alter table public.hospitals
  add column if not exists description text not null default '';

update public.hospitals set description =
  'The country''s largest teaching hospital and the main tertiary referral centre for trauma, cardiac and burn cases.'
  where name = 'Yangon General Hospital';

update public.hospitals set description =
  'A downtown general hospital with strong cardiology and obstetric services, taking pressure off Yangon General.'
  where name = 'New Yangon General Hospital';

update public.hospitals set description =
  'Myanmar''s specialist paediatric referral hospital, caring for newborns and children and handling obstetric emergencies.'
  where name = 'Yangon Children''s Hospital';

update public.hospitals set description =
  'A general hospital in eastern Yangon known for its cardiology and stroke response teams.'
  where name = 'Thingangyun Sanpya General Hospital';

update public.hospitals set description =
  'A busy general and teaching hospital serving Yangon''s densely populated northern townships.'
  where name = 'North Okkalapa General Hospital';

update public.hospitals set description =
  'The main public hospital for north-western Yangon, with round-the-clock trauma and orthopaedic surgery.'
  where name = 'Insein General Hospital';

create table if not exists public.donations (
  id           uuid primary key default gen_random_uuid(),
  hospital_id  uuid references public.hospitals(id) on delete set null,
  donor_name   text not null,
  amount       numeric not null check (amount > 0),
  message      text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists donations_created_at_idx on public.donations (created_at desc);

alter table public.donations enable row level security;

-- ⚠ HACKATHON-ONLY. Same open-anon policy as the other tables; the donation
-- flow is a demo — no payments, no personal data beyond a display name.
drop policy if exists "anon full access" on public.donations;
create policy "anon full access" on public.donations
  for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table public.donations;
