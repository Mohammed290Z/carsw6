// Everything the app asks the backend. Customers never read tables directly: each call is one of the
// database functions from supabase/migrations/20260929090000_customer_app.sql, which only return the
// caller's own data.
import { supabase } from './supabase';

export type Status = 'new' | 'confirmed' | 'paid' | 'delivered' | 'returned' | 'cancelled';
export type PayStatus = 'unpaid' | 'awaiting' | 'partial' | 'paid' | 'refunded';

export type Reservation = {
  ref: string; created_at: string; updated_at: string; car: string;
  start_date: string; start_time: string; end_date: string; end_time: string;
  place: string; flight: string | null; payment: 'bank' | 'crypto'; payment_status: PayStatus; status: Status;
  days: number; estimate: number; name: string; phone: string; lang: string; can_cancel: boolean;
};
export type ResEvent = { at: string; kind: 'created' | 'status' | 'payment_status'; value: string | null };
export type Busy = { car: string; start_at: string; end_at: string };
export type Profile = { email: string; name: string | null; phone: string | null; lang: string };

/** A failure the UI can explain: `key` is an i18n key. */
export class ApiError extends Error {
  constructor(public key: string, message?: string) { super(message ?? key); }
}

function fail(error: { message?: string; code?: string } | null): never {
  const m = error?.message ?? '';
  const known: Record<string, string> = {
    car_unavailable: 'err.unavailable', rate_limited: 'err.rate', start_in_past: 'err.past',
    days_mismatch: 'err.dates', not_cancellable: 'res.notCancellable', not_found: 'err.generic',
  };
  const key = Object.keys(known).find(k => m.includes(k));
  if (key) throw new ApiError(known[key], m);
  if (/fetch|network|Failed to fetch|timeout/i.test(m)) throw new ApiError('err.network', m);
  throw new ApiError('err.generic', m);
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) fail(error);
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('err.network', String(e));
  }
}

export const api = {
  busy: (from: string, to: string, car?: string) =>
    rpc<Busy[]>('car_busy', { p_from: from, p_to: to, p_car: car ?? null }),

  submit: (r: {
    car: string; start: string; startTime: string; end: string; endTime: string; place: string;
    flight: string; payment: 'bank' | 'crypto'; name: string; phone: string; lang: string; days: number; estimate: number;
  }) => rpc<string>('submit_reservation', {
    p_car: r.car, p_start: r.start, p_start_time: r.startTime, p_end: r.end, p_end_time: r.endTime,
    p_place: r.place, p_flight: r.flight || null, p_payment: r.payment, p_name: r.name, p_phone: r.phone,
    p_lang: r.lang, p_days: r.days, p_estimate: r.estimate, p_website: null,
  }),

  myReservations: () => rpc<Reservation[]>('my_reservations'),
  events: (ref: string) => rpc<ResEvent[]>('my_reservation_events', { p_ref: ref }),
  cancel: (ref: string) => rpc<void>('cancel_my_reservation', { p_ref: ref }),

  profile: async () => (await rpc<Profile[]>('my_profile'))[0] ?? null,
  saveProfile: (name: string, phone: string, lang: string) =>
    rpc<void>('save_my_profile', { p_name: name, p_phone: phone, p_lang: lang }),

  registerDevice: (token: string, platform: 'ios' | 'android') =>
    rpc<void>('register_customer_device', { p_token: token, p_platform: platform }),
  unregisterDevice: (token: string) => rpc<void>('unregister_customer_device', { p_token: token }),
  deleteAccount: () => rpc<void>('delete_my_account'),
};
