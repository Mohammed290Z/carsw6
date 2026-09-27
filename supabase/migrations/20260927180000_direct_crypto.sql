-- Crypto is now paid directly: after booking, the site shows the business's wallet address and the
-- amount, and staff mark the reservation paid once the funds are on the wallet. This removes the
-- NOWPayments additions and flags crypto requests so staff know to check the wallet.

alter publication supabase_realtime drop table public.payments;
drop table public.payments;
alter table public.reservations
  drop column payment_url,
  drop column payment_invoice_id,
  drop column payment_amount,
  drop column payment_link_at,
  drop column paid_at;

-- 'awaiting' now means: the client chose crypto and should have sent it; check the wallet
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
    (car, start_date, start_time, end_date, end_time, place, flight, payment, payment_status,
     name, phone, lang, days, estimate, ip_hash)
  values
    (btrim(p_car), p_start, coalesce(p_start_time, '10:00'), p_end, coalesce(p_end_time, '10:00'), p_place,
     nullif(btrim(coalesce(p_flight, '')), ''), p_payment,
     case when p_payment = 'crypto' then 'awaiting' else 'unpaid' end,
     btrim(p_name), btrim(p_phone), coalesce(p_lang, 'fr'), p_days, p_estimate, iph)
  returning ref into new_ref;
  return new_ref;
end;
$$;
