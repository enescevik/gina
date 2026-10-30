import type { ImageSourcePropType } from "react-native";

import manifest from "../../../../../packages/assets/room-chrome/manifest.json";

// Odam kaplamaları: packages/assets/room-chrome/manifest.json geometrisi + @3x PNG'ler.
// Metro statik require ister ve @3x son ekini ölçek varyantı olarak kendisi çözer (ad.png → ad@3x.png); bu eşleme manifestteki 30 slug ile birebir aynıdır.
// Native pakette yalnız burada listelenen PNG'ler yer alır (~240 KB toplam); web'de yalnız çizilen dosya indirilir.
const SKIN_SOURCES = {
  "child-board-v5": require("../../../../../packages/assets/room-chrome/png/child-board-v5.png"),
  "child-notebook-v5": require("../../../../../packages/assets/room-chrome/png/child-notebook-v5.png"),
  "child-cabinet-v5": require("../../../../../packages/assets/room-chrome/png/child-cabinet-v5.png"),
  "board-frame": require("../../../../../packages/assets/room-chrome/png/board-frame.png"),
  "task-card": require("../../../../../packages/assets/room-chrome/png/task-card.png"),
  "task-card-pressed": require("../../../../../packages/assets/room-chrome/png/task-card-pressed.png"),
  "chip-start": require("../../../../../packages/assets/room-chrome/png/chip-start.png"),
  "chip-start-pressed": require("../../../../../packages/assets/room-chrome/png/chip-start-pressed.png"),
  "chip-start-disabled": require("../../../../../packages/assets/room-chrome/png/chip-start-disabled.png"),
  "status-done": require("../../../../../packages/assets/room-chrome/png/status-done.png"),
  "status-waiting": require("../../../../../packages/assets/room-chrome/png/status-waiting.png"),
  "status-returned": require("../../../../../packages/assets/room-chrome/png/status-returned.png"),
  "progress-dot-filled": require("../../../../../packages/assets/room-chrome/png/progress-dot-filled.png"),
  "progress-dot-empty": require("../../../../../packages/assets/room-chrome/png/progress-dot-empty.png"),
  "ticket-goal": require("../../../../../packages/assets/room-chrome/png/ticket-goal.png"),
  "ticket-goal-empty": require("../../../../../packages/assets/room-chrome/png/ticket-goal-empty.png"),
  "progress-bar-track": require("../../../../../packages/assets/room-chrome/png/progress-bar-track.png"),
  "progress-bar-fill": require("../../../../../packages/assets/room-chrome/png/progress-bar-fill.png"),
  "week-frame": require("../../../../../packages/assets/room-chrome/png/week-frame.png"),
  "week-check": require("../../../../../packages/assets/room-chrome/png/week-check.png"),
  "week-partial": require("../../../../../packages/assets/room-chrome/png/week-partial.png"),
  "week-empty": require("../../../../../packages/assets/room-chrome/png/week-empty.png"),
  "shelf-display": require("../../../../../packages/assets/room-chrome/png/shelf-display.png"),
  "drawer-front": require("../../../../../packages/assets/room-chrome/png/drawer-front.png"),
  "drawer-front-pressed": require("../../../../../packages/assets/room-chrome/png/drawer-front-pressed.png"),
  "pill-star": require("../../../../../packages/assets/room-chrome/png/pill-star.png"),
  "pill-star-pressed": require("../../../../../packages/assets/room-chrome/png/pill-star-pressed.png"),
  "pill-parent": require("../../../../../packages/assets/room-chrome/png/pill-parent.png"),
  "pill-parent-pressed": require("../../../../../packages/assets/room-chrome/png/pill-parent-pressed.png"),
  "header-greeting-underline": require("../../../../../packages/assets/room-chrome/png/header-greeting-underline.png"),
  "panel-generic": require("../../../../../packages/assets/room-chrome/png/panel-generic.png"),
  "parent-card": require("../../../../../packages/assets/room-chrome/png/parent-card.png"),
  "parent-approval-card": require("../../../../../packages/assets/room-chrome/png/parent-approval-card.png"),
} satisfies Record<string, ImageSourcePropType>;

export type SkinSlug = keyof typeof SKIN_SOURCES;

interface Edges {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface SkinSpec {
  slug: SkinSlug;
  source: ImageSourcePropType;
  /** 1x mantıksal tuval (dp). */
  width: number;
  height: number;
  /** PNG kaynak boyutu (@3x piksel). */
  pngWidth: number;
  pngHeight: number;
  pixelRatio: number;
  stretch: "both" | "horizontal" | "none";
  /** @3x kaynak piksel. */
  capInsets: Edges;
  /** @3x kaynak piksel. */
  contentInsets: Edges;
  /** 1x mantıksal birim. */
  minimumLogicalSize: { width: number; height: number } | null;
}

interface ManifestEntry {
  slug: string;
  width: number;
  height: number;
  pngWidth: number;
  pngHeight: number;
  pixelRatio: number;
  stretch: string;
  capInsets: Edges;
  contentInsets: Edges;
  minimumLogicalSize?: { width: number; height: number };
}

const SPECS = new Map<string, SkinSpec>();
for (const entry of manifest as ManifestEntry[]) {
  if (!(entry.slug in SKIN_SOURCES)) continue;
  const slug = entry.slug as SkinSlug;
  SPECS.set(slug, {
    slug,
    source: SKIN_SOURCES[slug],
    width: entry.width,
    height: entry.height,
    pngWidth: entry.pngWidth,
    pngHeight: entry.pngHeight,
    pixelRatio: entry.pixelRatio,
    stretch: entry.stretch === "horizontal" ? "horizontal" : entry.stretch === "none" ? "none" : "both",
    capInsets: entry.capInsets,
    contentInsets: entry.contentInsets,
    minimumLogicalSize: entry.minimumLogicalSize ?? null,
  });
}

export function skinSpec(slug: SkinSlug): SkinSpec {
  const spec = SPECS.get(slug);
  if (!spec) throw new Error(`room-chrome manifestinde kaplama yok: ${slug}`);
  return spec;
}
