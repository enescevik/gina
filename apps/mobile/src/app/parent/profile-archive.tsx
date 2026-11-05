import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useTranslation } from "react-i18next";
import { Text, View, useWindowDimensions } from "react-native";
import {
  Archive,
  RotateCcw,
  GraduationCap,
  ChartNoAxesCombined,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { Avatar } from "@/components/avatar";
import {
  ParentScreen,
  EmptyCard,
  NavigationCard,
} from "@/components/ui/parent-screen";
import { DecisionSheet } from "@/components/ui/decision-sheet";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { p, u, SatinButton } from "@/components/planner/ui";

type Preview = {
  id: string;
  name: string;
  avatar: string | null;
  grade: number | null;
  archived_at: string | null;
  revision: number;
  routines: number;
  devices: number;
  links: number;
  pending_tasks: number;
  active_attempts: number;
  exams: number;
  stars: number;
  badges: number;
};
export default function ProfileArchiveScreen() {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 700 && fontScale < 1.4;
  const { claims } = useSession();
  const family = claims?.family_id ?? "";
  const cache = useQueryClient();
  const params = useLocalSearchParams<{ childId?: string }>();
  const [selected, setSelected] = useState<string | null>(
    params.childId ?? null,
  );
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [feedback, setFeedback] = useState("");
  const [restored, setRestored] = useState<string | null>(null);
  const request = useRef({ key: "", id: "" });
  const sending = useRef(false);
  const children = useQuery({
    queryKey: ["children_archive", family],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id,name,avatar,grade,archived_at")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const preview = useQuery({
    queryKey: ["archive_preview", family, selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_child_archive_preview", {
        p_child_id: selected!,
      });
      if (error) throw error;
      return data as unknown as Preview;
    },
  });
  useRealtimeInvalidate("children", family ? `family_id=eq.${family}` : null, [
    ["children_archive", family],
    ["archive_preview", family, selected],
  ]);
  const save = useMutation({
    mutationFn: async (value: Preview) => {
      const archived = !value.archived_at;
      const key = `${value.id}:${value.revision}:${archived}`;
      if (request.current.key !== key)
        request.current = { key, id: randomUUID() };
      const { error } = await supabase.rpc("set_child_archived", {
        p_request_id: request.current.id,
        p_child_id: value.id,
        p_revision: value.revision,
        p_archived: archived,
      });
      if (error) throw error;
      return archived;
    },
    onSuccess: async (archived, value) => {
      setSelected(null);
      setRestored(archived ? null : value.id);
      setTab(archived ? "archived" : "active");
      setFeedback(
        t(archived ? "childArchive.savedArchive" : "childArchive.savedRestore"),
      );
      await cache.invalidateQueries();
    },
    onSettled: () => {
      sending.current = false;
    },
  });
  const displayed =
    children.data?.filter((c) =>
      tab === "archived" ? !!c.archived_at : !c.archived_at,
    ) ?? [];
  const value = preview.data;
  return (
    <ParentScreen
      title={t("childArchive.title")}
      subtitle={t("childArchive.body")}
      loading={children.isLoading}
      error={children.error}
      onRetry={() => void children.refetch()}
    >
      <View style={[u.row, { flexWrap: "wrap" }]}>
        {(["active", "archived"] as const).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={{
              padding: 16,
              minHeight: 48,
              borderRadius: 18,
              backgroundColor: tab === key ? p.purple : p.lilac,
            }}
          >
            <Text style={[u.bold, { color: tab === key ? "#fff" : p.ink }]}>
              {t(
                key === "active"
                  ? "childArchive.active"
                  : "childArchive.archivedProfiles",
              )}
            </Text>
          </Pressable>
        ))}
      </View>
      {!!feedback && (
        <Text accessibilityLiveRegion="polite" style={u.bold}>
          {feedback}
        </Text>
      )}
      {displayed.map((child) => (
        <View key={child.id} style={u.card}>
          <View style={u.row}>
            <Avatar slug={child.avatar} size={64} />
            <View style={u.fill}>
              <Text style={u.heading}>{child.name}</Text>
              <Text style={u.small}>
                {child.archived_at
                  ? t("childArchive.archived")
                  : child.grade === null
                    ? t("education.gradeUnknown")
                    : child.grade === 0
                      ? t("betaUx.preschool")
                      : t("parent.gradeShort", { grade: child.grade })}
              </Text>
            </View>
            {child.archived_at ? <Archive color={p.muted} /> : null}
          </View>
          <View
            style={
              wide ? { alignSelf: "flex-start", minWidth: 220 } : undefined
            }
          >
            <SatinButton
              secondary
              icon={
                child.archived_at ? (
                  <RotateCcw color={p.purple} />
                ) : (
                  <Archive color={p.purple} />
                )
              }
              title={t(
                child.archived_at
                  ? "childArchive.restore"
                  : "childArchive.archive",
              )}
              onPress={() => {
                save.reset();
                setSelected(child.id);
              }}
            />
          </View>
          {child.archived_at && (
            <>
              <Text style={u.small}>{t("childArchive.historyBody")}</Text>
              <View style={{ flexDirection: wide ? "row" : "column", gap: 12 }}>
                <View style={wide ? { flex: 1 } : undefined}>
                  <NavigationCard
                    title={t("education.title")}
                    icon={<GraduationCap color={p.purple} />}
                    onPress={() =>
                      router.push({
                        pathname: "/parent/education",
                        params: { childId: child.id },
                      })
                    }
                  />
                </View>
                <View style={wide ? { flex: 1 } : undefined}>
                  <NavigationCard
                    icon={<ChartNoAxesCombined color={p.purple} />}
                    title={t("learningProgress.title")}
                    onPress={() =>
                      router.push({
                        pathname: "/parent/prova/progress",
                        params: { childId: child.id },
                      })
                    }
                  />
                </View>
              </View>
            </>
          )}
        </View>
      ))}
      {tab === "archived" && !displayed.length && (
        <EmptyCard title={t("childArchive.empty")} />
      )}
      {tab === "active" && !displayed.length && (
        <EmptyCard
          title={t("childArchive.noActive")}
          body={t("childArchive.noActiveBody")}
        />
      )}
      {!!feedback && restored && tab === "active" && (
        <>
          <NavigationCard
            title={t("childArchive.manageDevices")}
            onPress={() => router.push("/parent/menu?section=devices")}
          />
          <NavigationCard
            title={t("childArchive.manageRoutines")}
            onPress={() => router.push({pathname:"/parent/tasks",params:{childId:restored!,paused:"1"}})}
          />
        </>
      )}
      <DecisionSheet
        visible={!!selected}
        title={
          value
            ? t(
                value.archived_at
                  ? "childArchive.confirmRestore"
                  : "childArchive.confirmArchive",
                { name: value.name },
              )
            : t("childArchive.title")
        }
        onClose={() => {
          if (!save.isPending) setSelected(null);
        }}
        footer={
          <View style={{ gap: 8 }}>
            <Button
              title={t(
                value?.archived_at
                  ? "childArchive.restore"
                  : "childArchive.archive",
              )}
              loading={save.isPending}
              disabled={!value || preview.isFetching || !!preview.error}
              onPress={() => {
                if (!value || sending.current) return;
                sending.current = true;
                save.mutate(value);
              }}
            />
            <Button
              variant="ghost"
              title={t("common.cancel")}
              disabled={save.isPending}
              onPress={() => setSelected(null)}
            />
          </View>
        }
      >
        {preview.isLoading && <Text style={u.copy}>{t("common.loading")}</Text>}
        {value && (
          <>
            <Text style={u.copy}>
              {t(
                value.archived_at
                  ? "childArchive.restoreBody"
                  : "childArchive.archiveBody",
              )}
            </Text>
            {!value.archived_at && (
              <View style={[u.card, { backgroundColor: p.lilac }]}>
                <Text style={u.copy}>
                  {t("childArchive.routines", { count: value.routines })}
                </Text>
                <Text style={u.copy}>
                  {t("childArchive.devices", { count: value.devices })}
                </Text>
                <Text style={u.copy}>
                  {t("childArchive.links", { count: value.links })}
                </Text>
              </View>
            )}
            <View style={[u.card, { backgroundColor: p.mint }]}>
              <Text style={u.bold}>{t("childArchive.history")}</Text>
              <Text style={u.copy}>{t("childArchive.summary", value)}</Text>
            </View>
            {(value.pending_tasks > 0 || value.active_attempts > 0) && (
              <Text style={u.copy}>
                {t("childArchive.pending", {
                  tasks: value.pending_tasks,
                  attempts: value.active_attempts,
                })}
              </Text>
            )}
            <Text style={u.small}>{t("childArchive.aiNotice")}</Text>
          </>
        )}
        {(save.error || preview.error) && (
          <>
            <Text accessibilityRole="alert" style={u.error}>
              {t(
                save.error?.message.includes("archive_changed")
                  ? "childArchive.changed"
                  : "childArchive.error",
              )}
            </Text>
            <Button
              variant="secondary"
              title={t("childArchive.reload")}
              onPress={() => {
                save.reset();
                void preview.refetch();
              }}
            />
          </>
        )}
      </DecisionSheet>
    </ParentScreen>
  );
}
