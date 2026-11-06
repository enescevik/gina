// Run: deno test --config supabase/functions/deno.json --allow-read=docs/learning/catalog/2026-2027-term1/sources supabase/functions/curriculum-source-extract/handler.test.ts
import { assert, assertEquals } from "jsr:@std/assert";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { handleCurriculumSourceExtract } from "./handler.ts";
import { publicResolver, transportFor } from "../_shared/curriculum-source.fixture.ts";
import { sha256Hex } from "../_shared/meb-extract.ts";

const FILE = await Deno.readFile(new URL("../../../docs/learning/catalog/2026-2027-term1/sources/turkce2.xlsx", import.meta.url));
const SHA = await sha256Hex(FILE);
const URL_ = "https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx";
const admin = { userId: "00000000-0000-4000-8000-000000000002" };
const rid = "33333333-3333-4333-8333-333333333333";
const req = (body: unknown, method = "POST") => new Request("https://local/curriculum-source-extract", { method, body: method === "GET" ? null : JSON.stringify(body) });
const body = { request_id: "11111111-1111-4111-8111-111111111111", revision_id: rid };

type State = { extraction_status: string; status: string; lease: boolean; stored: string | null; sha: string; done?: string; admins: Set<string> };
/** In-memory stand-in for begin/record/release with the same state machine as the migration. */
function fakeDb(over: Partial<State> = {}) {
  const st: State = { extraction_status: "queued", status: "pending_review", lease: false, stored: null, sha: SHA, admins: new Set([admin.userId]), ...over };
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (!st.admins.has(args.p_actor_id as string)) return Promise.resolve({ data: null, error: { code: "42501", message: "forbidden" } });
      if (name === "begin_curriculum_extraction") {
        const state = st.status === "withdrawn" || st.status === "superseded" ? "closed" : st.extraction_status === "done" ? "already_done" : st.lease ? "in_progress" : "claimed";
        if (state === "claimed") st.lease = true;
        return Promise.resolve({
          data: { state, revision_id: rid, status: st.status, extraction_status: st.extraction_status, extraction: null, extraction_started_at: st.lease ? "now" : null, extraction_attempts: 1,
            ...(state === "claimed" ? { sha256: st.sha, storage_path: st.stored, resolved_url: URL_, label: "Türkçe", school_year: "2026-2027", term: 1 } : {}) },
          error: null,
        });
      }
      if (name === "release_curriculum_extraction") {
        st.lease = false;
        return Promise.resolve({ data: { revision_id: rid, extraction_status: st.extraction_status, extraction_last_error: args.p_error }, error: null });
      }
      if (name === "record_curriculum_extraction_service") {
        const r = args.p_result as { outcome: string; bundle: unknown };
        const h = JSON.stringify(r.bundle);
        if (st.extraction_status === "done" && st.done !== h) return Promise.resolve({ data: null, error: { code: "P0001", message: "curriculum_extraction_conflict" } });
        st.lease = false;
        st.extraction_status = r.outcome;
        if (r.outcome === "done") st.done = h;
        return Promise.resolve({ data: { outcome: r.outcome, revision_id: rid, extraction_status: r.outcome, extraction: { created: 46 } }, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unknown_rpc" } });
    },
    from: () => {
      throw Error("handler must not read tables directly");
    },
  } as unknown as SupabaseClient;
  return { db, calls, st };
}
const net = () => transportFor({ [URL_]: { status: 200, headers: { "content-type": "application/octet-stream" }, body: FILE } });

Deno.test("non-admin / revoked admin: nothing claimed, downloaded or recorded", async () => {
  const f = fakeDb(), t = net();
  assertEquals((await handleCurriculumSourceExtract(req(body), { db: f.db, admin: null, transport: t.transport, resolve: publicResolver })).status, 403);
  assertEquals([f.calls, t.calls], [[], []]);
  // A JWT that still says admin but whose admins row was removed: the service RPC refuses the actor.
  const revoked = fakeDb({ admins: new Set() });
  const r = await handleCurriculumSourceExtract(req(body), { db: revoked.db, admin, transport: t.transport, resolve: publicResolver });
  assertEquals([r.status, (await r.json()).error], [403, "forbidden"]);
  assertEquals(t.calls, []);
  for (const bad of [{}, { request_id: "x", revision_id: rid }, { request_id: body.request_id }, { request_id: body.request_id, revision_id: "nope" }]) {
    assertEquals((await handleCurriculumSourceExtract(req(bad), { db: f.db, admin })).status, 400);
  }
  assertEquals((await handleCurriculumSourceExtract(req(body, "GET"), { db: f.db, admin })).status, 405);
});

Deno.test("happy path from the official URL: 46 review-only candidates; repeat click is already_done, no second extraction", async () => {
  const f = fakeDb(), t = net();
  const deps = { db: f.db, admin, transport: t.transport, resolve: publicResolver };
  const first = await (await handleCurriculumSourceExtract(req(body), deps)).json();
  assertEquals([first.outcome, first.scenarios, first.origin, first.error], ["done", 46, "official_url", null]);
  const rec = f.calls.find((c) => c.name === "record_curriculum_extraction_service")!;
  assertEquals(rec.args.p_actor_id, admin.userId);
  const bundle = (rec.args.p_result as { bundle: { candidates: { source_sha256: string; review_reasons: string[] }[] } }).bundle;
  assert(bundle.candidates.every((c) => c.source_sha256 === SHA && c.review_reasons.includes("source_review_required")));
  const again = await (await handleCurriculumSourceExtract(req({ ...body, request_id: "22222222-2222-4222-8222-222222222222" }), deps)).json();
  assertEquals(again.outcome, "already_done");
  assertEquals(t.calls.length, 1, "no second download");
});

Deno.test("stored original is used when it still hashes to the revision; a corrupted copy falls back to the official URL", async () => {
  const f = fakeDb({ stored: "oyss/2026-2027-t1/x.xlsx" }), t = net();
  const ok = await (await handleCurriculumSourceExtract(req(body), { db: f.db, admin, transport: t.transport, resolve: publicResolver, download: () => Promise.resolve(FILE) })).json();
  assertEquals([ok.origin, t.calls.length], ["storage", 0]);
  const g = fakeDb({ stored: "oyss/2026-2027-t1/x.xlsx" });
  const fallback = await (await handleCurriculumSourceExtract(req(body), { db: g.db, admin, transport: t.transport, resolve: publicResolver, download: () => Promise.resolve(new Uint8Array([1, 2, 3])) })).json();
  assertEquals([fallback.origin, fallback.outcome, t.calls.length], ["official_url", "done", 1]);
});

Deno.test("concurrent clicks: the second request finds the lease and does no work", async () => {
  const f = fakeDb(), t = net();
  const deps = { db: f.db, admin, transport: t.transport, resolve: publicResolver };
  const [a, b] = await Promise.all([handleCurriculumSourceExtract(req(body), deps), handleCurriculumSourceExtract(req({ ...body, request_id: "44444444-4444-4444-8444-444444444444" }), deps)]);
  const statuses = [a.status, b.status].sort();
  assertEquals(statuses, [200, 409]);
  const loser = a.status === 409 ? await a.json() : await b.json();
  assertEquals(loser.error, "extraction_in_progress");
  assertEquals(f.calls.filter((c) => c.name === "record_curriculum_extraction_service").length, 1);
  assertEquals(t.calls.length, 1);
});

Deno.test("changed source: bytes no longer hash to the revision → recorded failed verdict hash_changed_since_fetch", async () => {
  const f = fakeDb({ sha: "a".repeat(64) }), t = net();
  const r = await (await handleCurriculumSourceExtract(req(body), { db: f.db, admin, transport: t.transport, resolve: publicResolver })).json();
  assertEquals([r.outcome, r.error, f.st.extraction_status], ["failed", "hash_changed_since_fetch", "failed"]);
  // Retry after a failed verdict is allowed (claims again) and stays deterministic.
  const again = await (await handleCurriculumSourceExtract(req({ ...body, request_id: "55555555-5555-4555-8555-555555555555" }), { db: f.db, admin, transport: t.transport, resolve: publicResolver })).json();
  assertEquals([again.outcome, again.error], ["failed", "hash_changed_since_fetch"]);
});

Deno.test("network error / policy refusal is not a verdict: lease released with reason, revision stays queued", async () => {
  const f = fakeDb();
  const down = transportFor({ [URL_]: { status: 503 } });
  const r = await handleCurriculumSourceExtract(req(body), { db: f.db, admin, transport: down.transport, resolve: publicResolver });
  const j = await r.json();
  assertEquals([r.status, j.error, j.reason, f.st.extraction_status, f.st.lease], [502, "source_unreachable", "source_unreachable:http_status:503", "queued", false]);
  assertEquals(f.calls.some((c) => c.name === "record_curriculum_extraction_service"), false);
  const g = fakeDb();
  const priv = await (await handleCurriculumSourceExtract(req(body), { db: g.db, admin, transport: net().transport, resolve: () => Promise.resolve(["10.0.0.5"]) })).json();
  assertEquals(priv.reason, "source_unreachable:non_public_address:cdn.eba.gov.tr");
  const h = fakeDb();
  const crash = await handleCurriculumSourceExtract(req(body), { db: h.db, admin, transport: net().transport, resolve: publicResolver, extract: () => Promise.reject(new Error("boom")) });
  assertEquals([crash.status, (await crash.json()).error, h.st.lease], [500, "extractor_error", false]);
});

Deno.test("closed revision and conflicting re-extraction are surfaced, never overwritten", async () => {
  const closed = fakeDb({ status: "withdrawn" }), t = net();
  const c = await handleCurriculumSourceExtract(req(body), { db: closed.db, admin, transport: t.transport, resolve: publicResolver });
  assertEquals([c.status, (await c.json()).error, t.calls.length], [409, "revision_closed", 0]);
  // Same bytes, different output than an earlier import (e.g. a Python run raced this one): conflict, lease released.
  const f = fakeDb({ done: "earlier-bundle", extraction_status: "queued" });
  const realRpc = f.db.rpc.bind(f.db);
  (f.db as unknown as { rpc: unknown }).rpc = (name: string, args: Record<string, unknown>) => {
    if (name === "record_curriculum_extraction_service") {
      f.calls.push({ name, args });
      return Promise.resolve({ data: null, error: { code: "P0001", message: "curriculum_extraction_conflict" } });
    }
    return realRpc(name, args);
  };
  const conflict = await handleCurriculumSourceExtract(req(body), { db: f.db, admin, transport: t.transport, resolve: publicResolver });
  assertEquals([conflict.status, (await conflict.json()).error, f.st.lease], [409, "extraction_conflict", false]);
  assert(String(f.calls.find((x) => x.name === "release_curriculum_extraction")?.args.p_error).startsWith("record_failed:curriculum_extraction_conflict"));
});
