/**
 * QT10–QT13, QT20–QT21 — veli hazırlama: yapılandırılmış soru düzenleyicisi + salt okunur önizleme.
 * Form modeli ve doğrulama core'dadır (`question-authoring.ts`, sunucuyla aynı hata kodları).
 * Önizleme gerçek çocuk çizicisi değildir (o ayrı bileşen); yalnız çocuğun göreceği içeriği
 * ve kontrol biçimini sakin şekilde gösterir. Doğru cevap yalnız `answerKey` verilirse görünür.
 */
import {
  addRow,
  authorGuidance,
  moveRow,
  ORDERING_MAX_ORDERS,
  PRACTICE_ONLY_TYPES,
  reconcileBlanks,
  removeRow,
  type StructuredDraft,
  type StructuredInteractionType,
} from "@gina/core";
import type { TFunction } from "i18next";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react-native";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { p } from "@/components/planner/ui";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { Toggle } from "@/components/ui/toggle";
import { BuilderChoice } from "./prova-builder-ui";

type Draft = StructuredDraft;
type Of<T extends Draft["type"]> = Extract<Draft, { type: T }>;

/** Hata kodu → kullanıcı metni. Türe özel metin varsa o, yoksa genel; bilinmeyen kod genel metne düşer. */
export function structuredErrorMessage(t: TFunction, type: string | null, code: string): string {
  const specific = type ? `prova.qt.author.err.${type}.${code}` : "";
  if (specific && t(specific, { defaultValue: "" })) return t(specific);
  const general = `prova.qt.author.err.${code}`;
  const text = t(general, { defaultValue: "" });
  return text || t("prova.qt.author.err.unknown");
}

export function structuredTypeLabel(t: TFunction, type: string | null | undefined): string {
  return type ? t(`prova.qt.author.type.${type}`, { defaultValue: t("prova.qt.author.kindStructured") }) : t("prova.qt.author.kindStructured");
}

function IconAction({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.icon, disabled && { opacity: 0.35 }]}
    >
      {children}
    </Pressable>
  );
}

function Row({ label, value, onChangeText, index, count, onMove, onRemove, disabled, children, testID, minRows = 1 }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
  disabled?: boolean;
  children?: ReactNode;
  testID?: string;
  minRows?: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.row} testID={testID}>
      <Field label={label} value={value} onChangeText={onChangeText} editable={!disabled} maxLength={500} />
      {children}
      <View style={s.actions}>
        <IconAction label={t("prova.qt.author.moveUp", { label })} onPress={() => onMove(-1)} disabled={disabled || index === 0}>
          <ChevronUp size={22} color={p.ink} />
        </IconAction>
        <IconAction label={t("prova.qt.author.moveDown", { label })} onPress={() => onMove(1)} disabled={disabled || index === count - 1}>
          <ChevronDown size={22} color={p.ink} />
        </IconAction>
        <IconAction label={t("prova.qt.author.remove", { label })} onPress={onRemove} disabled={disabled || count <= minRows}>
          <Trash2 size={20} color="#A43135" />
        </IconAction>
      </View>
    </View>
  );
}

function AddButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <BuilderChoice label={`+ ${title}`} selected={false} onPress={onPress} disabled={disabled} />;
}

export function StructuredQuestionEditor({ draft, onChange, disabled = false }: { draft: Draft; onChange: (d: Draft) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const set = <T extends Draft>(patch: Partial<T>) => onChange({ ...draft, ...patch } as Draft);
  const guidance = authorGuidance(draft);
  const guide = guidance.length
    ? (
      <View testID="qt-author-guidance" style={s.guide}>
        {guidance.map((g) => <Text key={g} style={s.muted}>{t(`prova.qt.author.guide.${g}`)}</Text>)}
      </View>
    )
    : null;
  const editRow = <K extends string>(key: K, id: string, patch: Record<string, unknown>) =>
    onChange({ ...draft, [key]: (draft as unknown as Record<K, { id: string }[]>)[key].map((r) => (r.id === id ? { ...r, ...patch } : r)) } as Draft);
  const move = <K extends string>(key: K, index: number, delta: number) =>
    onChange({ ...draft, [key]: moveRow((draft as unknown as Record<K, unknown[]>)[key], index, delta) } as Draft);

  switch (draft.type) {
    case "true_false":
      return (
        <View style={s.gap} testID="qt-editor-true_false">
          <Text style={s.muted}>{t("prova.qt.author.tf.help")}</Text>
          {draft.statements.map((st, i) => (
            <Row key={st.id} testID={`qt-row-${st.id}`} label={t("prova.qt.author.tf.statement", { n: i + 1 })} value={st.text} index={i} count={draft.statements.length}
              onChangeText={(text) => editRow("statements", st.id, { text })} onMove={(d) => move("statements", i, d)} onRemove={() => onChange(removeRow(draft, st.id))} disabled={disabled}>
              <View style={s.wrap} accessibilityRole="radiogroup" accessibilityLabel={t("prova.qt.author.tf.answerFor", { n: i + 1 })}>
                {([true, false] as const).map((v) => (
                  <BuilderChoice key={String(v)} label={t(v ? "prova.qt.author.tf.true" : "prova.qt.author.tf.false")} selected={st.answer === v}
                    disabled={disabled} onPress={() => editRow("statements", st.id, { answer: st.answer === v ? null : v })} />
                ))}
              </View>
            </Row>
          ))}
          <AddButton title={t("prova.qt.author.tf.add")} disabled={disabled || draft.statements.length >= 10} onPress={() => onChange(addRow(draft))} />
          {guide}
        </View>
      );
    case "fill_blank": {
      const d = draft;
      return (
        <View style={s.gap} testID="qt-editor-fill_blank">
          <Field label={t("prova.qt.author.fill.text")} hint={t("prova.qt.author.fill.textHint")} value={d.markup} multiline editable={!disabled} maxLength={4000}
            onChangeText={(markup) => onChange(reconcileBlanks(d, markup))} className="min-h-24" />
          <Text style={s.muted}>{t("prova.qt.author.fill.blankCount", { count: d.blanks.length })}</Text>
          <Text style={s.label}>{t("prova.qt.author.fill.input")}</Text>
          <View style={s.wrap}>
            {(["bank", "keyboard"] as const).map((v) => (
              <BuilderChoice key={v} label={t(`prova.qt.author.fill.input_${v}`)} selected={d.input === v} disabled={disabled} onPress={() => set<Of<"fill_blank">>({ input: v })} />
            ))}
          </View>
          {d.input === "bank"
            ? (
              <>
                <Text style={s.muted}>{t("prova.qt.author.fill.bankHelp")}</Text>
                {d.distractors.map((w, i) => (
                  <Row key={w.id} testID={`qt-row-${w.id}`} label={t("prova.qt.author.fill.distractor", { n: i + 1 })} value={w.text} index={i} count={d.distractors.length} minRows={0}
                    onChangeText={(text) => editRow("distractors", w.id, { text })} onMove={(x) => move("distractors", i, x)} onRemove={() => onChange(removeRow(d, w.id))} disabled={disabled} />
                ))}
                <AddButton title={t("prova.qt.author.fill.addDistractor")} disabled={disabled || d.distractors.length + d.blanks.length >= 16} onPress={() => onChange(addRow(d))} />
                <Toggle label={t("prova.qt.author.fill.reuse")} value={d.bankReuse} onChange={(bankReuse) => set<Of<"fill_blank">>({ bankReuse })} disabled={disabled} />
              </>
            )
            : (
              <>
                <Text style={s.muted}>{t("prova.qt.author.fill.keyboardHelp")}</Text>
                <Toggle label={t("prova.qt.author.fill.caseInsensitive")} value={d.caseInsensitive} onChange={(caseInsensitive) => set<Of<"fill_blank">>({ caseInsensitive })} disabled={disabled} />
              </>
            )}
          {guide}
        </View>
      );
    }
    case "matching": {
      const d = draft;
      const usedRight = new Set(Object.values(d.pairs));
      return (
        <View style={s.gap} testID="qt-editor-matching">
          <Text style={s.label}>{t("prova.qt.author.match.policy")}</Text>
          <View style={s.wrap}>
            {(["one_to_one", "many_to_one"] as const).map((v) => (
              <BuilderChoice key={v} label={t(`prova.qt.author.match.policy_${v}`)} selected={d.policy === v} disabled={disabled} onPress={() => set<Of<"matching">>({ policy: v })} />
            ))}
          </View>
          <Text style={s.label}>{t("prova.qt.author.match.right")}</Text>
          <Text style={s.muted}>{t("prova.qt.author.match.rightHelp")}</Text>
          {d.right.map((r, i) => (
            <Row key={r.id} testID={`qt-row-${r.id}`} label={t("prova.qt.author.match.rightItem", { letter: String.fromCharCode(65 + i) })} value={r.text} index={i} count={d.right.length} minRows={2}
              onChangeText={(text) => editRow("right", r.id, { text })} onMove={(x) => move("right", i, x)} onRemove={() => onChange(removeRow(d, r.id))} disabled={disabled}>
              {!usedRight.has(r.id) && r.text.trim() ? <Text style={s.muted}>{t("prova.qt.author.match.distractor")}</Text> : null}
            </Row>
          ))}
          <AddButton title={t("prova.qt.author.match.addRight")} disabled={disabled || d.right.length >= 10} onPress={() => onChange(addRow(d, "right"))} />
          <Text style={s.label}>{t("prova.qt.author.match.left")}</Text>
          {d.left.map((l, i) => (
            <Row key={l.id} testID={`qt-row-${l.id}`} label={t("prova.qt.author.match.leftItem", { n: i + 1 })} value={l.text} index={i} count={d.left.length} minRows={2}
              onChangeText={(text) => editRow("left", l.id, { text })} onMove={(x) => move("left", i, x)} onRemove={() => onChange(removeRow(d, l.id))} disabled={disabled}>
              <Text style={s.muted}>{t("prova.qt.author.match.pairFor", { n: i + 1 })}</Text>
              <View style={s.wrap}>
                {d.right.map((r, j) => {
                  const taken = d.policy === "one_to_one" && usedRight.has(r.id) && d.pairs[l.id] !== r.id;
                  return (
                    <BuilderChoice key={r.id} label={`${String.fromCharCode(65 + j)}${r.text.trim() ? " · " + r.text.trim().slice(0, 24) : ""}`}
                      selected={d.pairs[l.id] === r.id} disabled={disabled || taken}
                      onPress={() => {
                        const pairs = { ...d.pairs };
                        if (pairs[l.id] === r.id) delete pairs[l.id];
                        else pairs[l.id] = r.id;
                        set<Of<"matching">>({ pairs });
                      }} />
                  );
                })}
              </View>
            </Row>
          ))}
          <AddButton title={t("prova.qt.author.match.addLeft")} disabled={disabled || d.left.length >= 8} onPress={() => onChange(addRow(d, "left"))} />
          {guide}
        </View>
      );
    }
    case "numeric": {
      const d = draft;
      const unitText = (id: string | null) => d.units.find((u) => u.id === id)?.text.trim() || "…";
      return (
        <View style={s.gap} testID="qt-editor-numeric">
          <Field label={t("prova.qt.author.num.value")} hint={t("prova.qt.author.num.valueHint")} value={d.value} editable={!disabled} maxLength={40}
            onChangeText={(value) => set<Of<"numeric">>({ value })} />
          <Toggle label={t("prova.qt.author.num.unitRequired")} value={d.unitRequired} disabled={disabled}
            onChange={(unitRequired) => onChange(unitRequired && d.units.length === 0 ? { ...addRow(d), unitRequired } as Draft : { ...d, unitRequired })} />
          {d.unitRequired
            ? (
              <>
                {d.units.map((u, i) => (
                  <Row key={u.id} testID={`qt-row-${u.id}`} label={t("prova.qt.author.num.unit", { n: i + 1 })} value={u.text} index={i} count={d.units.length}
                    onChangeText={(text) => editRow("units", u.id, { text })} onMove={(x) => move("units", i, x)} onRemove={() => onChange(removeRow(d, u.id))} disabled={disabled}>
                    <BuilderChoice label={t("prova.qt.author.num.isKeyUnit")} selected={d.unit === u.id} disabled={disabled} onPress={() => set<Of<"numeric">>({ unit: u.id })} />
                    {d.unit && d.unit !== u.id
                      ? (
                        <Field label={t("prova.qt.author.num.factor", { unit: u.text.trim() || "…", base: unitText(d.unit) })} keyboardType="decimal-pad" value={d.factors[u.id] ?? ""}
                          editable={!disabled} maxLength={20} onChangeText={(f) => set<Of<"numeric">>({ factors: { ...d.factors, [u.id]: f } })} />
                      )
                      : null}
                  </Row>
                ))}
                <AddButton title={t("prova.qt.author.num.addUnit")} disabled={disabled || d.units.length >= 8} onPress={() => onChange(addRow(d))} />
                <Text style={s.muted}>{t("prova.qt.author.num.factorHelp")}</Text>
                <Field label={t("prova.qt.author.num.unitWeight")} hint={t("prova.qt.author.num.unitWeightHint")} keyboardType="decimal-pad" value={d.unitWeightPct}
                  editable={!disabled} maxLength={5} onChangeText={(unitWeightPct) => set<Of<"numeric">>({ unitWeightPct })} />
              </>
            )
            : null}
          <Field label={t("prova.qt.author.num.absTolerance")} hint={t("prova.qt.author.num.absToleranceHint")} keyboardType="decimal-pad" value={d.absTolerance}
            editable={!disabled} maxLength={20} onChangeText={(absTolerance) => set<Of<"numeric">>({ absTolerance })} />
          <Field label={t("prova.qt.author.num.relTolerance")} keyboardType="decimal-pad" value={d.relTolerancePct}
            editable={!disabled} maxLength={5} onChangeText={(relTolerancePct) => set<Of<"numeric">>({ relTolerancePct })} />
          <Toggle label={t("prova.qt.author.num.workArea")} value={d.workArea} disabled={disabled} onChange={(workArea) => set<Of<"numeric">>({ workArea })} />
          <Toggle label={t("prova.qt.author.num.processRequired")} value={d.processRequired} disabled={disabled} onChange={(processRequired) => set<Of<"numeric">>({ processRequired })} />
          {guide}
        </View>
      );
    }
    case "ordering": {
      const d = draft;
      const text = (id: string) => d.items.find((x) => x.id === id)?.text.trim() || "…";
      return (
        <View style={s.gap} testID="qt-editor-ordering">
          <View style={s.wrap}>
            {(["sequence", "sentence"] as const).map((v) => (
              <BuilderChoice key={v} label={t(`prova.qt.author.order.mode_${v}`)} selected={d.mode === v} disabled={disabled} onPress={() => set<Of<"ordering">>({ mode: v })} />
            ))}
          </View>
          <Text style={s.muted}>{t(d.mode === "sentence" ? "prova.qt.author.order.helpSentence" : "prova.qt.author.order.help")}</Text>
          {d.items.map((it, i) => (
            <Row key={it.id} testID={`qt-row-${it.id}`} label={t("prova.qt.author.order.item", { n: i + 1 })} value={it.text} index={i} count={d.items.length} minRows={2}
              onChangeText={(v) => editRow("items", it.id, { text: v })} onMove={(x) => move("items", i, x)} onRemove={() => onChange(removeRow(d, it.id))} disabled={disabled} />
          ))}
          <AddButton title={t("prova.qt.author.order.add")} disabled={disabled || d.items.length >= 10} onPress={() => onChange(addRow(d))} />
          <Text style={s.label}>{t("prova.qt.author.order.alternatives", { count: d.alternatives.length + 1, max: ORDERING_MAX_ORDERS })}</Text>
          {d.alternatives.map((order, n) => (
            <View key={n} style={s.alt} testID={`qt-alt-${n}`}>
              <Text style={s.bold}>{t("prova.qt.author.order.altTitle", { n: n + 2 })}</Text>
              {order.map((id, i) => (
                <View key={id} style={s.altRow}>
                  <Text style={[s.copy, { flex: 1 }]}>{i + 1}. {text(id)}</Text>
                  <IconAction label={t("prova.qt.author.moveUp", { label: text(id) })} disabled={disabled || i === 0}
                    onPress={() => set<Of<"ordering">>({ alternatives: d.alternatives.map((o, k) => (k === n ? moveRow(o, i, -1) : o)) })}>
                    <ChevronUp size={22} color={p.ink} />
                  </IconAction>
                  <IconAction label={t("prova.qt.author.moveDown", { label: text(id) })} disabled={disabled || i === order.length - 1}
                    onPress={() => set<Of<"ordering">>({ alternatives: d.alternatives.map((o, k) => (k === n ? moveRow(o, i, 1) : o)) })}>
                    <ChevronDown size={22} color={p.ink} />
                  </IconAction>
                </View>
              ))}
              <BuilderChoice label={t("prova.qt.author.order.removeAlt")} selected={false} disabled={disabled}
                onPress={() => set<Of<"ordering">>({ alternatives: d.alternatives.filter((_, k) => k !== n) })} />
            </View>
          ))}
          <AddButton title={t("prova.qt.author.order.addAlt")} disabled={disabled || d.alternatives.length + 1 >= ORDERING_MAX_ORDERS}
            onPress={() => set<Of<"ordering">>({ alternatives: [...d.alternatives, d.items.map((x) => x.id)] })} />
          {guide}
        </View>
      );
    }
    case "classification": {
      const d = draft;
      return (
        <View style={s.gap} testID="qt-editor-classification">
          <Text style={s.label}>{t("prova.qt.author.class.categories")}</Text>
          {d.categories.map((c, i) => (
            <Row key={c.id} testID={`qt-row-${c.id}`} label={t("prova.qt.author.class.category", { n: i + 1 })} value={c.text} index={i} count={d.categories.length} minRows={2}
              onChangeText={(text) => editRow("categories", c.id, { text })} onMove={(x) => move("categories", i, x)} onRemove={() => onChange(removeRow(d, c.id))} disabled={disabled}>
              <Field label={t("prova.qt.author.class.capacity")} hint={t("prova.qt.author.class.capacityHint")} keyboardType="number-pad" value={c.capacity} maxLength={2}
                editable={!disabled} onChangeText={(capacity) => editRow("categories", c.id, { capacity })} />
            </Row>
          ))}
          <AddButton title={t("prova.qt.author.class.addCategory")} disabled={disabled || d.categories.length >= 5} onPress={() => onChange(addRow(d, "categories"))} />
          <Text style={s.label}>{t("prova.qt.author.class.items")}</Text>
          {d.items.map((it, i) => (
            <Row key={it.id} testID={`qt-row-${it.id}`} label={t("prova.qt.author.class.item", { n: i + 1 })} value={it.text} index={i} count={d.items.length} minRows={2}
              onChangeText={(text) => editRow("items", it.id, { text })} onMove={(x) => move("items", i, x)} onRemove={() => onChange(removeRow(d, it.id))} disabled={disabled}>
              <Text style={s.muted}>{t("prova.qt.author.class.belongs", { n: i + 1 })}</Text>
              <View style={s.wrap}>
                {d.categories.map((c, j) => (
                  <BuilderChoice key={c.id} label={c.text.trim() || t("prova.qt.author.class.category", { n: j + 1 })} selected={it.category === c.id} disabled={disabled}
                    onPress={() => editRow("items", it.id, { category: it.category === c.id ? null : c.id })} />
                ))}
              </View>
            </Row>
          ))}
          <AddButton title={t("prova.qt.author.class.addItem")} disabled={disabled || d.items.length >= 16} onPress={() => onChange(addRow(d, "items"))} />
          {guide}
        </View>
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------
type Entry = { id: string; text: string };
const list = (v: unknown): Entry[] => (Array.isArray(v) ? v.filter((x): x is Entry => !!x && typeof x === "object" && typeof (x as Entry).id === "string") : []);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});

/** Salt okunur önizleme: çocuğun göreceği içerik + kontrol biçimi. `answerKey` yalnız veli “cevabı göster” dediğinde. */
export function StructuredQuestionPreview({ type, payload, answerKey, testID = "qt-preview" }: {
  type: string | null | undefined;
  payload: unknown;
  answerKey?: unknown;
  testID?: string;
}) {
  const { t } = useTranslation();
  const pl = rec(payload);
  const key = answerKey ? rec(answerKey) : null;
  const chip = (label: string, on = false, k?: string) => (
    <View key={k ?? label} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.copy, on && { color: p.purple, fontFamily: "Nunito_800ExtraBold" }]}>{label}</Text>
    </View>
  );
  let body: ReactNode = null;
  if (type === "true_false") {
    const answers = rec(key?.answers);
    body = list(pl.statements).map((st, i) => (
      <View key={st.id} style={s.previewRow}>
        <Text style={s.copy}>{i + 1}. {st.text}</Text>
        <View style={s.wrap}>
          {chip(t("prova.qt.author.tf.true"), answers[st.id] === true, "t")}
          {chip(t("prova.qt.author.tf.false"), answers[st.id] === false, "f")}
        </View>
      </View>
    ));
  } else if (type === "fill_blank") {
    const blanks = rec(key?.blanks);
    const bank = list(pl.bank);
    const segs = (Array.isArray(pl.segments) ? pl.segments : []).map(rec);
    const blankNo = new Map(segs.filter((o) => o.type === "blank").map((o, i) => [String(o.id), i + 1]));
    body = (
      <>
        <Text style={[s.copy, { lineHeight: 34 }]}>
          {segs.map((o, i) => {
            if (o.type === "text") return <Text key={i}>{String(o.text)}</Text>;
            const n = blankNo.get(String(o.id));
            const v = rec(blanks[String(o.id)]);
            const shown = Array.isArray(v.tokens) ? bank.find((w) => w.id === (v.tokens as unknown[])[0])?.text : Array.isArray(v.accepted) ? v.accepted.join(" / ") : null;
            return <Text key={i} style={s.blank}>{shown ? ` ${shown} ` : ` (${n}) ______ `}</Text>;
          })}
        </Text>
        {pl.input === "bank"
          ? (
            <View style={s.wrap} accessibilityLabel={t("prova.qt.author.preview.bank")}>
              {/* Çocukta kelimeler sunucuda karıştırılır; önizlemede sıra önemli değildir. */}
              {[...bank].sort((a, b) => a.text.localeCompare(b.text, "tr")).map((w) => chip(w.text, false, w.id))}
            </View>
          )
          : <Text style={s.muted}>{t("prova.qt.author.preview.typing")}</Text>}
      </>
    );
  } else if (type === "matching") {
    const pairs = rec(key?.pairs);
    const right = list(pl.right);
    body = (
      <>
        {list(pl.left).map((l, i) => {
          const r = right.findIndex((x) => x.id === pairs[l.id]);
          return (
            <View key={l.id} style={s.previewRow}>
              <Text style={s.copy}>{i + 1}. {l.text}</Text>
              {key ? chip(r >= 0 ? `${String.fromCharCode(65 + r)} · ${right[r]!.text}` : "—", r >= 0) : chip(t("prova.qt.author.preview.pick"))}
            </View>
          );
        })}
        <View style={s.wrap}>{right.map((r, j) => chip(`${String.fromCharCode(65 + j)} · ${r.text}`, false, r.id))}</View>
      </>
    );
  } else if (type === "numeric") {
    const units = list(pl.units);
    body = (
      <View style={s.gap}>
        <View style={s.answerBox}><Text style={s.copy}>{key ? String(key.value ?? "") : t("prova.qt.author.preview.numberBox")}</Text></View>
        {pl.unit_required ? <View style={s.wrap}>{units.map((u) => chip(u.text, key?.unit === u.id, u.id))}</View> : null}
        {pl.work_area ? <Text style={s.muted}>{t("prova.qt.author.preview.workArea")}</Text> : null}
        {key?.process_required ? <Text style={s.muted}>{t("prova.qt.author.guide.numeric_process_manual")}</Text> : null}
      </View>
    );
  } else if (type === "ordering") {
    const items = list(pl.items);
    const orders = Array.isArray(key?.orders) ? key.orders as string[][] : null;
    body = (
      <>
        <Text style={s.muted}>{t(orders ? "prova.qt.author.preview.orderKey" : "prova.qt.author.preview.orderShuffled")}</Text>
        {(orders ? orders[0]!.map((id) => items.find((x) => x.id === id)!).filter(Boolean) : [...items].reverse()).map((it, i) => (
          <View key={it.id} style={s.previewRow}><Text style={s.copy}>{i + 1}. {it.text}</Text></View>
        ))}
        {orders && orders.length > 1 ? <Text style={s.muted}>{t("prova.qt.author.preview.moreOrders", { count: orders.length - 1 })}</Text> : null}
      </>
    );
  } else if (type === "classification") {
    const membership = rec(key?.membership);
    const items = list(pl.items);
    const cats = (Array.isArray(pl.categories) ? pl.categories : []) as (Entry & { capacity?: number })[];
    body = (
      <>
        {!key ? <View style={s.wrap}>{items.map((it) => chip(it.text, false, it.id))}</View> : null}
        <View style={s.wrap}>
          {cats.map((c) => (
            <View key={c.id} style={s.category}>
              <Text style={s.bold}>{c.text}{c.capacity ? ` · ${t("prova.qt.author.preview.capacity", { count: c.capacity })}` : ""}</Text>
              {key ? items.filter((it) => membership[it.id] === c.id).map((it) => <Text key={it.id} style={s.copy}>{it.text}</Text>) : null}
            </View>
          ))}
        </View>
      </>
    );
  }
  return (
    <View testID={testID} style={s.gap} accessibilityLabel={t("prova.qt.author.preview.title")}>
      <Text style={s.muted}>{structuredTypeLabel(t, type)}{type && PRACTICE_ONLY_TYPES.has(type as StructuredInteractionType) ? ` · ${t("prova.qt.author.practiceOnly")}` : ""}</Text>
      {body}
    </View>
  );
}

const s = StyleSheet.create({
  gap: { gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { gap: 8, borderWidth: 1, borderColor: p.line, borderRadius: 20, padding: 12, backgroundColor: "#FFFEFB" },
  actions: { flexDirection: "row", gap: 6, justifyContent: "flex-end" },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: p.lilac },
  label: { fontFamily: "Nunito_800ExtraBold", fontSize: 17, lineHeight: 24, color: p.ink },
  bold: { fontFamily: "Nunito_800ExtraBold", fontSize: 16, lineHeight: 22, color: p.ink },
  copy: { fontFamily: "Nunito_600SemiBold", fontSize: 17, lineHeight: 25, color: p.ink, flexShrink: 1 },
  muted: { fontFamily: "Nunito_600SemiBold", fontSize: 15, lineHeight: 22, color: p.muted },
  guide: { gap: 6, backgroundColor: "#EDF7F1", borderColor: "#D4E9DD", borderWidth: 1, borderRadius: 16, padding: 12 },
  alt: { gap: 6, borderWidth: 1, borderColor: "#E4DCF1", borderRadius: 16, padding: 12, backgroundColor: "#F5F1FC" },
  altRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  previewRow: { gap: 8, borderWidth: 1, borderColor: "#E5DDED", borderRadius: 16, padding: 12 },
  chip: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: "#E5DDED", borderRadius: 16, backgroundColor: "#FFFEFB", justifyContent: "center", maxWidth: "100%" },
  chipOn: { backgroundColor: p.lilac, borderColor: "#9C81E8" },
  blank: { fontFamily: "Nunito_800ExtraBold", color: p.purple },
  answerBox: { minHeight: 52, borderWidth: 1.5, borderColor: "#DDD6E8", borderRadius: 17, paddingHorizontal: 16, justifyContent: "center", backgroundColor: "#FFFFFF" },
  category: { minWidth: 140, flexGrow: 1, gap: 6, borderWidth: 1, borderStyle: "dashed", borderColor: "#C7BED7", borderRadius: 16, padding: 12 },
});
