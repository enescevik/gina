import { sessionStorage } from "./storage";

// Scope the UI lock to the signed-in adult. This never replaces server-side RLS.
export const childModeKey = (userId: string) => `gina-child-mode:${userId}`;
export const childModeStorage = {
  async get(key: string) {
    return sessionStorage ? sessionStorage.getItem(key) : globalThis.localStorage.getItem(key);
  },
  async set(key: string, value: string) {
    if (sessionStorage) await sessionStorage.setItem(key, value);
    else globalThis.localStorage.setItem(key, value);
  },
  async remove(key: string) {
    if (sessionStorage) await sessionStorage.removeItem(key);
    else globalThis.localStorage.removeItem(key);
  },
};
