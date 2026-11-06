import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Modal, ScrollView, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "@/components/ui/pressable";
import { NOTEBOOK_MODAL_PROPS } from "./notebook-layout";
import { p, u } from "@/components/planner/ui";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { sourceAction } from "@/lib/learning-files";
import { useSession } from "@/lib/session";
import { useRouteMotion } from "@/lib/use-route-motion";
import { Button } from "@/components/ui/button";
export interface QuestionMediaItem {
  source_id: string;
  question_id: string;
  alt: string;
  width: number;
  height: number;
}
export function QuestionMedia(
  { questionId, items, compact = false, notebook = false, maxImageHeight, style }: {
    questionId: string;
    items?: QuestionMediaItem[];
    compact?: boolean;
    notebook?: boolean;
    maxImageHeight?: number;
    style?: StyleProp<ViewStyle>;
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
  if (!(items ?? media.data)?.length) return null;
  return (
    <View style={[{ gap: 12 }, style]}>
      {(compact ? (items ?? media.data)?.slice(0, 1) : (items ?? media.data))
        ?.map((m) => (
          <SourceImage
            key={m.source_id}
            media={m}
            compact={compact}
            notebook={notebook}
            maxImageHeight={maxImageHeight}
          />
        ))}
    </View>
  );
}
function SourceImage(
  { media: m, compact, notebook, maxImageHeight }: {
    media: QuestionMediaItem;
    compact: boolean;
    notebook?: boolean;
    maxImageHeight?: number;
  },
) {
  const { t } = useTranslation();
  const { claims } = useSession();
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const { animation } = useRouteMotion();
  const { width, height } = useWindowDimensions();
  const ratio = m.width > 0 && m.height > 0 ? m.width / m.height : 1;
  const fitWidth = Math.min(Math.max(160, width - 48), Math.max(160, height - 240) * ratio);
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
      {signed.data && !failed
        ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t("experience.expandImage", { description: m.alt })} onPress={() => { setZoom(1); setExpanded(true); }}>
          <Image
            source={{ uri: signed.data.url }}
            accessibilityLabel={m.alt}
            contentFit="contain"
            style={{
              width: "100%",
              aspectRatio: Math.max(.3, Math.min(4, m.width / m.height)),
              maxHeight: maxImageHeight ?? (compact ? 78 : notebook ? 190 : 420),
              backgroundColor: "transparent",
              borderRadius: 16,
            }}
            onError={() => setFailed(true)}
          />
          {!compact && <Text style={[u.small, { color: p.purple, textAlign: "right", paddingVertical: 6 }]}>{t("experience.tapToExpand")}</Text>}
          </Pressable>
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
      <Modal {...NOTEBOOK_MODAL_PROPS} visible={expanded} animationType={animation} onRequestClose={() => setExpanded(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: p.cream }}>
          <View accessibilityViewIsModal style={{ flex: 1 }}>
            <View style={{ padding: 16, gap: 8 }}>
              <Text accessibilityRole="header" style={u.heading}>{t("experience.questionImage")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <Button variant="secondary" title="−" accessibilityLabel={t("experience.zoomOut")} disabled={zoom <= 1} onPress={() => setZoom(Math.max(1, zoom - 1))} />
                <Text accessibilityLiveRegion="polite" style={u.copy}>{zoom * 100}%</Text>
                <Button variant="secondary" title="+" accessibilityLabel={t("experience.zoomIn")} disabled={zoom >= 4} onPress={() => setZoom(Math.min(4, zoom + 1))} />
                <Button variant="ghost" title={t("notebook.close")} onPress={() => setExpanded(false)} />
              </View>
              <Text style={u.small}>{t("experience.imagePanHint")}</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
              <ScrollView horizontal contentContainerStyle={{ minWidth: "100%", justifyContent: "center", alignItems: "center", padding: 16 }}>
                {signed.data && !failed ? <Image source={{ uri: signed.data.url }} accessibilityLabel={m.alt} contentFit="contain" style={{ width: fitWidth * zoom, height: fitWidth / ratio * zoom }} onError={() => setFailed(true)} /> : <Text style={u.copy}>{t("sources.imageFailed")}</Text>}
              </ScrollView>
            </ScrollView>
            <Text selectable style={[u.small, { padding: 16 }]}>{m.alt}</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
