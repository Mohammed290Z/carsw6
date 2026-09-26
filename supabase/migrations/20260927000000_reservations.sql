-- CARSW6 reservations back end.
--
-- Who can do what:
--   visitors (anon)      submit a request through submit_reservation() only. They can never read,
--                        change or list anything.
--   staff (logged in)    read and update reservations, add notes.
--   admin                everything staff can, plus delete reservations and manage the team.
-- Accounts are never self-created (sign-ups are off in supabase/config.toml): the first account is
-- created in the Supabase dashboard and claims admin; everyone else is invited from the panel.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- team
create table public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text,
  role       text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin');
$$;

-- The very first account to log in becomes admin. Afterwards this does nothing.
create or replace function public.claim_first_admin() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('carsw6_claim_first_admin'));
  if exists (select 1 from public.staff) then
    return false;
  end if;
  insert into public.staff (user_id, email, role)
  select id, email, 'admin' from auth.users where id = auth.uid();
  return true;
end;
$$;

-- ---------------------------------------------------------------- reservations
create table public.reservations (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7)),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- what the visitor asked for
  car            text not null check (char_length(car) between 2 and 80),
  start_date     date not null,
  start_time     time not null default '10:00',
  end_date       date not null,
  end_time       time not null default '10:00',
  place          text not null check (place in ('airport', 'hotel', 'private', 'rabat', 'marrakech')),
  flight         text check (char_length(flight) <= 20),
  payment        text not null check (payment in ('bank', 'crypto')),
  name           text not null check (char_length(btrim(name)) between 2 and 120),
  phone          text not null check (phone ~ '^\+?[0-9 ().-]{8,25}$'),
  lang           text not null default 'fr' check (lang in ('fr', 'en', 'ar')),
  days           int  not null check (days between 1 and 90),
  estimate       int  not null check (estimate between 0 and 10000000),

  -- managed by the team
  status         text not null default 'new'
                 check (status in ('new', 'confirmed', 'paid', 'delivered', 'returned', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  deposit_status text not null default 'none' check (deposit_status in ('none', 'held', 'released')),
  notes          text check (char_length(notes) <= 5000),
  assigned_to    uuid references auth.users (id) on delete set null,

  -- bookkeeping
  ip_hash        text,          -- sha256 of the sender's IP: rate limiting without storing the IP
  notified_at    timestamptz,   -- when the new-request email went out

  constraint reservation_dates check (end_date > start_date)
);

create index reservations_created_idx on public.reservations (created_at desc);
create index reservations_status_idx  on public.reservations (status);
create index reservations_dates_idx   on public.reservations (start_date, end_date);
create index reservations_phone_idx   on public.reservations (phone, created_at);
create index reservations_ip_idx      on public.reservations (ip_hash, created_at);

-- ---------------------------------------------------------------- history
create table public.reservation_events (
  id             bigint generated always as identity primary key,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  at             timestamptz not null default now(),
  actor          uuid,
  actor_email    text,
  kind           text not null,       -- created | status | payment_status | deposit_status | notes | details
  old_value      text,
  new_value      text
);
create index reservation_events_res_idx on public.reservation_events (reservation_id, at);

create or replace function public.log_reservation_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who   uuid := auth.uid();
  email text := (select u.email from auth.users u where u.id = auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.reservation_events (reservation_id, actor, actor_email, kind, new_value)
    values (new.id, who, email, 'created', new.status);
    return new;
  end if;

  new.updated_at := now();
  if new.status is distinct from old.status then
    insert into public.reservation_events (reservation_id, actor, actor_email, kind, old_value, new_value)
    values (new.id, who, email, 'status', old.status, new.status);
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.reservation_events (reservation_id, actor, actor_email, kind, old_value, new_value)
    values (new.id, who, email, 'payment_status', old.payment_status, new.payment_status);
  end if;
  if new.deposit_status is distinct from old.deposit_status then
    insert into public.reservation_events (reservation_id, actor, actor_email, kind, old_value, new_value)
    values (new.id, who, email, 'deposit_status', old.deposit_status, new.deposit_status);
  end if;
  if new.notes is distinct from old.notes then
    insert into public.reservation_events (reservation_id, actor, actor_email, kind)
    values (new.id, who, email, 'notes');
  end if;
  if (new.car, new.start_date, new.start_time, new.end_date, new.end_time, new.place, new.flight)
     is distinct from (old.car, old.start_date, old.start_time, old.end_date, old.end_time, old.place, old.flight) then
    insert into public.reservation_events (reservation_id, actor, actor_email, kind, old_value, new_value)
    values (new.id, who, email, 'details',
            format('%s, %s → %s', old.car, old.start_date, old.end_date),
            format('%s, %s → %s', new.car, new.start_date, new.end_date));
  end if;
  return new;
end;
$$;

create trigger reservations_log_insert after insert on public.reservations
  for each row execute function public.log_reservation_change();
create trigger reservations_log_update before update on public.reservations
  for each row execute function public.log_reservation_change();

-- ---------------------------------------------------------------- the only way in for visitors
-- Validates the request, applies rate limits, stores it, and returns its reference.
-- p_website is a honeypot: humans never see that field, bots fill it in.
create or replace function public.submit_reservation(
  p_car text, p_start date, p_start_time time, p_end date, p_end_time time,
  p_place text, p_flight text, p_payment text, p_name text, p_phone text,
  p_lang text, p_days int, p_estimate int, p_website text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  ip      text := btrim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1));
  iph     text := case when ip = '' then null
                       else encode(extensions.digest(ip || 'carsw6', 'sha256'), 'hex') end;
  new_ref text;
begin
  if coalesce(p_website, '') <> '' then
    -- a bot: answer like a success so it doesn't retry, store nothing
    return upper(substr(md5(random()::text), 1, 7));
  end if;
  if p_start < (now() at time zone 'Africa/Casablanca')::date then
    raise exception 'start_in_past' using errcode = '22023';
  end if;
  if p_end - p_start <> p_days then
    raise exception 'days_mismatch' using errcode = '22023';
  end if;
  if (select count(*) from public.reservations
      where phone = btrim(p_phone) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if iph is not null and (select count(*) from public.reservations
      where ip_hash = iph and created_at > now() - interval '1 hour') >= 8 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.reservations
    (car, start_date, start_time, end_date, end_time, place, flight, payment, name, phone, lang, days, estimate, ip_hash)
  values
    (btrim(p_car), p_start, coalesce(p_start_time, '10:00'), p_end, coalesce(p_end_time, '10:00'), p_place,
     nullif(btrim(coalesce(p_flight, '')), ''), p_payment, btrim(p_name), btrim(p_phone),
     coalesce(p_lang, 'fr'), p_days, p_estimate, iph)
  returning ref into new_ref;
  return new_ref;
end;
$$;

-- ---------------------------------------------------------------- permissions
alter table public.staff              enable row level security;
alter table public.reservations       enable row level security;
alter table public.reservation_events enable row level security;

-- nothing is reachable by default, from anyone
revoke all on public.staff, public.reservations, public.reservation_events from anon, authenticated;
revoke all on function public.submit_reservation(text, date, time, date, time, text, text, text, text, text, text, int, int, text) from public;
revoke all on function public.claim_first_admin() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;

-- visitors: submit only
grant execute on function public.submit_reservation(text, date, time, date, time, text, text, text, text, text, text, int, int, text) to anon, authenticated;

-- logged-in accounts: the checks themselves, and the first-admin claim
grant execute on function public.is_staff(), public.is_admin(), public.claim_first_admin() to authenticated;

-- staff: read and work on reservations (not the bookkeeping columns)
grant select on public.reservations to authenticated;
grant update (car, start_date, start_time, end_date, end_time, place, flight, payment, name, phone,
              status, payment_status, deposit_status, notes, assigned_to)
  on public.reservations to authenticated;
grant delete on public.reservations to authenticated;
grant select on public.reservation_events to authenticated;
grant select on public.staff to authenticated;
grant update (name) on public.staff to authenticated;

create policy "staff read reservations"   on public.reservations for select to authenticated using (public.is_staff());
create policy "staff update reservations" on public.reservations for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "admin delete reservations" on public.reservations for delete to authenticated using (public.is_admin());
create policy "staff read history"        on public.reservation_events for select to authenticated using (public.is_staff());
create policy "staff see the team"        on public.staff for select to authenticated using (public.is_staff());
create policy "edit own name"             on public.staff for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- adding, removing and changing roles goes through the staff-admin Edge Function (service role)

-- live updates in the panel
alter publication supabase_realtime add table public.reservations;
