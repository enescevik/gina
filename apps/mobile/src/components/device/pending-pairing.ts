import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { sessionStorage as nativeStore } from "@/lib/storage";

/**
 * A child device's QR opens `…/parent/pair-device?code=123456`. When the parent is not signed in
 * yet, the protected parent area cannot open, so the short-lived code is kept here until sign-in.
 *
 * - Only the 6-digit code and the time it was read are stored; no names or family data.
 * - It expires with the code itself (10 minutes, server-side `device_pairings.expires_at` is the
 *   authority) and is removed after use, cancel, or an invalid/expired answer from the server.
 * - Web keeps it in this tab only (sessionStorage); native uses the app's local key-value store.
 * - Nothing is paired automatically: the parent sees the device and family first and confirms.
 */
export const PAIRING_TTL_MS = 10 * 60_000;
const KEY = "gina-pending-pairing";
type Pending = { code: string; savedAt: number };
let memory: Pending | null | undefined;
const listeners = new Set<() => void>();

const webStore = () => {
  try { return typeof window !== "undefined" ? window.sessionStorage : null; } catch { return null; }
};
const valid = (value: unknown): value is Pending =>
  !!value && typeof value === "object" && /^\d{6}$/.test(String((value as Pending).code)) &&
  typeof (value as Pending).savedAt === "number";
const fresh = (value: Pending | null | undefined) =>
  !!value && Date.now() - value.savedAt >= 0 && Date.now() - value.savedAt < PAIRING_TTL_MS;

async function write(value: Pending | null) {
  memory = value;
  try {
    if (Platform.OS === "web") {
      const store = webStore();
      if (value) store?.setItem(KEY, JSON.stringify(value)); else store?.removeItem(KEY);
    } else if (nativeStore) {
      if (value) await nativeStore.setItem(KEY, JSON.stringify(value)); else await nativeStore.removeItem(KEY);
    }
  } catch { /* memory copy still works for this session */ }
  listeners.forEach((listener) => listener());
}

/** Returns the 6-digit pairing code carried by a QR/deep link, or null for any other link. */
export function pairingCodeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    // gina://parent/pair-device parses the first segment as hostname on native.
    const path = [parsed.hostname, parsed.path].filter(Boolean).join("/").replace(/^\/+|\/+$/g, "");
    if (!/(^|\/)parent\/pair-device$/.test(path)) return null;
    const code = parsed.queryParams?.code;
    return typeof code === "string" && /^\d{6}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

export async function rememberPairingCode(code: string) {
  if (!/^\d{6}$/.test(code)) return;
  // Re-scanning the same QR does not extend its life; a different code replaces the old one.
  const current = await readPairingCode();
  if (current?.code === code) return;
  await write({ code, savedAt: Date.now() });
}

export async function readPairingCode(): Promise<Pending | null> {
  if (memory === undefined) {
    try {
      const raw = Platform.OS === "web" ? webStore()?.getItem(KEY) : nativeStore ? await nativeStore.getItem(KEY) : null;
      const parsed = raw ? JSON.parse(raw) : null;
      memory = valid(parsed) ? parsed : null;
    } catch { memory = null; }
  }
  if (memory && !fresh(memory)) await write(null);
  return memory ?? null;
}

export const clearPairingCode = () => write(null);

/** Keeps a pairing code from the link that opened (or reopened) the app while signed out. */
export function usePairingLinkCapture() {
  const url = Linking.useLinkingURL();
  useEffect(() => {
    const code = pairingCodeFromUrl(url) ??
      (Platform.OS === "web" && typeof window !== "undefined" ? pairingCodeFromUrl(window.location.href) : null);
    if (code) void rememberPairingCode(code);
  }, [url]);
}

/** Current pending code (undefined while the store is read). */
export function usePendingPairing() {
  const [state, setState] = useState<Pending | null | undefined>(() => (memory === undefined ? undefined : fresh(memory) ? memory : null));
  useEffect(() => {
    let live = true;
    const load = () => { void readPairingCode().then((value) => { if (live) setState(value); }); };
    load();
    listeners.add(load);
    return () => { live = false; listeners.delete(load); };
  }, []);
  return state;
}
