import { createClient } from "npm:@supabase/supabase-js@2";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import { base64, canonicalLibraryPng } from "./png.ts";
export interface MediaSource {
  sha256: string | null;
  png_base64: string | null;
}
export interface MediaDependencies {
  read: (
    token: string,
    id: string,
  ) => Promise<{ actor: string; sources: MediaSource[] } | null>;
  save: (
    actor: string,
    id: string,
    assets: { source_hash: string; base64: string }[],
  ) => Promise<void>;
}
export function createMediaHandler(deps: MediaDependencies) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return preflight();
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }
    try {
      const token =
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!token) return json({ error: "forbidden" }, 403);
      // Read at most 1024 bytes; no arbitrary user-supplied media, URL or actor ID.
      const reader = req.body?.getReader();
      if (!reader) return json({ error: "invalid_input" }, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 1024) {
            await reader.cancel();
            return json({ error: "invalid_input" }, 400);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const raw = new Uint8Array(size);
      let off = 0;
      for (const c of chunks) {
        raw.set(c, off);
        off += c.length;
      }
      const body = JSON.parse(new TextDecoder().decode(raw));
      if (
        !body || Object.keys(body).length !== 1 ||
        typeof body.package_id !== "string" ||
        !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.package_id)
      ) return json({ error: "invalid_input" }, 400);
      const context = await deps.read(token, body.package_id);
      if (!context) return json({ error: "forbidden" }, 403);
      const assets: { source_hash: string; base64: string }[] = [];
      const seen = new Set<string>();
      let total = 0;
      for (const s of context.sources) {
        if (!s.sha256) continue;
        if (seen.has(s.sha256)) continue;
        seen.add(s.sha256);
        if (!s.png_base64 || s.png_base64.length > 710000) {
          throw Error("library_media_invalid");
        }
        const bytes = Uint8Array.from(
          atob(s.png_base64.replace(/\s/g, "")),
          (c) => c.charCodeAt(0),
        );
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (b) => b.toString(16).padStart(2, "0"),
        ).join("");
        if (hash !== s.sha256) throw Error("library_media_invalid");
        const clean = await canonicalLibraryPng(bytes);
        total += clean.length;
        if (total > 3000000) throw Error("library_media_invalid");
        assets.push({ source_hash: s.sha256, base64: base64(clean) });
      }
      await deps.save(context.actor, body.package_id, assets);
      return json({
        package_id: body.package_id,
        validated: assets.length,
        validator: "png-rgb-v1",
      });
    } catch (e) {
      return json({
        error: e instanceof Error && e.message === "library_media_invalid"
          ? "library_media_invalid"
          : "library_media_failed",
      }, 400);
    }
  };
}
if (import.meta.main) {
  Deno.serve(createMediaHandler({
    read: async (token, id) => {
      const service = serviceClient();
      const { data, error } = await service.auth.getUser(token);
      if (error || !data.user || data.user.is_anonymous) return null;
      const client = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false },
        },
      );
      const detail = await client.rpc("admin_get_library_import", {
        p_id: id,
        p_include_answers: false,
      });
      if (detail.error || !detail.data || detail.data.id !== id) return null;
      return { actor: data.user.id, sources: detail.data.sources };
    },
    save: async (actor, id, assets) => {
      const { error } = await serviceClient().rpc(
        "prepare_library_delivery_media",
        { p_actor: actor, p_package_id: id, p_assets: assets },
      );
      if (error) throw Error("library_media_failed");
    },
  }));
}
