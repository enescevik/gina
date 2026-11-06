import { fail } from "../_shared/error-contract.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { runAiOperation } from "../_shared/ai-operation.ts";
import { type AiConfig, resolveAi } from "../_shared/prova.ts";
import { json } from "../_shared/supabase.ts";

export const SYSTEM =
  `Sen GINA aile özeti asistanısın. Yalnız tamamlanmış haftanın takma adlı sayımlarını kullan. Çocuk adı, okul, görev metni, belge veya özel not yoktur. tasks yalnız kayıtlı cevap durumlarının sayımıdır; planlanan tüm görevlerin paydası değildir. done=veli onayı bekliyor, approved=onaylı, returned=yeniden ele alınacak. Kayıt yokluğu başarısızlık veya zorlanma kanıtı değildir. stars_earned yalnız o haftada onaylı görevlerden gelen pozitif yıldızdır; bakiye veya yetenek ölçüsü değildir. Çocukları birbiriyle karşılaştırma, sıralama, kişilik/zeka/ruh hali/teşhis veya müfredat yeterliliği çıkarma. Henüz görülmeyen etkinlikleri veya gelecek sonuçları uydurma. Sayımları açıkla; önerileri isteğe bağlı küçük bir ortak adım olarak yaz. Zorlananlar alanını kanıt yoksa boş bırak, varsa yalnız kaydın durumunu tarif et; çocuğu etiketleme. Her çocuk etiketi tam bir kez gelsin. Locale dilinde, kısa ve sıcak yaz. Bu AI önerisi veli değerlendirmesinin yerine geçmez. Yalnız istenen JSON'u döndür.`;
export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    haftanin_ozeti: { type: "string" },
    cocuk_basina: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          etiket: { type: "string" },
          basarilar: { type: "array", items: { type: "string" } },
          zorlananlar: { type: "array", items: { type: "string" } },
          oneri: { type: "string" },
        },
        required: ["etiket", "basarilar", "zorlananlar", "oneri"],
      },
    },
    veliye_oneriler: { type: "array", items: { type: "string" } },
  },
  required: ["haftanin_ozeti", "cocuk_basina", "veliye_oneriler"],
};
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function text(v: unknown, max: number) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}
function list(v: unknown, max: number) {
  return Array.isArray(v) && v.length <= max && v.every((s) => text(s, 500));
}
export function validateOutput(value: unknown, labels: string[]) {
  if (
    !record(value) ||
    Object.keys(value).sort().join() !==
      ["cocuk_basina", "haftanin_ozeti", "veliye_oneriler"].join() ||
    !text(value.haftanin_ozeti, 1800) || !list(value.veliye_oneriler, 3) ||
    !Array.isArray(value.cocuk_basina) ||
    value.cocuk_basina.length !== labels.length
  ) throw Error("ai_result_invalid");
  const seen = new Set();
  for (const child of value.cocuk_basina) {
    if (
      !record(child) ||
      Object.keys(child).sort().join() !==
        ["basarilar", "etiket", "oneri", "zorlananlar"].join() ||
      typeof child.etiket !== "string" || !labels.includes(child.etiket) ||
      seen.has(child.etiket) || !list(child.basarilar, 4) ||
      !list(child.zorlananlar, 3) || !text(child.oneri, 700)
    ) throw Error("ai_result_invalid");
    seen.add(child.etiket);
  }
  return value;
}
export interface Dependencies {
  /** Üretimde parentOrResponse: oturum/yetki hatası sözleşmeli Response olarak döner. */
  parent: (
    request: Request,
  ) => Promise<{ familyId: string; userId: string } | Response | null>;
  db: SupabaseClient;
  /** C08: çözülmüş adapter'a göre secret adı (Anthropic sabiti yok). */
  key: (config?: Pick<AiConfig, "adapter">) => string | Response;
  resolve?: typeof resolveAi;
  run?: typeof runAiOperation;
}
export async function handleWeeklySummary(
  req: Request,
  deps: Dependencies,
): Promise<Response> {
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const parent = await deps.parent(req);
  if (parent instanceof Response) return parent;
  if (!parent) return fail("forbidden", 403);
  let week: string;
  try {
    const raw = await req.text();
    if (raw.length > 256) throw Error();
    const body = JSON.parse(raw);
    if (
      !record(body) || Object.keys(body).join() !== "week_start" ||
      typeof body.week_start !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.week_start)
    ) throw Error();
    week = body.week_start;
    const date = new Date(week + "T12:00:00Z");
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== week || date.getUTCDay() !== 1
    ) throw Error();
  } catch {
    return fail("invalid_input", 400);
  }
  const db = deps.db;
  const ent = await db.rpc("get_family_entitlement", {
    p_family_id: parent.familyId,
  });
  if (ent.error || !Array.isArray(ent.data) || !ent.data[0]?.plan) {
    return fail("entitlement_failed", 503);
  }
  const config = await (deps.resolve ?? resolveAi)(db, ent.data[0].plan, 2000);
  if (config instanceof Response) return config;
  const key = deps.key(config);
  if (key instanceof Response) return key;
  const prepared = await db.rpc("prepare_weekly_summary", {
    p_family: parent.familyId,
    p_user: parent.userId,
    p_week: week,
    p_context: { config, system: SYSTEM, schema: SCHEMA },
  });
  if (prepared.error) {
    const code = prepared.error.message;
    return fail(
      [
          "weekly_date",
          "weekly_no_children",
          "plan_has_no_ai",
          "weekly_forbidden",
        ].includes(code)
        ? code
        : "weekly_unavailable",
      code === "weekly_forbidden"
        ? 403
        : code === "plan_has_no_ai"
        ? 402
        : code === "weekly_date"
        ? 400
        : 409,
    );
  }
  const data = prepared.data;
  if (
    !record(data) || typeof data.id !== "string" || !record(data.context) ||
    !record(data.context.input) ||
    !Array.isArray(data.context.input.children) ||
    !record(data.context.config) || typeof data.context.system !== "string" ||
    !record(data.context.schema)
  ) return fail("weekly_context_invalid", 503);
  const context = data.context;
  const input = context.input as { children: { alias: string }[] };
  const labels = input.children.map((c) => c.alias);
  if (
    !labels.length || labels.some((l) => typeof l !== "string") ||
    new Set(labels).size !== labels.length
  ) return fail("weekly_context_invalid", 503);
  // Haftalık bağlam hazırlandığı andaki yapılandırmayla üretilir; adapter değiştiyse anahtar ona göre çözülür.
  const frozen = context.config as unknown as AiConfig;
  const runKey = (frozen.adapter ?? "anthropic-messages") === (config.adapter ?? "anthropic-messages") ? key : deps.key(frozen);
  if (runKey instanceof Response) return runKey;
  const result = await (deps.run ?? runAiOperation)(
    db,
    parent,
    "weekly",
    data.id,
    runKey,
    context.config as unknown as AiConfig,
    context.system as string,
    JSON.stringify(input),
    context.schema as Record<string, unknown>,
    (v) => validateOutput(v, labels),
  );
  if (result instanceof Response) return result;
  const stored = await db.rpc("store_weekly_summary", {
    p_family: parent.familyId,
    p_user: parent.userId,
    p_context: data.id,
    p_job: result.jobId,
  });
  if (stored.error) return fail("weekly_save_pending", 503);
  try {
    return json({ ok: true, summary: validateOutput(stored.data, labels) });
  } catch {
    return fail("ai_result_invalid", 502);
  }
}
