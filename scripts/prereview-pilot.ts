// C09 — AI içerik ön incelemesi pilotu (tek komut).
//
// Hosted / izole ortamda GERÇEK model (ücretli, en çok 12 çağrı; sağlayıcı anahtarı yalnız Edge'de kalır):
//   CONTENT_PREREVIEW_SECRET=... deno run --config supabase/functions/deno.json \
//     --allow-net --allow-read --allow-write --allow-env scripts/prereview-pilot.ts \
//     --url https://<proje>.supabase.co --confirm-paid --out docs/release/c09-2026-11-06/pilot/hosted-result.json
//
// Yerel öz-sınama (ağ yok, ücret yok; deterministik sağlayıcı aynı handler + şema + eşik yolundan geçer):
//   deno run --config supabase/functions/deno.json --allow-read --allow-write --allow-env \
//     scripts/prereview-pilot.ts --deterministic --out docs/release/c09-2026-11-06/pilot/deterministic-result.json
//
// Edge'in pilot modu hiçbir içerik kaydına yazmaz; `ai.enabled`, model, anahtar ve C08 devre kesicisi geçerlidir.
// Rapor sırları içermez (secret yalnız istek başlığında). Çıkış kodu: yanlış onay veya hata varsa 1.
// Tek koşu eşiği (0,85) kalibre etmez: rapordaki güven dağılımı yalnız gözden geçirme girdisidir.
import { createHandler, type Dependencies } from "../supabase/functions/content-prereview/handler.ts";
import { RUBRIC_PASS } from "../supabase/functions/_shared/prereview.ts";

type Label = "correct" | "incorrect" | "ambiguous";
interface PilotItem {
  key: string;
  label: Label;
  expect: { status: string[]; preferred?: string; findings_any?: string[] };
  media_count: number;
  content: Record<string, unknown>;
}
interface PilotResult {
  key: string;
  status?: string;
  reason?: string;
  confidence?: number;
  recommendation?: string;
  findings?: { code: string; severity: string }[];
  input_tokens?: number | null;
  output_tokens?: number | null;
  error?: string;
}

const args = Deno.args;
const arg = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const deterministic = args.includes("--deterministic");
const setPath = arg("--set") ?? new URL("./prereview-pilot-set.json", import.meta.url).pathname;
const out = arg("--out");
const set = JSON.parse(await Deno.readTextFile(setPath)) as { items: PilotItem[] };
// H07: `--only <key>` sends exactly one item (first hosted pilot = at most 1 paid call).
const only = arg("--only");
const items = only ? set.items.filter((i) => i.key === only) : set.items;
if (only && items.length !== 1) throw new Error(`--only: pilot setinde '${only}' anahtarı yok.`);

/** Deterministic stand-in: answers by label so that the plumbing (schema, threshold, media flag) is exercised. */
function deterministicDeps(): Dependencies {
  return {
    caller: () => Promise.resolve({ kind: "system" }),
    resolve: () => Promise.resolve({ model: "deterministic-local", maxOutputTokens: 1500, promptVersion: "v1", provider: "anthropic" }),
    key: () => "deterministic",
    service: { rpc: (name) => Promise.resolve(name === "content_prereview_provider" ? { data: { paused: false }, error: null } : { data: null, error: { message: "unexpected" } }) },
    call: (_k, _c, _s, user) => {
      const item = items.find((i) => String(user).includes(JSON.stringify(i.content)));
      if (!item) return Promise.reject(new Error("ai_result_invalid"));
      const output = item.label === "correct"
        ? { confidence: 0.93, recommendation: "approve", rubric: { ...RUBRIC_PASS }, findings: [], summary: "Deterministik: temiz." }
        : item.label === "incorrect"
        ? {
          confidence: 0.9,
          recommendation: "reject",
          rubric: { ...RUBRIC_PASS, solution_correct: "no" },
          findings: [{ code: item.expect.findings_any?.[0] ?? "solution_incorrect", severity: "blocking", detail: "Deterministik hata.", item: null }],
          summary: "Deterministik: hatalı.",
        }
        : {
          confidence: 0.6,
          recommendation: "admin_review",
          rubric: { ...RUBRIC_PASS, solution_correct: "unsure" },
          findings: [{ code: item.expect.findings_any?.[0] ?? "other", severity: "advisory", detail: "Deterministik belirsiz.", item: null }],
          summary: "Deterministik: belirsiz.",
        };
      // The image item is answered as if clean: the media flag alone must keep it out of ai_approved.
      return Promise.resolve({ output: item.media_count > 0 ? { confidence: 0.95, recommendation: "approve", rubric: { ...RUBRIC_PASS }, findings: [], summary: "Deterministik: görseli görmeden temiz." } : output, inputTokens: 100, outputTokens: 50 });
    },
  };
}

async function run(): Promise<{ meta: Record<string, unknown>; results: PilotResult[] }> {
  const body = { pilot: true, confirm_paid: true, items: items.map(({ key, content, media_count }) => ({ key, content, media_count })) };
  if (deterministic) {
    const res = await createHandler(deterministicDeps())(new Request("http://local/content-prereview", { method: "POST", body: JSON.stringify(body) }));
    const data = await res.json();
    return { meta: { mode: "deterministic", http_status: res.status, model: data.model, provider: data.provider, prompt_version: data.prompt_version, error: data.error ?? null }, results: data.results ?? [] };
  }
  const url = arg("--url");
  const secret = Deno.env.get("CONTENT_PREREVIEW_SECRET");
  if (!args.includes("--confirm-paid")) throw new Error("--confirm-paid gerekli: gerçek sağlayıcı ücretli çağrı yapar (en çok " + items.length + ").");
  if (!url || !/^https?:\/\/[^\s/]+$/.test(url)) throw new Error("--url https://<proje>.supabase.co biçiminde olmalı (yol yok).");
  if (!secret) throw new Error("CONTENT_PREREVIEW_SECRET ortam değişkeni yok.");
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-cron-secret": secret };
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (anon) headers.apikey = anon;
  const res = await fetch(`${url}/functions/v1/content-prereview`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(600_000) });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    data = { error: `http_${res.status}` };
  }
  return {
    meta: { mode: "remote", host: new URL(url).host, http_status: res.status, model: data.model, provider: data.provider, prompt_version: data.prompt_version, error: data.error ?? null },
    results: Array.isArray(data.results) ? data.results as PilotResult[] : [],
  };
}

const { meta, results } = await run();
const rows = items.map((item) => {
  const r = results.find((x) => x.key === item.key);
  const status = r?.status ?? null;
  const codes = (r?.findings ?? []).map((f) => f.code);
  const findingsOk = !item.expect.findings_any || status === "ai_approved" || item.expect.findings_any.some((c) => codes.includes(c));
  const pass = !!status && item.expect.status.includes(status) && findingsOk;
  return {
    key: item.key,
    label: item.label,
    expected: item.expect.status,
    preferred: item.expect.preferred ?? null,
    actual: status,
    reason: r?.reason ?? null,
    confidence: r?.confidence ?? null,
    findings: codes,
    error: r?.error ?? (r ? null : "missing_result"),
    pass,
    false_approval: item.label !== "correct" && status === "ai_approved",
  };
});
const summary = {
  items: rows.length,
  passed: rows.filter((r) => r.pass).length,
  errors: rows.filter((r) => r.error).length,
  false_approvals: rows.filter((r) => r.false_approval).length,
  correct_auto_approved: rows.filter((r) => r.label === "correct" && r.actual === "ai_approved").length,
  correct_total: rows.filter((r) => r.label === "correct").length,
  confidences: Object.fromEntries((["correct", "incorrect", "ambiguous"] as Label[]).map((l) => [l, rows.filter((r) => r.label === l).map((r) => r.confidence)])),
  threshold: 0.85,
  calibrated: false,
};
const report = { generated_at: new Date().toISOString(), set: "scripts/prereview-pilot-set.json", ...meta, summary, rows };
const text = JSON.stringify(report, null, 2) + "\n";
if (out) await Deno.writeTextFile(out, text);
console.log(text);
if (summary.false_approvals > 0 || summary.errors > 0 || meta.error) Deno.exit(1);
