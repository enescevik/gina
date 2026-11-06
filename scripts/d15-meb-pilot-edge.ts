// D15 local acceptance launcher for the MEB pilot (NOT deployed). Serves the UNCHANGED production handlers
// (curriculum-source-fetch, prova-generate, delete-account) on a random loopback port, behind the isolated
// Auth/PostgREST/Storage stack started by `python3 scripts/test-isolated-services.py --run-local --meb-pilot`.
//
// Network boundary (fetch shim):
//   - 127.0.0.1 → local stack;
//   - odsgm.meb.gov.tr / meb.ai / cdn.eba.gov.tr → REAL official ÖDSGM/EBA download (same policy code as hosted);
//   - api.anthropic.com → DETERMINISTIC scenario-aware provider (no paid call; proves the chain, not AI quality);
//   - anything else → error.
// `ek_not` containing "QA:wrong-count" makes the provider drop one question (deterministic count check).
if (Deno.env.get("GINA_QA_ISOLATED") !== "1") throw Error("isolated_runner_required");

type Block = { block_id: string; topic: string; count: number; outcome_ids: string[]; normalized_text: string };
const OFFICIAL = new Set(["odsgm.meb.gov.tr", "meb.ai", "cdn.eba.gov.tr"]);
const stats = {
  tokenChecks: 0,
  messages: 0,
  official: 0,
  received: [] as { blocks: { block_id: string; count: number; outcome_ids: string[]; has_text: boolean }[]; total: number; scenario_version: string | null }[],
};
const original = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "127.0.0.1") return original(input, init);
  if (url.protocol === "https:" && OFFICIAL.has(url.hostname)) {
    stats.official++;
    return original(input, init);
  }
  if (url.origin !== "https://api.anthropic.com" || init?.method !== "POST") throw Error("unexpected_external_request");
  if (url.pathname === "/v1/messages/count_tokens") {
    stats.tokenChecks++;
    return Response.json({ input_tokens: 100 });
  }
  if (url.pathname !== "/v1/messages") throw Error("unexpected_provider_path");
  stats.messages++;
  const body = JSON.parse(String(init.body));
  const content = body.messages[0].content;
  const prompt = JSON.parse(typeof content === "string" ? content : content.find((p: { type: string }) => p.type === "text").text);
  const blocks: Block[] = prompt.senaryo_kapsami?.learning_blocks ?? [];
  if (!blocks.length) throw Error("d15_provider_expects_scenario_blocks");
  stats.received.push({
    blocks: blocks.map((b) => ({ block_id: b.block_id, count: b.count, outcome_ids: b.outcome_ids, has_text: !!b.normalized_text?.trim() })),
    total: (prompt.konular ?? []).reduce((n: number, k: { soru_sayisi: number }) => n + k.soru_sayisi, 0),
    scenario_version: prompt.senaryo_kapsami?.scenario?.scenario_version ?? null,
  });
  const wrongCount = typeof prompt.ek_not === "string" && prompt.ek_not.includes("QA:wrong-count");
  const sharedBlock = blocks.find((b) => b.count >= 2)?.block_id ?? null;
  const questions = blocks.flatMap((b) =>
    Array.from({ length: b.count }, (_, i) => ({
      topic: b.topic,
      kind: "open_ended",
      difficulty: prompt.zorluk ?? "orta",
      stem: `Sentetik soru ${b.block_id}.${i + 1}: ${(b.normalized_text.split("\n")[i % b.outcome_ids.length] ?? "").slice(0, 160)}`,
      choices: [],
      correct_key: "",
      distractor_notes: [],
      expected_answer: `Beklenen cevap ${b.block_id}.${i + 1}`,
      solution: `Çözüm adımları ${b.block_id}.${i + 1}`,
      explanation: "Deterministik yerel sağlayıcı; içerik kalitesi testi değildir.",
      source_urls: [],
      block_id: b.block_id,
      outcome_ids: [b.outcome_ids[i % b.outcome_ids.length]],
      question_type: "acik_uclu",
      cognitive_demand: "uygulama",
      intended_difficulty: prompt.zorluk ?? "orta",
      rubric: { criteria: [{ text: "Çıktıya uygun gerekçe", points: 50 }, { text: "Doğru sonuç", points: 50 }], alternative_answers: [] },
      shared_source_id: b.block_id === sharedBlock ? "S1" : "",
    }))
  );
  if (wrongCount) questions.pop();
  const output = {
    questions,
    shared_sources: sharedBlock ? [{ id: "S1", kind: "text", content: "Ortak sentetik metin: bir okul gezisi notu (tek kaynak, bağlı sorular ayrı sayılır)." }] : [],
  };
  return Response.json({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(output) }],
    usage: { input_tokens: 100, output_tokens: 100 },
  });
}) as typeof fetch;

const serve = Deno.serve;
const handlers = new Map<string, Deno.ServeHandler>();
let route = "";
Deno.serve = ((h: Deno.ServeHandler) => {
  handlers.set(route, h);
  return {};
}) as typeof Deno.serve;
route = "/curriculum-source-fetch";
await import("../supabase/functions/curriculum-source-fetch/index.ts");
route = "/prova-generate";
await import("../supabase/functions/prova-generate/index.ts");
route = "/delete-account";
await import("../supabase/functions/delete-account/index.ts");
Deno.serve = serve;
serve({ hostname: "127.0.0.1", port: 0, onListen: ({ port }) => console.log(JSON.stringify({ port })) }, (req, info) => {
  const path = new URL(req.url).pathname;
  if (path === "/__qa-provider-stats" && req.method === "GET") return Response.json(stats);
  const handler = handlers.get(path);
  return handler ? handler(req, info) : new Response(null, { status: 404 });
});
