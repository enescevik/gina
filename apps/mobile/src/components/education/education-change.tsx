// C02: a planned (future) education change and the 14-day undo of the last transition (L01/L04).
// Planning never changes today's records; the change is applied on its day (the parent's next open) through
// the same server transition. Undo restores the previous period and, when the program was emptied and not
// refilled, the previous program. Completed tasks, stars, rewards and grades are never rewritten.
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarClock, Undo2 } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { educationChangeStateSchema, type EducationChangeState } from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { p, SatinButton, u } from "@/components/planner/ui";

type LooseRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;

export const educationChangeKey = (family: string, child: string) => ["education_change_state", family, child] as const;

export function useEducationChange(childId: string | undefined) {
  const { claims } = useSession();
  const family = claims?.family_id ?? "";
  const cache = useQueryClient();
  return useQuery({
    queryKey: educationChangeKey(family, childId ?? ""),
    enabled: !!family && !!childId,
    queryFn: async (): Promise<EducationChangeState> => {
      // A planned change whose day has come is applied first (idempotent), then the state is read.
      const applied = await rpc("apply_due_education_changes", { p_child_id: childId });
      if (applied.error) throw applied.error;
      if ((applied.data as { applied?: boolean } | null)?.applied) {
        void cache.invalidateQueries({ queryKey: ["education", family, childId] });
        void cache.invalidateQueries({ queryKey: ["plan_for_days", family] });
        void cache.invalidateQueries({ queryKey: ["plan_for_day", family] });
      }
      const { data, error } = await rpc("education_change_state", { p_child_id: childId });
      if (error) throw error;
      return educationChangeStateSchema.parse(data);
    },
  });
}

export function EducationChangeStatus({ child }: { child: { id: string; name: string; archived_at: string | null } }) {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const family = claims?.family_id ?? "";
  const cache = useQueryClient();
  const state = useEducationChange(child.id);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState("");
  const request = useRef({ id: randomUUID(), key: "" });
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value + "T12:00:00Z"));
  const grade = (value: number | null) =>
    value === null ? t("education.gradeUnknown") : value === 0 ? t("betaUx.preschool") : t("parent.gradeShort", { grade: value });
  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: educationChangeKey(family, child.id) }),
      cache.invalidateQueries({ queryKey: ["education", family, child.id] }),
      cache.invalidateQueries({ queryKey: ["plan_for_days", family] }),
      cache.invalidateQueries({ queryKey: ["plan_for_day", family] }),
      cache.invalidateQueries({ queryKey: ["children"] }),
      cache.invalidateQueries({ queryKey: ["school_timetable", child.id] }),
    ]);
  };
  // One request id per intended action; a lost reply is retried with the same id (same result, no double).
  const requestFor = (key: string) => {
    if (request.current.key !== key) request.current = { id: randomUUID(), key };
    return request.current.id;
  };
  const cancel = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await rpc("cancel_child_education_schedule", {
        p_request_id: requestFor(`cancel:${scheduleId}`),
        p_child_id: child.id,
        p_schedule_id: scheduleId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setDone(t("c02.scheduleCancelled"));
      await refresh();
    },
  });
  const undo = useMutation({
    mutationFn: async (revision: number) => {
      const { data, error } = await rpc("undo_child_education_change", {
        p_request_id: requestFor(`undo:${revision}`),
        p_child_id: child.id,
        p_revision: revision,
      });
      if (error) throw error;
      return data as { timetable_restored: boolean };
    },
    onSuccess: async (r) => {
      setConfirm(false);
      setDone(t(r.timetable_restored ? "c02.undoDoneProgram" : "c02.undoDone"));
      await refresh();
    },
  });
  const s = state.data;
  if (!s || child.archived_at) {
    return state.error ? <Text accessibilityRole="alert" style={u.error}>{t("c02.stateError")}</Text> : null;
  }
  const errorText = (e: Error | null) =>
    !e ? "" : /education_changed/.test(e.message) ? t("c02.changedElsewhere") : /education_undo_transfer/.test(e.message)
      ? t("c02.undoBlocked") : /education_undo_expired/.test(e.message) ? t("c02.undoExpired") : t("c02.actionError");
  return (
    <View style={{ gap: 12 }}>
      {done ? <Text accessibilityLiveRegion="polite" style={[u.bold, { color: "#287460" }]}>{done}</Text> : null}
      {s.scheduled
        ? (
          <View testID="c02-scheduled" style={[u.card, { backgroundColor: p.lilac, gap: 8 }]}>
            <View style={u.row}>
              <CalendarClock color={p.purple} size={24} />
              <Text style={[u.bold, u.fill]}>{t("c02.scheduledTitle", { date: date(s.scheduled.starts_on) })}</Text>
            </View>
            <Text style={u.copy}>
              {t(`education.${s.scheduled.action}`)} · {t("education.yearValue", { year: s.scheduled.academic_year, next: s.scheduled.academic_year + 1 })} · {grade(s.scheduled.grade)}
              {s.scheduled.school ? ` · ${s.scheduled.school}` : ""}
            </Text>
            <Text style={u.small}>{t(s.scheduled.keep_timetable ? "c02.scheduledKeep" : "c02.scheduledClear")}</Text>
            <Text style={u.small}>{t("c02.scheduledHow")}</Text>
            {cancel.error ? <Text accessibilityRole="alert" style={u.error}>{errorText(cancel.error)}</Text> : null}
            <SatinButton secondary title={t("c02.scheduleCancel")} busy={cancel.isPending} onPress={() => cancel.mutate(s.scheduled!.id)} />
          </View>
        )
        : null}
      {s.last_failed && !s.scheduled
        ? (
          <View style={[u.card, { backgroundColor: "#FFF0DB" }]}>
            <Text style={u.bold}>{t("c02.scheduleFailed", { date: date(s.last_failed.starts_on) })}</Text>
            <Text style={u.small}>{t("c02.scheduleFailedHelp")}</Text>
          </View>
        )
        : null}
      {s.undo && !s.undo.expired
        ? (
          <View testID="c02-undo" style={[u.card, { gap: 8 }]}>
            <View style={u.row}>
              <Undo2 color={p.purple} size={24} />
              <Text style={[u.bold, u.fill]}>{t("c02.undoTitle", { date: date(s.undo.until) })}</Text>
            </View>
            <Text style={u.copy}>
              {t("c02.undoBack", {
                year: t("education.yearValue", { year: s.undo.previous.academic_year, next: s.undo.previous.academic_year + 1 }),
                grade: grade(s.undo.previous.grade),
                school: s.undo.previous.school ?? t("education.schoolUnknown"),
              })}
            </Text>
            <Text style={u.small}>{t(s.undo.restores_timetable ? "c02.undoProgram" : "c02.undoNoProgram")}</Text>
            <Text style={u.small}>{t("c02.undoKeeps")}</Text>
            {s.undo.blocked
              ? <Text style={[u.small, { color: "#955623" }]}>{t("c02.undoBlocked")}</Text>
              : confirm
              ? (
                <View style={{ gap: 8 }}>
                  <Text style={u.bold}>{t("c02.undoConfirmQuestion")}</Text>
                  {undo.error ? <Text accessibilityRole="alert" style={u.error}>{errorText(undo.error)}</Text> : null}
                  <SatinButton title={t("c02.undoConfirm")} busy={undo.isPending} onPress={() => undo.mutate(s.revision)} />
                  <SatinButton secondary title={t("common.cancel")} disabled={undo.isPending} onPress={() => setConfirm(false)} />
                </View>
              )
              : <SatinButton secondary title={t("c02.undoAction")} onPress={() => { setDone(""); setConfirm(true); }} />}
          </View>
        )
        : null}
    </View>
  );
}
