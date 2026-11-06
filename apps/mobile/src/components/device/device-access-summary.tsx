import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { KeyRound, Pencil, UserRound, Users } from "lucide-react-native";
import { parentStyles } from "@/components/ui/parent-screen";

type Child = { id: string; name: string; pin_set: boolean };

/**
 * One-glance summary of a child device: single or shared, which children may enter and
 * whether each needs a PIN. Shows "not saved yet" while the draft differs from the server.
 */
export function DeviceAccessSummary({ personal, pinRequired, allowed, dirty }: {
  personal: boolean; pinRequired: boolean; allowed: Child[]; dirty: boolean;
}) {
  const { t } = useTranslation();
  const TypeIcon = personal ? UserRound : Users;
  return (
    <View testID="device-access-summary" accessibilityLiveRegion="polite" style={[parentStyles.card, { gap: 12, borderColor: dirty ? "#E4C27A" : "#D4E9DD", backgroundColor: dirty ? "#FFF9EC" : "#EDF7F1" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text accessibilityRole="header" style={[parentStyles.copy, { flex: 1, fontFamily: "Nunito_800ExtraBold" }]}>{t("experience.deviceSummary")}</Text>
        {dirty ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "#FBE8C0" }}>
            <Pencil size={14} color="#7A5410" />
            <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 13, color: "#7A5410" }}>{t("u02.access.unsaved")}</Text>
          </View>
        ) : null}
      </View>
      <Row icon={<TypeIcon size={20} color="#6042DE" />} label={t("u02.access.type")} value={t(personal ? "u02.access.single" : "u02.access.shared")} />
      <Row icon={<Users size={20} color="#6042DE" />} label={t("u02.access.children", { count: allowed.length })}
        value={allowed.length ? allowed.map((c) => c.name).join(", ") : t("experience.noChildSelected")} />
      <Row icon={<KeyRound size={20} color="#6042DE" />} label={t("u02.access.pin")} value={t(pinRequired ? "u02.access.pinRequired" : "u02.access.pinOptional")} />
      {pinRequired && allowed.some((c) => !c.pin_set)
        ? <Text style={[parentStyles.muted, { color: "#8A3A2E" }]}>{t("u02.access.pinMissing", { names: allowed.filter((c) => !c.pin_set).map((c) => c.name).join(", ") })}</Text>
        : null}
      {dirty ? <Text style={parentStyles.muted}>{t("u02.access.unsavedBody")}</Text> : null}
    </View>
  );
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View style={{ width: 28, alignItems: "center", paddingTop: 2 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[parentStyles.muted, { fontSize: 14 }]}>{label}</Text>
        <Text style={[parentStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{value}</Text>
      </View>
    </View>
  );
}
