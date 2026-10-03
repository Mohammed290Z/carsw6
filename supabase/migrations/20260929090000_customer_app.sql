-- Customer accounts for the mobile app (and later the website).
--
-- Customers sign in with a one-time code sent to their email (Supabase Auth). A signed-in customer
-- is an `authenticated` user who is NOT in public.staff, so the staff policies on reservations never
-- match them: they still cannot read, change or list the reservations table directly. Everything a
-- customer can do goes through the security-definer functions below, which only ever touch the
-- caller's own rows and only return columns meant for them (no staff notes, IP hashes, assignees).
--
-- Availability: each car model is one vehicle. A reservation that staff have confirmed (confirmed,
-- paid or delivered) blocks the car for its dates; pending requests don't. The guard trigger
-- enforces this for every writer — website, app and staff panel alike.

-- ---------------------------------------------------------------- customers
create table public.customers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text check (char_length(btrim(name)) between 2 and 120),
  phone      text check (phone ~ '^\+?[0-9 ().-]{8,25}$'),
  lang       text not null default 'fr' check (lang in ('fr', 'en', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customers enable row level security;
revoke all on public.customers from anon, authenticated;

-- devices where the customer app may show notifications (Expo push tokens)
create table public.customer_devices (
  token      text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  platform   text check (platform in ('ios', 'android')),
  created_at timestamptz not null default now()
);
create index customer_devices_user_idx on public.customer_devices (user_id);
alter table public.customer_devices enable row level security;
revoke all on public.customer_devices from anon, authenticated;

alter table public.reservations
  add column customer_id              uuid references auth.users (id) on delete set null,
  add column customer_notified_status text,          -- last status the customer was told about
  add column cancel_push_sent_at      timestamptz;   -- staff told about a customer cancellation
create index reservations_customer_idx on public.reservations (customer_id, start_date desc);

-- ---------------------------------------------------------------- availability
create or replace function public.blocks_car(p_status text) returns boolean
language sql immutable set search_path = '' as $$
  select p_status in ('confirmed', 'paid', 'delivered');
$$;

create or replace function public.reservation_span(p_start date, p_start_time time, p_end date, p_end_time time)
returns tsrange language sql immutable set search_path = '' as $$
  select tsrange(p_start + coalesce(p_start_time, '10:00'), p_end + coalesce(p_end_time, '10:00'), '[)');
$$;

-- Refuse a second confirmed booking of the same car over the same hours. Advisory lock per car so
-- two staff confirming at the same moment can't both pass the check.
create or replace function public.guard_car_overlap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.blocks_car(new.status) then
    return new;
  end if;
  if tg_op = 'UPDATE' and public.blocks_car(old.status) and (new.car, new.start_date, new.start_time, new.end_date, new.end_time)
     is not distinct from (old.car, old.start_date, old.start_time, old.end_date, old.end_time) then
    return new;   -- already blocking with the same dates: nothing new to check
  end if;
  perform pg_advisory_xact_lock(hashtext('carsw6_car:' || lower(new.car)));
  if exists (
    select 1 from public.reservations r
    where r.id <> new.id and lower(r.car) = lower(new.car) and public.blocks_car(r.status)
      and public.reservation_span(r.start_date, r.start_time, r.end_date, r.end_time)
          && public.reservation_span(new.start_date, new.start_time, new.end_date, new.end_time)
  ) then
    raise exception 'car_unavailable' using errcode = 'P0001',
      hint = 'Another confirmed booking already has this car for these dates.';
  end if;
  return new;
end;
$$;
create trigger reservations_guard_overlap before insert or update on public.reservations
  for each row execute function public.guard_car_overlap();

-- Public: when is each car taken? Dates and car names only, never who booked.
create or replace function public.car_busy(p_from date, p_to date, p_car text default null)
returns table (car text, start_at timestamp, end_at timestamp)
language sql stable security definer set search_path = '' as $$
  select r.car, r.start_date + r.start_time, r.end_date + r.end_time
  from public.reservations r
  where public.blocks_car(r.status)
    and p_to >= p_from and p_to - p_from <= 400
    and (p_car is null or lower(r.car) = lower(p_car))
    and public.reservation_span(r.start_date, r.start_time, r.end_date, r.end_time)
        && tsrange(p_from::timestamp, (p_to + 1)::timestamp, '[)')
  order by 2;
$$;

-- ---------------------------------------------------------------- submitting
-- Same signature as before, so the website keeps working unchanged. New: a request for dates the
-- car is already confirmed for is refused, and a signed-in customer's request is linked to them.
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
  me      uuid := case when auth.uid() is not null and not public.is_staff() then auth.uid() end;
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
  if exists (
    select 1 from public.reservations r
    where lower(r.car) = lower(btrim(p_car)) and public.blocks_car(r.status)
      and public.reservation_span(r.start_date, r.start_time, r.end_date, r.end_time)
          && public.reservation_span(p_start, p_start_time, p_end, p_end_time)
  ) then
    raise exception 'car_unavailable' using errcode = 'P0001';
  end if;

  insert into public.reservations
    (car, start_date, start_time, end_date, end_time, place, flight, payment, payment_status,
     name, phone, lang, days, estimate, ip_hash, customer_id)
  values
    (btrim(p_car), p_start, coalesce(p_start_time, '10:00'), p_end, coalesce(p_end_time, '10:00'), p_place,
     nullif(btrim(coalesce(p_flight, '')), ''), p_payment,
     case when p_payment = 'crypto' then 'awaiting' else 'unpaid' end,
     btrim(p_name), btrim(p_phone), coalesce(p_lang, 'fr'), p_days, p_estimate, iph, me)
  returning ref into new_ref;
  return new_ref;
end;
$$;

-- ---------------------------------------------------------------- a customer's own data
create or replace function public.my_profile()
returns table (email text, name text, phone text, lang text)
language sql stable security definer set search_path = '' as $$
  select u.email::text, c.name, c.phone, coalesce(c.lang, 'fr')
  from auth.users u left join public.customers c on c.user_id = u.id
  where u.id = auth.uid();
$$;

create or replace function public.save_my_profile(p_name text, p_phone text, p_lang text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  insert into public.customers (user_id, email, name, phone, lang)
  values (auth.uid(), (select u.email from auth.users u where u.id = auth.uid()),
          nullif(btrim(p_name), ''), nullif(btrim(p_phone), ''), coalesce(p_lang, 'fr'))
  on conflict (user_id) do update
    set name = excluded.name, phone = excluded.phone, lang = excluded.lang, updated_at = now();
end;
$$;

-- a booking can be cancelled by its customer while nothing has been paid or handed over, and
-- until it starts; after that it's a conversation with the concierge (refunds, deposits)
create or replace function public.can_cancel(p_status text, p_payment_status text, p_start date, p_start_time time)
returns boolean language sql stable set search_path = '' as $$
  select p_status in ('new', 'confirmed') and p_payment_status in ('unpaid', 'awaiting')
     and p_start + coalesce(p_start_time, '10:00') > (now() at time zone 'Africa/Casablanca');
$$;

create or replace function public.my_reservations()
returns table (
  ref text, created_at timestamptz, updated_at timestamptz, car text,
  start_date date, start_time time, end_date date, end_time time,
  place text, flight text, payment text, payment_status text, status text,
  days int, estimate int, name text, phone text, lang text, can_cancel boolean
)
language sql stable security definer set search_path = '' as $$
  select r.ref, r.created_at, r.updated_at, r.car, r.start_date, r.start_time, r.end_date, r.end_time,
         r.place, r.flight, r.payment, r.payment_status, r.status, r.days, r.estimate, r.name, r.phone, r.lang,
         public.can_cancel(r.status, r.payment_status, r.start_date, r.start_time)
  from public.reservations r
  where auth.uid() is not null and r.customer_id = auth.uid()
  order by r.start_date desc, r.created_at desc;
$$;

-- the customer-facing part of a booking's history: when it was made and each status change
create or replace function public.my_reservation_events(p_ref text)
returns table (at timestamptz, kind text, value text)
language sql stable security definer set search_path = '' as $$
  select e.at, e.kind, e.new_value
  from public.reservation_events e join public.reservations r on r.id = e.reservation_id
  where auth.uid() is not null and r.customer_id = auth.uid() and r.ref = upper(btrim(p_ref))
    and e.kind in ('created', 'status', 'payment_status')
  order by e.at;
$$;

create or replace function public.cancel_my_reservation(p_ref text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservations;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select * into r from public.reservations
  where ref = upper(btrim(p_ref)) and customer_id = auth.uid() for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_cancel(r.status, r.payment_status, r.start_date, r.start_time) then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;
  update public.reservations set status = 'cancelled' where id = r.id;
end;
$$;

create or replace function public.register_customer_device(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  insert into public.customer_devices (token, user_id, platform) values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, created_at = now();
end;
$$;

create or replace function public.unregister_customer_device(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.customer_devices where token = p_token and user_id = auth.uid();
$$;

-- App Store rule: an account made in the app can be deleted from the app. The customer's bookings
-- stay for the business's records, unlinked from the account (customer_id becomes null).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if public.is_staff() then raise exception 'staff_account' using errcode = '42501'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------- notifications
-- Tell the customer when staff change their booking's status (confirmed, paid, delivered, …),
-- and tell staff when a customer cancels. Both go through Edge Functions, which re-read the row
-- and dedupe, so a repeated or forged call can't send anything twice.
create or replace function public.notify_status_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is not distinct from old.status and new.payment_status is not distinct from old.payment_status then
    return new;
  end if;
  if new.customer_id is not null and auth.uid() is distinct from new.customer_id then
    perform net.http_post(
      url := 'https://oacqrhcjvycijrcuukhd.supabase.co/functions/v1/notify-customer',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000);
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.customer_id is not null
     and auth.uid() = new.customer_id then
    perform net.http_post(
      url := 'https://oacqrhcjvycijrcuukhd.supabase.co/functions/v1/notify-push',
      body := jsonb_build_object('id', new.id, 'event', 'cancelled'),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000);
  end if;
  return new;
end;
$$;
create trigger reservations_notify_status after update of status, payment_status on public.reservations
  for each row execute function public.notify_status_change();

-- ---------------------------------------------------------------- permissions
revoke all on function
  public.car_busy(date, date, text), public.my_profile(), public.save_my_profile(text, text, text),
  public.my_reservations(), public.my_reservation_events(text), public.cancel_my_reservation(text),
  public.register_customer_device(text, text), public.unregister_customer_device(text),
  public.delete_my_account(), public.can_cancel(text, text, date, time)
  from public;
grant execute on function public.car_busy(date, date, text) to anon, authenticated;
grant execute on function
  public.my_profile(), public.save_my_profile(text, text, text), public.my_reservations(),
  public.my_reservation_events(text), public.cancel_my_reservation(text),
  public.register_customer_device(text, text), public.unregister_customer_device(text),
  public.delete_my_account()
  to authenticated;

grant select, insert, update, delete on public.customers, public.customer_devices to service_role;
