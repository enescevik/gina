import { emptyAnswer, moveItem, type AnswerOf, type OrderingPayload } from "@gina/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ArrowDown, ArrowUp } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { Help, StepNote, qt } from "./ui";

/**
 * QT20 — Sıralama / cümle kurma. Sürükleme YOK: yukarı/aşağı düğmeleri ve "karta dokun → yerine dokun".
 * Kimlikler korunur (aynı görünen iki kelime ayrı kimliktir). Cevap ancak çocuk bir şey yapınca
 * oluşur; karışık sıra kendiliğinden "cevap" sayılmaz ("Bu sıra tamam" ile onaylanabilir).
 */
export function OrderingQuestion({
  payload,
  answer,
  onChange,
  disabled,
}: {
  payload: OrderingPayload;
  answer: AnswerOf<"ordering"> | undefined;
  onChange: (a: AnswerOf<"ordering">) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const base = answer ?? emptyAnswer("ordering", payload);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const text = (id: string) => payload.items.find((i) => i.id === id)?.text ?? "";
  const n = base.order.length;

  function move(id: string, to: number) {
    onChange(moveItem(base, id, to));
    setNote(t("prova.qt.child.order.moved", { text: text(id), n: Math.max(1, Math.min(n, to + 1)) }));
  }
  function tap(id: string, index: number) {
    if (!picked) {
      setPicked(id);
      setNote(t("prova.qt.child.order.pickTarget", { text: text(id) }));
      return;
    }
    if (picked === id) {
      setPicked(null);
      setNote(null);
      return;
    }
    move(picked, index);
    setPicked(null);
  }
  const sentence = payload.mode === "sentence";
  return (
    <View style={{ gap: 12 }}>
      <Help>{t(sentence ? "prova.qt.child.order.helpSentence" : "prova.qt.child.order.help")}</Help>
      <StepNote testID="qt-order-note">{note}</StepNote>
      <View accessibilityRole="list" style={{ gap: 8 }}>
        {base.order.map((id, i) => {
          const selected = picked === id;
          const target = !!picked && !selected;
          return (
            <View key={id} testID={`qt-order-row-${i}`} style={{ flexDirection: "row", alignItems: "stretch", gap: 6 }}>
              <Pressable
                testID={`qt-order-${id}`}
                accessibilityRole="button"
                accessibilityLabel={target
                  ? t("prova.qt.child.order.moveHereA11y", { text: text(picked!), n: i + 1 })
                  : t("prova.qt.child.order.itemA11y", { n: i + 1, text: text(id) })}
                accessibilityState={{ disabled, selected }}
                disabled={disabled}
                onPress={() => tap(id, i)}
                style={{ flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, borderWidth: selected ? 3 : 2, borderStyle: target ? "dashed" : "solid", borderColor: selected ? qt.purpleDark : target ? qt.purple : qt.line, backgroundColor: selected ? qt.lilac : "#FFFFFF", paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <View style={{ minWidth: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: qt.lilac }}>
                  <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: qt.purpleDark }}>{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: "Nunito_700Bold", fontSize: 18, lineHeight: 25, color: qt.ink }}>{text(id)}</Text>
                {target ? <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 14, color: qt.purple }}>{t("prova.qt.child.order.moveHere")}</Text> : null}
              </Pressable>
              {([[-1, "up", ArrowUp], [1, "down", ArrowDown]] as const).map(([dir, name, Icon]) => {
                const off = disabled || (dir < 0 ? i === 0 : i === n - 1);
                return (
                  <Pressable
                    key={name}
                    testID={`qt-order-${id}-${name}`}
                    accessibilityRole="button"
                    accessibilityLabel={t(`prova.qt.child.order.${name}`, { text: text(id) })}
                    accessibilityState={{ disabled: off }}
                    disabled={off}
                    onPress={() => move(id, i + dir)}
                    style={{ width: 48, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: off ? "#F4F1F7" : qt.lilac, opacity: off ? 0.45 : 1 }}
                  >
                    <Icon size={22} color={qt.purpleDark} />
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>
      {sentence ? (
        <Text testID="qt-order-preview" style={{ fontFamily: "Nunito_700Bold", fontSize: 18, lineHeight: 26, color: qt.ink, backgroundColor: qt.cream, borderRadius: 16, padding: 12 }}>
          {t("prova.qt.child.order.preview", { text: base.order.map(text).join(" ") })}
        </Text>
      ) : null}
      {!answer ? (
        <Pressable
          testID="qt-order-confirm"
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => { onChange(base); setNote(t("prova.qt.child.order.confirmed")); }}
          style={{ minHeight: 52, alignSelf: "flex-start", justifyContent: "center", borderRadius: 18, borderWidth: 2, borderColor: qt.purple, backgroundColor: "#FFFFFF", paddingHorizontal: 18 }}
        >
          <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 17, color: qt.purpleDark }}>{t("prova.qt.child.order.confirm")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
