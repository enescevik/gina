import { useQuery } from "@tanstack/react-query";
import { outcomeObservationsSchema, practiceDifficultySuggestion, type ProvaDraft } from "@gina/core";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useFutureLearningReady } from "@/lib/future-learning";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { b } from "./prova-builder-ui";

type Difficulty = ProvaDraft["difficulty"];

export function PracticeDifficultyHint({ draft, onAccept }: {
  draft: ProvaDraft;
  onAccept: (difficulty: Difficulty) => void;
}) {
  const { t } = useTranslation();
  const { claims } = useSession();
  const ready = useFutureLearningReady();
  const childId = draft.childId;
  const grade = draft.grade;
  const subject = draft.subjects.length === 1 ? draft.subjects[0] : undefined;
  const period = draft.context?.periodId ?? "all";
  const enabled = ready && draft.purpose === "practice" && draft.context?.track !== "meb_common" &&
    !!claims?.family_id && !!childId && !!grade && !!subject;
  const evidence = useQuery({
    queryKey: ["outcome_observations", claims?.family_id, childId, 30, subject, grade, period],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("learning_outcome_observations", {
        p_child_id: childId!,
        p_days: 30,
        p_subject: subject!,
        p_grade: grade!,
        p_period: period,
      });
      if (error) throw error;
      return outcomeObservationsSchema.parse(data);
    },
  });

  if (!enabled || evidence.error || !evidence.data) return null;
  const suggestion = practiceDifficultySuggestion(evidence.data);
  if (!suggestion || suggestion.difficulty === draft.difficulty) return null;
  const difficulty = t(`prova.difficulty.${suggestion.difficulty}`);

  return (
    <View style={[b.hint, { gap: 8 }]}>
      <Text style={b.muted}>
        {t("practiceDifficulty.evidence", { subject, count: suggestion.scored, difficulty })}
      </Text>
      <Button
        variant="secondary"
        title={t("practiceDifficulty.apply", { difficulty })}
        onPress={() => onAccept(suggestion.difficulty)}
      />
    </View>
  );
}
