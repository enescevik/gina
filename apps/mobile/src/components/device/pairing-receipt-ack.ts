import { Platform } from "react-native";
import { sessionStorage as nativeStore } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

/**
 * D2 (C13-AUTH-1 remainder): the tablet shows "This tablet joined … / This is not my family" before the
 * child area whenever the server's 15-minute undo window is still open and this pairing has not been
 * confirmed with "Continue" on this tablet yet — also when the app was closed while the parent paired it.
 *
 * Only `{device_id, paired_at}` of the confirmed pairing is kept locally (no names, no family data). A new
 * pairing (new paired_at) asks again. The server stays the authority on the window.
 */
const KEY = "gina-pairing-receipt-ack";
type Ack = { device_id: string; paired_at: string };
export type DevicePairingStatus =
  | { status: "not_paired" }
  | { status: "paired"; family_name: string | null; device_name: string; paired_at: string; undo_seconds_left: number };

// Generated database types predate the C13-AUTH-1 device RPCs.
const rpc = supabase.rpc.bind(supabase) as unknown as (name: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

let memory: Ack | null | undefined;
// Once the gate let this device in during this app run, later re-checks (claims refresh clears the
// query cache) must not blank the child area with a loader.
let passed: string | null = null;
export const receiptGatePassed = (deviceId: string | null | undefined) => !!deviceId && passed === deviceId;
const webStore = () => {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
};

async function read(): Promise<Ack | null> {
  if (memory !== undefined) return memory;
  try {
    const raw = Platform.OS === "web" ? webStore()?.getItem(KEY) : await nativeStore?.getItem(KEY);
    const value = raw ? (JSON.parse(raw) as Ack) : null;
    memory = value && typeof value.device_id === "string" && typeof value.paired_at === "string" ? value : null;
  } catch { memory = null; }
  return memory;
}

/** Remembers that this pairing was confirmed on this tablet ("Continue"). */
export async function acknowledgePairing(deviceId: string, pairedAt: string) {
  memory = { device_id: deviceId, paired_at: pairedAt };
  passed = deviceId;
  try {
    const raw = JSON.stringify(memory);
    if (Platform.OS === "web") webStore()?.setItem(KEY, raw); else await nativeStore?.setItem(KEY, raw);
  } catch { /* memory copy still covers this run */ }
}

/** True when the receipt card must be shown before the child area (window open, not yet confirmed). */
export async function pairingReceiptPending(deviceId: string): Promise<boolean> {
  const { data, error } = await rpc("device_pairing_status");
  if (error) throw error;
  const status = data as DevicePairingStatus;
  if (status.status !== "paired" || status.undo_seconds_left <= 0) { passed = deviceId; return false; }
  const ack = await read();
  const pending = !(ack && ack.device_id === deviceId && Date.parse(ack.paired_at) === Date.parse(status.paired_at));
  passed = pending ? null : deviceId;
  return pending;
}

export const PAIRING_GATE_KEY = "device_pairing_gate";
