import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import {
  isCalendarDate,
  localDateOf,
  schoolGradeRecordsSchema,
  type SchoolGradeRecord,
  type Enums,
} from "@gina/core";

import {
  ReportPeriodFilter,
  useReportPeriods,
} from "@/components/education/report-period-filter";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { SchoolGradeEditor } from "@/components/education/school-grade-editor";
import { IconButton, p } from "@/components/planner/ui";
import { MoreHorizontal } from "lucide-react-native";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { DateChoice } from "@/components/ui/date-time-choice";
import { NumberChoice } from "@/components/ui/number-choice";
import { GuidedField } from "@/components/ui/guided-field";
import { ErrorText } from "@/components/ui/screen";
import {
  ParentScreen as Screen,
  FormSection,
  ChildPicker,
  EmptyCard,
} from "@/components/ui/parent-screen";
import { useFamilyTimezone } from "@/lib/family";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type GradeKind = Enums<"grade_kind">;
const KINDS: GradeKind[] = [
  "exam",
  "homework",
  "project",
  "oral",
  "performance",
];

/** Veli: çocuk başına okul puanları (sınav, ödev, proje …) listesi ve giriş formu. */
export default function ParentGradesScreen() {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();

  const params = useLocalSearchParams<{ childId?: string; period?: string }>();
  const [periodChoice, setPeriodChoice] = useState<{
    child: string;
    period: string;
  } | null>(null);
  const [childId, setChildId] = useState<string | null>(params.childId ?? null);
  const [withdrawn, setWithdrawn] = useState(false);
  const [editing, setEditing] = useState<SchoolGradeRecord | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const addRequest = useRef<{
    signature: string;
    requestId: string;
    id: string;
  } | null>(null);
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<GradeKind>("exam");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const timeZone = useFamilyTimezone();
  const [gradedOn, setGradedOn] = useState(localDateOf(new Date(), timeZone));
  const [formError, setFormError] = useState<string | null>(null);

  const children = useQuery({
    queryKey: ["children_history", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id, name, grade, avatar, archived_at")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const selectedChild = childId ?? children.data?.[0]?.id ?? null;

  const child = children.data?.find((c) => c.id === selectedChild);
  const periods = useReportPeriods(selectedChild);
  const period =
    periodChoice?.child === selectedChild
      ? periodChoice.period
      : ((params.childId === selectedChild ? params.period : undefined) ??
        "all");
  const grades = useInfiniteQuery({
    queryKey: ["grades", familyId, selectedChild, period, withdrawn],
    enabled: !!selectedChild && !!familyId,
    initialPageParam: null as { id: string; date: string } | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("school_grade_records", {
        p_child_id: selectedChild!,
        p_period: period,
        p_withdrawn: withdrawn,
        ...(pageParam
          ? { p_before_id: pageParam.id, p_before_date: pageParam.date }
          : {}),
      });
      if (error) throw error;
      return schoolGradeRecordsSchema.parse(data);
    },
    getNextPageParam: (last) => {
      const row = last.rows.at(-1);
      return last.has_more && row
        ? { id: row.id, date: row.graded_on }
        : undefined;
    },
  });
  const rows = grades.data?.pages.flatMap((page) => page.rows) ?? [];
  useRealtimeInvalidate(
    "school_grade_sync",
    familyId ? `family_id=eq.${familyId}` : null,
    [
      ["grades", familyId],
      ["school_grade_history", familyId],
    ],
  );

  useRealtimeInvalidate(
    "children",
    familyId ? `family_id=eq.${familyId}` : null,
    [
      ["education_report_periods", familyId],
      ["children_history", familyId],
    ],
  );
  const addGrade = useMutation({
    mutationFn: async () => {
      const scoreNum = Number(score.replace(",", "."));
      const maxNum = Number(maxScore.replace(",", "."));
      if (
        !selectedChild ||
        !subject.trim() ||
        !score.trim() ||
        !Number.isFinite(scoreNum) ||
        !Number.isFinite(maxNum) ||
        scoreNum < 0 ||
        scoreNum > maxNum ||
        maxNum <= 0 ||
        !isCalendarDate(gradedOn)
      ) {
        throw new Error(t("grades.invalid"));
      }
      const value = {
        subject: subject.trim(),
        kind,
        score: scoreNum,
        max_score: maxNum,
        graded_on: gradedOn,
      };
      const signature = JSON.stringify({ child: selectedChild, value });
      if (addRequest.current?.signature !== signature)
        addRequest.current = {
          signature,
          requestId: randomUUID(),
          id: addRequest.current?.id ?? randomUUID(),
        };
      const { error } = await supabase.rpc("change_school_grade", {
        p_request_id: addRequest.current.requestId,
        p_id: addRequest.current.id,
        p_child_id: selectedChild,
        p_revision: 0,
        p_action: "save",
        p_value: value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      addRequest.current = null;
      setScore("");
      setSaved("schoolScores.saved");
      setWithdrawn(false);
      if (selectedChild)
        setPeriodChoice({ child: selectedChild, period: "all" });
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["grades", familyId] });
    },
    onError: (error) => {
      setFormError(
        t(
          error.message.includes("school_grade_changed")
            ? "schoolScores.createdCheck"
            : "schoolScores.failed",
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ["grades", familyId] });
    },
  });

  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const numberFormat = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 2,
  });

  return (
    <Screen
      title={t("parent.grades")}
      subtitle={t("unified.gradesHelp")}
      loading={children.isLoading || grades.isLoading || periods.isLoading}
      error={children.error ?? periods.error ?? grades.error}
      onRetry={() => {
        void children.refetch();
        void periods.refetch();
        if (selectedChild) void grades.refetch();
      }}
    >
      <ChildPicker
        profiles={children.data ?? []}
        selected={selectedChild}
        onSelect={(id) => {
          setChildId(id);
          if (id) setPeriodChoice({ child: id, period: "all" });
        }}
      />

      {selectedChild && !child?.archived_at ? (
        <FormSection title={t("grades.new")}>
          <GuidedField
            childId={selectedChild}
            kind="subject"
            label={t("grades.subject")}
            value={subject}
            onChange={setSubject}
            disabled={addGrade.isPending}
          />
          <View className="flex-row flex-wrap gap-2">
            {KINDS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: kind === option }} aria-pressed={kind === option}
                onPress={() => setKind(option)}
                className={`min-h-12 items-center justify-center rounded-full px-3 py-2 ${kind === option ? "bg-teal-dark border border-teal-dark" : "bg-white border border-[#A89BD4]"}`}
              >
                <Text
                  className={
                    kind === option
                      ? "font-body-bold text-white"
                      : "font-body text-ink"
                  }
                >
                  {t(`grade.kind.${option}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <NumberChoice
            label={t("grades.score")}
            value={score === "" ? null : Number(score)}
            onChange={(n) => setScore(String(n))}
            min={0}
            max={Number(maxScore)}
            step={1}
            precision={2}
            presets={[0, 25, 50, 75, 85, 90, 100]}
            disabled={addGrade.isPending}
          />
          <NumberChoice
            label={t("grades.maxScore")}
            value={Number(maxScore)}
            onChange={(n) => setMaxScore(String(n))}
            min={1}
            max={9999}
            step={1}
            precision={2}
            presets={[5, 10, 20, 100]}
            disabled={addGrade.isPending}
          />
          {score !== "" && Number(score) > Number(maxScore) ? (
            <Text accessibilityRole="alert" className="font-body text-danger">
              {t("grades.invalid")}
            </Text>
          ) : null}
          <DateChoice
            label={t("experience.dateLabel")}
            value={gradedOn}
            onChange={setGradedOn}
            today={localDateOf(new Date(), timeZone)}
            disabled={addGrade.isPending}
          />
          {formError ? (
            <Text className="font-body text-sm text-danger">{formError}</Text>
          ) : null}
          <Button
            title={t("common.save")}
            loading={addGrade.isPending}
            disabled={
              !subject.trim() ||
              !score.trim() ||
              Number(score) > Number(maxScore)
            }
            onPress={() => addGrade.mutate()}
          />
        </FormSection>
      ) : child?.archived_at ? (
        <Text className="font-body text-ink">{t("childArchive.locked")}</Text>
      ) : (
        <EmptyCard
          title={t("unified.chooseChild")}
          body={t("unified.noChildHelp")}
        >
          <Button
            title={t("unified.createFirstChild")}
            onPress={() => router.push("/parent/menu")}
          />
        </EmptyCard>
      )}

      {saved && (
        <Text
          accessibilityLiveRegion="polite"
          className="font-body-bold text-teal-dark"
        >
          {t(saved)}
        </Text>
      )}
      <View className="flex-row flex-wrap gap-3">
        {[false, true].map((value) => (
          <Pressable
            key={String(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: withdrawn === value }}
            aria-pressed={withdrawn === value}
            onPress={() => setWithdrawn(value)}
            style={{
              minHeight: 48,
              padding: 12,
              borderRadius: 16,
              backgroundColor: withdrawn === value ? p.lilac : p.cream,
            }}
          >
            <Text className="font-body-bold text-ink">
              {t(value ? "schoolScores.withdrawn" : "schoolScores.active")}
            </Text>
          </Pressable>
        ))}
      </View>
      {selectedChild && (
        <ReportPeriodFilter
          key={selectedChild}
          value={period}
          periods={periods.data ?? []}
          onChange={(value) =>
            setPeriodChoice({ child: selectedChild, period: value })
          }
        />
      )}
      {selectedChild &&
      !grades.isPending &&
      !grades.error &&
      rows.length === 0 ? (
        <EmptyCard
          title={t(
            withdrawn
              ? "schoolScores.noWithdrawn"
              : "educationReports.noGrades",
          )}
          body={withdrawn ? undefined : t("educationReports.noGradesBody")}
          slug="display-bookworm"
        />
      ) : null}
      {rows.map((grade) => (
        <View
          key={grade.id}
          className="flex-row items-center gap-3 rounded-parent border border-mist p-3"
        >
          <SubjectIcon
            subject={grade.subject}
            size={48}
            variant="illustrated"
          />
          <View className="flex-1 min-w-0">
            <Text className="text-base font-body-bold text-ink">
              {grade.subject}
            </Text>
            <Text className="font-body text-xs text-gray-500">
              {t(`grade.kind.${grade.kind}`)} ·{" "}
              {dateFormat.format(new Date(`${grade.graded_on}T00:00:00Z`))}
            </Text>
            <Text className="font-body text-xs text-gray-500">
              {grade.education_context
                ? `${grade.education_context.academic_year}–${grade.education_context.academic_year + 1}${grade.education_context.grade === null ? "" : ` · ${grade.education_context.grade === 0 ? t("betaUx.preschool") : t("parent.gradeShort", { grade: grade.education_context.grade })}`}${grade.education_context.school ? ` · ${grade.education_context.school}` : ""}`
                : t("educationReports.unknown")}
            </Text>
          </View>
          <Text className="text-xl font-body-bold text-ink">
            {numberFormat.format(Number(grade.score))}
            <Text className="text-sm font-body text-gray-500">
              {" "}
              / {numberFormat.format(Number(grade.max_score))}
            </Text>
          </Text>
          <IconButton
            label={t("schoolScores.inspect", { subject: grade.subject })}
            onPress={() => setEditing(grade)}
          >
            <MoreHorizontal size={22} color={p.purple} />
          </IconButton>
        </View>
      ))}

      {grades.hasNextPage && (
        <Button
          variant="ghost"
          title={t("educationReports.more")}
          loading={grades.isFetchingNextPage}
          onPress={() => void grades.fetchNextPage()}
        />
      )}
      {editing && child && (
        <SchoolGradeEditor
          key={editing.id}
          row={editing}
          childId={child.id}
          childName={child.name}
          familyId={familyId}
          readOnly={!!child.archived_at}
          onClose={() => setEditing(null)}
          onSaved={(action) => {
            setEditing(null);
            setSaved(
              action === "save"
                ? "schoolScores.saved"
                : `schoolScores.action.${action}`,
            );
          }}
        />
      )}
      <ErrorText error={children.error ?? periods.error ?? grades.error} />
      <Button
        variant="ghost"
        title={t("parent.home")}
        onPress={() => router.navigate("/parent")}
      />
    </Screen>
  );
}
