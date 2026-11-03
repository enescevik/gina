import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Image,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowRight,
  CalendarDays,
  GraduationCap,
  Home,
  MoreHorizontal,
  Plus,
} from "lucide-react-native";
import { Avatar } from "@/components/avatar";
import { p, SatinButton } from "@/components/planner/ui";
import { Pressable } from "@/components/ui/pressable";
import { ChildPicker, NavigationCard } from "@/components/ui/parent-screen";
import { b, BuilderCard } from "@/components/learning/prova-builder-ui";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { fetchProvaDrafts } from "@/lib/prova-draft";
import { provaErrorMessage } from "@/lib/prova-ai";

export default function ParentProvaScreen() {
  const { t } = useTranslation(),
    { claims } = useSession(),
    familyId = claims?.family_id ?? "";
  const [tab, setTab] = useState<"hub" | "results" | "library">("hub"),
    [tools, setTools] = useState(false),
    [selectedChild, setSelectedChild] = useState<string | null>(null);
  const { width, fontScale } = useWindowDimensions(),
    wide = width >= 950 && fontScale < 1.4;
  const children = useQuery({
    queryKey: ["children", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select(
        "id,name,avatar,grade",
      ).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const childId = children.data?.length === 1
    ? children.data[0].id
    : selectedChild;
  const drafts = useQuery({
    queryKey: ["prova_drafts", familyId],
    enabled: !!familyId,
    queryFn: () => fetchProvaDrafts(),
  });
  const exams = useQuery({
    queryKey: ["exams", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select(
        "id,child_id,title,kind,status,timed,duration_minutes,question_ids,children(name,avatar),exam_attempts(id,status,mc_total,mc_correct,finished_at,created_at)",
      ).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  const refetchDrafts = drafts.refetch, refetchExams = exams.refetch;
  useFocusEffect(useCallback(() => {
    void refetchDrafts();
    void refetchExams();
  }, [refetchDrafts, refetchExams]));
  useRealtimeInvalidate(
    "exam_attempts",
    familyId ? `family_id=eq.${familyId}` : null,
    [["exams", familyId]],
  );
  useRealtimeInvalidate("exams", familyId ? `family_id=eq.${familyId}` : null, [
    ["exams", familyId],
  ]);
  const activeDrafts = (drafts.data ?? []).filter((d) =>
    !d.submitted_at && (!childId || d.content.childId === childId)
  );
  const visibleExams = (exams.data ?? []).filter((e) =>
    !childId || e.child_id === childId
  );
  const attempts = visibleExams.flatMap((e) =>
    e.exam_attempts.filter((a) =>
      a.status === "submitted" || a.status === "graded"
    ).map((a) => ({ exam: e, attempt: a }))
  ).sort((a, b) => b.attempt.created_at.localeCompare(a.attempt.created_at));
  const pending = attempts.filter((a) => a.attempt.status === "submitted");
  const empty = (title: string) => (
    <View style={[b.hint, { flexDirection: "row", alignItems: "center" }]}>
      <Image
        source={require(
          "../../../../../../packages/assets/brand/growing-friend/reading.png",
        )}
        resizeMode="contain"
        style={{ width: 92, height: 88 }}
      />
      <Text style={[b.muted, { flex: 1 }]}>{title}</Text>
    </View>
  );
  const draftsAndPending = (
    <View style={{ gap: 20 }}>
      {activeDrafts.length
        ? (
          <>
            <Text style={b.h2}>{t("provaBuilder.drafts")}</Text>
            {activeDrafts.map((d) => (
              <View key={d.id} style={b.card}>
                <View style={b.row}>
                  <Text style={[b.bold, { flex: 1, color: "#287969" }]}>
                    {d.content.subjects.join(" · ") ||
                      t("provaBuilder.untitled")}
                  </Text>
                  <Text
                    style={[b.muted, {
                      padding: 8,
                      backgroundColor: p.lilac,
                      borderRadius: 12,
                    }]}
                  >
                    {t(`provaBuilder.step${d.content.step}`)}
                  </Text>
                </View>
                <Text style={b.h2}>
                  {d.content.title || t(`provaBuilder.${d.content.purpose}`)}
                </Text>
                <Text style={b.copy}>
                  {t("prova.questionCount", { count: d.content.target })} ·{" "}
                  {d.content.minutes
                    ? `${d.content.minutes} ${t("prova.min")}`
                    : t("provaBuilder.untimed")}
                </Text>
                <SatinButton
                  secondary
                  title={t("provaBuilder.resume")}
                  icon={<ArrowRight color={p.purple} size={18} />}
                  onPress={() =>
                    router.push({
                      pathname: "/parent/prova/builder",
                      params: { draftId: d.id },
                    })}
                />
              </View>
            ))}
          </>
        )
        : null}
      {pending.length
        ? (
          <>
            <Text style={b.h2}>{t("provaBuilder.reviewPending")}</Text>
            {pending.slice(0, 3).map(({ exam, attempt }) => (
              <NavigationCard
                key={attempt.id}
                title={exam.children?.name ?? exam.title}
                body={exam.title}
                onPress={() =>
                  router.push({
                    pathname: "/parent/prova/attempt/[attemptId]",
                    params: { attemptId: attempt.id },
                  })}
              />
            ))}
          </>
        )
        : null}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.cream }}>
      <ScrollView contentContainerStyle={b.page}>
        <View style={b.row}>
          <Image
            source={require(
              "../../../../../../packages/assets/brand/growing-friend/logo.png",
            )}
            resizeMode="contain"
            style={{ width: 110, height: 48 }}
          />
          <View style={{ flex: 1 }} />
          {children.data?.length === 1
            ? (
              <View style={b.row}>
                <Avatar slug={children.data[0].avatar} size={36} />
                <Text style={b.bold}>{children.data[0].name}</Text>
              </View>
            )
            : null}
        </View>
        <Text style={b.h1}>{t("prova.title")}</Text>
        <Text style={b.copy}>{t("provaBuilder.hubBody")}</Text>
        {children.data && children.data.length > 1
          ? (
            <ChildPicker
              profiles={children.data}
              selected={selectedChild}
              onSelect={setSelectedChild}
              allLabel={t("provaBuilder.all")}
            />
          )
          : null}
        <SatinButton
          title={t("provaBuilder.title")}
          icon={<Plus size={20} color="#fff" />}
          style={wide ? { alignSelf: "flex-start", minWidth: 300 } : undefined}
          onPress={() =>
            router.push({
              pathname: "/parent/prova/builder",
              params: childId ? { childId } : {},
            })}
        />
        <View
          style={{
            flexDirection: "row",
            borderBottomWidth: 1,
            borderBottomColor: p.line,
          }}
        >
          {(["hub", "results", "library"] as const).map((v) => (
            <Pressable
              key={v}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === v }}
              onPress={() => setTab(v)}
              style={{
                flex: 1,
                minHeight: 58,
                alignItems: "center",
                justifyContent: "center",
                borderBottomWidth: 3,
                borderBottomColor: tab === v ? p.purple : "transparent",
              }}
            >
              <Text
                style={[b.bold, {
                  fontSize: 15,
                  color: tab === v ? p.purple : p.muted,
                }]}
              >
                {t(`provaBuilder.${v}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        {drafts.error || exams.error || children.error
          ? (
            <BuilderCard>
              <Text style={b.error}>
                {provaErrorMessage(
                  drafts.error ?? exams.error ?? children.error,
                )}
              </Text>
              <SatinButton
                secondary
                title={t("common.retry")}
                onPress={() => {
                  void drafts.refetch();
                  void exams.refetch();
                  void children.refetch();
                }}
              />
            </BuilderCard>
          )
          : null}
        {drafts.isPending || exams.isPending
          ? <Text>{t("common.loading")}</Text>
          : null}
        {tab === "hub"
          ? (
            <View style={[b.columns, wide && { flexDirection: "row" }]}>
              <View style={{ flex: 1, gap: 22 }}>
                {!wide ? draftsAndPending : null}
                <Text style={b.h2}>{t("provaBuilder.assigned")}</Text>
                {!visibleExams.length
                  ? empty(t("provaBuilder.noAssigned"))
                  : null}
                {visibleExams.map((exam) => {
                  const latest = [...exam.exam_attempts].sort((a, b) =>
                    b.created_at.localeCompare(a.created_at)
                  )[0];
                  return (
                    <View key={exam.id} style={b.card}>
                      <View style={b.row}>
                        <Avatar slug={exam.children?.avatar} size={48} />
                        <View style={{ flex: 1, gap: 5 }}>
                          <Text style={b.bold}>{exam.title}</Text>
                          <Text style={b.muted}>
                            {exam.children?.name} · {t("prova.questionCount", {
                              count: exam.question_ids.length,
                            })} · {exam.timed
                              ? `${exam.duration_minutes} ${t("prova.min")}`
                              : t("provaBuilder.untimed")}
                          </Text>
                        </View>
                      </View>
                      <Text style={b.muted}>
                        {latest?.status === "submitted"
                          ? t("provaBuilder.reviewPending")
                          : latest?.status === "graded"
                          ? t("prova.resultMc", {
                            correct: latest.mc_correct ?? 0,
                            total: latest.mc_total ?? 0,
                          })
                          : latest?.status === "in_progress"
                          ? t("prova.inProgress")
                          : t(`prova.status.${exam.status}`)}
                      </Text>
                      {latest && ["submitted", "graded"].includes(latest.status)
                        ? (
                          <SatinButton
                            secondary
                            title={t("prova.ai.review")}
                            icon={<ArrowRight color={p.purple} size={18} />}
                            onPress={() =>
                              router.push({
                                pathname: "/parent/prova/attempt/[attemptId]",
                                params: { attemptId: latest.id },
                              })}
                          />
                        )
                        : null}
                    </View>
                  );
                })}
              </View>
              {wide && (activeDrafts.length > 0 || pending.length > 0)
                ? <View style={b.sidebar}>{draftsAndPending}</View>
                : null}
            </View>
          )
          : null}
        {tab === "results"
          ? (
            <>
              <NavigationCard
                title={t("prova.progress.title")}
                body={t("unified.progressHelp")}
                onPress={() => router.push("/parent/prova/progress")}
              />
              {!attempts.length ? empty(t("provaBuilder.noResults")) : null}
              {attempts.map(({ exam, attempt }) => (
                <NavigationCard
                  key={attempt.id}
                  title={`${exam.children?.name} · ${exam.title}`}
                  body={attempt.status === "submitted"
                    ? t("provaBuilder.reviewPending")
                    : t("prova.resultMc", {
                      correct: attempt.mc_correct ?? 0,
                      total: attempt.mc_total ?? 0,
                    })}
                  onPress={() =>
                    router.push({
                      pathname: "/parent/prova/attempt/[attemptId]",
                      params: { attemptId: attempt.id },
                    })}
                />
              ))}
            </>
          )
          : null}
        {tab === "library"
          ? (
            <>
              <NavigationCard
                title={t("library.title")}
                body={t("unified.libraryHelp")}
                onPress={() => router.push("/parent/prova/library")}
              />
              <NavigationCard
                title={t("prova.newQuestion")}
                body={t("unified.questionHelp")}
                onPress={() => router.push("/parent/prova/question")}
              />
              <SatinButton
                secondary
                title={t("provaBuilder.otherTools")}
                onPress={() => setTools((v) => !v)}
              />
              {tools
                ? (
                  <>
                    {([
                      ["prova.level.title", "/parent/prova/level"],
                      ["group.title", "/parent/prova/groups"],
                      ["prova.booklet.title", "/parent/prova/booklet"],
                      ["prova.newBlueprint", "/parent/prova/blueprint"],
                    ] as const).map(([label, path]) => (
                      <NavigationCard
                        key={path}
                        title={t(label)}
                        onPress={() => router.push(path)}
                      />
                    ))}
                  </>
                )
                : null}
            </>
          )
          : null}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderTopColor: p.line,
          backgroundColor: "#FFFEFB",
          paddingVertical: 6,
        }}
      >
        {([
          ["today", "/parent", Home],
          ["calendar", "/parent/calendar", CalendarDays],
          ["prova", "/parent/prova", GraduationCap],
          ["more", "/parent/menu", MoreHorizontal],
        ] as const).map(([key, path, Icon]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: key === "prova" }}
            onPress={() => key !== "prova" && router.navigate(path)}
            style={{
              flex: 1,
              minHeight: 56,
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
            }}
          >
            <Icon size={24} color={key === "prova" ? p.purple : p.muted} />
            <Text
              style={[b.muted, {
                fontSize: 13,
                color: key === "prova" ? p.purple : p.muted,
              }]}
            >
              {t(`parentHome.${key}`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
