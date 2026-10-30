import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Text, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { supabase } from "@/lib/supabase";

/** get_shared_child_view RPC'sinin döndürdüğü asgari görünüm (kapsam dışı alanlar hiç gelmez). */
interface SharedView {
  child: { first_name: string; grade: number | null };
  label: string;
  scopes: string[];
  expires_at: string;
  generated_at: string;
  grades?: { subject: string; score: number; max_score: number; date: string }[];
  prova?: {
    title: string;
    subject: string;
    date: string;
    mc_correct: number | null;
    mc_total: number | null;
    topics: { topic: string; correct: number; total: number }[];
  }[];
  tasks_summary?: { days: number; completed: number; approved: number; returned: number };
}

/** Webde arama motorlarına kapalı: expo-router Head + yedek olarak doğrudan meta etiketi. */
function useNoIndex() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    const previous = meta.content;
    meta.content = "noindex, nofollow, noarchive";
    return () => {
      if (created) meta?.remove();
      else if (meta) meta.content = previous;
    };
  }, []);
}

/**
 * Öğretmen görünümü: oturum gerektirmez (anon istemci), salt okunur.
 * Geçersiz, süresi dolmuş ve iptal edilmiş bağlantılar aynı mesajı gösterir.
 */
export default function SharedChildViewScreen() {
  const { t, i18n } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  useNoIndex();

  const view = useQuery({
    queryKey: ["shared_child_view", token],
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_shared_child_view", { p_token: token ?? "" });
      if (error) throw error;
      return data as unknown as SharedView;
    },
  });

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const numberFormat = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const formatDay = (day: string) => dateFormat.format(new Date(`${day}T00:00:00Z`));
  const data = view.data;

  return (
    <Screen>
      <Head>
        <title>{t("share.viewer.pageTitle")}</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="referrer" content="no-referrer" />
      </Head>

      {view.isLoading ? <ActivityIndicator /> : null}

      {view.isError || (!view.isLoading && !data) ? (
        <View className="gap-2 rounded-parent border border-mist p-4">
          <Text className="text-lg font-body-bold text-ink dark:text-night-text">{t("share.viewer.invalidTitle")}</Text>
          <Text className="font-body text-sm text-gray-500">{t("share.viewer.invalidBody")}</Text>
        </View>
      ) : null}

      {data ? (
        <>
          <View className="gap-1">
            <Text className="text-2xl font-body-bold text-ink dark:text-night-text">
              {data.child.grade != null
                ? t("share.viewer.headingWithGrade", { name: data.child.first_name, grade: data.child.grade })
                : data.child.first_name}
            </Text>
            <Text className="font-body text-sm text-gray-500">
              {t("share.viewer.sharedWith", { label: data.label })} · {t("share.expiresOn", { date: dateFormat.format(new Date(data.expires_at)) })}
            </Text>
          </View>

          {data.grades ? (
            <View className="gap-2">
              <Text className="text-lg font-body-bold text-ink dark:text-night-text">{t("share.scope.grades")}</Text>
              {data.grades.length === 0 ? <Text className="font-body text-gray-500">{t("share.viewer.empty")}</Text> : null}
              {data.grades.map((grade, index) => (
                <View key={`${grade.subject}-${grade.date}-${index}`} className="flex-row items-center gap-3 rounded-parent border border-mist p-3">
                  <View className="flex-1">
                    <Text className="text-base font-body-bold text-ink dark:text-night-text">{grade.subject}</Text>
                    <Text className="font-body text-xs text-gray-500">{formatDay(grade.date)}</Text>
                  </View>
                  <Text className="text-xl font-body-bold text-ink dark:text-night-text">
                    {numberFormat.format(Number(grade.score))}
                    <Text className="text-sm font-body text-gray-500"> / {numberFormat.format(Number(grade.max_score))}</Text>
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {data.prova ? (
            <View className="gap-2">
              <Text className="text-lg font-body-bold text-ink dark:text-night-text">{t("share.scope.prova")}</Text>
              {data.prova.length === 0 ? <Text className="font-body text-gray-500">{t("share.viewer.empty")}</Text> : null}
              {data.prova.map((exam, index) => (
                <View key={`${exam.title}-${exam.date}-${index}`} className="gap-2 rounded-parent border border-mist p-3">
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-body-bold text-ink dark:text-night-text">{exam.title}</Text>
                      <Text className="font-body text-xs text-gray-500">
                        {exam.subject} · {formatDay(exam.date)}
                      </Text>
                    </View>
                    {exam.mc_total ? (
                      <Text className="text-xl font-body-bold text-ink dark:text-night-text">
                        {exam.mc_correct ?? 0}
                        <Text className="text-sm font-body text-gray-500"> / {exam.mc_total}</Text>
                      </Text>
                    ) : null}
                  </View>
                  {exam.topics.map((topic) => (
                    <View key={topic.topic} className="flex-row items-center gap-2">
                      <Text className="font-body flex-1 text-sm text-ink dark:text-night-text">{topic.topic}</Text>
                      <View className="h-2 w-24 overflow-hidden rounded-full bg-mist">
                        <View className="h-2 rounded-full bg-teal" style={{ width: `${topic.total ? (topic.correct / topic.total) * 100 : 0}%` }} />
                      </View>
                      <Text className="font-body w-12 text-right text-sm text-gray-500">
                        {topic.correct}/{topic.total}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : null}

          {data.tasks_summary ? (
            <View className="gap-2">
              <Text className="text-lg font-body-bold text-ink dark:text-night-text">{t("share.scope.tasks_summary")}</Text>
              <Text className="font-body text-xs text-gray-500">{t("share.viewer.lastDays", { count: data.tasks_summary.days })}</Text>
              <View className="flex-row gap-2">
                {(
                  [
                    ["completed", data.tasks_summary.completed],
                    ["approved", data.tasks_summary.approved],
                    ["returned", data.tasks_summary.returned],
                  ] as const
                ).map(([key, value]) => (
                  <View key={key} className="flex-1 items-center rounded-parent bg-teal-light p-3">
                    <Text className="text-2xl font-body-bold text-ink">{value}</Text>
                    <Text className="font-body text-xs text-ink">{t(`share.viewer.tasks.${key}`)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      <View className="mt-6 items-center gap-1 border-t border-mist pt-4">
        <Text className="text-sm font-body-bold text-teal-dark">{t("share.viewer.footer")}</Text>
        <Text className="font-body text-center text-xs text-gray-500">{t("share.viewer.footerNote")}</Text>
      </View>
    </Screen>
  );
}
