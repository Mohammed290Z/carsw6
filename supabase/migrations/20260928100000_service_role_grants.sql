-- The Edge Functions (staff-admin, notify-push, notify-reservation) use the service role, which runs
-- only inside Supabase and is never exposed to browsers. Newer Supabase projects don't grant it
-- access to tables created by migrations automatically, so grant it explicitly.
grant select, insert, update, delete on
  public.reservations, public.staff, public.reservation_events, public.push_subscriptions
  to service_role;
grant usage, select on all sequences in schema public to service_role;
