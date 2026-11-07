import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, useWindowDimensions, View } from "react-native";
import {
  BookOpen,
  CheckCircle2,
  Layers,
  LockKeyhole,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { type LibraryCommand, libraryJournal } from "@/lib/library-acquisition";
import { AI_INTERACTION_TYPES, provaGenerationKind } from "@gina/core";
import { structuredTypeLabel } from "./structured-question-author";
import type { DraftRecord } from "@/lib/prova-draft";
import { Button } from "@/components/ui/button";
import {
  EmptyCard,
  NavigationCard,
  parentStyles as p,
} from "@/components/ui/parent-screen";
import { BuilderChoice } from "./prova-builder-ui";
interface Package {
  id: string;
  version: number;
  title: string;
  description: string;
  grade: number;
  subject: string;
  curriculum_label: string;
  accessible: boolean;
  question_count: number;
  source_count: number;
}
interface Unit {
  key: string;
  title: string;
  count: number;
  owned: boolean;
}
interface AutomaticPreview {
  needed: number;
  matched: number;
  credits: number;
  topics_requested: number;
  topics_covered: number;
  uncovered_topics: string[];
  uncovered_types: string[];
  fingerprint: string;
  scenario: string | null;
  items: { package_id: string; unit_key: string; topic: string; kind: string }[];
}

export function LibraryPackages(
  { draft, allowance }: { draft?: DraftRecord; allowance: number },
) {
  const { t } = useTranslation(),
    { session, claims } = useSession(),
    cache = useQueryClient();
  const { width } = useWindowDimensions();
  const userId = session?.user.id ?? "", familyId = claims?.family_id ?? "";
  const journal = useMemo(() => libraryJournal(userId, familyId), [
    userId,
    familyId,
  ]);
  const [initial] = useState(() => {
    try {
      return { pending: journal.read(), failed: false };
    } catch {
      return { pending: null, failed: true };
    }
  });
  const [completedDraftId, setCompletedDraftId] = useState<string | null>(null);
  const [pending, setPending] = useState<LibraryCommand | null>(
    initial.pending,
  );
  const [storageFailed, setStorageFailed] = useState(initial.failed);
  const [selected, setSelected] = useState<Package | null>(null),
    [keys, setKeys] = useState<string[]>([]),
    [done, setDone] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [autoTypes, setAutoTypes] = useState<string[]>([]);
  const [preview, setPreview] = useState<AutomaticPreview | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [blueprintId, setBlueprintId] = useState<string>();
  const scenarioMode = draft?.content.context?.track === "meb_common";
  const scenarios = useQuery({
    queryKey: ["library_oyss_blueprints", familyId, draft?.content.childId, draft?.content.grade, draft?.content.subjects, draft?.content.context?.term, draft?.content.context?.academicYear],
    enabled: autoOpen && !!scenarioMode && !!draft?.content.childId && draft.content.subjects.length === 1,
    queryFn: async () => {
      if (!draft) return [];
      const {data,error} = await supabase.from("exam_blueprints").select("id,name,source_context")
        .eq("grade",draft.content.grade!).eq("subject",draft.content.subjects[0])
        .eq("source_context->>origin","reviewed_catalogue")
        .eq("source_context->>child_id",draft.content.childId!)
        .eq("source_context->>term",String(draft.content.context?.term))
        .eq("source_context->>academic_year",`${draft.content.context?.academicYear}-${(draft.content.context?.academicYear ?? 0) + 1}`);
      if (error) throw error;
      return (data ?? []).map(option => {
        const source = option.source_context;
        const exam = source && typeof source === "object" && !Array.isArray(source) ? source.exam : null;
        return { id: option.id, label: typeof exam === "number"
          ? t("libraryPackages.scenarioOption", { exam, name: option.name })
          : option.name };
      });
    },
  });
  const draftKind = draft ? provaGenerationKind(draft.content) : "mixed";
  const choices: readonly string[] = draft?.content.context?.track === "meb_common"
    ? ["open_ended"]
    : draftKind === "mixed" ? AI_INTERACTION_TYPES : [draftKind];
  const types = scenarioMode ? ["open_ended"] : autoTypes.filter(type => choices.includes(type));
  const typeLabel = (type: string) => type === "open_ended" || type === "multiple_choice"
    ? t(`provaBuilder.${type}`) : structuredTypeLabel(t, type);
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw Error("prova_draft_not_found");
      const {data,error} = await supabase.rpc("prepare_library_prova", {
        p_draft_id: draft.id, p_version: draft.version, p_types: types, p_blueprint_id: blueprintId,
      });
      if (error) throw error;
      return data as unknown as AutomaticPreview;
    },
    onSuccess: setPreview,
    onError: error => setError(t(`libraryPackages.errors.${error.message}`, {
      defaultValue: t("libraryPackages.failed"),
    })),
  });
  const catalog = useQuery({
    queryKey: [
      "family_packages",
      claims?.family_id,
      draft?.content.grade,
      draft?.content.subjects,
    ],
    enabled: !!draft?.content.grade,
    queryFn: async () =>
      (await Promise.all(draft!.content.subjects.map(async (subject) => {
        const r = await supabase.rpc("get_published_library_packages", {
          p_grade: draft!.content.grade!,
          p_subject: subject,
        });
        if (r.error) throw r.error;
        return r.data as unknown as Package[];
      }))).flat(),
    staleTime: 0,
  });
  const units = useQuery({
    queryKey: [
      "family_package_units",
      claims?.family_id,
      selected?.id,
      selected?.version,
    ],
    enabled: !!selected?.accessible,
    queryFn: async () => {
      const r = await supabase.rpc("get_library_package_units", {
        p_package_id: selected!.id,
      });
      if (r.error) throw r.error;
      return r.data as unknown as Unit[];
    },
    staleTime: 0,
  });
  const cost = (units.data ?? []).filter((u) =>
    keys.includes(u.key) && !u.owned
  ).reduce((n, u) => n + u.count, 0);
  const count = (units.data ?? []).filter((u) => keys.includes(u.key)).reduce(
    (n, u) => n + u.count,
    0,
  );
  const mutation = useMutation({
    mutationFn: async (command: LibraryCommand) => journal.send(command),
    onSuccess: async (_data, command) => {
      setCompletedDraftId(command.p_draft_id);
      setPending(null);
      setDone(true);
      setKeys([]);
      setPreview(null);
      await Promise.all(
        [
          "learning_library",
          "family_package_units",
          "library_draft",
          "prova_drafts",
          "question_bank",
          "question_bank_count",
          "booklet_library",
          "family_library_credits",
        ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
    },
    onError: (e) => {
      try {
        setPending(journal.read());
      } catch {
        setStorageFailed(true);
      }
      const code = (e as { message?: string }).message ?? "";
      setError(
        t(`libraryPackages.errors.${code}`, {
          defaultValue: t("libraryPackages.failed"),
        }),
      );
    },
  });
  const locked = mutation.isPending || !!pending || storageFailed;
  async function submit() {
    if (locked || !selected || !draft || !keys.length || cost > allowance) {
      return;
    }
    setError(null);
    setDone(false);
    try {
      const command = journal.prepare({
        p_package_id: selected.id,
        p_publication_version: selected.version,
        p_unit_keys: keys,
        p_draft_id: draft.id,
      });
      setPending(command);
      mutation.mutate(command);
    } catch {
      setStorageFailed(true);
    }
  }
  function submitAutomatic() {
    if (!draft || !preview || locked || (scenarioMode && !blueprintId) || preview.needed === 0 ||
      preview.matched !== preview.needed || preview.credits > allowance ||
      preview.uncovered_types.length > 0) return;
    try {
      const command = journal.prepare({
        p_draft_id: draft.id, p_version: draft.version, p_types: types, p_blueprint_id: blueprintId,
        p_expected: preview.fingerprint,
      });
      setError(null);
      setDone(false);
      setPending(command);
      mutation.mutate(command);
    } catch {
      setStorageFailed(true);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <BookOpen color="#6042DE" size={26} />
        <Text accessibilityRole="header" style={p.title}>
          {t("libraryPackages.title")}
        </Text>
      </View>
      <Text style={p.muted}>{t("libraryPackages.body")}</Text>
      {storageFailed
        ? (
          <View style={p.form}>
            <Text style={p.copy}>{t("libraryPackages.storage")}</Text>
          </View>
        )
        : null}
      {pending
        ? (
          <View style={p.form}>
            <Text style={p.copy}>{t("libraryPackages.pending")}</Text>
            <Button
              title={t("libraryPackages.retrySame")}
              disabled={mutation.isPending || storageFailed}
              loading={mutation.isPending}
              onPress={() => {
                setError(null);
                mutation.mutate(pending);
              }}
            />
          </View>
        )
        : null}
      {error
        ? (
          <Text
            accessibilityRole="alert"
            style={[p.copy, { color: "#9F362E" }]}
          >
            {error}
          </Text>
        )
        : null}
      {done
        ? (
          <View style={[p.card, { backgroundColor: "#E6F6EF" }]}>
            <CheckCircle2 color="#168879" size={28} />
            <Text style={p.copy}>{t("libraryPackages.done")}</Text>
            <Button
              title={t("provaBuilder.resume")}
              onPress={() =>
                router.replace({
                  pathname: "/parent/prova/builder",
                  params: { draftId: completedDraftId ?? draft?.id },
                })}
            />
          </View>
        )
        : null}
      {draft && draft.content.format !== "meb" && !draft.submitted_at ? (
        <View style={p.card}>
          <Button
            variant="secondary"
            title={t("libraryPackages.automatic")}
            disabled={locked || previewMutation.isPending}
            onPress={() => setAutoOpen(value => !value)}
          />
          {autoOpen ? (
            <>
              <Text style={p.copy}>{t("libraryPackages.automaticHelp")}</Text>
              {scenarioMode ? (
                <>
                  <Text style={p.muted}>{t("libraryPackages.scenarioHelp")}</Text>
                  {scenarios.data?.map(option => (
                    <BuilderChoice key={option.id} label={option.label}
                      selected={blueprintId === option.id}
                      disabled={locked || previewMutation.isPending}
                      onPress={() => {setPreview(null);setBlueprintId(option.id);}}
                    />
                  ))}
                  <Button variant="secondary" title={t("libraryPackages.openScenarios")}
                    disabled={locked}
                    onPress={() => router.push("/parent/prova/catalog")} />
                </>
              ) : null}
              <View style={{flexDirection:"row", flexWrap:"wrap", gap:8}}>
                {choices.map(type => (
                  <BuilderChoice key={type} label={typeLabel(type)}
                    selected={types.includes(type)} disabled={locked || previewMutation.isPending || !!scenarioMode}
                    onPress={() => {
                      setPreview(null);
                      setAutoTypes(old => old.includes(type) ? old.filter(x => x !== type) : [...old,type]);
                    }}
                  />
                ))}
              </View>
              <Button
                variant="secondary" title={t("libraryPackages.automaticPreview")}
                disabled={locked || !types.length || previewMutation.isPending || (scenarioMode && !blueprintId)}
                loading={previewMutation.isPending}
                onPress={() => {setError(null);setPreview(null);previewMutation.mutate();}}
              />
              {preview ? (
                <>
                  {preview.scenario ? <Text style={p.copy}>{t("libraryPackages.scenarioPreview", { name:preview.scenario, count:preview.needed })}</Text> : null}
                  <Text style={p.copy} accessibilityLiveRegion="polite">
                    {t("libraryPackages.automaticSummary", { ...preview })}
                  </Text>
                  {preview.uncovered_topics.length ? (
                    <Text style={p.muted}>{t("libraryPackages.automaticTopics", {
                      topics:preview.uncovered_topics.join(", "),
                    })}</Text>
                  ) : null}
                  {preview.uncovered_types.length ? (
                    <Text style={p.muted}>{t("libraryPackages.automaticTypes", {
                      types:preview.uncovered_types.map(typeLabel).join(", "),
                    })}</Text>
                  ) : null}
                  {preview.items.map(item => (
                    <Text style={p.muted} key={item.package_id+":"+item.unit_key}>
                      {typeLabel(item.kind)} · {item.topic}
                    </Text>
                  ))}
                  <Button title={t("provaBuilder.addSelected")} onPress={submitAutomatic}
                    disabled={locked || !preview.needed || preview.matched !== preview.needed ||
                      preview.uncovered_types.length > 0 || preview.credits > allowance}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
      {!draft
        ? (
          <NavigationCard
            title={t("libraryPackages.start")}
            body={t("libraryPackages.scopeHelp")}
            icon={<BookOpen size={24} color="#6042DE" />}
            // C04: açık taslak varsa ona döner, yoksa yeni taslak başlatır.
            onPress={() => router.push("/parent/prova/exam")}
          />
        )
        : catalog.isPending
        ? <Text style={p.copy}>{t("common.loading")}</Text>
        : catalog.error
        ? (
          <View style={p.card}>
            <Text style={p.copy}>{t("libraryPackages.failed")}</Text>
            <Button
              variant="secondary"
              title={t("common.retry")}
              onPress={() => void catalog.refetch()}
            />
          </View>
        )
        : !catalog.data?.length
        ? (
          <EmptyCard
            title={t("libraryPackages.empty")}
            body={t("libraryPackages.emptyHelp")}
            slug="display-bookworm"
          />
        )
        : (
          <View
            style={{
              gap: 12,
              flexDirection: width >= 900 ? "row" : "column",
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                gap: 12,
                flex: 1,
                width: "100%",
                display: width < 900 && selected ? "none" : "flex",
              }}
            >
              {catalog.data.map((pack) => (
                <NavigationCard
                  key={pack.id}
                  title={pack.title}
                  body={`${pack.subject} · ${
                    t("prova.questionCount", { count: pack.question_count })
                  }\n${pack.curriculum_label}`}
                  icon={pack.accessible
                    ? <Layers color="#6042DE" size={24} />
                    : <LockKeyhole color="#625C85" size={24} />}
                  onPress={() => {
                    if (locked) return;
                    setSelected(pack);
                    setKeys([]);
                    setError(null);
                    setDone(false);
                  }}
                />
              ))}
            </View>
            {selected
              ? (
                <View style={[p.card, { flex: 1, width: "100%" }]}>
                  <Text style={p.title}>{selected.title}</Text>
                  <Text style={p.copy}>{selected.description}</Text>
                  {!selected.accessible
                    ? <Text style={p.copy}>{t("library.planRequired")}</Text>
                    : (
                      <>
                        <Text style={p.muted}>
                          {t("libraryPackages.groupHelp")}
                        </Text>
                        {units.isPending
                          ? <Text style={p.copy}>{t("common.loading")}</Text>
                          : units.error
                          ? (
                            <>
                              <Text style={p.copy}>
                                {t("libraryPackages.failed")}
                              </Text>
                              <Button
                                title={t("common.retry")}
                                variant="secondary"
                                onPress={() => void units.refetch()}
                              />
                            </>
                          )
                          : units.data?.map((unit) => (
                            <BuilderChoice
                              key={unit.key}
                              label={`${unit.title} · ${
                                t("prova.questionCount", { count: unit.count })
                              }${
                                unit.owned
                                  ? ` · ${t("libraryPackages.owned")}`
                                  : ""
                              }`}
                              selected={keys.includes(unit.key)}
                              disabled={locked}
                              onPress={() =>
                                setKeys((old) =>
                                  old.includes(unit.key)
                                    ? old.filter((k) => k !== unit.key)
                                    : [...old, unit.key]
                                )}
                            />
                          ))}
                        <View style={[p.form, { padding: 16 }]}>
                          <Text style={p.copy}>
                            {t("libraryPackages.cost", { count, cost })}
                          </Text>
                          <Text style={p.muted}>
                            {t("libraryPackages.remaining", {
                              count: allowance,
                            })}
                          </Text>
                          {cost > allowance
                            ? (
                              <Text style={[p.copy, { color: "#9F362E" }]}>
                                {t("libraryPackages.quota")}
                              </Text>
                            )
                            : null}
                        </View>
                        <Button
                          title={t("libraryPackages.add")}
                          disabled={locked || !keys.length ||
                            cost > allowance || !!units.error}
                          loading={mutation.isPending}
                          onPress={() => void submit()}
                        />
                      </>
                    )}
                  <Button
                    variant="ghost"
                    title={t("common.close")}
                    disabled={locked}
                    onPress={() => setSelected(null)}
                  />
                </View>
              )
              : null}
          </View>
        )}
    </View>
  );
}
