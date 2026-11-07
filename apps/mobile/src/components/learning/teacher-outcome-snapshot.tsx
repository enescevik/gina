import { type TeacherOutcomeSnapshot } from "@gina/core";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { parentStyles } from "@/components/ui/parent-screen";

export function TeacherOutcomeSummary({ snapshot }: { snapshot: TeacherOutcomeSnapshot }) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  return (
    <View style={{ gap: 8 }}>
      <Text style={parentStyles.copy}>{t("teacherOutcomes.subjectWindow", { subject: snapshot.subject })}</Text>
      {snapshot.rows.map((row, index) => (
        <View key={index} style={{ gap: 4 }}>
          <Text style={parentStyles.copy}>{row.outcomes.join(" · ")}</Text>
          <Text style={parentStyles.muted}>
            {t("teacherOutcomes.row", { grade: row.grade, count: row.scored, score: number.format(row.mean_points) })}
          </Text>
        </View>
      ))}
      {!snapshot.rows.length ? <Text style={parentStyles.muted}>{t("teacherOutcomes.empty")}</Text> : null}
    </View>
  );
}
