import { useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useTranslation } from "react-i18next";
import { type CohortAppealCommand, type CohortCriterion } from "@gina/core";
import { cohortAppealJournal } from "@/lib/setup-command";
import { useSession } from "@/lib/session";
import { Field } from "@/components/ui/field";
import { p, SatinButton, Tag, u } from "@/components/planner/ui";
export interface CohortReviewRow {
  ord: number;
  stem: string;
  kind: string;
  topic: string;
  maximum: number;
  points: number | null;
  outcome: string;
  feedback: string | null;
  revision: number;
  criteria: CohortCriterion[] | null;
  criterion_points: Record<string, number> | null;
  appeal: { status: string; reason: string; response: string | null } | null;
}
export function CohortWrittenReport({
  group,
  child,
  published,
  points,
  maximum,
  rows,
  cancelled,
  onSaved,
}: {
  group: string;
  child: string;
  published: boolean;
  points: number | null;
  maximum: number;
  rows: CohortReviewRow[];
  cancelled: boolean;
  onSaved: () => void;
}) {
  const { session, claims } = useSession();
  return (
    <Report
      key={`${session?.user.id}:${claims?.family_id}`}
      user={session?.user.id ?? ""}
      family={claims?.family_id ?? ""}
      group={group}
      child={child}
      published={published}
      points={points}
      maximum={maximum}
      rows={rows}
      cancelled={cancelled}
      onSaved={onSaved}
    />
  );
}
function Report({
  user,
  family,
  group,
  child,
  published,
  points,
  maximum,
  rows,
  cancelled,
  onSaved,
}: {
  user: string;
  family: string;
  group: string;
  child: string;
  published: boolean;
  points: number | null;
  maximum: number;
  rows: CohortReviewRow[];
  cancelled: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const journal = useMemo(() => cohortAppealJournal(user, family), [
    user,
    family,
  ]);
  const [initial] = useState(() => {
    try {
      return { pending: journal.read(), blocked: false };
    } catch {
      return { pending: null, blocked: true };
    }
  });
  const [pending, setPending] = useState<CohortAppealCommand | null>(
      initial.pending,
    ),
    [ord, setOrd] = useState(rows[0]?.ord ?? 1),
    [reason, setReason] = useState(""),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const gate = useRef(false);
  const q = rows.find((r) => r.ord === ord) ?? rows[0];
  async function send() {
    if (gate.current || initial.blocked) return;
    gate.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const c = journal.read() ??
        journal.prepare({
          p_request: randomUUID(),
          p_group: group,
          p_child: child,
          p_ord: q!.ord,
          p_review_revision: q!.revision,
          p_reason: reason,
        });
      setPending(c);
      await journal.send(c);
      setPending(null);
      setReason("");
      setEditing(false);
      setSaved(true);
      onSaved();
    } catch (e) {
      try {
        setPending(journal.read());
      } catch {}
      const code = (e as Error).message;
      setError(
        t(
          code === "group_review_changed"
            ? "cohort.reviewChanged"
            : code === "group_appeal_open"
            ? "cohort.appealOpen"
            : "cohort.sendFailed",
        ),
      );
      onSaved();
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          backgroundColor: p.lilac,
          borderRadius: 20,
          padding: 18,
          gap: 8,
        }}
      >
        <Text style={u.heading}>
          {published
            ? t("cohort.score", { points, maximum })
            : t("cohort.waiting")}
        </Text>
        <Text style={u.small}>
          {t(published ? "cohort.publishedHelp" : "cohort.waitingHelp")}
        </Text>
      </View>
      {initial.blocked
        ? (
          <Text accessibilityRole="alert" style={u.error}>
            {t("cohort.storageError")}
          </Text>
        )
        : null}
      {error
        ? <Text accessibilityRole="alert" style={u.error}>{error}</Text>
        : null}
      {saved
        ? (
          <Text accessibilityRole="alert" style={u.bold}>
            {t("cohort.appealSaved")}
          </Text>
        )
        : null}
      {pending
        ? (
          <View
            style={{
              padding: 16,
              borderRadius: 18,
              backgroundColor: p.mint,
              gap: 10,
            }}
          >
            <Text style={u.bold}>{t("cohort.pending")}</Text>
            <Text style={u.small}>{t("cohort.pendingHelp")}</Text>
            <SatinButton
              title={t("cohort.checkRequest")}
              busy={busy}
              onPress={() => void send()}
            />
          </View>
        )
        : null}
      <Text style={u.heading}>{t("cohort.questionReviews")}</Text>
      <View style={[u.row, { flexWrap: "wrap" }]}>
        {rows.map((r) => (
          <Tag
            key={r.ord}
            label={t("cohort.question", { n: r.ord })}
            selected={q?.ord === r.ord}
            disabled={busy || !!pending}
            onPress={() => {
              setOrd(r.ord);
              setEditing(false);
              setReason("");
              setSaved(false);
            }}
          />
        ))}
      </View>
      {q
        ? (
          <View
            style={{
              gap: 12,
              borderWidth: 1,
              borderColor: p.line,
              borderRadius: 20,
              padding: 18,
              backgroundColor: "#FFF",
            }}
          >
            <Text style={u.bold}>{q.stem}</Text>
            <Text style={u.small}>{q.topic}</Text>
            <Text style={u.heading}>
              {q.points == null
                ? t(
                  q.outcome === "unreadable"
                    ? "cohort.unreadable"
                    : "cohort.pendingReview",
                )
                : t("cohort.score", { points: q.points, maximum: q.maximum })}
            </Text>
            {!published
              ? <Text style={u.small}>{t("cohort.provisional")}</Text>
              : null}
            {q.outcome === "not_answered"
              ? <Text style={u.small}>{t("cohort.noAnswer")}</Text>
              : null}
            {q.criteria?.map((c) => (
              <View key={c.id} style={[u.row, { alignItems: "flex-start" }]}>
                <Text style={[u.small, { flex: 1 }]}>{c.criterion}</Text>
                <Text style={u.bold}>
                  {q.criterion_points?.[c.id] ?? "—"} / {c.points}
                </Text>
              </View>
            ))}
            {q.feedback
              ? (
                <View
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: p.mint,
                    gap: 6,
                  }}
                >
                  <Text style={u.bold}>{t("cohort.feedback")}</Text>
                  <Text style={u.small}>{q.feedback}</Text>
                </View>
              )
              : null}
            {q.appeal
              ? (
                <View
                  style={{
                    gap: 6,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: p.line,
                  }}
                >
                  <Text style={u.bold}>
                    {t(
                      q.appeal.status === "open"
                        ? "cohort.appealOpen"
                        : "cohort.appealResolved",
                    )}
                  </Text>
                  <Text style={u.small}>{q.appeal.reason}</Text>
                  {q.appeal.response
                    ? <Text style={u.small}>{q.appeal.response}</Text>
                    : null}
                </View>
              )
              : null}
            {!cancelled && q.kind === "open_ended" && q.revision > 0 &&
                q.appeal?.status !== "open" && !pending
              ? (
                <>
                  {!editing
                    ? (
                      <SatinButton
                        secondary
                        title={t("cohort.askReview")}
                        disabled={busy || initial.blocked}
                        onPress={() => setEditing(true)}
                      />
                    )
                    : (
                      <View style={{ gap: 12 }}>
                        <Field
                          label={t("cohort.reason")}
                          value={reason}
                          onChangeText={setReason}
                          multiline
                          maxLength={2000}
                          placeholder={t("cohort.reasonHelp")}
                        />
                        <Text style={u.small}>{t("cohort.appealPrivacy")}</Text>
                        <SatinButton
                          title={t("cohort.sendAppeal")}
                          disabled={busy || reason.trim().length < 10 ||
                            initial.blocked}
                          busy={busy}
                          onPress={() => void send()}
                        />
                        <SatinButton
                          secondary
                          title={t("common.cancel")}
                          disabled={busy}
                          onPress={() => setEditing(false)}
                        />
                      </View>
                    )}
                </>
              )
              : null}
          </View>
        )
        : null}
      <Text style={u.small}>{t("cohort.parentFeedback")}</Text>
    </View>
  );
}
