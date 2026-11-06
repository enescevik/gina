// C08 — `public.get_ai_usage()` okuyucusu. Özellik → yetenek → paket → girdi sınırı tek kaynaktan (DB) gelir;
// istemci yalnız bu ayrıştırıcıyla okur ve kendi sınır/paket tablosunu tutmaz. Bozuk/eski yanıtta null döner,
// ekran kullanım kartını gizler (çalışıyor gibi göstermez).
import { z } from "zod";

import { AI_FEATURES, type AiFeature, featureOffered } from "./ai-capabilities";

const count = z.number().int().min(0);

const operationSchema = z.object({
  action: z.string(),
  enabled: z.boolean(),
  limit: count,
  used: count,
  remaining: count,
  max_media_items: count,
  max_media_bytes: count,
});

const featureSchema = z.object({
  feature: z.enum(AI_FEATURES),
  action: z.string(),
  offered: z.boolean(),
  in_plan: z.boolean(),
  inputs: z.array(z.enum(["text", "image", "pdf"])),
  available: z.boolean(),
});

export const aiUsageSchema = z.object({
  plan: z.enum(["free", "plus", "pro"]),
  period_start: z.string(),
  renews_at: z.string(),
  enabled: z.boolean(),
  paused: z.boolean().optional().default(false),
  operations: z.array(operationSchema),
  generate: z.object({ limit: count, used: count, remaining: count }),
  setup: z.object({ limit: count, remaining: count }),
  features: z.array(featureSchema).optional().default([]),
  media: z.object({
    max_files: count,
    max_total_bytes: count,
    max_image_bytes: count,
    max_pdf_bytes: count,
    max_pdf_pages: count,
  }).nullable().optional().default(null),
});
export type AiUsage = z.infer<typeof aiUsageSchema>;

export function parseAiUsage(value: unknown): AiUsage | null {
  const parsed = aiUsageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Kullanım satırı: hangi özellik hangi kotayı tüketir. Haftalık özet `weekly`, fotoğraftan takvim ve belge
 * analizi `import` (DB'de aynı politika satırı), açık uçlu öneri `grade`, plan `plan`, soru üretimi `generate`,
 * kurulum önerisi `setup`. */
export interface AiUsageLine {
  key: "weekly" | "import" | "grade" | "plan" | "generate" | "setup";
  features: AiFeature[];
  used: number;
  limit: number;
  remaining: number;
}

const ROW_FEATURES: Record<AiUsageLine["key"], AiFeature[]> = {
  weekly: ["weekly_summary"],
  import: ["photo_calendar", "document_analysis"],
  grade: ["open_ended_grading"],
  plan: ["study_plan"],
  generate: ["question_generation"],
  setup: ["setup_suggestions"],
};

/**
 * Ekranda gösterilecek satırlar: yalnız sunulan (offered) ve pakette kullanılabilir (available) özellikler.
 * `daily_tips` gibi sunulmayan özellik hiçbir satıra girmez; limiti 0 olan satır gösterilmez.
 */
export function aiUsageRows(usage: AiUsage): AiUsageLine[] {
  const available = new Set(
    usage.features.filter((f) => f.available && f.offered && featureOffered(f.feature)).map((f) => f.feature),
  );
  const rows: AiUsageLine[] = [];
  for (const key of Object.keys(ROW_FEATURES) as AiUsageLine["key"][]) {
    const features = ROW_FEATURES[key].filter((f) => available.has(f));
    if (!features.length) continue;
    const source = key === "generate"
      ? { ...usage.generate }
      : key === "setup"
      ? { limit: usage.setup.limit, remaining: usage.setup.remaining, used: Math.max(0, usage.setup.limit - usage.setup.remaining) }
      : usage.operations.find((o) => o.action === key);
    if (!source || source.limit <= 0) continue;
    rows.push({ key, features, used: source.used, limit: source.limit, remaining: source.remaining });
  }
  return rows;
}
