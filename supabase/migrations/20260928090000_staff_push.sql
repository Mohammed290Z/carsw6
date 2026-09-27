-- Push notifications for the staff panel app.
--
-- Each phone or browser where a staff member turns notifications on registers here. When a
-- reservation is saved, the database calls the notify-push function (through pg_net), which sends
-- a notification to every registered device. The function only acts on bookings made in the last
-- few minutes that haven't been announced yet (push_sent_at), so calling it again does nothing.

create extension if not exists pg_net;

create table public.push_subscriptions (
  endpoint   text primary key,                -- the push service address for one device
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null,                   -- the device's encryption keys
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
-- read and write only through the two functions below

alter table public.reservations add column push_sent_at timestamptz;

-- a device is registered to whoever is signed in on it now (a shared tablet follows its user)
create or replace function public.register_push(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then return false; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then
    raise exception 'bad_endpoint' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
  return true;
end;
$$;

create or replace function public.unregister_push(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.register_push(text, text, text, text), public.unregister_push(text) from public;
grant execute on function public.register_push(text, text, text, text), public.unregister_push(text) to authenticated;

-- announce each new booking
create or replace function public.push_new_reservation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://oacqrhcjvycijrcuukhd.supabase.co/functions/v1/notify-push',
    body := jsonb_build_object('id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;
create trigger reservations_push after insert on public.reservations
  for each row execute function public.push_new_reservation();
