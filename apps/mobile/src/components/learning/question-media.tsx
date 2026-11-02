import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { sourceAction } from "@/lib/learning-files";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
export interface QuestionMediaItem {
  source_id: string;
  question_id: string;
  alt: string;
  width: number;
  height: number;
}
export function QuestionMedia(
  { questionId, items, compact = false, notebook = false }: {
    questionId: string;
    items?: QuestionMediaItem[];
    compact?: boolean;
    notebook?: boolean;
  },
) {
  const { claims } = useSession();
  const media = useQuery({
    queryKey: [
      "question_media",
      claims?.family_id,
      claims?.child_id,
      questionId,
    ],
    enabled: !!questionId && items === undefined,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_question_media", {
        p_question_ids: [questionId],
      });
      if (error) throw error;
      return data as unknown as QuestionMediaItem[];
    },
  });
  const { t } = useTranslation();
  if (items === undefined && media.isPending) {
    return <Text>{t("common.loading")}</Text>;
  }
  if (items === undefined && media.error) {
    return (
      <View>
        <Text>{t("sources.imageFailed")}</Text>
        <Button
          variant="ghost"
          title={t("common.retry")}
          onPress={() => void media.refetch()}
        />
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {(compact ? (items ?? media.data)?.slice(0, 1) : (items ?? media.data))
        ?.map((m) => (
          <SourceImage
            key={m.source_id}
            media={m}
            compact={compact}
            notebook={notebook}
          />
        ))}
    </View>
  );
}
function SourceImage(
  { media: m, compact, notebook }: {
    media: QuestionMediaItem;
    compact: boolean;
    notebook?: boolean;
  },
) {
  const { t } = useTranslation();
  const { claims } = useSession();
  const [failed, setFailed] = useState(false);
  const signed = useQuery({
    queryKey: [
      "question_image_url",
      claims?.family_id,
      claims?.child_id,
      m.source_id,
      m.question_id,
    ],
    staleTime: 60_000,
    gcTime: 60_000,
    queryFn: () =>
      sourceAction<{ url: string }>({
        action: "view",
        id: m.source_id,
        question_id: m.question_id,
      }),
  });
  return (
    <View style={{ gap: 6 }}>
      {signed.data && !failed && !signed.isFetching
        ? (
          <Image
            source={{ uri: signed.data.url }}
            accessibilityLabel={m.alt}
            contentFit="contain"
            style={{
              width: "100%",
              aspectRatio: Math.max(.3, Math.min(4, m.width / m.height)),
              maxHeight: compact ? 78 : notebook ? 190 : 420,
              backgroundColor: "transparent",
              borderRadius: 16,
            }}
            onError={() => setFailed(true)}
          />
        )
        : (
          <Text>
            {t(
              signed.error || failed ? "sources.imageFailed" : "common.loading",
            )}
          </Text>
        )}
      {signed.error || failed
        ? (
          <Button
            variant="ghost"
            title={t("common.retry")}
            disabled={signed.isFetching}
            onPress={() => {
              setFailed(false);
              void signed.refetch();
            }}
          />
        )
        : null}
      {!compact && !notebook && (
        <Text
          style={{
            fontFamily: "Nunito_400Regular",
            fontSize: 14,
            color: "#625C85",
          }}
        >
          {m.alt}
        </Text>
      )}
    </View>
  );
}
