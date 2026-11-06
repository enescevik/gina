import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { contributionSnapshot, contributionStatus } from "@gina/core";
import { ParentScreen } from "@/components/ui/parent-screen";
import { QuestionMedia } from "@/components/learning/question-media";
import { Toggle } from "@/components/ui/toggle";
import { p, SatinButton, Tag, u } from "@/components/planner/ui";
import {
  ContributionChains,
  QuestionNotes,
  trailErrorKey,
  useContributionChains,
} from "@/components/prova-library/contribution-trail";
import { contributionJournal } from "@/lib/setup-command";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/**
 * Sends a corrected copy linked to a rejected one (p_supersedes). Text-only copies go
 * straight to begin_question_contribution; copies with images need the Edge renderer, which
 * forwards `supersedes`. One request id per chosen question makes double taps and retries
 * resolve to the same server row (same id + same link = same result).
 */
async function sendCorrection(input: {
  id: string;
  question: string;
  supersedes: string;
  images: boolean;
}) {
  if (input.images) {
    const { data, error } = await supabase.functions.invoke("contribution-submit", {
      body: {
        id: input.id,
        question_id: input.question,
        rights: true,
        no_personal_data: true,
        supersedes: input.supersedes,
      },
      timeout: 30000,
    });
    if (error) {
      let code = "contribution_failed";
      try {
        code = (await error.context?.json())?.error ?? code;
      } catch {}
      throw Error(code);
    }
    if (data?.error) throw Error(data.error);
    return contributionStatus.parse(data.status);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const { data, error } = await supabase.rpc("begin_question_contribution", {
      p_id: input.id,
      p_question_id: input.question,
      p_rights: true,
      p_no_personal_data: true,
      p_supersedes: input.supersedes,
    }).abortSignal(controller.signal);
    if (error) throw Error(error.message);
    return contributionStatus.parse((data as { status?: string }).status);
  } finally {
    clearTimeout(timer);
  }
}

export default function ContributionScreen() {
  const dimensions = useWindowDimensions();
  const wide = dimensions.width >= 1000 && dimensions.fontScale < 1.4;
  const { t } = useTranslation(),
    { session, claims } = useSession(),
    cache = useQueryClient();
  const { questionId, groupId, supersedes } = useLocalSearchParams<
    { questionId?: string; groupId?: string; supersedes?: string }
  >();
  const fixing = !!supersedes && !!questionId;
  const journal = useMemo(
    () => contributionJournal(session?.user.id ?? "", claims?.family_id ?? ""),
    [session?.user.id, claims?.family_id],
  );
  const [initial] = useState(() => {
    try {
      return { pending: journal.read(), blocked: false };
    } catch {
      return { pending: null, blocked: true };
    }
  });
  const [pending, setPending] = useState(fixing ? null : initial.pending),
    [rights, setRights] = useState(false),
    [personal, setPersonal] = useState(false),
    [status, setStatus] = useState(""),
    [chosen, setChosen] = useState(questionId ?? "");
  const requests = useRef(new Map<string, string>());
  const chains = useContributionChains();
  const rejected = fixing
    ? chains.data?.chains.flatMap((c) => c.steps).find((s) => s.id === supersedes)
    : undefined;
  const rejectedRow = fixing ? chains.data?.rows.get(supersedes!) : undefined;
  const target = fixing ? chosen : questionId;
  const detail = useQuery({
    queryKey: ["contribution_preview", claims?.family_id, target, groupId],
    enabled: !pending && (fixing || !initial.blocked) && !!(target || groupId),
    queryFn: async () => {
      let id = target;
      if (!id && groupId) {
        const { data, error } = await supabase.from("question_source_members")
          .select("question_id").eq("group_id", groupId).order("position")
          .limit(1).maybeSingle();
        if (error || !data) throw Error("question_not_found");
        id = data.question_id;
      }
      if (!id) throw Error("question_not_found");
      const { data, error } = await supabase.rpc(
        "preview_question_contribution",
        { p_question_id: id },
      );
      if (error) throw error;
      return { id, snapshot: contributionSnapshot.parse(data) };
    },
  });
  const candidates = useQuery({
    queryKey: [
      "contribution_candidates",
      claims?.family_id,
      rejectedRow?.grade,
      rejectedRow?.subject,
    ],
    enabled: fixing && !!rejectedRow && !!claims?.family_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("question_bank")
        .select("id,topic,stem,created_at")
        .eq("family_id", claims!.family_id!)
        .eq("grade", rejectedRow!.grade)
        .eq("subject", rejectedRow!.subject)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      if (fixing) {
        if (!rights || !personal || !detail.data) throw Error("consent_required");
        const question = detail.data.id;
        let id = requests.current.get(question);
        if (!id) {
          id = randomUUID();
          requests.current.set(question, id);
        }
        return {
          status: await sendCorrection({
            id,
            question,
            supersedes: supersedes!,
            images: !!detail.data.snapshot.images?.length,
          }),
        };
      }
      if (initial.blocked) throw Error("contribution_local");
      if (!pending && (!rights || !personal || !detail.data)) {
        throw Error("consent_required");
      }
      const command = pending ?? journal.prepare(detail.data!.id);
      setPending(command);
      const result = await journal.send(command);
      setPending(journal.read());
      return result;
    },
    onSuccess: (result) => {
      setStatus(result.status);
      void cache.invalidateQueries({ queryKey: ["contribution_sets"] });
      void cache.invalidateQueries({ queryKey: ["learning_library"] });
    },
  });
  const error = submit.error ?? detail.error;
  const code = (error as { message?: string })?.message;
  const trailKey = trailErrorKey(error);
  const key = code &&
      [
        "contribution_disabled",
        "contribution_in_progress",
        "contribution_size",
        "contribution_not_original",
        "question_incomplete",
        "source_not_ready",
        "source_changed",
        "contribution_daily_limit",
      ].includes(code)
    ? code
    : "contribution_failed";
  const snapshot = detail.data?.snapshot;
  if (!questionId && !groupId && !pending && !initial.blocked) {
    return (
      <ParentScreen title={t("contribution.title")}>
        <ContributionChains />
        <View style={u.card}>
          <Text style={u.heading}>{t("contribution.chooseFirst")}</Text>
          <Text style={u.copy}>{t("contribution.chooseFirstHelp")}</Text>
          <SatinButton
            title={t("prova.title")}
            onPress={() => router.replace("/parent/prova")}
          />
        </View>
      </ParentScreen>
    );
  }
  return (
    <ParentScreen
      wide
      title={t(fixing ? "contributionTrail.fixTitle" : "contribution.title")}
      subtitle={t(fixing ? "contributionTrail.fixHelp" : "contribution.subtitle")}
    >
      {status && status !== "preparing"
        ? (
          <View style={[u.card, { backgroundColor: p.mint }]} testID="contribution-done">
            <Text style={u.heading}>{t(`contribution.status.${status}`)}</Text>
            <Text style={u.copy}>
              {t(fixing ? "contributionTrail.fixSent" : "contribution.savedHelp")}
            </Text>
            {fixing
              ? (
                <SatinButton
                  title={t("contributionTrail.viewHistory")}
                  onPress={() => router.replace("/parent/prova/share")}
                />
              )
              : (
                <SatinButton
                  title={t("common.back")}
                  onPress={() =>
                    router.canGoBack()
                      ? router.back()
                      : router.replace("/parent/prova/library")}
                />
              )}
          </View>
        )
        : (
          <>
            {initial.blocked && !fixing
              ? (
                <Text accessibilityRole="alert" style={u.error}>
                  {t("setupRecovery.blockedBody")}
                </Text>
              )
              : null}
            {fixing
              ? (
                <View style={[u.card, { backgroundColor: "#FFF1DD" }]} testID="contribution-fix">
                  <Text style={u.heading}>{t("contributionTrail.previousNote")}</Text>
                  <Text selectable style={u.copy}>
                    {rejected?.review_note ?? (chains.isPending ? t("common.loading") : t("contributionTrail.noNote"))}
                  </Text>
                  <QuestionNotes questions={rejected?.questions} />
                  {rejected && rejected.question_count > 1
                    ? (
                      <>
                        <Text style={u.copy}>
                          {t("contributionTrail.grouped", { count: rejected.question_count })}
                        </Text>
                        <Text style={u.small}>{t("contributionTrail.atomic")}</Text>
                      </>
                    )
                    : null}
                  <Text style={u.bold}>{t("contributionTrail.pick")}</Text>
                  <View style={[u.row, { flexWrap: "wrap" }]}>
                    {questionId
                      ? (
                        <Tag
                          label={t("contributionTrail.original")}
                          selected={chosen === questionId}
                          onPress={() => {
                            submit.reset();
                            setChosen(questionId);
                          }}
                        />
                      )
                      : null}
                    {candidates.data?.filter((q) => q.id !== questionId).map((q) => (
                      <Tag
                        key={q.id}
                        label={q.topic || q.stem.slice(0, 40)}
                        selected={chosen === q.id}
                        onPress={() => {
                          submit.reset();
                          setChosen(q.id);
                        }}
                      />
                    ))}
                  </View>
                  {candidates.data &&
                      !candidates.data.some((q) => q.id !== questionId)
                    ? <Text style={u.small}>{t("contributionTrail.noCandidates")}</Text>
                    : null}
                  <SatinButton
                    secondary
                    title={t("contributionTrail.writeNew")}
                    onPress={() =>
                      router.push({
                        pathname: "/parent/prova/question",
                        params: rejectedRow
                          ? { grade: String(rejectedRow.grade), subject: rejectedRow.subject }
                          : {},
                      })}
                  />
                </View>
              )
              : null}
            {pending
              ? (
                <View style={u.card}>
                  <Text style={u.heading}>{t("setupRecovery.title")}</Text>
                  <Text style={u.copy}>{t("contribution.pending")}</Text>
                </View>
              )
              : null}
            {detail.isPending && !pending
              ? <Text style={u.copy}>{t("common.loading")}</Text>
              : null}
            {!pending && snapshot
              ? (
                <>
                  <View
                    style={{
                      flexDirection: wide ? "row" : "column",
                      alignItems: "flex-start",
                      gap: 20,
                    }}
                  >
                    <View
                      style={[u.card, {
                        flex: wide ? 1 : undefined,
                        width: wide ? undefined : "100%",
                        minWidth: 0,
                      }]}
                    >
                      <Text style={u.heading}>{snapshot.title}</Text>
                      <Text style={u.copy}>
                        {t("contribution.scope", {
                          count: snapshot.questions.length,
                          grade: snapshot.grade,
                          subject: snapshot.subject,
                        })}
                      </Text>
                      {snapshot.grouped
                        ? (
                          <Text style={u.copy}>
                            {t("contribution.groupHelp")}
                          </Text>
                        )
                        : null}
                      {snapshot.body
                        ? <Text selectable style={u.copy}>{snapshot.body}</Text>
                        : null}
                      <QuestionMedia
                        questionId={detail.data!.id}
                        items={snapshot.images?.map((image) => ({
                          source_id: image.id,
                          question_id: detail.data!.id,
                          alt: image.alt,
                          width: image.width,
                          height: image.height,
                        }))}
                      />
                    </View>
                    <View
                      style={{
                        flex: wide ? 1.1 : undefined,
                        width: wide ? undefined : "100%",
                        gap: 20,
                        minWidth: 0,
                      }}
                    >
                      {snapshot.questions.map((q, index) => (
                        <View key={q.key} style={u.card}>
                          <Text style={u.heading}>
                            {t("sharedQuestions.questionN", { n: index + 1 })}
                          </Text>
                          <Text selectable style={u.copy}>{q.stem}</Text>
                          {q.choices?.map((c) => (
                            <Text key={c.key} style={u.copy}>
                              {c.key}. {c.text}
                            </Text>
                          ))}
                          <Text style={u.copy}>
                            {t("contribution.answer", {
                              answer: q.correct_key ?? q.expected_answer,
                            })}
                          </Text>
                          <Text style={u.copy}>{q.solution}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={[u.card, { backgroundColor: p.mint }]}>
                    <Text style={u.heading}>
                      {t("contribution.beforeShare")}
                    </Text>
                    <Text style={u.copy}>{t("contribution.license")}</Text>
                    <Text style={u.copy}>{t("contribution.rewardHelp")}</Text>
                    <Toggle
                      label={t("contribution.rights")}
                      value={rights}
                      onChange={setRights}
                      disabled={submit.isPending}
                    />
                    <Toggle
                      label={t("library.noPersonal")}
                      value={personal}
                      onChange={setPersonal}
                      disabled={submit.isPending}
                    />
                  </View>
                </>
              )
              : null}
            {error
              ? (
                <View>
                  <Text accessibilityRole="alert" style={u.error} testID="contribution-error">
                    {t(
                      trailKey ??
                        (fixing && key === "contribution_failed"
                          ? "contributionTrail.errors.failed"
                          : "contribution.errors." + key),
                    )}
                  </Text>
                  {!pending && detail.error
                    ? (
                      <SatinButton
                        secondary
                        title={t("common.retry")}
                        onPress={() => void detail.refetch()}
                      />
                    )
                    : null}
                </View>
              )
              : null}
            <SatinButton
              title={t(
                fixing
                  ? "contributionTrail.fix"
                  : pending
                  ? "setupRecovery.retry"
                  : "contribution.submit",
              )}
              busy={submit.isPending}
              disabled={(!fixing && initial.blocked) || submit.isPending ||
                (!pending && (!rights || !personal || !snapshot))}
              onPress={() => submit.mutate()}
            />
          </>
        )}
    </ParentScreen>
  );
}
