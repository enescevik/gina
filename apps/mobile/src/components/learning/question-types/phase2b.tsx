import { type Phase2bAnswerOf, type Phase2bPayload, type Stimulus } from "@gina/core";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Line, Path, Pattern, Rect, Text as SvgText } from "react-native-svg";
import { Check, Minus, Plus } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import type { QuestionMediaItem } from "@/components/learning/question-media";
import { sourceAction } from "@/lib/learning-files";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Counter } from "./phase2a";
import { toggleSelected } from "./phase2a-model";
import { boxStyle, handAngles, minuteStep, sectorPath, stepClock } from "./phase2b-model";
import { Help, SectionTitle, StepNote, qt } from "./ui";

// ---------------------------------------------------------------------------------------------
// QT42 — Uyaran: tablo / çubuk grafik. Ekran okuyucu `alt`'ı okur; görünür etiket + değer her zaman yazılı.

export function StimulusView({ stimulus }: { stimulus: Stimulus }) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const caption = stimulus.caption ? <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, lineHeight: 22, color: qt.ink }}>{stimulus.caption}</Text> : null;
  if (stimulus.kind === "table") {
    return (
      <View testID="qt-stimulus-table" accessible accessibilityRole="image" accessibilityLabel={`${stimulus.caption ? stimulus.caption + ". " : ""}${stimulus.alt}`}
        style={{ gap: 8, borderRadius: 18, borderWidth: 1, borderColor: qt.line, backgroundColor: "#FFFFFF", padding: 12 }}>
        {caption}
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: qt.line, overflow: "hidden" }}>
          {[stimulus.columns, ...stimulus.rows].map((row, r) => (
            <View key={r} style={{ flexDirection: "row", backgroundColor: r === 0 ? qt.lilac : r % 2 ? "#FFFFFF" : qt.cream, borderTopWidth: r ? 1 : 0, borderTopColor: qt.line }}>
              {row.map((cell, c) => (
                <Text key={c} style={{ flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 8, fontFamily: r === 0 ? "Nunito_800ExtraBold" : "Nunito_700Bold", fontSize: 15, lineHeight: 21, color: qt.ink, borderLeftWidth: c ? 1 : 0, borderLeftColor: qt.line }}>
                  {String(cell)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }
  const max = Math.max(...stimulus.bars.map((b) => b.value), 1);
  const stacked = fontScale >= 1.4;
  return (
    <View testID="qt-stimulus-chart" accessible accessibilityRole="image" accessibilityLabel={`${stimulus.caption ? stimulus.caption + ". " : ""}${stimulus.alt}`}
      style={{ gap: 8, borderRadius: 18, borderWidth: 1, borderColor: qt.line, backgroundColor: "#FFFFFF", padding: 12 }}>
      {caption}
      {stimulus.y_label || stimulus.x_label ? (
        <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 14, color: qt.muted }}>
          {[stimulus.x_label, stimulus.y_label && `${stimulus.y_label}${stimulus.unit ? ` (${stimulus.unit})` : ""}`].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      {stimulus.bars.map((b, i) => (
        <View key={i} style={{ flexDirection: stacked ? "column" : "row", alignItems: stacked ? "stretch" : "center", gap: 6 }}>
          <Text style={{ width: stacked ? undefined : 96, fontFamily: "Nunito_700Bold", fontSize: 15, lineHeight: 21, color: qt.ink }}>{b.label}</Text>
          <View style={{ flex: stacked ? undefined : 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, height: 20, borderRadius: 6, backgroundColor: "#F1EEF5" }}>
              <View style={{ width: `${(b.value / max) * 100}%`, height: 20, borderRadius: 6, backgroundColor: qt.purple }} />
            </View>
            <Text style={{ minWidth: 44, textAlign: "right", fontFamily: "Nunito_800ExtraBold", fontSize: 15, color: qt.ink }}>
              {b.value}{stimulus.unit ? ` ${stimulus.unit}` : ""}
            </Text>
          </View>
        </View>
      ))}
      <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13, color: qt.muted }}>{t("prova.qt.child.stim.chartNote")}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// QT41 — Bölge seçme. Seçim: çizgili desen + onay işareti (renk tek başına anlam taşımaz).

function Hatch({ id }: { id: string }) {
  return (
    <Defs>
      <Pattern id={id} patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(45)">
        <Rect width={8} height={8} fill={qt.lilac} />
        <Line x1={0} y1={0} x2={0} y2={8} stroke={qt.purpleDark} strokeWidth={3} />
      </Pattern>
    </Defs>
  );
}
function SelectedMark() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", right: 4, top: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: qt.purpleDark, alignItems: "center", justifyContent: "center" }}>
      <Check size={16} color="#FFFFFF" />
    </View>
  );
}

function useMedia(questionId: string, enabled: boolean) {
  const { claims } = useSession();
  const media = useQuery({
    queryKey: ["question_media", claims?.family_id, claims?.child_id, questionId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_question_media", { p_question_ids: [questionId] });
      if (error) throw error;
      return (data as unknown as QuestionMediaItem[])[0] ?? null;
    },
  });
  const item = media.data ?? null;
  const url = useQuery({
    queryKey: ["question_image_url", claims?.family_id, claims?.child_id, item?.source_id, item?.question_id],
    enabled: !!item,
    staleTime: 60_000,
    queryFn: () => sourceAction<{ url: string }>({ action: "view", id: item!.source_id, question_id: item!.question_id }),
  });
  return { item, url: url.data?.url ?? null, failed: !!media.error || !!url.error || (media.isSuccess && !item), loading: media.isPending || (!!item && url.isPending) };
}

export function RegionSelectQuestion({ questionId, payload, answer, onChange, disabled }: {
  questionId: string; payload: Phase2bPayload<"region_select">; answer: Phase2bAnswerOf<"region_select"> | undefined; onChange: (a: Phase2bAnswerOf<"region_select">) => void; disabled: boolean;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const hatch = "hatch" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [note, setNote] = useState<string | null>(null);
  const [failedImage, setFailedImage] = useState(false);
  const selected = answer?.selected ?? [];
  const max = payload.max_select ?? payload.regions.length;
  const kind = payload.figure.kind;
  const media = useMedia(questionId, kind === "image");
  const on = (id: string) => selected.includes(id);
  const toggle = (id: string) => {
    if (disabled) return;
    const r = toggleSelected(selected, id, max);
    if (r.refused) { setNote(t("prova.qt.child.region.full", { count: max })); return; }
    setNote(null);
    onChange({ type: "region_select", v: 1, selected: r.next });
  };
  const label = (id: string, text: string) => `${text}. ${t(on(id) ? "prova.qt.child.sel.on" : "prova.qt.child.sel.off")}`;
  const size = Math.min(width - 72, 420);

  let figure: ReactNode = null;
  if (kind === "grid") {
    const cols = payload.figure.cols ?? 1;
    const cell = Math.max(48, Math.floor((size - (cols - 1) * 6) / cols));
    figure = (
      <View testID="qt-region-grid" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, width: cols * cell + (cols - 1) * 6, alignSelf: "center" }}>
        {payload.regions.map((r) => (
          <Pressable key={r.id} testID={`qt-region-${r.id}`} accessibilityRole="checkbox" accessibilityLabel={label(r.id, r.text)} accessibilityState={{ checked: on(r.id), disabled }} aria-checked={on(r.id)}
            disabled={disabled} onPress={() => toggle(r.id)}
            style={{ width: cell, height: cell, borderRadius: 10, borderWidth: on(r.id) ? 3 : 2, borderColor: on(r.id) ? qt.purpleDark : qt.muted, backgroundColor: "#FFFFFF", overflow: "hidden" }}>
            {on(r.id) ? <Svg width="100%" height="100%" aria-hidden><Hatch id={hatch} /><Rect width="100%" height="100%" fill={`url(#${hatch})`} /></Svg> : null}
            {on(r.id) ? <SelectedMark /> : null}
          </Pressable>
        ))}
      </View>
    );
  } else if (kind === "sectors") {
    const n = payload.regions.length;
    figure = (
      <View testID="qt-region-sectors" aria-hidden style={{ width: size * 0.8, height: size * 0.8, alignSelf: "center" }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Hatch id={hatch} />
          {payload.regions.map((r, i) => (
            <Path key={r.id} d={sectorPath(i, n)} fill={on(r.id) ? `url(#${hatch})` : "#FFFFFF"} stroke={qt.ink} strokeWidth={on(r.id) ? 1.6 : 0.8} onPress={() => toggle(r.id)} />
          ))}
          {payload.regions.map((r, i) => {
            const a = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
            return on(r.id) ? <Circle key={`c${r.id}`} cx={50 + 30 * Math.cos(a)} cy={50 + 30 * Math.sin(a)} r={5} fill={qt.purpleDark} /> : null;
          })}
          {payload.regions.map((r, i) => {
            const a = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
            return on(r.id) ? <SvgText key={`t${r.id}`} x={50 + 30 * Math.cos(a)} y={50 + 30 * Math.sin(a) + 2.4} fontSize={7} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">✓</SvgText> : null;
          })}
        </Svg>
      </View>
    );
  } else {
    const ratio = media.item && media.item.width > 0 && media.item.height > 0 ? media.item.width / media.item.height : 4 / 3;
    figure = media.url && !failedImage ? (
      <View testID="qt-region-image" style={{ width: size, aspectRatio: ratio, alignSelf: "center", borderRadius: 12, overflow: "hidden", backgroundColor: qt.cream }}>
        <Image source={{ uri: media.url }} accessibilityLabel={media.item?.alt} contentFit="fill" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} onError={() => setFailedImage(true)} />
        {payload.regions.map((r) => r.box ? (
          <Pressable key={r.id} testID={`qt-region-box-${r.id}`} accessibilityRole="checkbox" accessibilityLabel={label(r.id, r.text)} accessibilityState={{ checked: on(r.id), disabled }} aria-checked={on(r.id)}
            disabled={disabled} onPress={() => toggle(r.id)}
            style={{ position: "absolute", ...boxStyle(r.box), minWidth: 32, minHeight: 32, borderRadius: 8, borderWidth: on(r.id) ? 3 : 2, borderStyle: on(r.id) ? "solid" : "dashed", borderColor: on(r.id) ? qt.purpleDark : "#FFFFFF", backgroundColor: on(r.id) ? "rgba(77,50,187,0.25)" : "rgba(255,255,255,0.15)" }}>
            {on(r.id) ? <SelectedMark /> : null}
          </Pressable>
        ) : null)}
      </View>
    ) : (
      <Help>{media.loading && !failedImage ? t("common.loading") : t("prova.qt.child.region.imageFailed")}</Help>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <Help>{t(kind === "image" ? "prova.qt.child.region.helpImage" : "prova.qt.child.region.help")}{payload.max_select ? " " + t("prova.qt.child.mark.max", { count: payload.max_select }) : ""}</Help>
      <Counter testID="qt-region-count" count={selected.length} max={payload.max_select} />
      <StepNote testID="qt-region-note">{note}</StepNote>
      {figure}
      {/* Erişilebilir/klavye alternatifi ve görsel yüklenemezse tek yol: etiketli aç/kapa listesi. */}
      {kind !== "grid" ? (
        <View style={{ gap: 8 }}>
          <SectionTitle>{t("prova.qt.child.region.listTitle")}</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {payload.regions.map((r) => (
              <Pressable key={r.id} testID={`qt-region-${r.id}`} accessibilityRole="checkbox" accessibilityLabel={label(r.id, r.text)} accessibilityState={{ checked: on(r.id), disabled }} aria-checked={on(r.id)}
                disabled={disabled} onPress={() => toggle(r.id)}
                style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, borderWidth: on(r.id) ? 3 : 2, borderColor: on(r.id) ? qt.purpleDark : qt.line, backgroundColor: on(r.id) ? qt.lilac : "#FFFFFF", paddingHorizontal: 12 }}>
                {on(r.id) ? <Check size={18} color={qt.purpleDark} /> : null}
                <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: qt.ink }}>{r.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// QT41 — Saat. Okuma: yüz `shown_time`'dan; çocuk saat/dakika düğmeleriyle seçer (serbest metin yok).
// Kurma: çocuk düğmelerle akrep/yelkovanı kurar; sürükleme yok (zorunlu değil).

export function ClockFace({ time, display, size, testID, label }: { time: string | null; display: "analog" | "digital"; size: number; testID: string; label: string }) {
  if (display === "digital") {
    return (
      <View testID={testID} accessible accessibilityLabel={label} style={{ alignSelf: "center", borderRadius: 18, backgroundColor: qt.ink, paddingHorizontal: 24, paddingVertical: 12 }}>
        <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 44, letterSpacing: 2, color: "#FFFFFF" }}>{time ?? "--:--"}</Text>
      </View>
    );
  }
  const a = time ? handAngles(time) : null;
  const hand = (deg: number, len: number) => {
    const r = ((deg - 90) * Math.PI) / 180;
    return { x2: 50 + len * Math.cos(r), y2: 50 + len * Math.sin(r) };
  };
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size, alignSelf: "center" }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={47} fill="#FFFFFF" stroke={qt.ink} strokeWidth={2.5} />
        {Array.from({ length: 60 }, (_, i) => {
          const r = (i * 6 - 90) * (Math.PI / 180), long = i % 5 === 0;
          return <Line key={i} x1={50 + (long ? 39 : 42) * Math.cos(r)} y1={50 + (long ? 39 : 42) * Math.sin(r)} x2={50 + 45 * Math.cos(r)} y2={50 + 45 * Math.sin(r)} stroke={qt.ink} strokeWidth={long ? 1.6 : 0.6} />;
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const n = i + 1, r = (n * 30 - 90) * (Math.PI / 180);
          return <SvgText key={n} x={50 + 32 * Math.cos(r)} y={50 + 32 * Math.sin(r) + 3.2} fontSize={9} fontWeight="bold" fill={qt.ink} textAnchor="middle">{n}</SvgText>;
        })}
        {a ? <Line x1={50} y1={50} {...hand(a.hour, 22)} stroke={qt.ink} strokeWidth={4.5} strokeLinecap="round" /> : null}
        {a ? <Line x1={50} y1={50} {...hand(a.minute, 36)} stroke={qt.purple} strokeWidth={2.8} strokeLinecap="round" /> : null}
        <Circle cx={50} cy={50} r={3} fill={qt.ink} />
      </Svg>
    </View>
  );
}

function Stepper({ label, value, onMinus, onPlus, disabled, testID }: { label: string; value: string; onMinus: () => void; onPlus: () => void; disabled: boolean; testID: string }) {
  const { t } = useTranslation();
  const btn = (kind: "minus" | "plus") => (
    <Pressable testID={`${testID}-${kind}`} accessibilityRole="button" accessibilityLabel={t(`prova.qt.child.clock.${kind}`, { what: label })} disabled={disabled}
      onPress={kind === "minus" ? onMinus : onPlus}
      style={{ width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: disabled ? "#F4F1F7" : qt.lilac, borderWidth: 2, borderColor: qt.purple }}>
      {kind === "minus" ? <Minus size={24} color={qt.purpleDark} /> : <Plus size={24} color={qt.purpleDark} />}
    </Pressable>
  );
  return (
    <View style={{ flexGrow: 1, flexBasis: 150, alignItems: "center", gap: 6 }}>
      <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: qt.muted }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {btn("minus")}
        <Text testID={`${testID}-value`} accessibilityLabel={`${label}: ${value}`} style={{ minWidth: 48, textAlign: "center", fontFamily: "Nunito_800ExtraBold", fontSize: 30, color: qt.ink }}>{value}</Text>
        {btn("plus")}
      </View>
    </View>
  );
}

export function ClockQuestion({ payload, answer, onChange, disabled }: {
  payload: Phase2bPayload<"clock">; answer: Phase2bAnswerOf<"clock"> | undefined; onChange: (a: Phase2bAnswerOf<"clock">) => void; disabled: boolean;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const time = answer?.time;
  const step = payload.step_minutes;
  const mStep = minuteStep(step);
  const set = (delta: { hours?: number; minutes?: number }) => onChange({ type: "clock", v: 1, time: stepClock(time, delta, step) });
  const hh = time ? time.slice(0, 2) : "--", mm = time ? time.slice(3) : "--";
  const read = payload.mode === "read";
  const face = Math.min(260, width - 96);
  return (
    <View style={{ gap: 14 }}>
      <Help>{t(read ? "prova.qt.child.clock.helpRead" : "prova.qt.child.clock.helpSet")}{" "}{mStep ? t("prova.qt.child.clock.step", { count: step }) : t("prova.qt.child.clock.stepHour")}</Help>
      {read ? (
        // Okuma modunda yüzün erişilebilir etiketi saati SÖYLEMEZ (aksi halde cevap verilmiş olur).
        <ClockFace testID="qt-clock-shown" time={payload.shown_time ?? null} display={payload.display} size={face} label={t(payload.display === "analog" ? "prova.qt.child.clock.analogFace" : "prova.qt.child.clock.digitalFace")} />
      ) : (
        <ClockFace testID="qt-clock-set" time={time ?? null} display={payload.display} size={face} label={time ? t("prova.qt.child.clock.yourTime", { time }) : t("prova.qt.child.clock.notSet")} />
      )}
      <SectionTitle>{t(read ? "prova.qt.child.clock.yourAnswer" : "prova.qt.child.clock.setTitle")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        <Stepper testID="qt-clock-hour" label={t("prova.qt.child.clock.hour")} value={hh} disabled={disabled} onMinus={() => set({ hours: -1 })} onPlus={() => set({ hours: 1 })} />
        {mStep ? <Stepper testID="qt-clock-minute" label={t("prova.qt.child.clock.minute")} value={mm} disabled={disabled} onMinus={() => set({ minutes: -mStep })} onPlus={() => set({ minutes: mStep })} /> : null}
      </View>
      <Text testID="qt-clock-answer" accessibilityLiveRegion="polite" style={{ alignSelf: "center", fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: qt.ink }}>
        {time ? t("prova.qt.child.clock.yourTime", { time }) : t("prova.qt.child.clock.notSet")}
      </Text>
    </View>
  );
}
