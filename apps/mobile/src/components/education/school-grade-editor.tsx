import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  isCalendarDate,
  schoolGradeHistorySchema,
  type SchoolGradeRecord,
} from "@gina/core";
import { SetupWizard } from "@/components/setup/wizard";
import { ReportPicker } from "@/components/learning/learning-progress-view";
import { GuidedField } from "@/components/ui/guided-field";
import { NumberChoice } from "@/components/ui/number-choice";
import { DateChoice } from "@/components/ui/date-time-choice";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/parent-screen";
import { Pressable } from "@/components/ui/pressable";
import { p, u, SatinButton } from "@/components/planner/ui";
import { useFamilyTimezone } from "@/lib/family";
import { localDateOf } from "@gina/core";
import { supabase } from "@/lib/supabase";

const kinds = ["exam", "homework", "project", "oral", "performance"] as const;
export function SchoolGradeEditor({
  row,
  childId,
  childName,
  familyId,
  readOnly,
  onClose,
  onSaved,
}: {
  row: SchoolGradeRecord;
  childId: string;
  childName: string;
  familyId: string;
  readOnly: boolean;
  onClose: () => void;
  onSaved: (action: string) => void;
}) {
  const { t, i18n } = useTranslation(),
    cache = useQueryClient(),
    timezone = useFamilyTimezone();
  const [step, setStep] = useState(0),
    [action, setAction] = useState("save");
  const [subject, setSubject] = useState(row.subject),
    [kind, setKind] = useState(row.kind);
  const [score, setScore] = useState(row.score),
    [maxScore, setMaxScore] = useState(row.max_score);
  const [date, setDate] = useState(row.graded_on),
    [note, setNote] = useState(row.note ?? "");
  const request = useRef<{ signature: string; id: string } | null>(null);
  const modified =
    subject.trim() !== row.subject ||
    kind !== row.kind ||
    score !== row.score ||
    maxScore !== row.max_score ||
    date !== row.graded_on ||
    note.trim() !== (row.note ?? "");
  const editable = !readOnly && !row.withdrawn_at;
  const valid =
    !readOnly &&
    (action !== "save" ||
      (editable &&
        modified &&
        subject.trim().length > 0 &&
        score >= 0 &&
        score <= maxScore &&
        maxScore > 0 &&
        isCalendarDate(date) &&
        date <= localDateOf(new Date(), timezone)));
  const history = useInfiniteQuery({
    queryKey: ["school_grade_history", familyId, row.id],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("school_grade_history", {
        p_id: row.id,
        ...(pageParam ? { p_before_revision: pageParam } : {}),
      });
      if (error) throw error;
      return schoolGradeHistorySchema.parse(data);
    },
    getNextPageParam: (last) =>
      last.has_more ? last.rows.at(-1)?.revision : undefined,
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!valid) throw Error("school_grade_invalid");
      const payload = {
        p_id: row.id,
        p_child_id: childId,
        p_revision: row.revision,
        p_action: action,
        p_value:
          action === "save"
            ? {
                subject: subject.trim(),
                kind,
                score,
                max_score: maxScore,
                graded_on: date,
                note: note.trim(),
              }
            : {},
      };
      const signature = JSON.stringify(payload);
      if (request.current?.signature !== signature)
        request.current = { signature, id: randomUUID() };
      const { error } = await supabase.rpc("change_school_grade", {
        ...payload,
        p_request_id: request.current.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["grades", familyId] }),
        cache.invalidateQueries({
          queryKey: ["school_grade_history", familyId, row.id],
        }),
      ]);
      onSaved(action);
    },
  });
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value.slice(0, 10) + "T12:00:00Z"));
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(
      value,
    );
  const summary = (
    value: Pick<
      SchoolGradeRecord,
      "subject" | "score" | "max_score" | "graded_on" | "kind" | "note"
    >,
  ) => (
    <View style={{ gap: 6 }}>
      <Text style={u.heading}>
        {value.subject} · {number(value.score)} / {number(value.max_score)}
      </Text>
      <Text style={u.copy}>
        {t(`grade.kind.${value.kind}`)} · {formatDate(value.graded_on)}
      </Text>
      {!!value.note && <Text style={u.copy}>{value.note}</Text>}
    </View>
  );
  return (
    <SetupWizard
      title={`${childName} · ${t("schoolScores.title")}`}
      steps={[t("schoolScores.details"), t("schoolScores.review")]}
      step={step}
      setStep={(n) => {
        setStep(n);
        if (n === 0) setAction("save");
      }}
      dirty={modified || action !== "save"}
      busy={save.isPending}
      valid={valid}
      hideContinue={step === 0 && !editable}
      onSave={() => save.mutate()}
      onClose={onClose}
      saveLabel={t(
        action === "withdraw"
          ? "schoolScores.withdraw"
          : action === "restore"
            ? "schoolScores.restore"
            : "schoolScores.save",
      )}
      error={
        save.error
          ? t(
              save.error.message.includes("school_grade_changed")
                ? "schoolScores.changed"
                : save.error.message.includes("school_grade_period_change")
                  ? "schoolScores.periodChange"
                  : save.error.message.includes("child_archived")
                    ? "childArchive.locked"
                    : "schoolScores.failed",
            )
          : null
      }
    >
      {step === 0 ? (
        <>
          <Text style={u.copy}>{t("schoolScores.historyHelp")}</Text>
          {editable ? (
            <>
              <GuidedField
                childId={childId}
                kind="subject"
                label={t("grades.subject")}
                value={subject}
                onChange={setSubject}
                disabled={save.isPending}
              />
              <ReportPicker
                label={t("schoolScores.kind")}
                value={kind}
                options={kinds.map((value) => ({
                  value,
                  label: t(`grade.kind.${value}`),
                }))}
                onChange={setKind}
              />
              <NumberChoice
                label={t("grades.score")}
                value={score}
                onChange={setScore}
                min={0}
                max={maxScore}
                step={1}
                precision={2}
                presets={[0, 50, 75, 85, 90, 100]}
              />
              <NumberChoice
                label={t("grades.maxScore")}
                value={maxScore}
                onChange={setMaxScore}
                min={1}
                max={9999}
                step={1}
                precision={2}
                presets={[5, 10, 20, 100]}
              />
              {score > maxScore && (
                <Text accessibilityRole="alert" style={u.error}>
                  {t("grades.invalid")}
                </Text>
              )}
              <DateChoice
                label={t("experience.dateLabel")}
                value={date}
                onChange={setDate}
                today={localDateOf(new Date(), timezone)}
                hint={t("schoolScores.dateHelp")}
              />
              <Field
                label={t("schoolScores.note")}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={2000}
              />
            </>
          ) : (
            summary(row)
          )}
          {readOnly && <Text style={u.copy}>{t("childArchive.locked")}</Text>}
          <FormSection title={t("schoolScores.history")}>
            {history.isPending ? (
              <Text style={u.copy}>{t("release.loading")}</Text>
            ) : history.error ? (
              <SatinButton
                title={t("common.retry")}
                onPress={() => void history.refetch()}
              />
            ) : (
              <>
                {history.data?.pages
                  .flatMap((page) => page.rows)
                  .map((change) => (
                    <View
                      key={change.revision}
                      style={[u.card, { backgroundColor: p.cream }]}
                    >
                      <Text style={u.bold}>
                        {t(`schoolScores.action.${change.action}`)} ·{" "}
                        {formatDate(change.created_at)}
                      </Text>
                      {change.before_value && (
                        <>
                          <Text style={u.small}>{t("education.before")}</Text>
                          {summary(change.before_value)}
                        </>
                      )}
                      <Text style={u.small}>{t("education.after")}</Text>
                      {summary(change.after_value)}
                    </View>
                  ))}
                {!history.data?.pages[0]?.rows.length && (
                  <Text style={u.copy}>{t("schoolScores.noHistory")}</Text>
                )}
                {history.hasNextPage && (
                  <SatinButton
                    secondary
                    title={t("schoolScores.older")}
                    busy={history.isFetchingNextPage}
                    onPress={() => void history.fetchNextPage()}
                  />
                )}
              </>
            )}
          </FormSection>
          {!readOnly && (
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: "center" }}
              onPress={() => {
                setAction(row.withdrawn_at ? "restore" : "withdraw");
                setStep(1);
              }}
            >
              <Text
                style={[
                  u.bold,
                  { color: row.withdrawn_at ? p.purple : "#A43135" },
                ]}
              >
                {t(
                  row.withdrawn_at
                    ? "schoolScores.restore"
                    : "schoolScores.withdraw",
                )}
              </Text>
            </Pressable>
          )}
        </>
      ) : (
        <>
          <Text style={u.copy}>
            {t(
              action === "save"
                ? "schoolScores.reviewHelp"
                : action === "withdraw"
                  ? "schoolScores.withdrawHelp"
                  : "schoolScores.restoreHelp",
            )}
          </Text>
          {action !== "save" && modified && (
            <Text style={u.copy}>{t("schoolScores.unsavedIgnored")}</Text>
          )}
          <View style={u.card}>
            <Text style={u.small}>{t("education.before")}</Text>
            {summary(row)}
          </View>
          {action === "save" && (
            <View style={[u.card, { backgroundColor: p.mint }]}>
              <Text style={u.small}>{t("education.after")}</Text>
              {summary({
                subject,
                kind,
                score,
                max_score: maxScore,
                graded_on: date,
                note,
              })}
            </View>
          )}
          <Text style={u.copy}>{t("schoolScores.contextPreserved")}</Text>
        </>
      )}
    </SetupWizard>
  );
}
