// C09 isolated Edge: the UNCHANGED production content-prereview index.ts (real caller check, real resolveAi,
// apiKeyOrResponse(config), generateWith, real service RPCs) on a random loopback port. Only the provider
// boundary is deterministic: api.anthropic.com is answered locally from markers in the normalized content.
// Path: GET /content-prereview/__qa-provider-stats. Network: loopback only; no hosted provider, no cost.
if (Deno.env.get("GINA_QA_ISOLATED") !== "1") throw Error("isolated_runner_required");

const stats = { tokenChecks: 0, calls: 0, prompts: [] as string[] };
const original = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return original(input, init);
  if (url.origin !== "https://api.anthropic.com" || init?.method !== "POST") throw Error("unexpected_external_request:" + url.hostname);
  if (url.pathname === "/v1/messages/count_tokens") {
    stats.tokenChecks++;
    return Response.json({ input_tokens: 300 });
  }
  if (url.pathname !== "/v1/messages") throw Error("unexpected_provider_path");
  stats.calls++;
  const body = JSON.parse(String(init.body));
  const user = String(body.messages[0].content);
  stats.prompts.push(user.slice(0, 400));
  const pass = { solution_correct: "yes", measures_target_skill: "yes", age_language_appropriate: "yes", copyright_or_copy_suspicion: "no", leaked_exam_suspicion: "no" };
  const output = user.includes("C09-WRONG")
    ? { confidence: 0.91, recommendation: "reject", rubric: { ...pass, solution_correct: "no" }, findings: [{ code: "answer_key_mismatch", severity: "blocking", detail: "Sentetik: anahtar yanlış.", item: "q1" }], summary: "Sentetik: cevap anahtarı hatalı." }
    : user.includes("C09-AMBIGUOUS")
    ? { confidence: 0.58, recommendation: "admin_review", rubric: { ...pass, solution_correct: "unsure" }, findings: [{ code: "other", severity: "advisory", detail: "Sentetik: soru eksik bilgi içeriyor.", item: "q1" }], summary: "Sentetik: belirsiz, yönetici bakmalı." }
    : { confidence: 0.94, recommendation: "approve", rubric: pass, findings: [], summary: "Sentetik: çözüm doğru ve kazanımla uyumlu." };
  return Response.json({ content: [{ type: "text", text: JSON.stringify(output) }], stop_reason: "end_turn", usage: { input_tokens: 300, output_tokens: 90 } });
}) as typeof fetch;

const serve = Deno.serve;
(Deno as unknown as { serve: unknown }).serve = (handler: (req: Request) => Response | Promise<Response>) =>
  serve({ hostname: "127.0.0.1", port: 0, onListen: ({ port }) => console.log(JSON.stringify({ port })) }, (req) => {
    const path = new URL(req.url).pathname;
    if (path.endsWith("/__qa-provider-stats")) return Response.json(stats);
    return handler(req);
  });
await import("../../../../supabase/functions/content-prereview/index.ts");
