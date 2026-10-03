// Small synchronous key-value store. On phones, expo-sqlite provides `localStorage` (persisted in
// SQLite); on web it's the browser's own. Used for the session, language and the cached fleet.
import 'expo-sqlite/localStorage/install';

export const store = {
  get(key: string): string | null { try { return globalThis.localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string) { try { globalThis.localStorage.setItem(key, value); } catch { /* storage full or blocked */ } },
  remove(key: string) { try { globalThis.localStorage.removeItem(key); } catch { /* ignore */ } },
};
