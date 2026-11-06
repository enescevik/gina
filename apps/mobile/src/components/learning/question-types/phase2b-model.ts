/**
 * QT41/QT42 — saat ve bölge seçme için saf yardımcılar + veli satırları. Puan HESAPLAMAZ (SQL `qt_score`).
 * Anahtar `count` ya da `targets` olabilir; çocuk istemcisi hangisi olduğunu bilmez.
 */
import { formatClockTime, parseClockTime } from "@gina/core";
import type { ItemMark, ReviewRow, ScoreDetails } from "./model";
import { selectionRows, type Phase2aLabels } from "./phase2a-model";

const DAY = 24 * 60;

/** Saat/dakika düğmeleri: adım `step_minutes`'a oturur, 24 saatte döner. Boş başlangıç 12:00 kabul edilir. */
export function stepClock(time: string | undefined, delta: { hours?: number; minutes?: number }, step: number): string {
  const base = parseClockTime(time) ?? 12 * 60;
  const aligned = Math.round(base / step) * step;
  let next = aligned + (delta.hours ?? 0) * 60 + (delta.minutes ?? 0);
  next = ((next % DAY) + DAY) % DAY;
  next = Math.round(next / step) * step % DAY;
  return formatClockTime(next);
}
/** Dakika adımı saat düğmesinden küçükse dakika düğmesi; 60 dk adımda yalnız saat düğmeleri. */
export const minuteStep = (step: number) => (step >= 60 ? 0 : step);

/** Analog yüz için açılar (derece, 12 yönünden saat yönüne). */
export function handAngles(time: string): { hour: number; minute: number } | null {
  const m = parseClockTime(time);
  if (m === null) return null;
  const minutes = m % 60, hours = Math.floor(m / 60) % 12;
  return { hour: hours * 30 + minutes * 0.5, minute: minutes * 6 };
}

/** Bölge seçimi için sektör yolları (SVG, merkez 50,50, yarıçap 48). */
export function sectorPath(index: number, count: number, r = 48): string {
  const a0 = (index / count) * 2 * Math.PI - Math.PI / 2, a1 = ((index + 1) / count) * 2 * Math.PI - Math.PI / 2;
  const p = (a: number) => `${(50 + r * Math.cos(a)).toFixed(3)} ${(50 + r * Math.sin(a)).toFixed(3)}`;
  return `M 50 50 L ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`;
}

/** Görsel bölge kutusu → yüzde konum (ölçek/yön değişse de görsele hizalı kalır). */
export function boxStyle(box: [number, number, number, number]) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%` as const;
  return { left: pct(box[0]), top: pct(box[1]), width: pct(box[2]), height: pct(box[3]) };
}

// ---------------------------------------------------------------------------------------------
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

export function phase2bReviewRows(type: string, payload: unknown, answer: unknown, details: ScoreDetails | null, key: unknown, l: Phase2aLabels & { time: string }): ReviewRow[] {
  const p = isObj(payload) ? payload : {};
  const a = isObj(answer) && answer.type === type ? answer : null;
  const k = isObj(key) ? key : null;
  if (type === "region_select") {
    const regions = (p.regions as { id: string; text: string }[]) ?? [];
    const selected = Array.isArray(a?.selected) ? (a!.selected as string[]) : [];
    // Sayı anahtarında (ör. "3 parçayı boya") hangi parça olduğu önemli değildir: satırlar yalnız seçimi gösterir.
    const targets = k && Array.isArray(k.targets) ? (k.targets as string[]) : null;
    return selectionRows(regions, selected, targets, false, l);
  }
  if (type === "clock") {
    const it = isObj(details?.items?.time) ? (details!.items!.time as Obj) : null;
    const given = typeof a?.time === "string" ? a.time : null;
    const mark: ItemMark = !given ? "blank" : it ? (it.correct === true ? "correct" : "incorrect") : "unknown";
    return [{ id: "time", prompt: l.time, given, expected: k && typeof k.time === "string" ? k.time : null, mark }];
  }
  return [];
}

/** Sayı anahtarlı bölge seçimi: seçilen / istenen. */
export function regionCountSummary(details: ScoreDetails | null): { selected: number; required: number } | null {
  const it = details?.items;
  return isObj(it) && typeof it.selected === "number" && typeof it.required === "number" ? { selected: it.selected, required: it.required } : null;
}
