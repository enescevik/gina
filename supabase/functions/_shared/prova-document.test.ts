import { provaDocument } from "./prova-document.ts";
import { serviceClient } from "./supabase.ts";
const assert = (v: unknown) => {
  if (!v) throw Error("assertion failed");
};
const id = "80000000-0000-4000-8000-000000003501";
async function fixture(
  options: { missing?: boolean; hash?: string; enabled?: boolean } = {},
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
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          calls.push({ table, key, value });
          return chain;
        },
        maybeSingle: async () => ({
          data: table === "app_settings"
            ? { value: options.enabled !== false }
            : options.missing
            ? null
            : {
              id,
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
Deno.test('setup document records separate purpose consent',async()=>{
 const f=await fixture();const r=await provaDocument(f.db,'family','parent',id,id,true,'setup');assert(!(r instanceof Response));
 assert(f.calls.some(c=>c.table==='learning_source_ai_consents'&&(c.value as {purpose?:string})?.purpose==='setup'));
});
