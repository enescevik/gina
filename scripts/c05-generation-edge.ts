// C05 local acceptance launcher: the unchanged production prova-generate handler on a random loopback port
// with a DETERMINISTIC provider boundary. This proves the chain (published scenario → server binding →
// normalized blocks to the provider → validation → question rows with block/outcome provenance), NOT AI
// quality. The real-provider acceptance stays with C08/C14. Network: loopback only; no hosted provider.
if (Deno.env.get("GINA_QA_ISOLATED") !== "1") throw Error("isolated_runner_required");

type Block = {
  block_id: string;
  topic: string;
  count: number;
  outcome_ids: string[];
  normalized_text: string;
};
const stats = {
  tokenChecks: 0,
  generations: 0,
  received: [] as {
    blocks: Block[];
    total: number;
    hasUrlOnly: boolean;
    scenario: unknown;
    topics: unknown;
  }[],
};
const original = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return original(input, init);
  if (url.origin !== "https://api.anthropic.com" || init?.method !== "POST") {
    throw Error("unexpected_external_request:" + url.hostname);
  }
  if (url.pathname === "/v1/messages/count_tokens") {
    stats.tokenChecks++;
    return Response.json({ input_tokens: 100 });
  }
  if (url.pathname !== "/v1/messages") throw Error("unexpected_provider_path");
  const body = JSON.parse(String(init.body));
  const content = body.messages[0].content;
  const prompt = JSON.parse(
    typeof content === "string" ? content : content.find((p: { type: string }) => p.type === "text").text,
  );
  const blocks: Block[] = prompt.senaryo_kapsami?.learning_blocks ?? [];
  stats.received.push({
    blocks,
    total: (prompt.konular ?? []).reduce((n: number, k: { soru_sayisi: number }) => n + k.soru_sayisi, 0),
    hasUrlOnly: !blocks.length || blocks.some((b) => !b.normalized_text?.trim()),
    scenario: prompt.senaryo_kapsami?.scenario ?? null,
    topics: prompt.konular,
  });
  const wrongCount = typeof prompt.ek_not === "string" && prompt.ek_not.includes("QA:wrong-count");
  const sharedId = "S1";
  const questions = blocks.flatMap((b) =>
    Array.from({ length: b.count }, (_, i) => {
      const firstLine = b.normalized_text.split("\n")[i % b.outcome_ids.length] ?? b.normalized_text;
      const measured = [b.outcome_ids[i % b.outcome_ids.length]];
      return {
        topic: b.topic,
        kind: "open_ended",
        difficulty: prompt.zorluk ?? "orta",
        stem: `Sentetik soru ${b.block_id}.${i + 1}: ${firstLine.slice(0, 160)}`,
        choices: [],
        correct_key: "",
        distractor_notes: [],
        expected_answer: `Beklenen cevap ${b.block_id}.${i + 1}`,
        solution: `Çözüm adımları ${b.block_id}.${i + 1}`,
        explanation: "Deterministik yerel sağlayıcı; içerik kalitesi testi değildir.",
        source_urls: [],
        block_id: b.block_id,
        outcome_ids: measured,
        question_type: "acik_uclu",
        cognitive_demand: "uygulama",
        intended_difficulty: prompt.zorluk ?? "orta",
        rubric: { criteria: [{ text: "Çıktıya uygun gerekçe", points: 2 }, { text: "Doğru sonuç", points: 2 }], alternative_answers: [] },
        shared_source_id: b.block_id === "B1" && b.count >= 2 ? sharedId : "",
      };
    })
  );
  if (wrongCount) questions.pop();
  const output = {
    questions,
    shared_sources: blocks.some((b) => b.block_id === "B1" && b.count >= 2)
      ? [{ id: sharedId, kind: "text", content: "Ortak sentetik metin (tek kaynak, bağlı sorular ayrı sayılır)." }]
      : [],
  };
  stats.generations++;
  return Response.json({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(output) }],
    usage: { input_tokens: 100, output_tokens: 100 },
  });
}) as typeof fetch;

const serve = Deno.serve;
let handler: Deno.ServeHandler | null = null;
Deno.serve = ((h: Deno.ServeHandler) => {
  handler = h;
  return {};
}) as typeof Deno.serve;
await import("../supabase/functions/prova-generate/index.ts");
Deno.serve = serve;
serve({
  hostname: "127.0.0.1",
  port: 0,
  onListen: ({ port }) => console.log(JSON.stringify({ port })),
}, (req, info) => {
  const path = new URL(req.url).pathname;
  if (path === "/__qa-provider-stats" && req.method === "GET") return Response.json(stats);
  if (path === "/prova-generate" && handler) return handler(req, info);
  return new Response(null, { status: 404 });
});
