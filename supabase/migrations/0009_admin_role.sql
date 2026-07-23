-- Admin role. APPLIED to the live DB. A single login that opens every dashboard
-- and reads/writes all operational data — a hackathon test convenience, NOT a
-- production posture. There is no admin UI and no self-registration as admin;
-- an admin is made by setting role='admin' on a profile in the Supabase editor.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('dispatcher','ambulance','hospital','admin'));

-- Admin may carry any scope (a vehicle AND a hospital) so every dashboard has
-- context; the per-role rules still bind the other three roles.
alter table public.profiles drop constraint if exists profiles_scope_ck;
alter table public.profiles add constraint profiles_scope_ck check (
  role = 'admin'
  or (role = 'dispatcher' and hospital_id is null and ambulance_id is null)
  or (role = 'ambulance'  and hospital_id is null)
  or (role = 'hospital'   and ambulance_id is null and hospital_id is not null)
);

-- Additive "for all" policies — they OR with the per-role ones, granting admin
-- full read/write on the operational tables.
drop policy if exists "admin all dispatches" on public.dispatches;
create policy "admin all dispatches" on public.dispatches
  for all to authenticated
  using ((select public.jwt_role()) = 'admin')
  with check ((select public.jwt_role()) = 'admin');

drop policy if exists "admin all ambulances" on public.ambulances;
create policy "admin all ambulances" on public.ambulances
  for all to authenticated
  using ((select public.jwt_role()) = 'admin')
  with check ((select public.jwt_role()) = 'admin');

drop policy if exists "admin all hospitals" on public.hospitals;
create policy "admin all hospitals" on public.hospitals
  for all to authenticated
  using ((select public.jwt_role()) = 'admin')
  with check ((select public.jwt_role()) = 'admin');

-- Make an admin (run in the SQL editor with the account's email):
-- update public.profiles set role='admin', is_verified=true,
--   ambulance_id=(select id from public.ambulances where callsign='YGN-01'),
--   hospital_id =(select id from public.hospitals where short_name='Thingangyun Sanpya')
-- where id=(select id from auth.users where email='you@example.demo');
