// Dates are plain 'YYYY-MM-DD' strings (what the database stores), always in Casablanca time.
import { TIMEZONE } from './config';

export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);

/** Today in Casablanca, whatever the phone's timezone. */
export function today(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

export const fmtDate = (s: string, locale: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  parse(s).toLocaleDateString(locale, opts);
export const hhmm = (t: string) => t.slice(0, 5);

/** A booking's span as minutes since epoch-ish, for overlap checks: [start, end). */
export const span = (d1: string, t1: string, d2: string, t2: string) =>
  [parse(d1).getTime() + mins(t1) * 6e4, parse(d2).getTime() + mins(t2) * 6e4] as const;
const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
export const busySpan = (startAt: string, endAt: string) => {
  const [d1, t1] = startAt.split(/[T ]/), [d2, t2] = endAt.split(/[T ]/);
  return span(d1, t1 ?? '00:00', d2, t2 ?? '00:00');
};

export const TIMES = Array.from({ length: 31 }, (_, i) => `${pad(7 + Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`); // 07:00–22:00
