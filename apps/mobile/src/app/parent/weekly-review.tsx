import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Square,
  SquareCheck,
  Sparkles,
  Star,
} from "lucide-react-native";
import { suggestionTaskTitle, type WeeklyReview, weeklyReviewSchema } from "@gina/core";
import { putTaskPrefill } from "@/components/tasks/task-prefill";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { invokeProvaAi, ProvaAiError } from "@/lib/prova-ai";
import { IconButton, SatinButton } from "@/components/planner/ui";
import { Toggle } from "@/components/ui/toggle";
import { Pressable } from "@/components/ui/pressable";
import { colors as c, styles as s } from "@/components/parent-home/theme";

export default function WeeklyReviewScreen() {
  const { claims, session } = useSession();
  return <Review key={`${session?.user.id}:${claims?.family_id}`} />;
}
function Review() {
  const { claims, session } = useSession(), { t, i18n } = useTranslation();
  const { width, fontScale } = useWindowDimensions(),
    wide = width >= 900 && fontScale < 1.4;
  const [week, setWeek] = useState<string>(),
    [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const canRead = !!claims?.family_id && claims.role === "parent";
  const report = useQuery({
    queryKey: ["weekly_review", session?.user.id, claims?.family_id, week],
    enabled: canRead,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_family_weekly_review",
        week ? { p_week: week } : {},
      );
      if (error) throw error;
      return weeklyReviewSchema.parse(data);
    },
  });
  const data = report.data;
  const { refetch } = report;
  useFocusEffect(useCallback(() => {
    if (canRead) void refetch();
  }, [canRead, refetch]));
  const format = (day: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(day + "T12:00:00Z"));
  const range = (day: string) => {
    const end = new Date(day + "T12:00:00Z");
    end.setUTCDate(end.getUTCDate() + 6);
    return format(day) + " – " + format(end.toISOString().slice(0, 10));
  };
  const change = (index: number) => {
    if (!data || locked.current || !data.weeks[index]) return;
    setWeek(data.weeks[index]);
    setConsent(false);
    setMessage("");
  };
  const generate = async () => {
    if (locked.current || !consent || !data?.can_generate) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      // Reconcile first: a previous request may have finished while this screen was away.
      const current = await report.refetch();
      if (!alive.current) return;
      if (current.error || !current.data) throw Error();
      if (!current.data.can_generate) return;
      await invokeProvaAi("ai-weekly-summary", {
        week_start: current.data.week_start,
      });
    } catch (e) {
      const code = e instanceof ProvaAiError ? e.code : "unknown";
      const key = "weeklyReview.errors." + code;
      if (alive.current) {
        setMessage(
          i18n.exists(key) ? t(key) : t("weeklyReview.errors.unknown"),
        );
      }
    } finally {
      if (alive.current) await report.refetch();
      if (alive.current) {
        locked.current = false;
        setBusy(false);
        setConsent(false);
      }
    }
  };
  const index = data?.weeks.indexOf(data.week_start) ?? 0;
  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={[s.page, !wide && s.phonePage, { gap: 22 }]}
      >
        <View style={s.topbar}>
          <View style={s.row}>
            <IconButton
              label={t("common.back")}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/parent")}
            >
              <ArrowLeft color={c.ink} size={23} />
            </IconButton>
            <Image
              source={require(
                "../../../../../packages/assets/brand/growing-friend/logo.png",
              )}
              style={{ width: 108, height: 42 }}
              resizeMode="contain"
              accessibilityLabel="GINA"
            />
          </View>
          <Text style={s.small}>{t("weeklyReview.family")}</Text>
        </View>
        <View style={s.stack}>
          <Text
            accessibilityRole="header"
            style={[s.title, !wide && s.phoneTitle]}
          >
            {t("weeklyReview.title")}
          </Text>
          <Text style={s.text}>{t("weeklyReview.subtitle")}</Text>
        </View>
        {report.isPending
          ? (
            <ActivityIndicator
              accessibilityLabel={t("weeklyReview.loading")}
              color={c.purple}
            />
          )
          : report.isError
          ? (
            <View style={s.card}>
              <Text accessibilityRole="alert" style={s.text}>
                {t("weeklyReview.loadFailed")}
              </Text>
              <SatinButton
                secondary
                title={t("weeklyReview.refresh")}
                onPress={() => void report.refetch()}
              />
            </View>
          )
          : data
          ? (
            <>
              <View
                style={[s.row, {
                  justifyContent: "space-between",
                  backgroundColor: c.lavender,
                  borderRadius: 22,
                  padding: 6,
                }]}
              >
                <IconButton
                  disabled={busy || index === 7}
                  label={t("weeklyReview.previous")}
                  onPress={() => change(index + 1)}
                >
                  <ChevronLeft color={c.purple} size={23} />
                </IconButton>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[s.text, s.bold, { textAlign: "center", flex: 1 }]}
                >
                  {range(data.week_start)}
                </Text>
                <IconButton
                  disabled={busy || index === 0}
                  label={t("weeklyReview.next")}
                  onPress={() => change(index - 1)}
                >
                  <ChevronRight color={c.purple} size={23} />
                </IconButton>
              </View>
              <View
                testID="weekly-scope"
                style={[s.summary, { gap: 4 }]}
                accessible
              >
                <Text style={[s.text, s.bold]}>
                  {t("weeklyReview.scope.period", {
                    range: range(data.week_start),
                  })}
                </Text>
                <Text style={s.small}>
                  {data.children.length
                    ? t("weeklyReview.scope.children", {
                      count: data.children.length,
                      names: data.children.map((x) => x.name ?? x.alias).join(", "),
                    })
                    : t("weeklyReview.noChildren")}
                </Text>
                <Text style={s.small}>{t("weeklyReview.scope.counted")}</Text>
                <Text style={s.small}>
                  {t("weeklyReview.scope.timezone", { zone: data.timezone })}
                </Text>
              </View>
              <View style={wide ? s.columns : { gap: 22 }}>
                <View style={[s.stack, wide && { width: "36%" }, { gap: 16 }]}>
                  <Text accessibilityRole="header" style={s.sectionTitle}>
                    {t("weeklyReview.facts")}
                  </Text>
                  <Text style={s.small}>
                    {t(
                      data.snapshot_at
                        ? "weeklyReview.frozen"
                        : "weeklyReview.live",
                    )}
                  </Text>
                  {data.children.length === 0
                    ? <Text style={s.text}>{t("weeklyReview.noChildren")}</Text>
                    : data.children.map((child) => (
                      <View key={child.alias} style={s.summary}>
                        <View style={[s.row, s.between]}>
                          <Text style={[s.text, s.bold]}>
                            {child.name ?? child.alias}
                          </Text>
                          {child.name && (
                            <Text style={s.small}>{child.alias}</Text>
                          )}
                        </View>
                        <View style={s.row}>
                          <Star size={20} color={c.orange} />
                          <Text style={s.text}>
                            {t("weeklyReview.stars", {
                              count: child.stars_earned,
                            })}
                          </Text>
                        </View>
                        {child.prova&&child.prova.attempts>0?<View style={{gap:4}}>
                          <Text style={[s.text,s.bold]}>{t("weeklyReview.provaTitle")}</Text>
                          <Text style={s.text}>{t("weeklyReview.provaCounts",{attempts:child.prova.attempts,scored:child.prova.scored,pending:child.prova.pending})}</Text>
                          <Text style={s.small}>{t("weeklyReview.provaSignals",{liked:child.prova.liked,struggled:child.prova.struggled,repeated:child.prova.repeated_observations})}</Text>
                        </View>:null}
                        {child.tasks.length
                          ? child.tasks.map((task) => (
                            <View key={task.status} style={s.row}>
                              {task.status === "approved"
                                ? <Check color={c.green} size={20} />
                                : <Clock3 color={c.purple} size={20} />}
                              <Text style={s.text}>
                                {t("weeklyReview.task." + task.status, {
                                  count: task.count,
                                })}
                              </Text>
                            </View>
                          ))
                          : (
                            <Text style={s.text}>
                              {t("weeklyReview.noRecords")}
                            </Text>
                          )}
                      </View>
                    ))}
                  <Text style={s.small}>{t("weeklyReview.recordedOnly")}</Text>
                  {data.snapshot_at && (
                    <Text style={s.small}>
                      {t("weeklyReview.snapshot", {
                        date: new Intl.DateTimeFormat(i18n.language, {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: data.timezone,
                        }).format(new Date(data.snapshot_at)),
                      })}
                    </Text>
                  )}
                </View>
                <View style={[s.fill, { gap: 16 }]}>
                  <View style={s.row}>
                    <Sparkles color={c.purple} size={24} />
                    <Text accessibilityRole="header" style={s.sectionTitle}>
                      {t("weeklyReview.aiTitle")}
                    </Text>
                  </View>
                  {data.state === "ready" && data.summary
                    ? <Summary data={data} />
                    : (
                      <View style={s.card}>
                        <Text
                          accessibilityLiveRegion="polite"
                          style={[s.text, s.bold]}
                        >
                          {t(
                            "weeklyReview.state." +
                              (busy ? "working" : data.state),
                          )}
                        </Text>
                        {data.can_generate && !busy
                          ? (
                            <>
                              <Text style={s.text}>
                                {t("weeklyReview.privacy")}
                              </Text>
                              <Text style={s.small}>
                                {t("weeklyReview.usage", {
                                  count: data.remaining,
                                })}
                              </Text>
                              <Toggle
                                value={consent}
                                onChange={setConsent}
                                label={t("weeklyReview.consent")}
                              />
                              <SatinButton
                                title={t("weeklyReview.generate")}
                                disabled={!consent}
                                onPress={() => void generate()}
                                icon={<Sparkles size={20} color={c.white} />}
                              />
                            </>
                          )
                          : busy
                          ? <ActivityIndicator color={c.purple} />
                          : data.state === "empty" || data.state === "failed"
                          ? (
                            <Text style={s.text}>
                              {t("weeklyReview.access." + data.access)}
                            </Text>
                          )
                          : null}
                        {!busy && (
                          <SatinButton
                            secondary
                            title={t("weeklyReview.refresh")}
                            busy={report.isFetching}
                            onPress={() => {
                              setMessage("");
                              void report.refetch();
                            }}
                          />
                        )}
                        {message
                          ? (
                            <Text accessibilityRole="alert" style={s.text}>
                              {message}
                            </Text>
                          )
                          : null}
                      </View>
                    )}
                  <Text style={s.small}>{t("weeklyReview.disclaimer")}</Text>
                  {data.state === "ready" && data.summary && (
                    <StepPlanner
                      key={data.week_start}
                      data={data}
                    />
                  )}
                </View>
              </View>
            </>
          )
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}
function Summary({ data }: { data: WeeklyReview }) {
  const { t } = useTranslation();
  if (!data.summary) return null;
  return (
    <View style={{ gap: 20 }}>
      <Text style={s.text}>{data.summary.haftanin_ozeti}</Text>
      {data.summary.cocuk_basina.map((child) => (
        <View key={child.etiket} style={s.card}>
          <Text style={s.sectionTitle}>
            {data.children.find((c) =>
              c.alias === child.etiket
            )?.name ??
              child.etiket}
          </Text>
          {child.basarilar.length > 0 && (
            <>
              <Text style={[s.text, s.bold]}>
                {t("weeklyReview.positives")}
              </Text>
              {child.basarilar.map((line, i) => (
                <Text key={i} style={s.text}>{line}</Text>
              ))}
            </>
          )}
          {child.zorlananlar.length > 0 && (
            <>
              <Text style={[s.text, s.bold]}>{t("weeklyReview.revisit")}</Text>
              {child.zorlananlar.map((line, i) => (
                <Text key={i} style={s.text}>{line}</Text>
              ))}
            </>
          )}
          <View style={[s.summary, { padding: 12 }]}>
            <Text style={[s.text, s.bold]}>{t("weeklyReview.smallStep")}</Text>
            <Text style={s.text}>{child.oneri}</Text>
          </View>
        </View>
      ))}
      {data.summary.veliye_oneriler.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={s.sectionTitle}>{t("weeklyReview.together")}</Text>
          {data.summary.veliye_oneriler.map((line, i) => (
            <Text key={i} style={s.text}>{line}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

type Step = { id: string; who: string; text: string; alias: string | null };
type WeeklyChild = { alias: string; child_id: string; name: string | null };
/** AI önerileri yalnız öneridir: veli seçer, düzenler ve kendisi plana/göreve aktarır. Hiçbir şey otomatik atanmaz. */
function StepPlanner({ data }: { data: WeeklyReview }) {
  const { t, i18n } = useTranslation();
  // C03: the week's alias → today's active child id (archived children are not offered).
  const linked = useQuery({
    queryKey: ["weekly_review_children", data.week_start],
    retry: false,
    queryFn: async () => {
      const { data: rows, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>)(
        "weekly_review_children", { p_week: data.week_start });
      if (error) throw error;
      return Array.isArray(rows) ? (rows as WeeklyChild[]) : [];
    },
  });
  const weekLabel = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(data.week_start + "T12:00:00Z"));
  const toTask = (step: { who: string; text: string; alias: string | null }) => {
    const child = step.alias ? linked.data?.find((x) => x.alias === step.alias) : undefined;
    const token = putTaskPrefill({
      childId: child?.child_id ?? null,
      title: suggestionTaskTitle(step.text),
      suggestion: step.text,
      source: t("c03.weekly.prefilled", { who: step.who, week: weekLabel }) + (child ? "" : " · " + t("c03.weekly.noChild")),
    });
    router.push({ pathname: "/parent/tasks", params: { create: "1", prefill: token, ...(child ? { childId: child.child_id } : {}) } });
  };
  const steps: Step[] = [
    ...(data.summary?.cocuk_basina ?? []).map((child) => ({
      id: "child:" + child.etiket,
      who: data.children.find((x) => x.alias === child.etiket)?.name ??
        child.etiket,
      text: child.oneri,
      alias: child.etiket,
    })),
    ...(data.summary?.veliye_oneriler ?? []).map((line, i) => ({
      id: "family:" + i,
      who: t("weeklyReview.planner.family"),
      text: line,
      alias: null,
    })),
  ];
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const chosen = steps.filter((x) => picked[x.id] !== undefined).map((x) => ({
    ...x,
    text: picked[x.id]!.trim(),
  })).filter((x) => x.text);
  const toggle = (step: Step) => {
    setNotice("");
    setPicked((current) => {
      const next = { ...current };
      if (next[step.id] !== undefined) delete next[step.id];
      else next[step.id] = step.text;
      return next;
    });
  };
  const planText = chosen.map((x) => "• " + x.who + ": " + x.text).join("\n");
  const copy = async () => {
    try {
      if (
        Platform.OS === "web" && typeof navigator !== "undefined" &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(planText);
        setNotice(t("weeklyReview.planner.copied"));
      } else {
        await Share.share({ message: planText });
      }
    } catch {
      setNotice(t("weeklyReview.planner.copyFailed"));
    }
  };
  if (!steps.length) return null;
  return (
    <View testID="weekly-planner" style={[s.card, { gap: 12 }]}>
      <Text accessibilityRole="header" style={s.sectionTitle}>
        {t("weeklyReview.plan")}
      </Text>
      <Text style={s.small}>{t("weeklyReview.planner.help")}</Text>
      {steps.map((step) => {
        const on = picked[step.id] !== undefined;
        return (
          <View key={step.id} style={[s.summary, { gap: 8, padding: 12 }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              accessibilityLabel={step.who + ": " + step.text}
              onPress={() => toggle(step)}
              style={[s.row, { minHeight: 48, alignItems: "flex-start" }]}
            >
              {on
                ? <SquareCheck color={c.purple} size={24} />
                : <Square color={c.purple} size={24} />}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.small, s.bold]}>{step.who}</Text>
                {!on && <Text style={s.text}>{step.text}</Text>}
              </View>
            </Pressable>
            {on && (
              <TextInput
                accessibilityLabel={t("weeklyReview.planner.editLabel", {
                  who: step.who,
                })}
                multiline
                maxLength={700}
                value={picked[step.id]}
                onChangeText={(value) =>
                  setPicked((current) => ({ ...current, [step.id]: value }))}
                style={[s.text, {
                  minHeight: 72,
                  borderWidth: 1,
                  borderColor: c.purple,
                  borderRadius: 14,
                  padding: 10,
                  textAlignVertical: "top",
                  backgroundColor: c.white,
                }]}
              />
            )}
          </View>
        );
      })}
      <Text accessibilityLiveRegion="polite" style={s.small}>
        {chosen.length
          ? t("weeklyReview.planner.selected", { count: chosen.length })
          : t("weeklyReview.planner.none")}
      </Text>
      {chosen.length > 0 && (
        <>
          <SatinButton
            secondary
            title={t("weeklyReview.planner.copy")}
            onPress={() => void copy()}
          />
          {chosen.map((step) => {
            const child = step.alias ? linked.data?.find((x) => x.alias === step.alias) : undefined;
            return (
              <Pressable
                key={"task:" + step.id}
                testID={"weekly-to-task-" + step.id}
                accessibilityRole="button"
                style={s.link}
                onPress={() => toTask(step)}
              >
                <Text style={s.linkText}>{child ? t("c03.weekly.toTaskFor", { name: child.name ?? step.who }) : t("weeklyReview.planner.toTask") + " · " + step.who}</Text>
                <ArrowRight color={c.purple} size={20} />
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            style={s.link}
            onPress={() => router.push("/parent/calendar")}
          >
            <Text style={s.linkText}>{t("weeklyReview.planner.toCalendar")}</Text>
            <ArrowRight color={c.purple} size={20} />
          </Pressable>
        </>
      )}
      {notice
        ? <Text accessibilityLiveRegion="polite" style={s.small}>{notice}</Text>
        : null}
      <Text style={s.small}>{t("weeklyReview.planner.noAuto")}</Text>
    </View>
  );
}
