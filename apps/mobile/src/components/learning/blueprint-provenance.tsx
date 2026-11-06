import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { blueprintProvenanceLabel, blueprintProvenanceSchema } from "@gina/core";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { p, u } from "@/components/planner/ui";

/**
 * C01 UI: köken etiketi yalnız sunucu sütunlarından okunur (`school_scenario`, `distribution_kind`,
 * `school_confirmed`, `official_source_verified`, `personalization`). Okul onayı ile resmî kaynak doğrulaması ayrı
 * satırlardır; istemcideki seçim veya isim etiketi köken kanıtı sayılmaz.
 */
export const provenanceColumns =
  "id,school_scenario,distribution_kind,school_confirmed,official_source_verified,official_verified_at,personalization,source_context";
export const provenanceRowSchema = blueprintProvenanceSchema.extend({
  id: z.uuid(),
  official_verified_at: z.string().nullable(),
  source_context: z.record(z.string(), z.unknown()),
});
export type ProvenanceRow = z.infer<typeof provenanceRowSchema>;

export function provenanceKey(row: ProvenanceRow) {
  const label = blueprintProvenanceLabel(row);
  if (label === "official_verified") return "school_confirmed";
  // Elle girilmiş, beyan sorulmamış dağılım "çalışma senaryosu" değil, velinin kendi dağılımıdır.
  if (
    label === "study" && row.distribution_kind === "parent_study" &&
    row.school_scenario === "unstated"
  ) return "parent";
  return label;
}

export function useBlueprintProvenance(id: string | null) {
  return useQuery({
    queryKey: ["blueprint_provenance", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_blueprints").select(
        provenanceColumns,
      ).eq("id", id!).single();
      if (error) throw error;
      return provenanceRowSchema.parse(data);
    },
  });
}

export function BlueprintProvenanceNote(
  { row, title }: { row: ProvenanceRow; title?: string },
) {
  const { t } = useTranslation();
  const base = row.personalization;
  return (
    <View
      testID="blueprint-provenance"
      accessibilityLiveRegion="polite"
      style={[u.card, { backgroundColor: p.lilac, gap: 4 }]}
    >
      {title ? <Text style={u.small}>{title}</Text> : null}
      <Text testID="blueprint-provenance-label" style={u.bold}>
        {t(`c01ui.provenance.${provenanceKey(row)}`)}
      </Text>
      {row.distribution_kind === "personalized" &&
          typeof base?.base_label === "string" &&
          typeof base.base_total === "number"
        ? (
          <Text style={u.copy}>
            {t("c01ui.provenance.personalizedFrom", {
              label: base.base_label,
              total: base.base_total,
            })}
          </Text>
        )
        : null}
      <Text testID="blueprint-provenance-official" style={u.copy}>
        {row.official_source_verified && row.official_verified_at
          ? t("c01ui.provenance.officialYes", {
            date: new Date(row.official_verified_at).toLocaleDateString(),
          })
          : t("c01ui.provenance.officialNo")}
      </Text>
    </View>
  );
}

/** Kaydedilen blueprint'in kökenini sunucudan okuyup gösterir (kayıt sonrası ekranlar). */
export function SavedBlueprintProvenance({ id }: { id: string | null }) {
  const { t } = useTranslation();
  const row = useBlueprintProvenance(id);
  if (!id || row.isPending) return null;
  if (row.isError) {
    return (
      <Text accessibilityRole="alert" style={u.error}>
        {t("c01ui.provenance.error")}
      </Text>
    );
  }
  return (
    <BlueprintProvenanceNote
      row={row.data}
      title={t("c01ui.provenance.saved")}
    />
  );
}
