import { supabase } from "./supabase";

// B01 RPC'leri (`admin_workqueue`, `admin_families_search`, `admin_family_entitlement_timeline`,
// `admin_override_preview`, `admin_override_apply`) üretilmiş veritabanı tiplerinde henüz yok.
// Yanıtlar her zaman `@gina/core` zod şemalarıyla doğrulanır; burada yalnız çağrı yapılır.
type RpcError = { message?: string; code?: string; status?: number; name?: string };
type RpcCall = { abortSignal: (signal: AbortSignal) => PromiseLike<{ data: unknown; error: RpcError | null }> };
type UntypedClient = { rpc: (name: string, args: Record<string, unknown>) => RpcCall };

export async function adminRpc(name: string, args: Record<string, unknown>, timeoutMs = 20000): Promise<unknown> {
  const client = supabase() as unknown as UntypedClient;
  const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(timeoutMs));
  if (error) throw error;
  return data;
}

/** Sunucunun canlı rol kontrolü reddetti: `admins` satırı silinmiş veya operatör rolü bitmiş. */
export function isForbidden(error: unknown): boolean {
  const e = error as RpcError | null;
  return e?.code === "42501" || e?.message === "forbidden";
}

/** Kesin SQL reddi (yeniden denemek aynı sonucu verir); ağ/zaman aşımı değildir. */
export function isDefinitiveRejection(error: unknown): boolean {
  const e = error as RpcError | null;
  return /^(P0001|42501|22\w{3}|23\w{3})$/.test(e?.code ?? "");
}

export const rpcMessage = (error: unknown) => (error as RpcError | null)?.message ?? "";
