import { NOTEBOOK_MODAL_PROPS } from "@/components/learning/notebook-layout";
import { RepeatCalendarOrigin } from "@/components/learning/repeat-calendar-origin";
import { randomUUID } from "expo-crypto";
import { type CalendarCommand, calendarJournal } from "@/lib/calendar-command";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import {
  type EventType,
  eventTypeSchema,
  isCalendarDate,
  isClockTime,
  type IsoWeekday,
  localDateOf,
  parseRrule,
  weeklyRrule,
  zonedIso,
} from "@gina/core";
import type { WeekEvent } from "@/components/calendar/week-list";
import { DateChoice, TimeChoice } from "@/components/ui/date-time-choice";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { IconButton, p, SatinButton, Tag, u } from "./ui";
import type { PlannerChild } from "./timetable-editor";
export function EventEditor({
  event,
  date,
  familyId,
  timeZone,
  initialChildId = null,
  profiles,
  onClose,
}: {
  event: WeekEvent | null;
  date: string;
  familyId: string;
  timeZone: string;
  initialChildId?: string | null;
  profiles: PlannerChild[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const cache = useQueryClient();
  const { session } = useSession();
  const journal = useMemo(
    () => calendarJournal(session?.user.id ?? "", familyId),
    [session?.user.id, familyId],
  );
  const [recovery] = useState(() => {
    try {
      return { command: journal.read(), error: false };
    } catch {
      return { command: null, error: true };
    }
  });
  const [pending, setPending] = useState<CalendarCommand | null>(
    recovery.command,
  );
  const [newId] = useState(randomUUID);
  async function send(command: CalendarCommand) {
    setPending(command);
    try {
      return await journal.send(command);
    } finally {
      setPending(journal.read());
    }
  }
  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["events"] }),
      cache.invalidateQueries({ queryKey: ["child_events"] }),
    ]);
  };
  const handleError = (e: Error) => {
    try {
      setPending(journal.read());
    } catch {
      setError(t("calendarRecovery.storage"));
      return;
    }
    setError(
      t(
        e.message === "invalid"
          ? "calendar.invalidDateTime"
          : e.message === "event_changed"
          ? "calendarRecovery.changed"
          : e.message === "event_archived"
          ? "c01ui.calendar.eventArchived"
          : "planner.saveError",
      ),
    );
    void refresh();
  };
  const time = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
      : "10:00";
  const [title, setTitle] = useState(event?.title ?? "");
  const [kind, setKind] = useState<EventType>(event?.type ?? "activity");
  const [childId, setChildId] = useState<string | null>(
    event ? event.child_id : initialChildId,
  );
  const [startDate, setDate] = useState(
    event ? localDateOf(new Date(event.starts_at), timeZone) : date,
  );
  const [start, setStart] = useState(event ? time(event.starts_at) : "09:00");
  const [end, setEnd] = useState(event ? time(event.ends_at) : "10:00");
  const [location, setLocation] = useState(event?.location ?? "");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [repeat, setRepeat] = useState<IsoWeekday[]>(
    parseRrule(event?.rrule)?.byDay ?? [],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const unsupported = !!event?.rrule &&
    parseRrule(event.rrule)?.freq !== "WEEKLY";
  const [leave, setLeave] = useState(false);
  const signature = JSON.stringify({
    title,
    kind,
    childId,
    startDate,
    start,
    end,
    location,
    allDay,
    repeat,
  });
  const [initial] = useState(signature);
  const requestClose = () => {
    if (busy) return;
    if (pending || recovery.error) {
      onClose();
      return;
    }
    if (signature !== initial) setLeave(true);
    else onClose();
  };
  const save = useMutation({
    mutationFn: async () => {
      if (pending) return send(pending);
      if (recovery.error) throw Error("calendar_storage");
      if (
        !title.trim() ||
        !isCalendarDate(startDate) ||
        (!allDay &&
          (!isClockTime(start) ||
            !isClockTime(end) ||
            (end <= start &&
              (!event?.ends_at ||
                localDateOf(new Date(event.ends_at), timeZone) ===
                  localDateOf(new Date(event.starts_at), timeZone)))))
      ) {
        throw Error("invalid");
      }
      const startsAt = zonedIso(startDate, allDay ? "00:00" : start, timeZone);
      const originalDays = event?.ends_at
        ? Math.max(
          0,
          Math.round(
            (Date.parse(localDateOf(new Date(event.ends_at), timeZone)) -
              Date.parse(localDateOf(new Date(event.starts_at), timeZone))) /
              86400000,
          ),
        )
        : 0;
      const endDate = new Date(Date.parse(startDate) + originalDays * 86400000)
        .toISOString()
        .slice(0, 10);
      const sameRepeat = JSON.stringify([...repeat].sort()) ===
        JSON.stringify([...(parseRrule(event?.rrule)?.byDay ?? [])].sort());
      const values = {
        title: title.trim(),
        type: kind,
        child_id: childId,
        starts_at: startsAt,
        ends_at: allDay
          ? event?.all_day && event.ends_at
            ? zonedIso(endDate, time(event.ends_at), timeZone)
            : null
          : zonedIso(endDate, end, timeZone),
        all_day: allDay,
        location: location.trim() || null,
        rrule: unsupported || sameRepeat
          ? (event?.rrule ?? null)
          : repeat.length
          ? weeklyRrule(repeat, parseRrule(event?.rrule)?.until)
          : null,
      };
      if (event && !event.edit_revision) throw Error("event_changed");
      return send(
        journal.prepare({
          p_event_id: event?.id ?? newId,
          p_revision: event?.edit_revision ?? 0,
          p_values: values,
        }),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["events"] }),
        cache.invalidateQueries({ queryKey: ["child_events"] }),
      ]);
      onClose();
    },
    onError: handleError,
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (!event || !event.edit_revision || pending || recovery.error) {
        throw Error("event_changed");
      }
      return send(
        journal.prepare({
          p_event_id: event.id,
          p_revision: event.edit_revision,
          p_values: null,
        }),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["events"] }),
        cache.invalidateQueries({ queryKey: ["child_events"] }),
      ]);
      onClose();
    },
    onError: handleError,
  });
  // Repeat scope: a weekly series can lose just the selected day (event_exceptions, like the
  // calendar's existing cancelled-occurrence rule) or be deleted as a whole.
  const cancelOccurrence = useMutation({
    mutationFn: async () => {
      if (!event?.rrule || pending || recovery.error) throw Error("event_changed");
      const { error } = await supabase
        .from("event_exceptions")
        .upsert(
          { event_id: event.id, occurrence_date: date, cancelled: true },
          { onConflict: "event_id,occurrence_date" },
        );
      if (error) throw error;
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["event_exceptions"] });
      onClose();
    },
    onError: () => setError(t("dayPlan.occurrenceFailed")),
  });
  // Title suggestions: earlier titles of the same kind in this family (manual events only).
  const suggestions = useMemo(() => {
    if (event) return [];
    const typed = title.trim().toLocaleLowerCase();
    const known = cache.getQueryData<WeekEvent[]>(["events", familyId]) ?? [];
    const seen = new Set<string>();
    return known
      .filter((e) => !e.timetable_entry_key && e.type === kind)
      .map((e) => e.title.trim())
      .filter((v) => {
        const key = v.toLocaleLowerCase();
        if (!v || seen.has(key) || key === typed || (typed && !key.includes(typed))) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [cache, event, familyId, kind, title]);
  const busy = save.isPending || remove.isPending || cancelOccurrence.isPending;
  return (
    <Modal
        {...NOTEBOOK_MODAL_PROPS}
      transparent
      animationType="none"
      onRequestClose={requestClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#20195166",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            maxHeight: "95%",
            maxWidth: 600,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[u.card, { padding: 22, gap: 18 }]}
          >
            <View style={u.row}>
              <Text style={[u.heading, u.fill]}>
                {t(event ? "planner.editEvent" : "planner.addEvent")}
              </Text>
              <IconButton
                label={t("common.cancel")}
                onPress={requestClose}
                disabled={busy}
              >
                <X color={p.ink} />
              </IconButton>
            </View>
            {leave
              ? (
                <View style={u.card}>
                  <Text style={u.heading}>{t("planner.discardTitle")}</Text>
                  <Text style={u.copy}>{t("planner.discardBody")}</Text>
                  <SatinButton
                    title={t("planner.keepEditing")}
                    onPress={() => setLeave(false)}
                  />
                  <SatinButton
                    secondary
                    title={t("planner.discard")}
                    onPress={onClose}
                  />
                </View>
              )
              : null}
            {!pending && !recovery.error && (
              <View pointerEvents={busy ? "none" : "auto"} style={{ gap: 16 }}>
                {event?.notes
                  ? (
                    <View
                      style={{
                        gap: 6,
                        padding: 14,
                        borderRadius: 18,
                        backgroundColor: p.lilac,
                      }}
                    >
                      <Text style={u.bold}>{t("planCalendar.notes")}</Text>
                      <Text style={u.copy}>{event.notes}</Text>
                    </View>
                  )
                  : null}
                {event ? <RepeatCalendarOrigin eventId={event.id} onOpen={onClose} disabled={busy || signature !== initial || !!pending} /> : null}
                <Field
                  label={t("calendar.title")}
                  value={title}
                  maxLength={120}
                  onChangeText={setTitle}
                />
                {suggestions.length ? (
                  <View style={{ gap: 6 }}>
                    <Text style={u.small}>{t("dayPlan.titleSuggestions")}</Text>
                    <View style={[u.row, { flexWrap: "wrap" }]}>
                      {suggestions.map((v) => (
                        <Tag key={v} label={v} selected={false} onPress={() => setTitle(v)} />
                      ))}
                    </View>
                  </View>
                ) : null}
                <View style={[u.row, { flexWrap: "wrap" }]}>
                  {eventTypeSchema.options.map((v) => (
                    <Tag
                      key={v}
                      label={t(`event.type.${v}`)}
                      selected={kind === v}
                      onPress={() => setKind(v)}
                    />
                  ))}
                </View>
                <View style={[u.row, { flexWrap: "wrap" }]}>
                  <Tag
                    label={t("calendar.allFamily")}
                    selected={!childId}
                    onPress={() =>
                      setChildId(null)}
                  />
                  {profiles.map((c) => (
                    <Tag
                      key={c.id}
                      label={c.name}
                      selected={c.id === childId}
                      onPress={() => setChildId(c.id)}
                    />
                  ))}
                </View>
                <DateChoice label={t("experience.dateLabel")} value={startDate} onChange={setDate} today={localDateOf(new Date(), timeZone)} />
                <Toggle
                  label={t("calendar.allDay")}
                  value={allDay}
                  onChange={setAllDay}
                />
                {!allDay
                  ? (
                    <View style={[u.row, { flexWrap: "wrap", alignItems: "flex-start" }]}>
                      <View style={[u.fill, { minWidth: 140 }]}>
                        <TimeChoice label={t("experience.startTime")} value={start} onChange={setStart} />
                      </View>
                      <View style={[u.fill, { minWidth: 140 }]}>
                        <TimeChoice label={t("experience.endTime")} value={end} onChange={setEnd} />
                      </View>
                    </View>
                  )
                  : null}
                <Field
                  label={t("planner.location")}
                  value={location}
                  onChangeText={setLocation}
                  maxLength={180}
                />
                <Text style={u.bold}>{t("calendar.repeatWeekly")}</Text>
                {unsupported
                  ? (
                    <Text style={u.copy}>
                      {t("planner.preserveRecurrence")}
                    </Text>
                  )
                  : (
                    <View style={[u.row, { flexWrap: "wrap" }]}>
                      {([1, 2, 3, 4, 5, 6, 7] as IsoWeekday[]).map((d) => (
                        <Tag
                          key={d}
                          label={t(`weekday.${d}`)}
                          selected={repeat.includes(d)}
                          onPress={() =>
                            setRepeat(
                              repeat.includes(d)
                                ? repeat.filter((v) => v !== d)
                                : [...repeat, d],
                            )}
                        />
                      ))}
                    </View>
                  )}
                {event?.rrule
                  ? <Text style={u.small}>{t("planner.seriesHelp")}</Text>
                  : null}
              </View>
            )}
            {error && !pending
              ? (
                <Text accessibilityRole="alert" style={u.error}>
                  {error}
                </Text>
              )
              : null}
            {pending && (
              <View style={u.card}>
                <Text style={u.bold}>{t("calendarRecovery.pending")}</Text>
                <Text style={u.copy}>
                  {pending.p_values?.title ?? t("calendarRecovery.delete")}
                </Text>
                <Text style={u.small}>{t("calendarRecovery.help")}</Text>
              </View>
            )}
            {recovery.error && (
              <Text accessibilityRole="alert" style={u.error}>
                {t("calendarRecovery.storage")}
              </Text>
            )}
            <SatinButton
              title={t(pending ? "calendarRecovery.retry" : "common.save")}
              busy={save.isPending}
              disabled={busy || recovery.error || (!pending && !title.trim())}
              onPress={() => save.mutate()}
            />
            {event && !pending && !recovery.error
              ? (
                <>
                  {event.rrule ? (
                    <View style={{ gap: 8 }}>
                      <Text style={u.bold}>{t("dayPlan.deleteScopeTitle")}</Text>
                      <Text style={u.small}>
                        {t("dayPlan.occurrenceHelp", {
                          date: new Intl.DateTimeFormat(i18n.language, {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            timeZone: "UTC",
                          }).format(new Date(`${date}T12:00:00Z`)),
                        })}
                      </Text>
                      <SatinButton
                        secondary
                        title={t("dayPlan.deleteOccurrence")}
                        busy={cancelOccurrence.isPending}
                        disabled={busy || signature !== initial}
                        onPress={() => cancelOccurrence.mutate()}
                      />
                    </View>
                  ) : null}
                  <Text style={u.small}>
                    {confirmDelete ? t("planner.deleteHelp") : ""}
                  </Text>
                  <SatinButton
                    secondary
                    title={t(
                      confirmDelete
                        ? "planner.confirmDelete"
                        : event.rrule
                        ? "dayPlan.deleteSeries"
                        : "planner.deleteEvent",
                    )}
                    busy={remove.isPending}
                    disabled={busy}
                    onPress={() =>
                      confirmDelete ? remove.mutate() : setConfirmDelete(true)}
                  />
                </>
              )
              : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
