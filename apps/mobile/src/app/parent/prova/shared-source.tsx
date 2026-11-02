import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  type SharedGroupDraft,
  SharedQuestionWizard,
} from "@/components/learning/shared-question-wizard";
import type { QuestionMediaItem } from "@/components/learning/question-media";
import { ParentScreen } from "@/components/ui/parent-screen";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function SharedQuestionScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const familyId = claims?.family_id ?? "";
  const policy = useQuery({
    queryKey: ["question_group_policy", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_question_group_policy");
      if (error) throw error;
      return data;
    },
  });
  const groups = useQuery({
    queryKey: ["question_source_groups", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("question_source_groups")
        .select("id,series_id,version,title").order("created_at", {
          ascending: false,
        }).order("version", { ascending: false }).limit(200);
      if (error) throw error;
      const seen = new Set<string>();
      return data.filter((row) => {
        if (seen.has(row.series_id)) return false;
        seen.add(row.series_id);
        return true;
      });
    },
  });
  const initial = useQuery({
    queryKey: ["question_group_editor", familyId, groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<SharedGroupDraft> => {
      const { data: group, error } = await supabase.from(
        "question_source_groups",
      ).select("*").eq("id", groupId!).single();
      if (error) throw error;
      const { data: members, error: memberError } = await supabase.from(
        "question_source_members",
      ).select("question_id,position,prompt").eq("group_id", group.id).order(
        "position",
      );
      if (memberError || !members?.length) {
        throw memberError ?? new Error(t("sharedQuestions.saveFailed"));
      }
      const ids = members.map((m) => m.question_id);
      const [questions, media] = await Promise.all([
        supabase.from("question_bank").select("*").in("id", ids),
        supabase.rpc("get_question_media", { p_question_ids: [ids[0]!] }),
      ]);
      if (questions.error || media.error) throw questions.error ?? media.error;
      return {
        title: group.title,
        body: group.body,
        grade: String(group.grade),
        subject: group.subject,
        previousId: group.id,
        existingImages: media.data as unknown as QuestionMediaItem[],
        questions: members.map((m) => {
          const q = questions.data.find((q) => q.id === m.question_id)!;
          return {
            topic: q.topic,
            kind: q.kind,
            difficulty: q.difficulty,
            stem: m.prompt,
            expected_answer: q.expected_answer ?? "",
            solution: q.solution ?? "",
            correct_key: q.correct_key ?? "A",
            choices: Array.isArray(q.choices)
              ? q.choices as { key: string; text: string }[]
              : ["A", "B", "C", "D"].map((key) => ({ key, text: "" })),
          };
        }),
      };
    },
  });
  const error = policy.error ?? groups.error ?? initial.error;
  if (
    policy.isPending || groups.isPending || (groupId && initial.isPending) ||
    error
  ) {
    return (
      <ParentScreen
        title={t("sharedQuestions.title")}
        loading={!error}
        error={error}
        onRetry={() => {
          void policy.refetch();
          void groups.refetch();
          if (groupId) void initial.refetch();
        }}
      >
        <></>
      </ParentScreen>
    );
  }
  return (
    <SharedQuestionWizard
      key={`${familyId}:${groupId ?? "new"}`}
      familyId={familyId}
      enabled={policy.data === true}
      initial={initial.data}
      catalog={groups.data}
    />
  );
}
