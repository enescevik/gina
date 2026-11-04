import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { contributionSnapshot } from "@gina/core";
import { ParentScreen } from "@/components/ui/parent-screen";
import { QuestionMedia } from "@/components/learning/question-media";
import { Toggle } from "@/components/ui/toggle";
import { p, SatinButton, u } from "@/components/planner/ui";
import { contributionJournal } from "@/lib/setup-command";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function ContributionScreen() {
  const dimensions = useWindowDimensions();
  const wide = dimensions.width >= 1000 && dimensions.fontScale < 1.4;
  const { t } = useTranslation(),
    { session, claims } = useSession(),
    cache = useQueryClient();
  const { questionId, groupId } = useLocalSearchParams<
    { questionId?: string; groupId?: string }
  >();
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
  const [pending, setPending] = useState(initial.pending),
    [rights, setRights] = useState(false),
    [personal, setPersonal] = useState(false),
    [status, setStatus] = useState("");
  const detail = useQuery({
    queryKey: ["contribution_preview", claims?.family_id, questionId, groupId],
    enabled: !pending && !initial.blocked,
    queryFn: async () => {
      let id = questionId;
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
  const submit = useMutation({
    mutationFn: async () => {
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
    },
  });
  const error = submit.error ?? detail.error;
  const code = (error as { message?: string })?.message;
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
  return (
    <ParentScreen
      wide
      title={t("contribution.title")}
      subtitle={t("contribution.subtitle")}
    >
      {status && status !== "preparing"
        ? (
          <View style={[u.card, { backgroundColor: p.mint }]}>
            <Text style={u.heading}>{t(`contribution.status.${status}`)}</Text>
            <Text style={u.copy}>{t("contribution.savedHelp")}</Text>
            <SatinButton
              title={t("common.back")}
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace("/parent/prova/library")}
            />
          </View>
        )
        : (
          <>
            {initial.blocked
              ? (
                <Text accessibilityRole="alert" style={u.error}>
                  {t("setupRecovery.blockedBody")}
                </Text>
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
                  <Text accessibilityRole="alert" style={u.error}>
                    {t("contribution.errors." + key)}
                  </Text>
                  {!pending
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
              title={t(pending ? "setupRecovery.retry" : "contribution.submit")}
              disabled={initial.blocked || submit.isPending ||
                (!pending && (!rights || !personal || !snapshot))}
              onPress={() => submit.mutate()}
            />
          </>
        )}
    </ParentScreen>
  );
}
