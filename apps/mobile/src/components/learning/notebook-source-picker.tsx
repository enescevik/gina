import { notebookTokens } from "./notebook-tokens";
import { useRouteMotion } from "@/lib/use-route-motion";
import { useState } from "react";
import { Modal, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { randomUUID } from "expo-crypto";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { p, SatinButton } from "@/components/planner/ui";
import { useNotebookSource } from "./notebook-page";
import type { NotebookInsertion } from "./notebook-editor";
import type { QuestionMediaItem } from "./question-media";

export function NotebookSourcePicker(
  { questionId, stem, visible, onClose, onInsert }: {
    questionId: string;
    stem: string;
    visible: boolean;
    onClose: () => void;
    onInsert: (e: NotebookInsertion) => void;
  },
) {
  const { t } = useTranslation();
  const { animation } = useRouteMotion();
  const { claims } = useSession();
  const [text, setText] = useState("");
  const media = useQuery({
    queryKey: [
      "question_media",
      claims?.family_id,
      claims?.child_id,
      questionId,
    ],
    enabled: visible,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_question_media", {
        p_question_ids: [questionId],
      });
      if (error) throw error;
      return data as unknown as QuestionMediaItem[];
    },
  });
  const tokens = notebookTokens(stem);
  function insertText(value: string) {
    onInsert({
      id: randomUUID(),
      type: "text",
      text: value.trim(),
      x: 90,
      y: 120,
      width: 800,
      height: Math.min(
        1160,
        Math.max(
          140,
          (value.trim().split("\n").reduce(
            (n, line) => n + Math.max(1, Math.ceil(line.length / 26)),
            0,
          ) + 1) * 68,
        ),
      ),
      size: 48,
      color: p.ink as "#201951",
    });
    onClose();
  }
  return (
    <Modal
      visible={visible}
      transparent
      animationType={animation}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#20195180",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: 16,
            padding: 20,
            backgroundColor: p.cream,
            borderRadius: 26,
            maxWidth: 680,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 24, color: p.ink }}
          >
            {t("notebook.takeFromQuestion")}
          </Text>
          <Text
            selectable
            style={{
              fontFamily: "Nunito_400Regular",
              fontSize: 17,
              color: p.ink,
              lineHeight: 26,
            }}
          >
            {stem}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {tokens.map((token) => (
              <SatinButton
                key={token}
                secondary
                title={token}
                onPress={() => insertText(token)}
              />
            ))}
          </View>
          <Text
            style={{
              fontFamily: "Nunito_600SemiBold",
              fontSize: 16,
              color: p.muted,
            }}
          >
            {t("notebook.copyTextHint")}
          </Text>
          <TextInput
            accessibilityLabel={t("notebook.sourceText")}
            value={text}
            onChangeText={setText}
            maxLength={200}
            multiline
            style={{
              minHeight: 72,
              borderWidth: 1,
              borderColor: p.line,
              backgroundColor: "#FFF",
              borderRadius: 16,
              padding: 14,
              fontSize: 18,
              color: p.ink,
            }}
          />
          <SatinButton
            secondary
            title={t("notebook.addText")}
            disabled={!text.trim()}
            onPress={() => insertText(text)}
          />
          {media.isPending ? <Text>{t("common.loading")}</Text> : null}
          {media.error
            ? (
              <>
                <Text>{t("sources.imageFailed")}</Text>
                <SatinButton
                  secondary
                  title={t("common.retry")}
                  onPress={() => void media.refetch()}
                />
              </>
            )
            : null}
          {media.data?.map((m) => (
            <CropSource
              key={m.source_id}
              media={m}
              onInsert={(e) => {
                onInsert(e);
                onClose();
              }}
            />
          ))}
          <SatinButton secondary title={t("common.cancel")} onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}
function CropSource(
  { media: m, onInsert }: {
    media: QuestionMediaItem;
    onInsert: (e: NotebookInsertion) => void;
  },
) {
  const { t } = useTranslation();
  const signed = useNotebookSource(m.source_id, m.question_id);
  const [width, setWidth] = useState(300),
    [start, setStart] = useState<{ x: number; y: number } | null>(null),
    [crop, setCrop] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const height = width * m.height / m.width;
  const cropRatio = m.width * crop.width / (m.height * crop.height);
  const pieceWidth = Math.max(40, Math.min(520, 600 * cropRatio)),
    pieceHeight = pieceWidth / cropRatio;
  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          fontFamily: "Nunito_600SemiBold",
          fontSize: 16,
          color: p.muted,
        }}
      >
        {t("notebook.cropHint")}
      </Text>
      <View
        style={{
          width: "100%",
          aspectRatio: m.width / m.height,
          backgroundColor: "#FFF",
          overflow: "hidden",
        }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          const x = Math.max(0, Math.min(1, e.nativeEvent.locationX / width)),
            y = Math.max(0, Math.min(1, e.nativeEvent.locationY / height));
          setStart({ x, y });
        }}
        onResponderMove={(e) => {
          if (!start) return;
          const x = Math.max(0, Math.min(1, e.nativeEvent.locationX / width)),
            y = Math.max(0, Math.min(1, e.nativeEvent.locationY / height));
          setCrop({
            x: Math.min(start.x, x),
            y: Math.min(start.y, y),
            width: Math.abs(start.x - x),
            height: Math.abs(start.y - y),
          });
        }}
        onResponderRelease={() => setStart(null)}
        onResponderTerminate={() => setStart(null)}
      >
        <View pointerEvents="none" style={{ flex: 1 }}>
          {signed.data
            ? (
              <Image
                source={{ uri: signed.data.url }}
                contentFit="contain"
                style={{ width: "100%", height: "100%" }}
                accessibilityLabel={m.alt}
              />
            )
            : (
              <Text>
                {t(signed.error ? "sources.imageFailed" : "common.loading")}
              </Text>
            )}
          <View
            style={{
              position: "absolute",
              left: crop.x * width,
              top: crop.y * height,
              width: crop.width * width,
              height: crop.height * height,
              borderWidth: 2,
              borderColor: p.purple,
              backgroundColor: "#6042DE12",
            }}
          />
        </View>
      </View>
      <SatinButton
        title={t("notebook.addImagePiece")}
        disabled={!signed.data || crop.width < .03 || crop.height < .03 ||
          pieceHeight < 40 || pieceHeight > 1200}
        onPress={() => {
          const ratio = m.width * crop.width / (m.height * crop.height);
          const w = Math.max(40, Math.min(520, 600 * ratio)), h = w / ratio;
          if (h < 40 || h > 1200) return;
          onInsert({
            id: randomUUID(),
            type: "source",
            sourceId: m.source_id,
            questionId: m.question_id,
            alt: m.alt.slice(0, 500),
            crop,
            x: 90,
            y: 80,
            width: w,
            height: h,
          });
        }}
      />
    </View>
  );
}
