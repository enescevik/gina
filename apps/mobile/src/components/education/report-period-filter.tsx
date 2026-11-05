import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import {
  educationReportPeriodsSchema,
  type ReportEducationPeriod,
} from "@gina/core";
import { ReportPicker } from "@/components/learning/learning-progress-view";
import { p, u } from "@/components/planner/ui";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

export function useReportPeriods(childId?: string | null) {
  const { claims } = useSession();
  return useQuery({
    queryKey: ["education_report_periods", claims?.family_id, childId],
    enabled: !!childId && !!claims?.family_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("education_report_periods", {
        p_child_id: childId!,
      });
      if (error) throw error;
      return educationReportPeriodsSchema.parse(data);
    },
  });
}

/** Education dates identify the record; today's class is never a historical label. */
export function ReportPeriodFilter({
  value,
  periods,
  onChange,
}: {
  value: string;
  periods: ReportEducationPeriod[];
  onChange: (value: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const date = (day: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00Z`));
  return (
    <View
      style={{
        gap: 8,
        padding: 16,
        borderRadius: 22,
        backgroundColor: p.lilac,
      }}
    >
      <Text style={u.bold}>{t("educationReports.period")}</Text>
      <ReportPicker
        label={t("educationReports.period")}
        value={value}
        onChange={onChange}
        options={[
          { value: "all", label: t("educationReports.all") },
          ...periods.map((period) => ({
            value: period.id,
            label: t("educationReports.option", {
              year: String(period.academic_year),
              next: String(period.academic_year + 1),
              date: date(period.starts_on),
              current: period.ends_on ? "" : t("educationReports.current"),
            }),
          })),
          { value: "unknown", label: t("educationReports.unknown") },
        ]}
      />
      <Text style={u.small}>
        {t(
          value === "unknown"
            ? "educationReports.unknownHelp"
            : "educationReports.help",
        )}
      </Text>
    </View>
  );
}
