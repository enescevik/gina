import { provaDocument } from "./prova-document.ts";
import { serviceClient } from "./supabase.ts";
import { expectContract, sourceLimitsRow } from "./contract-fixtures.ts";
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
    limits?: Record<string, unknown>;
    limitError?: boolean;
    pdf?: { pages: number; bytes: number };
  } = {},
) {
  const bytes = new TextEncoder().encode("synthetic verified file bytes");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  const calls: { table: string; key?: string; value?: unknown }[] = [];
  let downloads = 0;
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const db = {
    // U08: sınır `shared_source_limits(p_action, p_family)` tek okuyucusundan gelir.
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcs.push({ name, args });
      return Promise.resolve(
        options.limitError
          ? { data: null, error: { message: "boom" } }
          : { data: sourceLimitsRow({ max_files: options.max ?? 5, ...options.limits }), error: null },
      );
    },
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
            : options.pdf
            ? {
              id: selected,
              mime: "application/pdf",
              bytes: options.pdf.bytes,
              pages: options.pdf.pages,
              sha256: options.hash ?? hash,
              object_path: "private/original",
            }
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
  return { db, calls, rpcs, downloads: () => downloads, hash };
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

const third = "80000000-0000-4000-8000-000000003503",
  fourth = "80000000-0000-4000-8000-000000003504";
Deno.test("U08 limits: set over shared limit returns source_file_limit with remaining, before download", async () => {
  // Yönetici sınırı 3'e düşürdü: 4 dosyalık set seçicideki ile aynı kodla reddedilir.
  const f = await fixture({ group: [id, second, third, fourth], max: 3 });
  const r = await provaDocument(f.db, "family", "parent", id, id, true, "import");
  assert(r instanceof Response);
  if (!(r instanceof Response)) return;
  const body = await expectContract(r, 400, "source_file_limit", "validation");
  const details = body.details as Record<string, number>;
  assert(details.max_files === 3 && details.selected === 4 && details.remaining === 0);
  assert(f.downloads() === 0);
  assert(f.rpcs.length === 1 && f.rpcs[0].name === "shared_source_limits");
  assert(f.rpcs[0].args.p_action === "import" && f.rpcs[0].args.p_family === "family");
});
Deno.test("U08 limits: purpose maps to policy action; setup uses the general limit", async () => {
  for (const [purpose, action] of [["generate", "generate"], ["import", "import"], ["setup", null]] as const) {
    const f = await fixture({ group: [id, second] });
    const r = await provaDocument(f.db, "family", "parent", id, id, true, purpose);
    assert(!(r instanceof Response));
    assert(f.rpcs[0].args.p_action === action);
  }
});
Deno.test("U08 limits: a narrower policy byte cap is enforced on the combined set", async () => {
  const f = await fixture({ group: [id, second], limits: { max_total_bytes: 40 } });
  const r = await provaDocument(f.db, "family", "parent", id, id, true);
  assert(r instanceof Response);
  if (!(r instanceof Response)) return;
  const body = await expectContract(r, 400, "source_size_or_type", "validation");
  assert((body.details as Record<string, number>).max_total_bytes === 40);
});
Deno.test("U08 limits: single PDF over shared page limit is rejected before download", async () => {
  const f = await fixture({ pdf: { pages: 6, bytes: 1000 } });
  const r = await provaDocument(f.db, "family", "parent", id, id, true);
  assert(r instanceof Response);
  if (!(r instanceof Response)) return;
  const body = await expectContract(r, 400, "source_size_or_type");
  assert((body.details as Record<string, number>).max_pdf_pages === 5 && f.downloads() === 0);
});
Deno.test("U08 limits: limit reader outage fails closed with data_failed", async () => {
  const f = await fixture({ group: [id, second], limitError: true });
  const r = await provaDocument(f.db, "family", "parent", id, id, true);
  assert(r instanceof Response);
  if (!(r instanceof Response)) return;
  await expectContract(r, 503, "data_failed", "service_unavailable");
  assert(f.downloads() === 0);
});
Deno.test("U08 contract: consent and input errors keep legacy error field", async () => {
  const f = await fixture();
  await expectContract(
    await provaDocument(f.db, "family", "parent", id, id, false) as Response,
    400,
    "source_ai_consent_required",
    "validation",
  );
  await expectContract(
    await provaDocument(f.db, "family", "parent", id, "not-a-uuid", true) as Response,
    400,
    "invalid_input",
  );
});
