import { z } from "zod";
import type { BlueprintInput } from "./blueprint";

/**
 * C01 — senaryo/dağılım kökeni (sunucu: 20261106220000_blueprint_truth_and_archive_guard).
 * Okul onayı yalnız yayımlanmış katalog kopyası + veli onayıyla oluşur; veli girişi ve "bilmiyorum" yolu okul onayı
 * alamaz. Resmî kaynak doğrulaması ayrı alandır ve okul onayından türetilmez.
 */
export const blueprintProvenanceSchema = z.object({
  school_scenario: z.enum(["known", "unknown", "unstated"]),
  distribution_kind: z.enum(["school_catalogue", "parent_study", "personalized"]),
  school_confirmed: z.boolean(),
  official_source_verified: z.boolean(),
  personalization: z.record(z.string(), z.unknown()).nullable(),
});
export type BlueprintProvenance = z.infer<typeof blueprintProvenanceSchema>;

/** Kullanıcıya gösterilecek tek köken etiketi; en güçlü kanıt önce. */
export type BlueprintProvenanceLabel =
  | "official_verified"
  | "school_confirmed"
  | "personalized"
  | "parent_school_statement"
  | "study";

export function blueprintProvenanceLabel(
  row: BlueprintProvenance,
): BlueprintProvenanceLabel {
  if (row.distribution_kind === "school_catalogue") {
    if (row.official_source_verified) return "official_verified";
    if (row.school_confirmed) return "school_confirmed";
    return "study";
  }
  if (row.distribution_kind === "personalized") return "personalized";
  // Veli "biliyorum" dese de girişi okul onayı değildir; yalnız beyan olarak gösterilir.
  return row.school_scenario === "known" ? "parent_school_statement" : "study";
}

type Row = { topic: string; count: number };
export type ScenarioSeedProvenance = {
  school: "known" | "unknown";
  label: string;
  rows: Row[];
};

export function seedIsPersonalized(seed: { rows: Row[] }, rows: Row[]) {
  return seed.rows.length !== rows.length ||
    seed.rows.some((r, i) =>
      r.count !== rows[i]?.count || r.topic !== rows[i]?.topic
    );
}

/**
 * Katalogdan gelen tohumla kaydedilen veli dağılımı için sunucuya giden köken alanları. Kişiselleştirme bilgisi
 * isimden ayrı gönderilir; geçersiz tohum toplamında (1..30 dışı) kişiselleştirme alanı gönderilmez.
 */
export function seedProvenanceInput(
  seed: ScenarioSeedProvenance,
  rows: Row[],
): Pick<BlueprintInput, "school_scenario" | "personalization"> {
  const total = seed.rows.reduce((s, r) => s + r.count, 0);
  const label = seed.label.trim().slice(0, 200);
  const valid = Number.isInteger(total) && total >= 1 && total <= 30 &&
    seed.rows.length >= 1 && seed.rows.length <= 30 && label.length > 0;
  return {
    school_scenario: seed.school,
    ...(valid && seedIsPersonalized(seed, rows)
      ? {
        personalization: {
          basis: "catalogue_seed" as const,
          base_label: label,
          base_total: total,
          base_blocks: seed.rows.length,
        },
      }
      : {}),
  };
}
