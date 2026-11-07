import {useFutureLearningReady} from "@/lib/future-learning";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
  ClipboardCheck,
  ChevronRight,
} from "lucide-react-native";
import { Avatar } from "@/components/avatar";
import { p, SatinButton } from "@/components/planner/ui";
import { Pressable } from "@/components/ui/pressable";
import { ChildPicker, NavigationCard } from "@/components/ui/parent-screen";
import { b, BuilderCard } from "@/components/learning/prova-builder-ui";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { DraftLifecycle } from "@/components/learning/draft-lifecycle";
import type { DraftRecord } from "@/lib/prova-draft";
import { DraftOverview } from "@/components/learning/prova-draft-overview";
import { fetchProvaDrafts } from "@/lib/prova-draft";
import { ProvaDraftBulkEntry } from "@/components/planner/bulk-scope-sheet";
import { provaErrorMessage } from "@/lib/prova-ai";
import { attemptSummary } from "@gina/core";
import { useScenarioFit } from "@/components/learning/scenario-fit-review";

/** P04 sütunları (open_pending/open_unanswered/provisional) üretilmiş tiplerde henüz yok; satır elle tiplenir. */
interface HubAttempt {
  id: string;
  status: "in_progress" | "submitted" | "graded";
  mc_total: number | null;
  mc_correct: number | null;
  open_total: number | null;
  open_graded: number | null;
  open_pending: number | null;
  open_unanswered: number | null;
  provisional: boolean | null;
  score_pct: number | null;
  finished_at: string | null;
  created_at: string;
}
interface HubExam {
  id: string;
  child_id: string;
  title: string;
  kind: string;
  status: string;
  timed: boolean;
  duration_minutes: number | null;
  question_ids: string[];
  children: { name: string; avatar: string | null } | null;
  assessment_track: string | null;
  blueprint_id: string | null;
  exam_attempts: HubAttempt[];
}
const HUB_EXAM_SELECT: string =
  "id,child_id,title,kind,status,timed,duration_minutes,question_ids,assessment_track,blueprint_id,children(name,avatar),exam_attempts(id,status,mc_total,mc_correct,open_total,open_graded,open_pending,open_unanswered,provisional,score_pct,finished_at,created_at)";

const HUB_TABS = ["prepare", "sent", "review"] as const;
type HubTab = (typeof HUB_TABS)[number];

export default function ParentProvaScreen() {
  const ready=useFutureLearningReady();
  const dailyReady=useFutureLearningReady("daily_practice");
  const queryClient = useQueryClient();
  const pinPractice = useMutation({
    mutationFn: async ({ id }: { id: string; childId: string }) => {
      const { error } = await supabase.rpc('pin_daily_practice', { p_exam_id: id });
      if (error) throw error;
    },
    onSuccess: (_, { childId }) => queryClient.invalidateQueries({ queryKey: ['daily_practice', childId] }),
  });
  const { t } = useTranslation(),
    { claims } = useSession(),
    familyId = claims?.family_id ?? "";
  // C04: üç iş — Hazırla (taslak + araçlar) / Gönderilenler / İncelenecekler.
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<HubTab>(
    HUB_TABS.includes(initialTab as HubTab) ? initialTab as HubTab : "prepare",
  ),
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
      ).is("archived_at", null).order("sort_order");
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
        HUB_EXAM_SELECT,
      ).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as unknown as HubExam[];
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
  const [discardDraft, setDiscardDraft] = useState<DraftRecord | null>(null);
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
  // D1: C05 soru-kazanım uygunluğu incelemesi (yalnız katalog senaryosuna bağlı soru varsa görünür).
  const fitSummary = useScenarioFit("pending").data?.summary;
  const reviewed = attempts.filter((a) => a.attempt.status === "graded");
  const sentOpen = visibleExams.filter((e) => e.status === "assigned").length;
  // İnceleme durumu: "2 açık uçlu cevap incelemeni bekliyor · 1 soru cevapsız". Eski kayıtta sayaç yoksa genel etiket.
  const reviewLabel = (attempt: HubAttempt) => {
    const s = attemptSummary(attempt, []);
    const parts = [
      s.pendingOpenCount > 0 ? t("prova.ai.reviewWaiting", { count: s.pendingOpenCount }) : null,
      s.unansweredOpenCount > 0 ? t("prova.ai.unansweredCount", { count: s.unansweredOpenCount }) : null,
    ].filter((x): x is string => !!x);
    return parts.length ? parts.join(" · ") : t("provaBuilder.reviewPending");
  };
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
  const pendingSection = pending.length ? <View style={{ gap: 12 }}>
    <Text style={b.h2}>{t("provaBuilder.reviewPending")}</Text>
    {pending.map(({ exam, attempt }) => <Pressable key={attempt.id} accessibilityRole="button"
      onPress={() => router.push({ pathname: "/parent/prova/attempt/[attemptId]", params: { attemptId: attempt.id } })}
      style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.line }}>
      <View style={{ width: 45, height: 45, backgroundColor: '#E5F3ED', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><ClipboardCheck size={23} color="#227D73"/></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={b.bold}>{exam.title}</Text><Text style={b.muted}>{exam.children?.name} · {reviewLabel(attempt)}</Text></View><ChevronRight size={19} color={p.purple}/>
    </Pressable>)}
  </View> : null;
  const createButton = <SatinButton title={t("provaBuilder.title")} icon={<Plus size={20} color="#fff"/>}
    style={wide ? { minWidth: 185, alignSelf: 'center' } : undefined}
    onPress={() => router.push({ pathname: "/parent/prova/builder", params: childId ? { childId } : {} })}/>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.cream }}>
      <ScrollView contentContainerStyle={[b.page, { maxWidth: 1280, paddingHorizontal: wide ? 40 : 22, paddingTop: wide ? 24 : 14, gap: wide ? 18 : 18 }]}>
        <View style={b.row}>
          <Image
            source={require(
              "../../../../../../packages/assets/brand/growing-friend/logo.png",
            )}
            resizeMode="contain"
            style={{ width: wide ? 110 : 99, height: wide ? 48 : 42 }}
          />
          <View style={{ flex: 1 }} />
          {children.data?.length === 1
            ? (
              <View style={b.row}>
                <Avatar slug={children.data[0].avatar} size={wide ? 42 : 34} />
                <View><Text style={[b.bold, { fontSize: 15, lineHeight: 21 }]}>{children.data[0].name}</Text>{children.data[0].grade && <Text style={[b.muted, { fontSize: 14, lineHeight: 21 }]}>{t("provaHub.grade", { grade: children.data[0].grade })}</Text>}</View>
              </View>
            )
            : null}
        </View>
        <View style={{ flexDirection: wide ? 'row' : 'column', justifyContent: 'space-between', gap: 18 }}>
          <View style={{ gap: 7, flex: wide ? 1 : undefined }}><Text style={[b.h1, wide && { fontSize: 38 }]}>{t("prova.title")}</Text><Text style={[b.copy, { color: p.muted }]}>{t("provaBuilder.hubBody")}</Text></View>
          {createButton}
        </View>
        {dailyReady?<NavigationCard title={t("studyPreferences.title")} onPress={() => router.push("/parent/prova/reading")} />:null}
        {ready?<NavigationCard title={t("reinforcement.title")} onPress={() => router.push("/parent/prova/reinforcement")} />:null}
        {ready?<NavigationCard title={t("questionLikes.title")} onPress={() => router.push("/parent/prova/favorites")} />:null}
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
        <View
          // C12: büyük yazı/dar ekranda sekmeler üst üste binmek yerine alt satıra geçer.
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: wide ? 32 : 16,
            justifyContent: wide ? 'flex-start' : 'space-between',
            borderBottomWidth: 1,
            borderBottomColor: p.line,
          }}
        >
          {HUB_TABS.map((v) => (
            <Pressable
              key={v}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === v }} aria-selected={tab === v}
              onPress={() => setTab(v)}
              style={{
                flexShrink: 0,
                flexDirection: 'row',
                gap: 6,
                minHeight: 48,
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
                {t(`provaC04.tab.${v}`)}
              </Text>{(v === 'review' ? pending.length : v === 'sent' ? sentOpen : activeDrafts.length) > 0 && <Text accessibilityLabel={t('provaC04.tabCount', { count: v === 'review' ? pending.length : v === 'sent' ? sentOpen : activeDrafts.length })} style={{ backgroundColor: p.lilac, borderRadius: 12, minWidth: 23, textAlign: 'center', color: p.muted, fontFamily: 'Nunito_800ExtraBold', fontSize: 13, padding: 3 }}>{v === 'review' ? pending.length : v === 'sent' ? sentOpen : activeDrafts.length}</Text>}
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
        {tab === "prepare"
          ? (
            <View style={{ gap: 26 }}>
              {activeDrafts.length > 0
                ? <DraftOverview drafts={activeDrafts} familyId={familyId} wide={wide} onDiscard={setDiscardDraft} />
                : empty(t("provaC04.prepareEmpty"))}
              <DraftLifecycle familyId={familyId} childId={childId} selected={discardDraft} onClose={() => setDiscardDraft(null)} />
              {/* C03: toplu seçim girişi (yalnız taslaklar; Prova merkezinin geri kalanı C04). */}
              <ProvaDraftBulkEntry childId={childId} childName={children.data?.find((c) => c.id === childId)?.name} />
              <View style={{ gap: 12 }}>
                <Text style={b.h2}>{t("provaC04.toolsTitle")}</Text>
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
                  ? ([
                    ["provaP02.level.title", "/parent/prova/level"],
                    ["group.title", "/parent/prova/groups"],
                    ["prova.booklet.title", "/parent/prova/booklet"],
                    ["prova.newBlueprint", "/parent/prova/blueprint"],
                  ] as const).map(([label, path]) => (
                    <NavigationCard
                      key={path}
                      title={t(label)}
                      onPress={() => router.push(path)}
                    />
                  ))
                  : null}
              </View>
            </View>
          )
          : null}
        {tab === "sent"
          ? (
            <View style={{ gap: 22, width: "100%" }}>
              <Text style={b.h2}>{t("provaBuilder.assigned")}</Text>
              {!visibleExams.length ? empty(t("provaBuilder.noAssigned")) : null}
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
                        ? reviewLabel(latest)
                        : latest?.status === "graded"
                        ? (latest.mc_total ?? 0) === 0
                          ? t("prova.ai.attemptStatus.graded")
                          : t("prova.resultMc", {
                            correct: latest.mc_correct ?? 0,
                            total: latest.mc_total ?? 0,
                          })
                        : latest?.status === "in_progress"
                        ? t("prova.inProgress")
                        : t(`prova.status.${exam.status}`)}
                    </Text>
                    {dailyReady && !latest && exam.kind === "practice" && exam.status === "assigned" && !exam.timed && exam.question_ids.length === 1 && !exam.assessment_track && !exam.blueprint_id && (
                      pinPractice.variables?.id === exam.id && pinPractice.isSuccess
                        ? <Text accessibilityLiveRegion="polite" style={b.muted}>{t("dailyPractice.pinned")}</Text>
                        : <SatinButton secondary title={t("dailyPractice.pin")} busy={pinPractice.isPending} onPress={() => pinPractice.mutate({ id: exam.id, childId: exam.child_id })} />
                    )}
                    {pinPractice.variables?.id === exam.id && pinPractice.isError && <Text accessibilityLiveRegion="polite" style={b.muted}>{t("dailyPractice.pinFailed")}</Text>}
                    {latest?.status === "submitted"
                      ? (
                        <SatinButton
                          secondary
                          title={t("provaC04.goReview")}
                          icon={<ArrowRight color={p.purple} size={18} />}
                          onPress={() => setTab("review")}
                        />
                      )
                      : null}
                  </View>
                );
              })}
            </View>
          )
          : null}
        {tab === "review"
          ? (
            <View style={{ gap: 18 }}>
              {pending.length ? pendingSection : empty(t("provaC04.reviewEmpty"))}
              {fitSummary && fitSummary.total > 0
                ? (
                  <NavigationCard
                    title={t("d1.fit.title")}
                    body={fitSummary.pending_human_review > 0
                      ? t("d1.fit.entryPending", { count: fitSummary.pending_human_review })
                      : t("d1.fit.entryDone", { count: fitSummary.total })}
                    onPress={() => router.push("/parent/prova/fit")}
                  />
                )
                : null}
              <NavigationCard
                title={t("prova.progress.title")}
                body={t("unified.progressHelp")}
                onPress={() => router.push("/parent/prova/progress")}
              />
              {reviewed.length ? <Text style={b.h2}>{t("provaC04.reviewedTitle")}</Text> : null}
              {reviewed.map(({ exam, attempt }) => (
                <NavigationCard
                  key={attempt.id}
                  title={`${exam.children?.name} · ${exam.title}`}
                  body={(attempt.mc_total ?? 0) === 0
                    ? t("prova.ai.attemptStatus.graded")
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
            </View>
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
            accessibilityState={{ selected: key === "prova" }} aria-current={key === "prova" ? "page" : undefined}
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
