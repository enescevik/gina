import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import {
  BULK_APPLY_LIMIT,
  type BulkArchiveItem,
  type BulkArchivePreview,
  type BulkArchivePreviewItem,
  type BulkArchiveResult,
  type BulkArchiveScope,
  bulkArchivePreviewSchema,
  bulkArchiveScopeSchema,
  bulkItemsFromPreview,
  bulkPreviewRowKey,
  bulkReasonKey,
  bulkRestoreItemsFromPreview,
  bulkSelectableRows,
  bulkSelectionState,
  readBulkResult,
  summarizeBulkResult,
} from "@gina/core";
import { DecisionSheet } from "@/components/ui/decision-sheet";
import { Pressable } from "@/components/ui/pressable";
import { supabase } from "@/lib/supabase";
import { p, SatinButton, u } from "./ui";

/** C03: the list types without their own selection mode (L02 second round wired routines/rewards/notes). */
export type BulkScopeType = "event" | "prova_draft" | "learning_plan" | "school_bag";
type Mode = "archive" | "restore";
type BagMode = "reset_checks" | "clear_day";
type HistoryRow = { run_id: string; operation: Mode; created_at: string; mine: boolean; summary: { ok: number; skipped: number } | null };

// L02 RPCs are not in the hand-kept Database types; replies are zod-validated (same pattern as bulk-archive-sheet).
type BulkRpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
const bulkRpc = supabase as unknown as BulkRpc;

async function readHistory(): Promise<HistoryRow[] | null> {
  const { data, error } = await bulkRpc.rpc("bulk_archive_history", {});
  return !error && Array.isArray(data) ? (data as HistoryRow[]).slice(0, 5) : null;
}

/** Server-side query keys of the lists this sheet can change; refetched after every apply/undo. */
const AFFECTED = ["events", "child_events", "event_exceptions", "learning_plan", "learning_plan_item", "school_bag", "prova_drafts", "plan_for_day", "plan_for_days"];

/**
 * Selection from the server's own preview of a scope (child + date range), not from a loaded page:
 * every listed row is a real candidate, "select" never claims more than what is listed, a truncated
 * preview says so, and applying is limited to 200 records. Archive, undo and history use the existing
 * bulk_archive_preview / bulk_archive_apply / bulk_restore_apply / bulk_archive_history contract.
 */
export function BulkScopeActions({ type, scope, scopeLabel, disabled }: {
  type: BulkScopeType;
  scope: Omit<BulkArchiveScope, "types" | "archived" | "bag_mode">;
  scopeLabel: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode | null>(null);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <SatinButton secondary title={t("c03.bulk.openArchive")} disabled={disabled} onPress={() => setMode("archive")} />
      {type !== "school_bag" ? <SatinButton secondary title={t("c03.bulk.openRestore")} disabled={disabled} onPress={() => setMode("restore")} /> : null}
      {mode ? <BulkScopeSheet type={type} mode={mode} scope={scope} scopeLabel={scopeLabel} onClose={() => setMode(null)} /> : null}
    </View>
  );
}

function BulkScopeSheet({ type, mode, scope, scopeLabel, onClose }: {
  type: BulkScopeType;
  mode: Mode;
  scope: Omit<BulkArchiveScope, "types" | "archived" | "bag_mode">;
  scopeLabel: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const cache = useQueryClient();
  const [bagMode, setBagMode] = useState<BagMode>("reset_checks");
  const [result, setResult] = useState<BulkArchiveResult | null>(null);
  const [undo, setUndo] = useState<BulkArchiveResult | null>(null);
  const [error, setError] = useState<"apply" | "undo" | null>(null);
  const [working, setWorking] = useState(false);
  const lock = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const signature = JSON.stringify({ scope, type, mode, bagMode });
  // The preview is read once per scope (no background refetch: the parent picks from a stable list).
  const previewQuery = useQuery({
    queryKey: ["bulk_scope_preview", signature],
    gcTime: 0, staleTime: Infinity, retry: false, refetchOnWindowFocus: false,
    queryFn: async () => {
      const request = bulkArchiveScopeSchema.parse({
        ...scope, types: [type], ...(mode === "restore" ? { archived: true } : {}), ...(type === "school_bag" ? { bag_mode: bagMode } : {}),
        ...(type === "event" ? { event_scope: "series" } : {}),
      });
      const { data, error: failure } = await bulkRpc.rpc("bulk_archive_preview", { p_scope: request });
      if (failure) throw failure;
      return bulkArchivePreviewSchema.parse(data);
    },
  });
  const historyQuery = useQuery({ queryKey: ["bulk_archive_history"], gcTime: 0, staleTime: 0, retry: false, queryFn: readHistory });
  const preview: BulkArchivePreview | null = previewQuery.data ?? null;
  const history = historyQuery.data ?? null;
  const busy = working || previewQuery.isFetching;
  // Picks belong to one scope: changing the bag mode drops them.
  const [pickState, setPickState] = useState<{ signature: string; ids: ReadonlySet<string> }>({ signature, ids: new Set() });
  const picked = pickState.signature === signature ? pickState.ids : new Set<string>();
  const setPicked = (next: ReadonlySet<string> | ((prev: ReadonlySet<string>) => ReadonlySet<string>)) =>
    setPickState((prev) => ({ signature, ids: typeof next === "function" ? next(prev.signature === signature ? prev.ids : new Set()) : next }));
  const loadHistory = () => historyQuery.refetch();
  const setBusy = setWorking;

  const refresh = () => cache.invalidateQueries({ predicate: (q) => AFFECTED.includes(String(q.queryKey[0])) });

  const send = async (fn: "bulk_archive_apply" | "bulk_restore_apply", items: BulkArchiveItem[], op: Mode) => {
    const sig = JSON.stringify([fn, items]);
    // Same items → same key: a retry after a lost reply returns the stored run, never a second one.
    if (attempt.current?.signature !== sig) attempt.current = { signature: sig, key: randomUUID() };
    const key = attempt.current.key;
    const { data, error: failure } = await bulkRpc.rpc(fn, { p_items: items, p_idempotency_key: key });
    if (failure) throw failure;
    const reply = readBulkResult(data, key, op);
    attempt.current = null;
    return reply;
  };

  const apply = async () => {
    if (lock.current || !preview || result) return;
    const items = mode === "archive" ? bulkItemsFromPreview(preview, picked) : bulkRestoreItemsFromPreview(preview, picked);
    if (!items.length || items.length > BULK_APPLY_LIMIT) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      setResult(await send(mode === "archive" ? "bulk_archive_apply" : "bulk_restore_apply", items, mode));
    } catch { setError("apply"); }
    finally { lock.current = false; setBusy(false); }
    void refresh(); void loadHistory();
  };

  // Undo uses the archive view's current revisions (records changed by the archive itself), bags their snapshot.
  const undoRun = async () => {
    if (lock.current || !result || undo) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const done = result.items.filter((item) => item.status === "ok");
      let items: BulkArchiveItem[];
      if (type === "school_bag") {
        items = done.flatMap((item) => item.key.child_id && item.key.day ? [{ type: "school_bag" as const, child_id: item.key.child_id, day: item.key.day }] : []);
      } else {
        const { data, error: failure } = await bulkRpc.rpc("bulk_archive_preview", {
          p_scope: bulkArchiveScopeSchema.parse({ types: [type], ...(scope.child_id ? { child_id: scope.child_id } : {}), archived: true }),
        });
        if (failure) throw failure;
        const archived = bulkArchivePreviewSchema.parse(data);
        const keys = new Set(done.map((item) => bulkPreviewRowKey({ type: item.type as BulkArchivePreviewItem["type"], key: item.key })));
        items = bulkRestoreItemsFromPreview(archived, keys);
      }
      if (!items.length) throw new Error("nothing_to_undo");
      setUndo(await send("bulk_restore_apply", items, "restore"));
    } catch { setError("undo"); }
    finally { lock.current = false; setBusy(false); }
    void refresh(); void loadHistory();
  };

  const state = bulkSelectionState({ preview, mode, selected: picked.size });
  const selectable = bulkSelectableRows(preview, mode);
  const summary = result ? summarizeBulkResult(result) : null;
  const outcome = new Map((result?.items ?? []).map((item) => [bulkPreviewRowKey({ type: item.type as BulkArchivePreviewItem["type"], key: item.key }), item]));
  const note = type === "event" ? "c03.bulk.seriesNote" : type === "prova_draft" ? "c03.bulk.provaNote" : type === "learning_plan" ? "c03.bulk.planNote" : "c03.bulk.bagNote";
  const date = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <DecisionSheet
      visible
      title={`${t(mode === "archive" ? "c03.bulk.openArchive" : "c03.bulk.openRestore")} · ${t(`c03.bulk.type.${type}`)}`}
      onClose={() => { if (!busy) onClose(); }}
      footer={
        <View style={{ gap: 8 }}>
          {summary
            ? <>
              {mode === "archive" && summary.ok > 0 && !undo ? <SatinButton secondary title={t("c03.bulk.undo")} busy={busy} onPress={() => void undoRun()} /> : null}
              <SatinButton title={t("common.ok")} disabled={busy} onPress={onClose} />
            </>
            : previewQuery.isError
              ? <SatinButton title={t("common.retry")} busy={busy} onPress={() => void previewQuery.refetch()} />
              : <SatinButton
                title={t(mode === "archive" ? (type === "school_bag" ? `c03.bulk.${bagMode === "clear_day" ? "bagModeClear" : "bagModeReset"}` : "bulkArchive.apply") : "bulkArchive.restore")}
                busy={busy} disabled={busy || picked.size === 0 || state.overApplyLimit} onPress={() => void apply()} />}
          {!summary ? <SatinButton secondary title={t("common.cancel")} disabled={busy} onPress={onClose} /> : null}
        </View>
      }
    >
      <View testID={`bulk-scope-${type}`} style={{ gap: 10 }}>
        <Text style={u.bold}>{scopeLabel}</Text>
        <Text style={u.copy}>{t(mode === "archive" ? note : `bulkArchive.ui.restoreEffect.${type}`)}</Text>
        {mode === "archive" ? <Text style={u.small}>{t("c03.bulk.notPermanent")}</Text> : null}
        <Text style={u.small}>{t("c03.bulk.limits")}</Text>
        {type === "school_bag" && mode === "archive" && !summary ? (
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["reset_checks", "clear_day"] as const).map((value) => (
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: bagMode === value, disabled: busy }} aria-checked={bagMode === value}
                disabled={busy} onPress={() => { setBagMode(value); }}
                style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: bagMode === value ? p.purple : p.line, backgroundColor: bagMode === value ? p.lilac : "#FFFFFF" }}>
                <Text style={u.bold}>{t(value === "clear_day" ? "c03.bulk.bagModeClear" : "c03.bulk.bagModeReset")}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {state.truncated ? <Text testID="bulk-scope-truncated" accessibilityRole="alert" style={[u.small, { color: "#985212" }]}>{t("c03.bulk.truncated")}</Text> : null}
        {busy && !preview && !result ? <Text style={u.small} accessibilityLiveRegion="polite">{t("bulkArchive.ui.loading")}</Text> : null}
        {preview && !selectable.length && !summary ? <Text style={u.copy}>{t("c03.bulk.empty")}</Text> : null}
        {summary ? (
          <View style={{ gap: 4 }} accessibilityLiveRegion="polite" testID="bulk-scope-result">
            <Text style={u.bold}>{t(mode === "archive" ? "bulkArchive.ui.done" : "bulkArchive.ui.restored", { count: summary.ok })}</Text>
            {summary.skipped > 0 ? <Text style={u.copy}>{t("bulkArchive.ui.skipped", { count: summary.skipped })}</Text> : null}
            {undo ? <Text testID="bulk-scope-undone" style={u.bold}>{t("c03.bulk.undone", { count: undo.summary.ok })}</Text> : null}
          </View>
        ) : preview && selectable.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Text style={u.bold} accessibilityLiveRegion="polite">{t("c03.bulk.picked", { count: picked.size })}</Text>
            <SatinButton secondary title={t("c03.bulk.pickListed", { count: Math.min(selectable.length, BULK_APPLY_LIMIT) })} disabled={busy || state.allListedPicked}
              onPress={() => setPicked(new Set(selectable.slice(0, BULK_APPLY_LIMIT).map(bulkPreviewRowKey)))} />
            {picked.size > 0 ? <SatinButton secondary title={t("c03.bulk.clearPicks")} disabled={busy} onPress={() => setPicked(new Set())} /> : null}
          </View>
        ) : null}
        {state.overApplyLimit ? <Text accessibilityRole="alert" style={[u.small, { color: "#985212" }]}>{t("c03.bulk.overLimit")}</Text> : null}
        {error || previewQuery.isError ? <Text accessibilityRole="alert" style={[u.small, { color: "#985212" }]}>{t(error === "undo" ? "c03.bulk.undoFailed" : error === "apply" ? "bulkArchive.ui.applyError" : "bulkArchive.ui.previewError")}</Text> : null}
        <View style={{ gap: 6 }}>
          {(preview?.items ?? []).map((row) => {
            const key = bulkPreviewRowKey(row);
            const can = selectable.includes(row);
            const done = outcome.get(key);
            const status = done ? (done.status === "ok" ? t(mode === "archive" ? "bulkArchive.ui.rowArchived" : "bulkArchive.ui.rowRestored.record") : t(bulkReasonKey(done.reason)))
              : !can ? t(bulkReasonKey(row.blocked ?? (mode === "restore" ? "not_archived" : "already_archived"))) : null;
            const on = picked.has(key) && can && (!done || done.status === "ok");
            const title = row.title || (row.type === "school_bag" ? row.day ?? "" : t(`bulkArchive.type.${row.type}`));
            return (
              <Pressable key={key} testID={`bulk-row-${row.id ?? row.day}`} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !can || busy || !!result }} aria-checked={on}
                accessibilityLabel={status ? `${title}: ${status}` : title} disabled={!can || busy || !!result}
                onPress={() => setPicked((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; })}
                style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: on ? p.lilac : "#FFFFFF", borderWidth: 1, borderColor: p.line }}>
                <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: can ? p.purple : p.line, backgroundColor: on ? p.purple : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {on ? <Check size={14} color="#FFFFFF" /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={u.bold} numberOfLines={2}>{title}</Text>
                  {row.series ? <Text style={u.small}>{t("c03.bulk.seriesNote")}</Text> : null}
                  {status ? <Text style={[u.small, { color: done?.status === "ok" ? "#246455" : "#985212" }]}>{status}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ gap: 4, paddingTop: 6 }} testID="bulk-scope-history">
          <Text style={u.bold}>{t("c03.bulk.history")}</Text>
          {history && !history.length ? <Text style={u.small}>{t("c03.bulk.historyEmpty")}</Text> : null}
          {(history ?? []).map((run) => (
            <Text key={run.run_id} style={u.small}>{t("c03.bulk.historyRow", {
              date: date.format(new Date(run.created_at)), op: t(`c03.bulk.op.${run.operation}`), ok: run.summary?.ok ?? 0, skipped: run.summary?.skipped ?? 0,
              who: t(run.mine ? "c03.bulk.historyMine" : "c03.bulk.historyOther"),
            })}</Text>
          ))}
        </View>
      </View>
    </DecisionSheet>
  );
}

/** Calendar (parent): one place for the week's calendar entries, homework/study and bag days of one child. */
export function PlannerBulkActions({ child, from, to, today }: { child: { id: string; name: string }; from: string; to: string; today: string }) {
  const { t, i18n } = useTranslation();
  const day = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", timeZone: "UTC" });
  const label = (a: string, b: string) => `${child.name} · ${t("c03.bulk.scopeRange", { from: day.format(new Date(a + "T12:00:00Z")), to: day.format(new Date(b + "T12:00:00Z")) })}`;
  const bagFrom = from < today ? today : from;
  const rows: { type: BulkScopeType; scope: Omit<BulkArchiveScope, "types" | "archived" | "bag_mode">; scopeLabel: string; disabled?: boolean }[] = [
    { type: "event", scope: { child_id: child.id, from, to }, scopeLabel: label(from, to) },
    { type: "learning_plan", scope: { child_id: child.id, from, to }, scopeLabel: label(from, to) },
    { type: "school_bag", scope: { child_id: child.id, from: bagFrom <= to ? bagFrom : to, to }, scopeLabel: label(bagFrom <= to ? bagFrom : to, to), disabled: bagFrom > to },
  ];
  return (
    <View testID="planner-bulk-actions" style={{ gap: 10, paddingTop: 8 }}>
      <Text accessibilityRole="header" style={u.bold}>{t("c03.bulk.openPanel")}</Text>
      {rows.map((row) => (
        <View key={row.type} style={{ gap: 6 }}>
          <Text style={u.small}>{t(`c03.bulk.type.${row.type}`)}</Text>
          <BulkScopeActions {...row} />
        </View>
      ))}
    </View>
  );
}

/** Prova hub (parent): selection entry for drafts only; assigned/answered Provas stay protected by the server. */
export function ProvaDraftBulkEntry({ childId, childName }: { childId: string | null | undefined; childName?: string | null }) {
  const { t } = useTranslation();
  return (
    <View testID="prova-draft-bulk" style={{ gap: 6 }}>
      <Text style={u.small}>{t("c03.bulk.type.prova_draft")} · {t("c03.bulk.provaNote")}</Text>
      <BulkScopeActions type="prova_draft" scope={childId ? { child_id: childId } : {}} scopeLabel={childName ? `${childName} · ${t("c03.bulk.scopeAll")}` : t("c03.bulk.scopeAll")} />
    </View>
  );
}
