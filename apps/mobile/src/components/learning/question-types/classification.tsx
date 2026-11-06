import { emptyAnswer, setPlacement, type AnswerOf, type ClassificationPayload } from "@gina/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, useWindowDimensions, View } from "react-native";
import { Undo2 } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { placeItem } from "./model";
import { Help, SectionTitle, StepNote, qt } from "./ui";

function Chip({ label, selected, disabled, onPress, a11y, testID }: { label: string; selected: boolean; disabled: boolean; onPress: () => void; a11y: string; testID: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 48, minWidth: 48, justifyContent: "center", borderRadius: 16, borderWidth: selected ? 3 : 2, borderColor: selected ? qt.purpleDark : qt.line, backgroundColor: selected ? qt.lilac : "#FFFFFF", paddingHorizontal: 14, paddingVertical: 8 }}
    >
      <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 17, lineHeight: 24, color: qt.ink }}>{label}</Text>
    </Pressable>
  );
}

/** QT21 — Sınıflandırma: karta dokun → gruba dokun. Geri al (karta ait düğme) ve görünür kapasite. */
export function ClassificationQuestion({
  payload,
  answer,
  onChange,
  disabled,
}: {
  payload: ClassificationPayload;
  answer: AnswerOf<"classification"> | undefined;
  onChange: (a: AnswerOf<"classification">) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 900 && fontScale < 1.4 ? Math.min(payload.categories.length, 3) : width >= 600 && fontScale < 1.6 ? 2 : 1;
  const current = answer ?? emptyAnswer("classification");
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const itemText = (id: string) => payload.items.find((i) => i.id === id)?.text ?? "";
  const pool = payload.items.filter((i) => !current.placement[i.id]);

  function pick(id: string) {
    const next = picked === id ? null : id;
    setPicked(next);
    setNote(next ? t("prova.qt.child.class.placing", { text: itemText(id) }) : null);
  }
  function drop(category: string, label: string) {
    if (!picked) {
      setNote(t("prova.qt.child.class.pickItemFirst"));
      return;
    }
    const next = placeItem(current, payload, picked, category);
    if (!next) {
      setNote(t("prova.qt.child.class.fullHint", { category: label }));
      return;
    }
    onChange(next);
    setNote(t("prova.qt.child.class.placed", { text: itemText(picked), category: label }));
    setPicked(null);
  }
  return (
    <View style={{ gap: 12 }}>
      <Help>{t("prova.qt.child.class.help")}</Help>
      <StepNote testID="qt-class-note">{note}</StepNote>
      <SectionTitle>{t("prova.qt.child.class.items")}</SectionTitle>
      {pool.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {pool.map((i) => (
            <Chip key={i.id} testID={`qt-item-${i.id}`} label={i.text} selected={picked === i.id} disabled={disabled}
              a11y={`${i.text}. ${t("prova.qt.child.class.notPlaced")}`} onPress={() => pick(i.id)} />
          ))}
        </View>
      ) : (
        <Help>{t("prova.qt.child.class.allPlaced")}</Help>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {payload.categories.map((c) => {
          const inside = payload.items.filter((i) => current.placement[i.id] === c.id);
          const full = c.capacity !== undefined && inside.length >= c.capacity;
          const capacity = c.capacity !== undefined ? t("prova.qt.child.class.capacity", { used: inside.length, capacity: c.capacity }) : t("prova.qt.child.class.count", { count: inside.length });
          return (
            <View key={c.id} style={{ flexGrow: 1, flexBasis: columns === 1 ? "100%" : `${Math.floor(100 / columns) - 4}%`, gap: 8, borderRadius: 20, borderWidth: 2, borderColor: picked && !full ? qt.purple : qt.line, borderStyle: picked && !full ? "dashed" : "solid", backgroundColor: qt.cream, padding: 12 }}>
              <Pressable
                testID={`qt-cat-${c.id}`}
                accessibilityRole="button"
                accessibilityLabel={[t("prova.qt.child.class.categoryA11y", { category: c.text }), capacity, full ? t("prova.qt.child.class.full") : null].filter(Boolean).join(", ")}
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={() => drop(c.id, c.text)}
                style={{ minHeight: 52, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, borderRadius: 16, backgroundColor: picked && !full ? qt.lilac : "#FFFFFF", paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ flexGrow: 1, flexShrink: 1, fontFamily: "Nunito_800ExtraBold", fontSize: 18, lineHeight: 25, color: qt.ink }}>{c.text}</Text>
                <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 15, color: full ? qt.ink : qt.muted, backgroundColor: full ? qt.warm : "transparent", borderRadius: 999, paddingHorizontal: full ? 8 : 0 }}>
                  {capacity}{full ? ` · ${t("prova.qt.child.class.full")}` : ""}
                </Text>
                {picked && !full ? <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 14, color: qt.purple }}>{t("prova.qt.child.class.putHere")}</Text> : null}
              </Pressable>
              {inside.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {inside.map((i) => (
                    <View key={i.id} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Chip testID={`qt-item-${i.id}`} label={i.text} selected={picked === i.id} disabled={disabled}
                        a11y={`${i.text}. ${t("prova.qt.child.class.inCategory", { category: c.text })}`} onPress={() => pick(i.id)} />
                      <Pressable
                        testID={`qt-item-${i.id}-remove`}
                        accessibilityRole="button"
                        accessibilityLabel={t("prova.qt.child.class.remove", { text: i.text })}
                        disabled={disabled}
                        onPress={() => { onChange(setPlacement(current, i.id, null)); if (picked === i.id) setPicked(null); setNote(t("prova.qt.child.class.removed", { text: i.text })); }}
                        style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: qt.line }}
                      >
                        <Undo2 size={20} color={qt.purpleDark} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 15, color: qt.muted }}>{t("prova.qt.child.class.empty")}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
