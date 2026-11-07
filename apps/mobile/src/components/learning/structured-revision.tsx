import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { buildRevisionFields, loadRevisionFields, isStructuredType, structuredSaveErrorCodes, type Json, type Phase2Draft, type StructuredDraft, type Tables } from "@gina/core";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { fetchProvaDrafts } from "@/lib/prova-draft";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { sourceAction } from "@/lib/learning-files";
import { QuestionMedia, type QuestionMediaItem } from "./question-media";
import { StructuredQuestionEditor, structuredErrorMessage } from "./structured-question-author";
import { Phase2QuestionEditor } from "./structured-question-author-p2";
import { StructuredBuilderPreview } from "./prova-builder-ui";

type Revision = { sourceId: string; draftId: string; version: number };

export function StructuredRevision(props: Revision) {
  const { t } = useTranslation();
  const { claims } = useSession();
  const source = useQuery({
    queryKey: ["structured_revision_source", claims?.family_id, props.sourceId, props.draftId, props.version],
    queryFn: async () => {
      const { data, error } = await supabase.from("question_bank").select("*")
        .eq("id", props.sourceId).eq("family_id", claims?.family_id ?? "").eq("kind", "structured").single();
      if (error) throw error;
      const draft = (await fetchProvaDrafts(props.draftId))[0];
      if (!draft || draft.submitted_at || draft.version !== props.version) throw new Error(t("structuredRevision.stale"));
      return { question: data, title: draft.content.title };
    },
    enabled: !!claims?.family_id,
  });
  if (!source.data) return <ParentScreen title={t("structuredRevision.title")} loading={!source.error}
    error={source.error} onRetry={() => void source.refetch()}><></></ParentScreen>;
  return <RevisionForm key={source.data.question.id} question={source.data.question} draftTitle={source.data.title} {...props} />;
}

function RevisionForm({ question, draftId, version, draftTitle }: Revision & { question: Tables<"question_bank">; draftTitle: string }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [stem, setStem] = useState(question.stem);
  const [topic, setTopic] = useState(question.topic);
  const [solution, setSolution] = useState(question.solution ?? "");
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const keys = useQuery({
    queryKey: ["structured_revision_key", question.family_id, question.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_question_answer_keys", { p_question_ids: [question.id] });
      if (error) throw error;
      return (data as { key: Record<string, unknown> }[] | null)?.[0]?.key ?? null;
    },
  });
  const originalFields = useMemo(() => keys.data && question.payload
    ? loadRevisionFields(question.interaction_type ?? "", question.payload as Record<string, unknown>, keys.data)
    : null, [keys.data, question.interaction_type, question.payload]);
  const regionImage = useQuery({
    queryKey: ["structured_revision_image", question.family_id, question.id],
    enabled: originalFields?.type === "region_select" && originalFields.figure === "image",
    staleTime: 60000,
    gcTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_question_media", { p_question_ids: [question.id] });
      if (error) throw error;
      const media = (data as unknown as QuestionMediaItem[] | null)?.[0];
      if (!media) return null;
      const signed = await sourceAction<{ url: string }>({ action: "view", id: media.source_id, question_id: question.id });
      return { uri: signed.url, width: media.width, height: media.height };
    },
  });
  const [changedFields, setChangedFields] = useState<StructuredDraft | Phase2Draft | null>(null);
  const fields = changedFields ?? originalFields;
  const request = useRef<{ id: string; body: string } | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const revisedFields = changedFields ? buildRevisionFields(changedFields) : null;
      const stimulus = (question.payload as { stimulus?: Json } | null)?.stimulus;
      const changes = {
        stem: stem.trim(), topic: topic.trim(), solution: solution.trim() || null, explanation: explanation.trim() || null,
        ...(revisedFields ? { ...revisedFields, payload: { ...revisedFields.payload, ...(stimulus ? { stimulus } : {}) } } : {}),
      };
      const body = JSON.stringify(changes);
      if (request.current?.body !== body) request.current = { id: randomUUID(), body };
      const { error } = await supabase.rpc("revise_structured_question", {
        p_request_id: request.current.id, p_source_id: question.id, p_draft_id: draftId,
        p_version: version, p_changes: changes as Json,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all(["prova_drafts", "builder_material", "question_bank"].map(key => cache.invalidateQueries({ queryKey: [key] })));
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: "/parent/prova/builder", params: { draftId } });
    },
  });
  const stale = ["prova_draft_changed", "prova_draft_submitted", "prova_draft_removed", "prova_draft_not_found"]
    .includes((save.error as { message?: string } | null)?.message ?? "");
  const issue = structuredSaveErrorCodes(save.error)[0];
  return <ParentScreen title={t("structuredRevision.title")} subtitle={t("structuredRevision.help")}>
    <Text style={parentStyles.muted}>{t("structuredRevision.draft", { title: draftTitle.trim() || t("provaBuilder.untitled") })}</Text>
    <Field label={t("structuredRevision.stem")} value={stem} onChangeText={setStem} multiline maxLength={10000} editable={!save.isPending} />
    <Field label={t("structuredRevision.topic")} value={topic} onChangeText={setTopic} maxLength={200} editable={!save.isPending} />
    <QuestionMedia questionId={question.id} />
    {fields ? isStructuredType(fields.type)
      ? <StructuredQuestionEditor draft={fields as StructuredDraft} onChange={setChangedFields} disabled={save.isPending} />
      : <Phase2QuestionEditor draft={fields as Phase2Draft} onChange={setChangedFields} image={regionImage.data ?? null} allowImageFigure={!!regionImage.data || (fields.type === "region_select" && fields.figure === "image")} grade={question.grade} disabled={save.isPending} />
      : <StructuredBuilderPreview q={question} showAnswer />}
    {!fields && keys.isSuccess && <Text style={parentStyles.muted}>{t("structuredRevision.keepRules")}</Text>}
    <Field label={t("structuredRevision.solution")} value={solution} onChangeText={setSolution} multiline maxLength={10000} editable={!save.isPending} />
    <Field label={t("structuredRevision.explanation")} value={explanation} onChangeText={setExplanation} multiline maxLength={10000} editable={!save.isPending} />
    {save.error && <Text accessibilityRole="alert" style={parentStyles.muted}>{stale ? t("structuredRevision.stale") : issue
      ? structuredErrorMessage(t, question.interaction_type, issue) : t("structuredRevision.failed")}</Text>}
    <Button title={t("structuredRevision.save")} loading={save.isPending} disabled={stale || stem.trim().length < 5 || !topic.trim()}
      onPress={() => save.mutate()} />
  </ParentScreen>;
}
