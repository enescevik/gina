import { emptyAnswer, setBlank, type AnswerOf, type FillBlankPayload } from "@gina/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, TextInput, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { placeToken, tokenUses } from "./model";
import { Help, SectionTitle, StepNote, qt } from "./ui";

const sentence = { fontFamily: "Nunito_700Bold", fontSize: 19, lineHeight: 30, color: qt.ink } as const;

/** Metni kelimelere böler ki boşluklar satır sonunda doğal kırılsın (büyük yazıda üst üste binmez). */
function words(text: string) {
  return text.split(/(\s+)/).filter((w) => w.length > 0 && !/^\s+$/.test(w));
}

/**
 * QT11 — Boşluk doldurma. Havuzda: kelimeye dokun → boşluğa dokun (ya da önce boşluk, sonra kelime);
 * dolu boşluğa dokunmak kelimeyi geri alır. Klavyede: her boşluk ayrı yazı alanı.
 */
export function FillBlankQuestion({
  payload,
  answer,
  onChange,
  disabled,
}: {
  payload: FillBlankPayload;
  answer: AnswerOf<"fill_blank"> | undefined;
  onChange: (a: AnswerOf<"fill_blank">, typed?: boolean) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const current = answer ?? emptyAnswer("fill_blank");
  const [word, setWord] = useState<string | null>(null);
  const [blank, setBlankFocus] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const bank = payload.bank ?? [];
  const uses = tokenUses(current);
  const blankNumber = new Map<string, number>();
  payload.segments.forEach((s) => {
    if (s.type === "blank") blankNumber.set(s.id, blankNumber.size + 1);
  });
  const wordText = (id: string) => bank.find((b) => b.id === id)?.text ?? "";

  function place(blankId: string, token: string) {
    onChange(placeToken(current, payload, blankId, token));
    setWord(null);
    setBlankFocus(null);
    setNote(t("prova.qt.child.fill.placed", { word: wordText(token), n: blankNumber.get(blankId) }));
  }
  function tapBlank(id: string) {
    const v = current.blanks[id];
    if (word) return place(id, word);
    if (v && "token" in v) {
      onChange(setBlank(current, id, null));
      setNote(t("prova.qt.child.fill.returned", { word: wordText(v.token) }));
      return;
    }
    setBlankFocus(blank === id ? null : id);
    setNote(blank === id ? null : t("prova.qt.child.fill.pickWord", { n: blankNumber.get(id) }));
  }
  function tapWord(id: string) {
    if (blank) return place(blank, id);
    setWord(word === id ? null : id);
    setNote(word === id ? null : t("prova.qt.child.fill.placeIn", { word: wordText(id) }));
  }

  const keyboard = payload.input === "keyboard";
  return (
    <View style={{ gap: 14 }}>
      <Help>{t(keyboard ? "prova.qt.child.fill.helpKeyboard" : "prova.qt.child.fill.helpBank")}</Help>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 8, borderRadius: 20, backgroundColor: "#FFFFFF", padding: 14 }}>
        {payload.segments.flatMap((s, i) => {
          if (s.type === "text") return words(s.text).map((w, j) => <Text key={`${i}-${j}`} style={sentence}>{w}</Text>);
          const n = blankNumber.get(s.id) ?? 0;
          const v = current.blanks[s.id];
          if (keyboard) {
            const text = v && "text" in v ? v.text : "";
            return [
              <TextInput
                key={s.id}
                testID={`qt-blank-${s.id}`}
                accessibilityLabel={t("prova.qt.child.fill.blankA11y", { n })}
                value={text}
                editable={!disabled}
                maxLength={120}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                placeholder={t("prova.qt.child.fill.typePlaceholder", { n })}
                placeholderTextColor={qt.muted}
                onChangeText={(value) => onChange(setBlank(current, s.id, value.length ? { text: value } : null), true)}
                style={{ minHeight: 48, minWidth: 120, flexGrow: 0, borderBottomWidth: 3, borderColor: text.trim() ? qt.purple : qt.line, borderRadius: 12, backgroundColor: qt.cream, paddingHorizontal: 10, fontFamily: "Nunito_700Bold", fontSize: 18, color: qt.ink }}
              />,
            ];
          }
          const filled = v && "token" in v ? wordText(v.token) : null;
          const focused = blank === s.id;
          return [
            <Pressable
              key={s.id}
              testID={`qt-blank-${s.id}`}
              accessibilityRole="button"
              accessibilityLabel={filled ? t("prova.qt.child.fill.blankFilled", { n, word: filled }) : t("prova.qt.child.fill.blankEmpty", { n })}
              accessibilityState={{ disabled, selected: focused }}
              disabled={disabled}
              onPress={() => tapBlank(s.id)}
              style={{ minHeight: 48, minWidth: 96, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, borderRadius: 14, borderWidth: focused ? 3 : 2, borderStyle: filled ? "solid" : "dashed", borderColor: focused || filled ? qt.purpleDark : qt.muted, backgroundColor: filled ? qt.lilac : qt.cream }}
            >
              <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 18, lineHeight: 26, color: filled ? qt.ink : qt.muted }}>{filled ?? `${n}  ____`}</Text>
            </Pressable>,
          ];
        })}
      </View>
      {!keyboard ? (
        <>
          <StepNote testID="qt-fill-note">{note}</StepNote>
          <SectionTitle>{t("prova.qt.child.fill.bank")}</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {bank.map((b) => {
              const used = (uses[b.id]?.length ?? 0) > 0 && !payload.bank_reuse;
              const selected = word === b.id;
              return (
                <Pressable
                  key={b.id}
                  testID={`qt-word-${b.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={[t("prova.qt.child.fill.wordA11y", { word: b.text }), used ? t("prova.qt.child.fill.wordUsed") : null].filter(Boolean).join(", ")}
                  accessibilityState={{ disabled, selected }}
                  disabled={disabled}
                  onPress={() => tapWord(b.id)}
                  style={{ minHeight: 48, minWidth: 64, justifyContent: "center", alignItems: "center", paddingHorizontal: 14, borderRadius: 16, borderWidth: selected ? 3 : 2, borderColor: selected ? qt.purpleDark : qt.line, backgroundColor: selected ? qt.lilac : used ? "#F1EEF5" : "#FFFFFF" }}
                >
                  <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 18, lineHeight: 25, color: used ? qt.muted : qt.ink, textDecorationLine: used ? "line-through" : "none" }}>{b.text}</Text>
                  {used ? <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13, color: qt.muted }}>{t("prova.qt.child.fill.wordUsed")}</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {word || blank ? (
            <Pressable accessibilityRole="button" onPress={() => { setWord(null); setBlankFocus(null); setNote(null); }} style={{ minHeight: 48, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 8 }}>
              <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: qt.purple }}>{t("prova.qt.child.cancelSelection")}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
