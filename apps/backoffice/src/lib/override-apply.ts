import { overrideApplyArgs, overridePreviewSchema, overrideRequestSchema, readOverrideApplyResult, assertPreviewFamily, type OverrideRequest } from "@gina/core";

import { adminRpc } from "./admin-rpc";
import { createLibraryQueue } from "./library-review";

// Uygulama niyeti cihazda (IndexedDB, kullanıcıya bağlı) saklanır: aynı anahtar yeniden denemede kullanılır,
// bağlantı kopsa bile ikinci hak oluşmaz. Kesin sunucu cevabından sonra silinir.
export type PendingApply = { request: string; payload: OverrideRequest; replace: boolean; family_name: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parsePendingApply(value: unknown): PendingApply {
  const v = (value ?? {}) as Record<string, unknown>;
  if (typeof v.request !== "string" || !uuid.test(v.request) || typeof v.replace !== "boolean" || typeof v.family_name !== "string") {
    throw new Error("pending_apply_invalid");
  }
  return { request: v.request, payload: overrideRequestSchema.parse(v.payload), replace: v.replace, family_name: v.family_name };
}
export const overrideApplyQueue = (user: string) => createLibraryQueue<PendingApply>(user, "override-apply", parsePendingApply);

export async function previewOverride(familyId: string, plan: "plus" | "pro", until: string | null, reason: string) {
  const data = await adminRpc("admin_override_preview", { p_family_id: familyId, p_plan: plan, p_until: until, p_reason: reason }, 15000);
  return assertPreviewFamily(overridePreviewSchema.parse(data), familyId);
}

export async function applyOverride(p: PendingApply) {
  const request: OverrideRequest = p.payload;
  const data = await adminRpc("admin_override_apply", overrideApplyArgs(request, p.request, p.replace), 25000);
  return readOverrideApplyResult(request, p.request, data);
}
