import { useCallback, useEffect, useMemo, useState } from "react";
import * as Crypto from "expo-crypto";
import { ActivityIndicator, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react-native";
import {
  deviceBindingsToImport,
  linkForTitle,
  normalizeSubjectAlias,
  readSubjectSuggestion,
  type SubjectLink,
  subjectLinksReceiptSchema,
  subjectLinksSchema,
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
import { p, SatinButton, Tag, u } from "./ui";

// suggest_subject (S04) and the C02 link RPCs are not in the generated database types yet; keep the
// untyped call narrow and validate every answer with the core schemas (confirmation is never skipped).
type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;

/** Family-wide, parent-confirmed catalogue links for one child's lesson names (C02, server). */
export const subjectLinksKey = (familyId: string, childId: string) =>
  ["child_subject_links", familyId, childId] as const;
export function useSubjectBindings(childId: string | undefined) {
  const { session, claims } = useSession();
  const qc = useQueryClient();
  const familyId = claims?.family_id ?? "";
  const key = subjectLinksKey(familyId, childId ?? "");
  const links = useQuery({
    queryKey: key,
    enabled: !!childId && !!familyId,
    staleTime: 30000,
    queryFn: async (): Promise<SubjectLink[]> => {
      const { data, error } = await rpc("child_subject_links", { p_child_id: childId });
      if (error) throw Error(error.message);
      return subjectLinksSchema.parse(data).links;
    },
  });
  // U05 device-only bindings, read so they can be offered for a confirmed transfer (never sent silently).
  const local = useMemo(
    () =>
      subjectBindingStore(
        deviceRecordStorage,
        session?.user.id ?? "",
        familyId,
        childId ?? "",
      ),
    [session?.user.id, familyId, childId],
  );
  const [localMap, setLocalMap] = useState(() => local.read());
  const [scope, setScope] = useState(local);
  if (scope !== local) {
    setScope(local);
    setLocalMap(local.read());
  }
  const forgetLocal = useCallback((keys: readonly string[]) => {
    for (const k of keys) local.bind(k, null);
    setLocalMap(local.read());
  }, [local]);
  const map = useMemo(() => {
    const out: Record<string, SubjectBinding> = {};
    for (const l of links.data ?? []) {
      out[l.alias_normalized] = { subject_id: l.subject_id, label_tr: l.label_tr, label_en: l.label_en };
    }
    return out;
  }, [links.data]);
  const save = useMutation({
    mutationFn: async (
      { items, source }: { items: { title: string; subject_id: string | null; expected: string | null }[]; source: "manual" | "device_import" },
    ) => {
      const { data, error } = await rpc("set_child_subject_links", {
        p_request_id: Crypto.randomUUID(),
        p_child_id: childId,
        p_links: items,
        p_source: source,
      });
      if (error) throw Error(error.message);
      return subjectLinksReceiptSchema.parse(data).links;
    },
    onSuccess: (next) => qc.setQueryData(key, next),
    onError: () => void qc.invalidateQueries({ queryKey: key }),
  });
  return {
    map,
    links: links.data ?? [],
    loading: links.isPending,
    error: links.error ?? save.error,
    saving: save.isPending,
    bind: (title: string, binding: SubjectBinding | null) => {
      const current = linkForTitle(links.data ?? [], title);
      save.mutate({ items: [{ title, subject_id: binding?.subject_id ?? null, expected: current?.subject_id ?? null }], source: "manual" });
    },
    /** Old bindings stored only on this device that the family does not have yet. */
    pendingImport: (titles: readonly string[]) => {
      if (!links.data) return { send: [], conflicts: [], same: [] };
      const withTitles = Object.fromEntries(
        Object.entries(localMap).map(([k, b]) => [k, { ...b, title: titles.find((x) => normalizeSubjectAlias(x) === k) }]),
      );
      return deviceBindingsToImport(withTitles, links.data);
    },
    importLocal: async (items: { key: string; title: string; subject_id: string }[]) => {
      if (items.length) {
        await save.mutateAsync({ items: items.map((i) => ({ title: i.title, subject_id: i.subject_id, expected: null })), source: "device_import" });
      }
      for (const i of items) local.bind(i.key, null);
      setLocalMap(local.read());
    },
    forgetLocal,
    enabled: claims?.role === "parent" && !!childId,
  };
}

/** Explicit, parent-confirmed transfer of this device's old U05 bindings to the family record. */
export function DeviceBindingImport(
  { bindings, titles }: { bindings: ReturnType<typeof useSubjectBindings>; titles: readonly string[] },
) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = bindings.enabled && !bindings.loading;
  const pending = ready ? bindings.pendingImport(titles) : { send: [], conflicts: [], same: [] };
  const redundant = !pending.send.length && !pending.conflicts.length ? pending.same.join("|") : "";
  const { forgetLocal } = bindings;
  useEffect(() => {
    // Same link already on the server: the device copy is redundant and removed without changing anything.
    if (redundant) forgetLocal(redundant.split("|"));
  }, [redundant, forgetLocal]);
  if (!ready || (!pending.send.length && !pending.conflicts.length)) return null;
  const en = i18n.language.startsWith("en");
  return (
    <View testID="c02-device-import" style={{ gap: 8, padding: 14, borderRadius: 18, backgroundColor: p.cream }}>
      <Text style={u.bold}>{t("c02.importTitle")}</Text>
      <Text style={u.small}>{t("c02.importBody", { count: pending.send.length })}</Text>
      {pending.send.map((i) => (
        <Text key={i.key} style={u.small}>{t("c02.importRow", { title: i.title, label: en ? i.label_en : i.label_tr })}</Text>
      ))}
      {pending.conflicts.map((c) => (
        <Text key={c.key} style={[u.small, { color: "#955623" }]}>{t("c02.importConflict", { title: c.title, local: c.local, server: c.server })}</Text>
      ))}
      {error ? <Text accessibilityRole="alert" style={[u.small, { color: "#B42318" }]}>{error}</Text> : null}
      <View style={[u.row, { flexWrap: "wrap", gap: 8 }]}>
        {pending.send.length
          ? (
            <SatinButton
              title={t("c02.importConfirm", { count: pending.send.length })}
              busy={busy}
              onPress={async () => {
                setBusy(true);
                setError("");
                try {
                  await bindings.importLocal(pending.send);
                  bindings.forgetLocal([...pending.same, ...pending.conflicts.map((c) => c.key)]);
                } catch (e) {
                  setError(t((e as Error).message.includes("subject_link_changed") ? "c02.linkConflict" : "c02.linkError"));
                } finally {
                  setBusy(false);
                }
              }}
            />
          )
          : null}
        <SatinButton
          secondary
          title={t("c02.importDismiss")}
          disabled={busy}
          onPress={() => bindings.forgetLocal([...pending.send.map((i) => i.key), ...pending.same, ...pending.conflicts.map((c) => c.key)])}
        />
      </View>
    </View>
  );
}

export function SubjectMatch(
  { title, childId, grade: knownGrade, binding, onBind }: {
    title: string;
    childId: string;
    grade: number | null | undefined;
    binding: SubjectBinding | null;
    onBind: (b: SubjectBinding | null) => void;
  },
) {
  const { t, i18n } = useTranslation();
  const name = title.trim();
  const normalized = normalizeSubjectAlias(name);
  const en = i18n.language.startsWith("en");
  // Some callers only know id/name/avatar; the child's grade narrows the catalogue candidates.
  const child = useQuery({
    queryKey: ["planner_child_grade", childId],
    enabled: knownGrade === undefined && !!childId,
    staleTime: 300000,
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("grade")
        .eq("id", childId).maybeSingle();
      if (error) throw error;
      return (data?.grade ?? null) as number | null;
    },
  });
  const grade = knownGrade !== undefined ? knownGrade : child.isError ? null : child.data;
  const suggestion = useQuery({
    queryKey: ["suggest_subject", normalized, grade ?? null],
    enabled: !!normalized && !binding && grade !== undefined,
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
                  label={c.in_grade_scope || grade == null
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
      <Text style={u.small}>{t("c02.linkShared")}</Text>
    </View>
  );
}
export { bindingFor };
