import { memo } from "react";
import { Text, View } from "react-native";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  type NotebookDocument,
  type NotebookElement,
  strokePath,
} from "@gina/core";
import { sourceAction } from "@/lib/learning-files";
import { useSession } from "@/lib/session";

export function useNotebookSource(sourceId: string, questionId: string) {
  const { claims } = useSession();
  return useQuery({
    queryKey: [
      "question_image_url",
      claims?.family_id,
      claims?.child_id,
      sourceId,
      questionId,
    ],
    staleTime: 60_000,
    gcTime: 60_000,
    refetchInterval: 90_000,
    queryFn: () =>
      sourceAction<{ url: string }>({
        action: "view",
        id: sourceId,
        question_id: questionId,
      }),
  });
}
function SourcePiece(
  { element: e, scale }: {
    element: Extract<NotebookElement, { type: "source" }>;
    scale: number;
  },
) {
  const signed = useNotebookSource(e.sourceId, e.questionId);
  const { t } = useTranslation();
  return (
    <View
      style={{
        position: "absolute",
        left: e.x * scale,
        top: e.y * scale,
        width: e.width * scale,
        height: e.height * scale,
        overflow: "hidden",
        backgroundColor: "#fff",
      }}
    >
      {signed.data
        ? (
          <Image
            source={{ uri: signed.data.url }}
            accessibilityLabel={e.alt}
            contentFit="fill"
            style={{
              position: "absolute",
              width: e.width * scale / e.crop.width,
              height: e.height * scale / e.crop.height,
              left: -e.crop.x * e.width * scale / e.crop.width,
              top: -e.crop.y * e.height * scale / e.crop.height,
            }}
          />
        )
        : (
          <Text>
            {t(signed.error ? "sources.imageFailed" : "common.loading")}
          </Text>
        )}
    </View>
  );
}
const Ink = memo(
  function Ink(
    { e, width }: {
      e: Extract<NotebookElement, { type: "stroke" }>;
      width: number;
    },
  ) {
    return (
      <Svg
        pointerEvents="none"
        width={width}
        height={width * 1.4}
        viewBox="0 0 1000 1400"
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <Path
          d={strokePath(e.points)}
          fill="none"
          stroke={e.color}
          strokeWidth={e.size}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  },
);
/** The same renderer is used for writing, resuming and parent review. No executable markup. */
export const NotebookPage = memo(
  function NotebookPage(
    { document, width, grid = true, transparent = false }: {
      document: NotebookDocument;
      width: number;
      grid?: boolean;
      transparent?: boolean;
    },
  ) {
    const scale = width / 1000;
    return (
      <View
        pointerEvents="none"
        style={{
          width,
          height: width * 1.4,
          backgroundColor: transparent ? "transparent" : "#FFFEFA",
          overflow: "hidden",
        }}
      >
        {grid
          ? (
            <Svg
              width={width}
              height={width * 1.4}
              viewBox="0 0 1000 1400"
              style={{ position: "absolute" }}
            >
              <Defs>
                <Pattern
                  id="notebook-grid"
                  width={40}
                  height={40}
                  patternUnits="userSpaceOnUse"
                >
                  <Path
                    d="M40 0H0V40"
                    stroke="#E6E2F0"
                    strokeWidth={1.1}
                    fill="none"
                  />
                </Pattern>
              </Defs>
              <Rect width={1000} height={1400} fill="url(#notebook-grid)" />
              <Path d="M65 0V1400" stroke="#E9C9D8" strokeWidth={1.5} />
            </Svg>
          )
          : null}
        {document.elements.map((e) =>
          e.type === "stroke"
            ? <Ink key={e.id} e={e} width={width} />
            : e.type === "source"
            ? <SourcePiece key={e.id} element={e} scale={scale} />
            : (
              <Text
                key={e.id}
                selectable={false}
                allowFontScaling={false}
                style={{
                  position: "absolute",
                  left: e.x * scale,
                  top: e.y * scale,
                  width: e.width * scale,
                  height: e.height * scale,
                  fontFamily: "Nunito_600SemiBold",
                  fontSize: e.size * scale,
                  lineHeight: e.size * 1.4 * scale,
                  color: e.color,
                }}
              >
                {e.text}
              </Text>
            )
        )}
      </View>
    );
  },
);
