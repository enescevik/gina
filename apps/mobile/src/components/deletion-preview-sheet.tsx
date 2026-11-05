import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import {
  type AccountDeletionPreview,
  type ChildDeletionPreview,
  type DeletionPreview,
  childDeletionCountLines,
  deletionErrorKey,
  deletionPreviewSchema,
  formatApproximateBytes,
  isPreviewUsable,
  orderedDeletionWarnings,
  previewSecondsLeft,
  sumChildDeletionCounts,
} from "@gina/core";
import { Button } from "./ui/button";
import { DecisionSheet } from "./ui/decision-sheet";
import { Field } from "./ui/field";
import { parentStyles } from "./ui/parent-screen";
import { supabase } from "@/lib/supabase";

export type DeletionSheetTarget = { kind: "child"; childId: string; name: string } | { kind: "account" };

/** Errors after which the old preview can no longer be confirmed: load a fresh one and show it. */
const REFRESH_ON = new Set(["deletionPreview.error.stale", "deletionPreview.error.expired", "deletionPreview.error.used", "deletionPreview.error.notFound"]);

// The generated database types predate L03; keep the untyped call in one place.
const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Raw server error → message code; never shows raw server text or ids to the parent. */
export function deletionErrorCode(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "";
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase("tr-TR") === b.trim().toLocaleLowerCase("tr-TR");

/**
 * Permanent deletion (L03): impact preview, archive alternative, strong confirmation and an
 * idempotent request id per preview token. The caller performs the actual call with `perform`.
 */
export function DeletionPreviewSheet({ target, onClose, perform, onDone, ready = true, errorText, children }: {
  target: DeletionSheetTarget;
  onClose: () => void;
  /** Must throw an Error whose message is the server error code (e.g. `deletion_preview_stale`). */
  perform: (preview: DeletionPreview, requestId: string) => Promise<unknown>;
  onDone: (preview: DeletionPreview) => void;
  /** Extra gate from the caller (account re-authentication). */
  ready?: boolean;
  /** Caller-specific text for its own error codes (e.g. failed re-authentication). */
  errorText?: (code: string) => string | null;
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("en") ? "en" : "tr";
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [typed, setTyped] = useState("");
  const [refreshed, setRefreshed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const request = useRef({ token: "", id: "" });
  const sending = useRef(false);

  // A mutation, not a query: global invalidations must not silently mint new tokens (30/hour limit).
  const load = useMutation({
    mutationFn: async () => {
      const body = target.kind === "child" ? { kind: "child", child_id: target.childId } : { kind: "account" };
      const { data, error } = await rpc("deletion_preview", { p_target: body });
      if (error) throw new Error(error.message);
      const parsed = deletionPreviewSchema.safeParse(data);
      if (!parsed.success) throw new Error("deletion_preview_invalid_shape");
      return parsed.data;
    },
    onSuccess: (data) => { setPreview(data); setNow(Date.now()); },
  });
  const confirm = useMutation({
    mutationFn: async (current: DeletionPreview) => {
      // Same token → same request id, so a lost response or a double tap never deletes twice.
      if (request.current.token !== current.preview_token) request.current = { token: current.preview_token, id: randomUUID() };
      return perform(current, request.current.id);
    },
    onSuccess: (_result, current) => onDone(current),
    onError: (error) => {
      if (REFRESH_ON.has(deletionErrorKey(deletionErrorCode(error)))) {
        setRefreshed(true);
        load.mutate();
      }
    },
    onSettled: () => { sending.current = false; },
  });

  const { mutate: loadPreview } = load;
  useEffect(() => { loadPreview(); }, [loadPreview]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const busy = confirm.isPending;
  const usable = !!preview && isPreviewUsable(preview, new Date(now));
  const nameOk = target.kind !== "child" || sameName(typed, preview?.kind === "child" ? preview.child.name : target.name);
  const canConfirm = usable && nameOk && ready && !busy && !load.isPending;
  const title = target.kind === "child" ? t("deletionPreview.childTitle", { name: target.name }) : t("deletionPreview.accountTitle");
  const confirmCode = confirm.error ? deletionErrorCode(confirm.error) : "";
  const confirmError = confirm.error ? errorText?.(confirmCode) ?? t(deletionErrorKey(confirmCode)) : null;
  const loadError = load.error ? t(deletionErrorKey(deletionErrorCode(load.error))) : null;
  const minutes = preview ? Math.max(1, Math.floor(previewSecondsLeft(preview, new Date(now)) / 60)) : 0;

  const submit = () => {
    if (!preview || !canConfirm || sending.current) return;
    sending.current = true;
    setRefreshed(false);
    confirm.mutate(preview);
  };
  const close = () => { if (!busy) onClose(); };

  return (
    <DecisionSheet
      visible
      title={title}
      onClose={close}
      footer={
        <View style={{ gap: 8 }}>
          {busy ? <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t("deletionPreview.inProgress")}</Text> : null}
          <Button variant="danger" title={t("deletionPreview.confirm")} loading={busy} disabled={!canConfirm} onPress={submit} />
          <Button variant="ghost" title={t("common.cancel")} disabled={busy} onPress={close} />
        </View>
      }
    >
      <Text style={[parentStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{t("deletionPreview.intro")}</Text>
      {load.isPending && !preview ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <ActivityIndicator color="#6042DE" />
          <Text style={parentStyles.muted}>{t("deletionPreview.loading")}</Text>
        </View>
      ) : null}
      {loadError ? (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="alert" style={[parentStyles.copy, { color: "#A43135" }]}>{loadError}</Text>
          <Button variant="secondary" title={t("deletionPreview.refresh")} loading={load.isPending} onPress={() => load.mutate()} />
        </View>
      ) : null}
      {confirmError ? <Text accessibilityRole="alert" style={[parentStyles.copy, { color: "#A43135" }]}>{confirmError}</Text> : null}
      {refreshed && preview && !load.isPending && !load.error ? <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t("deletionPreview.refreshed")}</Text> : null}

      {preview?.kind === "child" ? <ChildPreviewBody preview={preview} locale={locale} /> : null}
      {preview?.kind === "account" ? <AccountPreviewBody preview={preview} locale={locale} /> : null}

      {preview ? <>
        <Section title={t("deletionPreview.warningsHeading")}>
          {orderedDeletionWarnings(preview.warnings).map((w) => <Line key={w} tone="warn" text={t(`deletionPreview.warning.${w}`, { defaultValue: "" })} />)}
          <Line tone="warn" text={t("deletionPreview.subscription.body")} />
          <Button variant="ghost" title={t("deletionPreview.subscription.manage")} disabled={busy} onPress={() => { onClose(); router.push("/parent/subscription"); }} />
        </Section>
        {preview.kind === "child" && preview.alternatives.archive_available ? (
          <View style={{ gap: 8, backgroundColor: "#EDF7F1", borderColor: "#D4E9DD", borderWidth: 1, borderRadius: 20, padding: 16 }}>
            <Text style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{t("deletionPreview.archiveInstead")}</Text>
            <Text style={parentStyles.muted}>{t("deletionPreview.archiveInsteadBody")}</Text>
            <Button variant="secondary" title={t("deletionPreview.archiveInstead")} disabled={busy} onPress={() => { onClose(); router.push({ pathname: "/parent/profile-archive", params: { childId: preview.child.id } }); }} />
          </View>
        ) : null}
        {preview.kind === "child" && preview.alternatives.already_archived ? <Text style={parentStyles.muted}>{t("deletionPreview.alreadyArchived")}</Text> : null}
        <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{usable ? t("deletionPreview.expiresInMinutes", { minutes }) : t("deletionPreview.expiredNow")}</Text>
        {!usable ? <Button variant="secondary" title={t("deletionPreview.refresh")} loading={load.isPending} disabled={busy} onPress={() => load.mutate()} /> : null}
        {children}
        {target.kind === "child" ? (
          <Field
            label={t("deletionPreview.typeName", { name: preview.kind === "child" ? preview.child.name : target.name })}
            accessibilityLabel={t("deletionPreview.typeNameLabel")}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!busy}
          />
        ) : null}
        <Text style={parentStyles.muted}>{t("deletionPreview.retrySafe")}</Text>
      </> : null}
    </DecisionSheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={{ gap: 8 }}><Text accessibilityRole="header" style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{title}</Text>{children}</View>;
}

function Line({ text, tone = "plain" }: { text: string; tone?: "plain" | "warn" | "keep" }) {
  if (!text) return null;
  const dot = tone === "warn" ? "#C9792C" : tone === "keep" ? "#287460" : "#A43135";
  return <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginTop: 9 }} />
    <Text style={[parentStyles.copy, { flex: 1 }]}>{text}</Text>
  </View>;
}

function ChildPreviewBody({ preview, locale }: { preview: ChildDeletionPreview; locale: "tr" | "en" }) {
  const { t } = useTranslation();
  const lines = childDeletionCountLines(preview.deletes);
  const kept = preview.preserved;
  return <>
    <Section title={t("deletionPreview.deletesHeading")}>
      {lines.length ? lines.map((line) => <Line key={line.key} text={t(`deletionPreview.count.${line.key}`, { count: line.count, size: formatApproximateBytes(preview.deletes.files.bytes, locale) })} />) : <Line text={t("deletionPreview.nothingExtra")} />}
    </Section>
    <Section title={t("deletionPreview.preservedHeading")}>
      {kept.co_parent_private_notes > 0 ? <Line tone="keep" text={t("deletionPreview.preserved.coParentNotes", { count: kept.co_parent_private_notes })} /> : null}
      {kept.prova_drafts_referencing > 0 ? <Line tone="keep" text={t("deletionPreview.preserved.provaDrafts", { count: kept.prova_drafts_referencing })} /> : null}
      {kept.family_files.count > 0 ? <Line tone="keep" text={t("deletionPreview.preserved.familyFiles", { count: kept.family_files.count, size: formatApproximateBytes(kept.family_files.bytes, locale) })} /> : null}
      {kept.other_children > 0 ? <Line tone="keep" text={t("deletionPreview.preserved.otherChildren", { count: kept.other_children })} /> : null}
      <Line tone="keep" text={t("deletionPreview.preserved.familyContent")} />
    </Section>
  </>;
}

const ACCOUNT_KEYS = ["children", "own_notes", "own_shares", "membership", "notes", "files", "questions", "rewards", "prova_drafts", "devices", "shares_open"] as const;

function AccountPreviewBody({ preview, locale }: { preview: AccountDeletionPreview; locale: "tr" | "en" }) {
  const { t } = useTranslation();
  if (!preview.families.length) return <Text style={parentStyles.copy}>{t("deletionPreview.noFamily")}</Text>;
  return <>
    {preview.families.map((family) => {
      const d = family.deletes as Record<string, unknown>;
      const files = (d.files ?? {}) as { count?: number; bytes?: number };
      const lines = ACCOUNT_KEYS.map((key) => {
        const raw = key === "files" ? files.count : d[key];
        const count = typeof raw === "number" ? raw : 0;
        return count > 0 ? { key, count } : null;
      }).filter((x): x is { key: (typeof ACCOUNT_KEYS)[number]; count: number } => !!x);
      const childCounts = family.mode === "cascade" ? sumChildDeletionCounts(family.children) : null;
      return <Section key={family.id} title={t(family.mode === "cascade" ? "deletionPreview.familyCascade" : "deletionPreview.familyTransfer", { name: family.name })}>
        <Text style={[parentStyles.muted, { fontFamily: "Nunito_700Bold" }]}>{t("deletionPreview.deletesHeading")}</Text>
        {lines.map((line) => <Line key={line.key} text={t(`deletionPreview.account.${line.key}`, { count: line.count, size: formatApproximateBytes(files.bytes ?? 0, locale) })} />)}
        {childCounts ? childDeletionCountLines(childCounts).map((line) => <Line key={`c-${line.key}`} text={t(`deletionPreview.count.${line.key}`, { count: line.count, size: formatApproximateBytes(childCounts.files.bytes, locale) })} />) : null}
        <Text style={[parentStyles.muted, { fontFamily: "Nunito_700Bold" }]}>{t("deletionPreview.preservedHeading")}</Text>
        {family.mode === "transfer" ? <Line tone="keep" text={t("deletionPreview.preserved.transferChildren", { count: family.children.length })} /> : <Line tone="keep" text={t("deletionPreview.preserved.billingRecords")} />}
      </Section>;
    })}
    {preview.subscriptions.length ? <Section title={t("deletionPreview.subscription.manage")}>
      {preview.subscriptions.map((s) => <Line key={s.id} tone="warn" text={t("deletionPreview.subscriptionLine", { platform: t(`deletionPreview.platform.${s.platform}`), plan: s.plan, status: s.status })} />)}
    </Section> : null}
  </>;
}
