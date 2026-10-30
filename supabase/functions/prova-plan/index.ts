// Prova çalışma planı: bir denemenin zayıf konularından tekrar planı üretir (study_plans, status 'draft').
// Deploy: `supabase functions deploy prova-plan` (verify_jwt açık kalır). Çocuk asla çağırmaz.
// Kurallar: yalnız parent; paket prova_study_plan (Pro) sunucuda; model ai_settings'ten;
// ANTHROPIC_API_KEY yoksa 503 ai_not_configured. Modele yalnız ders, sınıf ve konu bazlı yüzdeler gider
// (çocuk adı/yaşı/aile verisi gönderilmez). Plan veli onaylayınca (set_study_plan_status) 'approved' olur.

import { json, serviceClient } from "../_shared/supabase.ts";
import { apiKeyOrResponse, callClaude, logUsage, provaEntitlement, readParent, resolveAi, sha256 } from "../_shared/prova.ts";

const PROMPT_VERSION = "prova-plan/v1";
const WEAK_THRESHOLD = 70;

interface PlanOutput {
  ozet: string;
  gunler: { gun: number; konu: string; etkinlik: string; sure_dk: number }[];
  gorev_onerileri: string[];
}

const SYSTEM_PROMPT = `Sen öğrencilere kısa, uygulanabilir tekrar planları hazırlayan deneyimli bir öğretmensin.
Sana ders, sınıf, plan süresi (gün), denemedeki konu bazlı başarı yüzdeleri, zayıf konular ve varsa değerlendirme özetindeki eksikler verilir.
Kurallar:
- Zayıf konulara öncelik ver; güçlü konuları aralıklı kısa tekrarla pekiştir.
- Her gün için tek bir konu ve tek somut etkinlik yaz (ör. "Ders kitabındaki örnekleri yeniden çöz", "5 soruluk mini deneme"); süre 10-40 dakika, sınıf düzeyine uygun.
- Plan hafta sonu dâhil her gün için bir satır içersin; gun 1'den başlar.
- gorev_onerileri: ebeveynin uygulamada günlük görev olarak ekleyebileceği en fazla 5 kısa görev başlığı.
- ozet: veliye 2-3 cümlelik, sakin ve cesaretlendirici açıklama. Teşhis, etiketleme ya da kişisel çıkarım yapma.
- Verilen dilde yaz (tr = Türkçe, en = İngilizce).
Yanıtı yalnız verilen JSON şemasıyla ver.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ozet", "gunler", "gorev_onerileri"],
  properties: {
    ozet: { type: "string" },
    gunler: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gun", "konu", "etkinlik", "sure_dk"],
        properties: {
          gun: { type: "integer" },
          konu: { type: "string" },
          etkinlik: { type: "string" },
          sure_dk: { type: "integer" },
        },
      },
    },
    gorev_onerileri: { type: "array", items: { type: "string" } },
  },
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const parent = readParent(req);
  if (!parent) return json({ error: "forbidden" }, 403);

  let attemptId: string;
  let days = 7;
  let locale: "tr" | "en" = "tr";
  try {
    const body = await req.json();
    attemptId = body.attempt_id;
    if (typeof attemptId !== "string" || !/^[0-9a-f-]{36}$/i.test(attemptId)) throw new Error("bad");
    if (body.days === 14) days = 14;
    if (body.locale === "en") locale = "en";
  } catch {
    return json({ error: "attempt_id_required" }, 400);
  }

  const db = serviceClient();
  let ent;
  try {
    ent = await provaEntitlement(db, parent.familyId);
  } catch {
    return json({ error: "entitlement_failed" }, 500);
  }
  if (!ent.study_plan) return json({ error: "plan_has_no_study_plan", plan: ent.plan }, 402);

  const { data: attempt } = await db
    .from("exam_attempts")
    .select("id, status, exam_id, child_id, ai_feedback, exams(subject, grade)")
    .eq("id", attemptId)
    .eq("family_id", parent.familyId)
    .maybeSingle();
  if (!attempt) return json({ error: "attempt_not_found" }, 404);
  if (attempt.status === "in_progress") return json({ error: "attempt_not_finished" }, 409);
  const exam = (Array.isArray(attempt.exams) ? attempt.exams[0] : attempt.exams) as { subject: string; grade: number } | null;
  if (!exam) return json({ error: "exam_not_found" }, 404);

  const { data: stats, error: statsError } = await db.rpc("get_attempt_topic_stats", { p_attempt_id: attemptId });
  if (statsError) return json({ error: "data_failed" }, 500);
  const scored = ((stats ?? []) as { topic: string; total: number; pct: number | null }[]).filter((s) => s.pct !== null);
  if (!scored.length) return json({ error: "no_scored_topics" }, 409);
  let weak = scored.filter((s) => (s.pct ?? 0) < WEAK_THRESHOLD);
  if (!weak.length) weak = [...scored].sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)).slice(0, 2);

  const ai = await resolveAi(db, ent.plan, 3000);
  if (ai instanceof Response) return ai;
  const apiKey = apiKeyOrResponse();
  if (apiKey instanceof Response) return apiKey;

  const feedback = (attempt.ai_feedback ?? {}) as { zayif_konular?: string[] };
  const payload = {
    dil: locale,
    ders: exam.subject,
    sinif: exam.grade,
    gun_sayisi: days,
    konu_sonuclari: scored.map((s) => ({ konu: s.topic, yuzde: s.pct, soru: s.total })),
    zayif_konular: weak.map((w) => w.topic),
    degerlendirme_zayif_konular: Array.isArray(feedback.zayif_konular) ? feedback.zayif_konular.slice(0, 5) : [],
  };
  const userPrompt = JSON.stringify(payload);

  let result;
  try {
    result = await callClaude<PlanOutput>(apiKey, ai, SYSTEM_PROMPT, userPrompt, SCHEMA);
  } catch (e) {
    console.error("prova-plan", String(e));
    return json({ error: "plan_failed" }, 502);
  }

  const plan = {
    ozet: result.output.ozet ?? "",
    gunler: (result.output.gunler ?? []).slice(0, days).map((g, i) => ({
      gun: i + 1,
      konu: g.konu,
      etkinlik: g.etkinlik,
      sure_dk: Math.max(5, Math.min(60, Math.round(Number(g.sure_dk) || 20))),
    })),
    gorev_onerileri: (result.output.gorev_onerileri ?? []).slice(0, 5),
  };

  const { data: row, error: insertError } = await db
    .from("study_plans")
    .insert({
      family_id: parent.familyId,
      child_id: attempt.child_id,
      attempt_id: attemptId,
      subject: exam.subject,
      grade: exam.grade,
      weak_topics: weak.map((w) => ({ topic: w.topic, pct: w.pct, total: w.total })),
      plan,
      model: ai.model,
      prompt_version: PROMPT_VERSION,
      input_hash: await sha256(`${PROMPT_VERSION}\n${userPrompt}\n${ai.model}`),
      created_by: parent.userId,
    })
    .select("id")
    .single();
  if (insertError || !row) {
    console.error("prova-plan insert", insertError?.message);
    return json({ error: "save_failed" }, 500);
  }

  await logUsage(db, {
    family_id: parent.familyId,
    action: "plan",
    model: ai.model,
    items: 1,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    requested_by: parent.userId,
  });

  return json({ ok: true, plan_id: row.id, plan });
});
