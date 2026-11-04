import { useMemo, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, CheckCircle2 } from "lucide-react-native";
import {
  isCalendarDate,
  localDateOf,
  makeRepeatCalendarDrafts,
  type PlanCalendarDraft,
  planCalendarItems,
  type RepeatCalendarCommand,
  type RepeatCalendarSource,
  studyPlanConflicts,
} from "@gina/core";
import { b, BuilderCard, BuilderChoice } from "./prova-builder-ui";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { p, SatinButton } from "@/components/planner/ui";
import { useSession } from "@/lib/session";
import { useFamilyEvents } from "@/lib/use-family-events";
import { repeatCalendarJournal } from "@/lib/repeat-calendar-command";
export function RepeatCalendar(
  { source, family, onRefresh }: {
    source: RepeatCalendarSource;
    family: string;
    onRefresh: () => Promise<unknown>;
  },
) {
  const { t, i18n } = useTranslation(),
    { session } = useSession(),
    cache = useQueryClient(),
    { width, fontScale } = useWindowDimensions(),
    wide = width >= 900 && fontScale < 1.4;
  const journal = useMemo(
    () =>
      repeatCalendarJournal(session?.user.id ?? "", family, source.attempt_id),
    [session?.user.id, family, source.attempt_id],
  );
  const [initial] = useState(() => {
    try {
      return { pending: journal.read(), failed: false };
    } catch {
      return { pending: null, failed: true };
    }
  });
  const [pending, setPending] = useState<RepeatCalendarCommand | null>(
      initial.pending,
    ),
    [selected, setSelected] = useState<string[]>([]),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<number | null>(null);
  const [rows, setRows] = useState(() =>
    makeRepeatCalendarDrafts(
      localDateOf(new Date(), source.timezone),
      t("repeatCalendar.sessionTitle"),
      t("repeatCalendar.sessionNotes"),
    )
  );
  const { events, exceptions } = useFamilyEvents();
  const items = useMemo(() => {
    try {
      return {
        value: planCalendarItems(
          rows,
          source.timezone,
          localDateOf(new Date(), source.timezone),
        ),
        error: false,
      };
    } catch {
      return { value: [], error: true };
    }
  }, [rows, source.timezone]);
  const conflicts = studyPlanConflicts(
    items.value,
    (events.data ?? []).filter((e) =>
      !e.child_id || e.child_id === source.child_id
    ),
    source.timezone,
    exceptions.data,
  ).filter((c) => c.titles.length);
  const ready = events.isSuccess && exceptions.isSuccess;
  const edit = (day: number, patch: Partial<PlanCalendarDraft>) => {
    setPreview(false);
    setRows((old) => old.map((r) => r.day === day ? { ...r, ...patch } : r));
  };
  const send = useMutation({
    mutationFn: async () => {
      let command = pending;
      if (!command) {
        if (
          !preview || !ready || !selected.length || items.error ||
          source.scheduled
        ) throw Error("plan_invalid");
        command = journal.prepare({
          p_attempt_id: source.attempt_id,
          p_source_hash: source.hash,
          p_question_ids: selected,
          p_items: items.value,
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
      setError("");
      setPreview(false);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["events"] }),
        cache.invalidateQueries({ queryKey: ["child_events"] }),
      ]);
      await onRefresh();
    },
    onError: (e: Error) => {
      try {
        setPending(journal.read());
      } catch {
        setError(t("repeatCalendar.storage"));
        return;
      }
      setError(
        t(
          ["repeat_changed", "repeat_applied", "repeat_ineligible"].includes(
              e.message,
            )
            ? "repeatCalendar.changed"
            : "repeatCalendar.failed",
        ),
      );
    },
  });
  const dateLabel = (value: string) =>
    isCalendarDate(value)
      ? new Intl.DateTimeFormat(i18n.language, {
        day: "numeric",
        month: "short",
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(value + "T12:00:00Z"))
      : value;
  const stamp = (v: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: source.timezone,
    }).format(new Date(v));
  if (initial.failed) {
    return (
      <BuilderCard>
        <Text style={b.error}>{t("repeatCalendar.storage")}</Text>
      </BuilderCard>
    );
  }
  if (pending) {
    return (
      <BuilderCard title={t("repeatCalendar.pending")}>
        <Text style={b.copy}>{t("repeatCalendar.pendingBody")}</Text>
        {pending.p_items.map((r) => (
          <Text key={r.day} style={b.muted}>
            {r.title} · {stamp(r.starts_at)}
          </Text>
        ))}
        {error
          ? <Text accessibilityRole="alert" style={b.error}>{error}</Text>
          : null}
        <SatinButton
          title={t("calendarRecovery.retry")}
          busy={send.isPending}
          onPress={() => send.mutate()}
        />
      </BuilderCard>
    );
  }
  if (source.scheduled) {
    return (
      <BuilderCard title={t("repeatCalendar.saved")}>
        <View style={b.hint}>
          <CheckCircle2 color="#287460" size={24} />
          <Text style={b.copy}>{t("repeatCalendar.savedBody")}</Text>
        </View>
        {source.scheduled.items.map((r) => (
          <View key={r.step} style={{ gap: 4 }}>
            <Text style={b.bold}>{r.title ?? t("repeatCalendar.removed")}</Text>
            {r.starts_at
              ? <Text style={b.muted}>{stamp(r.starts_at)}</Text>
              : null}
          </View>
        ))}
        <Text style={b.bold}>{t("repeatCalendar.savedQuestions")}</Text>
        {source.scheduled.questions.map((q) => (
          <View key={q.id} style={{ gap: 4 }}>
            <Text style={b.copy}>
              {t("prova.ai.questionN", { n: q.position })} · {q.stem}
            </Text>
            <Button
              variant="ghost"
              title={t("repeatCalendar.inspect")}
              onPress={() =>
                router.push({
                  pathname: "/parent/prova/review/[attemptId]",
                  params: { attemptId: source.attempt_id, questionId: q.id },
                })}
            />
          </View>
        ))}
        <Button
          variant="secondary"
          title={t("repeatCalendar.openCalendar")}
          onPress={() => router.push("/parent/calendar")}
        />
        <Button
          variant="ghost"
          title={t("repeatCalendar.openReview")}
          onPress={() =>
            router.push(`/parent/prova/review/${source.attempt_id}`)}
        />
      </BuilderCard>
    );
  }
  if (!source.questions.length) {
    return (
      <BuilderCard title={t("repeatCalendar.emptyTitle")}>
        <Text style={b.copy}>{t("repeatCalendar.emptyBody")}</Text>
        <Button
          variant="secondary"
          title={t("repeatCalendar.openReview")}
          onPress={() =>
            router.push(`/parent/prova/review/${source.attempt_id}`)}
        />
      </BuilderCard>
    );
  }
  return (
    <View style={{ gap: 18 }}>
      <View style={b.hint}>
        <CalendarDays color={p.purple} size={26} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={b.h2}>
            {t("repeatCalendar.heading", { name: source.child_name })}
          </Text>
          <Text style={b.copy}>{t("repeatCalendar.intro")}</Text>
        </View>
      </View>
      {error
        ? <Text accessibilityRole="alert" style={b.error}>{error}</Text>
        : null}
      {preview
        ? (
          <BuilderCard title={t("repeatCalendar.preview")}>
            <Text style={b.copy}>
              {t("repeatCalendar.summary", {
                questions: selected.length,
                sessions: items.value.length,
              })}
            </Text>
            {source.questions.filter((q) => selected.includes(q.id)).map(
              (q) => (
                <Text key={q.id} style={b.muted}>
                  {t("prova.ai.questionN", { n: q.position })} · {q.subject} ·
                  {" "}
                  {q.topic}
                </Text>
              ),
            )}
            {items.value.map((r) => (
              <View
                key={r.day}
                style={{
                  borderBottomWidth: 1,
                  borderColor: p.line,
                  paddingVertical: 12,
                  gap: 6,
                }}
              >
                <Text style={b.bold}>{r.title}</Text>
                <Text style={b.copy}>
                  {stamp(r.starts_at)} ·{" "}
                  {t("prova.ai.minutes", { count: r.minutes })}
                </Text>
                <Text style={b.muted}>{r.notes}</Text>
              </View>
            ))}
            <Text style={b.copy}>{t("repeatCalendar.effect")}</Text>
            {!ready
              ? (
                <Text style={b.error}>
                  {t("planCalendar.calendarUnavailable")}
                </Text>
              )
              : null}
            {conflicts.length
              ? (
                <View style={[b.hint, { backgroundColor: "#FFF2E4" }]}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={b.bold}>{t("planCalendar.overlapTitle")}</Text>
                    {conflicts.map((c) => (
                      <Text key={c.day} style={b.copy}>
                        {t("repeatCalendar.day", { n: c.day })}:{" "}
                        {c.titles.join(", ")}
                      </Text>
                    ))}
                    <Text style={b.muted}>{t("planCalendar.overlapBody")}</Text>
                  </View>
                </View>
              )
              : null}
            <SatinButton
              title={t("repeatCalendar.apply", { count: items.value.length })}
              busy={send.isPending}
              disabled={!ready || items.error}
              onPress={() => send.mutate()}
            />
            <Button
              variant="ghost"
              title={t("planCalendar.edit")}
              disabled={send.isPending}
              onPress={() => setPreview(false)}
            />
          </BuilderCard>
        )
        : (
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            <View style={{ flex: 1 }}>
              <BuilderCard title={t("repeatCalendar.chooseQuestions")}>
                <Text style={b.muted}>{t("repeatCalendar.criteria")}</Text>
                {source.questions.map((q) => (
                  <View key={q.id} style={{ gap: 5, paddingBottom: 10 }}>
                    <BuilderChoice
                      label={`${
                        t("prova.ai.questionN", { n: q.position })
                      } · ${q.subject} · ${t("repeatCalendar." + q.state)}`}
                      selected={selected.includes(q.id)}
                      onPress={() =>
                        setSelected((old) =>
                          old.includes(q.id)
                            ? old.filter((id) =>
                              id !== q.id
                            )
                            : [...old, q.id]
                        )}
                    />
                    <Text numberOfLines={3} style={b.copy}>{q.stem}</Text>
                    <Button
                      variant="ghost"
                      title={t("repeatCalendar.inspect")}
                      onPress={() =>
                        router.push({
                          pathname: "/parent/prova/review/[attemptId]",
                          params: {
                            attemptId: source.attempt_id,
                            questionId: q.id,
                          },
                        })}
                    />
                  </View>
                ))}
              </BuilderCard>
            </View>
            <View style={{ flex: 1 }}>
              <BuilderCard title={t("repeatCalendar.chooseDays")}>
                <Text style={b.muted}>{t("repeatCalendar.daysHint")}</Text>
                <Text style={b.muted}>
                  {t("planCalendar.timezone", { zone: source.timezone })}
                </Text>
                {rows.map((r) => (
                  <View
                    key={r.day}
                    style={{
                      gap: 10,
                      borderBottomWidth: 1,
                      borderColor: p.line,
                      paddingBottom: 14,
                    }}
                  >
                    <BuilderChoice
                      label={`${t("repeatCalendar.day", { n: r.day })} · ${
                        dateLabel(r.date)
                      } · ${r.time}`}
                      selected={r.selected}
                      onPress={() => edit(r.day, { selected: !r.selected })}
                    />
                    <Button
                      variant="ghost"
                      title={t(
                        editing === r.day
                          ? "repeatCalendar.closeEdit"
                          : "repeatCalendar.editDay",
                      )}
                      onPress={() =>
                        setEditing(editing === r.day ? null : r.day)}
                    />
                    {editing === r.day
                      ? (
                        <View style={{ gap: 12 }}>
                          <Field
                            label={t("repeatCalendar.date")}
                            value={r.date}
                            onChangeText={(date) => edit(r.day, { date })}
                            placeholder="YYYY-MM-DD"
                          />
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            {["16:00", "17:00", "18:00", "19:00"].map(
                              (time) => (
                                <BuilderChoice
                                  key={time}
                                  label={time}
                                  selected={r.time === time}
                                  onPress={() => edit(r.day, { time })}
                                />
                              ),
                            )}
                          </View>
                          <Field
                            label={t("repeatCalendar.time")}
                            value={r.time}
                            onChangeText={(time) => edit(r.day, { time })}
                            placeholder="17:00"
                          />
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {[10, 15, 20, 30].map((minutes) => (
                              <BuilderChoice
                                key={minutes}
                                label={t("prova.ai.minutes", {
                                  count: minutes,
                                })}
                                selected={r.minutes === minutes}
                                onPress={() => edit(r.day, { minutes })}
                              />
                            ))}
                          </View>
                          <Field
                            label={t("repeatCalendar.label")}
                            value={r.title}
                            maxLength={120}
                            onChangeText={(title) => edit(r.day, { title })}
                          />
                          <Field
                            label={t("repeatCalendar.notes")}
                            value={r.notes}
                            maxLength={1200}
                            multiline
                            onChangeText={(notes) => edit(r.day, { notes })}
                          />
                        </View>
                      )
                      : null}
                  </View>
                ))}
              </BuilderCard>
            </View>
          </View>
        )}
      {!preview
        ? (
          <SatinButton
            title={t("repeatCalendar.preview")}
            disabled={!selected.length || items.error}
            onPress={() => {
              setError("");
              setPreview(true);
            }}
          />
        )
        : null}
      {(!ready || error)
        ? (
          <Button
            variant="ghost"
            title={t("common.retry")}
            disabled={send.isPending}
            onPress={() => {
              void events.refetch();
              void exceptions.refetch();
              void onRefresh();
            }}
          />
        )
        : null}
    </View>
  );
}
