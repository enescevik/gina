import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
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

type Scope = { child: string; grade: number; subject: string };
export default function ProvaProgressScreen() {
  const { t } = useTranslation(),
    { claims } = useSession(),
    family = claims?.family_id ?? "";
  const { width, fontScale } = useWindowDimensions(),
    wide = width >= 950 && fontScale < 1.4;
  const [selectedChild, setChild] = useState<string | null>(null),
    [days, setDays] = useState(30),
    [scope, setScope] = useState<Scope | null>(null);
  const children = useQuery({
    queryKey: ["children", family],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select(
        "id,name,grade,avatar",
      ).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const child = children.data?.find((c) => c.id === selectedChild) ??
    children.data?.[0];
  // Facets come from this child's actual 90-day history, not a guessed curriculum.
  const facets = useQuery({
    queryKey: ["learning_progress", family, child?.id, "facets"],
    enabled: !!family && !!child,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("learning_progress", {
        p_child_id: child!.id,
        p_days: 90,
      });
      if (error) throw error;
      return learningProgressSchema.parse(data);
    },
  });
  const selection = scope?.child === child?.id ? scope : null;
  const grade = selection?.grade ?? child?.grade ??
    facets.data?.topics[0]?.grade ?? 0;
  const subject = selection?.subject ?? "";
  const grades = [
    ...new Set([
      ...(child?.grade ? [child.grade] : []),
      ...(facets.data?.topics.map((r) => r.grade) ?? []),
    ]),
  ].sort((a, b) => a - b);
  const subjects = [
    ...new Set(
      (facets.data?.topics ?? []).filter((r) => !grade || r.grade === grade)
        .map((r) => r.subject),
    ),
  ].sort();
  const report = useQuery({
    queryKey: ["learning_progress", family, child?.id, days, grade, subject],
    enabled: !!family && !!child,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("learning_progress", {
        p_child_id: child!.id,
        p_days: days,
        ...(grade ? { p_grade: grade } : {}),
        ...(subject ? { p_subject: subject } : {}),
      });
      if (error) throw error;
      return learningProgressSchema.parse(data);
    },
  });
  useRealtimeInvalidate(
    "exam_attempts",
    family ? `family_id=eq.${family}` : null,
    [["learning_progress", family]],
  );
  const openEvidence = (e: ProgressTopic["evidence"][number]) =>
    router.push({
      pathname: "/parent/prova/review/[attemptId]",
      params: { attemptId: e.attempt_id, questionId: e.question_id },
    });
  const error = children.error ?? report.error;
  const pending = children.isPending || (!!child && report.isPending);
  const retry = () => {
    void children.refetch();
    if (child) {
      void report.refetch();
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
                : router.replace("/parent/prova")}
          >
            <ArrowLeft size={23} color={p.ink} />
          </IconButton>
          <Image
            source={require(
              "../../../../../../packages/assets/brand/growing-friend/logo.png",
            )}
            resizeMode="contain"
            accessibilityLabel={t("app.name")}
            style={{ width: 96, height: 40 }}
          />
          <Text style={b.bold}>{t("learningProgress.title")}</Text>
        </View>
        <View style={{ gap: 2 }}>
          <Text
            accessibilityRole="header"
            style={[b.h1, {
              fontSize: wide ? 36 : 30,
              lineHeight: wide ? 44 : 37,
            }]}
          >
            {child
              ? t("learningProgress.heading", { name: child.name })
              : t("learningProgress.title")}
          </Text>
          <Text style={b.copy}>{t("learningProgress.subtitle")}</Text>
        </View>
        {child
          ? (
            <>
              {children.data && children.data.length > 1
                ? (
                  <ChildPicker
                    profiles={children.data}
                    selected={child.id}
                    onSelect={(id) => {
                      if (id) setChild(id);
                    }}
                  />
                )
                : null}
              <View
                style={{
                  flexDirection: wide ? "row" : "column",
                  alignItems: wide ? "flex-start" : "stretch",
                  gap: 16,
                }}
              >
                {grades.length > 1
                  ? (
                    <View style={wide ? { width: 220 } : undefined}>
                      <ReportPicker
                        label={t("learningProgress.gradeFilter")}
                        value={grade}
                        options={[
                          { value: 0, label: t("learningProgress.allGrades") },
                          ...grades.map((value) => ({
                            value,
                            label: `${
                              children.data?.length === 1
                                ? child.name + " · "
                                : ""
                            }${t("learningProgress.grade", { count: value })}`,
                          })),
                        ]}
                        onChange={(value) =>
                          setScope({
                            child: child.id,
                            grade: value,
                            subject: "",
                          })}
                      />
                    </View>
                  )
                  : children.data?.length === 1
                  ? (
                    <View style={[s.childChip, wide && { maxWidth: 240 }]}>
                      <Text style={b.bold}>
                        {child.name}
                        {child.grade
                          ? ` · ${
                            t("learningProgress.grade", { count: child.grade })
                          }`
                          : ""}
                      </Text>
                    </View>
                  )
                  : null}
                <View style={[s.segment, wide && { width: 330 }]}>
                  {[7, 30, 90].map((n) => (
                    <Pressable
                      key={n}
                      accessibilityRole="button"
                      accessibilityState={{ selected: days === n }}
                      onPress={() => setDays(n)}
                      style={[s.period, days === n && s.periodSelected]}
                    >
                      <Text
                        style={[b.bold, {
                          color: days === n ? "#FFFFFF" : p.ink,
                        }]}
                      >
                        {t("learningProgress.days", { count: n })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={wide ? { width: 240, marginLeft: "auto" } : undefined}>
                  <ReportPicker
                    key={`${child.id}:${grade}`}
                    label={t("learningProgress.subject")}
                    value={subject}
                    options={[{
                      value: "",
                      label: t("learningProgress.allSubjects"),
                    }, ...subjects.map((value) => ({ value, label: value }))]}
                    onChange={(value) =>
                      setScope({ child: child.id, grade, subject: value })}
                  />
                </View>
              </View>
              {facets.error && !error
                ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void facets.refetch()}
                    style={{ minHeight: 48, justifyContent: "center" }}
                  >
                    <Text style={s.note}>
                      {t("learningProgress.filterError")}
                    </Text>
                  </Pressable>
                )
                : null}
            </>
          )
          : null}
        {error
          ? (
            <View style={s.state}>
              <Text accessibilityRole="alert" style={b.h2}>
                {t("learningProgress.loadError")}
              </Text>
              <Text style={b.copy}>{t("learningProgress.loadErrorBody")}</Text>
              <SatinButton title={t("common.retry")} onPress={retry} />
            </View>
          )
          : pending
          ? (
            <View accessibilityLiveRegion="polite" style={s.state}>
              <LoadingStar
                size={56}
                accessibilityLabel={t("learningProgress.loading")}
              />
              <Text style={b.copy}>{t("learningProgress.loading")}</Text>
            </View>
          )
          : !child
          ? (
            <EmptyCard
              title={t("unified.chooseChild")}
              body={t("unified.noChildHelp")}
            >
              <SatinButton
                title={t("unified.createFirstChild")}
                onPress={() => router.push("/parent/menu")}
              />
            </EmptyCard>
          )
          : report.data?.summary.total === 0
          ? (
            <View style={s.state}>
              <Image
                source={require(
                  "../../../../../../packages/assets/brand/growing-friend/reading.png",
                )}
                resizeMode="contain"
                style={{ width: 140, height: 124 }}
                accessible={false}
              />
              <Text style={b.h2}>{t("learningProgress.emptyTitle")}</Text>
              <Text style={[b.copy, { textAlign: "center", maxWidth: 500 }]}>
                {t("learningProgress.emptyBody")}
              </Text>
              <SatinButton
                title={t("learningProgress.provasAction")}
                onPress={() => router.push("/parent/prova")}
              />
            </View>
          )
          : report.data
          ? (
            <View
              key={`${child.id}:${days}:${grade}:${subject}`}
              style={{ gap: 22 }}
            >
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
              <ProgressTopics
                report={report.data}
                openEvidence={openEvidence}
              />
            </View>
          )
          : null}
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
