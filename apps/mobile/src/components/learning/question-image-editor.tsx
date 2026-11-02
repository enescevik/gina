import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useState } from "react";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  chooseLearningPhoto,
  type LocalLearningFile,
} from "@/lib/learning-files";
import { DrawingPad } from "./drawing-pad";
export interface QuestionImageDraft {
  file: LocalLearningFile;
  alt: string;
}
export function QuestionImageEditor(
  { images, onChange, disabled, maxImages = 3 }: {
    images: QuestionImageDraft[];
    onChange: (images: QuestionImageDraft[]) => void;
    disabled: boolean;
    maxImages?: number;
  },
) {
  const { t } = useTranslation();
  const [drawing, setDrawing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState(false);
  const { claims } = useSession();
  const policy = useQuery({
    queryKey: ["learning_source_policy", claims?.family_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_learning_source_policy");
      if (error) throw error;
      return data as { enabled: boolean };
    },
  });
  const enabled = policy.data?.enabled === true;
  const add = (file: LocalLearningFile) =>
    onChange([...images, { file, alt: "" }]);
  async function pick() {
    if (picking) return;
    setPicking(true);
    setError(false);
    try {
      const file = await chooseLearningPhoto();
      if (file) add(file);
    } catch {
      setError(true);
    } finally {
      setPicking(false);
    }
  }
  return (
    <View
      style={{
        gap: 16,
        padding: 18,
        borderRadius: 22,
        backgroundColor: "#F3EEFC",
      }}
    >
      <Text
        style={{ fontFamily: "Nunito_700Bold", fontSize: 19, color: "#201951" }}
      >
        {t("sources.questionImages")}
      </Text>
      <Text
        style={{
          fontFamily: "Nunito_400Regular",
          fontSize: 16,
          lineHeight: 23,
          color: "#625C85",
        }}
      >
        {t("sources.localHelp")}
      </Text>
      {images.map((item, index) => (
        <View
          key={item.file.id}
          style={{
            gap: 12,
            backgroundColor: "#FFFFFF",
            padding: 14,
            borderRadius: 18,
          }}
        >
          <Image
            source={{ uri: item.file.uri }}
            contentFit="contain"
            style={{ width: "100%", height: 200 }}
            accessibilityLabel={item.alt || t("sources.preview")}
          />
          <Field
            label={t("sources.alt")}
            hint={t("sources.altHelp")}
            value={item.alt}
            maxLength={1000}
            editable={!disabled}
            onChangeText={(alt) =>
              onChange(
                images.map((image, i) =>
                  i === index ? { ...image, alt } : image
                ),
              )}
          />
          <Button
            title={t("sources.remove")}
            variant="ghost"
            disabled={disabled}
            onPress={() => onChange(images.filter((_, i) => i !== index))}
          />
        </View>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Button
          variant="secondary"
          title={t("sources.photo")}
          loading={picking}
          disabled={disabled || !enabled || images.length >= maxImages}
          onPress={() => void pick()}
        />
        <Button
          variant="secondary"
          title={t("sources.draw")}
          disabled={disabled || !enabled || picking || images.length >= maxImages}
          onPress={() => setDrawing(true)}
        />
      </View>
      {!policy.isPending && !enabled
        ? (
          <Text
            style={{
              fontFamily: "Nunito_400Regular",
              fontSize: 15,
              color: "#625C85",
            }}
          >
            {t("sources.unavailable")}
          </Text>
        )
        : null}
      {error
        ? (
          <Text accessibilityRole="alert" style={{ color: "#A43135" }}>
            {t("sources.pickFailed")}
          </Text>
        )
        : null}
      {drawing
        ? <DrawingPad onClose={() => setDrawing(false)} onSave={add} />
        : null}
    </View>
  );
}
