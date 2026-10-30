import { createGinaClient, type GinaClient } from "@gina/api";

// Backoffice yalnız anon (public) anahtarla çalışır. Admin yetkisi JWT'deki `gina.admin` claim'i ve
// public.admins satırıyla veritabanında (RLS + SECURITY DEFINER RPC) uygulanır; istemcideki kontrol
// yalnız arayüz içindir. service_role anahtarı bu uygulamaya ASLA girmez.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isConfigured = url.length > 0 && anonKey.length > 0;

let client: GinaClient | null = null;

export function supabase(): GinaClient {
  if (!client) {
    if (!isConfigured) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil");
    }
    client = createGinaClient({
      url,
      anonKey,
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      detectSessionInUrl: false,
    });
  }
  return client;
}

/** Access token'daki `gina` claim'ini okur (yalnız arayüz kararı için; doğrulama sunucudadır). */
export function readGinaClaim(accessToken: string | undefined): { admin?: boolean } | null {
  if (!accessToken) return null;
  const part = accessToken.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { gina?: { admin?: boolean } };
    return payload.gina ?? null;
  } catch {
    return null;
  }
}

/** Postgres/RPC hata kodlarını Türkçe mesaja çevirir. */
export function errorMessage(error: unknown, messages: Record<string, string>): string {
  const e = error as { message?: string; code?: string } | null;
  const key = e?.message ?? "";
  if (messages[key]) return messages[key];
  if (e?.code === "42501") return messages.forbidden ?? key;
  return key || String(error);
}
