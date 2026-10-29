import Storage from "expo-sqlite/kv-store";

/** Supabase oturum deposu (iOS/Android): expo-sqlite/kv-store. */
export const sessionStorage = {
  getItem: (key: string) => Storage.getItem(key),
  setItem: (key: string, value: string) => Storage.setItem(key, value),
  removeItem: (key: string) => Storage.removeItem(key),
};
