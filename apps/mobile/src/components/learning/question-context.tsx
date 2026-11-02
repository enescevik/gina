import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { p } from "@/components/planner/ui";

export interface QuestionContextItem {
  question_id: string;
  group_id: string;
  version: number;
  title: string;
  body: string;
  prompt: string;
  position: number;
}

export function useQuestionContext(questionId: string) {
  const { claims } = useSession();
  return useQuery({
    queryKey: [
      "question_context",
      claims?.family_id,
      claims?.child_id,
      questionId,
    ],
    enabled: !!questionId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_question_context", {
        p_question_ids: [questionId],
      });
      if (error) throw error;
      return (data as unknown as QuestionContextItem[])[0] ?? null;
    },
  });
}

export function SharedContext(
  { context, compact = false }: {
    context: QuestionContextItem;
    compact?: boolean;
  },
) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        backgroundColor: p.lilac,
        borderRadius: 18,
        padding: compact ? 12 : 16,
        gap: 8,
      }}
    >
      <Text
        style={{ fontFamily: "Nunito_700Bold", color: p.purple, fontSize: 14 }}
      >
        {t("sharedQuestions.common")}
      </Text>
      <Text
        style={{
          fontFamily: "Nunito_800ExtraBold",
          color: p.ink,
          fontSize: 18,
        }}
        numberOfLines={compact ? 1 : undefined}
      >
        {context.title}
      </Text>
      {context.body
        ? (
          <Text
            selectable={!compact}
            numberOfLines={compact ? 2 : undefined}
            style={{
              fontFamily: "Nunito_600SemiBold",
              color: p.ink,
              fontSize: 17,
              lineHeight: 25,
            }}
          >
            {context.body}
          </Text>
        )
        : null}
    </View>
  );
}

/** On old servers or a context failure the materialized stem still has ALL text. */
export function ContextualQuestion(
  { questionId, stem }: { questionId: string; stem: string },
) {
  const context = useQuestionContext(questionId);
  return (
    <View style={{ gap: 12 }}>
      {context.data ? <SharedContext context={context.data} /> : null}
      <Text
        selectable
        style={{
          fontFamily: "Nunito_700Bold",
          fontSize: 20,
          lineHeight: 28,
          color: p.ink,
        }}
      >
        {context.data?.prompt ?? stem}
      </Text>
    </View>
  );
}
