// Sahne bölgeleri: üretim room-base (packages/assets/rooms/v2, 1586×992) ve room-chrome contact-sheet
// montajındaki kaplama dış sınırları (normalize [x, y, w, h]); contain-fit sonrası sahne dikdörtgenine uygulanır.
// Pano/bilet/takvim/dolap tabana gömülü değil; bu dikdörtgenler kaplamaların dış kutusudur, içerik
// kaplamanın contentInsets'i içinde akar. scene-layout.json'daki eski değerler içerik kutusu önerisiydi.

export const SCENE_BASE = { width: 1586, height: 992 } as const;

export type Zone = readonly [number, number, number, number];

export const ZONES = {
  header: [0.025, 0.022, 0.955, 0.08],
  // board-frame dış kutusu (contact-sheet: left 1.58%, top 13.1%, 38.46% × 59.48%)
  taskBoard: [0.0158, 0.131, 0.3846, 0.5948],
  // Sağ sütun: hedef bileti üstünden çekmece altına; içi native flex ile akar (küçük sahnede çakışmaz).
  rightColumn: [0.681, 0.111, 0.309, 0.776],
  goal: [0.681, 0.111, 0.309, 0.2722],
  week: [0.7314, 0.398, 0.2459, 0.1865],
  shelf: [0.7062, 0.6048, 0.2837, 0.1169],
  // Eski önizleme (room-preview) için; geniş ev ekranı yuvaları shelf-display content rect'inden türetir.
  displaySlots: [
    [0.72, 0.63, 0.08, 0.09],
    [0.81, 0.63, 0.07, 0.09],
    [0.9, 0.63, 0.07, 0.09],
  ],
  treasureDrawer: [0.7062, 0.756, 0.2837, 0.131],
  character: [0.39, 0.42, 0.31, 0.45],
  roomSwitch: [0.6, 0.49, 0.055, 0.1],
  // Kitaplık: Prova kapısı (üretim room-base'deki kitaplık: x 845–1075, y 355–765 px).
  bookshelf: [0.533, 0.36, 0.145, 0.41],
} as const satisfies Record<string, Zone | readonly Zone[]>;

/**
 * Karakter yerleşimi (onaylı referans): içerik sınırının altı footY'de, içerik merkezi centerX'te;
 * contentHeight = kız karakterinin içerik yüksekliğinin sahne yüksekliğine oranı (üçü aynı ölçek).
 */
export const CHARACTER_PLACEMENT = { centerX: 0.495, footY: 0.865, contentHeight: 0.41 } as const;

/**
 * Evcil hayvan katmanı (onaylı referanstaki uyuyan kedi): halının üstünde, karakterin solunda.
 * Görselin alt kenarı footY'de, ortası centerX'te; height = görsel yüksekliğinin sahne yüksekliğine oranı.
 * TODO(BRIEF 13 / A.7): Codex manifeste içerik sınırları/ayak çizgisi verince karakterdeki gibi contentBounds'a hizala.
 */
export const PET_PLACEMENT = { centerX: 0.345, footY: 0.86, height: 0.16 } as const;

/** Geniş oda düzeni eşiği (dp) ve büyük yazı eşiği — altında dikey akışa düşülür. */
export const WIDE_LAYOUT_MIN_DP = 900;
export const LARGE_FONT_REFLOW_ABOVE = 1.2;

/** Odadaki kaplamaların tekdüze yoğunluğu: 1280 dp genişlikte 1; küçük/büyük tablette sınırlı ölçek. */
export function roomSkinScale(frameWidth: number) {
  return Math.max(0.72, Math.min(1.2, frameWidth / 1280));
}

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
