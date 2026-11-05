import { supabase } from "@/lib/supabase";

/**
 * Sunucuda olan ama `database.types.ts`'e henüz girmemiş yönetici RPC'leri (E01, M01, P05, S06) için ince çağrı.
 * Yetki yine veritabanında (assert_admin) uygulanır; bu yardımcı yalnız tip kapısını aşar.
 */
type LooseRpc = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

export async function adminRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const db = supabase() as unknown as LooseRpc;
  const { data, error } = await db.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export type EdgeFailure = { kind: "unreachable" | "http"; code: string | null; status: number | null };

/** Edge fonksiyonu hatasını operatörün okuyacağı açık nedene çevirir. Ham gövde ekrana basılmaz. */
export async function edgeFailure(error: unknown): Promise<EdgeFailure> {
  const e = error as { name?: string; context?: Response } | null;
  if (e?.name === "FunctionsHttpError" && e.context && typeof e.context.status === "number") {
    let code: string | null = null;
    try {
      const body = await e.context.clone().json() as { error?: unknown };
      if (typeof body?.error === "string" && /^[a-z0-9_:-]{1,80}$/.test(body.error)) code = body.error;
    } catch {
      code = null;
    }
    // Yerel ağ geçidinde fonksiyon yoksa 404/502/503 döner: bu, "fonksiyon çalışmıyor" demektir.
    if ([404, 502, 503].includes(e.context.status) && !code) return { kind: "unreachable", code: null, status: e.context.status };
    return { kind: "http", code, status: e.context.status };
  }
  return { kind: "unreachable", code: null, status: null };
}

export function shortHash(h: string | null | undefined) {
  return h ? h.slice(0, 12) : "—";
}

export function fmtWhen(v: string | null | undefined) {
  return v ? new Date(v).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : "—";
}
