import { createClient } from "npm:@supabase/supabase-js@2";
import { type ParentContext, readParent } from "../_shared/auth.ts";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import { inspectSource } from "../_shared/source-file.ts";
import { renderSvg } from "../_shared/review-renderer.ts";
import { base64, canonicalLibraryPng } from "../library-media/png.ts";
export interface ContributionImage {
  id: string;
  sha256: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
}
export interface ContributionInput {
  id: string;
  question_id: string;
  rights: true;
  no_personal_data: true;
}
export interface ContributionMedia {
  base64: string;
  sha256: string;
  width: number;
  height: number;
}
export interface ContributionDeps {
  parent(req: Request): Promise<ParentContext | null>;
  begin(
    req: Request,
    input: ContributionInput,
  ): Promise<
    { id: string; status: string; snapshot: { images: ContributionImage[] } }
  >;
  image(parent: ParentContext, image: ContributionImage): Promise<Uint8Array>;
  render(svg: string): Promise<Uint8Array>;
  finish(
    parent: ParentContext,
    id: string,
    media: ContributionMedia,
  ): Promise<unknown>;
}
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
export function createContributionHandler(deps: ContributionDeps) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return preflight();
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }
    try {
      const parent = await deps.parent(req);
      if (!parent) return json({ error: "forbidden" }, 403);
      const reader = req.body?.getReader();
      if (!reader) return json({ error: "invalid_input" }, 400);
      let raw = "";
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
          if (raw.length > 2048) {
            await reader.cancel();
            return json({ error: "invalid_input" }, 400);
          }
        }
      } finally {
        reader.releaseLock();
      }
      const input = JSON.parse(raw);
      if (
        !input || Object.keys(input).some((k) =>
          !["id", "question_id", "rights", "no_personal_data"].includes(k)
        ) || !uuid(input.id) || !uuid(input.question_id) ||
        input.rights !== true || input.no_personal_data !== true
      ) {
        return json({ error: "consent_required" }, 400);
      }
      const saved = await deps.begin(req, input);
      if (saved.status !== "preparing") {
        return json({ id: saved.id, status: saved.status });
      }
      const images = saved.snapshot.images;
      if (!Array.isArray(images) || images.length < 1 || images.length > 3) {
        throw Error("contribution_media_invalid");
      }
      const parts: {
        width: number;
        height: number;
        mime: string;
        base64: string;
      }[] = [];
      for (const image of images) {
        if (
          !uuid(image.id) ||
          !["image/png", "image/jpeg"].includes(image.mime) ||
          image.bytes > 4 * 1024 * 1024
        ) {
          throw Error("contribution_media_invalid");
        }
        const bytes = await deps.image(parent, image),
          info = await inspectSource(bytes, image.mime);
        if (
          info.hash !== image.sha256 || bytes.length !== image.bytes ||
          info.width !== image.width || info.height !== image.height
        ) {
          throw Error("source_changed");
        }
        parts.push({
          width: image.width,
          height: image.height,
          mime: image.mime,
          base64: base64(bytes),
        });
      }
      // Keep all images, their order and aspect ratio; no cropping or fabricated content.
      // Library intake limits are explicit: oversized composites fail rather than blur text.
      const width = Math.max(...parts.map((p) =>
        p.width
      ));
      const height = parts.reduce((sum, p) => sum + p.height, 0) +
        (parts.length - 1) * 24;
      if (width > 4096 || height > 4096 || width * height > 12_000_000) {
        throw Error("contribution_size");
      }
      let y = 0;
      const content = parts.map((p) => {
        const tag =
          `<image x="0" y="${y}" width="${p.width}" height="${p.height}" href="data:${p.mime};base64,${p.base64}"/>`;
        y += p.height + 24;
        return tag;
      }).join("");
      const rendered = await deps.render(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>${content}</svg>`,
      );
      if (rendered.length > 524288) throw Error("contribution_size");
      const clean = await canonicalLibraryPng(rendered),
        info = await inspectSource(clean, "image/png");
      if (info.width !== width || info.height !== height) {
        throw Error("contribution_media_invalid");
      }
      const result = await deps.finish(parent, saved.id, {
        base64: base64(clean),
        sha256: info.hash,
        width,
        height,
      });
      return json(result);
    } catch (e) {
      const message = e instanceof Error
        ? e.message
        : (e as { message?: string })?.message;
      const code =
        /^(contribution_[a-z_]+|source_(changed|not_ready)|question_(not_found|incomplete)|consent_required|request_conflict|forbidden)$/
            .test(message ?? "")
          ? message
          : "contribution_failed";
      return json({ error: code }, code === "forbidden" ? 403 : 400);
    }
  };
}
if (import.meta.main) {
  Deno.serve(createContributionHandler({
    parent: readParent,
    begin: async (req, input) => {
      const client = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: {
            headers: { Authorization: req.headers.get("authorization") ?? "" },
          },
          auth: { persistSession: false },
        },
      );
      const { data, error } = await client.rpc("begin_question_contribution", {
        p_id: input.id,
        p_question_id: input.question_id,
        p_rights: input.rights,
        p_no_personal_data: input.no_personal_data,
      });
      if (error) throw error;
      return data;
    },
    image: async (parent, image) => {
      const db = serviceClient();
      const { data: s, error } = await db.from("learning_sources").select(
        "object_path,sha256,bytes",
      ).eq("id", image.id).eq("family_id", parent.familyId).eq(
        "kind",
        "question_image",
      ).eq("status", "ready").maybeSingle();
      if (
        error || !s || s.sha256 !== image.sha256 || s.bytes !== image.bytes ||
        s.object_path.startsWith("library/")
      ) throw Error("source_not_ready");
      const { data, error: download } = await db.storage.from(
        "gina-private-sources",
      ).download(s.object_path);
      if (download || !data || data.size !== s.bytes) {
        throw Error("source_not_ready");
      }
      return new Uint8Array(await data.arrayBuffer());
    },
    render: renderSvg,
    finish: async (parent, id, media) => {
      const { data, error } = await serviceClient().rpc(
        "finish_question_contribution",
        {
          p_actor: parent.userId,
          p_family: parent.familyId,
          p_id: id,
          p_media: media,
        },
      );
      if (error) throw error;
      return data;
    },
  }));
}
