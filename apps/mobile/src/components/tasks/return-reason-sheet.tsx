import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { returnRequest, TASK_RETURN_NOTE_MAX, TASK_RETURN_REASONS, type TaskReturnReason } from "@gina/core";
import { DecisionSheet } from "@/components/ui/decision-sheet";
import { Pressable } from "@/components/ui/pressable";
import { p, SatinButton, u } from "@/components/planner/ui";

/**
 * C03: geri gönderme nedeni. Seçenekler sunucudaki listeyle aynıdır; serbest not en çok 140 karakter ve
 * yalnız bir nedenle birlikte gider. "Başka bir neden" not ister. Neden seçmeden göndermek de mümkündür
 * (eski davranış). Gönderme çift dokunuşa karşı çağıranın tek isteğiyle korunur.
 */
type Props = {
  visible: boolean;
  taskTitle: string;
  childName: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSend: (choice: { reason: TaskReturnReason | null; note: string | null }) => void;
};
export function ReturnReasonSheet(props: Props) {
  // Mounted only while open, so every opening starts with an empty choice.
  return props.visible ? <ReturnReasonForm {...props} /> : null;
}
function ReturnReasonForm({ taskTitle, childName, busy, error, onCancel, onSend }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<TaskReturnReason | null>(null);
  const [note, setNote] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const submit = (withReason: boolean) => {
    const checked = returnRequest({ reason: withReason ? reason : null, note: withReason ? note : "" });
    if (!checked.ok) { setLocal(t(checked.error === "return_note_required" ? "c03.review.noteRequired" : "c03.review.noteInvalid")); return; }
    setLocal(null);
    onSend({ reason: checked.reason, note: checked.note });
  };
  const shown = local ?? error;
  return (
    <DecisionSheet
      visible
      title={t("c03.review.returnTitle")}
      onClose={() => { if (!busy) onCancel(); }}
      footer={
        <View style={{ gap: 8 }}>
          <SatinButton title={t("c03.review.send")} onPress={() => submit(true)} disabled={!reason || busy} busy={busy} />
          <SatinButton title={t("c03.review.noReason")} secondary onPress={() => submit(false)} disabled={busy} />
          <SatinButton title={t("common.cancel")} secondary onPress={onCancel} disabled={busy} />
        </View>
      }
    >
      <View style={{ gap: 12 }} testID="return-reason-sheet">
        <Text style={u.bold}>{taskTitle} · {childName}</Text>
        <Text style={u.copy}>{t("c03.review.returnHelp")}</Text>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {TASK_RETURN_REASONS.map((code) => {
            const on = reason === code;
            return (
              <Pressable
                key={code}
                testID={`return-reason-${code}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: busy }}
                aria-checked={on}
                disabled={busy}
                onPress={() => { setReason(code); setLocal(null); }}
                style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: on ? p.purple : p.line, backgroundColor: on ? p.lilac : "#FFFFFF" }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: p.purple, alignItems: "center", justifyContent: "center" }}>
                  {on ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: p.purple }} /> : null}
                </View>
                <Text style={[u.bold, { flex: 1 }]}>{t(`c03.reason.${code}`)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={u.small}>{t(reason === "other" ? "c03.review.noteLabelRequired" : "c03.review.noteLabel")}</Text>
          <TextInput
            testID="return-reason-note"
            accessibilityLabel={t(reason === "other" ? "c03.review.noteLabelRequired" : "c03.review.noteLabel")}
            placeholder={t("c03.review.notePlaceholder")}
            value={note}
            editable={!busy}
            maxLength={TASK_RETURN_NOTE_MAX}
            onChangeText={(value) => { setNote(value); setLocal(null); }}
            style={[u.copy, { minHeight: 48, borderWidth: 1, borderColor: p.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#FFFFFF", color: p.ink }]}
          />
          <Text style={u.small}>{t("c03.review.noteCount", { count: note.length })} · {t("c03.review.noteVisible")}</Text>
        </View>
        {shown ? <Text accessibilityRole="alert" style={[u.small, { color: "#985212" }]}>{shown}</Text> : null}
      </View>
    </DecisionSheet>
  );
}
