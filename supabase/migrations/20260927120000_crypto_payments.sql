-- Crypto payments through NOWPayments.
--
-- Staff create a payment link (an invoice) for a confirmed reservation from the panel; the client
-- pays on NOWPayments' page; NOWPayments reports back to the nowpayments-ipn function, which checks
-- the signature, re-checks the payment with NOWPayments' API, and records it here.

-- two more payment states: a link has been sent, and a partial payment arrived
alter table public.reservations drop constraint reservations_payment_status_check;
alter table public.reservations add constraint reservations_payment_status_check
  check (payment_status in ('unpaid', 'awaiting', 'partial', 'paid', 'refunded'));

alter table public.reservations
  add column payment_url        text,          -- the NOWPayments invoice page sent to the client
  add column payment_invoice_id text,
  add column payment_amount     int check (payment_amount between 1 and 10000000),   -- MAD asked for
  add column payment_link_at    timestamptz,
  add column paid_at            timestamptz;

-- every notification NOWPayments sends, as received (after verification)
create table public.payments (
  id             bigint generated always as identity primary key,
  reservation_id uuid references public.reservations (id) on delete cascade,
  provider       text not null default 'nowpayments',
  invoice_id     text,
  payment_id     text,
  status         text not null,     -- waiting | confirming | confirmed | sending | partially_paid | finished | failed | refunded | expired
  price_amount   numeric,
  price_currency text,
  pay_amount     numeric,
  actually_paid  numeric,
  pay_currency   text,
  raw            jsonb,
  created_at     timestamptz not null default now()
);
create index payments_reservation_idx on public.payments (reservation_id, created_at);
create unique index payments_dedupe_idx on public.payments (payment_id, status);  -- NOWPayments may resend

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy "staff read payments" on public.payments for select to authenticated using (public.is_staff());

-- the payment columns are written by the Edge Functions only (service role), never from a browser
alter publication supabase_realtime add table public.payments;
