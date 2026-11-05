import {
  useSetupSources,
  SetupSourceLinks,
  SourceLoadError,
} from "@/components/setup/source-links";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  GraduationCap,
  Heart,
  House,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react-native";
import { Avatar } from "@/components/avatar";
import { Pressable } from "@/components/ui/pressable";
import {
  BulkArchiveSheet,
  BulkCheck,
  BulkSelectBar,
  useBulkArchive,
} from "@/components/ui/bulk-archive-sheet";
import { IconButton, SatinButton, Tag, p, u } from "@/components/planner/ui";
import type { PlannerChild } from "@/components/planner/timetable-editor";
import { useSession } from "@/lib/session";
import { useFamilyTimezone } from "@/lib/family";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { RoutineEditor, type Routine } from "./routine-editor";
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
  const [editing, setEditing] = useState<Routine | null>(null);
  const [editingName, setEditingName] = useState("");
  const [archived, setArchived] = useState(false);
  const params = useLocalSearchParams<{
    childId?: string;
    create?: string;
    taskId?: string;
    paused?: string;
  }>();
  const [childId, setChildId] = useState<string | null>(params.childId ?? null);
  const [initialCreate, setInitialCreate] = useState(params.create === "1");
  const [paused, setPaused] = useState(params.paused === "1");
  const [creating, setCreating] = useState<PlannerChild | null>(null);
  const [notice, setNotice] = useState("");
  const children = useQuery({
    queryKey: ["children"],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id,name,grade,avatar")
        .is("archived_at", null)
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
        .select("*")
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
      ["task_routine_history", familyId],
    ],
  );
  const rows = templates.data ?? [];
  const visible = rows.filter((r) =>
    archived ? !!r.archived_at : !r.archived_at && r.active !== paused,
  );
  const cache = useQueryClient();
  const bulk = useBulkArchive({
    type: "task_routine",
    mode: archived ? "restore" : "archive",
    scope: {
      child_id: selected?.id,
      ...(archived ? {} : { status: paused ? "paused" : "active" }),
    },
    candidates: visible.map((r) => ({ id: r.id, title: r.title })),
    onFinished: () =>
      Promise.all(
        [
          ["parent_task_templates", familyId],
          ["family_task_templates", familyId],
          ["task_routine_history", familyId],
        ].map((queryKey) => cache.invalidateQueries({ queryKey })),
      ),
  });
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
  const sources = useSetupSources(
    "task",
    (templates.data ?? []).map((item) => item.id),
  );
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={u.root}>
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
            onPress={() => router.push("/parent/inbox")}
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
          {(children.data?.length ?? 0) > 1 && (
            <View style={wide ? { width: 340 } : {}}>
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
                        setArchived(false);
                      }}
                    >
                      <Avatar slug={c.avatar} size={30} />
                    </Tag>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
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
            <View style={[u.row, { flexWrap: "wrap" }]}>
              {["active", "paused", "archived"].map((tab) => (
                <Tag
                  key={tab}
                  label={t(
                    tab === "archived"
                      ? "routine.archived"
                      : tab === "active"
                        ? "taskPremium.activeLabel"
                        : "taskPremium.pausedLabel",
                  )}
                  selected={
                    tab === "archived"
                      ? archived
                      : !archived && paused === (tab === "paused")
                  }
                  onPress={() => {
                    setArchived(tab === "archived");
                    setPaused(tab === "paused");
                    setNotice("");
                  }}
                />
              ))}
            </View>
            {notice ? (
              <Text accessibilityLiveRegion="polite" style={u.small}>
                {notice}
              </Text>
            ) : null}
            {visible.length > 0 || bulk.selecting ? (
              <BulkSelectBar bulk={bulk} total={visible.length} />
            ) : null}
            <SourceLoadError
              error={sources.error}
              retry={() => void sources.refetch()}
            />
            {!busy && visible.length === 0 ? (
              <View style={u.card}>
                <Text style={u.heading}>
                  {t(
                    archived
                      ? "routine.noArchived"
                      : paused
                        ? "taskPremium.noPaused"
                        : "tasks.none",
                  )}
                </Text>
                <Text style={u.copy}>
                  {t(
                    archived
                      ? "routine.noArchivedHelp"
                      : paused
                        ? "taskPremium.noPausedBody"
                        : "parentV5.firstTask",
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
                    (params.taskId === task.id ||
                      (bulk.selecting && bulk.isPicked(task.id))) && {
                      borderColor: p.purple,
                      borderWidth: 2,
                    },
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
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <TaskTile slug={task.icon} size={wide ? 72 : 64} />
                    <View style={[u.fill, { gap: 5 }]}>
                      <Text style={u.bold}>{task.title}</Text>
                      <Text style={u.small}>
                        {daysText(task.days_of_week)} ·{" "}
                        {t("room.starCount", { count: task.stars })}
                      </Text>
                      <StarReward count={task.stars} />
                    </View>
                    {bulk.selecting ? (
                      <BulkCheck
                        label={task.title}
                        checked={bulk.isPicked(task.id)}
                        onToggle={() => bulk.toggle(task.id)}
                      />
                    ) : (
                      <IconButton
                        label={t("routine.editNamed", { title: task.title })}
                        onPress={() => {
                          setNotice("");
                          setEditingName(selected.name);
                          setEditing(task);
                        }}
                      >
                        <Pencil color={p.purple} size={20} />
                      </IconButton>
                    )}
                  </View>
                  <SetupSourceLinks
                    sources={(sources.data ?? []).filter(
                      (s) => s.item_id === task.id,
                    )}
                  />
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
      {selected && !failed && !bulk.selecting ? (
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
      <BulkArchiveSheet {...bulk.sheet} />
      {editing && (
        <RoutineEditor
          key={`${editing.id}:${editing.revision}`}
          row={editing}
          childName={editingName}
          familyId={familyId}
          onClose={() => setEditing(null)}
          onSaved={(action) => {
            setEditing(null);
            setNotice(t(`routine.saved.${action}`));
            if (action === "archive") setArchived(true);
            if (action === "restore" || action === "pause") {
              setArchived(false);
              setPaused(true);
            }
            if (action === "resume") {
              setArchived(false);
              setPaused(false);
            }
          }}
        />
      )}
      {creating || (initialCreate && selected) ? (
        <TaskForm
          child={creating ?? selected!}
          familyId={familyId}
          timeZone={timeZone}
          onClose={() => {
            setCreating(null);
            setInitialCreate(false);
          }}
          onCreated={() => {
            setCreating(null);
            setInitialCreate(false);
            setPaused(false);
            setNotice(t("taskPremium.created"));
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
