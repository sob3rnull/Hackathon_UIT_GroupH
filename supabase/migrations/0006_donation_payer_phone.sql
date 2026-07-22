-- Payer contact/wallet phone on donations. Run in the SQL editor after 0005.
-- For wallet methods (KBZPay, AYA Pay, Wave, CB Pay) this is the number the
-- wallet is registered to. Bank account and card numbers are deliberately
-- NEVER stored - demo flow, no gateway.

alter table public.donations
  add column if not exists payer_phone text not null default '';
