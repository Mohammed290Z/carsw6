// The fleet comes from the website (assets/data/fleet.json, generated from its config.js), so cars
// and prices stay identical everywhere. Start instantly from the last copy (or the one bundled with
// the app), then refresh from the site in the background.
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import bundled from '../data/fleet.json';
import { FLEET_URL, SITE_URL } from './config';
import { store } from './store';

export type Tag = 'lux' | 'suv' | 'city';
type L = { fr: string; en: string; ar: string };
export type Car = {
  id: string; name: string; make: string; model: string;
  price: number; deposit: number; power: number; accel: number; seats: number; len: number;
  tags: Tag[]; featured: boolean;
  image: { webp: { w: number; src: string }[]; aspect: number };
  the: L; alt: L; pitch: L;
};
export type Wallet = { coin: string; network: string; address: string; rateId: string; decimals: number };
export type Fleet = {
  version: number; currency: string; cars: Car[]; places: { id: string; fee: number }[];
  business: {
    name: string; whatsapp: string | null; whatsappDisplay: string | null;
    depositReleaseHours: number | null; insuranceExcess: number | null;
    minAge: number | null; licenseYears: number | null; acceptCrypto: boolean; cryptoWallets: Wallet[];
  };
};

const KEY = 'fleet.v1';
async function download(): Promise<Fleet | null> {
  try {
    const res = await fetch(`${FLEET_URL}?t=${Date.now()}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const next = await res.json() as Fleet;
    return Array.isArray(next.cars) && next.version === 1 ? next : null;
  } catch { return null; }
}
const cached = (): Fleet => { try { const s = store.get(KEY); if (s) return JSON.parse(s); } catch { /* fall through */ } return bundled as Fleet; };

type Ctx = { fleet: Fleet; offline: boolean; refreshing: boolean; refresh: () => Promise<void>; car: (id: string) => Car | undefined };
const FleetCtx = createContext<Ctx | null>(null);

export function FleetProvider({ children }: { children: ReactNode }) {
  const [fleet, setFleet] = useState<Fleet>(cached);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const apply = useCallback((next: Fleet | null) => {
    if (next) { setFleet(next); store.set(KEY, JSON.stringify(next)); }
    setOffline(!next);
  }, []);
  // pull-to-refresh
  const refresh = useCallback(async () => {
    setRefreshing(true);
    apply(await download());
    setRefreshing(false);
  }, [apply]);
  // at start, in the background
  useEffect(() => { let live = true; download().then(next => { if (live) apply(next); }); return () => { live = false; }; }, [apply]);
  const car = useCallback((id: string) => fleet.cars.find(c => c.id === id), [fleet]);
  return <FleetCtx.Provider value={{ fleet, offline, refreshing, refresh, car }}>{children}</FleetCtx.Provider>;
}

export const useFleet = () => { const v = useContext(FleetCtx); if (!v) throw new Error('FleetProvider missing'); return v; };
export const imageUri = (car: Car, w = 800) => SITE_URL + (car.image.webp.find(i => i.w >= w) ?? car.image.webp[car.image.webp.length - 1]).src;
export const byName = (cars: Car[], name: string) => cars.find(c => c.name.toLowerCase() === name.toLowerCase());
