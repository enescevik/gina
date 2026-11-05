import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { BookOpen, GraduationCap, School, Pencil } from "lucide-react-native";
import { isCalendarDate } from "@gina/core";
import { supabase } from "@/lib/supabase";
import { SetupWizard, ChoiceCard } from "@/components/setup/wizard";
import { DateChoice } from "@/components/ui/date-time-choice";
import { NumberChoice } from "@/components/ui/number-choice";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { p, u, SatinButton } from "@/components/planner/ui";

export type EducationPeriod = {
  id: string;
  academic_year: number;
  grade: number | null;
  school: string | null;
  starts_on: string;
  ends_on: string | null;
  reason: string;
  timetable_snapshot: Program | null;
};
type Program = {
  revision: number;
  lessons: {
    id: string;
    title: string;
    day: number;
    start: string;
    end: string;
  }[];
  settings: { start: string; duration: number; break: number };
};
export type EducationState = {
  revision: number;
  today: string;
  current: EducationPeriod | null;
  history: EducationPeriod[];
  corrections: {
    before: EducationPeriod;
    after: EducationPeriod;
    at: string;
  }[];
  timetable: Program;
};
type Action = "initial" | "new_year" | "transfer" | "correct";

export function EducationPeriodWizard({
  child,
  initial,
  onClose,
  onSaved,
  onReload,
}: {
  child: { id: string; name: string; grade: number | null };
  initial: EducationState;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const { t, i18n } = useTranslation();
  const cache = useQueryClient();
  const current = initial.current;
  const [step, setStep] = useState(0);
  const [action, setAction] = useState<Action>(
    current ? "new_year" : "initial",
  );
  const [year, setYear] = useState(
    current ? current.academic_year + 1 : Number(initial.today.slice(0, 4)),
  );
  const [grade, setGrade] = useState<number | null>(
    current?.grade ?? child.grade,
  );
  const [school, setSchool] = useState(current?.school ?? "");
  const [start, setStart] = useState(initial.today);
  const [keep, setKeep] = useState(true);
  const request = useRef({ id: randomUUID(), payload: "" });
  const saving = useRef(false);
  const gradeText = (value: number | null) =>
    value === null
      ? t("education.gradeUnknown")
      : value === 0
        ? t("betaUx.preschool")
        : t("parent.gradeShort", { grade: value });
  const choose = (next: Action) => {
    setAction(next);
    setYear(
      current
        ? current.academic_year + (next === "new_year" ? 1 : 0)
        : Number(initial.today.slice(0, 4)),
    );
    setGrade(current?.grade ?? child.grade);
    setSchool(next === "transfer" ? "" : (current?.school ?? ""));
    setStart(next === "correct" && current ? current.starts_on : initial.today);
    setKeep(true);
  };
  const dateValid =
    isCalendarDate(start) &&
    start <= initial.today &&
    Number(start.slice(0, 4)) >= year &&
    Number(start.slice(0, 4)) <= year + 1 &&
    (!current || action === "correct" || start > current.starts_on) &&
    (action !== "new_year" || !current || year > current.academic_year);
  const schoolValid =
    action !== "transfer" ||
    (!!school.trim() && school.trim() !== current?.school);
  const valid = step === 0 || (dateValid && schoolValid);
  const save = useMutation({
    mutationFn: async () => {
      if (!dateValid || !schoolValid) throw Error("education_invalid");
      const args = {
        p_child_id: child.id,
        p_revision: initial.revision,
        p_action: action,
        p_academic_year: year,
        p_grade: grade,
        p_school: school.trim() || null,
        p_starts_on: start,
        p_timetable_revision: initial.timetable.revision,
        p_keep_timetable: keep,
      };
      const payload = JSON.stringify(args);
      if (request.current.payload && request.current.payload !== payload)
        request.current.id = randomUUID();
      request.current.payload = payload;
      const { error } = await supabase.rpc("change_child_education", {
        ...args,
        p_request_id: request.current.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await cache.invalidateQueries();
      onSaved();
    },
    onSettled: () => {
      saving.current = false;
    },
  });
  const conflict =
    !!save.error &&
    /education_changed|timetable_conflict|education_use_transition/.test(
      save.error.message,
    );
  return (
    <SetupWizard
      title={`${child.name} · ${t("education.title")}`}
      steps={[
        t("education.intent"),
        t("education.details"),
        t("education.program"),
        t("education.review"),
      ]}
      step={step}
      setStep={setStep}
      dirty={step > 0}
      busy={save.isPending}
      valid={valid}
      onClose={onClose}
      saveLabel={t("education.confirm")}
      onSave={() => {
        if (saving.current) return;
        saving.current = true;
        save.mutate();
      }}
      error={
        save.error
          ? t(conflict ? "education.changed" : "education.error")
          : null
      }
    >
      {step === 0 && (
        <>
          <Text style={u.copy}>{t("education.body")}</Text>
          {(current
            ? (["new_year", "transfer", "correct"] as const)
            : (["initial"] as const)
          ).map((kind) => {
            const Icon =
              kind === "transfer"
                ? School
                : kind === "correct"
                  ? Pencil
                  : GraduationCap;
            return (
              <ChoiceCard
                key={kind}
                title={t(`education.${kind}`)}
                body={t(`education.${kind}Body`)}
                art={<Icon color={p.purple} size={28} />}
                selected={action === kind}
                onPress={() => choose(kind)}
              />
            );
          })}
        </>
      )}
      {step === 1 && (
        <>
          {action === "initial" || action === "new_year" ? (
            <NumberChoice
              label={t("education.year")}
              value={year}
              onChange={setYear}
              min={current ? current.academic_year + 1 : 2000}
              max={2100}
              step={1}
              presets={[
                Number(initial.today.slice(0, 4)) - 1,
                Number(initial.today.slice(0, 4)),
                Number(initial.today.slice(0, 4)) + 1,
              ]}
              showHint={false}
            />
          ) : null}
          <Text style={u.bold}>
            {t("education.yearValue", { year, next: year + 1 })}
          </Text>
          <Text style={u.bold}>{t("education.grade")}</Text>
          {action === "transfer" ? (
            <Text style={u.copy}>{gradeText(grade)}</Text>
          ) : (
            <View style={[u.row, { flexWrap: "wrap" }]}>
              {[null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((value) => (
                <Pressable
                  key={String(value)}
                  accessibilityRole="button"
                  accessibilityLabel={gradeText(value)}
                  accessibilityState={{ selected: value === grade }}
                  onPress={() => setGrade(value)}
                  style={{
                    minHeight: 48,
                    minWidth: 48,
                    padding: 12,
                    borderRadius: 16,
                    justifyContent: "center",
                    backgroundColor: value === grade ? p.purple : p.lilac,
                  }}
                >
                  <Text
                    style={[
                      u.bold,
                      { color: value === grade ? "#fff" : p.ink },
                    ]}
                  >
                    {value === null
                      ? t("education.gradeUnknown")
                      : value === 0
                        ? t("betaUx.preschool")
                        : value}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <Field
            label={t(
              action === "transfer"
                ? "education.schoolRequired"
                : "education.school",
            )}
            value={school}
            onChangeText={setSchool}
            maxLength={120}
          />
          <Text style={u.small}>{t("education.schoolHelp")}</Text>
          {action === "correct" ? (
            <Text style={u.copy}>{t("education.correctionHelp")}</Text>
          ) : (
            <DateChoice
              label={t("education.start")}
              value={start}
              onChange={setStart}
              today={initial.today}
              hint={t("education.dateHelp")}
            />
          )}
          {!dateValid && (
            <Text accessibilityRole="alert" style={u.error}>
              {t("education.dateInvalid")}
            </Text>
          )}
          {!schoolValid && (
            <Text style={u.small}>{t("education.transferInvalid")}</Text>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <View style={u.row}>
            <BookOpen color={p.purple} />
            <Text style={[u.bold, u.fill]}>
              {t("education.programCount", {
                count: initial.timetable.lessons.length,
              })}
            </Text>
          </View>
          {action === "initial" || action === "correct" ? (
            <Text style={u.copy}>
              {t(
                action === "initial"
                  ? "education.initialKeep"
                  : "education.correctionHelp",
              )}
            </Text>
          ) : (
            <>
              <ChoiceCard
                title={t("education.keep")}
                body={t("education.keepBody")}
                selected={keep}
                onPress={() => setKeep(true)}
              />
              <ChoiceCard
                title={t("education.clear")}
                body={t("education.clearBody")}
                selected={!keep}
                onPress={() => setKeep(false)}
              />
            </>
          )}
          <View style={[u.card, { backgroundColor: p.mint }]}>
            <Text style={u.copy}>{t("education.preserved")}</Text>
          </View>
        </>
      )}
      {step === 3 && (
        <>
          <Text style={u.heading}>{t(`education.${action}`)}</Text>
          {current && (
            <View
              style={{
                gap: 5,
                borderLeftWidth: 3,
                borderColor: p.line,
                paddingLeft: 16,
              }}
            >
              <Text style={u.small}>{t("education.before")}</Text>
              <Text style={u.bold}>
                {t("education.yearValue", {
                  year: current.academic_year,
                  next: current.academic_year + 1,
                })}{" "}
                · {gradeText(current.grade)}
              </Text>
              <Text style={u.copy}>
                {current.school ?? t("education.schoolUnknown")}
              </Text>
            </View>
          )}
          <View
            style={{
              gap: 5,
              borderLeftWidth: 3,
              borderColor: p.purple,
              paddingLeft: 16,
            }}
          >
            <Text style={u.small}>{t("education.after")}</Text>
            <Text style={u.heading}>
              {t("education.yearValue", { year, next: year + 1 })}
            </Text>
            <Text style={u.bold}>{gradeText(grade)}</Text>
            <Text style={u.copy}>
              {school.trim() || t("education.schoolUnknown")}
            </Text>
            <Text style={u.small}>
              {t("education.start")}:{" "}
              {new Intl.DateTimeFormat(i18n.language, {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(new Date(start + "T12:00:00Z"))}
            </Text>
          </View>
          <View style={[u.card, { backgroundColor: p.lilac }]}>
            <Text style={u.bold}>
              {t(keep ? "education.keep" : "education.clear")}
            </Text>
            <Text style={u.copy}>{t("education.preserved")}</Text>
          </View>
          <Text style={u.small}>{t("education.unknown")}</Text>
        </>
      )}
      {conflict && (
        <SatinButton
          secondary
          title={t("education.reload")}
          onPress={onReload}
        />
      )}
    </SetupWizard>
  );
}

export function ArchivedProgram({ period }: { period: EducationPeriod }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <SatinButton
        secondary
        title={t(open ? "education.hideProgram" : "education.showProgram")}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <Text style={u.bold}>{t("education.archivedProgram")}</Text>
          {!period.timetable_snapshot?.lessons.length ? (
            <Text style={u.copy}>{t("education.noProgram")}</Text>
          ) : (
            [1, 2, 3, 4, 5, 6, 7].map((day) => {
              const lessons = period
                .timetable_snapshot!.lessons.filter((x) => x.day === day)
                .sort((a, b) => a.start.localeCompare(b.start));
              return lessons.length ? (
                <View
                  key={day}
                  style={{
                    gap: 8,
                    borderTopWidth: 1,
                    borderColor: p.line,
                    paddingTop: 12,
                  }}
                >
                  <Text style={u.bold}>{t(`weekday.${day}`)}</Text>
                  {lessons.map((lesson) => (
                    <View
                      key={lesson.id}
                      style={[u.row, { alignItems: "flex-start" }]}
                    >
                      <Text style={[u.small, { width: 110 }]}>
                        {lesson.start}–{lesson.end}
                      </Text>
                      <Text style={[u.copy, u.fill]}>{lesson.title}</Text>
                    </View>
                  ))}
                </View>
              ) : null;
            })
          )}
        </>
      )}
    </View>
  );
}
