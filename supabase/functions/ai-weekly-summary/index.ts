// Haftalık AI aile özeti. Veli uygulamadan çağırır (JWT ile); pg_cron Faz 2'de eklenir.
// Deploy: `supabase functions deploy ai-weekly-summary` (verify_jwt açık kalır).
// Kurallar: yalnız parent rolü; paket ai_weekly olmalı; girdiler get_weekly_summary_data ile takma adlı;
// ANTHROPIC_API_KEY yoksa 'skipped' yazar ve istemciye not_configured döner.

import { json, serviceClient } from "../_shared/supabase.ts";

interface GinaClaims {
  family_id?: string | null;
  role?: string;
}

function readClaims(authHeader: string | null): GinaClaims {
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  const part = token.split(".")[1];
  if (!part) return {};
  try {
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return (payload.gina ?? {}) as GinaClaims;
  } catch {
    return {};
  }
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const SYSTEM_PROMPT = `Sen Gina Aile uygulamasının haftalık özet asistanısın. Sana bir ailenin takma adlı haftalık verisi (Çocuk A/B... etiketleri, yaş, görev tamamlama ve yıldızlar, gelecek hafta etkinlik sayıları) JSON olarak verilir.
Kurallar: tıbbi, psikolojik, hukuki veya eğitimsel teşhis/karar verme; çocukları etiketleme; kısa ve sıcak yaz; veride olmayan hiçbir şeyi uydurma.
Yanıtı SADECE şu JSON şemasıyla ver: {"haftanin_ozeti": string, "cocuk_basina": [{"etiket": string, "basarilar": string[], "zorlananlar": string[], "oneri": string}], "veliye_oneriler": string[] (en fazla 3)}.`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const claims = readClaims(req.headers.get("authorization"));
  if (claims.role !== "parent" || !claims.family_id) return json({ error: "forbidden" }, 403);
  const familyId = claims.family_id;

  let weekStart: string;
  try {
    const body = await req.json();
    weekStart = body.week_start;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart ?? "")) throw new Error("bad");
  } catch {
    return json({ error: "week_start (YYYY-MM-DD, Pazartesi) gerekli" }, 400);
  }

  const db = serviceClient();

  // Paket kontrolü: ai_weekly açık olmalı; model paketten gelir (backoffice yönetir).
  const { data: ent, error: entError } = await db.rpc("get_family_entitlement", { p_family_id: familyId });
  if (entError) return json({ error: "entitlement_failed" }, 500);
  const planCode = ent?.[0]?.plan ?? "free";
  const { data: plan } = await db.from("plans").select("ai_weekly, ai_model").eq("code", planCode).single();
  if (!plan?.ai_weekly || !plan.ai_model) return json({ error: "plan_has_no_ai", plan: planCode }, 402);

  // Günlük manuel limit: aynı hafta için mevcut kayıt varsa onu döndür.
  const { data: existing } = await db
    .from("ai_summaries")
    .select("id, status, output_json")
    .eq("family_id", familyId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (existing?.status === "done") return json({ ok: true, cached: true, summary: existing.output_json });

  const { data: inputData, error: dataError } = await db.rpc("get_weekly_summary_data", {
    p_family_id: familyId,
    p_week_start: weekStart,
  });
  if (dataError || !inputData) return json({ error: "data_failed" }, 500);

  const inputHash = await sha256(JSON.stringify(inputData) + plan.ai_model);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const base = {
    family_id: familyId,
    week_start: weekStart,
    model: plan.ai_model,
    input_hash: inputHash,
    requested_by: null,
  };

  if (!apiKey) {
    await db.from("ai_summaries").upsert({ ...base, status: "skipped", error: "not_configured" }, { onConflict: "family_id,week_start,prompt_version" });
    return json({ ok: false, error: "not_configured" }, 503);
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: plan.ai_model,
        max_tokens: 1500,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(inputData) }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic_${res.status}`);
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? "{}";
    const output = JSON.parse(text.replace(/^```json\s*|```\s*$/g, ""));
    await db.from("ai_summaries").upsert(
      {
        ...base,
        status: "done",
        output_json: output,
        input_tokens: data.usage?.input_tokens ?? null,
        output_tokens: data.usage?.output_tokens ?? null,
      },
      { onConflict: "family_id,week_start,prompt_version" },
    );
    return json({ ok: true, summary: output });
  } catch (e) {
    await db.from("ai_summaries").upsert({ ...base, status: "failed", error: String(e) }, { onConflict: "family_id,week_start,prompt_version" });
    return json({ error: "generation_failed" }, 502);
  }
});
