// docs/design/room-v2/scene-layout.json başlangıç koordinatları (status: layout-proposal-validate-on-device).
// Normalize [x, y, w, h]; contain-fit sonrası sahne dikdörtgenine uygulanır.

export const SCENE_BASE = { width: 1586, height: 992 } as const;

export type Zone = readonly [number, number, number, number];

export const ZONES = {
  header: [0.025, 0.015, 0.95, 0.085],
  taskBoard: [0.055, 0.18, 0.32, 0.47],
  goal: [0.7, 0.14, 0.26, 0.22],
  week: [0.75, 0.44, 0.16, 0.13],
  displaySlots: [
    [0.72, 0.63, 0.08, 0.09],
    [0.81, 0.63, 0.07, 0.09],
    [0.9, 0.63, 0.07, 0.09],
  ],
  treasureDrawer: [0.735, 0.78, 0.22, 0.065],
  character: [0.36, 0.45, 0.23, 0.4],
  roomSwitch: [0.6, 0.49, 0.055, 0.1],
} as const satisfies Record<string, Zone | readonly Zone[]>;

/** Geniş oda düzeni eşiği (dp) ve büyük yazı eşiği — altında dikey akışa düşülür. */
export const WIDE_LAYOUT_MIN_DP = 900;
export const LARGE_FONT_REFLOW_ABOVE = 1.2;

export interface SceneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** contain-fit: scale = min(w/baseW, h/baseH); sahne konteynerde ortalanır. */
export function sceneFrame(containerWidth: number, containerHeight: number): SceneRect {
  const scale = Math.min(containerWidth / SCENE_BASE.width, containerHeight / SCENE_BASE.height);
  const width = SCENE_BASE.width * scale;
  const height = SCENE_BASE.height * scale;
  return { left: (containerWidth - width) / 2, top: (containerHeight - height) / 2, width, height };
}

/** Normalize bölgeyi sahne çerçevesi içinde mutlak piksele çevirir. */
export function zoneRect(zone: Zone, frame: SceneRect): SceneRect {
  return {
    left: frame.left + zone[0] * frame.width,
    top: frame.top + zone[1] * frame.height,
    width: zone[2] * frame.width,
    height: zone[3] * frame.height,
  };
}
