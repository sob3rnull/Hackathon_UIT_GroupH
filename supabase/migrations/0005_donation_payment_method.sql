-- Payment method on donations. Run in the SQL editor after 0004.
-- Demo flow only: the method is recorded for display; no gateway is called
-- and no card or wallet details are ever stored.

alter table public.donations
  add column if not exists payment_method text not null default '';
