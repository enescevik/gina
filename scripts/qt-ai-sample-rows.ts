// QT-AI: sahte sağlayıcı çıktısını (structured-generation.fixture.ts) gerçek Edge yolundan geçirir
// (validateGenerationResult + finishGeneration) ve complete_prova_generation_v2'ye gidecek `p_rows`'u JSON basar.
// Gerçek AI/DB çağrısı yok. Tek kullanıcı: scripts/test-qt-backoffice-ui.py (tek kullanımlık yerel DB zinciri).
//   deno run --no-lock --config supabase/functions/deno.json scripts/qt-ai-sample-rows.ts [--phase2]
// --phase2: Faz 2A/2B türleri + tablo/grafik uyaranı (v10 yapılandırılmış istem sürümü).
import { type GenerationContext, finishGeneration } from "../supabase/functions/_shared/generation-result.ts";
import type { serviceClient } from "../supabase/functions/_shared/supabase.ts";
import { aiStructured } from "../supabase/functions/_shared/structured-generation.fixture.ts";
import { STRUCTURED_PROMPT_VERSION } from "../supabase/functions/_shared/structured-generation.ts";

const phase2 = Deno.args.includes("--phase2");
const names = phase2
  ? (["mark_text", "error_fix", "multi_choice_chart", "two_stage", "region_grid", "clock_read", "numeric_table"] as const)
  : (["true_false", "fill_blank_bank", "matching", "numeric_unit", "ordering_sentence", "classification"] as const);
const context: GenerationContext = {
  schema: "gina.generation-context.v1",
  subject: "Hayat Bilgisi",
  grade: 2,
  total: names.length,
  topics: [{ topic: "Canlılar", count: names.length }],
  kind: "mixed",
  difficulty: "kolay",
  locale: "tr",
  scenarioCode: null,
  blueprintSource: null,
  blueprintSnapshot: null,
  draftScope: null,
  document: null,
  ai: { model: "synthetic-local-model", maxOutputTokens: 2000, promptVersion: "local" },
  promptVersion: STRUCTURED_PROMPT_VERSION,
  promptHash: "e".repeat(64),
  systemPrompt: "SYNTHETIC-SYSTEM",
  userPrompt: '{"synthetic":true}',
  catalogueBound: false,
  interactionTypes: phase2
    ? ["mark_text", "error_fix", "multi_choice", "two_stage", "region_select", "clock", "numeric"]
    : ["true_false", "fill_blank", "matching", "numeric", "ordering", "classification"],
  writtenTrack: false,
};
let rows: unknown = null;
const db = {
  rpc: (name: string, args: Record<string, unknown>) => {
    if (name === "complete_prova_generation_v2") rows = args.p_rows;
    return Promise.resolve({ data: { ok: true }, error: null });
  },
} as unknown as ReturnType<typeof serviceClient>;
const result = { output: { questions: names.map((n) => aiStructured[n]()), shared_sources: [] }, inputTokens: 1, outputTokens: 1 };
const res = await finishGeneration(db, { familyId: "FAMILY", userId: "USER" }, "request", "lease", context, result as never);
if (res.status !== 200 || !rows) throw new Error("pipeline_rejected_fixture");
console.log(JSON.stringify(rows));
