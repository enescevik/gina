import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Crypto from "expo-crypto";
import {
  Linking,
  Modal,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Check,
  ChevronDown,
  FileText,
  FileUp,
  Sparkles,
  Trash2,
  X,
} from "lucide-react-native";
import {
  type Json,
  type Lesson,
  type LessonSettings,
  validateLessons,
} from "@gina/core";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { invokeProvaAi, ProvaAiError } from "@/lib/prova-ai";
import {
  chooseLearningDocument,
  type LocalLearningFile,
  sourceAction,
  uploadLearningFile,
} from "@/lib/learning-files";
import { Pressable } from "@/components/ui/pressable";
import { Field } from "@/components/ui/field";
import { IconButton, p, SatinButton, Tag, u } from "./ui";
type Extracted = {
  day: number | null;
  title: string;
  start: string | null;
  end: string | null;
  page: number;
  note: string;
};
type ReviewRow = Extracted & { id: string; included: boolean };
type ImportDraft = {
  id: string;
  source_id: string;
  draft: { lessons: Extracted[]; warnings: string[] };
};
type Timetable = {
  lessons: Lesson[];
  settings: LessonSettings;
  revision: number;
};
function Consent(
  { title, value, onChange }: {
    title: string;
    value: boolean;
    onChange: () => void;
  },
) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      aria-checked={value}
      onPress={onChange}
      style={[u.row, {
        alignItems: "flex-start",
        minHeight: 48,
        paddingVertical: 10,
      }]}
    >
      <View
        style={{
          width: 25,
          height: 25,
          borderRadius: 8,
          borderWidth: 1.5,
          borderColor: p.purple,
          backgroundColor: value ? p.purple : "#FFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {value ? <Check size={18} color="#FFF" /> : null}
      </View>
      <Text style={[u.small, { flex: 1, fontSize: 16, lineHeight: 23 }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function TimetableImportEntry(
  { childId, initial, disabled, onSaved }: {
    childId: string;
    initial: Timetable;
    disabled: boolean;
    onSaved: (next: Timetable) => void;
  },
) {
  const { claims } = useSession();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const policy = useQuery({
    queryKey: ["learning_source_policy", claims?.family_id],
    enabled: claims?.role === "parent",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_learning_source_policy");
      if (error) throw error;
      return data as { enabled: boolean };
    },
  });
  if (claims?.role !== "parent" || !policy.data?.enabled) return null;
  return (
    <>
      <View style={[u.card, { backgroundColor: p.lilac, gap: 12 }]}>
        <View style={u.row}>
          <FileUp color={p.purple} />
          <Text style={[u.bold, { fontSize: 19, flex: 1 }]}>
            {t("import.title")}
          </Text>
        </View>
        <Text style={u.small}>
          {t(disabled ? "import.saveFirst" : "import.intro")}
        </Text>
        <SatinButton
          secondary
          title={t("import.open")}
          disabled={disabled}
          onPress={() => setOpen(true)}
        />
      </View>
      {open
        ? (
          <ImportModal
            childId={childId}
            initial={initial}
            onClose={() => setOpen(false)}
            onSaved={(next) => {
              onSaved(next);
              setOpen(false);
            }}
          />
        )
        : null}
    </>
  );
}
function ImportModal(
  { childId, initial, onClose, onSaved }: {
    childId: string;
    initial: Timetable;
    onClose: () => void;
    onSaved: (next: Timetable) => void;
  },
) {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [file, setFile] = useState<LocalLearningFile | null>(null);
  const [storage, setStorage] = useState(false);
  const [consent, setConsent] = useState(false);
  const [selected, setSelected] = useState<ImportDraft | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [expanded, setExpanded] = useState("");
  const [merge, setMerge] = useState(true);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const gate = useRef(false);
  const receipt = useRef({ fingerprint: "", id: "" });
  const drafts = useQuery({
    queryKey: ["timetable_imports", childId],
    queryFn: async () => {
      const { data, error } = await supabase.from("timetable_imports").select(
        "id,source_id,draft,learning_sources(name)",
      ).eq("child_id", childId).is("applied_revision", null).gte(
        "created_at",
        new Date(Date.now() - 7 * 86400000).toISOString(),
      ).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });
  function load(d: ImportDraft) {
    setSelected(d);
    setRows(
      d.draft.lessons.map((l, i) => ({
        ...l,
        id: `import_${d.id}_${i}`,
        included: true,
      })),
    );
    setExpanded("");
    setReviewed(false);
    setError("");
  }
  function edit(id: string, patch: Partial<ReviewRow>) {
    setRows((r) => r.map((l) => l.id === id ? { ...l, ...patch } : l));
    setReviewed(false);
    setError("");
  }
  async function pick() {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      const f = await chooseLearningDocument();
      if (f) {
        setFile(f);
        setStorage(false);
        setConsent(false);
      }
    } catch {
      setError(t("import.pickFailed"));
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function extract() {
    if (gate.current || !file || !storage || !consent) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      setPhase(t("import.uploading"));
      await uploadLearningFile(file, "document");
      setPhase(t("import.reading"));
      const result = await invokeProvaAi<
        {
          id: string;
          draft: ImportDraft["draft"];
          applied_revision: number | null;
        }
      >("timetable-import", {
        source_id: file.id,
        child_id: childId,
        ai_consent: true,
        locale: i18n.language,
      });
      if (result.applied_revision !== null) {
        throw new Error("import_already_applied");
      }
      load({ ...result, source_id: file.id });
      void drafts.refetch();
    } catch (e) {
      setError(e instanceof ProvaAiError ? e.message : t("import.failed"));
    } finally {
      gate.current = false;
      setBusy(false);
      setPhase("");
    }
  }
  const imported: Lesson[] = rows.filter((r) => r.included).map((r) => ({
    id: r.id,
    day: r.day ?? 0,
    title: r.title,
    start: r.start ?? "",
    end: r.end ?? "",
  }));
  const combined = merge ? [...initial.lessons, ...imported] : imported;
  const validation = validateLessons(combined);
  async function apply() {
    if (
      gate.current || !selected || !reviewed || validation || !imported.length
    ) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      const fingerprint = JSON.stringify({
        id: selected.id,
        revision: initial.revision,
        lessons: combined,
        settings: initial.settings,
      });
      if (receipt.current.fingerprint !== fingerprint) {
        receipt.current = { fingerprint, id: Crypto.randomUUID() };
      }
      const { data, error } = await supabase.rpc("apply_timetable_import", {
        p_request_id: receipt.current.id,
        p_import_id: selected.id,
        p_revision: initial.revision,
        p_lessons: combined as unknown as Json,
        p_settings: initial.settings as unknown as Json,
      });
      if (error) throw error;
      onSaved({
        lessons: combined,
        settings: initial.settings,
        revision: data,
      });
    } catch (e) {
      const message = (e as Error).message;
      setError(
        t(
          message.includes("timetable_conflict")
            ? "import.conflict"
            : message.includes("import_already_applied")
            ? "import.alreadyApplied"
            : message.includes("import_expired") ||
                message.includes("source_not_ready")
            ? "import.expired"
            : "import.saveFailed",
        ),
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function source() {
    if (gate.current || !selected) return;
    gate.current = true;
    setBusy(true);
    try {
      const { url } = await sourceAction<{ url: string }>({
        action: "view",
        id: selected.source_id,
      });
      await Linking.openURL(url);
    } catch {
      setError(t("import.sourceFailed"));
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  function close() {
    if (gate.current) return;
    if (selected) setLeaving(true);
    else onClose();
  }
  const preview = (
    <View style={[u.card, { gap: 14, backgroundColor: p.lilac }]}>
      <View style={u.row}>
        <FileText color={p.purple} />
        <Text style={[u.bold, { flex: 1 }]}>
          {file?.name ?? t("import.source")}
        </Text>
      </View>
      {file && file.mime !== "application/pdf"
        ? (
          <Image
            source={{ uri: file.uri }}
            contentFit="contain"
            accessibilityLabel={t("import.source")}
            style={{
              width: "100%",
              height: wide ? 360 : 220,
              borderRadius: 16,
              backgroundColor: "#FFF",
            }}
          />
        )
        : null}
      <Text style={u.small}>
        {t(selected ? "import.reviewHelp" : "import.fileHelp")}
      </Text>
      {selected
        ? (
          <SatinButton
            secondary
            title={t("import.viewSource")}
            disabled={busy}
            onPress={() => void source()}
          />
        )
        : (
          <SatinButton
            secondary
            title={t(file ? "import.changeFile" : "import.selectFile")}
            busy={busy && !phase}
            disabled={busy}
            onPress={() => void pick()}
          />
        )}
    </View>
  );
  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={close}
      supportedOrientations={["portrait", "landscape"]}
    >
      <SafeAreaView style={u.root}>
        <View
          style={[u.topbar, { paddingHorizontal: 22, paddingVertical: 10 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={u.heading}>
              {t(selected ? "import.reviewTitle" : "import.title")}
            </Text>
            <Text style={u.small}>
              {t(selected ? "import.step2" : "import.step1")}
            </Text>
          </View>
          <IconButton label={t("import.close")} disabled={busy} onPress={close}>
            <X color={p.purple} />
          </IconButton>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: wide ? 28 : 20,
            gap: 20,
            paddingBottom: 36,
          }}
        >
          {leaving
            ? (
              <View style={[u.card, { gap: 14 }]}>
                <Text style={u.bold}>{t("import.leaveHelp")}</Text>
                <SatinButton
                  title={t("import.keepEditing")}
                  onPress={() => setLeaving(false)}
                />
                <SatinButton
                  secondary
                  title={t("import.closeDraft")}
                  onPress={onClose}
                />
              </View>
            )
            : null}
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              alignItems: "flex-start",
              gap: 24,
            }}
          >
            <View style={{ width: wide ? 340 : "100%" }}>{preview}</View>
            <View
              style={{ flex: 1, width: wide ? undefined : "100%", gap: 18 }}
              pointerEvents={busy ? "none" : "auto"}
            >
              {!selected
                ? (
                  <>
                    <View style={[u.card, { gap: 10 }]}>
                      <View style={u.row}>
                        <Sparkles color={p.purple} />
                        <Text style={[u.bold, { fontSize: 20 }]}>
                          {t("import.beforeReading")}
                        </Text>
                      </View>
                      <Text style={u.small}>{t("import.privacy")}</Text>
                      <Consent
                        title={t("import.storageConsent")}
                        value={storage}
                        onChange={() => setStorage((v) => !v)}
                      />
                      <Consent
                        title={t("import.aiConsent")}
                        value={consent}
                        onChange={() => setConsent((v) => !v)}
                      />
                      <SatinButton
                        title={phase || t("import.extract")}
                        busy={busy && !!phase}
                        disabled={!file || !storage || !consent || busy}
                        onPress={() => void extract()}
                      />
                    </View>
                    {drafts.data?.length
                      ? (
                        <View style={[u.card, { gap: 12 }]}>
                          <Text style={u.bold}>{t("import.recentDrafts")}</Text>
                          {drafts.data.map((d) => (
                            <SatinButton
                              key={d.id}
                              secondary
                              title={d.learning_sources?.name ??
                                t("import.source")}
                              onPress={() => {
                                setFile(null);
                                load(d as unknown as ImportDraft);
                              }}
                            />
                          ))}
                        </View>
                      )
                      : null}
                    {drafts.error
                      ? <Text style={u.error}>{t("import.draftsFailed")}</Text>
                      : null}
                  </>
                )
                : (
                  <>
                    {selected.draft.warnings.map((w, i) => (
                      <View
                        key={i}
                        style={[u.row, {
                          backgroundColor: "#FFF0DB",
                          padding: 14,
                          borderRadius: 18,
                          alignItems: "flex-start",
                        }]}
                      >
                        <AlertCircle size={20} color="#99521F" />
                        <Text style={[u.small, { flex: 1, color: "#784019" }]}>
                          {w}
                        </Text>
                      </View>
                    ))}
                    {initial.lessons.length
                      ? (
                        <View style={[u.card, { gap: 12 }]}>
                          <Text style={u.bold}>
                            {t("import.existing", {
                              count: initial.lessons.length,
                            })}
                          </Text>
                          <View style={[u.row, { flexWrap: "wrap" }]}>
                            <Tag
                              selected={merge}
                              label={t("import.keepExisting")}
                              onPress={() => {
                                setMerge(true);
                                setReviewed(false);
                              }}
                            />
                            <Tag
                              selected={!merge}
                              label={t("import.replace")}
                              onPress={() => {
                                setMerge(false);
                                setReviewed(false);
                              }}
                            />
                          </View>
                          {!merge
                            ? (
                              <Text style={u.error}>
                                {t("import.replaceWarning")}
                              </Text>
                            )
                            : null}
                        </View>
                      )
                      : null}
                    {rows.map((row) => {
                      const incomplete = row.included &&
                        (!row.day || !row.start || !row.end ||
                          !row.title.trim() || row.end <= row.start);
                      return (
                        <View
                          key={row.id}
                          style={[u.card, {
                            gap: 12,
                            borderColor: incomplete ? "#E4B679" : p.line,
                            opacity: row.included ? 1 : .65,
                          }]}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{
                              expanded: expanded === row.id,
                            }}
                            onPress={() =>
                              setExpanded(expanded === row.id ? "" : row.id)}
                            style={[u.row, { minHeight: 56 }]}
                          >
                            <View style={{ flex: 1, gap: 5 }}>
                              <Text style={[u.bold, { fontSize: 18 }]}>
                                {row.title}
                              </Text>
                              <Text style={u.small}>
                                {row.day
                                  ? t(`planner.day${row.day}`)
                                  : t("import.dayMissing")} ·{" "}
                                {row.start || "—"}–{row.end || "—"}
                              </Text>
                              {incomplete
                                ? (
                                  <Text style={u.error}>
                                    {t("import.completeRow")}
                                  </Text>
                                )
                                : null}
                            </View>
                            <ChevronDown size={22} color={p.purple} />
                          </Pressable>
                          {expanded === row.id
                            ? (
                              <>
                                <Text style={u.small}>
                                  {t("import.page", { page: row.page })}
                                  {row.note ? ` · ${row.note}` : ""}
                                </Text>
                                <Consent
                                  title={t("import.includeLesson")}
                                  value={row.included}
                                  onChange={() =>
                                    edit(row.id, { included: !row.included })}
                                />
                                <Field
                                  label={t("planner.subject")}
                                  value={row.title}
                                  maxLength={120}
                                  onChangeText={(title) =>
                                    edit(row.id, { title })}
                                />
                                <Text style={u.bold}>{t("import.day")}</Text>
                                <View style={[u.row, { flexWrap: "wrap" }]}>
                                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                                    <Tag
                                      key={day}
                                      selected={day === row.day}
                                      label={t(`weekday.${day}`)}
                                      onPress={() => edit(row.id, { day })}
                                    />
                                  ))}
                                </View>
                                <View style={u.row}>
                                  <View style={{ flex: 1 }}>
                                    <Field
                                      label={t("import.start")}
                                      value={row.start ?? ""}
                                      placeholder="09:00"
                                      maxLength={5}
                                      onChangeText={(start) =>
                                        edit(row.id, { start })}
                                    />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Field
                                      label={t("import.end")}
                                      value={row.end ?? ""}
                                      placeholder="09:40"
                                      maxLength={5}
                                      onChangeText={(end) =>
                                        edit(row.id, { end })}
                                    />
                                  </View>
                                </View>
                              </>
                            )
                            : null}
                        </View>
                      );
                    })}
                    {!rows.length
                      ? <Text style={u.error}>{t("import.noLessons")}</Text>
                      : null}
                    {imported.length > 0 && validation
                      ? (
                        <Text accessibilityRole="alert" style={u.error}>
                          {t(
                            validation === "overlap"
                              ? "import.overlap"
                              : "import.incomplete",
                          )}
                        </Text>
                      )
                      : null}
                    <View
                      style={[u.card, { gap: 12, backgroundColor: "#EAF8F2" }]}
                    >
                      <Text style={u.bold}>
                        {t("import.readyCount", { count: imported.length })}
                      </Text>
                      <Consent
                        title={t("import.reviewConsent")}
                        value={reviewed}
                        onChange={() => setReviewed((v) => !v)}
                      />
                      <SatinButton
                        title={t("import.apply")}
                        busy={busy}
                        disabled={!reviewed || !!validation ||
                          !imported.length || busy}
                        onPress={() => void apply()}
                      />
                    </View>
                  </>
                )}
              {error
                ? <Text accessibilityRole="alert" style={u.error}>{error}</Text>
                : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
export function TimetableSourceLinks({ childId }: { childId: string }) {
  const { claims } = useSession();
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const gate = useRef(false);
  const sources = useQuery({
    queryKey: ["timetable_sources", childId],
    enabled: claims?.role === "parent",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_timetable_sources", {
        p_child_id: childId,
      });
      if (error) throw error;
      return data as { source_id: string; name: string }[];
    },
  });
  async function open(id: string) {
    if (gate.current) return;
    gate.current = true;
    setOpening(id);
    setError(false);
    try {
      const { url } = await sourceAction<{ url: string }>({
        action: "view",
        id,
      });
      await Linking.openURL(url);
    } catch {
      setError(true);
    } finally {
      gate.current = false;
      setOpening(null);
    }
  }
  async function remove(id: string) {
    if (gate.current) return;
    gate.current = true;
    setOpening(id);
    setError(false);
    try {
      await sourceAction({ action: "delete", id });
      setRemoving(null);
      await sources.refetch();
    } catch {
      setError(true);
    } finally {
      gate.current = false;
      setOpening(null);
    }
  }
  if (sources.error) {
    return <Text style={u.error}>{t("import.sourceFailed")}</Text>;
  }
  if (!sources.data?.length) return null;
  return (
    <View style={[u.card, { gap: 12 }]}>
      <Text style={u.bold}>{t("import.linkedSources")}</Text>
      {sources.data.map((s) => (
        <View key={s.source_id} style={{ gap: 12 }}>
          <View style={u.row}>
            <SatinButton
              style={{ flex: 1 }}
              secondary
              busy={opening === s.source_id}
              disabled={!!opening}
              title={s.name ?? t("import.source")}
              onPress={() => void open(s.source_id)}
            />
            <IconButton
              label={t("import.deleteSource")}
              disabled={!!opening}
              onPress={() => setRemoving(s.source_id)}
            >
              <Trash2 size={22} color={p.muted} />
            </IconButton>
          </View>
          {removing === s.source_id
            ? (
              <View
                style={{
                  gap: 12,
                  padding: 16,
                  borderRadius: 18,
                  backgroundColor: "#FFF0DB",
                }}
              >
                <Text style={u.small}>{t("import.deleteHelp")}</Text>
                <View style={[u.row, { flexWrap: "wrap" }]}>
                  <SatinButton
                    secondary
                    disabled={!!opening}
                    title={t("common.cancel")}
                    onPress={() => setRemoving(null)}
                  />
                  <SatinButton
                    busy={opening === s.source_id}
                    disabled={!!opening}
                    title={t("import.deleteSource")}
                    onPress={() => void remove(s.source_id)}
                  />
                </View>
              </View>
            )
            : null}
        </View>
      ))}
      {error ? <Text style={u.error}>{t("import.sourceFailed")}</Text> : null}
    </View>
  );
}
