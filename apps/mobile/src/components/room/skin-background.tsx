import { Image, PixelRatio, View, type DimensionValue, type ViewStyle } from "react-native";

import type { SkinSpec } from "./skins";

/** @3x kaynak pikseli → fiziksel piksele yuvarlanmış dp. */
export function skinPx(value: number, spec: SkinSpec, scale: number) {
  return PixelRatio.roundToNearestPixel((value / spec.pixelRatio) * scale);
}
const px = skinPx;

type SliceAxis = { src0: number; src1: number; pos: ViewStyle };

function axisSlices(
  capStart: number,
  capEnd: number,
  total: number,
  destStart: number,
  destEnd: number,
  horizontal: boolean,
): SliceAxis[] {
  const [startKey, endKey, sizeKey] = horizontal ? (["left", "right", "width"] as const) : (["top", "bottom", "height"] as const);
  const slices: SliceAxis[] = [];
  if (capStart > 0 && destStart > 0) slices.push({ src0: 0, src1: capStart, pos: { [startKey]: 0, [sizeKey]: destStart } });
  if (total - capEnd > capStart) slices.push({ src0: capStart, src1: total - capEnd, pos: { [startKey]: destStart, [endKey]: destEnd } });
  if (capEnd > 0 && destEnd > 0) slices.push({ src0: total - capEnd, src1: total, pos: { [endKey]: 0, [sizeKey]: destEnd } });
  return slices;
}

const pct = (n: number) => `${n * 100}%` as DimensionValue;

/**
 * iOS/Android: her parça overflow:hidden bir View; içindeki tam PNG yüzde konum/boyutla kaydırılır ki
 * kaynağın yalnız o dilimi parça kutusunu doldursun. Yüzdeler parça kutusuna göredir (onLayout yok).
 * Cap sınırları fiziksel piksele yuvarlanır; Yoga yerleşimi de piksel ızgarasına oturduğundan komşu
 * parçalar ortak tam-piksel sınırı paylaşır.
 */
/** Kaplamanın dekor katmanı: mutlak, dokunulmaz, erişilebilirlik ağacı dışında. */
export function SkinBackground({ spec, scale }: { spec: SkinSpec; scale: number }) {
  const { capInsets: cap, pngWidth, pngHeight } = spec;
  const cols = axisSlices(cap.left, cap.right, pngWidth, px(cap.left, spec, scale), px(cap.right, spec, scale), true);
  // Yatay kaplamada yükseklik sabit: dikey dilim yok, tek satır.
  const rows: SliceAxis[] =
    spec.stretch === "horizontal"
      ? [{ src0: 0, src1: pngHeight, pos: { top: 0, bottom: 0 } }]
      : axisSlices(cap.top, cap.bottom, pngHeight, px(cap.top, spec, scale), px(cap.bottom, spec, scale), false);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
    >
      {rows.map((row) =>
        cols.map((col) => {
          const sw = col.src1 - col.src0;
          const sh = row.src1 - row.src0;
          return (
            <View key={`${row.src0}-${col.src0}`} style={{ position: "absolute", overflow: "hidden", ...row.pos, ...col.pos }}>
              <Image
                source={spec.source}
                resizeMode="stretch"
                fadeDuration={0}
                style={{
                  position: "absolute",
                  left: pct(-col.src0 / sw),
                  top: pct(-row.src0 / sh),
                  width: pct(pngWidth / sw),
                  height: pct(pngHeight / sh),
                }}
              />
            </View>
          );
        }),
      )}
    </View>
  );
}

