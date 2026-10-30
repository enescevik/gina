import { useLayoutEffect, useRef, useState } from "react";
import { PixelRatio, type ImageSourcePropType } from "react-native";
// RN-web'in kendi varlık kaydı (Image bileşeni de bunu kullanır); sayısal kaynak kimliği → sunucu yolu.
// @ts-expect-error -- RN-web iç modülünün tip bildirimi yok
import { getAssetByID } from "react-native-web/dist/modules/AssetRegistry";

import type { SkinSpec } from "./skins";

/** @3x kaynak pikseli → dp (web'de tarayıcı kendi piksel ızgarasına oturtur). */
export function skinPx(value: number, spec: SkinSpec, scale: number) {
  return PixelRatio.roundToNearestPixel((value / spec.pixelRatio) * scale);
}

interface RegisteredAsset {
  httpServerLocation: string;
  name: string;
  type: string;
  scales: number[];
}

function assetUri(source: ImageSourcePropType): string | null {
  if (typeof source === "number") {
    const asset = (getAssetByID as (id: number) => RegisteredAsset | undefined)(source);
    if (!asset) return null;
    const scale = asset.scales.includes(3) ? 3 : (asset.scales[asset.scales.length - 1] ?? 1);
    return `${asset.httpServerLocation}/${asset.name}${scale !== 1 ? `@${scale}x` : ""}.${asset.type}`;
  }
  if (typeof source === "string") return source;
  if (source && !Array.isArray(source) && typeof (source as { uri?: unknown }).uri === "string") return (source as { uri: string }).uri;
  return null;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(uri: string) {
  let pending = imageCache.get(uri);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = uri;
    });
    imageCache.set(uri, pending);
  }
  return pending;
}

/** Bir eksenin dilimleri: [kaynak0, kaynak1, hedef0, hedef1] (hedef fiziksel piksel, tam sayı). */
function axis(capStart: number, capEnd: number, srcTotal: number, destStart: number, destEnd: number, destTotal: number) {
  const parts: [number, number, number, number][] = [];
  if (capStart > 0 && destStart > 0) parts.push([0, capStart, 0, destStart]);
  if (srcTotal - capEnd > capStart && destTotal - destEnd > destStart) parts.push([capStart, srcTotal - capEnd, destStart, destTotal - destEnd]);
  if (capEnd > 0 && destEnd > 0) parts.push([srcTotal - capEnd, srcTotal, destTotal - destEnd, destTotal]);
  return parts;
}

/**
 * Web: dokuz dilim tek bir <canvas>'a fiziksel piksel çözünürlüğünde çizilir (contact-sheet.html
 * kontrolüyle aynı yöntem). Hedef sınırlar tam cihaz pikselidir ve her dilim aynı tam PNG'den
 * örneklenir; CSS border-image / ayrı kutularda görülen, dilim kenarındaki saydam karışım dikişi oluşmaz.
 * Kaplama kutusu flex/yüzde yerleşimde kesirli konuma düşebilir; tuval en yakın cihaz pikseline
 * oturtulur (kayma <1 px, içerik yerinde kalır). Yatay kaplamada dikey dilim yoktur: yükseklik sabit.
 */
export function SkinBackground({ spec, scale }: { spec: SkinSpec; scale: number }) {
  const uri = assetUri(spec.source);
  const ref = useRef<HTMLCanvasElement>(null);
  const [snap, setSnap] = useState({ l: 0, t: 0, r: 0, b: 0 });

  useLayoutEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent || !uri) return;
    let cancelled = false;
    const draw = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const off = (v: number) => Math.round(v * dpr) / dpr - v;
      const next = { l: off(rect.left), t: off(rect.top), r: off(rect.right), b: off(rect.bottom) };
      setSnap((prev) =>
        Math.abs(prev.l - next.l) + Math.abs(prev.t - next.t) + Math.abs(prev.r - next.r) + Math.abs(prev.b - next.b) < 0.01 ? prev : next,
      );
      const width = Math.round(rect.right * dpr) - Math.round(rect.left * dpr);
      const height = Math.round(rect.bottom * dpr) - Math.round(rect.top * dpr);
      if (width <= 0 || height <= 0) return;
      void loadImage(uri).then((img) => {
        if (cancelled) return;
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        const c = spec.capInsets;
        // Görüntünün gerçek boyutu (@3x) ile manifest farklıysa dilimleri orantıla.
        const k = img.naturalWidth / spec.pngWidth;
        const dev = (v: number) => Math.round((v / spec.pixelRatio) * scale * dpr);
        const cols = axis(c.left * k, c.right * k, img.naturalWidth, dev(c.left), dev(c.right), width);
        const rows =
          spec.stretch === "horizontal"
            ? ([[0, img.naturalHeight, 0, height]] as [number, number, number, number][])
            : axis(c.top * k, c.bottom * k, img.naturalHeight, dev(c.top), dev(c.bottom), height);
        for (const [sy0, sy1, dy0, dy1] of rows) {
          for (const [sx0, sx1, dx0, dx1] of cols) {
            ctx.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, dx0, dy0, dx1 - dx0, dy1 - dy0);
          }
        }
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    window.addEventListener("resize", draw);
    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [uri, spec, scale]);

  if (!uri) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        left: snap.l,
        top: snap.t,
        width: `calc(100% - ${snap.l}px + ${snap.r}px)`,
        height: `calc(100% - ${snap.t}px + ${snap.b}px)`,
        pointerEvents: "none",
      }}
    />
  );
}
