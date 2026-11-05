import {
  ReportPeriodFilter,
  useReportPeriods,
} from "@/components/education/report-period-filter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { learningProgressSchema, type ProgressTopic } from "@gina/core";
import { IconButton, p, SatinButton } from "@/components/planner/ui";
import { b } from "@/components/learning/prova-builder-ui";
import {
  ProgressChart,
  ProgressNextStep,
  ProgressSummary,
  ProgressTopics,
  ReportPicker,
} from "@/components/learning/learning-progress-view";
import { ChildPicker, EmptyCard } from "@/components/ui/parent-screen";
import { Pressable } from "@/components/ui/pressable";
import { LoadingStar } from "@/components/collectible-motion";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Scope = { child: string; grade: number; subject: string; period: string };
export default function ProvaProgressScreen() {
  const { t, i18n } = useTranslation(),
    { claims } = useSession(),
    family = claims?.family_id ?? "";
  const { width, fontScale } = useWindowDimensions(),
    wide = width >= 950 && fontScale < 1.4;
  const params = useLocalSearchParams<{ childId?: string; period?: string }>();
  const [selectedChild, setChild] = useState<string | null>(
      params.childId ?? null,
    ),
    [days, setDays] = useState(params.period ? 0 : 30),
    [scope, setScope] = useState<Scope | null>(null);
  const children = useQuery({
    queryKey: ["children_history", family],
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
    children.data?.find((c) => c.id === selectedChild) ?? children.data?.[0];
  const periods = useReportPeriods(child?.id);
  const selection = scope?.child === child?.id ? scope : null;
  const period =
    selection?.period ??
    (params.childId === child?.id ? params.period : undefined) ??
    "all";
  const grade = selection?.grade ?? 0;
  const subject = selection?.subject ?? "";
  // Facets use the same period AND time window as the report, never today's class.
  const facets = useQuery({
    queryKey: ["learning_progress", family, child?.id, period, days, 0, ""],
    enabled: !!family && !!child,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "learning_progress_education",
        {
          p_child_id: child!.id,
          p_days: days,
          p_period: period,
        },
      );
      if (error) throw error;
      return learningProgressSchema.parse(data);
    },
  });
  const grades = [
    ...new Set(facets.data?.topics.map((r) => r.grade) ?? []),
  ].sort((a, b) => a - b);
  const subjects = [
    ...new Set(
      (facets.data?.topics ?? [])
        .filter((r) => !grade || r.grade === grade)
        .map((r) => r.subject),
    ),
  ].sort();
  const report = useQuery({
    queryKey: [
      "learning_progress",
      family,
      child?.id,
      period,
      days,
      grade,
      subject,
    ],
    enabled: !!family && !!child,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "learning_progress_education",
        {
          p_child_id: child!.id,
          p_days: days,
          p_period: period,
          ...(grade ? { p_grade: grade } : {}),
          ...(subject ? { p_subject: subject } : {}),
        },
      );
      if (error) throw error;
      return learningProgressSchema.parse(data);
    },
  });
  useRealtimeInvalidate(
    "exam_attempts",
    family ? `family_id=eq.${family}` : null,
    [["learning_progress", family]],
  );
  useRealtimeInvalidate("children", family ? `family_id=eq.${family}` : null, [
    ["education_report_periods", family],
    ["children_history", family],
  ]);
  const openEvidence = (e: ProgressTopic["evidence"][number]) =>
    router.push({
      pathname: "/parent/prova/review/[attemptId]",
      params: { attemptId: e.attempt_id, questionId: e.question_id },
    });
  const error = children.error ?? periods.error ?? report.error;
  const pending =
    children.isPending || (!!child && (periods.isPending || report.isPending));
  const retry = () => {
    void children.refetch();
    if (child) {
      void report.refetch();
      void periods.refetch();
      void facets.refetch();
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.cream }}>
      <ScrollView
        contentContainerStyle={[s.page, { paddingHorizontal: wide ? 32 : 18 }]}
      >
        <View style={s.top}>
          <IconButton
            label={t("common.back")}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/parent/prova")
            }
          >
            <ArrowLeft size={23} color={p.ink} />
          </IconButton>
          <Image
            source={require("../../../../../../packages/assets/brand/growing-friend/logo.png")}
            resizeMode="contain"
            accessibilityLabel={t("app.name")}
            style={{ width: 96, height: 40 }}
          />
          <Text style={b.bold}>{t("learningProgress.title")}</Text>
        </View>
        <View style={{ gap: 2 }}>
          <Text
            accessibilityRole="header"
            style={[
              b.h1,
              {
                fontSize: wide ? 36 : 30,
                lineHeight: wide ? 44 : 37,
              },
            ]}
          >
            {child
              ? t("learningProgress.heading", { name: child.name })
              : t("learningProgress.title")}
          </Text>
          <Text style={b.copy}>{t("learningProgress.subtitle")}</Text>
          {child?.archived_at && (
            <Text style={b.copy}>{t("childArchive.historyBody")}</Text>
          )}
        </View>
        {child ? (
          <>
            {children.data && children.data.length > 1 ? (
              <ChildPicker
                profiles={children.data}
                selected={child.id}
                onSelect={(id) => {
                  if (id) {
                    setChild(id);
                    setScope({
                      child: id,
                      grade: 0,
                      subject: "",
                      period: "all",
                    });
                    setDays(30);
                  }
                }}
              />
            ) : null}
            <ReportPeriodFilter
              key={child.id}
              value={period}
              periods={periods.data ?? []}
              onChange={(value) => {
                setScope({
                  child: child.id,
                  grade: 0,
                  subject: "",
                  period: value,
                });
                setDays(0);
              }}
            />
            <View
              style={{
                flexDirection: wide ? "row" : "column",
                alignItems: wide ? "flex-start" : "stretch",
                gap: 16,
              }}
            >
              {grades.length > 1 ? (
                <View style={wide ? { width: 220 } : undefined}>
                  <ReportPicker
                    label={t("learningProgress.gradeFilter")}
                    value={grade}
                    options={[
                      { value: 0, label: t("learningProgress.allGrades") },
                      ...grades.map((value) => ({
                        value,
                        label: `${
                          children.data?.length === 1 ? child.name + " · " : ""
                        }${t("learningProgress.grade", { count: value })}`,
                      })),
                    ]}
                    onChange={(value) =>
                      setScope({
                        child: child.id,
                        period,
                        grade: value,
                        subject: "",
                      })
                    }
                  />
                </View>
              ) : children.data?.length === 1 ? (
                <View style={[s.childChip, wide && { maxWidth: 240 }]}>
                  <Text style={b.bold}>{child.name}</Text>
                </View>
              ) : null}
              <View style={[s.segment, wide && { flex: 1, minWidth: 260 }]}>
                {[7, 30, 90, 0].map((n) => (
                  <Pressable
                    key={n}
                    accessibilityRole="button"
                    accessibilityState={{ selected: days === n }}
                    aria-pressed={days === n}
                    onPress={() => {
                      setDays(n);
                      setScope({
                        child: child.id,
                        period,
                        grade: 0,
                        subject: "",
                      });
                    }}
                    style={[s.period, days === n && s.periodSelected]}
                  >
                    <Text
                      style={[
                        b.bold,
                        {
                          color: days === n ? "#FFFFFF" : p.ink,
                        },
                      ]}
                    >
                      {n === 0
                        ? t("educationReports.fullRange")
                        : t("learningProgress.days", { count: n })}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View
                style={wide ? { width: 240, marginLeft: "auto" } : undefined}
              >
                <ReportPicker
                  key={`${child.id}:${grade}`}
                  label={t("learningProgress.subject")}
                  value={subject}
                  options={[
                    {
                      value: "",
                      label: t("learningProgress.allSubjects"),
                    },
                    ...subjects.map((value) => ({ value, label: value })),
                  ]}
                  onChange={(value) =>
                    setScope({ child: child.id, period, grade, subject: value })
                  }
                />
              </View>
            </View>
            {facets.error && !error ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void facets.refetch()}
                style={{ minHeight: 48, justifyContent: "center" }}
              >
                <Text style={s.note}>{t("learningProgress.filterError")}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        {error ? (
          <View style={s.state}>
            <Text accessibilityRole="alert" style={b.h2}>
              {t("learningProgress.loadError")}
            </Text>
            <Text style={b.copy}>{t("learningProgress.loadErrorBody")}</Text>
            <SatinButton title={t("common.retry")} onPress={retry} />
          </View>
        ) : pending ? (
          <View accessibilityLiveRegion="polite" style={s.state}>
            <LoadingStar
              size={56}
              accessibilityLabel={t("learningProgress.loading")}
            />
            <Text style={b.copy}>{t("learningProgress.loading")}</Text>
          </View>
        ) : !child ? (
          <EmptyCard
            title={t("unified.chooseChild")}
            body={t("unified.noChildHelp")}
          >
            <SatinButton
              title={t("unified.createFirstChild")}
              onPress={() => router.push("/parent/menu")}
            />
          </EmptyCard>
        ) : report.data?.summary.total === 0 ? (
          <View style={s.state}>
            <Image
              source={require("../../../../../../packages/assets/brand/growing-friend/reading.png")}
              resizeMode="contain"
              style={{ width: 140, height: 124 }}
              accessible={false}
            />
            <Text style={b.h2}>{t("learningProgress.emptyTitle")}</Text>
            <Text style={[b.copy, { textAlign: "center", maxWidth: 500 }]}>
              {t("educationReports.emptyProgress")}
            </Text>
            <SatinButton
              title={t("learningProgress.provasAction")}
              onPress={() => router.push("/parent/prova")}
            />
          </View>
        ) : report.data ? (
          <View
            key={`${child.id}:${period}:${days}:${grade}:${subject}`}
            style={{ gap: 22 }}
          >
            <Text style={b.copy}>
              {t("educationReports.range", {
                from: new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(new Date(report.data.from + "T12:00:00Z")),
                through: new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(new Date(report.data.through + "T12:00:00Z")),
              })}
            </Text>
            <ProgressSummary report={report.data} />
            <View style={{ flexDirection: wide ? "row" : "column", gap: 20 }}>
              <View style={wide ? { flex: 2, minWidth: 0 } : undefined}>
                <ProgressChart report={report.data} />
              </View>
              <View style={wide ? { flex: 1, minWidth: 280 } : undefined}>
                <ProgressNextStep
                  report={report.data}
                  openEvidence={openEvidence}
                  openProvas={() => router.push("/parent/prova")}
                />
              </View>
            </View>
            <ProgressTopics report={report.data} openEvidence={openEvidence} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    paddingTop: 10,
    paddingBottom: 40,
    gap: 18,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 2 },
  childChip: {
    alignSelf: "flex-start",
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: p.lilac,
    borderRadius: 24,
    justifyContent: "center",
  },
  segment: {
    flexDirection: "row",
    borderRadius: 24,
    backgroundColor: "#FFFEFB",
    borderWidth: 1,
    borderColor: "#E3D8EF",
    padding: 3,
  },
  period: {
    flex: 1,
    minHeight: 48,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  periodSelected: { backgroundColor: p.purple },
  state: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: p.line,
    padding: 28,
    gap: 16,
    backgroundColor: "#FFFEFB",
  },
  note: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 15,
    lineHeight: 22,
    color: p.muted,
  },
});
