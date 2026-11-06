import type { Phase2aAnswerOf, Phase2aPayload } from "@gina/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, TextInput, View } from "react-native";
import { Check } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { Passage } from "./passage";
import { markTextMax, multiChoiceMax, setFix, setStage, toggleMark, toggleSelected } from "./phase2a-model";
import { Help, Option, SectionTitle, StepNote, qt } from "./ui";

function Counter({ count, max, testID }: { count: number; max?: number; testID: string }) {
  const { t } = useTranslation();
  return (
    <Text testID={testID} accessibilityLiveRegion="polite" style={{ alignSelf: "flex-start", fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: qt.ink, backgroundColor: qt.lilac, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
      {max !== undefined ? t("prova.qt.child.sel.countOf", { count, max }) : t("prova.qt.child.sel.count", { count })}
    </Text>
  );
}

/** QT30 — Metin içinde kelime/cümle işaretleme. Dokun → seç/bırak; sınır `max_select`; "hepsini seç" yok. */
export function MarkTextQuestion({ payload, answer, onChange, disabled }: {
  payload: Phase2aPayload<"mark_text">; answer: Phase2aAnswerOf<"mark_text"> | undefined; onChange: (a: Phase2aAnswerOf<"mark_text">) => void; disabled: boolean;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState<string | null>(null);
  const selected = answer?.selected ?? [];
  const max = markTextMax(payload);
  const word = payload.unit === "word";
  return (
    <View style={{ gap: 12 }}>
      <Help>{t(word ? "prova.qt.child.mark.helpWord" : "prova.qt.child.mark.helpSentence")}{payload.max_select ? " " + t("prova.qt.child.mark.max", { count: payload.max_select }) : ""}</Help>
      <Counter testID="qt-mark-count" count={selected.length} max={payload.max_select} />
      <StepNote testID="qt-mark-note">{note}</StepNote>
      <Passage
        testPrefix="qt-mark"
        segments={payload.segments}
        unit={payload.unit}
        disabled={disabled}
        selected={(id) => selected.includes(id)}
        a11y={(text, on) => `${text}. ${t(on ? "prova.qt.child.sel.on" : "prova.qt.child.sel.off")}`}
        onToggle={(id) => {
          const r = toggleSelected(selected, id, max);
          if (r.refused) { setNote(t("prova.qt.child.mark.full", { count: max })); return; }
          setNote(null);
          onChange({ type: "mark_text", v: 1, selected: r.next });
        }}
      />
    </View>
  );
}

/** QT31 — Hata bulma ve düzeltme: hatalı parçaya dokun (işaretle), altında düzeltmesini yaz; yeniden dokun = işareti kaldır. */
export function ErrorFixQuestion({ payload, answer, onChange, disabled }: {
  payload: Phase2aPayload<"error_fix">; answer: Phase2aAnswerOf<"error_fix"> | undefined; onChange: (a: Phase2aAnswerOf<"error_fix">, typed?: boolean) => void; disabled: boolean;
}) {
  const { t } = useTranslation();
  const current: Phase2aAnswerOf<"error_fix"> = answer ?? { type: "error_fix", v: 1, marks: {} };
  const marked = payload.segments.filter((s): s is { id: string; text: string } => "id" in s && s.id in current.marks);
  return (
    <View style={{ gap: 12 }}>
      <Help>{t(payload.unit === "word" ? "prova.qt.child.fix.helpWord" : "prova.qt.child.fix.helpSentence")}</Help>
      <Counter testID="qt-fix-count" count={marked.length} />
      <Passage
        testPrefix="qt-fix"
        segments={payload.segments}
        unit={payload.unit}
        disabled={disabled}
        selected={(id) => id in current.marks}
        a11y={(text, on) => `${text}. ${t(on ? "prova.qt.child.fix.markedA11y" : "prova.qt.child.fix.unmarkedA11y")}`}
        decorate={(id) => { const fix = current.marks[id]?.text; return fix?.trim() ? `→ ${fix}` : null; }}
        onToggle={(id) => onChange(toggleMark(current, id))}
      />
      {marked.length ? <SectionTitle>{t("prova.qt.child.fix.corrections")}</SectionTitle> : null}
      {marked.map((s) => {
        const value = current.marks[s.id]?.text ?? "";
        return (
          <View key={s.id} testID={`qt-fix-row-${s.id}`} style={{ gap: 6, borderRadius: 18, borderWidth: 2, borderColor: value.trim() ? qt.purple : qt.warmLine, backgroundColor: value.trim() ? "#FFFFFF" : qt.warm, padding: 12 }}>
            <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 16, lineHeight: 22, color: qt.ink }}>{t("prova.qt.child.fix.insteadOf", { text: s.text })}</Text>
            <TextInput
              testID={`qt-fix-input-${s.id}`}
              accessibilityLabel={t("prova.qt.child.fix.inputA11y", { text: s.text })}
              value={value}
              editable={!disabled}
              maxLength={120}
              autoCorrect={false}
              spellCheck={false}
              autoCapitalize="none"
              placeholder={t("prova.qt.child.fix.placeholder")}
              placeholderTextColor={qt.muted}
              onChangeText={(text) => onChange(setFix(current, s.id, text), true)}
              style={{ minHeight: 48, borderRadius: 14, borderWidth: 2, borderColor: qt.line, backgroundColor: "#FFFFFF", paddingHorizontal: 12, fontFamily: "Nunito_700Bold", fontSize: 18, color: qt.ink }}
            />
            {!value.trim() ? <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 15, color: qt.ink }}>{t("prova.qt.child.fix.needsFix")}</Text> : null}
            <Pressable testID={`qt-fix-unmark-${s.id}`} accessibilityRole="button" accessibilityLabel={t("prova.qt.child.fix.unmarkA11y", { text: s.text })} disabled={disabled}
              onPress={() => onChange(toggleMark(current, s.id))} style={{ minHeight: 48, alignSelf: "flex-end", justifyContent: "center", paddingHorizontal: 10 }}>
              <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 15, color: qt.purple }}>{t("prova.qt.child.fix.unmark")}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/** QT32 — Birden çok doğru seçenek (onay kutuları). Eski tek seçimli şıklı soru bu bileşeni kullanmaz. */
export function MultiChoiceQuestion({ payload, answer, onChange, disabled }: {
  payload: Phase2aPayload<"multi_choice">; answer: Phase2aAnswerOf<"multi_choice"> | undefined; onChange: (a: Phase2aAnswerOf<"multi_choice">) => void; disabled: boolean;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState<string | null>(null);
  const selected = answer?.selected ?? [];
  const max = multiChoiceMax(payload);
  return (
    <View style={{ gap: 12 }}>
      <Help>{payload.select_count ? t("prova.qt.child.multi.exactly", { count: payload.select_count }) : t("prova.qt.child.multi.many")}</Help>
      <Counter testID="qt-multi-count" count={selected.length} max={payload.select_count} />
      <StepNote testID="qt-multi-note">{note}</StepNote>
      <View style={{ gap: 10 }}>
        {payload.options.map((o, i) => {
          const on = selected.includes(o.id);
          return (
            <Option
              key={o.id}
              testID={`qt-multi-${o.id}`}
              role="checkbox"
              label={`${String.fromCharCode(65 + i)}. ${o.text}`}
              accessibilityLabel={`${String.fromCharCode(65 + i)}, ${o.text}`}
              state={{ checked: on }}
              selected={on}
              disabled={disabled}
              left={<View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: on ? qt.purpleDark : qt.muted, backgroundColor: on ? qt.purpleDark : "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                {on ? <Check size={18} color="#FFFFFF" /> : null}
              </View>}
              onPress={() => {
                const r = toggleSelected(selected, o.id, max);
                if (r.refused) { setNote(t("prova.qt.child.multi.full", { count: max })); return; }
                setNote(null);
                onChange({ type: "multi_choice", v: 1, selected: r.next });
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/** QT33 — İki aşamalı soru. 2. aşama 1. aşamanın doğruluğu hakkında HİÇBİR şey söylemez. */
export function TwoStageQuestion({ payload, answer, onChange, disabled }: {
  payload: Phase2aPayload<"two_stage">; answer: Phase2aAnswerOf<"two_stage"> | undefined; onChange: (a: Phase2aAnswerOf<"two_stage">, typed?: boolean) => void; disabled: boolean;
}) {
  const { t } = useTranslation();
  const current: Phase2aAnswerOf<"two_stage"> = answer ?? { type: "two_stage", v: 1 };
  const open2 = current.stage1 !== undefined || current.stage2 !== undefined;
  const text2 = typeof current.stage2 === "object" ? current.stage2.text : "";
  const stageBox = (n: 1 | 2, prompt: string, body: React.ReactNode) => (
    <View testID={`qt-stage${n}`} style={{ gap: 10, borderRadius: 20, borderWidth: 2, borderColor: qt.line, backgroundColor: "#FFFFFF", padding: 14 }}>
      <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 15, color: qt.purpleDark }}>{t("prova.qt.child.stage.step", { n })}</Text>
      <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 18, lineHeight: 26, color: qt.ink }}>{prompt}</Text>
      {body}
    </View>
  );
  const choices = (stage: 1 | 2, options: { id: string; text: string }[], value: string | undefined) => (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("prova.qt.child.stage.step", { n: stage })} style={{ gap: 10 }}>
      {options.map((o, i) => {
        const on = value === o.id;
        return (
          <Option key={o.id} testID={`qt-stage${stage}-${o.id}`} role="radio" label={`${String.fromCharCode(65 + i)}. ${o.text}`} state={{ checked: on }} selected={on} disabled={disabled}
            onPress={() => onChange(setStage(current, stage === 1 ? { stage1: on ? null : o.id } : { stage2: on ? null : o.id }))} />
        );
      })}
    </View>
  );
  return (
    <View style={{ gap: 12 }}>
      <Help>{t("prova.qt.child.stage.help")}</Help>
      {stageBox(1, payload.stage1.prompt, choices(1, payload.stage1.options, current.stage1))}
      {open2 ? stageBox(2, payload.stage2.prompt, payload.stage2.mode === "choice"
        ? choices(2, payload.stage2.options ?? [], typeof current.stage2 === "string" ? current.stage2 : undefined)
        : (
          <TextInput
            testID="qt-stage2-text"
            multiline
            accessibilityLabel={t("prova.qt.child.stage.reasonA11y")}
            value={text2}
            editable={!disabled}
            maxLength={2000}
            placeholder={t("prova.qt.child.stage.reasonPlaceholder")}
            placeholderTextColor={qt.muted}
            onChangeText={(text) => onChange(setStage(current, { stage2: { text } }), true)}
            textAlignVertical="top"
            style={{ minHeight: 112, borderRadius: 16, borderWidth: 2, borderColor: text2.trim() ? qt.purple : qt.line, backgroundColor: qt.cream, padding: 12, fontFamily: "Nunito_700Bold", fontSize: 17, lineHeight: 24, color: qt.ink }}
          />
        )) : <StepNote testID="qt-stage2-locked">{t("prova.qt.child.stage.locked")}</StepNote>}
    </View>
  );
}
