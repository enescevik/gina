import { provaDocument } from "./prova-document.ts";
import { serviceClient } from "./supabase.ts";
const assert = (v: unknown) => {
  if (!v) throw Error("assertion failed");
};
const id = "80000000-0000-4000-8000-000000003501";
async function fixture(
  options: {
    missing?: boolean;
    hash?: string;
    enabled?: boolean;
    group?: string[];
    max?: number;
    missingId?: string;
  } = {},
) {
  const bytes = new TextEncoder().encode("synthetic verified file bytes");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  const calls: { table: string; key?: string; value?: unknown }[] = [];
  let downloads = 0;
  const db = {
    from: (table: string) => {
      let selected = "", setting = "";
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          if (key === "id") selected = String(value);
          if (key === "key") setting = String(value);
          calls.push({ table, key, value });
          return chain;
        },
        maybeSingle: async () => ({
          data: table === "learning_source_sets"
            ? (options.group
              ? { source_ids: options.group, pages: options.group.length }
              : null)
            : table === "app_settings"
            ? {
              value: setting === "sources.max_files"
                ? (options.max ?? 5)
                : options.enabled !== false,
            }
            : options.missing || options.missingId === selected
            ? null
            : {
              id: selected,
              mime: "image/png",
              bytes: bytes.length,
              sha256: options.hash ?? hash,
              object_path: "private/original",
            },
          error: null,
        }),
        upsert: async (value: unknown) => {
          calls.push({ table, value });
          return { error: null };
        },
      };
      return chain;
    },
    storage: {
      from: () => ({
        download: async () => {
          downloads++;
          return { data: new Blob([bytes]), error: null };
        },
      }),
    },
  } as unknown as ReturnType<typeof serviceClient>;
  return { db, calls, downloads: () => downloads, hash };
}
Deno.test("prova document: explicit AI consent is required before storage access", async () => {
  const f = await fixture();
  const result = await provaDocument(f.db, "family", "parent", id, id, false);
  assert(result instanceof Response && result.status === 400);
  assert(f.downloads() === 0 && f.calls.length === 0);
});
Deno.test("prova document: disabled source policy stops download", async () => {
  const f = await fixture({ enabled: false });
  const result = await provaDocument(f.db, "family", "parent", id, id, true);
  assert(result instanceof Response && result.status === 503);
  assert(f.downloads() === 0);
});
Deno.test("prova document: exact family, document kind and ready status are required", async () => {
  const f = await fixture({ missing: true });
  const result = await provaDocument(f.db, "family", "parent", id, id, true);
  assert(result instanceof Response && result.status === 404);
  assert(f.downloads() === 0);
  for (
    const [key, value] of [["family_id", "family"], ["kind", "document"], [
      "status",
      "ready",
    ]]
  ) {
    assert(
      f.calls.some((c) =>
        c.table === "learning_sources" && c.key === key && c.value === value
      ),
    );
  }
});
Deno.test("prova document: altered bytes never reach the model", async () => {
  const f = await fixture({ hash: "0".repeat(64) });
  const result = await provaDocument(f.db, "family", "parent", id, id, true);
  assert(result instanceof Response && result.status === 409);
});
Deno.test("prova document: verified content keeps origin and records distinct generate consent", async () => {
  const f = await fixture();
  const result = await provaDocument(f.db, "family", "parent", id, id, true);
  assert(!(result instanceof Response));
  if (result instanceof Response) return;
  assert(
    result.id === id && result.sha256 === f.hash &&
      result.media[0].type === "image",
  );
  assert(
    f.calls.some((c) =>
      c.table === "learning_source_ai_consents" &&
      (c.value as { purpose?: string })?.purpose === "generate"
    ),
  );
});
Deno.test("setup document records separate purpose consent", async () => {
  const f = await fixture();
  const r = await provaDocument(
    f.db,
    "family",
    "parent",
    id,
    id,
    true,
    "setup",
  );
  assert(!(r instanceof Response));
  assert(
    f.calls.some((c) =>
      c.table === "learning_source_ai_consents" &&
      (c.value as { purpose?: string })?.purpose === "setup"
    ),
  );
});

const second = "80000000-0000-4000-8000-000000003502";
Deno.test("multi source: originals are ordered and combined into one request with page offsets", async () => {
  const f = await fixture({ group: [id, second] });
  const r = await provaDocument(f.db, "family", "parent", id, id, true);
  assert(!(r instanceof Response));
  if (r instanceof Response) return;
  assert(
    r.id === id && r.pages === 2 && f.downloads() === 2 &&
      r.media.filter((x) => x.type === "image").length === 2,
  );
  assert(r.media[2].type === "text" && r.media[2].text.includes("2–2"));
  assert(
    f.calls.filter((c) =>
      c.table === "learning_source_ai_consents" && c.value &&
      typeof c.value === "object"
    ).length === 2,
  );
});
Deno.test("multi source: missing second original fails whole request", async () => {
  const f = await fixture({ group: [id, second], missingId: second });
  const r = await provaDocument(f.db, "family", "parent", id, id, true);
  assert(r instanceof Response && r.status === 404);
});
Deno.test("multi source: lowered admin limit is enforced before downloads", async () => {
  const f = await fixture({ group: [id, second], max: 1 });
  const r = await provaDocument(f.db, "family", "parent", id, id, true);
  assert(r instanceof Response && r.status === 400 && f.downloads() === 0);
});
Deno.test("multi source: invalid anchor and duplicate member fail closed", async () => {
  for (const group of [[second, id], [id, id]]) {
    const f = await fixture({ group });
    const r = await provaDocument(f.db, "family", "parent", id, id, true);
    assert(r instanceof Response && r.status === 400 && f.downloads() === 0);
  }
});
