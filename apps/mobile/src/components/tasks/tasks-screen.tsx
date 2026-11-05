import { useSetupSources, SetupSourceLinks, SourceLoadError } from "@/components/setup/source-links";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  GraduationCap,
  Heart,
  House,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
} from "lucide-react-native";
import { Avatar } from "@/components/avatar";
import { Pressable } from "@/components/ui/pressable";
import { CountBadge, IconButton, SatinButton, Tag, p, u } from "@/components/planner/ui";
import type { PlannerChild } from "@/components/planner/timetable-editor";
import { useSession } from "@/lib/session";
import { useFamilyTimezone } from "@/lib/family";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { TaskForm } from "./task-form";
import { TaskTile, StarReward } from "./task-visuals";
export function TasksScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const timeZone = useFamilyTimezone();
  const cache = useQueryClient();
  const params = useLocalSearchParams<{ childId?: string; create?: string; taskId?: string }>();
  const [childId, setChildId] = useState<string | null>(params.childId ?? null);
  const [initialCreate, setInitialCreate] = useState(params.create === "1");
  const [paused, setPaused] = useState(false);
  const [creating, setCreating] = useState<PlannerChild | null>(null);
  const [notice, setNotice] = useState("");
  const children = useQuery({
    queryKey: ["children"],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id,name,grade,avatar").is("archived_at", null)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const selected =
    children.data?.find((c) => c.id === childId) ?? children.data?.[0];
  // Parent rows include paused tasks. Keep this cache separate from the child's active-only queries.
  const templates = useQuery({
    queryKey: ["parent_task_templates", familyId, selected?.id],
    enabled: !!selected && !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("id,title,icon,stars,days_of_week,active")
        .eq("child_id", selected!.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  useRealtimeInvalidate(
    "task_templates",
    familyId ? `family_id=eq.${familyId}` : null,
    [
      ["parent_task_templates", familyId],
      ["family_task_templates", familyId],
    ],
  );
  const toggle = useMutation({
    mutationFn: async ({
      id,
      active,
      owner,
    }: {
      id: string;
      active: boolean;
      owner: string;
    }) => {
      const { error } = await supabase
        .from("task_templates")
        .update({ active })
        .eq("id", id)
        .eq("child_id", owner)
        .eq("family_id", familyId)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: async (_, v) => {
      await Promise.all([
        cache.invalidateQueries({
          queryKey: ["parent_task_templates", familyId, v.owner],
        }),
        cache.invalidateQueries({ queryKey: ["task_templates", v.owner] }),
        cache.invalidateQueries({
          queryKey: ["family_task_templates", familyId],
        }),
      ]);
      setNotice(t(v.active ? "taskPremium.resumed" : "taskPremium.paused"));
    },
  });
  const rows = templates.data ?? [];
  const visible = rows.filter((r) => r.active !== paused);
  const busy = children.isLoading || (!!selected && templates.isLoading);
  const failed = children.error || templates.error;
  const daysText = (days: number[]) =>
    days.length === 7
      ? t("redesign.everyDay")
      : days.map((d) => t(`weekday.${d}`)).join(" · ");
  const nav = [
    { title: t("calendar.today"), Icon: House, path: "/parent" as const },
    {
      title: t("parent.calendar"),
      Icon: CalendarDays,
      path: "/parent/calendar" as const,
    },
    {
      title: t("prova.title"),
      Icon: GraduationCap,
      path: "/parent/prova" as const,
    },
    {
      title: t("planner.more"),
      Icon: MoreHorizontal,
      path: "/parent/menu" as const,
    },
  ];
  const sources = useSetupSources("task", (templates.data ?? []).map(item=>item.id));
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={u.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          u.content,
          { maxWidth: 1060, gap: 10, paddingTop: 4 },
        ]}
      >
        <View style={u.topbar}>
          <Image
            source={require("../../../../../packages/assets/brand/growing-friend/logo.png")}
            style={u.logo}
            accessibilityLabel="Gina"
            resizeMode="contain"
          />
          <IconButton
            label={t("push.menu")}
            onPress={() => router.push("/parent/notifications")}
          >
            <Bell color={p.purple} size={22} />
          </IconButton>
        </View>
        <View
          style={
            wide
              ? { flexDirection: "row", alignItems: "center", gap: 36 }
              : { gap: 14 }
          }
        >
          <View style={wide ? { flex: 1 } : undefined}>
            <View style={[u.hero, { minHeight: 112 }]}>
              <View style={u.fill}>
                <View style={u.row}>
                  <IconButton
                    label={t("common.back")}
                    onPress={() =>
                      router.canGoBack()
                        ? router.back()
                        : router.replace("/parent")
                    }
                  >
                    <ArrowLeft color={p.purple} />
                  </IconButton>
                  <Text accessibilityRole="header" style={u.title}>
                    {t("parent.tasks")}
                  </Text>
                </View>
                <Text style={[u.copy, { marginTop: 8 }]}>
                  {t("taskPremium.subtitle")}
                </Text>
              </View>
              <View accessible={false} pointerEvents="none" style={u.heroArt}>
                <View style={u.blob} />
                <Image
                  source={require("../../../../../packages/assets/brand/growing-friend/contextual/planner.png")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
          {(children.data?.length ?? 0) > 1 && <View style={wide ? { width: 340 } : {}}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={u.row}>
                {children.data?.map((c) => (
                  <Tag
                    key={c.id}
                    label={c.name}
                    selected={c.id === selected?.id}
                    onPress={() => {
                      setChildId(c.id);
                      setNotice("");
                      toggle.reset();
                    }}
                  >
                    <Avatar slug={c.avatar} size={30} />
                  </Tag>
                ))}
              </View>
            </ScrollView>
          </View>}
        </View>
        {busy ? (
          <ActivityIndicator
            accessibilityLabel={t("taskPremium.loading")}
            color={p.purple}
          />
        ) : null}
        {failed ? (
          <View style={u.card}>
            <Text accessibilityRole="alert" style={u.error}>
              {t("taskPremium.loadError")}
            </Text>
            <SatinButton
              title={t("common.retry")}
              onPress={() => {
                void children.refetch();
                if (selected) void templates.refetch();
              }}
            />
          </View>
        ) : null}
        {!children.isLoading && !children.error && !selected ? (
          <View style={u.card}>
            <Text style={u.heading}>{t("release.firstChildTitle")}</Text>
            <Text style={u.copy}>{t("release.firstChildBody")}</Text>
            <SatinButton
              title={t("release.firstChildAction")}
              onPress={() => router.push("/parent/menu")}
            />
          </View>
        ) : null}
        {selected && !failed ? (
          <>
            <View style={[u.segment, { maxWidth: 560 }]}>
              {[false, true].map((value) => (
                <View key={String(value)} style={u.fill}>
                  {paused === value ? (
                    <SatinButton
                      title={t(value ? "taskPremium.pausedLabel" : "taskPremium.activeLabel")}
                      badge={rows.filter((r) => r.active !== value).length}
                      onPress={() => {}}
                      selected
                      style={{ minHeight: 48, paddingHorizontal: 12 }}
                    />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: false }}
                      onPress={() => {
                        setPaused(value);
                        setNotice("");
                      }}
                      style={{
                        minHeight: 54,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 10,
                        flexDirection: "row",
                        gap: 8,
                      }}
                    >
                      <Text style={u.bold}>
                        {t(value ? "taskPremium.pausedLabel" : "taskPremium.activeLabel")}
                      </Text>
                      <CountBadge count={rows.filter((r) => r.active !== value).length} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
            {notice ? (
              <Text accessibilityLiveRegion="polite" style={u.small}>
                {notice}
              </Text>
            ) : null}
            {toggle.error ? (
              <Text accessibilityRole="alert" style={u.error}>
                {t("taskPremium.toggleError")}
              </Text>
            ) : null}
            <SourceLoadError error={sources.error} retry={()=>void sources.refetch()}/>
            {!busy && visible.length === 0 ? (
              <View style={u.card}>
                <Text style={u.heading}>
                  {t(paused ? "taskPremium.noPaused" : "tasks.none")}
                </Text>
                <Text style={u.copy}>
                  {t(
                    paused ? "taskPremium.noPausedBody" : "parentV5.firstTask",
                  )}
                </Text>
              </View>
            ) : null}
            <View
              style={{
                flexDirection: wide ? "row" : "column",
                flexWrap: "wrap",
                gap: 14,
              }}
            >
              {visible.map((task) => (
                <View
                  key={task.id}
                  style={[
                    u.card,
                    params.taskId === task.id && { borderColor: p.purple, borderWidth: 2 },
                    {
                      width: wide ? "48.5%" : "100%",
                      padding: 14,
                      borderRadius: 24,
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: 12,
                    },
                  ]}
                >
                  <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
                  <TaskTile slug={task.icon} size={wide ? 72 : 64} />
                  <View style={[u.fill, { gap: 5 }]}>
                    <Text style={u.bold}>{task.title}</Text>
                    <Text style={u.small}>
                      {daysText(task.days_of_week)} ·{" "}
                      {t("room.starCount", { count: task.stars })}
                    </Text>
                    <StarReward count={task.stars} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      task.active
                        ? "taskPremium.pauseNamed"
                        : "taskPremium.resumeNamed",
                      { title: task.title },
                    )}
                    accessibilityState={{
                      disabled: toggle.isPending,
                      busy:
                        toggle.isPending && toggle.variables?.id === task.id,
                    }}
                    disabled={toggle.isPending}
                    onPress={() => {
                      setNotice("");
                      toggle.mutate({
                        id: task.id,
                        active: !task.active,
                        owner: selected.id,
                      });
                    }}
                    style={({ pressed }) => ({
                      minHeight: 48,
                      minWidth: 76,
                      paddingHorizontal: 10,
                      borderRadius: 24,
                      backgroundColor: p.lilac,
                      opacity: pressed ? 0.65 : 1,
                      flexDirection: "row",
                      gap: 5,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    {toggle.isPending && toggle.variables?.id === task.id ? (
                      <ActivityIndicator size="small" color={p.purple} />
                    ) : task.active ? (
                      <Pause size={15} color={p.purple} />
                    ) : (
                      <Play size={15} color={p.purple} />
                    )}
                    <Text style={[u.bold, { fontSize: 13, color: p.purple }]}>
                      {t(
                        task.active
                          ? "taskPremium.pause"
                          : "taskPremium.resume",
                      )}
                    </Text>
                  </Pressable>
                  </View>
                  <SetupSourceLinks sources={(sources.data??[]).filter(s=>s.item_id===task.id)}/>
                </View>
              ))}
            </View>
            <View
              style={[
                u.row,
                {
                  padding: 16,
                  borderRadius: 22,
                  backgroundColor: "#F0EBFA",
                  justifyContent: "center",
                },
              ]}
            >
              <Heart size={23} color={p.purple} />
              <Text style={[u.copy, { flexShrink: 1 }]}>
                {t("taskPremium.encouragement")}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
      {selected && !failed ? (
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 8,
            paddingBottom: 8,
            backgroundColor: p.cream,
          }}
        >
          <SatinButton
            title={t("tasks.new")}
            disabled={busy}
            icon={<Plus color="#fff" size={24} />}
            onPress={() => {
              setNotice("");
              setCreating(selected);
            }}
            style={{ width: "100%", maxWidth: 560, alignSelf: "center" }}
          />
        </View>
      ) : null}

      <View
        style={[
          u.footer,
          { paddingBottom: Math.max(insets.bottom, 6) },
          { paddingTop: 6, justifyContent: "space-around" },
        ]}
      >
        {nav.map(({ title, Icon, path }) => (
          <Pressable
            key={path}
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={() => router.navigate(path)}
            style={{
              flex: 1,
              minHeight: 58,
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
            }}
          >
            <Icon size={23} color={p.muted} />
            <Text style={u.small}>{title}</Text>
          </Pressable>
        ))}
      </View>
      {creating || (initialCreate && selected) ? (
        <TaskForm
          child={creating ?? selected!}
          familyId={familyId}
          timeZone={timeZone}
          onClose={() => { setCreating(null); setInitialCreate(false); }}
          onCreated={() => {
            setCreating(null); setInitialCreate(false);
            setPaused(false);
            setNotice(t("taskPremium.created"));
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
