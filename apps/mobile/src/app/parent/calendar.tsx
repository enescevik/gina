import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import {
  eventTypeSchema,
  isCalendarDate,
  isClockTime,
  localDateOf,
  occurrencesBetween,
  weekDatesOf,
  weeklyRrule,
  zonedIso,
  type EventType,
  type IsoWeekday,
} from "@gina/core";

import { WeekList } from "@/components/calendar/week-list";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, parentStyles } from "@/components/ui/parent-screen";
import { useFamilyTimezone } from "@/lib/family";
import { useFamilyEvents } from "@/lib/use-family-events";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

function shiftWeek(date: string, weeks: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/** Veli takvimi: haftalık liste + etkinlik/ders programı ekleme (haftalık tekrar). */
export default function ParentCalendarScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const timeZone = useFamilyTimezone();
  const today = localDateOf(new Date(), timeZone);
  const queryClient = useQueryClient();

  const [anchor, setAnchor] = useState(today);
  const week = weekDatesOf(anchor);
  const from = week[0] ?? anchor;
  const to = week[6] ?? anchor;

  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("activity");
  const [childId, setChildId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [repeatDays, setRepeatDays] = useState<IsoWeekday[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name, avatar").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { events, exceptions } = useFamilyEvents();

  const addEvent = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !isCalendarDate(date) || !isClockTime(start) || !isClockTime(end) || end <= start) {
        throw new Error(t("calendar.invalidDateTime"));
      }
      const { error } = await supabase.from("events").insert({
        family_id: familyId,
        child_id: childId,
        type,
        title: title.trim(),
        starts_at: zonedIso(date, start, timeZone),
        ends_at: zonedIso(date, end, timeZone),
        rrule: repeatDays.length > 0 ? weeklyRrule(repeatDays) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setRepeatDays([]);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["events", familyId] });
    },
    onError: (e) => setFormError(e.message),
  });

  const occurrences = occurrencesBetween(events.data ?? [], from, to, timeZone, exceptions.data ?? new Set());

  return (
    <Screen title={t("parent.calendar")} subtitle={t("parentV5.calendarSubtitle")} loading={children.isLoading || events.isLoading || exceptions.isLoading} error={children.error ?? events.error ?? exceptions.error} onRetry={() => { void children.refetch(); void events.refetch(); void exceptions.refetch(); }}>
      <View className="flex-row items-center justify-between">
        <Button variant="ghost" title="‹" accessibilityLabel={t("calendar.previousWeek")} onPress={() => setAnchor(shiftWeek(anchor, -1))} />
        <Pressable accessibilityRole="button" accessibilityLabel={t("calendar.thisWeek")} style={{ minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center" }} onPress={() => setAnchor(today)}>
          <Text className="text-base font-body-bold text-ink">
            {from} – {to}
          </Text>
        </Pressable>
        <Button variant="ghost" title="›" accessibilityLabel={t("calendar.nextWeek")} onPress={() => setAnchor(shiftWeek(anchor, 1))} />
      </View>

      <WeekList week={week} occurrences={occurrences} today={today} timeZone={timeZone} />

      <View style={parentStyles.form}>
        <Text className="text-lg font-body-bold text-ink">{t("calendar.newEvent")}</Text>
        <Field label={t("calendar.title")} value={title} onChangeText={setTitle} />
        <View className="flex-row flex-wrap gap-2">
          {eventTypeSchema.options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: type === option }}
              onPress={() => setType(option)}
              className={`min-h-12 min-w-12 items-center justify-center rounded-full px-3 py-2 ${type === option ? "bg-teal-dark" : "bg-white"}`}
            >
              <Text className={type === option ? "font-body-bold text-white" : "font-body text-ink"}>{t(`event.type.${option}`)}</Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Pressable accessibilityRole="button" onPress={() => setChildId(null)} className={`min-h-12 min-w-12 items-center justify-center rounded-full px-3 py-2 ${childId === null ? "bg-teal-dark" : "bg-white"}`}>
            <Text className={childId === null ? "font-body-bold text-white" : "font-body text-ink"}>{t("calendar.allFamily")}</Text>
          </Pressable>
          {children.data?.map((child) => (
            <Pressable
              key={child.id}
              accessibilityRole="button"
              accessibilityState={{ selected: childId === child.id }}
              onPress={() => setChildId(child.id)}
              className={`min-h-12 min-w-12 items-center justify-center rounded-full px-3 py-2 ${childId === child.id ? "bg-teal-dark" : "bg-white"}`}
            >
              <Text className={childId === child.id ? "font-body-bold text-white" : "font-body text-ink"}>{child.name}</Text>
            </Pressable>
          ))}
        </View>
        <Field label={t("calendar.date")} value={date} onChangeText={setDate} placeholder="2026-11-02" autoCapitalize="none" />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label={t("calendar.start")} value={start} onChangeText={setStart} placeholder="09:00" />
          </View>
          <View className="flex-1">
            <Field label={t("calendar.end")} value={end} onChangeText={setEnd} placeholder="10:00" />
          </View>
        </View>
        <Text className="text-sm font-body text-ink">{t("calendar.repeatWeekly")}</Text>
        <View className="flex-row flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected: repeatDays.includes(day) }}
              onPress={() => setRepeatDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))}
              className={`min-h-12 min-w-12 items-center justify-center rounded-full px-3 py-2 ${repeatDays.includes(day) ? "bg-teal-dark" : "bg-white"}`}
            >
              <Text className={repeatDays.includes(day) ? "font-body-bold text-white" : "font-body text-ink"}>{t(`weekday.${day}`)}</Text>
            </Pressable>
          ))}
        </View>
        {formError ? <Text className="font-body text-sm text-danger">{formError}</Text> : null}
        <Button title={t("common.save")} loading={addEvent.isPending} disabled={!title.trim()} onPress={() => addEvent.mutate()} />
      </View>

      <ErrorText error={events.error ?? exceptions.error ?? children.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
