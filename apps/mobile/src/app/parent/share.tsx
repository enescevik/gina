import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, Share, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, ChildPicker, parentStyles } from "@/components/ui/parent-screen";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { supabase } from "@/lib/supabase";

type ShareScope = "grades" | "prova" | "tasks_summary";
const SCOPES: ShareScope[] = ["grades", "prova", "tasks_summary"];
const EXPIRY_DAYS = [7, 30, 90, 180] as const;

/** Paylaşım bağlantısının kökü: EXPO_PUBLIC_WEB_URL, yoksa webde bulunulan origin. */
function shareBaseUrl(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, "");
  if (fromEnv) { try { const url = new URL(fromEnv); if (url.protocol === "https:") return url.origin; } catch { /* invalid deployment configuration */ } }
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return null;
}

/** RPC hata kodunu (ör. 'invalid_scopes') çeviri anahtarına eşler; bilinmeyeni olduğu gibi gösterir. */
function errorMessage(t: (key: string) => string, error: unknown): string | null {
  if (!error) return null;
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error);
  const known = ["invalid_label", "invalid_scopes", "invalid_expiry", "too_many_shares", "child_not_found", "share_not_found", "share_failed"];
  return known.includes(message) ? t(`share.error.${message}`) : t("release.genericError");
}

/**
 * Veli: çocuk başına öğretmenle salt okunur paylaşım bağlantıları.
 * Bağlantı bir kez gösterilir (sunucu yalnız özetini saklar); iptal anında etkilidir.
 */
export default function ParentShareScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [childId, setChildId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<ShareScope[]>(["grades"]);
  const [days, setDays] = useState<number>(30);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const baseUrl = shareBaseUrl();

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name, grade, avatar").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const selectedChild = childId ?? children.data?.[0]?.id ?? null;

  const shares = useQuery({
    queryKey: ["child_shares", selectedChild],
    enabled: !!selectedChild,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("child_shares")
        .select("id, label, scopes, created_at, expires_at, revoked_at, last_viewed_at, view_count")
        .eq("child_id", selectedChild ?? "")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const createShare = useMutation({
    mutationFn: async () => {
      if (!baseUrl) throw new Error(t("share.noWebUrl"));
      if (!selectedChild) throw new Error("child_not_found");
      const { data, error } = await supabase.rpc("create_child_share", {
        p_child_id: selectedChild,
        p_label: label.trim(),
        p_scopes: scopes,
        p_expires_in_days: days,
      });
      if (error) throw error;
      const token = data?.[0]?.token;
      if (!token) throw new Error("share_failed");
      return token;
    },
    onSuccess: (token) => {
      const base = shareBaseUrl();
      setCreatedLink(base ? `${base}/s/${token}` : null);
      setCopied(false);
      setLabel("");
      void queryClient.invalidateQueries({ queryKey: ["child_shares", selectedChild] });
    },
  });

  const revokeShare = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_child_share", { p_share_id: id });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["child_shares", selectedChild] }),
  });

  const toggleScope = (scope: ShareScope) =>
    setScopes((current) => (current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]));

  const copyLink = async () => {
    if (!createdLink) return;
    setActionError(null);
    try {
    // Webde panoya kopyalanır; mobilde sistem paylaşım sayfası açılır (ek paket gerekmez).
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(createdLink);
      setCopied(true);
      return;
    }
    await Share.share({ message: createdLink });
    } catch (e) { setActionError(e); }
  };

  const shareLink = async () => {
    if (!createdLink) return;
    try {
      await Share.share({ message: t("share.shareMessage", { url: createdLink }), url: createdLink });
    } catch (e) { setActionError(e); }
  };

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", year: "numeric" });
  // Süre kontrolü listenin çekildiği ana göre (render saf kalsın).
  const now = shares.dataUpdatedAt;

  return (
    <Screen title={t("share.title")} subtitle={t("share.intro")} loading={children.isLoading || (!!selectedChild && shares.isLoading)} error={children.error ?? shares.error} onRetry={() => { void children.refetch(); if (selectedChild) void shares.refetch(); }}>
      <ChildPicker profiles={children.data ?? []} selected={selectedChild} onSelect={id => { if (!createShare.isPending) { setChildId(id); setCreatedLink(null); setActionError(null); } }} />
      {!baseUrl ? <Text style={parentStyles.copy}>{t("share.noWebUrl")}</Text> : null}
      {createdLink ? (
        <View className="gap-3 rounded-parent border border-teal bg-teal-light p-4">
          <Text className="text-lg font-body-bold text-ink">{t("share.linkReady")}</Text>
          <Text className="font-body text-sm text-ink">{t("share.linkOnce")}</Text>
          <Text selectable style={parentStyles.copy}>
            {createdLink}
          </Text>
          {shareBaseUrl() ? null : <Text className="font-body text-xs text-danger">{t("share.noWebUrl")}</Text>}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button title={copied ? t("share.copied") : t("share.copy")} onPress={() => void copyLink()} />
            </View>
            <View className="flex-1">
              <Button variant="secondary" title={t("share.share")} onPress={() => void shareLink()} />
            </View>
          </View>
          <Button variant="ghost" title={t("share.done")} onPress={() => setCreatedLink(null)} />
        </View>
      ) : null}

      {shares.data?.length === 0 ? <Text className="font-body text-gray-500">{t("share.none")}</Text> : null}
      {shares.data?.map((share) => {
        const expired = new Date(share.expires_at).getTime() <= now;
        const status = share.revoked_at ? t("share.status.revoked") : expired ? t("share.status.expired") : t("share.status.active");
        const active = !share.revoked_at && !expired;
        return (
          <View key={share.id} style={[parentStyles.card, { opacity: active ? 1 : .7 }]}>
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base font-body-bold text-ink">{share.label}</Text>
              <Text className={`text-xs font-body-bold ${active ? "text-teal-dark" : "text-gray-500"}`}>{status}</Text>
            </View>
            <Text className="font-body text-xs text-gray-500">{share.scopes.map((s) => t(`share.scope.${s}`)).join(" · ")}</Text>
            <Text className="font-body text-xs text-gray-500">
              {t("share.expiresOn", { date: dateFormat.format(new Date(share.expires_at)) })} · {t("share.views", { count: share.view_count })}
              {share.last_viewed_at ? ` · ${t("share.lastViewed", { date: dateFormat.format(new Date(share.last_viewed_at)) })}` : ""}
            </Text>
            {active ? (
              <ConfirmAction title={t("share.revoke")} busy={revokeShare.isPending} onConfirm={() => revokeShare.mutate(share.id)} />
            ) : null}
          </View>
        );
      })}
      {revokeShare.error ? <Text className="font-body text-sm text-danger">{errorMessage(t, revokeShare.error)}</Text> : null}

      {selectedChild ? (
        <View style={parentStyles.form}>
          <Text className="text-lg font-body-bold text-ink">{t("share.new")}</Text>
          <Field label={t("share.label")} editable={!createShare.isPending} value={label} onChangeText={setLabel} placeholder={t("share.labelPlaceholder")} maxLength={80} />
          <Text className="text-sm font-body text-ink">{t("share.scopes")}</Text>
          <View className="flex-row flex-wrap gap-2">
            {SCOPES.map((scope) => (
              <Pressable
                key={scope}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: scopes.includes(scope) }}
                onPress={() => toggleScope(scope)}
                style={{ minHeight: 48, justifyContent: "center" }} disabled={createShare.isPending}
                className={`rounded-full px-3 py-2 ${scopes.includes(scope) ? "bg-teal" : "bg-white"}`}
              >
                <Text className={scopes.includes(scope) ? "font-body-bold text-white" : "text-ink"}>{t(`share.scope.${scope}`)}</Text>
              </Pressable>
            ))}
          </View>
          <Text className="font-body text-xs text-gray-500">{t("share.neverShared")}</Text>
          <Text className="text-sm font-body text-ink">{t("share.expiry")}</Text>
          <View className="flex-row flex-wrap gap-2">
            {EXPIRY_DAYS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: days === option }} aria-pressed={days === option} onPress={() => setDays(option)}
                style={{ minHeight: 48, justifyContent: "center" }} disabled={createShare.isPending}
                className={`rounded-full px-3 py-2 ${days === option ? "bg-teal" : "bg-white"}`}
              >
                <Text className={days === option ? "font-body-bold text-white" : "text-ink"}>{t("share.days", { count: option })}</Text>
              </Pressable>
            ))}
          </View>
          {createShare.error ? <Text className="font-body text-sm text-danger">{errorMessage(t, createShare.error)}</Text> : null}
          <Button
            title={t("share.create")}
            loading={createShare.isPending}
            disabled={!baseUrl || !label.trim() || scopes.length === 0 || createShare.isPending}
            onPress={() => createShare.mutate()}
          />
        </View>
      ) : (
        <Text className="font-body text-gray-500">{t("tasks.addChildFirst")}</Text>
      )}

      <ErrorText error={actionError} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
