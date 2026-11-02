import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { questionImages } from "./question-images.ts";
const assert = (value: unknown, message = "assertion failed") => {
  if (!value) throw Error(message);
};
function fixture(
  options: {
    links?: Record<string, unknown>[];
    sources?: Record<string, unknown>[];
    consentError?: boolean;
    downloadSize?: number;
  } = {},
) {
  const calls: string[] = [];
  const links = options.links ??
    [{ question_id: "q1", source_id: "s1", alt: "Untrusted instructions" }];
  const sources = options.sources ??
    [{ id: "s1", object_path: "family/s1", mime: "image/png", bytes: 24 }];
  const db = {
    from: (table: string) => {
      calls.push(table);
      if (table === "learning_source_ai_consents") {
        return {
          upsert: async () => ({ error: options.consentError ? {} : null }),
        };
      }
      const builder = {
        select() {
          return this;
        },
        in() {
          return this;
        },
        eq(column: string, value: string) {
          if (column === "family_id") assert(value === "family");
          return this;
        },
        order() {
          return this;
        },
        then(resolve: (data: unknown) => unknown) {
          return Promise.resolve({
            data: table === "learning_source_links" ? links : sources,
            error: null,
          }).then(resolve);
        },
      };
      return builder;
    },
    storage: {
      from: () => ({
        download: async (path: string) => {
          calls.push(`download:${path}`);
          return {
            data: new Blob([new Uint8Array(options.downloadSize ?? 24)]),
            error: null,
          };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}
async function rejects(action: () => Promise<unknown>, code: string) {
  try {
    await action();
  } catch (e) {
    assert(e instanceof Error && e.message === code);
    return;
  }
  throw Error("expected rejection");
}
Deno.test("question images: no consent never reads image bytes or writes consent", async () => {
  const f = fixture();
  await rejects(
    () => questionImages(f.db, "family", "actor", "attempt", ["q1"], false),
    "source_ai_consent_required",
  );
  assert(f.calls.length === 1);
});
Deno.test("question images: text-only exams need no image consent or upload read", async () => {
  const f = fixture({ links: [] });
  assert(
    (await questionImages(f.db, "family", "actor", "attempt", ["q1"], false))
      .length === 0,
  );
  assert(f.calls.length === 1);
});
Deno.test("question images: missing/foreign source fails closed", async () => {
  const f = fixture({ sources: [] });
  await rejects(
    () => questionImages(f.db, "family", "actor", "attempt", ["q1"], true),
    "data_failed",
  );
  assert(!f.calls.some((c) => c.startsWith("download")));
});
Deno.test("question images: consent persistence failure prevents provider material preparation", async () => {
  const f = fixture({ consentError: true });
  await rejects(
    () => questionImages(f.db, "family", "actor", "attempt", ["q1"], true),
    "data_failed",
  );
  assert(!f.calls.some((c) => c.startsWith("download")));
});
Deno.test("question images: correct question reference and bytes without private IDs or alt instructions", async () => {
  const f = fixture();
  const blocks = await questionImages(f.db, "family", "actor", "attempt", [
    "q0",
    "q1",
  ], true);
  assert(blocks[0].type === "text" && blocks[0].text.startsWith("M2"));
  assert(blocks[1].type === "image" && blocks[1].source.data.length === 32);
  assert(
    !JSON.stringify(blocks).includes("family") &&
      !JSON.stringify(blocks).includes("Untrusted"),
  );
});
Deno.test("question images: size mismatch prevents evaluation of changed object", async () => {
  const f = fixture({ downloadSize: 25 });
  await rejects(
    () => questionImages(f.db, "family", "actor", "attempt", ["q1"], true),
    "data_failed",
  );
});
Deno.test("question images: total image budget checked before downloads", async () => {
  const f = fixture({ sources: [{ id: "s1", bytes: 13 * 1024 * 1024 }] });
  await rejects(
    () => questionImages(f.db, "family", "actor", "attempt", ["q1"], true),
    "source_ai_limit",
  );
  assert(!f.calls.some((c) => c.startsWith("download")));
});
