import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { libraryDataUri, readSourceBlob } from "./library-source.ts";
const assert = (v: unknown) => {
  if (!v) throw Error("assertion failed");
};
Deno.test("library source: verified bytes use privileged mapping without storage or external fetch", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  let calls = 0;
  const db = {
    rpc: (name: string, args: { p_source_id: string }) => {
      calls++;
      assert(
        name === "read_library_source_bytes" && args.p_source_id === "owned",
      );
      return Promise.resolve({
        data: { base64: "AQID", bytes: 3, sha256: hash },
        error: null,
      });
    },
  } as unknown as SupabaseClient;
  assert(
    await libraryDataUri(db, "owned", "library/family/owned") ===
      "data:image/png;base64,AQID",
  );
  assert(calls === 1);
});
Deno.test("library source: missing mapping and corrupt bytes fail closed", async () => {
  for (
    const data of [null, { base64: "AQID", bytes: 3, sha256: "changed" }, {
      base64: "AQID",
      bytes: 9,
      sha256: "changed",
    }]
  ) {
    let failed = false;
    try {
      await readSourceBlob(
        {
          rpc: () => Promise.resolve({ data, error: null }),
        } as unknown as SupabaseClient,
        "id",
        "library/f/id",
      );
    } catch {
      failed = true;
    }
    assert(failed);
  }
});
Deno.test("library source: normal family uploads still use private storage", async () => {
  let called = false;
  const db = {
    storage: {
      from: (bucket: string) => ({
        download: (path: string) => {
          called = true;
          assert(bucket === "gina-private-sources" && path === "family/source");
          return Promise.resolve({ data: new Blob(["private"]), error: null });
        },
      }),
    },
  } as unknown as SupabaseClient;
  assert(
    await (await readSourceBlob(db, "id", "family/source")).text() ===
      "private",
  );
  assert(called);
});
