import { type ComponentProps, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SetupAiRecord } from "@gina/core";
import { setupAiJournal } from "@/lib/setup-command";
import { Text, View } from "react-native";
import { FileText, Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { invokeProvaAi } from "@/lib/prova-ai";
import { p, SatinButton, u } from "@/components/planner/ui";
import { ChoiceCard } from "./wizard";
import { Toggle } from "@/components/ui/toggle";
import {
  chooseLearningDocument,
  type LocalLearningFile,
  uploadLearningFile,
} from "@/lib/learning-files";
export type SetupSuggestion = {
  title: string;
  reason: string;
  stars: number;
  icon: string;
  source_id?: string;
};
function ScopedAiSuggestions({
  kind,
  grade,
  age,
  interests = [],
  onChoose,
  allowDocument = false,
  contextId = "new-child",
  onPrepare,
}: {
  kind: "task" | "reward";
  allowDocument?: boolean;
  contextId?: string;
  onPrepare?:()=>void;
  grade?: number | null;
  age?: number;
  interests?: string[];
  onChoose: (items: SetupSuggestion[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const { claims, session } = useSession();
  const cache = useQueryClient();
  const journal = useMemo(
    () =>
      setupAiJournal(
        session?.user.id ?? "",
        claims?.family_id ?? "",
        kind,
        contextId,
      ),
    [session?.user.id, claims?.family_id, kind, contextId],
  );
  const [initial] = useState(() => {
    try {
      return { record: journal.read(), blocked: false };
    } catch {
      return { record: null, blocked: true };
    }
  });
  const [record, setRecord] = useState<SetupAiRecord | null>(initial.record);
  const [blocked, setBlocked] = useState(initial.blocked);
  const pending = !!record && !record.result;
  const [mode, setMode] = useState<"profile" | "document">(
    initial.record?.payload.source_id ? "document" : "profile",
  );
  const [file, setFile] = useState<LocalLearningFile | null>(null);
  const [storageConsent, setStorageConsent] = useState(false),
    [aiConsent, setAiConsent] = useState(false);
  const [picking, setPicking] = useState(false),
    [fileError, setFileError] = useState(false);
  const documentMode = allowDocument && mode === "document";
  const ideaKey = [
    "setup_ideas",
    claims?.family_id,
    kind,
    grade,
    age,
    interests.join(","),
    i18n.language,
    documentMode
      ? record?.payload.source_id ?? file?.id ?? "document"
      : "profile",
  ];
  const stored = useQuery<
    { suggestions: SetupSuggestion[]; document_notes?: string } | null
  >({
    queryKey: ideaKey,
    queryFn: async () => null,
    enabled: false,
    staleTime: Infinity,
  });
  const [selected, setSelected] = useState<number[]>([]);

  const ent = useQuery({
    queryKey: ["setup_ai_entitlement", claims?.family_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_setup_ai_entitlement");
      if (error) throw error;
      return data as unknown as { limit: number; remaining: number };
    },
  });
  const generate = useMutation({
    mutationFn: async () => {
      const body: SetupAiRecord["payload"] = {
        kind,
        grade: grade ?? null,
        age_band: age == null
          ? null
          : age < 6
          ? "2-5"
          : age < 10
          ? "6-9"
          : age < 14
          ? "10-13"
          : "14-18",
        interests,
        locale: i18n.language.startsWith("en") ? "en" : "tr",
      };
      const existing = journal.read();
      let command = existing;
      if (!command) {
        if (documentMode && (!file || !storageConsent || !aiConsent)) {
          throw Error(t("setupDocument.consentRequired"));
        }
        command = journal.prepare({
          ...body,
          ...(documentMode
            ? { source_id: file!.id, source_ai_consent: true as const }
            : {}),
        }, documentMode ? file!.name : undefined);
        setRecord(command);
      }
      if (command.result) return command.result;
      // Upload is itself idempotent; a restored request already references a private source.
      if (file && command.payload.source_id === file.id) {
        await uploadLearningFile(file, "document");
      }
      const response = await invokeProvaAi<
        { suggestions: SetupSuggestion[]; document_notes?: string }
      >("setup-suggestions", {
        ...command.payload,
        request_id: command.request_id,
      });
      const completed = journal.complete(command, response);
      setRecord(completed);
      return completed.result!;
    },
    onSuccess: (data) => {
      cache.setQueryData(ideaKey, data);
      setSelected([]);
      void cache.invalidateQueries({ queryKey: ["setup_ai_entitlement"] });
    },
  });
  const ideas = generate.data ?? record?.result ?? stored.data;
  const discard = () => {
    try {
      journal.discard();
      setRecord(null);
      generate.reset();
      setSelected([]);
      cache.setQueryData(ideaKey, null);
    } catch {
      setBlocked(true);
    }
  };
  return (
    <View style={[u.card, { backgroundColor: "#F0ECFC", gap: 12 }]}>
      <View style={u.row}>
        <Sparkles color={p.purple} size={22} />
        <Text style={u.bold}>{t("betaUx.aiIdeas")}</Text>
      </View>
      {allowDocument
        ? (
          <View style={[u.row, { flexWrap: "wrap" }]}>
            <SatinButton
              secondary={documentMode}
              selected={!documentMode}
              disabled={generate.isPending || picking || pending || blocked}
              title={t("setupDocument.profile")}
              onPress={() => {
                onPrepare?.();
                discard();
                setMode("profile");
                setFile(null);
              }}
            />
            <SatinButton
              secondary={!documentMode}
              selected={documentMode}
              disabled={generate.isPending || picking || pending || blocked}
              title={t("setupDocument.document")}
              onPress={() => {
                onPrepare?.();
                discard();
                setMode("document");
              }}
            />
          </View>
        )
        : null}
      <Text style={u.small}>
        {t(documentMode ? "setupDocument.help" : "betaUx.aiPrivacy")}
      </Text>
      {documentMode
        ? (
          <View style={{ gap: 12 }}>
            {record?.name || file
              ? (
                <Text numberOfLines={2} style={u.bold}>
                  {record?.name ?? file?.name}
                </Text>
              )
              : null}
            <SatinButton
              secondary
              icon={<FileText size={20} color={p.purple} />}
              title={t(
                record?.name || file
                  ? "setupDocument.change"
                  : "setupDocument.choose",
              )}
              busy={picking}
              disabled={picking || generate.isPending || pending || blocked}
              onPress={() => {
                setPicking(true);
                setFileError(false);
                void chooseLearningDocument().then((next) => {
                  if (next) {
                    discard();
                    setFile(next);
                    setStorageConsent(false);
                    setAiConsent(false);
                    generate.reset();
                    setSelected([]);
                  }
                }).catch(() => setFileError(true)).finally(() =>
                  setPicking(false)
                );
              }}
            />
            {fileError
              ? (
                <Text accessibilityRole="alert" style={u.error}>
                  {t("sources.sourceFailed")}
                </Text>
              )
              : null}
            {file && !pending && !ideas
              ? (
                <>
                  <Toggle
                    label={t("setupDocument.storageConsent")}
                    value={storageConsent}
                    onChange={setStorageConsent}
                    disabled={generate.isPending}
                  />
                  <Toggle
                    label={t("setupDocument.aiConsent")}
                    value={aiConsent}
                    onChange={setAiConsent}
                    disabled={generate.isPending}
                  />
                </>
              )
              : null}
          </View>
        )
        : null}
      {ent.error
        ? (
          <SatinButton
            secondary
            title={t("common.retry")}
            onPress={() => void ent.refetch()}
          />
        )
        : (
          <Text style={u.small}>
            {ent.data
              ? t(ent.data.limit ? "betaUx.aiRemaining" : "betaUx.aiPlan", {
                count: ent.data.remaining,
              })
              : t("release.loading")}
          </Text>
        )}
      <SatinButton
        secondary
        title={t(
          generate.isPending
            ? "betaUx.aiPreparing"
            : pending
            ? "setupDocument.resume"
            : ideas
            ? "setupDocument.regenerate"
            : documentMode
            ? "setupDocument.generate"
            : "betaUx.aiGenerate",
        )}
        busy={generate.isPending}
        disabled={blocked || (!pending && !ent.data?.remaining) ||
          generate.isPending || picking ||
          (!pending && documentMode &&
            (!file || !storageConsent || !aiConsent))}
        onPress={() => {
          onPrepare?.();
          if (ideas) discard();
          generate.mutate();
        }}
      />
      {blocked
        ? (
          <Text accessibilityRole="alert" style={u.error}>
            {t("setupDocument.localError")}
          </Text>
        )
        : null}
      {pending
        ? (
          <View style={{ gap: 8 }}>
            <Text style={u.small}>{t("setupDocument.pending")}</Text>
            <SatinButton
              secondary
              title={t("setupDocument.discard")}
              disabled={generate.isPending}
              onPress={discard}
            />
          </View>
        )
        : null}
      {generate.error && (
        <Text accessibilityRole="alert" style={u.error}>
          {generate.error.message}
        </Text>
      )}
      {ideas?.document_notes
        ? <Text style={u.copy}>{ideas.document_notes}</Text>
        : null}
      {ideas && ideas.suggestions.length === 0
        ? <Text style={u.copy}>{t("setupDocument.noSuggestions")}</Text>
        : null}
      {ideas?.suggestions.map((item, index) => (
        <ChoiceCard
          multiple
          key={`${index}-${item.title}`}
          title={item.title}
          body={`${item.reason} · ${
            t("room.starCount", { count: item.stars })
          }`}
          selected={selected.includes(index)}
          onPress={() => {
            setSelected((previous) => previous.includes(index)
              ? previous.filter((i) => i !== index)
              : [...previous, index]
            );
          }}
        />
      ))}
      {ideas && (
        <>
          <Text style={u.small}>{t("suggestions.multiHelp")}</Text>
          <SatinButton
            title={t("suggestions.useSelected", { count: selected.length })}
            disabled={!selected.length || generate.isPending}
            onPress={() =>
              onChoose(
                ideas.suggestions.filter((_, index) =>
                  selected.includes(index)
                ),
              )}
          />
          <Text style={u.small}>{t("betaUx.aiDraftOnly")}</Text>
        </>
      )}
    </View>
  );
}

export function AiSuggestions(
  props: ComponentProps<typeof ScopedAiSuggestions>,
) {
  const { session, claims } = useSession();
  const { i18n } = useTranslation();
  const scope = JSON.stringify([
    props.contextId ?? "new-child",
    props.grade ?? null,
    props.age ?? null,
    props.interests ?? [],
    i18n.language,
  ]);
  return (
    <ScopedAiSuggestions
      key={[session?.user.id, claims?.family_id, props.kind, scope].join(":")}
      {...props}
      contextId={scope}
    />
  );
}
