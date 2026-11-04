import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
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
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  House,
  MoreHorizontal,
  Plus,
} from "lucide-react-native";
import {
  localDateOf,
  occurrencesBetween,
  weekDatesOf,
  type Occurrence,
} from "@gina/core";
import { Avatar } from "@/components/avatar";
import { EventIcon } from "@/components/event-icon";
import { SubjectIcon, resolveSubjectSlug } from "@/components/subject-icon";
import type { WeekEvent } from "@/components/calendar/week-list";
import { Pressable } from "@/components/ui/pressable";
import { useActiveChild } from "@/lib/active-child";
import { useFamilyTimezone } from "@/lib/family";
import { useFamilyEvents } from "@/lib/use-family-events";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { IconButton, PlannerHero, SatinButton, Tag, p, u } from "./ui";
import { TimetableEditor, type PlannerChild } from "./timetable-editor";
import { EventEditor } from "./event-editor";
function shift(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function PlannerCalendar({
  childMode = false,
}: {
  childMode?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { claims } = useSession();
  const active = useActiveChild();
  const timeZone = useFamilyTimezone();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const today = localDateOf(new Date(), timeZone);
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [filter, setFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlannerChild | null>(null);
  const [event, setEvent] = useState<WeekEvent | null | undefined>(undefined);
  const [detail, setDetail] = useState<WeekEvent | null>(null);
  const familyId = claims?.family_id ?? "";
  const { events, exceptions } = useFamilyEvents(
    childMode ? active.childId || null : undefined,
  );
  const children = useQuery({
    queryKey: [
      "planner_children",
      familyId,
      childMode ? active.childId : "all",
    ],
    enabled: !!familyId && (!childMode || !!active.childId),
    queryFn: async () => {
      let req = supabase
        .from("children")
        .select("id,name,avatar")
        .order("sort_order");
      if (childMode) req = req.eq("id", active.childId);
      const { data, error } = await req;
      if (error) throw error;
      return data;
    },
  });
  const profiles = (children.data ?? []).filter(
    (c) => !childMode || c.id === active.childId,
  );
  const week = weekDatesOf(anchor);
  const date = week.includes(selected) ? selected : week[0];
  const selectedChild =
    profiles.find((c) => c.id === (childMode ? active.childId : filter)) ??
    profiles[0];
  const occurrences = occurrencesBetween(
    events.data ?? [],
    week[0],
    week[6],
    timeZone,
    exceptions.data ?? new Set(),
  ).filter((o) => !filter || !o.event.child_id || o.event.child_id === filter);
  const dateText = (value: string, format: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(i18n.language, {
      ...format,
      timeZone: "UTC",
    }).format(new Date(`${value}T12:00:00Z`));
  const timeText = (value: Date) =>
    new Intl.DateTimeFormat(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(value);
  function openPlan(c = selectedChild) {
    if (c) setEditing(c);
  }
  function openItem(e: WeekEvent) {
    if (e.timetable_entry_key) {
      openPlan(profiles.find((c) => c.id === e.child_id));
    } else if (childMode) setDetail(detail?.id === e.id ? null : e);
    else setEvent(e);
  }
  if (editing)
    return (
      <TimetableEditor
        key={editing.id}
        child={editing}
        profiles={profiles}
        onSwitch={setEditing}
        onClose={() => setEditing(null)}
      />
    );
  const busy = events.isLoading || exceptions.isLoading || children.isLoading;
  const failed = events.error || exceptions.error || children.error;
  function tone(e: WeekEvent) {
    const slug = resolveSubjectSlug(e.title);
    return e.type !== "school"
      ? { bg: "#FCE3EC", fg: "#BE3867" }
      : slug === "turkish"
        ? { bg: "#DDF5EB", fg: "#278B76" }
        : slug === "life-science"
          ? { bg: "#FCEBCF", fg: "#B87827" }
          : { bg: p.lilac, fg: p.purple };
  }
  function item(o: Occurrence<WeekEvent>, compact = false) {
    return (
      <View
        key={`${o.event.id}:${o.date}`}
        style={[u.row, { gap: compact ? 7 : 10, alignItems: "stretch" }]}
      >
        <View style={{ width: compact ? 44 : 56, justifyContent: "center" }}>
          <Text style={[u.small, { fontSize: compact ? 12 : 14 }]}>
            {o.event.all_day ? t("calendar.allDay") : timeText(o.startsAt)}
          </Text>
          {o.endsAt && !o.event.all_day ? (
            <Text style={[u.small, { fontSize: compact ? 12 : 14 }]}>
              {timeText(o.endsAt)}
            </Text>
          ) : null}
        </View>
        {!compact ? (
          <View
            style={{
              width: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: "#E6DFE8",
              }}
            />
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: tone(o.event).fg,
                borderWidth: 2,
                borderColor: p.cream,
              }}
            />
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${o.event.title}, ${o.event.all_day ? t("calendar.allDay") : timeText(o.startsAt)}`}
          onPress={() => openItem(o.event)}
          style={({ pressed }) => [
            u.row,
            {
              flex: 1,
              minHeight: 64,
              padding: 8,
              gap: 10,
              borderRadius: 20,
              backgroundColor: pressed ? "#EEE8FA" : "#FAF7F7",
              borderWidth: 1,
              borderColor: p.line,
            },
          ]}
        >
          {!compact ? (
            <View
              style={{
                backgroundColor: tone(o.event).bg,
                width: 45,
                height: 45,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {o.event.type === "school" ? (
                <SubjectIcon subject={o.event.title} size={30} variant="svg" appearance="planner" />
              ) : (
                <EventIcon type={o.event.type} size={30} variant="svg" />
              )}
            </View>
          ) : null}
          <View style={u.fill}>
            <Text style={[u.bold, compact && { fontSize: 14 }]}>
              {o.event.title}
            </Text>
            <Text style={[u.small, { marginTop: 3 }]}>
              {t(`event.type.${o.event.type}`)}
              {!childMode
                ? ` · ${profiles.find((c) => c.id === o.event.child_id)?.name ?? t("calendar.allFamily")}`
                : ""}
            </Text>
            {!compact && o.event.notes ? <Text numberOfLines={2} style={[u.copy, {marginTop: 8}]}>{o.event.notes}</Text> : null}
            {o.event.location ? (
              <Text style={u.small}>{o.event.location}</Text>
            ) : null}
          </View>
          {!compact ? <ChevronRight size={18} color={p.muted} /> : null}
        </Pressable>
      </View>
    );
  }
  const items = occurrences.filter((o) => o.date === date);
  const nav = childMode
    ? [
        {
          title: t("childMint.world"),
          Icon: House,
          run: () => router.push(active.path("today")),
        },
        { title: t("child.calendar"), Icon: CalendarDays, run: () => {} },
        {
          title: t("prova.title"),
          Icon: GraduationCap,
          run: () => router.push(active.path("prova")),
        },
      ]
    : [
        {
          title: t("calendar.today"),
          Icon: House,
          run: () => router.push("/parent"),
        },
        { title: t("parent.calendar"), Icon: CalendarDays, run: () => {} },
        {
          title: t("prova.title"),
          Icon: GraduationCap,
          run: () => router.push("/parent/prova"),
        },
        {
          title: t("planner.more"),
          Icon: MoreHorizontal,
          run: () => router.push("/parent/menu"),
        },
      ];
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={u.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={u.content}
      >
        <View style={u.topbar}>
          {childMode ? (
            <IconButton label={t("common.back")} onPress={() => router.back()}>
              <ArrowLeft color={p.purple} />
            </IconButton>
          ) : (
            <Image
              source={require("../../../../../packages/assets/brand/growing-friend/logo.png")}
              style={u.logo}
              resizeMode="contain"
              accessibilityLabel="Gina"
            />
          )}
          <View style={u.fill} />
          {!childMode ? (
            <IconButton
              label={t("push.menu")}
              onPress={() => router.push("/parent/notifications")}
            >
              <Bell size={22} color={p.purple} />
            </IconButton>
          ) : null}
        </View>
        <View
          style={
            wide
              ? { flexDirection: "row", alignItems: "center", gap: 28 }
              : { gap: 10 }
          }
        >
          <View style={wide ? { flex: 1 } : undefined}>
            <PlannerHero
              title={t(childMode ? "child.calendar" : "planner.title")}
              subtitle={t("planner.subtitle")}
            />
          </View>
          <View style={wide ? { width: 560, gap: 10 } : { gap: 10 }}>
            <View style={[u.segment, { maxWidth: 560 }]}>
              <SatinButton
                title={t("parent.calendar")}
                onPress={() => {}}
                style={{ flex: 1, minHeight: 48, paddingVertical: 8 }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("planner.program")}
                disabled={!profiles.length || !!failed}
                onPress={() => openPlan()}
                style={[
                  u.row,
                  {
                    flex: 1,
                    minHeight: 48,
                    justifyContent: "center",
                    padding: 8,
                  },
                ]}
              >
                <Text style={[u.bold, { textAlign: "center" }]}>
                  {t("planner.program")}
                </Text>
              </Pressable>
            </View>
            {!childMode && profiles.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={u.row}>
                  <Tag
                    label={t("planner.all")}
                    selected={filter === null}
                    onPress={() => setFilter(null)}
                  />
                  {profiles.map((c) => (
                    <Tag
                      key={c.id}
                      label={c.name}
                      selected={filter === c.id}
                      onPress={() => setFilter(c.id)}
                    >
                      <Avatar slug={c.avatar} size={28} />
                    </Tag>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
        {busy ? <ActivityIndicator color={p.purple} /> : null}
        {failed ? (
          <View style={u.card}>
            <Text accessibilityRole="alert" style={u.error}>
              {t("planner.loadError")}
            </Text>
            <SatinButton
              title={t("common.retry")}
              onPress={() => {
                void events.refetch();
                void exceptions.refetch();
                void children.refetch();
              }}
            />
          </View>
        ) : null}

        {!busy && !profiles.length && !childMode ? (
          <View style={u.card}>
            <Text style={u.heading}>{t("parent.addChild")}</Text>
            <Text style={u.copy}>{t("planner.addChildHelp")}</Text>
            <SatinButton
              title={t("parent.addChild")}
              onPress={() => router.push("/parent/menu")}
            />
          </View>
        ) : null}
        <View style={[u.row, { justifyContent: "space-between", gap: 6 }]}>
          <IconButton
            label={t("calendar.previousWeek")}
            onPress={() => {
              setAnchor(shift(anchor, -7));
              setSelected(shift(date, -7));
            }}
          >
            <ChevronLeft size={22} color={p.purple} />
          </IconButton>
          <Text
            style={[
              u.bold,
              { fontSize: width < 360 ? 17 : 20, flex: 1, textAlign: "center" },
            ]}
          >
            {dateText(date, { month: "long", year: "numeric" })}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={[u.tag, { paddingHorizontal: 10 }]}
            onPress={() => {
              setAnchor(today);
              setSelected(today);
            }}
          >
            <Text style={u.linkText}>{t("calendar.today")}</Text>
          </Pressable>
          <IconButton
            label={t("calendar.nextWeek")}
            onPress={() => {
              setAnchor(shift(anchor, 7));
              setSelected(shift(date, 7));
            }}
          >
            <ChevronRight size={22} color={p.purple} />
          </IconButton>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ flexDirection: "row", gap: 3, flex: 1 }}>
            {week.map((d) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityLabel={dateText(d, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                accessibilityState={{ selected: d === date }}
                onPress={() => setSelected(d)}
                style={{
                  flex: 1,
                  minWidth: 48,
                  minHeight: 66,
                  alignItems: "center",
                  gap: 6,
                  justifyContent: "center",
                }}
              >
                <Text style={u.small}>{dateText(d, { weekday: "short" })}</Text>
                <View
                  style={{
                    minWidth: 48,
                    width: "100%",
                    maxWidth: 100,
                    minHeight: 50,
                    borderRadius: 18,
                    backgroundColor: d === date ? p.purple : "#F2EDF2",
                    alignItems: "center",
                    justifyContent: "center",
                    borderBottomWidth: d === date ? 3 : 0,
                    borderColor: "#4D32AD",
                  }}
                >
                  <Text
                    style={[u.heading, { color: d === date ? "#fff" : p.ink }]}
                  >
                    {Number(d.slice(8))}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        {!busy && !failed ? (
          <>
            {wide ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: 20,
                  alignItems: "flex-start",
                }}
              >
                <View style={{ flex: 1.2, gap: 16 }}>{agenda()}</View>
                <View style={[u.card, { flex: 1 }]}>
                  <Text style={u.heading}>{t("planner.weekOverview")}</Text>
                  {week.map((d) => {
                    const list = occurrences.filter((o) => o.date === d);
                    return (
                      <Pressable
                        key={d}
                        accessibilityRole="button"
                        accessibilityState={{ selected: d === date }}
                        onPress={() => setSelected(d)}
                        style={[
                          u.row,
                          {
                            minHeight: 48,
                            borderRadius: 14,
                            backgroundColor:
                              d === date ? p.lilac : "transparent",
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            u.bold,
                            {
                              width: 112,
                              color: d === date ? p.purple : p.ink,
                            },
                          ]}
                        >
                          {dateText(d, { weekday: "long", day: "numeric" })}
                        </Text>
                        <Text style={[u.small, u.fill]}>
                          {list.length
                            ? t("planner.daySummary", {
                                lessons: list.filter(
                                  (o) => o.event.type === "school",
                                ).length,
                                events: list.filter(
                                  (o) => o.event.type !== "school",
                                ).length,
                              })
                            : t("planner.freeDay")}
                        </Text>
                        <ChevronRight color={p.muted} size={16} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              agenda()
            )}
          </>
        ) : null}
        {detail ? (
          <View style={u.card}>
            <Text style={u.heading}>{detail.title}</Text>
            {detail.notes ? <Text style={u.copy}>{detail.notes}</Text> : null}
            <Text style={u.copy}>
              {detail.location ?? t(`event.type.${detail.type}`)}
            </Text>
            <SatinButton
              secondary
              title={t("common.back")}
              onPress={() => setDetail(null)}
            />
          </View>
        ) : null}
        {!childMode ? (
          <SatinButton
            title={t("planner.addEvent")}
            icon={<Plus size={23} color="#fff" />}
            onPress={() => setEvent(null)}
          />
        ) : null}
      </ScrollView>
      <View
        style={[
          u.footer,
          { paddingBottom: Math.max(insets.bottom, 6) },
          { justifyContent: "space-around", paddingTop: 6 },
        ]}
      >
        {nav.map(({ title, Icon, run }, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ selected: i === 1 }}
            onPress={run}
            style={{
              flex: 1,
              minHeight: 58,
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
            }}
          >
            <Icon size={23} color={i === 1 ? p.purple : p.muted} />
            <Text style={[u.small, { color: i === 1 ? p.purple : p.muted }]}>
              {title}
            </Text>
            {i === 1 ? (
              <View
                style={{
                  width: 28,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: p.purple,
                }}
              />
            ) : null}
          </Pressable>
        ))}
      </View>
      {event !== undefined && !childMode ? (
        <EventEditor
          event={event}
          date={date}
          familyId={familyId}
          timeZone={timeZone}
          profiles={profiles}
          onClose={() => setEvent(undefined)}
        />
      ) : null}
    </SafeAreaView>
  );
  function agenda() {
    return (
      <View style={[u.card, { padding: 12, gap: 8 }]}>
        <View
          style={[u.row, { justifyContent: "space-between", flexWrap: "wrap" }]}
        >
          <Text style={u.heading}>
            {dateText(date, { day: "numeric", month: "long", weekday: "long" })}
          </Text>
          <Text style={u.small}>
            {t("planner.daySummary", {
              lessons: items.filter((o) => o.event.type === "school").length,
              events: items.filter((o) => o.event.type !== "school").length,
            })}
          </Text>
        </View>
        {items.length ? (
          items.map((o) => item(o))
        ) : (
          <View style={{ paddingVertical: 28, gap: 12 }}>
            <Text style={u.heading}>{t("planner.emptyTitle")}</Text>
            <Text style={u.copy}>{t(childMode ? "planner.childEmptyBody" : "planner.emptyBody")}</Text>
            {selectedChild ? (
              <SatinButton
                secondary
                title={t("planner.program")}
                onPress={() => openPlan()}
              />
            ) : null}
          </View>
        )}
      </View>
    );
  }
}
