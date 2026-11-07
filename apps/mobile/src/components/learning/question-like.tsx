import {useFutureLearningReady} from "@/lib/future-learning";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

/** A quality preference, never a reinforcement instruction or a reward. */
export function QuestionLike({ questionId }: { questionId: string }) {
  const ready=useFutureLearningReady();
  const { t } = useTranslation();
  const { claims, session } = useSession();
  const cache = useQueryClient();
  const family = claims?.family_id;
  const user = session?.user.id;
  const key = ["question_like", family, user, questionId];
  const liked = useQuery({
    queryKey: key,
    enabled: ready && !!family && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("question_reactions")
        .select("question_id").eq("family_id", family!).eq("parent_user_id", user!)
        .eq("question_id", questionId).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  const change = useMutation({
    mutationFn: async () => {
      if (!family || !user || liked.data === undefined) throw new Error("unavailable");
      const result = liked.data
        ? await supabase.from("question_reactions").delete().eq("family_id", family)
          .eq("parent_user_id", user).eq("question_id", questionId)
        : await supabase.from("question_reactions").upsert({family_id: family, parent_user_id: user, question_id: questionId}, { onConflict: "family_id,parent_user_id,question_id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({queryKey:key}),
        cache.invalidateQueries({queryKey:["question_favorites",family,user]}),
        cache.invalidateQueries({queryKey:["booklet_favorites",family,user]}),
      ]);
    },
  });
  if(!ready)return null;
  return <View style={{gap: 6}}>
    <Button variant="ghost" title={t(liked.data ? "questionLikes.remove" : "questionLikes.add")}
      accessibilityState={{selected: liked.data === true}}
      disabled={liked.isPending || !!liked.error} loading={change.isPending}
      onPress={() => change.mutate()} />
    {liked.error || change.error ? <Text accessibilityRole="alert">{t("questionLikes.error")}</Text> : null}
    {liked.error ? <Button variant="ghost" title={t("questionLikes.retry")} onPress={() => void liked.refetch()} /> : null}
  </View>;
}
