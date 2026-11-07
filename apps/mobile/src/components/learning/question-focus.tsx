import { useFutureLearningReady } from "@/lib/future-learning";
import { useRef, useState } from "react";
import { randomUUID } from "expo-crypto";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { supabase } from "@/lib/supabase";
import { useFamilyTimezone } from "@/lib/family";
import { useSession } from "@/lib/session";

const modes = ["week", "attempts", "event"] as const;
type Mode = typeof modes[number];
type Focus = {
  child_id: string;
  expires_at: string;
  duration_mode?: Mode;
  attempts_left?: number | null;
};

export function QuestionFocus({ questionId, grade }: { questionId: string; grade: number }) {
  const ready = useFutureLearningReady("daily_practice");
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const family = claims?.family_id;
  const timeZone = useFamilyTimezone();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<Mode>("week");
  const [eventId, setEventId] = useState<string | null>(null);
  const cache = useQueryClient();
  const requests = useRef(new Map<string, string>());
  const key = ["question_focus", family, questionId];
  const state = useQuery({
    queryKey: key,
    enabled: ready && expanded && !!family,
    queryFn: async () => {
      const scope = () => supabase.from("question_focus").select("child_id,expires_at,duration_mode,attempts_left")
        .eq("question_id", questionId).eq("family_id", family!);
      const [children, focus] = await Promise.all([
        supabase.from("children").select("id,name").eq("family_id", family!).is("archived_at", null).eq("grade", grade).order("sort_order"),
        scope(),
      ]);
      if (children.error) throw children.error;
      if (focus.error?.code === "42703") {
        const legacy = await supabase.from("question_focus").select("child_id,expires_at")
          .eq("question_id", questionId).eq("family_id", family!);
        if (legacy.error) throw legacy.error;
        return { children: children.data, focus: legacy.data as Focus[], supportsWindows: false };
      }
      if (focus.error) throw focus.error;
      return { children: children.data, focus: focus.data as Focus[], supportsWindows: true };
    },
  });
  const events = useQuery({
    queryKey: ["question_focus_events", family],
    enabled: expanded && mode === "event" && !!family && state.data?.supportsWindows === true,
    queryFn: async () => {
      const result = await supabase.from("events").select("id,title,starts_at,child_id,all_day")
        .eq("family_id", family!).eq("type", "exam").is("rrule", null).is("archived_at", null)
        .gt("starts_at", new Date().toISOString()).order("starts_at").limit(30);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const save = useMutation({
    mutationFn: async ({ id, selected, request }: { id: string; selected: boolean; request: string }) => {
      const { error } = selected && state.data?.supportsWindows
        ? await supabase.rpc("set_question_focus_window", {
          p_request: request, p_child: id, p_question: questionId, p_mode: mode,
          ...(mode === "event" && eventId ? { p_event: eventId } : {}),
        })
        : await supabase.rpc("set_question_focus", { p_child_id: id, p_question_id: questionId, p_selected: selected });
      if (error) throw error;
    },
    onSuccess: async (_data, { id, selected }) => {
      if (selected) requests.current.delete(`${id}:${mode}:${mode === "event" ? eventId : ""}`);
      await Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: ["reinforcement_suggestions", family] }),
      ]);
    },
  });
  if (!ready) return null;
  const selectedEvent = events.data?.find((event) => event.id === eventId);
  const eligibleEvents = events.data?.filter((event) =>
    !event.child_id || state.data?.children.some((child) => child.id === event.child_id)
  );
  return <View style={{ gap: 8 }}>
    <Button variant="ghost" title={t("reinforcement.focus")} onPress={() => setExpanded(!expanded)} accessibilityState={{ expanded }} />
    {expanded ? <View style={{ gap: 8 }}>
      <Text>{t(state.data?.supportsWindows ? "reinforcement.windowHelp" : "reinforcement.focusHelp")}</Text>
      {state.data?.supportsWindows && state.data.children.length > 0 ? <>
        {modes.map((choice) => <Button key={choice} variant={mode === choice ? "primary" : "secondary"}
          title={t(`reinforcement.window.${choice}`)} accessibilityState={{ selected: mode === choice }}
          disabled={save.isPending} onPress={() => setMode(choice)} />)}
        {mode === "event" ? <>
          {events.isPending ? <Text>{t("common.loading")}</Text> : null}
          {eligibleEvents?.length === 0 ? <Text>{t("reinforcement.noFocusEvents")}</Text> : null}
          {eligibleEvents?.map((event) => <Button key={event.id} variant={event.id === eventId ? "primary" : "secondary"}
            accessibilityState={{ selected: event.id === eventId }} disabled={save.isPending}
            title={`${event.title} · ${new Intl.DateTimeFormat(i18n.language, { timeZone, dateStyle: "medium", ...(event.all_day ? {} : { timeStyle: "short" }) }).format(new Date(event.starts_at))}`}
            onPress={() => setEventId(event.id)} />)}
        </> : null}
      </> : null}
      {state.data?.children.length === 0 ? <Text>{t("reinforcement.noMatchingChild")}</Text> : null}
      {state.data?.children.map((child) => {
        const active = state.data.focus.find((row) => row.child_id === child.id &&
          (row.duration_mode === "attempts" ? (row.attempts_left ?? 0) > 0 : Date.parse(row.expires_at) > Date.now()));
        const unavailable = !active && mode === "event" && (!selectedEvent || !!selectedEvent.child_id && selectedEvent.child_id !== child.id);
        return <View key={child.id} style={{ gap: 4 }}>
          <Toggle label={child.name} value={!!active} disabled={save.isPending || unavailable}
            onChange={(selected) => {
              const intent = `${child.id}:${mode}:${mode === "event" ? eventId : ""}`;
              const request = requests.current.get(intent) ?? randomUUID();
              if (selected) requests.current.set(intent, request);
              save.mutate({ id: child.id, selected, request });
            }} />
          {active?.duration_mode === "attempts"
            ? <Text>{t("reinforcement.focusAttemptsLeft", { count: active.attempts_left ?? 0 })}</Text> : null}
        </View>;
      })}
      {state.error || events.error || save.error ? <Text accessibilityRole="alert">{t("questionLikes.error")}</Text> : null}
    </View> : null}
  </View>;
}
