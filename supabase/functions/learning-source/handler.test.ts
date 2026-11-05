// U08: learning-source uç sözleşmesi — görüntüleme (veli+cihaz) ve veli eylemlerinde kimlik ayrımı,
// sözleşmeli hata gövdesi, ham RPC mesajının sızmaması ve aynı kimlikle tekrar rezervasyonun tek kayıt kalması.
import { assert, assertEquals } from "jsr:@std/assert";
import { defaults, handleLearningSource } from "./handler.ts";
import { parentOrResponse } from "../_shared/auth.ts";
import { authCases, bearer, expectContract, PARENT_FAMILY, PARENT_USER, parentClaims } from "../_shared/contract-fixtures.ts";

const id = "00000000-0000-4000-8000-000000007201";

function fixture(options: { reserveError?: string; viewDenied?: boolean; deleteError?: string } = {}) {
  const calls: string[] = [];
  const reserved = new Map<string, { id: string; status: string; object_path: string }>();
  let uploadUrls = 0;
  const caller = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === "get_learning_source_access") {
        return Promise.resolve(
          options.viewDenied
            ? { data: null, error: { message: "permission denied for 8f1c-uuid" } }
            : { data: { id, object_path: "family/x", mime: "image/png", name: "a.png" }, error: null },
        );
      }
      if (name === "reserve_learning_source") {
        if (options.reserveError) return Promise.resolve({ data: null, error: { message: options.reserveError } });
        const existing = reserved.get(String(args.p_id));
        if (existing) return Promise.resolve({ data: existing, error: null });
        const row = { id: String(args.p_id), status: "awaiting_upload", object_path: `family/${args.p_id}` };
        reserved.set(row.id, row);
        return Promise.resolve({ data: row, error: null });
      }
      if (name === "delete_learning_source") {
        return Promise.resolve({ data: null, error: options.deleteError ? { message: options.deleteError } : null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  const service = {
    from: () => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: () => Promise.resolve({ data: null, error: null }) };
      return chain;
    },
    storage: {
      from: () => ({
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: "https://storage.local/signed" }, error: null }),
        createSignedUploadUrl: () => {
          uploadUrls++;
          return Promise.resolve({ data: { token: "upload-token" }, error: null });
        },
      }),
    },
  };
  const deps: typeof defaults = {
    ...defaults,
    serviceClient: () => service as unknown as ReturnType<typeof defaults.serviceClient>,
    callerClient: () => caller as unknown as ReturnType<typeof defaults.callerClient>,
    parentOrResponse: async () => ({ familyId: PARENT_FAMILY, userId: PARENT_USER }),
    cleanupSources: (async () => {}) as unknown as typeof defaults.cleanupSources,
    uploadsEnabled: () => true,
  };
  return { deps, calls, reserved, uploadUrls: () => uploadUrls };
}
const token = bearer(parentClaims());
const request = (body: Record<string, unknown>, authorization: string | null = token) =>
  new Request("https://local.test", {
    method: "POST",
    headers: authorization ? { authorization } : {},
    body: JSON.stringify(body),
  });
const reserveBody = {
  id,
  action: "reserve",
  kind: "document",
  name: "a.png",
  mime: "image/png",
  bytes: 10,
  sha256: "a".repeat(64),
  consent: true,
};

Deno.test("U08 learning-source: parent actions separate session_expired, unauthorized and forbidden", async () => {
  for (const action of ["reserve", "finalize", "delete"]) {
    for (const c of authCases()) {
      const f = fixture();
      f.deps.parentOrResponse = (r: Request) => parentOrResponse(r, c.db);
      const res = await handleLearningSource(request({ ...reserveBody, action }, c.authorization), f.deps);
      await expectContract(res, c.status, c.code, c.category);
      assertEquals(f.calls, [], `${action}/${c.name}`);
    }
  }
});

Deno.test("U08 learning-source: view distinguishes missing/expired session from access denial", async () => {
  const f = fixture({ viewDenied: true });
  await expectContract(await handleLearningSource(request({ id, action: "view" }, null), f.deps), 401, "unauthorized", "unauthorized");
  await expectContract(
    await handleLearningSource(
      request({ id, action: "view" }, bearer(parentClaims({ exp: Math.floor(Date.now() / 1000) - 5 }))),
      f.deps,
    ),
    401,
    "session_expired",
    "session_expired",
  );
  assertEquals(f.calls, []);
  const denied = await expectContract(await handleLearningSource(request({ id, action: "view" }), f.deps), 403, "source_not_available", "permission_denied");
  assert(!JSON.stringify(denied).includes("8f1c"), "raw RPC message leaked");
  const ok = await handleLearningSource(request({ id, action: "view" }), fixture().deps);
  assertEquals(ok.status, 200);
  assertEquals((await ok.json()).expires_in, 120);
});

Deno.test("U08 learning-source: RPC codes pass through the allow-list, raw text becomes the fallback", async () => {
  await expectContract(
    await handleLearningSource(request(reserveBody), fixture({ reserveError: "source_storage_limit" }).deps),
    400,
    "source_storage_limit",
    "validation",
  );
  await expectContract(
    await handleLearningSource(request(reserveBody), fixture({ reserveError: "request_conflict" }).deps),
    400,
    "request_conflict",
    "conflict",
  );
  const raw = await expectContract(
    await handleLearningSource(request(reserveBody), fixture({ reserveError: 'duplicate key "learning_sources_pkey"' }).deps),
    400,
    "source_failed",
  );
  assert(!JSON.stringify(raw).includes("pkey"));
  await expectContract(
    await handleLearningSource(request({ id, action: "delete" }), fixture({ deleteError: "question_in_use" }).deps),
    409,
    "question_in_use",
    "conflict",
  );
  await expectContract(await handleLearningSource(request({ id: "nope", action: "view" }), fixture().deps), 400, "invalid_input");
  await expectContract(await handleLearningSource(request({ id, action: "explode" }), fixture().deps), 400, "invalid_input");
  const disabled = fixture();
  disabled.deps.uploadsEnabled = () => false;
  await expectContract(await handleLearningSource(request(reserveBody), disabled.deps), 503, "source_unavailable", "service_unavailable");
});

Deno.test("U08 learning-source: repeating the same reservation id keeps a single source record", async () => {
  const f = fixture();
  const first = await handleLearningSource(request(reserveBody), f.deps);
  const second = await handleLearningSource(request(reserveBody), f.deps);
  assertEquals(first.status, 200);
  assertEquals(second.status, 200);
  assertEquals((await first.json()).path, (await second.json()).path);
  assertEquals(f.reserved.size, 1);
});
