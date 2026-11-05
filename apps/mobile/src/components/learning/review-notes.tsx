import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { u } from "@/components/planner/ui";
/** Secondary reading notes must not push the actual review task off screen. */
export function ReviewNotes(
  { notes, initiallyOpen = false }: {
    notes: string[];
    initiallyOpen?: boolean;
  },
) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(initiallyOpen);
  if (!notes.length) return null;
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[u.row, {
          backgroundColor: "#FFF0DB",
          padding: 14,
          borderRadius: 16,
          minHeight: 48,
        }]}
      >
        <AlertCircle size={20} color="#99521F" />
        <Text style={[u.small, { flex: 1 }]}>
          {t("weekReview.reviewNotes", { count: notes.length })}
        </Text>
        <Icon size={18} color="#99521F" />
      </Pressable>
      {open
        ? notes.map((note, i) => <Text key={i} style={u.small}>{note}</Text>)
        : null}
    </View>
  );
}
