import { useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react-native";
import {
  normalizeSubjectAlias,
  readSubjectSuggestion,
  type SubjectSuggestion,
} from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { deviceRecordStorage } from "@/lib/device-record-storage";
import {
  bindingFor,
  type SubjectBinding,
  subjectBindingStore,
} from "./planner-moves";
import { p, Tag, u } from "./ui";

// suggest_subject (S04) is not in the generated database types yet; keep the untyped call narrow
// and validate the answer with the core schema, which rejects any reply that skips confirmation.
type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;

/** Parent-confirmed catalogue bindings for one child's lesson names (device scoped). */
export function useSubjectBindings(childId: string | undefined) {
  const { session, claims } = useSession();
  const store = useMemo(
    () =>
      subjectBindingStore(
        deviceRecordStorage,
        session?.user.id ?? "",
        claims?.family_id ?? "",
        childId ?? "",
      ),
    [session?.user.id, claims?.family_id, childId],
  );
  const [map, setMap] = useState(() => store.read());
  const [scope, setScope] = useState(store);
  if (scope !== store) {
    setScope(store);
    setMap(store.read());
  }
  return {
    map,
    bind: (title: string, binding: SubjectBinding | null) =>
      setMap(store.bind(title, binding)),
    enabled: claims?.role === "parent" && !!childId,
  };
}

export function SubjectMatch(
  { title, grade, binding, onBind }: {
    title: string;
    grade: number | null | undefined;
    binding: SubjectBinding | null;
    onBind: (b: SubjectBinding | null) => void;
  },
) {
  const { t, i18n } = useTranslation();
  const name = title.trim();
  const normalized = normalizeSubjectAlias(name);
  const en = i18n.language.startsWith("en");
  const suggestion = useQuery({
    queryKey: ["suggest_subject", normalized, grade ?? null],
    enabled: !!normalized && !binding,
    staleTime: 300000,
    queryFn: async (): Promise<SubjectSuggestion> => {
      const { data, error } = await rpc("suggest_subject", {
        p_text: name.slice(0, 120),
        p_grade: grade ?? null,
      });
      if (error) throw Error(error.message);
      return readSubjectSuggestion(data);
    },
  });
  if (!normalized) return null;
  const label = (c: { label_tr: string; label_en: string }) =>
    en ? c.label_en : c.label_tr;
  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 18,
        backgroundColor: p.cream,
      }}
    >
      <Text style={u.bold}>{t("u05.catalogTitle")}</Text>
      <Text style={u.small}>{t("u05.catalogHelp", { name })}</Text>
      {binding
        ? (
          <View style={[u.row, { flexWrap: "wrap", gap: 8 }]}>
            <CheckCircle2 size={20} color="#197465" />
            <Text style={[u.bold, { flexShrink: 1 }]}>
              {t("u05.catalogBound", { label: label(binding) })}
            </Text>
            <Tag label={t("u05.catalogUnbind")} onPress={() => onBind(null)} />
          </View>
        )
        : suggestion.isPending
        ? (
          <View style={u.row}>
            <ActivityIndicator color={p.purple} />
            <Text style={u.small}>{t("u05.catalogLoading")}</Text>
          </View>
        )
        : suggestion.error || !suggestion.data
        ? <Text style={u.small}>{t("u05.catalogError")}</Text>
        : suggestion.data.match === "none"
        ? <Text style={u.small}>{t("u05.catalogNone")}</Text>
        : (
          <>
            <Text style={u.small}>
              {t(
                suggestion.data.match === "single"
                  ? "u05.catalogSingle"
                  : "u05.catalogAmbiguous",
              )}
            </Text>
            <View style={[u.row, { flexWrap: "wrap", gap: 8 }]}>
              {suggestion.data.candidates.map((c) => (
                <Tag
                  key={c.subject_id}
                  label={c.in_grade_scope
                    ? t("u05.catalogConfirm", { label: label(c) })
                    : t("u05.catalogOutOfScope", {
                      label: t("u05.catalogConfirm", { label: label(c) }),
                    })}
                  onPress={() =>
                    onBind({
                      subject_id: c.subject_id,
                      label_tr: c.label_tr,
                      label_en: c.label_en,
                    })}
                />
              ))}
            </View>
          </>
        )}
      <Text style={u.small}>{t("u05.catalogDevice")}</Text>
    </View>
  );
}
export { bindingFor };
