import { NOTEBOOK_MODAL_PROPS } from "./notebook-layout";
import { useCallback, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Modal,
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import {
  type LocalLearningFile,
  prepareLearningImage,
} from "@/lib/learning-files";

const COLORS = ["#201951", "#6042DE", "#168573", "#B34A34"];
type Stroke = { path: string; color: string };
export function DrawingPad(
  { onClose, onSave }: {
    onClose: () => void;
    onSave: (file: LocalLearningFile) => void;
  },
) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const svg = useRef<Svg>(null);
  const width = useRef(1);
  const pointCount = useRef(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const point = useCallback((e: GestureResponderEvent) =>
    `${
      Math.max(
        0,
        Math.min(1000, e.nativeEvent.locationX / width.current * 1000),
      ).toFixed(1)
    } ${
      Math.max(0, Math.min(600, e.nativeEvent.locationY / width.current * 1000))
        .toFixed(1)
    }`, []);
  async function save() {
    if (!svg.current || busy || !strokes.length) return;
    setBusy(true);
    setFailed(false);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("drawing_timeout")),
          10000,
        );
        svg.current!.toDataURL((value) => {
          clearTimeout(timer);
          resolve(value);
        }, { width: 1000, height: 600 });
      });
      onSave(
        await prepareLearningImage(
          `data:image/png;base64,${base64}`,
          "drawing.png",
        ),
      );
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      {...NOTEBOOK_MODAL_PROPS}
      visible
      animationType="none"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFBF5" }}>
        <ScrollView
          scrollEnabled={!drawing}
          bounces={!drawing}
          contentContainerStyle={{
            padding: 24,
            gap: 18,
            maxWidth: 1000,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Baloo2_700Bold",
              fontSize: 30,
              color: "#201951",
            }}
          >
            {t("sources.draw")}
          </Text>
          <Text
            style={{
              fontFamily: "Nunito_400Regular",
              fontSize: 17,
              color: "#625C85",
            }}
          >
            {t("sources.drawHelp")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {COLORS.map((c, i) => (
              <Pressable
                key={c}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t(`sources.colors.${i}`)}
                accessibilityState={{ selected: c === color }} aria-pressed={c === color}
                onPress={() => setColor(c)}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  padding: 7,
                  borderWidth: c === color ? 3 : 1,
                  borderColor: c === color ? "#201951" : "#DDD6E8",
                }}
              >
                <View
                  style={{ flex: 1, borderRadius: 20, backgroundColor: c }}
                />
              </Pressable>
            ))}
            <Button
              title={t("sources.undo")}
              variant="ghost"
              disabled={busy || !strokes.length}
              onPress={() => setStrokes((s) => s.slice(0, -1))}
            />
          </View>
          <View
            accessibilityLabel={t("sources.canvas")}
            // Focus must land on the canvas; a modal ancestor losing focus can
            // otherwise cancel the first pointer gesture on React Native Web.
            focusable
            onLayout={(e) => {
              width.current = e.nativeEvent.layout.width;
            }}
            style={{
              width: "100%",
              aspectRatio: 5 / 3,
              maxWidth: Math.max(300, (height - 320) * 5 / 3),
              alignSelf: "center",
              borderWidth: 2,
              borderColor: "#DDD6E8",
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: "#FFFFFF",
              ...(Platform.OS === "web" ? { touchAction: "none" } : {}),
            }}
            onStartShouldSetResponder={() => !busy && strokes.length < 200}
            onResponderGrant={(e) => {
              setDrawing(true);
              pointCount.current = 1;
              setStrokes(
                (s) => [...s, { path: `M${point(e)} l0.1 0.1`, color }],
              );
            }}
            onResponderMove={(e) => {
              if (
                e.nativeEvent.touches.length > 1 || ++pointCount.current > 1000
              ) return;
              const p = point(e);
              setStrokes((s) =>
                s.length
                  ? [...s.slice(0, -1), {
                    ...s[s.length - 1],
                    path: `${s[s.length - 1].path} L${p}`,
                  }]
                  : s
              );
            }}
            onResponderRelease={(e) => {
              setDrawing(false);
              const p = point(e);
              setStrokes((s) =>
                s.length
                  ? [...s.slice(0, -1), {
                    ...s[s.length - 1],
                    path: `${s[s.length - 1].path} L${p}`,
                  }]
                  : s
              );
            }}
            onResponderTerminationRequest={() => false}
            onResponderTerminate={() => setDrawing(false)}
          >
            <Svg
              pointerEvents="none"
              ref={svg}
              width="100%"
              height="100%"
              viewBox="0 0 1000 600"
            >
              <Rect width={1000} height={600} fill="#FFFFFF" />
              {strokes.map((s, i) => (
                <Path
                  key={i}
                  d={s.path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </Svg>
          </View>
          {failed
            ? (
              <Text accessibilityRole="alert">
                {t("sources.drawingFailed")}
              </Text>
            )
            : null}
          <Button
            title={t("sources.useDrawing")}
            loading={busy}
            disabled={!strokes.length}
            onPress={() => void save()}
          />
          <Button
            title={t("common.cancel")}
            variant="ghost"
            disabled={busy}
            onPress={onClose}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
