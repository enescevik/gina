import { router, useLocalSearchParams } from "expo-router";
import { addToProvaDraft, fetchProvaDrafts } from "@/lib/prova-draft";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { BookOpen } from "lucide-react-native";
import {
  EmptyCard,
  NavigationCard,
  ParentScreen,
  parentStyles,
} from "@/components/ui/parent-screen";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { supabase } from "@/lib/supabase";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
interface Collection {
  id: string;
  title: string;
  description: string;
  grade: number;
  subject: string;
  curriculum_version: string;
  accessible: boolean;
  item_count: number;
}
interface Catalog {
  contributions: {
    id: string;
    topic: string;
    status: string;
    review_note: string | null;
  }[];
  rewards: { title: string; threshold: number }[];
  grants: { kind: string; amount: number; ends_at: string }[];
  limit: number;
  remaining: number;
  bonus: number;
  collections: Collection[];
}
interface Item {
  id: string;
  topic: string;
  kind: string;
  difficulty: string;
  owned: string | null;
}
export default function LearningLibrary() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const cache = useQueryClient();
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const draft = useQuery({
    queryKey: ["library_draft", draftId],
    enabled: !!draftId,
    queryFn: async () => (await fetchProvaDrafts(draftId))[0] ?? null,
  });
  const [selected, setSelected] = useState<Collection | null>(null);
  useRealtimeInvalidate(
    "question_contributions",
    claims?.family_id ? `family_id=eq.${claims.family_id}` : null,
    [["learning_library", claims?.family_id]],
  );
  const catalog = useQuery({
    queryKey: ["learning_library", claims?.family_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_learning_library");
      if (error) throw error;
      return data as unknown as Catalog;
    },
  });
  const items = useQuery({
    queryKey: ["library_items", claims?.family_id, selected?.id],
    enabled: !!selected?.accessible,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_library_items", {
        p_collection_id: selected!.id,
      });
      if (error) throw error;
      return data as unknown as Item[];
    },
  });
  const redeem = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("redeem_library_item", {
        p_item_id: id,
      });
      if (error) throw error;
      if (draftId) {
        await addToProvaDraft(draftId, [{
          kind: "question",
          id: data,
          source: "library",
        }]);
      }
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["library_draft", draftId] }),
        cache.invalidateQueries({
          queryKey: ["prova_drafts", claims?.family_id],
        }),
        cache.invalidateQueries({ queryKey: ["learning_library"] }),
        cache.invalidateQueries({ queryKey: ["library_items"] }),
        cache.invalidateQueries({
          predicate: (q) =>
            ["question_bank", "question_bank_count", "booklet_library"]
              .includes(String(q.queryKey[0])),
        }),
      ]);
    },
  });
  const collections = (catalog.data?.collections ?? []).filter((c) =>
    !draftId ||
    (draft.data && c.grade === draft.data.content.grade &&
      draft.data.content.subjects.includes(c.subject))
  );
  return (
    <ParentScreen
      title={t("library.title")}
      subtitle={t("library.body")}
      loading={catalog.isLoading || (!!draftId && draft.isPending)}
      error={catalog.error ?? draft.error}
      onRetry={() => {
        void catalog.refetch();
        if (draftId) void draft.refetch();
      }}
    >
      {draftId
        ? (
          <Button
            variant="secondary"
            title={t("provaBuilder.resume")}
            onPress={() =>
              router.replace({
                pathname: "/parent/prova/builder",
                params: { draftId },
              })}
          />
        )
        : null}
      <View style={parentStyles.card}>
        <Text style={parentStyles.title}>
          {t("library.allowance", {
            count: (catalog.data?.remaining ?? 0) + (catalog.data?.bonus ?? 0),
          })}
        </Text>
        <Text style={parentStyles.muted}>{t("library.allowanceHelp")}</Text>
      </View>
      {!collections.length
        ? <EmptyCard title={t("library.empty")} slug="display-bookworm" />
        : null}
      {collections.map((c) => (
        <NavigationCard
          key={c.id}
          title={c.title}
          body={`${c.grade}. ${t("prova.gradeWord")} · ${c.subject} · ${
            t("prova.questionCount", { count: c.item_count })
          }${c.accessible ? "" : ` · ${t("library.locked")}`}`}
          icon={<BookOpen color="#6042DE" size={24} />}
          onPress={() => {
            redeem.reset();
            setSelected(c);
          }}
        />
      ))}
      {catalog.data?.rewards.length
        ? (
          <View style={parentStyles.card}>
            <Text style={parentStyles.title}>
              {t("library.contributionRewards")}
            </Text>
            {catalog.data.rewards.map((r, i) => (
              <Text key={i} style={parentStyles.copy}>{r.title}</Text>
            ))}
            <Text style={parentStyles.muted}>
              {t("library.contributionHelp")}
            </Text>
          </View>
        )
        : null}
      {catalog.data?.contributions.length
        ? (
          <View style={parentStyles.card}>
            <Text style={parentStyles.title}>
              {t("library.myContributions")}
            </Text>
            {catalog.data.contributions.map((c) => (
              <View key={c.id} style={{ gap: 6, paddingVertical: 10 }}>
                <Text style={parentStyles.copy}>
                  {c.topic} · {t(`library.status.${c.status}`)}
                </Text>
                {c.review_note
                  ? <Text style={parentStyles.muted}>{c.review_note}</Text>
                  : null}
              </View>
            ))}
          </View>
        )
        : null}
      {selected
        ? (
          <View style={parentStyles.card}>
            <Text style={parentStyles.title}>{selected.title}</Text>
            <Text style={parentStyles.copy}>{selected.description}</Text>
            <Text style={parentStyles.muted}>
              {selected.curriculum_version}
            </Text>
            {!selected.accessible
              ? (
                <Text style={parentStyles.copy}>
                  {t("library.planRequired")}
                </Text>
              )
              : items.isLoading
              ? <Text style={parentStyles.copy}>{t("common.loading")}</Text>
              : items.data?.map((item) => (
                <View key={item.id} style={parentStyles.card}>
                  <Text style={parentStyles.copy}>{item.topic}</Text>
                  <Text style={parentStyles.muted}>
                    {t(`prova.kind.${item.kind}`)} ·{" "}
                    {t(`prova.difficulty.${item.difficulty}`)}
                  </Text>
                  <Button
                    title={t(
                      draftId
                        ? "provaBuilder.addToPractice"
                        : item.owned
                        ? "library.owned"
                        : "library.add",
                    )}
                    disabled={redeem.isPending || (!draftId && !!item.owned) ||
                      (!!draftId && !!item.owned &&
                        draft.data?.content.blocks.some((b) =>
                          b.id === item.owned
                        )) ||
                      (!item.owned &&
                        !(catalog.data &&
                          (catalog.data.remaining + catalog.data.bonus) > 0))}
                    loading={redeem.isPending && redeem.variables === item.id}
                    onPress={() =>
                      redeem.mutate(item.id)}
                  />
                </View>
              ))}
            <ErrorText error={items.error ?? redeem.error} />
            <Button
              variant="ghost"
              title={t("common.close")}
              onPress={() => setSelected(null)}
            />
          </View>
        )
        : null}
    </ParentScreen>
  );
}
