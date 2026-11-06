import { emptyAnswer, setPair, type AnswerOf, type MatchingPayload } from "@gina/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, useWindowDimensions, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { rightUses } from "./model";
import { Help, SectionTitle, StepNote, qt } from "./ui";

const letter = (i: number) => String.fromCharCode(65 + i);

/**
 * QT12 — Eşleştirme: soldan dokun, sonra sağdan dokun. Aynı eşe yeniden dokunmak eşi çözer;
 * birebir politikada dolu sağ öğeye eşlemek eski eşten alır (değiştirme). Çizgi animasyonu yok:
 * eşler numara/harf ve metinle gösterilir, her sol kartta "Eşi kaldır" düğmesi vardır.
 */
export function MatchingQuestion({
  payload,
  answer,
  onChange,
  disabled,
}: {
  payload: MatchingPayload;
  answer: AnswerOf<"matching"> | undefined;
  onChange: (a: AnswerOf<"matching">) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const twoColumns = width >= 640 && fontScale < 1.6;
  const current = answer ?? emptyAnswer("matching");
  const [left, setLeft] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const uses = rightUses(current);
  const leftIndex = new Map(payload.left.map((l, i) => [l.id, i + 1]));
  const rightIndex = new Map(payload.right.map((r, i) => [r.id, i]));
  const rightText = (id: string | undefined) => payload.right.find((r) => r.id === id)?.text;

  function tapLeft(id: string) {
    const next = left === id ? null : id;
    setLeft(next);
    const text = payload.left.find((l) => l.id === id)?.text ?? "";
    setNote(next ? t("prova.qt.child.match.choosingFor", { text }) : null);
  }
  function tapRight(id: string) {
    if (!left) {
      setNote(t("prova.qt.child.match.selectLeftFirst"));
      return;
    }
    const same = current.pairs[left] === id;
    onChange(setPair(current, left, same ? null : id, payload.policy));
    setNote(same ? t("prova.qt.child.match.unpaired", { n: leftIndex.get(left) }) : t("prova.qt.child.match.paired", { n: leftIndex.get(left), letter: letter(rightIndex.get(id) ?? 0) }));
    setLeft(null);
  }

  const leftColumn = (
    <View style={{ gap: 10, flex: twoColumns ? 1 : undefined }}>
      <SectionTitle>{t("prova.qt.child.match.leftTitle")}</SectionTitle>
      {payload.left.map((l, i) => {
        const pair = current.pairs[l.id];
        const selected = left === l.id;
        const pairLabel = pair ? t("prova.qt.child.match.pairedWith", { letter: letter(rightIndex.get(pair) ?? 0), text: rightText(pair) }) : t("prova.qt.child.match.noPair");
        return (
          <View key={l.id} style={{ gap: 4 }}>
            <Pressable
              testID={`qt-left-${l.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}. ${l.text}. ${pairLabel}`}
              accessibilityState={{ disabled, selected }}
              disabled={disabled}
              onPress={() => tapLeft(l.id)}
              style={{ minHeight: 48, gap: 4, borderRadius: 18, borderWidth: selected ? 3 : 2, borderColor: selected ? qt.purpleDark : pair ? qt.purple : qt.line, backgroundColor: selected ? qt.lilac : "#FFFFFF", paddingHorizontal: 14, paddingVertical: 10 }}
            >
              <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 17, lineHeight: 24, color: qt.ink }}>{i + 1}. {l.text}</Text>
              <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 15, lineHeight: 21, color: pair ? qt.purpleDark : qt.muted }}>{pair ? `→ ${letter(rightIndex.get(pair) ?? 0)}. ${rightText(pair)}` : t("prova.qt.child.match.noPair")}</Text>
            </Pressable>
            {pair ? (
              <Pressable
                testID={`qt-unpair-${l.id}`}
                accessibilityRole="button"
                accessibilityLabel={t("prova.qt.child.match.unpairA11y", { n: i + 1 })}
                disabled={disabled}
                onPress={() => { onChange(setPair(current, l.id, null, payload.policy)); setNote(t("prova.qt.child.match.unpaired", { n: i + 1 })); }}
                style={{ minHeight: 48, alignSelf: "flex-end", justifyContent: "center", paddingHorizontal: 10 }}
              >
                <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 15, color: qt.purple }}>{t("prova.qt.child.match.unpair")}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
  const rightColumn = (
    <View style={{ gap: 10, flex: twoColumns ? 1 : undefined }}>
      <SectionTitle>{t("prova.qt.child.match.rightTitle")}</SectionTitle>
      {payload.right.map((r, i) => {
        const by = (uses[r.id] ?? []).map((id) => leftIndex.get(id)).filter(Boolean);
        const pairedToSelected = !!left && current.pairs[left] === r.id;
        return (
          <Pressable
            key={r.id}
            testID={`qt-right-${r.id}`}
            accessibilityRole="button"
            accessibilityLabel={[`${letter(i)}. ${r.text}`, by.length ? t("prova.qt.child.match.usedBy", { list: by.join(", ") }) : null].filter(Boolean).join(". ")}
            accessibilityState={{ disabled, selected: pairedToSelected }}
            disabled={disabled}
            onPress={() => tapRight(r.id)}
            style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, borderWidth: pairedToSelected ? 3 : 2, borderColor: pairedToSelected ? qt.purpleDark : by.length ? qt.purple : qt.line, backgroundColor: by.length ? qt.lilac : "#FFFFFF", paddingHorizontal: 14, paddingVertical: 10 }}
          >
            <Text style={{ flex: 1, fontFamily: "Nunito_700Bold", fontSize: 17, lineHeight: 24, color: qt.ink }}>{letter(i)}. {r.text}</Text>
            {by.length ? (
              <View style={{ borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: qt.purple, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 14, color: qt.purpleDark }}>{t("prova.qt.child.match.usedShort", { list: by.join(", ") })}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
  return (
    <View style={{ gap: 12 }}>
      <Help>{t(payload.policy === "one_to_one" ? "prova.qt.child.match.help" : "prova.qt.child.match.helpMany")}</Help>
      <StepNote testID="qt-match-note">{note}</StepNote>
      <View style={{ flexDirection: twoColumns ? "row" : "column", gap: 16 }}>
        {leftColumn}
        {rightColumn}
      </View>
    </View>
  );
}
