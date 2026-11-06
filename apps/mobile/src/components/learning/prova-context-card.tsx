import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type {
  ProvaContext,
  ProvaContextIssue,
  ProvaEducationPeriod,
} from "@gina/core";
import { SatinButton } from "@/components/planner/ui";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { b, BuilderCard, BuilderChoice } from "./prova-builder-ui";

/**
 * C04: exam context chosen with controls (no free-form JSON): single subject / mixed,
 * MEB Ortak Yazılı / LGS / free study, term, optional program, the child's school/period
 * snapshot and the school declaration. Saved with the draft and checked again at submit.
 */
export function ProvaContextCard({
  value,
  period,
  periodLoading,
  issues,
  subjectCount,
  onChange,
  onConfirmPeriod,
}: {
  value: ProvaContext;
  period: ProvaEducationPeriod | null;
  periodLoading: boolean;
  issues: ProvaContextIssue[];
  subjectCount: number;
  onChange: (patch: Partial<ProvaContext>) => void;
  onConfirmPeriod: () => void;
}) {
  const { t } = useTranslation();
  const year = value.academicYear;
  return (
    <BuilderCard title={t("provaC04.context.title")}>
      <Text style={b.muted}>{t("provaC04.context.help")}</Text>
      <Text style={b.bold}>{t("provaC04.context.scope")}</Text>
      <View style={b.wrap}>
        {(["subject", "mixed"] as const).map((v) => (
          <BuilderChoice
            key={v}
            label={t(`provaC04.context.scope_${v}`)}
            selected={value.scope === v}
            onPress={() => onChange({ scope: v })}
          />
        ))}
      </View>
      <Text style={b.bold}>{t("provaC04.context.track")}</Text>
      <View style={b.wrap}>
        {(["meb_common", "lgs", "free"] as const).map((v) => (
          <BuilderChoice
            key={v}
            label={t(`provaC04.context.track_${v}`)}
            selected={value.track === v}
            onPress={() => onChange({ track: v })}
          />
        ))}
      </View>
      <Text style={b.bold}>{t("provaC04.context.term")}</Text>
      <View style={b.wrap}>
        {([null, 1, 2] as const).map((v) => (
          <BuilderChoice
            key={String(v)}
            label={t(`provaC04.context.term_${v ?? "none"}`)}
            selected={value.term === v}
            onPress={() => onChange({ term: v })}
          />
        ))}
      </View>
      <Field
        label={t("provaC04.context.program")}
        hint={t("provaC04.context.programHint")}
        value={value.program ?? ""}
        maxLength={80}
        onChangeText={(text) =>
          onChange({ program: text.trim() ? text.slice(0, 80) : null })}
      />
      <Text style={b.bold}>{t("provaC04.context.period")}</Text>
      <Text style={b.muted}>
        {periodLoading
          ? t("common.loading")
          : value.periodId && year
          ? t("provaC04.context.periodValue", {
            year,
            next: year + 1,
            school: value.school || t("provaC04.context.schoolUnknown"),
          })
          : t("provaC04.context.periodNone")}
      </Text>
      <Toggle
        label={t("provaC04.context.schoolDeclared")}
        value={value.schoolDeclared}
        onChange={(schoolDeclared) => onChange({ schoolDeclared })}
      />
      <Text style={b.muted}>
        {t(
          value.schoolDeclared
            ? "provaC04.context.schoolDeclaredOn"
            : "provaC04.context.schoolDeclaredOff",
        )}
      </Text>
      {issues.length
        ? (
          <View accessibilityRole="alert" style={[b.hint, { gap: 10 }]}>
            {issues.map((issue) => (
              <Text key={issue} style={b.error}>
                {t(`provaC04.issue.${issue}`, { count: subjectCount })}
              </Text>
            ))}
            {issues.includes("period_changed") && !periodLoading
              ? (
                <SatinButton
                  secondary
                  title={period
                    ? t("provaC04.issue.confirmPeriod", {
                      school: period.school || t("provaC04.context.schoolUnknown"),
                    })
                    : t("provaC04.issue.clearPeriod")}
                  onPress={onConfirmPeriod}
                />
              )
              : null}
          </View>
        )
        : null}
    </BuilderCard>
  );
}
