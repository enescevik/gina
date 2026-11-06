/**
 * QT30–QT33 (Faz 2A), QT41/QT42 (Faz 2B) — veli hazırlama düzenleyicisi + salt okunur önizleme + uyaran
 * (tablo / çubuk grafik) düzenleyicisi. Model core'da (`question-authoring-p2.ts`). Faz anahtarları kapalıyken
 * bu bileşenler hiç gösterilmez (question-types/support.ts).
 */
import {
  addImageBox,
  type Phase2Draft,
  reconcileTokens,
  regionList,
  resizeImageBox,
  type StimulusDraft,
  splitPassage,
} from "@gina/core";
import { Image } from "expo-image";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { p } from "@/components/planner/ui";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { Toggle } from "@/components/ui/toggle";
import type { LocalLearningFile } from "@/lib/learning-files";
import { BuilderChoice } from "./prova-builder-ui";

type Of<T extends Phase2Draft["type"]> = Extract<Phase2Draft, { type: T }>;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function Chips<V extends string | number>({ values, value, label, onChange, disabled }: { values: readonly V[]; value: V; label: (v: V) => string; onChange: (v: V) => void; disabled?: boolean }) {
  return (
    <View style={s.wrap}>
      {values.map((v) => <BuilderChoice key={String(v)} label={label(v)} selected={value === v} disabled={disabled} onPress={() => onChange(v)} />)}
    </View>
  );
}

/** Seçenek satırları (çoklu doğru / iki aşama): metin + doğru işareti + sil; kimlik satırla birlikte yaşar. */
function OptionRows({ rows, prefix, correct, multi, onChange, onCorrect, disabled, testID, minRows, maxRows, seq }: {
  rows: { id: string; text: string }[]; prefix: string; correct: string[]; multi: boolean; testID: string; minRows: number; maxRows: number; seq: number;
  /** Satırlar + (silmede) temizlenmiş doğru listesi tek değişiklikte. */
  onChange: (rows: { id: string; text: string }[], correct?: string[]) => void; onCorrect: (ids: string[]) => void; disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.gap} testID={testID}>
      {rows.map((r, i) => (
        <View key={r.id} style={s.row} testID={`qt-row-${r.id}`}>
          <Field label={t("prova.qt.author.p2.option", { letter: LETTERS[i] })} value={r.text} editable={!disabled} maxLength={500}
            onChangeText={(text) => onChange(rows.map((x) => (x.id === r.id ? { ...x, text } : x)))} />
          <View style={[s.wrap, { justifyContent: "space-between", alignItems: "center" }]}>
            <BuilderChoice label={t("prova.qt.author.p2.correct")} selected={correct.includes(r.id)} disabled={disabled}
              onPress={() => onCorrect(correct.includes(r.id) ? correct.filter((x) => x !== r.id) : multi ? [...correct, r.id] : [r.id])} />
            <Pressable accessibilityRole="button" accessibilityLabel={t("prova.qt.author.remove", { label: t("prova.qt.author.p2.option", { letter: LETTERS[i] }) })}
              disabled={disabled || rows.length <= minRows} onPress={() => onChange(rows.filter((x) => x.id !== r.id), correct.filter((x) => x !== r.id))}
              style={[s.icon, (disabled || rows.length <= minRows) && { opacity: 0.35 }]}>
              <Trash2 size={20} color="#A43135" />
            </Pressable>
          </View>
        </View>
      ))}
      <BuilderChoice label={`+ ${t("prova.qt.author.p2.addOption")}`} selected={false} disabled={disabled || rows.length >= maxRows}
        onPress={() => onChange([...rows, { id: `${prefix}${seq + 1}`, text: "" }])} />
    </View>
  );
}

/** Parçalı metin: kimlikli birimlere dokunarak seç (hedef ya da hatalı). */
function TokenPicker({ draft, selected, onToggle, disabled }: { draft: { passage: string; unit: "word" | "sentence"; tokens: { id: string; text: string }[] }; selected: string[]; onToggle: (id: string) => void; disabled?: boolean }) {
  const parts = splitPassage(draft.passage, draft.unit);
  let i = 0;
  return (
    <View style={[s.wrap, { gap: 4 }]} testID="qt-token-picker">
      {parts.map((part, n) => {
        if (!part.unit) return part.text.trim() ? <Text key={n} style={s.copy}>{part.text.trim()}</Text> : null;
        const tok = draft.tokens[i++];
        if (!tok) return null;
        const on = selected.includes(tok.id);
        return (
          <Pressable key={tok.id} testID={`qt-token-${tok.id}`} accessibilityRole="button" accessibilityLabel={tok.text} accessibilityState={{ selected: on }} aria-pressed={on}
            disabled={disabled} onPress={() => onToggle(tok.id)} style={[s.token, on && s.tokenOn]}>
            <Text style={[s.copy, on && { color: p.purple, fontFamily: "Nunito_800ExtraBold", textDecorationLine: "underline" }]}>{tok.text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Görsel üzerinde dokunarak kutu yerleştirme (kutular normalize 0–1). */
function BoxPlacer({ image, draft, onChange, disabled }: { image: LocalLearningFile | null; draft: Of<"region_select">; onChange: (d: Phase2Draft) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const [size, setSize] = useState({ w: 0, h: 0 });
  if (!image) return <Text style={s.muted} testID="qt-region-no-image">{t("prova.qt.author.region.needImage")}</Text>;
  const ratio = image.width && image.height ? image.width / image.height : 4 / 3;
  return (
    <View style={s.gap}>
      <Text style={s.muted}>{t("prova.qt.author.region.tapHelp")}</Text>
      <Pressable
        testID="qt-box-placer"
        accessibilityRole="button"
        accessibilityLabel={t("prova.qt.author.region.tapLabel")}
        disabled={disabled || draft.boxes.length >= 48}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        onPress={(e) => {
          const ne = e.nativeEvent as unknown as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number };
          const x = ne.locationX ?? ne.offsetX ?? 0, y = ne.locationY ?? ne.offsetY ?? 0;
          if (!size.w || !size.h) return;
          onChange(addImageBox(draft, Math.min(1, Math.max(0, x / size.w)), Math.min(1, Math.max(0, y / size.h))));
        }}
        style={{ width: "100%", aspectRatio: ratio, borderRadius: 12, overflow: "hidden", backgroundColor: "#F2EFF6" }}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={{ uri: image.uri }} contentFit="fill" style={{ width: "100%", height: "100%" }} accessibilityLabel={t("prova.qt.author.region.imageAlt")} />
          {draft.boxes.map((b, i) => (
            <View key={b.id} style={[s.box, { left: `${b.box[0] * 100}%`, top: `${b.box[1] * 100}%`, width: `${b.box[2] * 100}%`, height: `${b.box[3] * 100}%` }, draft.targets.includes(b.id) && s.boxOn]}>
              <Text style={s.boxLabel}>{LETTERS[i]}</Text>
            </View>
          ))}
        </View>
      </Pressable>
      {draft.boxes.map((b, i) => (
        <View key={b.id} style={s.row} testID={`qt-row-${b.id}`}>
          <Field label={t("prova.qt.author.region.boxLabel", { letter: LETTERS[i] })} value={b.text} editable={!disabled} maxLength={120}
            onChangeText={(text) => onChange({ ...draft, boxes: draft.boxes.map((x) => (x.id === b.id ? { ...x, text } : x)) })} />
          <Chips values={[0.12, 0.2, 0.3] as const} value={b.box[2] as 0.12 | 0.2 | 0.3} disabled={disabled}
            label={(v) => t(v === 0.12 ? "prova.qt.author.region.small" : v === 0.2 ? "prova.qt.author.region.medium" : "prova.qt.author.region.large")}
            onChange={(v) => onChange(resizeImageBox(draft, b.id, v))} />
          <View style={[s.wrap, { justifyContent: "space-between" }]}>
            <BuilderChoice label={t("prova.qt.author.p2.correct")} selected={draft.targets.includes(b.id)} disabled={disabled}
              onPress={() => onChange({ ...draft, targets: draft.targets.includes(b.id) ? draft.targets.filter((x) => x !== b.id) : [...draft.targets, b.id] })} />
            <Pressable accessibilityRole="button" accessibilityLabel={t("prova.qt.author.remove", { label: t("prova.qt.author.region.boxLabel", { letter: LETTERS[i] }) })} disabled={disabled}
              onPress={() => onChange({ ...draft, boxes: draft.boxes.filter((x) => x.id !== b.id), targets: draft.targets.filter((x) => x !== b.id) })} style={s.icon}>
              <Trash2 size={20} color="#A43135" />
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

export function Phase2QuestionEditor({ draft, onChange, image, disabled = false }: { draft: Phase2Draft; onChange: (d: Phase2Draft) => void; image: LocalLearningFile | null; disabled?: boolean }) {
  const { t } = useTranslation();
  const set = (patch: Partial<Phase2Draft>) => onChange({ ...draft, ...patch } as Phase2Draft);
  switch (draft.type) {
    case "mark_text":
    case "error_fix": {
      const d = draft;
      const selected = d.type === "mark_text" ? d.targets : Object.keys(d.errors);
      return (
        <View style={s.gap} testID={`qt-editor-${d.type}`}>
          <Chips values={["word", "sentence"] as const} value={d.unit} disabled={disabled} label={(v) => t(`prova.qt.author.p2.unit_${v}`)}
            onChange={(unit) => onChange(reconcileTokens(d, d.passage, unit))} />
          <Field label={t("prova.qt.author.p2.passage")} hint={t(d.type === "mark_text" ? "prova.qt.author.p2.passageHintMark" : "prova.qt.author.p2.passageHintFix")}
            value={d.passage} multiline editable={!disabled} maxLength={6000} onChangeText={(passage) => onChange(reconcileTokens(d, passage))} className="min-h-24" />
          <Text style={s.label}>{t(d.type === "mark_text" ? "prova.qt.author.p2.pickTargets" : "prova.qt.author.p2.pickErrors")}</Text>
          <TokenPicker draft={d} selected={selected} disabled={disabled}
            onToggle={(id) => d.type === "mark_text"
              ? onChange({ ...d, targets: d.targets.includes(id) ? d.targets.filter((x) => x !== id) : [...d.targets, id] })
              : onChange({ ...d, errors: id in d.errors ? Object.fromEntries(Object.entries(d.errors).filter(([k]) => k !== id)) : { ...d.errors, [id]: "" } })} />
          {d.type === "mark_text"
            ? <Field label={t("prova.qt.author.p2.maxSelect")} hint={t("prova.qt.author.p2.maxSelectHint")} keyboardType="number-pad" value={d.maxSelect} maxLength={3} editable={!disabled} onChangeText={(maxSelect) => set({ maxSelect })} />
            : (
              <>
                {Object.keys(d.errors).map((id) => (
                  <Field key={id} label={t("prova.qt.author.p2.fixFor", { word: d.tokens.find((x) => x.id === id)?.text ?? "" })} hint={t("prova.qt.author.p2.fixHint")}
                    value={d.errors[id] ?? ""} editable={!disabled} maxLength={500} onChangeText={(v) => onChange({ ...d, errors: { ...d.errors, [id]: v } })} />
                ))}
                <Toggle label={t("prova.qt.author.fill.caseInsensitive")} value={d.caseInsensitive} disabled={disabled} onChange={(caseInsensitive) => set({ caseInsensitive })} />
                <Toggle label={t("prova.qt.author.p2.reviewUnmatched")} value={d.reviewUnmatched} disabled={disabled} onChange={(reviewUnmatched) => set({ reviewUnmatched })} />
              </>
            )}
        </View>
      );
    }
    case "multi_choice": {
      const d = draft;
      return (
        <View style={s.gap} testID="qt-editor-multi_choice">
          <Text style={s.muted}>{t("prova.qt.author.p2.multiHelp")}</Text>
          <OptionRows rows={d.options} prefix="o" correct={d.correct} multi testID="qt-multi-options" minRows={3} maxRows={8} seq={d.seq} disabled={disabled}
            onChange={(options, correct) => onChange({ ...d, options, correct: correct ?? d.correct, seq: Math.max(d.seq, ...options.map((o) => Number(o.id.slice(1)) || 0)) })}
            onCorrect={(correct) => set({ correct })} />
          <Toggle label={t("prova.qt.author.p2.tellCount")} value={d.tellCount} disabled={disabled} onChange={(tellCount) => set({ tellCount })} />
        </View>
      );
    }
    case "two_stage": {
      const d = draft;
      const bump = (ids: string[]) => Math.max(d.seq, ...ids.map((x) => Number(x.slice(1)) || 0));
      return (
        <View style={s.gap} testID="qt-editor-two_stage">
          <Field label={t("prova.qt.author.p2.stage1")} value={d.prompt1} multiline editable={!disabled} maxLength={1000} onChangeText={(prompt1) => set({ prompt1 })} className="min-h-16" />
          <OptionRows rows={d.options1} prefix="a" correct={d.correct1 ? [d.correct1] : []} multi={false} testID="qt-stage1-options" minRows={2} maxRows={6} seq={d.seq} disabled={disabled}
            onChange={(options1, c) => set({ options1, seq: bump(options1.map((o) => o.id)), ...(c ? { correct1: c[0] ?? null } : {}) })} onCorrect={(c) => set({ correct1: c[0] ?? null })} />
          <Field label={t("prova.qt.author.p2.stage2")} hint={t("prova.qt.author.p2.stage2Hint")} value={d.prompt2} multiline editable={!disabled} maxLength={1000} onChangeText={(prompt2) => set({ prompt2 })} className="min-h-16" />
          <Chips values={["choice", "text"] as const} value={d.mode2} disabled={disabled} label={(v) => t(`prova.qt.author.p2.mode2_${v}`)} onChange={(mode2) => set({ mode2 })} />
          {d.mode2 === "choice"
            ? (
              <OptionRows rows={d.options2} prefix="g" correct={d.correct2 ? [d.correct2] : []} multi={false} testID="qt-stage2-options" minRows={2} maxRows={6} seq={d.seq} disabled={disabled}
                onChange={(options2, c) => set({ options2, seq: bump(options2.map((o) => o.id)), ...(c ? { correct2: c[0] ?? null } : {}) })} onCorrect={(c) => set({ correct2: c[0] ?? null })} />
            )
            : <Text style={s.muted}>{t("prova.qt.author.p2.stage2Text")}</Text>}
        </View>
      );
    }
    case "region_select": {
      const d = draft;
      const regions = regionList(d);
      return (
        <View style={s.gap} testID="qt-editor-region_select">
          <Chips values={["grid", "sectors", "image"] as const} value={d.figure} disabled={disabled} label={(v) => t(`prova.qt.author.region.figure_${v}`)}
            onChange={(figure) => set({ figure, targets: [], keyMode: figure === "image" ? "targets" : d.keyMode })} />
          {d.figure === "grid"
            ? (
              <>
                <Text style={s.label}>{t("prova.qt.author.region.rows")}</Text>
                <Chips values={[1, 2, 3, 4, 5, 6, 7, 8] as const} value={d.rows as 1} disabled={disabled} label={String} onChange={(rows) => set({ rows, targets: [] })} />
                <Text style={s.label}>{t("prova.qt.author.region.cols")}</Text>
                <Chips values={[1, 2, 3, 4, 5, 6, 7, 8] as const} value={d.cols as 1} disabled={disabled} label={String} onChange={(cols) => set({ cols, targets: [] })} />
              </>
            )
            : d.figure === "sectors"
            ? (
              <>
                <Text style={s.label}>{t("prova.qt.author.region.sectors")}</Text>
                <Chips values={[2, 3, 4, 5, 6, 8, 10, 12] as const} value={d.sectors as 2} disabled={disabled} label={String} onChange={(sectors) => set({ sectors, targets: [] })} />
              </>
            )
            : <BoxPlacer image={image} draft={d} onChange={onChange} disabled={disabled} />}
          {d.figure !== "image"
            ? (
              <>
                <Text style={s.label}>{t("prova.qt.author.region.keyMode")}</Text>
                <Chips values={["targets", "count"] as const} value={d.keyMode} disabled={disabled} label={(v) => t(`prova.qt.author.region.key_${v}`)} onChange={(keyMode) => set({ keyMode })} />
                {d.keyMode === "targets"
                  ? (
                    <View style={s.wrap} testID="qt-region-targets">
                      {regions.map((r) => (
                        <BuilderChoice key={r.id} label={r.text} selected={d.targets.includes(r.id)} disabled={disabled}
                          onPress={() => set({ targets: d.targets.includes(r.id) ? d.targets.filter((x) => x !== r.id) : [...d.targets, r.id] })} />
                      ))}
                    </View>
                  )
                  : <Field label={t("prova.qt.author.region.count", { total: regions.length })} keyboardType="number-pad" value={d.count} maxLength={2} editable={!disabled} onChangeText={(count) => set({ count })} />}
              </>
            )
            : null}
          <Field label={t("prova.qt.author.p2.maxSelect")} hint={t("prova.qt.author.p2.maxSelectHint")} keyboardType="number-pad" value={d.maxSelect} maxLength={2} editable={!disabled} onChangeText={(maxSelect) => set({ maxSelect })} />
        </View>
      );
    }
    case "clock": {
      const d = draft;
      return (
        <View style={s.gap} testID="qt-editor-clock">
          <Chips values={["read", "set"] as const} value={d.mode} disabled={disabled} label={(v) => t(`prova.qt.author.clock.mode_${v}`)} onChange={(mode) => set({ mode })} />
          <Chips values={["analog", "digital"] as const} value={d.display} disabled={disabled} label={(v) => t(`prova.qt.author.clock.display_${v}`)} onChange={(display) => set({ display })} />
          <Text style={s.label}>{t("prova.qt.author.clock.step")}</Text>
          <Chips values={[1, 5, 15, 30, 60] as const} value={d.step} disabled={disabled} label={(v) => t("prova.qt.author.clock.stepN", { count: v })} onChange={(step) => set({ step })} />
          <Field label={t(d.mode === "read" ? "prova.qt.author.clock.timeRead" : "prova.qt.author.clock.timeSet")} hint={t("prova.qt.author.clock.timeHint")}
            value={d.time} maxLength={5} editable={!disabled} onChangeText={(time) => set({ time })} />
          <Toggle label={t("prova.qt.author.clock.accept12h")} value={d.accept12h} disabled={disabled} onChange={(accept12h) => set({ accept12h })} />
        </View>
      );
    }
  }
}

export function StimulusEditor({ draft, onChange, disabled = false }: { draft: StimulusDraft; onChange: (d: StimulusDraft) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[s.gap, s.stimBox]} testID="qt-stimulus-editor">
      <Text style={s.label}>{t("prova.qt.author.stim.title")}</Text>
      <Chips values={["none", "table", "bar_chart"] as const} value={draft.kind} disabled={disabled} label={(v) => t(`prova.qt.author.stim.kind_${v}`)} onChange={(kind) => onChange({ ...draft, kind })} />
      {draft.kind !== "none"
        ? (
          <>
            <Field label={t(draft.kind === "table" ? "prova.qt.author.stim.tableText" : "prova.qt.author.stim.chartText")}
              hint={t(draft.kind === "table" ? "prova.qt.author.stim.tableHint" : "prova.qt.author.stim.chartHint")}
              value={draft.text} multiline editable={!disabled} maxLength={3000} onChangeText={(text) => onChange({ ...draft, text })} className="min-h-24" />
            {draft.kind === "bar_chart"
              ? <Field label={t("prova.qt.author.stim.unit")} value={draft.unit} maxLength={40} editable={!disabled} onChangeText={(unit) => onChange({ ...draft, unit })} />
              : null}
            <Field label={t("prova.qt.author.stim.caption")} value={draft.caption} maxLength={200} editable={!disabled} onChangeText={(caption) => onChange({ ...draft, caption })} />
            <Field label={t("prova.qt.author.stim.alt")} hint={t("prova.qt.author.stim.altHint")} value={draft.alt} multiline maxLength={1000} editable={!disabled}
              onChangeText={(alt) => onChange({ ...draft, alt })} />
          </>
        )
        : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
type Entry = { id: string; text: string };
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const list = (v: unknown): Entry[] => (Array.isArray(v) ? v.filter((x): x is Entry => !!x && typeof x === "object" && typeof (x as Entry).id === "string") : []);

/** Uyaran önizlemesi (tablo / çubuk grafik); her yapılandırılmış türün üstünde. Alternatif metin ekran okuyucuya. */
export function StimulusPreview({ stimulus }: { stimulus: unknown }) {
  const st = rec(stimulus);
  if (st.kind !== "table" && st.kind !== "bar_chart") return null;
  return (
    <View testID="qt-stimulus-preview" accessible accessibilityLabel={String(st.alt ?? "")} style={[s.gap, s.stimBox]}>
      {st.caption ? <Text style={s.bold}>{String(st.caption)}</Text> : null}
      {st.kind === "table"
        ? (
          <View style={{ borderWidth: 1, borderColor: "#DDD6E8", borderRadius: 12, overflow: "hidden" }}>
            {[st.columns as unknown[], ...((st.rows as unknown[][]) ?? [])].map((row, i) => (
              <View key={i} style={{ flexDirection: "row", backgroundColor: i === 0 ? p.lilac : "#FFFFFF" }}>
                {(Array.isArray(row) ? row : []).map((c, j) => <Text key={j} style={[s.copy, { flex: 1, padding: 8, fontSize: 15 }, i === 0 && { fontFamily: "Nunito_800ExtraBold" }]}>{String(c)}</Text>)}
              </View>
            ))}
          </View>
        )
        : (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 150 }}>
            {((st.bars as { label: string; value: number }[]) ?? []).map((b, i, all) => {
              const max = Math.max(1, ...all.map((x) => Number(x.value) || 0));
              return (
                <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <Text style={s.muted}>{String(b.value)}</Text>
                  <View style={{ width: "70%", height: `${Math.max(2, ((Number(b.value) || 0) / max) * 75)}%`, backgroundColor: "#B9A8EE", borderRadius: 6 }} />
                  <Text style={[s.muted, { textAlign: "center" }]} numberOfLines={2}>{b.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      {st.kind === "bar_chart" && st.unit ? <Text style={s.muted}>{String(st.unit)}</Text> : null}
    </View>
  );
}

/** 2A/2B salt okunur önizleme; `answerKey` yalnız veli “doğru cevapları göster” dediğinde. */
export function Phase2QuestionPreview({ type, payload, answerKey, image }: { type: string; payload: unknown; answerKey?: unknown; image?: string | null }) {
  const { t } = useTranslation();
  const pl = rec(payload), key = answerKey ? rec(answerKey) : null;
  const chip = (label: string, on = false, k?: string) => (
    <View key={k ?? label} style={[s.chip, on && s.chipOn]}><Text style={[s.copy, on && { color: p.purple, fontFamily: "Nunito_800ExtraBold" }]}>{label}</Text></View>
  );
  if (type === "mark_text" || type === "error_fix") {
    const targets: string[] = type === "mark_text" ? (Array.isArray(key?.targets) ? key.targets as string[] : []) : Object.keys(rec(key?.errors));
    return (
      <View style={s.gap}>
        <Text style={[s.copy, { lineHeight: 30 }]}>
          {(Array.isArray(pl.segments) ? pl.segments : []).map(rec).map((seg, i) => (
            <Text key={i} style={typeof seg.id === "string" && targets.includes(seg.id) ? { color: p.purple, fontFamily: "Nunito_800ExtraBold", textDecorationLine: "underline" } : undefined}>
              {String(seg.text)}
              {type === "error_fix" && key && typeof seg.id === "string" && targets.includes(seg.id)
                ? ` (→ ${((rec(rec(key.errors)[seg.id]).accepted as string[] | undefined) ?? []).join(" / ")})` : ""}
            </Text>
          ))}
        </Text>
        <Text style={s.muted}>{t(type === "mark_text" ? "prova.qt.author.preview.markHelp" : "prova.qt.author.preview.fixHelp")}</Text>
      </View>
    );
  }
  if (type === "multi_choice") {
    const correct = Array.isArray(key?.correct) ? key.correct as string[] : [];
    return (
      <View style={s.gap}>
        {typeof pl.select_count === "number" ? <Text style={s.muted}>{t("prova.qt.author.preview.selectCount", { count: pl.select_count })}</Text> : null}
        {list(pl.options).map((o, i) => chip(`${LETTERS[i]} · ${o.text}`, correct.includes(o.id), o.id))}
      </View>
    );
  }
  if (type === "two_stage") {
    const s1 = rec(pl.stage1), s2 = rec(pl.stage2);
    return (
      <View style={s.gap}>
        <Text style={s.bold}>1. {String(s1.prompt ?? "")}</Text>
        <View style={s.wrap}>{list(s1.options).map((o, i) => chip(`${LETTERS[i]} · ${o.text}`, key?.stage1 === o.id, o.id))}</View>
        <Text style={s.bold}>2. {String(s2.prompt ?? "")}</Text>
        {s2.mode === "choice"
          ? <View style={s.wrap}>{list(s2.options).map((o, i) => chip(`${LETTERS[i]} · ${o.text}`, key?.stage2 === o.id, o.id))}</View>
          : <Text style={s.muted}>{t("prova.qt.author.p2.stage2Text")}</Text>}
      </View>
    );
  }
  if (type === "region_select") {
    const f = rec(pl.figure), regions = list(pl.regions);
    const targets = Array.isArray(key?.targets) ? key.targets as string[] : [];
    return (
      <View style={s.gap}>
        {f.kind === "image" && image
          ? (
            <View style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 12, overflow: "hidden" }}>
              <Image source={{ uri: image }} contentFit="fill" style={{ width: "100%", height: "100%" }} accessibilityLabel={t("prova.qt.author.region.imageAlt")} />
              {(Array.isArray(pl.regions) ? pl.regions : []).map(rec).map((r, i) => {
                const b = r.box as number[] | undefined;
                return b ? <View key={String(r.id)} style={[s.box, { left: `${b[0]! * 100}%`, top: `${b[1]! * 100}%`, width: `${b[2]! * 100}%`, height: `${b[3]! * 100}%` }, targets.includes(String(r.id)) && s.boxOn]}><Text style={s.boxLabel}>{LETTERS[i]}</Text></View> : null;
              })}
            </View>
          )
          : null}
        <View style={s.wrap}>{regions.map((r) => chip(r.text, targets.includes(r.id), r.id))}</View>
        {typeof key?.count === "number" ? <Text style={s.muted}>{t("prova.qt.author.preview.regionCount", { count: key.count })}</Text> : null}
      </View>
    );
  }
  if (type === "clock") {
    return (
      <View style={s.gap}>
        <View style={s.answerBox}><Text style={[s.copy, { fontSize: 24 }]}>{pl.mode === "read" ? String(pl.shown_time ?? "") : key ? String(key.time ?? "") : "--:--"}</Text></View>
        <Text style={s.muted}>{t(pl.mode === "read" ? "prova.qt.author.preview.clockRead" : "prova.qt.author.preview.clockSet", { display: t(`prova.qt.author.clock.display_${String(pl.display)}`) })}</Text>
      </View>
    );
  }
  return null;
}

const s = StyleSheet.create({
  gap: { gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { gap: 8, borderWidth: 1, borderColor: p.line, borderRadius: 20, padding: 12, backgroundColor: "#FFFEFB" },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: p.lilac },
  label: { fontFamily: "Nunito_800ExtraBold", fontSize: 17, lineHeight: 24, color: p.ink },
  bold: { fontFamily: "Nunito_800ExtraBold", fontSize: 16, lineHeight: 22, color: p.ink },
  copy: { fontFamily: "Nunito_600SemiBold", fontSize: 17, lineHeight: 25, color: p.ink, flexShrink: 1 },
  muted: { fontFamily: "Nunito_600SemiBold", fontSize: 15, lineHeight: 22, color: p.muted },
  token: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: "#E5DDED", backgroundColor: "#FFFEFB" },
  tokenOn: { backgroundColor: p.lilac, borderColor: "#9C81E8" },
  box: { position: "absolute", borderWidth: 2, borderStyle: "dashed", borderColor: "#5132BD", borderRadius: 6, backgroundColor: "#FFFFFF33" },
  boxOn: { backgroundColor: "#6042DE40", borderStyle: "solid" },
  boxLabel: { fontFamily: "Nunito_800ExtraBold", color: "#5132BD", fontSize: 13, paddingHorizontal: 3, backgroundColor: "#FFFFFFCC", alignSelf: "flex-start" },
  stimBox: { borderWidth: 1, borderColor: "#E4DCF1", borderRadius: 16, padding: 12, backgroundColor: "#FCFAF6" },
  chip: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: "#E5DDED", borderRadius: 16, backgroundColor: "#FFFEFB", justifyContent: "center", maxWidth: "100%" },
  chipOn: { backgroundColor: p.lilac, borderColor: "#9C81E8" },
  answerBox: { minHeight: 52, borderWidth: 1.5, borderColor: "#DDD6E8", borderRadius: 17, paddingHorizontal: 16, justifyContent: "center", backgroundColor: "#FFFFFF", alignSelf: "flex-start" },
});
