import { useMemo, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, CheckCircle2 } from "lucide-react-native";
import {
  isCalendarDate,
  localDateOf,
  makePlanCalendarDrafts,
  type PlanCalendarDraft,
  planCalendarItems,
  studyPlanConflicts,
} from "@gina/core";
import { b, BuilderCard, BuilderChoice } from "./prova-builder-ui";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { p, SatinButton } from "@/components/planner/ui";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useFamilyEvents } from "@/lib/use-family-events";
import {
  type StudyPlanCommand,
  studyPlanJournal,
} from "@/lib/study-plan-command";

export function StudyPlanCalendar({
  planId,
  childId,
  familyId,
  updatedAt,
  body,
  timeZone,
  archived,
  onRefresh,
}: {
  planId: string;
  childId: string;
  familyId: string;
  updatedAt: string;
  body: unknown;
  timeZone: string;
  archived: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const { t, i18n } = useTranslation(),
    { session } = useSession(),
    cache = useQueryClient();
  const { width, fontScale } = useWindowDimensions(),
    wide = width >= 800 && fontScale < 1.4;
  const journal = useMemo(
    () => studyPlanJournal(session?.user.id ?? "", familyId, planId),
    [session?.user.id, familyId, planId],
  );
  const [initial] = useState(() => {
    try {
      return { pending: journal.read(), failed: false };
    } catch {
      return { pending: null, failed: true };
    }
  });
  const [pending, setPending] = useState<StudyPlanCommand | null>(
      initial.pending,
    ),
    [preview, setPreview] = useState(false),
    [error, setError] = useState("");
  const [draft] = useState(() => {
    try {
      return makePlanCalendarDrafts(
        body,
        new Date(Date.parse(localDateOf(new Date(), timeZone)) + 86400000)
          .toISOString().slice(0, 10),
      );
    } catch {
      return null;
    }
  });
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [rows, setRows] = useState<PlanCalendarDraft[]>(draft ?? []);
  const { events, exceptions } = useFamilyEvents();
  const links = useQuery({
    queryKey: ["study_plan_calendar", planId],
    queryFn: async () => {
      const { data, error } = await supabase.from("study_plan_calendar_items")
        .select("day,event_id,events(title,starts_at,ends_at)").eq(
          "plan_id",
          planId,
        );
      if (error) throw error;
      return data;
    },
  });
  const applied = new Set(links.data?.map((x) => x.day));
  const selected = rows.filter((r) => r.selected && !applied.has(r.day));
  const prepared = useMemo(() => {
    try {
      return {
        items: planCalendarItems(
          selected,
          timeZone,
          localDateOf(new Date(), timeZone),
        ),
        error: "",
      };
    } catch (e) {
      return {
        items: [],
        error: e instanceof Error ? e.message : "plan_invalid",
      };
    }
  }, [selected, timeZone]);
  const conflicts = studyPlanConflicts(
    prepared.items,
    (events.data ?? []).filter((e) => !e.child_id || e.child_id === childId),
    timeZone,
    exceptions.data,
  );
  const warnings = conflicts.filter((c) => c.titles.length);
  const calendarReady = events.isSuccess && exceptions.isSuccess;
  const patch = (day: number, update: Partial<PlanCalendarDraft>) => {
    setPreview(false);
    setError("");
    setRows((old) => old.map((r) => r.day === day ? { ...r, ...update } : r));
  };
  const send = useMutation({
    mutationFn: async () => {
      let command = pending;
      if (!command) {
        if (
          !preview || !calendarReady || !links.isSuccess || archived ||
          prepared.error
        ) throw Error("plan_invalid");
        command = journal.prepare({
          p_plan_id: planId,
          p_updated_at: updatedAt,
          p_items: prepared.items,
        });
      }
      setPending(command);
      try {
        return await journal.send(command);
      } finally {
        setPending(journal.read());
      }
    },
    onSuccess: async () => {
      setRows((old) => old.map((r) => ({ ...r, selected: false })));
      setPreview(false);
      setError("");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["events"] }),
        cache.invalidateQueries({ queryKey: ["child_events"] }),
        cache.invalidateQueries({ queryKey: ["study_plan_calendar", planId] }),
        cache.invalidateQueries({ queryKey: ["study_plans_for_attempt"] }),
      ]);
      await onRefresh();
    },
    onError: (e: Error) => {
      try {
        setPending(journal.read());
      } catch {
        setError(t("planCalendar.storage"));
        return;
      }
      setError(
        t(
          ["plan_changed", "plan_day_applied", "plan_archived"].includes(
              e.message,
            )
            ? "planCalendar.changed"
            : "planCalendar.failed",
        ),
      );
    },
  });
  const dateText = (date: string) =>
    !isCalendarDate(date) ? date : new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(date + "T12:00:00Z"));
  const stampText = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(value));
  if (initial.failed) {
    return (
      <BuilderCard>
        <Text style={b.error}>{t("planCalendar.storage")}</Text>
      </BuilderCard>
    );
  }
  if (pending) {
    return (
      <BuilderCard title={t("planCalendar.recoverTitle")}>
        <Text style={b.copy}>
          {t("planCalendar.recoverBody", { count: pending.p_items.length })}
        </Text>
        {pending.p_items.map((item) => (
          <Text key={item.day} style={b.muted}>
            {item.title} · {stampText(item.starts_at)}
          </Text>
        ))}
        <SatinButton
          title={t("calendarRecovery.retry")}
          busy={send.isPending}
          onPress={() => send.mutate()}
        />
        <Text style={b.muted}>{t("planCalendar.leavePending")}</Text>
      </BuilderCard>
    );
  }
  return (
    <BuilderCard title={t("planCalendar.title")}>
      <Text style={b.muted}>{t("planCalendar.intro")}</Text>
      <Text style={b.muted}>
        {t("planCalendar.timezone", { zone: timeZone })}
      </Text>
      {links.isPending
        ? <Text style={b.copy}>{t("release.loading")}</Text>
        : links.error
        ? (
          <>
            <Text style={b.error}>{t("planCalendar.loadError")}</Text>
            <Button
              variant="secondary"
              title={t("common.retry")}
              onPress={() => void links.refetch()}
            />
          </>
        )
        : null}
      {links.data?.map((link) => (
        <View
          key={link.day}
          style={[b.hint, {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }]}
        >
          <CheckCircle2 color="#287460" size={24} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={b.bold}>
              {t("prova.ai.dayN", { n: link.day })} ·{" "}
              {t(link.event_id ? "planCalendar.added" : "planCalendar.removed")}
            </Text>
            {link.events
              ? (
                <Text style={b.muted}>
                  {link.events.title} · {stampText(link.events.starts_at)}
                </Text>
              )
              : null}
          </View>
        </View>
      ))}
      {!draft
        ? <Text style={b.error}>{t("planCalendar.badPlan")}</Text>
        : archived
        ? <Text style={b.muted}>{t("planCalendar.archived")}</Text>
        : (
          <>
            {preview
              ? (
                <View style={{ gap: 16 }}>
                  <Text style={b.h2}>
                    {t("planCalendar.preview", { count: selected.length })}
                  </Text>
                  {selected.map((row) => (
                    <View
                      key={row.day}
                      style={{
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderColor: p.line,
                        gap: 6,
                      }}
                    >
                      <Text style={b.bold}>{row.title}</Text>
                      <Text style={b.copy}>
                        {dateText(row.date)} · {row.time} ·{" "}
                        {t("prova.ai.minutes", { count: row.minutes })}
                      </Text>
                      <Text style={b.muted}>{row.notes}</Text>
                    </View>
                  ))}
                  <Text style={b.muted}>{t("planCalendar.effect")}</Text>
                  {!calendarReady
                    ? (
                      <View style={{ gap: 8 }}>
                        <Text style={b.error}>
                          {t("planCalendar.calendarUnavailable")}
                        </Text>
                        <Button
                          variant="secondary"
                          title={t("common.retry")}
                          onPress={() => {
                            void events.refetch();
                            void exceptions.refetch();
                          }}
                        />
                      </View>
                    )
                    : null}
                  {warnings.length
                    ? (
                      <View style={[b.hint, { backgroundColor: "#FFF2E4" }]}>
                        <Text style={b.bold}>
                          {t("planCalendar.overlapTitle")}
                        </Text>
                        {warnings.map((w) => (
                          <Text key={w.day} style={b.copy}>
                            {t("prova.ai.dayN", { n: w.day })}:{" "}
                            {w.titles.join(", ")}
                          </Text>
                        ))}
                        <Text style={b.muted}>
                          {t("planCalendar.overlapBody")}
                        </Text>
                      </View>
                    )
                    : null}
                  <View
                    style={{ flexDirection: wide ? "row" : "column", gap: 12 }}
                  >
                    <SatinButton
                      title={t("planCalendar.apply", {
                        count: selected.length,
                      })}
                      icon={<CalendarDays color="#fff" size={22} />}
                      style={{ flex: 1 }}
                      disabled={!calendarReady || !!prepared.error ||
                        !links.isSuccess}
                      busy={send.isPending}
                      onPress={() => send.mutate()}
                    />
                    <Button
                      variant="ghost"
                      title={t("planCalendar.edit")}
                      disabled={send.isPending}
                      onPress={() => setPreview(false)}
                    />
                  </View>
                </View>
              )
              : (
                <View style={{ gap: 14 }}>
                  {rows.filter((r) => !applied.has(r.day)).map((row) => (
                    <View
                      key={row.day}
                      style={{
                        gap: 14,
                        paddingBottom: 14,
                        borderBottomWidth: 1,
                        borderColor: p.line,
                      }}
                    >
                      <BuilderChoice
                        label={`${
                          t("prova.ai.dayN", { n: row.day })
                        } · ${row.title}`}
                        selected={row.selected}
                        disabled={!links.isSuccess}
                        onPress={() =>
                          patch(row.day, { selected: !row.selected })}
                      />
                      <Text style={b.muted}>{row.notes}</Text>
                      {row.selected
                        ? (
                          <View style={{ gap: 6 }}>
                            <Text style={b.copy}>
                              {dateText(row.date)} · {row.time} ·{" "}
                              {t("prova.ai.minutes", { count: row.minutes })}
                            </Text>
                            <Button
                              variant="ghost"
                              title={t(
                                editingDay === row.day
                                  ? "planCalendar.collapse"
                                  : "planCalendar.adjust",
                              )}
                              onPress={() =>
                                setEditingDay(
                                  editingDay === row.day ? null : row.day,
                                )}
                            />
                          </View>
                        )
                        : null}
                      {!row.selected || editingDay !== row.day ? <></> : (
                        <View
                          style={{
                            gap: 14,
                            paddingHorizontal: wide ? 16 : 0,
                          }}
                        >
                          <Field
                            label={t("planCalendar.activity")}
                            value={row.title}
                            maxLength={120}
                            onChangeText={(title) => patch(row.day, { title })}
                          />
                          <Field
                            label={t("planCalendar.notes")}
                            value={row.notes}
                            multiline
                            maxLength={1200}
                            onChangeText={(notes) => patch(row.day, { notes })}
                          />
                          <View
                            style={{
                              flexDirection: wide ? "row" : "column",
                              gap: 12,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Field
                                label={t("planCalendar.date")}
                                placeholder="2026-11-04"
                                value={row.date}
                                maxLength={10}
                                onChangeText={(date) =>
                                  patch(row.day, { date })}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Field
                                label={t("planCalendar.time")}
                                placeholder="17:00"
                                value={row.time}
                                maxLength={5}
                                onChangeText={(time) =>
                                  patch(row.day, { time })}
                              />
                            </View>
                          </View>
                          <Field
                            label={t("planCalendar.minutes")}
                            keyboardType="number-pad"
                            value={Number.isNaN(row.minutes)
                              ? ""
                              : String(row.minutes)}
                            maxLength={2}
                            onChangeText={(value) => patch(row.day, {
                              minutes: value.trim() ? Number(value) : NaN,
                            })}
                          />
                        </View>
                      )}
                    </View>
                  ))}
                  {rows.some((r) => !applied.has(r.day))
                    ? (
                      <SatinButton
                        title={t("planCalendar.review", {
                          count: selected.length,
                        })}
                        disabled={!selected.length || !links.isSuccess}
                        onPress={() => {
                          if (prepared.error) {
                            setError(t(
                              prepared.error === "plan_overlap"
                                ? "planCalendar.internalOverlap"
                                : "planCalendar.invalid",
                            ));
                            return;
                          }
                          setError("");
                          setPreview(true);
                        }}
                      />
                    )
                    : null}
                </View>
              )}
          </>
        )}
      {error
        ? (
          <>
            <Text accessibilityRole="alert" style={b.error}>{error}</Text>
            <Button
              variant="ghost"
              title={t("planCalendar.refresh")}
              disabled={send.isPending}
              onPress={() => {
                void links.refetch();
                void events.refetch();
                void exceptions.refetch();
                void onRefresh();
              }}
            />
          </>
        )
        : null}
    </BuilderCard>
  );
}
