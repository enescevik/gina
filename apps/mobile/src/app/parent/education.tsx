import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GraduationCap } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { ParentScreen, ChildPicker } from "@/components/ui/parent-screen";
import { Avatar } from "@/components/avatar";
import { p, u, SatinButton } from "@/components/planner/ui";
import {
  ArchivedProgram,
  EducationPeriodWizard,
  type EducationState,
} from "@/components/education/education-period";

export default function EducationScreen() {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const family = claims?.family_id ?? "";
  const params = useLocalSearchParams<{ childId?: string }>();
  const [selected, setSelected] = useState<string | null>(null);
  const [wizard, setWizard] = useState<EducationState | null>(null);
  const [saved, setSaved] = useState(false);
  const children = useQuery({
    queryKey: ["education_children", family],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id,name,grade,avatar,archived_at")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const child =
    children.data?.find((c) => c.id === (selected ?? params.childId)) ??
    (!params.childId && !selected ? children.data?.[0] : undefined);
  const education = useQuery({
    queryKey: ["education", family, child?.id],
    enabled: !!child,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_child_education", {
        p_child_id: child!.id,
      });
      if (error) throw error;
      return data as unknown as EducationState;
    },
  });
  const current = education.data?.current;
  const gradeLabel = (grade: number | null) =>
    grade === null
      ? t("education.gradeUnknown")
      : grade === 0
        ? t("betaUx.preschool")
        : t("parent.gradeShort", { grade });
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value.slice(0, 10) + "T12:00:00Z"));
  return (
    <ParentScreen
      title={t("education.title")}
      subtitle={t("education.body")}
      loading={children.isLoading || education.isLoading}
      error={children.error ?? education.error}
      onRetry={() => {
        void children.refetch();
        void education.refetch();
      }}
    >
      {(children.data?.length ?? 0) > 1 && (
        <ChildPicker
          profiles={children.data ?? []}
          selected={child?.id ?? null}
          onSelect={(id) => {
            setSelected(id);
            setSaved(false);
          }}
        />
      )}
      {!children.isLoading && !child && (
        <Text style={u.copy}>{t("education.childMissing")}</Text>
      )}
      {child && education.data && (
        <>
          <View style={[u.card, { backgroundColor: p.lilac }]}>
            <View style={u.row}>
              <Avatar slug={child.avatar} size={64} />
              <View style={u.fill}>
                <Text style={u.small}>{t("education.current")}</Text>
                <Text style={u.heading}>{child.name}</Text>
                <Text style={u.bold}>
                  {gradeLabel(current?.grade ?? child.grade)}
                </Text>
              </View>
              <GraduationCap color={p.purple} size={30} />
            </View>
            {current ? (
              <>
                <Text style={u.copy}>
                  {t("education.yearValue", {
                    year: current.academic_year,
                    next: current.academic_year + 1,
                  })}
                </Text>
                <Text style={u.copy}>
                  {current.school ?? t("education.schoolUnknown")}
                </Text>
                <Text style={u.small}>
                  {t("education.start")}: {date(current.starts_on)}
                </Text>
              </>
            ) : (
              <Text style={u.copy}>{t("education.initialBody")}</Text>
            )}
            <SatinButton
              title={t(current ? "education.manage" : "education.initial")}
              disabled={!!child.archived_at}
              onPress={() => {
                setSaved(false);
                setWizard(education.data!);
              }}
            />
          </View>
          {child.archived_at && <Text style={u.copy}>{t("childArchive.locked")}</Text>}
          {saved && (
            <Text
              accessibilityLiveRegion="polite"
              style={[u.bold, { color: "#287460" }]}
            >
              {t("education.saved")}
            </Text>
          )}
          <Text style={u.heading}>{t("education.history")}</Text>
          {!education.data.history.length && (
            <Text style={u.copy}>{t("education.noHistory")}</Text>
          )}
          {education.data.history.map((period) => (
            <View key={period.id} style={u.card}>
              <Text style={u.heading}>
                {t("education.yearValue", {
                  year: period.academic_year,
                  next: period.academic_year + 1,
                })}
              </Text>
              <Text style={u.bold}>
                {gradeLabel(period.grade)} ·{" "}
                {period.school ?? t("education.schoolUnknown")}
              </Text>
              <Text style={u.small}>
                {t("education.range", {
                  start: date(period.starts_on),
                  end: date(
                    new Date(
                      new Date(period.ends_on! + "T12:00:00Z").getTime() -
                        86400000,
                    ).toISOString(),
                  ),
                })}
              </Text>
              <ArchivedProgram period={period} />
            </View>
          ))}
          <Text style={u.small}>{t("education.unknown")}</Text>
          {!!education.data.corrections.length && (
            <>
              <Text style={u.heading}>{t("education.corrections")}</Text>
              {education.data.corrections.map((change, index) => (
                <View key={index} style={u.card}>
                  <Text style={u.small}>
                    {t("education.corrected", { date: date(change.at) })}
                  </Text>
                  <Text style={u.copy}>
                    {t("education.before")}: {gradeLabel(change.before.grade)} ·{" "}
                    {change.before.school ?? t("education.schoolUnknown")}
                  </Text>
                  <Text style={u.copy}>
                    {t("education.after")}: {gradeLabel(change.after.grade)} ·{" "}
                    {change.after.school ?? t("education.schoolUnknown")}
                  </Text>
                </View>
              ))}
            </>
          )}
        </>
      )}
      {wizard && child && (
        <EducationPeriodWizard
          child={child}
          initial={wizard}
          onClose={() => setWizard(null)}
          onSaved={() => {
            setWizard(null);
            setSaved(true);
          }}
          onReload={() => {
            setWizard(null);
            void education.refetch();
            void children.refetch();
          }}
        />
      )}
    </ParentScreen>
  );
}
