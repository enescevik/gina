// Prova AI soru üretimi. Veli uygulamadan çağırır (JWT ile); çocuk asla çağırmaz.
// Deploy: `supabase functions deploy prova-generate` (verify_jwt açık kalır).
// Kurallar: yalnız parent; paket AI üretim kotası (plans.prova_ai_generate_monthly) sunucuda;
// senaryodan üretim prova_scenarios ister; model ai_settings'ten; ANTHROPIC_API_KEY yoksa 503 ai_not_configured.
// Modele yalnız ders/sınıf/konu/zorluk gider; aileye ya da çocuğa ait hiçbir veri gönderilmez.
// Üretilen sorular question_bank'a provenance ile yazılır: {generator:"ai", model, prompt_version, prompt_hash, prompt, ...}.

import { json, serviceClient } from "../_shared/supabase.ts";
import {
  apiKeyOrResponse,
  callClaude,
  DIFFICULTIES,
  type Difficulty,
  logUsage,
  officialUrls,
  provaEntitlement,
  readParent,
  resolveAi,
  sha256,
} from "../_shared/prova.ts";

const PROMPT_VERSION = "prova-generate/v1";
const MAX_TOTAL = 30;

type KindMode = "multiple_choice" | "open_ended" | "mixed";

interface GenerateBody {
  subject?: string;
  grade?: number;
  topic?: string;
  blueprint_id?: string | null;
  count?: number; // senaryosuz: toplam; senaryoda satır sayısı yoksa konu başına
  kind?: KindMode;
  difficulty?: Difficulty;
  locale?: "tr" | "en";
}

interface GeneratedQuestion {
  topic: string;
  kind: "multiple_choice" | "open_ended";
  difficulty: Difficulty;
  stem: string;
  choices: { key: string; text: string }[];
  correct_key: string;
  distractor_notes: { key: string; why: string }[];
  expected_answer: string;
  solution: string;
  explanation: string;
  source_urls: string[];
}

// Enes'in eşinin ChatGPT promptundan uyarlanan şablon (docs/PROVA.md «AI soru üretimi»).
const SYSTEM_PROMPT = `Sen Türkiye'deki MEB müfredatına hâkim, deneyimli bir öğretmensin ve Gina Aile uygulamasının Prova modülü için yazılı/deneme soruları hazırlıyorsun.
Veli sana ders, sınıf, konu(lar), her konu için soru sayısı, soru türü ve zorluk verir. Örnek bir veli isteği: "Okulun senaryoları belli (Fen Senaryo 2). Önümüzdeki yazılı için 5 soru, zorluk orta üstü (zor değil, kolay değil). Konular senaryodaki konular; MEB örnek soruları stilinde."
Kurallar:
- Soruları MEB ÖDSGM örnek soruları ve MEB ders kitapları üslubunda, sınıf düzeyine uygun, açık ve tek anlamlı yaz. Konunun dışına çıkma.
- Zorluk: kolay | orta | orta_ustu | zor. "orta_ustu" = zor değil, kolay değil; iki adımlı düşünme ister.
- Şıklı (multiple_choice) soruda tam 4 seçenek (A, B, C, D), tek doğru cevap; çeldiriciler makul olsun ve her çeldirici için neden yanlış olduğunu distractor_notes'a yaz. expected_answer'a doğru şıkkın metnini yaz.
- Açık uçlu (open_ended) soruda choices ve distractor_notes boş liste, correct_key boş metin; expected_answer'a puanlamada kullanılacak tam beklenen cevabı (anahtar noktalarla) yaz.
- Her soru için solution'a adım adım çözüm yolunu, explanation'a 2-4 cümlelik kısa konu anlatımını yaz.
- source_urls: yalnız emin olduğun resmî kaynaklar (MEB ÖDSGM konu-soru dağılım tabloları, MEB ders kitapları, EBA). Emin değilsen boş liste bırak; adres uydurma.
- Sorularda gerçek kişi adı, marka ya da hassas konu kullanma; çocuklara uygun, kapsayıcı bir dil kullan.
- İstenen dilde yaz (tr = Türkçe, en = İngilizce).
Yanıtı yalnız verilen JSON şemasıyla ver.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "topic", "kind", "difficulty", "stem", "choices", "correct_key",
          "distractor_notes", "expected_answer", "solution", "explanation", "source_urls",
        ],
        properties: {
          topic: { type: "string" },
          kind: { type: "string", enum: ["multiple_choice", "open_ended"] },
          difficulty: { type: "string", enum: [...DIFFICULTIES] },
          stem: { type: "string" },
          choices: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "text"],
              properties: { key: { type: "string", enum: ["A", "B", "C", "D"] }, text: { type: "string" } },
            },
          },
          correct_key: { type: "string" },
          distractor_notes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "why"],
              properties: { key: { type: "string" }, why: { type: "string" } },
            },
          },
          expected_answer: { type: "string" },
          solution: { type: "string" },
          explanation: { type: "string" },
          source_urls: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const parent = readParent(req);
  if (!parent) return json({ error: "forbidden" }, 403);

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const subject = body.subject?.trim() ?? "";
  const grade = clampInt(body.grade, 1, 12, 0);
  const kind: KindMode = body.kind === "multiple_choice" || body.kind === "open_ended" ? body.kind : "mixed";
  const difficulty: Difficulty = DIFFICULTIES.includes(body.difficulty as Difficulty) ? (body.difficulty as Difficulty) : "orta_ustu";
  const locale = body.locale === "en" ? "en" : "tr";
  const count = clampInt(body.count, 1, MAX_TOTAL, 5);
  if (!subject || !grade) return json({ error: "subject_and_grade_required" }, 400);

  const db = serviceClient();
  let ent;
  try {
    ent = await provaEntitlement(db, parent.familyId);
  } catch {
    return json({ error: "entitlement_failed" }, 500);
  }
  if (ent.ai_generate_limit <= 0) return json({ error: "plan_has_no_ai", plan: ent.plan }, 402);

  // Konu planı: senaryodan (satır sayılarıyla) ya da tek konu.
  let topics: { topic: string; count: number }[] = [];
  let scenarioCode: string | null = null;
  let blueprintSource: string | null = null;
  if (body.blueprint_id) {
    if (!ent.scenarios) return json({ error: "plan_limit_prova_scenarios", plan: ent.plan }, 402);
    const { data: bp } = await db
      .from("exam_blueprints")
      .select("name, subject, grade, rows, source_url")
      .eq("id", body.blueprint_id)
      .eq("family_id", parent.familyId)
      .maybeSingle();
    if (!bp) return json({ error: "blueprint_not_found" }, 404);
    scenarioCode = bp.name;
    blueprintSource = bp.source_url;
    const rows = Array.isArray(bp.rows) ? (bp.rows as { topic?: string; count?: number }[]) : [];
    topics = rows
      .filter((r) => typeof r.topic === "string" && r.topic.trim())
      .map((r) => ({ topic: r.topic!.trim(), count: clampInt(r.count, 1, MAX_TOTAL, count) }));
  } else {
    const topic = body.topic?.trim() ?? "";
    if (!topic) return json({ error: "topic_required" }, 400);
    topics = [{ topic, count }];
  }
  const total = topics.reduce((s, t) => s + t.count, 0);
  if (!topics.length || total < 1) return json({ error: "topic_required" }, 400);
  if (total > MAX_TOTAL) return json({ error: "too_many_questions", max: MAX_TOTAL }, 400);
  const remaining = ent.ai_generate_limit - ent.ai_generate_used;
  if (total > remaining) return json({ error: "ai_quota_exceeded", remaining: Math.max(0, remaining) }, 402);

  const ai = await resolveAi(db, ent.plan, 16000);
  if (ai instanceof Response) return ai;
  const apiKey = apiKeyOrResponse();
  if (apiKey instanceof Response) return apiKey;

  const request = {
    dil: locale,
    ders: subject,
    sinif: grade,
    senaryo: scenarioCode,
    konular: topics.map((t) => ({ konu: t.topic, soru_sayisi: t.count })),
    tur: kind === "mixed" ? "karışık (şıklı ve açık uçlu, yaklaşık yarı yarıya)" : kind,
    zorluk: difficulty,
  };
  const userPrompt = JSON.stringify(request);
  const promptHash = await sha256(`${PROMPT_VERSION}\n${SYSTEM_PROMPT}\n${userPrompt}`);

  let result;
  try {
    result = await callClaude<{ questions: GeneratedQuestion[] }>(apiKey, ai, SYSTEM_PROMPT, userPrompt, SCHEMA);
  } catch (e) {
    console.error("prova-generate", String(e));
    return json({ error: "generation_failed" }, 502);
  }

  const createdAt = new Date().toISOString();
  const rows = (result.output.questions ?? [])
    .slice(0, total)
    .filter((q) => q.stem?.trim())
    .filter((q) => kind === "mixed" || q.kind === kind)
    .map((q) => {
      const isMc = q.kind === "multiple_choice";
      const choices = isMc ? (q.choices ?? []).slice(0, 4) : null;
      const validMc = isMc && choices?.length === 4 && choices.some((c) => c.key === q.correct_key);
      const notes = isMc && q.distractor_notes?.length
        ? `\n\n${locale === "tr" ? "Çeldiriciler" : "Distractors"}: ${q.distractor_notes.map((d) => `${d.key}) ${d.why}`).join(" ")}`
        : "";
      const sources = officialUrls([...(q.source_urls ?? []), ...(blueprintSource ? [blueprintSource] : [])]);
      return {
        valid: !isMc || validMc,
        row: {
          family_id: parent.familyId,
          grade,
          subject,
          topic: q.topic?.trim() || topics[0].topic,
          scenario_code: scenarioCode,
          kind: q.kind,
          difficulty: DIFFICULTIES.includes(q.difficulty) ? q.difficulty : difficulty,
          stem: q.stem.trim(),
          choices,
          correct_key: isMc ? q.correct_key : null,
          expected_answer: q.expected_answer?.trim() || null,
          solution: q.solution?.trim() || null,
          explanation: ((q.explanation?.trim() ?? "") + notes).trim() || null,
          source_urls: [...new Set(sources)],
          provenance: {
            generator: "ai",
            model: ai.model,
            prompt_version: PROMPT_VERSION,
            settings_prompt_version: ai.promptVersion,
            prompt_hash: promptHash,
            prompt: { system: SYSTEM_PROMPT, user: request },
            requested_by: parent.userId,
            created_at: createdAt,
          },
          created_by: parent.userId,
        },
      };
    })
    .filter((x) => x.valid)
    .map((x) => x.row);

  if (!rows.length) return json({ error: "generation_empty" }, 502);

  const { data: inserted, error: insertError } = await db
    .from("question_bank")
    .insert(rows)
    .select("id, topic, kind, difficulty, stem, choices, correct_key, expected_answer, solution, explanation, source_urls");
  if (insertError) {
    console.error("prova-generate insert", insertError.message);
    return json({ error: "save_failed" }, 500);
  }

  await logUsage(db, {
    family_id: parent.familyId,
    action: "generate",
    model: ai.model,
    items: inserted.length,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    requested_by: parent.userId,
  });

  return json({
    ok: true,
    model: ai.model,
    prompt_version: PROMPT_VERSION,
    remaining: Math.max(0, remaining - inserted.length),
    questions: inserted,
  });
});
