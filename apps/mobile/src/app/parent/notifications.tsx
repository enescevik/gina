import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Linking, Platform, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, parentStyles } from "@/components/ui/parent-screen";
import { Toggle } from "@/components/ui/toggle";
import { getPushPermission, requestPushPermission } from "@/lib/push";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type PrefKey = "approvals" | "exams" | "weekly_summary";
const PREF_KEYS: PrefKey[] = ["approvals", "exams", "weekly_summary"];

/** Veli bildirim tercihleri (push_preferences; satır yoksa hepsi açık) ve cihaz izni. */
export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const { session, claims } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const familyId = claims?.family_id;

  const permission = useQuery({
    queryKey: ["push-permission"],
    queryFn: getPushPermission,
  });

  const prefs = useQuery({
    queryKey: ["push-preferences", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_preferences")
        .select("approvals, exams, weekly_summary")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { approvals: true, exams: true, weekly_summary: true };
    },
  });

  const save = useMutation({
    mutationFn: async ({ key, value }: { key: PrefKey; value: boolean }) => {
      if (!userId || !familyId) throw new Error("no_session");
      const current = prefs.data ?? { approvals: true, exams: true, weekly_summary: true };
      const { error } = await supabase
        .from("push_preferences")
        .upsert({ ...current, [key]: value, user_id: userId, family_id: familyId }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["push-preferences", userId] }),
  });

  const allow = useMutation({
    mutationFn: () => requestPushPermission(i18n.language, t("push.channelName")),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["push-permission"] }),
  });

  const settings = useMutation({ mutationFn: () => Linking.openSettings() });

  return (
    <Screen title={t("push.title")} subtitle={t("accountV5.notificationsBody")} loading={prefs.isLoading || permission.isLoading} error={prefs.error ?? permission.error} onRetry={() => { void prefs.refetch(); void permission.refetch(); }}>
      {Platform.OS === "web" || permission.data === "unsupported" ? (
        <Text className="font-body text-sm text-gray-600">{t("push.webNote")}</Text>
      ) : permission.data === "undetermined" ? (
        <View className="gap-2 rounded-parent bg-teal-light p-3">
          <Text className="font-body text-sm text-ink">{t("push.permissionAsk")}</Text>
          <Button title={t("push.allow")} loading={allow.isPending} onPress={() => allow.mutate()} />
        </View>
      ) : permission.data === "denied" ? (
        <View className="gap-2 rounded-parent bg-coral-light p-3">
          <Text className="font-body text-sm text-ink">{t("push.permissionDenied")}</Text>
          <Button variant="secondary" title={t("push.openSettings")} loading={settings.isPending} onPress={() => settings.mutate()} />
        </View>
      ) : null}

      {PREF_KEYS.map((key) => (
        <View key={key} style={parentStyles.card}>
          <Toggle label={t(`push.pref.${key}`)} value={prefs.data?.[key] ?? false} disabled={!prefs.data || save.isPending} onChange={value => save.mutate({ key, value })} />
          <Text style={parentStyles.muted}>{t(`push.pref.${key}Hint`)}</Text>
        </View>
      ))}

      <Text className="font-body text-xs text-gray-600">{t("push.privacyNote")}</Text>
      <ErrorText error={save.error ?? allow.error ?? settings.error} />
    </Screen>
  );
}
