import { invalidateProvaLists } from "@/lib/prova-cache";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Check, ShieldCheck, Users, X } from "lucide-react-native";
import {
  EmptyCard,
  ParentScreen as Screen,
  parentStyles,
} from "@/components/ui/parent-screen";
import { Pressable } from "@/components/ui/pressable";
import { p, SatinButton, Tag, u } from "@/components/planner/ui";
import { supabase } from "@/lib/supabase";
import { useFamilyTimezone } from "@/lib/family";
import { useSession } from "@/lib/session";
import { useRouteMotion } from "@/lib/use-route-motion";
import {
  type CohortReviewRow,
  CohortWrittenReport,
} from "@/components/learning/cohort-written-report";
import {
  GroupPhases,
  RankingNotice,
} from "@/components/prova-library/group-phases";
interface Group {
  id: string;
  title: string;
  subject: string;
  grade: number;
  curriculum: string;
  version: string;
  starts_at: string;
  ends_at: string;
  minutes: number;
  questions: number;
  included: boolean;
  requires_review?: boolean;
  max_points?: number;
  status: string;
}
interface Entry {
  group_id: string;
  child_id: string;
  exam_id: string;
  alias: string;
  ranking: boolean;
}
interface Catalog {
  enabled: boolean;
  monthly: number;
  used: number;
  groups: Group[];
  entries: Entry[];
}
interface Report {
  requires_review?: boolean;
  published?: boolean;
  points?: number | null;
  maximum?: number;
  reviews?: CohortReviewRow[];
  ready: boolean;
  participated: boolean;
  /** Server-side: false keeps this entry off the definitive board, with ranking_reason. */
  ranked?: boolean;
  ranking_reason?: string | null;
  ranking_optional?: boolean;
  /** Automatic cohorts: own count while the attempt is still open; never a final result. */
  interim?: boolean;
  cancelled: boolean;
  ends_at?: string;
  correct: number;
  total: number;
  attempt_id: string;
  topics: {
    topic: string;
    total: number;
    correct: number;
    unanswered: number;
  }[];
  ranking: {
    alias: string;
    points?: number;
    maximum?: number;
    correct: number;
    total: number;
    rank: number;
    mine: boolean;
  }[];
}
function Choice(
  { title, checked, onPress, disabled = false }: {
    title: string;
    checked: boolean;
    onPress: () => void;
    disabled?: boolean;
  },
) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      aria-checked={checked}
      onPress={onPress}
      style={[u.row, {
        minHeight: 48,
        alignItems: "flex-start",
        paddingVertical: 10,
      }]}
    >
      <View
        style={{
          width: 25,
          height: 25,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: p.purple,
          backgroundColor: checked ? p.purple : "#FFF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {checked ? <Check size={18} color="#FFF" /> : null}
      </View>
      <Text style={[u.small, { flex: 1, lineHeight: 23, fontSize: 16 }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export default function GroupExams() {
  const { t, i18n } = useTranslation();
  const formatPoints = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 });
  const { animation } = useRouteMotion();
  const { claims } = useSession();
  const cache = useQueryClient();
  const timeZone = useFamilyTimezone();
  const gate = useRef(false);
  const [joining, setJoining] = useState<Group | null>(null);
  const [child, setChild] = useState("");
  const [consent, setConsent] = useState(false);
  const [reviewConsent, setReviewConsent] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rankingRequest, setRankingRequest] = useState<Entry | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);
  const [selected, setSelected] = useState<Entry | null>(null);
  const catalog = useQuery({
    queryKey: ["group_exams", claims?.family_id],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_exams");
      if (error) throw error;
      return data as unknown as Catalog;
    },
  });
  const children = useQuery({
    queryKey: ["group_children", claims?.family_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select(
        "id,name,grade",
      ).is("archived_at", null).order("name");
      if (error) throw error;
      return data;
    },
  });
  const report = useQuery({
    queryKey: [
      "group_result",
      claims?.family_id,
      selected?.group_id,
      selected?.child_id,
    ],
    enabled: !!selected,
    refetchInterval: selected ? 15_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_result", {
        p_group: selected!.group_id,
        p_child: selected!.child_id,
      });
      if (error) throw error;
      return data as unknown as Report;
    },
  });
  const date = (s: string) =>
    new Date(s).toLocaleString(i18n.language, {
      timeZone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const childName = (id: string) =>
    children.data?.find((c) => c.id === id)?.name ?? t("group.child");
  async function perform(action: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      const key = `group.errors.${(e as Error).message}`;
      setError(i18n.exists(key) ? t(key) : t("group.retryCheck"));
      const refreshed = await catalog.refetch();
      if (
        joining &&
        refreshed.data?.entries.some((e) =>
          e.group_id === joining.id && e.child_id === child
        )
      ) {
        setJoining(null);
        setError("");
        setNotice(t("group.enrolled", { name: childName(child) }));
      }
      void invalidateProvaLists(cache);
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function enroll() {
    if (
      !joining || !child || !consent ||
      (joining.requires_review && !reviewConsent)
    ) return;
    await perform(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const { error } = await Promise.resolve(
        supabase.rpc("enroll_reviewed_group_exam", {
          p_review_consent: reviewConsent,
          p_group: joining.id,
          p_child: child,
          p_ranking: ranking,
          p_consent: consent,
        }).abortSignal(controller.signal),
      ).finally(() => clearTimeout(timer));
      if (error) throw error;
      setNotice(t("group.enrolled", { name: childName(child) }));
      setJoining(null);
      await Promise.all([
        catalog.refetch(),
        invalidateProvaLists(cache),
      ]);
    });
  }
  async function changeRanking(entry: Entry) {
    await perform(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const { error } = await Promise.resolve(
        supabase.rpc("set_group_ranking_consent", {
          p_group: entry.group_id,
          p_child: entry.child_id,
          p_enabled: !entry.ranking,
        }).abortSignal(controller.signal),
      ).finally(() => clearTimeout(timer));
      if (error) throw error;
      setRankingRequest(null);
      await catalog.refetch();
      await cache.invalidateQueries({ queryKey: ["group_result"] });
    });
  }
  return (
    <Screen
      title={t("group.title")}
      subtitle={t("group.subtitle")}
      loading={catalog.isLoading || children.isLoading}
      error={catalog.error ?? children.error}
      onRetry={() => {
        void catalog.refetch();
        void children.refetch();
      }}
    >
      <View style={[parentStyles.card, { backgroundColor: p.lilac }]}>
        <View style={u.row}>
          <Users size={28} color={p.purple} />
          <Text style={[u.heading, { flex: 1 }]}>{t("group.together")}</Text>
        </View>
        <Text style={u.small}>{t("group.help")}</Text>
        <Text style={u.bold}>
          {t("group.allowance", {
            used: catalog.data?.used ?? 0,
            total: catalog.data?.monthly ?? 0,
          })}
        </Text>
        {!catalog.data?.enabled
          ? <Text style={u.small}>{t("group.disabled")}</Text>
          : null}
      </View>
      {error
        ? <Text accessibilityRole="alert" style={u.error}>{error}</Text>
        : null}
      {notice
        ? <Text accessibilityRole="alert" style={u.bold}>{notice}</Text>
        : null}
      {rankingRequest
        ? (
          <Modal
            visible
            animationType={animation}
            onRequestClose={() => {
              if (!gate.current) setRankingRequest(null);
            }}
            supportedOrientations={["portrait", "landscape"]}
          >
            <SafeAreaView style={u.root}>
              <ScrollView
                contentContainerStyle={{
                  padding: 24,
                  maxWidth: 700,
                  width: "100%",
                  alignSelf: "center",
                }}
              >
                <View style={parentStyles.card}>
                  <Text style={u.heading}>{t("group.showRanking")}</Text>
                  <Text style={u.bold}>
                    {childName(rankingRequest.child_id)} ·{" "}
                    {rankingRequest.alias}
                  </Text>
                  <Text style={u.small}>{t("group.rankingConsent")}</Text>
                  {error
                    ? (
                      <Text accessibilityRole="alert" style={u.error}>
                        {error}
                      </Text>
                    )
                    : null}
                  <SatinButton
                    title={t("group.showRanking")}
                    busy={busy}
                    disabled={busy}
                    onPress={() => void changeRanking(rankingRequest)}
                  />
                  <SatinButton
                    secondary
                    title={t("common.cancel")}
                    disabled={busy}
                    onPress={() => setRankingRequest(null)}
                  />
                </View>
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )
        : null}
      {joining
        ? (
          <Modal
            visible
            animationType={animation}
            onRequestClose={() => {
              if (!gate.current) setJoining(null);
            }}
            supportedOrientations={["portrait", "landscape"]}
          >
            <SafeAreaView style={u.root}>
              <ScrollView
                contentContainerStyle={{
                  padding: 24,
                  width: "100%",
                  maxWidth: 800,
                  alignSelf: "center",
                }}
              >
                <View style={[parentStyles.card, { borderColor: p.purple }]}>
                  <Text style={u.heading}>{joining.title}</Text>
                  {error
                    ? (
                      <Text accessibilityRole="alert" style={u.error}>
                        {error}
                      </Text>
                    )
                    : null}
                  <Text style={u.small}>
                    {t("group.chooseChild", { grade: joining.grade })}
                  </Text>
                  <View style={[u.row, { flexWrap: "wrap" }]}>
                    {children.data?.filter((c) =>
                      c.grade === joining.grade &&
                      !catalog.data?.entries.some((e) =>
                        e.group_id === joining.id && e.child_id === c.id
                      )
                    )
                      .map((c) => (
                        <Tag
                          key={c.id}
                          label={c.name}
                          selected={child === c.id}
                          onPress={() => {
                            setChild(c.id);
                            setConsent(false);
                            setReviewConsent(false);
                            setRanking(false);
                          }}
                        />
                      ))}
                  </View>
                  {!children.data?.some((c) => c.grade === joining.grade)
                    ? <Text style={u.small}>{t("group.noMatchingChild")}</Text>
                    : null}
                  {joining.requires_review
                    ? (
                      <>
                        <Text style={u.bold}>
                          {t("cohort.joinTitle", {
                            points: joining.max_points,
                          })}
                        </Text>
                        <Text style={u.small}>{t("cohort.joinHelp")}</Text>
                        <Choice
                          title={t("cohort.reviewConsent")}
                          checked={reviewConsent}
                          disabled={busy}
                          onPress={() => setReviewConsent((v) => !v)}
                        />
                      </>
                    )
                    : null}
                  <Choice
                    title={t("group.participation")}
                    checked={consent}
                    disabled={busy}
                    onPress={() => setConsent((v) => !v)}
                  />
                  <Choice
                    title={t("group.rankingConsent")}
                    checked={ranking}
                    disabled={busy}
                    onPress={() => setRanking((v) => !v)}
                  />
                  <SatinButton
                    title={t("group.enroll")}
                    busy={busy}
                    disabled={!child || !consent || busy ||
                      (!!joining.requires_review && !reviewConsent)}
                    onPress={() => void enroll()}
                  />
                  <SatinButton
                    secondary
                    title={t("common.cancel")}
                    disabled={busy}
                    onPress={() => setJoining(null)}
                  />
                </View>
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )
        : null}
      {!catalog.data?.groups.length
        ? <EmptyCard title={t("group.empty")} slug="display-bookworm" />
        : null}
      {catalog.data?.groups.map((g) => {
        const entries = catalog.data.entries.filter((e) => e.group_id === g.id);
        const eligible = (children.data ?? []).filter((c) =>
          c.grade === g.grade && !entries.some((e) => e.child_id === c.id)
        );
        const open = g.status === "published" &&
          now >= Date.parse(g.starts_at) && now < Date.parse(g.ends_at);
        return (
          <View key={g.id} style={parentStyles.card}>
            <Text style={u.heading}>{g.title}</Text>
            <Text style={u.small}>
              {g.subject} · {t("parent.gradeShort", { grade: g.grade })} ·{" "}
              {t("prova.questionCount", { count: g.questions })} · {g.minutes}
              {" "}
              {t("prova.min")}
            </Text>
            <Text style={u.small}>{date(g.starts_at)} – {date(g.ends_at)}</Text>
            <Text style={u.small}>
              {t("group.familyTime", { zone: timeZone })}
            </Text>
            <Text style={u.small}>
              {g.curriculum} · {t("group.version", { version: g.version })}
            </Text>
            {g.status === "cancelled"
              ? <Text style={u.error}>{t("group.cancelled")}</Text>
              : null}
            <GroupPhases group={g.id} formatDate={date} childName={childName} />
            {entries.map((e) => (
              <View
                key={e.child_id}
                style={{
                  gap: 10,
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: "#EAF8F2",
                }}
              >
                <Text style={u.bold}>{childName(e.child_id)} · {e.alias}</Text>
                <Text style={u.small}>
                  {t(e.ranking ? "group.rankingOn" : "group.rankingOff")}
                </Text>
                <View style={[u.row, { flexWrap: "wrap" }]}>
                  <SatinButton
                    secondary
                    title={t("group.result")}
                    onPress={() => setSelected(e)}
                  />
                  <SatinButton
                    secondary
                    disabled={busy}
                    title={t(
                      e.ranking ? "group.hideRanking" : "group.showRanking",
                    )}
                    onPress={() =>
                      e.ranking ? void changeRanking(e) : setRankingRequest(e)}
                  />
                </View>
              </View>
            ))}
            {open && eligible.length > 0
              ? (
                <SatinButton
                  title={t(g.included ? "group.join" : "group.needsPlan")}
                  disabled={busy || !g.included || !catalog.data.enabled ||
                    (catalog.data.used >= catalog.data.monthly)}
                  onPress={() => {
                    setJoining(g);
                    setChild(eligible.length === 1 ? eligible[0].id : "");
                    setError("");
                    setConsent(false);
                    setReviewConsent(false);
                    setRanking(false);
                    setSelected(null);
                  }}
                />
              )
              : open && !eligible.length && !entries.length
              ? <Text style={u.small}>{t("group.noMatchingChild")}</Text>
              : g.status === "published" && !open
              ? (
                <Text style={u.small}>
                  {t(
                    now < Date.parse(g.starts_at)
                      ? "group.upcoming"
                      : "group.closed",
                  )}
                </Text>
              )
              : null}
          </View>
        );
      })}
      {selected
        ? (
          <Modal
            visible
            animationType={animation}
            onRequestClose={() => setSelected(null)}
            supportedOrientations={["portrait", "landscape"]}
          >
            <SafeAreaView style={u.root}>
              <ScrollView
                contentContainerStyle={{
                  padding: 24,
                  width: "100%",
                  maxWidth: 900,
                  alignSelf: "center",
                }}
              >
                <View style={[parentStyles.card, { borderColor: p.purple }]}>
                  <View style={u.row}>
                    <ShieldCheck color={p.purple} />
                    <Text style={[u.heading, { flex: 1 }]}>
                      {t("group.privateResult", {
                        name: childName(selected.child_id),
                      })}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("group.closeResult")}
                      onPress={() => setSelected(null)}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: p.lilac,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={22} color={p.purple} />
                    </Pressable>
                  </View>
                  {report.isLoading
                    ? <Text style={u.small}>{t("common.loading")}</Text>
                    : report.error
                    ? (
                      <>
                        <Text style={u.error}>{t("group.failed")}</Text>
                        <SatinButton
                          secondary
                          title={t("common.retry")}
                          onPress={() => void report.refetch()}
                        />
                      </>
                    )
                    : report.data?.ready
                    ? report.data.participated
                      ? (
                        <>
                          {report.data.cancelled
                            ? (
                              <Text style={u.error}>
                                {t("group.cancelled")}
                              </Text>
                            )
                            : null}
                          {report.data.requires_review
                            ? (
                              <CohortWrittenReport
                                group={selected.group_id}
                                child={selected.child_id}
                                published={!!report.data.published}
                                points={report.data.points ?? null}
                                maximum={report.data.maximum ?? 0}
                                rows={report.data.reviews ?? []}
                                cancelled={!!report.data.cancelled}
                                onSaved={() => void report.refetch()}
                              />
                            )
                            : (
                              <Text style={u.heading}>
                                {report.data.interim
                                  ? `${t("groupPhases.interim")} · `
                                  : ""}
                                {report.data.maximum == null
                                  ? t("prova.resultMc", {
                                    correct: report.data.correct,
                                    total: report.data.total,
                                  })
                                  : report.data.points == null
                                  ? t("group.pointsPending")
                                  : t("group.pointsResult", {
                                    points: formatPoints.format(report.data.points),
                                    maximum: report.data.maximum,
                                  })}
                              </Text>
                            )}
                          <RankingNotice
                            ranked={report.data.ranked}
                            reason={report.data.ranking_reason}
                            interim={report.data.interim}
                          />
                          <Text style={u.small}>{t("group.limits")}</Text>
                          {report.data.topics.map((topic) => (
                            <View
                              key={topic.topic}
                              style={{
                                backgroundColor: topic.correct === topic.total
                                  ? "#EAF8F2"
                                  : "#FFF1DD",
                                padding: 16,
                                borderRadius: 18,
                                gap: 8,
                              }}
                            >
                              <Text style={u.bold}>{topic.topic}</Text>
                              <Text style={u.small}>
                                {t("group.topicScore", topic)}
                              </Text>
                              <Text style={u.small}>
                                {t(
                                  topic.correct === topic.total
                                    ? "group.keepLearning"
                                    : "group.practiceNext",
                                  { topic: topic.topic },
                                )}
                              </Text>
                            </View>
                          ))}
                          <SatinButton
                            title={t("group.detailed")}
                            onPress={() => {
                              setSelected(null);
                              router.push({
                                pathname: "/parent/prova/attempt/[attemptId]",
                                params: { attemptId: report.data!.attempt_id },
                              });
                            }}
                          />
                          {report.data.ranking.length
                            ? (
                              <>
                                <Text style={u.heading}>
                                  {t("group.rankingTitle")}
                                </Text>
                                <Text style={u.small}>
                                  {t(report.data.requires_review ? "cohort.rankingHelp" : "group.rankingHelp")}
                                </Text>
                                {report.data.ranking.map((r) => (
                                  <View
                                    key={r.alias}
                                    style={[u.row, {
                                      padding: 12,
                                      borderRadius: 15,
                                      backgroundColor: r.mine
                                        ? p.lilac
                                        : "#F7F5FA",
                                    }]}
                                  >
                                    <Text style={u.bold}>{r.rank}</Text>
                                    <Text style={[u.small, { flex: 1 }]}>
                                      {r.alias}
                                      {r.mine ? ` · ${t("group.you")}` : ""}
                                    </Text>
                                    <Text style={u.bold}>
                                      {r.points != null
                                        ? `${formatPoints.format(r.points)} / ${r.maximum}`
                                        : `${r.correct} / ${r.total}`}
                                    </Text>
                                  </View>
                                ))}
                              </>
                            )
                            : null}
                        </>
                      )
                      : (
                        <Text style={u.small}>
                          {t("group.notParticipated")}
                        </Text>
                      )
                    : (
                      <Text style={u.small}>
                        {t("group.resultWaiting", {
                          date: report.data?.ends_at
                            ? date(report.data.ends_at)
                            : "",
                        })}
                      </Text>
                    )}
                </View>
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )
        : null}
    </Screen>
  );
}
