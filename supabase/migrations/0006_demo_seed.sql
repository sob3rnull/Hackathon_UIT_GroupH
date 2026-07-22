-- Demo data for the walkthrough. NOT YET APPLIED. Run AFTER 0005.
--
-- Everything here is fictional. It exists so the three dashboards have
-- something to show before anyone touches a live incident.
--
-- ⚠ What this file deliberately does NOT seed: public.profiles.
-- That table's primary key references auth.users, so a profile can only be
-- created once a real auth account exists. Create the accounts in the Supabase
-- dashboard (Authentication -> Users), then run the insert at the bottom of
-- this file with their UUIDs pasted in. Until that happens every signed-in
-- user lands on /pending, and with zero accounts nobody can sign in at all.
--
-- Note: no generated UUID is hardcoded below. Rows are located by their
-- natural keys (callsign, short_name) so this stays re-runnable against a
-- freshly seeded database.

-- ─── Organizations ──────────────────────────────────────────────────────
insert into public.organizations (name, kind)
select v.name, v.kind
from (values
  ('Yangon City EMS',            'ems'),
  ('North District EMS',         'ems'),
  ('Yangon Public Hospitals',    'hospital'),
  ('Yangon Emergency Control',   'dispatch_center')
) as v(name, kind)
where not exists (
  select 1 from public.organizations o where o.name = v.name
);

-- Wire the existing fleet and hospitals to those organizations.
update public.ambulances a
set org_id = o.id
from public.organizations o
where o.name = a.operator
  and a.org_id is null;

update public.hospitals h
set org_id = o.id
from public.organizations o
where o.name = 'Yangon Public Hospitals'
  and h.org_id is null;

-- ─── Demo dispatches across the whole mission lifecycle ─────────────────
-- Gives the dispatcher a populated queue, the crew an active job, and the
-- hospital an inbound pre-alert plus some history.

insert into public.dispatches (
  patient_note, condition, severity, required_specialty, needs_icu,
  incident_lat, incident_lng, eta_minutes, response_eta_minutes,
  was_override, input_mode, status, accepted_at, arrived_at,
  ambulance_id, hospital_id, recommended_hospital_id
)
select
  v.patient_note, v.condition, v.severity, v.required_specialty, v.needs_icu,
  v.incident_lat, v.incident_lng, v.eta_minutes, v.response_eta_minutes,
  v.was_override, v.input_mode, v.status,
  v.accepted_after, v.arrived_after,
  (select id from public.ambulances where callsign  = v.callsign),
  (select id from public.hospitals  where short_name = v.hospital),
  (select id from public.hospitals  where short_name = v.recommended)
from (values
  -- Just called in. Sitting in the dispatcher's queue, no vehicle yet.
  ('Elderly man collapsed at the market, breathing but unresponsive.',
   'cardiac', 'critical', 'cardiology', true,
   16.7769, 96.1592, 0::numeric, null::numeric, false, 'text', 'pending',
   null::timestamptz, null::timestamptz,
   null::text, null::text, 'Thingangyun Sanpya'),

  -- Assigned and accepted; crew is rolling but hasn't arrived on scene.
  ('Motorcycle collision on Pyay Road, open leg fracture, conscious.',
   'trauma', 'urgent', 'trauma', false,
   16.8021, 96.1385, 14::numeric, 6::numeric, false, 'voice', 'accepted',
   now() - interval '4 minutes', null::timestamptz,
   'YGN-04', null::text, 'Insein'),

  -- Mid-transport. This is the one the hospital sees as an inbound pre-alert.
  ('Suspected stroke, facial droop noted, symptom onset ~40 min ago.',
   'neuro', 'critical', 'neurology', true,
   16.7912, 96.1631, 11::numeric, 3::numeric, false, 'text', 'transporting',
   now() - interval '18 minutes', null::timestamptz,
   'YGN-02', 'Thingangyun Sanpya', 'Thingangyun Sanpya'),

  -- Completed earlier today. Populates /history.
  ('Kitchen scald to forearm, child, alert and crying.',
   'burns', 'stable', 'paediatrics', false,
   16.7854, 96.1442, 7::numeric, 5::numeric, false, 'text', 'arrived',
   now() - interval '3 hours', now() - interval '2 hours 40 minutes',
   'YGN-01', 'Children''s', 'Children''s'),

  -- Completed, and the crew overrode the AI's pick. Shows was_override in UI.
  ('Chest pain radiating to left arm, diaphoretic, hypertensive.',
   'cardiac', 'critical', 'cardiology', true,
   16.8199, 96.1874, 9::numeric, 4::numeric, true, 'voice', 'arrived',
   now() - interval '6 hours', now() - interval '5 hours 42 minutes',
   'YGN-11', 'North Okkalapa', 'Yangon General')
) as v(
  patient_note, condition, severity, required_specialty, needs_icu,
  incident_lat, incident_lng, eta_minutes, response_eta_minutes,
  was_override, input_mode, status, accepted_after, arrived_after,
  callsign, hospital, recommended
);

-- Keep the fleet consistent with the dispatches above, so the dispatcher's
-- map doesn't show a vehicle as free while it's mid-transport.
update public.ambulances set status = 'transporting' where callsign = 'YGN-02';
update public.ambulances set status = 'dispatched'   where callsign = 'YGN-04';

-- ═══════════════════════════════════════════════════════════════════════
--  MANUAL STEP — profiles. Cannot be scripted; needs real auth accounts.
-- ═══════════════════════════════════════════════════════════════════════
-- 1. Supabase dashboard -> Authentication -> Providers -> enable Email
--    (switch OFF "Confirm email" for the demo, or you need live inboxes).
-- 2. Authentication -> URL Configuration -> Site URL http://localhost:3000
--    and add http://localhost:3000/auth/callback to Redirect URLs.
-- 3. Authentication -> Users -> Add user, three times. Copy each UUID.
-- 4. Run this, with the UUIDs pasted in:
--
-- insert into public.profiles (id, full_name, role, hospital_id, ambulance_id)
-- values
--   ('<dispatcher-uuid>', 'Dispatch One', 'dispatcher', null, null),
--   ('<crew-uuid>',       'Crew YGN-01',  'ambulance',  null,
--      (select id from public.ambulances where callsign = 'YGN-01')),
--   ('<hospital-uuid>',   'Sanpya Staff', 'hospital',
--      (select id from public.hospitals where short_name = 'Thingangyun Sanpya'),
--      null);
--
-- Assign the hospital account to Thingangyun Sanpya specifically: it's the
-- receiving hospital for the 'transporting' dispatch above, so that user sees
-- a live inbound patient the moment they sign in.
