import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { QuestionLike } from "@/components/learning/question-like";
import { ParentScreen, EmptyCard, parentStyles } from "@/components/ui/parent-screen";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

export default function FavoriteQuestions() {
  const { t } = useTranslation();
  const { claims, session } = useSession();
  const family = claims?.family_id;
  const user = session?.user.id;
  const favorites = useInfiniteQuery({
    queryKey: ["question_favorites", family, user],
    initialPageParam: 0,
    enabled: !!family && !!user,
    queryFn: async ({pageParam}) => {
      const {data, error} = await supabase.from("question_reactions")
        .select("question_id,created_at,question_bank(id,stem,subject,topic,grade)")
        .eq("family_id",family!).eq("parent_user_id",user!)
        .order("created_at",{ascending:false}).order("question_id")
        .range(pageParam,pageParam+29);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) => last.length === 30 ? pages.length*30 : undefined,
  });
  const rows = favorites.data?.pages.flat() ?? [];
  return <ParentScreen title={t("questionLikes.title")} subtitle={t("questionLikes.body")}
    loading={favorites.isPending} error={favorites.error} onRetry={() => void favorites.refetch()}>
    {!rows.length && !favorites.isPending && !favorites.error ? <EmptyCard title={t("questionLikes.empty")} slug="display-bookworm" /> : null}
    {rows.map(row => row.question_bank ? <View key={row.question_id} style={[parentStyles.card,{gap:12}]}>
      <Text style={parentStyles.muted}>{row.question_bank.subject} · {row.question_bank.topic}</Text>
      <Text style={parentStyles.copy}>{row.question_bank.stem}</Text>
      <QuestionLike questionId={row.question_id} />
    </View> : null)}
    {favorites.hasNextPage ? <Button variant="secondary" title={t("questionLikes.more")}
      loading={favorites.isFetchingNextPage} onPress={() => void favorites.fetchNextPage()} /> : null}
  </ParentScreen>;
}
