import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { p, SatinButton, u } from "@/components/planner/ui";
import { Field } from "./field";
import { Pressable } from "./pressable";
export type GuidedOption = {
  id: string;
  kind: string;
  label_tr: string;
  label_en: string;
  subject: string;
  revision: number;
};
export function GuidedField({
  childId,
  kind,
  label,
  value,
  onChange,
  maxLength = 80,
  disabled = false,
  subject,
}: {
  childId: string;
  kind: string;
  label: string;
  value: string;
  onChange: (value: string, id: string | null) => void;
  maxLength?: number;
  disabled?: boolean;
  subject?: string;
}) {
  const { t, i18n } = useTranslation(), { session, claims } = useSession();
  const [manual, setManual] = useState(false),
    [expanded, setExpanded] = useState(false);
  const q = useQuery({
    queryKey: [
      "guided_options",
      session?.user.id,
      claims?.family_id,
      childId,
      kind,
    ],
    enabled: !!childId,
    queryFn: async () => {
      const r = await supabase.rpc("get_guided_input_options", {
        p_child: childId,
        p_kind: kind,
      });
      if (r.error) throw r.error;
      return r.data as unknown as GuidedOption[];
    },
  });
  const options = (q.data ?? []).filter((o) =>
      kind !== "topic" || !o.subject || o.subject === subject
    ),
    display = (o: GuidedOption) =>
      i18n.language.startsWith("en") ? o.label_en : o.label_tr;
  const known = options.some((o) => display(o) === value),
    custom = manual || !!value && !known && !!q.data;
  return (
    <View style={{ gap: 10, minWidth: 0 }}>
      <Text style={u.bold}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(expanded ? options : options.slice(0, 6)).map((o) => (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: display(o) === value, disabled }}
            disabled={disabled}
            onPress={() => {
              onChange(display(o), o.id);
              setManual(false);
            }}
            style={{
              minHeight: 48,
              maxWidth: "100%",
              padding: 12,
              borderRadius: 16,
              backgroundColor: display(o) === value ? p.purple : p.lilac,
            }}
          >
            <Text
              style={[u.small, {
                color: display(o) === value ? "#FFFFFF" : p.purple,
              }]}
            >
              {display(o)}
            </Text>
          </Pressable>
        ))}
      </View>
      {options.length > 6
        ? (
          <SatinButton
            secondary
            title={t(expanded ? "guidedInput.showLess" : "guidedInput.showAll")}
            disabled={disabled}
            onPress={() => setExpanded(!expanded)}
          />
        )
        : null}
      {q.error
        ? (
          <View style={{ gap: 8 }}>
            <Text style={u.small}>{t("guidedInput.catalogFailed")}</Text>
            <SatinButton
              secondary
              title={t("common.retry")}
              onPress={() => void q.refetch()}
            />
          </View>
        )
        : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setManual(!manual)}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text style={[u.small, { color: p.purple }]}>
          {t("guidedInput.custom")}
        </Text>
      </Pressable>
      {custom
        ? (
          <Field
            label={label}
            value={value}
            editable={!disabled}
            maxLength={maxLength}
            onChangeText={(v) => onChange(v, null)}
            onBlur={() => onChange(value.trim(), null)}
          />
        )
        : null}
    </View>
  );
}
