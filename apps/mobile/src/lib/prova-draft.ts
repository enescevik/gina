import { randomUUID } from "expo-crypto";
import {
  appendProvaBlocks,
  type Json,
  type ProvaBlock,
  type ProvaDraft,
  provaDraftSchema,
  replaceProvaBlock,
} from "@gina/core";
import { supabase } from "./supabase";
export interface DraftRecord {
  id: string;
  version: number;
  content: ProvaDraft;
  exam_id: string | null;
  submitted_at: string | null;
  updated_at?: string;
}
export async function fetchProvaDrafts(id?: string): Promise<DraftRecord[]> {
  const { data, error } = await supabase.rpc(
    "get_prova_drafts",
    id ? { p_id: id } : {},
  );
  if (error) throw error;
  return (data as unknown as DraftRecord[]).map((d) => ({
    ...d,
    content: provaDraftSchema.parse(d.content),
  }));
}
export async function persistProvaDraft(
  id: string,
  version: number,
  content: ProvaDraft,
  requestId: string,
): Promise<DraftRecord> {
  const { data, error } = await supabase.rpc("save_prova_draft", {
    p_id: id,
    p_version: version,
    p_content: provaDraftSchema.parse(content) as unknown as Json,
    p_request_id: requestId,
  });
  if (error) throw error;
  return data as unknown as DraftRecord;
}
/** Additive return from a source editor. Retry merges only these IDs, never stale whole-screen state. */
export async function addToProvaDraft(id: string, blocks: ProvaBlock[]) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const d = (await fetchProvaDrafts(id))[0];
    if (!d) throw new Error("prova_draft_not_found");
    if (d.submitted_at) throw new Error("prova_draft_submitted");
    const next = appendProvaBlocks(d.content, blocks);
    if (next.blocks.length === d.content.blocks.length) return d;
    try {
      return await persistProvaDraft(id, d.version, next, randomUUID());
    } catch (e) {
      if ((e as { message?: string }).message !== "prova_draft_changed") {
        throw e;
      }
    }
  }
  throw new Error("prova_draft_changed");
}
/**
 * D14: AI sorusu/grubu düzenlenince taslaktaki özgün blok yerinde düzenlenmiş olanla değişir (yoksa sona eklenir).
 * Sunucudaki güncel taslak üzerinde çalışır; sürüm çakışmasında yeniden dener (addToProvaDraft ile aynı düzen).
 */
export async function replaceInProvaDraft(
  id: string,
  fromId: string,
  block: ProvaBlock,
  accepted?: { from: string[]; to: string[] },
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const d = (await fetchProvaDrafts(id))[0];
    if (!d) throw new Error("prova_draft_not_found");
    if (d.submitted_at) throw new Error("prova_draft_submitted");
    const next = replaceProvaBlock(d.content, fromId, block, accepted);
    if (JSON.stringify(next) === JSON.stringify(d.content)) return d;
    try {
      return await persistProvaDraft(id, d.version, next, randomUUID());
    } catch (e) {
      if ((e as { message?: string }).message !== "prova_draft_changed") {
        throw e;
      }
    }
  }
  throw new Error("prova_draft_changed");
}
/** D14: AI düzenleme ekranını aç (tek soru → soru editörü, ortak kaynak grubu → grup sihirbazı; ikisi de mevcut editör). */
export function aiEditRoute(
  target: { kind: "question" | "group"; id: string },
  draftId?: string,
) {
  return target.kind === "group"
    ? {
      pathname: "/parent/prova/shared-source" as const,
      params: { aiGroupId: target.id, ...(draftId ? { draftId } : {}) },
    }
    : {
      pathname: "/parent/prova/question" as const,
      params: { editFrom: target.id, ...(draftId ? { draftId } : {}) },
    };
}
