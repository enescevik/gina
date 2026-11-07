import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { fetchProvaDrafts } from "@/lib/prova-draft";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { type BuilderGroup, loadBuilderMaterial } from "./prova-builder-data";
import { QuestionMedia } from "./question-media";

type Props = { groupId: string; draftId: string; version: number };

export function QuestionGroupRevision(props: Props) {
  const { t } = useTranslation();
  const { claims } = useSession();
  const source = useQuery({
    queryKey: ["question_group_revision", claims?.family_id, props.groupId, props.draftId, props.version],
    enabled: !!claims?.family_id,
    queryFn: async () => {
      const draft = (await fetchProvaDrafts(props.draftId))[0];
      if (!draft || draft.submitted_at || draft.version !== props.version) throw new Error(t("structuredRevision.stale"));
      const block = draft.content.blocks.find(b => b.kind === "group" && b.id === props.groupId);
      if (!block) throw new Error(t("structuredRevision.stale"));
      const { groups } = await loadBuilderMaterial([block]);
      const group = groups[0];
      if (!group || group.question_source_members.length < 2) throw new Error(t("groupRevision.failed"));
      return { group, draftTitle: draft.content.title };
    },
  });
  if (!source.data) return <ParentScreen title={t("groupRevision.title")} loading={!source.error}
    error={source.error} onRetry={() => void source.refetch()}><></></ParentScreen>;
  return <GroupRevisionForm key={source.data.group.id} {...source.data} {...props} />;
}

function GroupRevisionForm({ group, draftId, version, draftTitle }: Props & { group: BuilderGroup; draftTitle: string }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const members = [...group.question_source_members].sort((a, b) => a.position - b.position);
  const [title, setTitle] = useState(group.title);
  const [body, setBody] = useState(group.body);
  const [prompts, setPrompts] = useState(() => Object.fromEntries(members.map(m => [m.question_id, m.prompt])));
  const request = useRef<{ id: string; body: string } | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const changes = { title: title.trim(), body: body.trim(), prompts: Object.fromEntries(members.map(m => [m.question_id, prompts[m.question_id]!.trim()])) };
      const fingerprint = JSON.stringify(changes);
      if (request.current?.body !== fingerprint) request.current = { id: randomUUID(), body: fingerprint };
      const { error } = await supabase.rpc("revise_question_source_group", {
        p_request_id: request.current.id, p_group_id: group.id, p_draft_id: draftId, p_version: version, p_changes: changes,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all(["prova_drafts", "builder_material", "question_source_groups", "ai_question_edits"].map(key => cache.invalidateQueries({ queryKey: [key] })));
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: "/parent/prova/builder", params: { draftId } });
    },
  });
  const code = (save.error as { message?: string } | null)?.message ?? "";
  const stale = ["prova_draft_changed", "prova_draft_submitted", "prova_draft_removed", "prova_draft_not_found", "question_group_changed"].includes(code);
  return <ParentScreen title={t("groupRevision.title")} subtitle={t("groupRevision.help")}>
    <Text style={parentStyles.muted}>{t("structuredRevision.draft", { title: draftTitle.trim() || t("provaBuilder.untitled") })}</Text>
    <Field label={t("groupRevision.sourceTitle")} value={title} onChangeText={setTitle} maxLength={160} editable={!save.isPending} />
    <Field label={t("groupRevision.sourceBody")} value={body} onChangeText={setBody} maxLength={6000} multiline editable={!save.isPending} />
    <QuestionMedia questionId={members[0]!.question_id} />
    {members.map((m, i) => <View key={m.question_id}>
      <Field label={t("groupRevision.prompt", { number: i + 1 })} value={prompts[m.question_id] ?? ""}
        onChangeText={text => setPrompts(current => ({ ...current, [m.question_id]: text }))}
        maxLength={3500} multiline editable={!save.isPending} />
    </View>)}
    {save.error && <Text accessibilityRole="alert" style={parentStyles.muted}>{t(stale ? "structuredRevision.stale" : "groupRevision.failed")}</Text>}
    <Button title={t("groupRevision.save")} loading={save.isPending}
      disabled={stale || !title.trim() || members.some(m => (prompts[m.question_id] ?? "").trim().length < 5)}
      onPress={() => save.mutate()} />
  </ParentScreen>;
}
