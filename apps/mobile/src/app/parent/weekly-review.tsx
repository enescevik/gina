import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
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
  Sparkles,
  Star,
} from "lucide-react-native";
import { type WeeklyReview, weeklyReviewSchema } from "@gina/core";
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
                  {data.state === "ready" && (
                    <Pressable
                      accessibilityRole="button"
                      style={s.link}
                      onPress={() => router.push("/parent/calendar")}
                    >
                      <Text style={s.linkText}>{t("weeklyReview.plan")}</Text>
                      <ArrowRight color={c.purple} size={20} />
                    </Pressable>
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
