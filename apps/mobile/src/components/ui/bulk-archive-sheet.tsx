import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Check } from "lucide-react-native";
import {
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
  readBulkResult,
  summarizeBulkResult,
} from "@gina/core";
import { p, u } from "@/components/planner/ui";
import { supabase } from "@/lib/supabase";
import { Button } from "./button";
import { DecisionSheet } from "./decision-sheet";
import { Pressable } from "./pressable";

/** List types whose screens offer bulk selection in this round. */
export type BulkListType = "task_routine" | "reward" | "note";
type Mode = "archive" | "restore";
type Candidate = { id: string; title: string };

// The L02 RPCs are not in the hand-kept `Database` types yet (packages/core is
// outside this change); the cast stays local and replies are zod-validated.
type BulkRpc = { rpc: (fn: "bulk_archive_preview" | "bulk_archive_apply" | "bulk_restore_apply", args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
const bulkRpc = supabase as unknown as BulkRpc;

const rowSelectable = (row: BulkArchivePreviewItem, mode: Mode) =>
  mode === "archive" ? !row.blocked && !row.archived : row.archived && row.type !== "school_bag";

/**
 * Selection → preview → confirm → per-record result for one list screen.
 * The server decides every record; this only keeps the selection, a stable
 * idempotency key per item set (a lost reply is retried with the same key and
 * the stored result comes back) and a tap lock against double submission.
 */
export function useBulkArchive({ type, mode, scope, candidates, onFinished }: {
  type: BulkListType;
  mode: Mode;
  /** The list's current filter (child/status); kept as-is for the preview. */
  scope: Omit<BulkArchiveScope, "types" | "archived">;
  /** Rows currently visible and selectable in the list. */
  candidates: readonly Candidate[];
  onFinished: (result: BulkArchiveResult) => Promise<unknown> | void;
}) {
  const scopeKey = JSON.stringify([type, mode, scope]);
  const [selection, setSelection] = useState<{ scopeKey: string; on: boolean; ids: ReadonlySet<string> }>({ scopeKey, on: false, ids: new Set() });
  // A filter change keeps selection mode but drops picks the list no longer shows.
  const current = selection.scopeKey === scopeKey ? selection : { scopeKey, on: selection.on, ids: new Set<string>() };
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<BulkArchivePreview | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [result, setResult] = useState<BulkArchiveResult | null>(null);
  const [error, setError] = useState<"preview" | "apply" | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const update = (on: boolean, ids: ReadonlySet<string>) => setSelection({ scopeKey, on, ids });
  const titles = new Map(candidates.map((c) => [c.id, c.title]));

  async function showEffect() {
    if (lock.current || current.ids.size === 0) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    setPreview(null);
    setOpen(true);
    try {
      const request = bulkArchiveScopeSchema.parse({ ...scope, types: [type], ...(mode === "restore" ? { archived: true } : {}) });
      const { data, error: failure } = await bulkRpc.rpc("bulk_archive_preview", { p_scope: request });
      if (failure) throw failure;
      const full = bulkArchivePreviewSchema.parse(data);
      const byId = new Map(full.items.filter((row) => row.id).map((row) => [row.id!, row]));
      // A picked row the server no longer lists (changed or archived meanwhile) is shown, never sent.
      const items = [...current.ids].map((id): BulkArchivePreviewItem => byId.get(id) ?? {
        type, id, key: { id }, title: titles.get(id) ?? null, child_id: null, revision: 0, archived: false, blocked: "changed",
      });
      const blocked = items.filter((row) => !rowSelectable(row, mode)).length;
      const reasons: Record<string, number> = {};
      for (const row of items) if (row.blocked && !rowSelectable(row, mode)) reasons[row.blocked] = (reasons[row.blocked] ?? 0) + 1;
      setPreview({ ...full, items, summary: { ...full.summary, total: items.length, archivable: items.length - blocked, blocked, blocked_reasons: reasons } });
      setChosen(new Set(items.filter((row) => rowSelectable(row, mode)).map(bulkPreviewRowKey)));
    } catch {
      setError("preview");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function apply() {
    if (lock.current || !preview || result) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const items = mode === "archive" ? bulkItemsFromPreview(preview, chosen) : bulkRestoreItemsFromPreview(preview, chosen);
      const signature = JSON.stringify(items);
      // Same items → same key, so a retry after a lost reply cannot apply twice.
      if (attempt.current?.signature !== signature) attempt.current = { signature, key: randomUUID() };
      const key = attempt.current.key;
      const { data, error: failure } = await bulkRpc.rpc(mode === "archive" ? "bulk_archive_apply" : "bulk_restore_apply", { p_items: items, p_idempotency_key: key });
      if (failure) throw failure;
      const reply = readBulkResult(data, key, mode);
      attempt.current = null;
      setResult(reply);
      await onFinished(reply);
    } catch {
      setError("apply");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setOpen(false);
    if (result) {
      update(false, new Set());
      setResult(null);
      setPreview(null);
    }
  }

  return {
    selecting: current.on,
    count: current.ids.size,
    isPicked: (id: string) => current.ids.has(id),
    start: () => update(true, new Set()),
    cancel: () => update(false, new Set()),
    toggle: (id: string) => {
      const next = new Set(current.ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      update(true, next);
    },
    pickAll: () => update(true, new Set(candidates.map((c) => c.id))),
    showEffect: () => void showEffect(),
    sheet: {
      visible: open,
      type,
      mode,
      preview,
      selected: chosen,
      result,
      busy,
      error,
      onToggle: (key: string) => setChosen((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
      onSubmit: () => void apply(),
      onRetryPreview: () => void showEffect(),
      onClose: close,
    },
  };
}

export type BulkArchiveController = ReturnType<typeof useBulkArchive>;

/** Entry ("Seç") or, while selecting, the count with select-all / cancel / show effect. */
export function BulkSelectBar({ bulk, total }: { bulk: BulkArchiveController; total: number }) {
  const { t } = useTranslation();
  const restore = bulk.sheet.mode === "restore";
  if (!bulk.selecting) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(restore ? "bulkArchive.ui.selectRestore" : "bulkArchive.ui.selectArchive")}
        disabled={total === 0}
        onPress={bulk.start}
        style={{ minHeight: 48, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: p.line, backgroundColor: "#FFFFFF", opacity: total === 0 ? 0.5 : 1 }}
      >
        <View style={{ width: 18, height: 18, borderRadius: 6, borderWidth: 2, borderColor: p.purple }} />
        <Text style={[u.bold, { color: p.purple }]}>{t("bulkArchive.ui.select")}</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 22, backgroundColor: p.lilac }}>
      <Text style={u.bold} accessibilityLiveRegion="polite">{t("bulkArchive.ui.selected", { count: bulk.count })}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <View style={{ flexGrow: 1, minWidth: 180 }}>
          <Button title={t("bulkArchive.preview")} disabled={bulk.count === 0} onPress={bulk.showEffect} />
        </View>
        <Button title={t("bulkArchive.ui.selectAll")} variant="secondary" disabled={total === 0 || bulk.count === total} onPress={bulk.pickAll} />
        <Button title={t("common.cancel")} variant="ghost" onPress={bulk.cancel} />
      </View>
    </View>
  );
}

/** Checkbox that replaces a row's edit control while selecting. */
export function BulkCheck({ label, checked, disabled, hint, onToggle }: { label: string; checked: boolean; disabled?: boolean; hint?: string; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked, disabled: !!disabled }}
      aria-checked={checked}
      disabled={disabled}
      onPress={onToggle}
      style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : 1 }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 9, borderWidth: 2, borderColor: p.purple, backgroundColor: checked ? p.purple : "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
        {checked ? <Check size={18} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
}

export function BulkArchiveSheet({ visible, type, mode, preview, selected, result, busy, error, onToggle, onSubmit, onRetryPreview, onClose }: BulkArchiveController["sheet"]) {
  const { t } = useTranslation();
  const rows = preview?.items ?? [];
  const chosen = rows.filter((row) => rowSelectable(row, mode) && selected.has(bulkPreviewRowKey(row))).length;
  const summary = result ? summarizeBulkResult(result) : null;
  const outcome = new Map((result?.items ?? []).map((item) => [bulkPreviewRowKey({ type: item.type as BulkArchivePreviewItem["type"], key: item.key }), item]));
  const restoreNote = t(`bulkArchive.ui.restoreEffect.${type}`);
  return (
    <DecisionSheet
      visible={visible}
      title={t(mode === "archive" ? "bulkArchive.title" : "bulkArchive.ui.restoreTitle")}
      onClose={onClose}
      footer={
        <View style={{ gap: 8 }}>
          {summary
            ? <Button title={t("common.ok")} onPress={onClose} />
            : error === "preview"
              ? <Button title={t("common.retry")} loading={busy} onPress={onRetryPreview} />
              : <Button title={t(mode === "archive" ? "bulkArchive.apply" : "bulkArchive.restore")} loading={busy} disabled={busy || chosen === 0} onPress={onSubmit} />}
          {!summary ? <Button title={t("common.cancel")} variant="ghost" disabled={busy} onPress={onClose} /> : null}
        </View>
      }
    >
      {summary
        ? (
          <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
            <Text style={u.bold}>{t(mode === "archive" ? "bulkArchive.ui.done" : "bulkArchive.ui.restored", { count: summary.ok })}</Text>
            {summary.skipped > 0 ? <Text style={u.copy}>{t("bulkArchive.ui.skipped", { count: summary.skipped })}</Text> : null}
            {summary.partial ? <Text style={u.small}>{t("bulkArchive.summary.partial")}</Text> : null}
            {mode === "restore" && summary.ok > 0 ? <Text style={u.copy}>{restoreNote}</Text> : null}
          </View>
        )
        : (
          <View style={{ gap: 12 }}>
            {/* Restore says what this list's records come back as (private / paused), not the generic all-types line. */}
            <Text style={mode === "archive" ? u.copy : u.bold}>{mode === "archive" ? t("bulkArchive.effect.archive") : restoreNote}</Text>
            {preview
              ? (
                <Text style={u.bold} accessibilityLiveRegion="polite">
                  {t(mode === "archive" ? "bulkArchive.ui.willArchive" : "bulkArchive.ui.willRestore", { count: chosen })}
                  {preview.summary.blocked > 0 ? ` · ${t(mode === "archive" ? "bulkArchive.ui.blocked" : "bulkArchive.ui.notRestorable", { count: preview.summary.blocked })}` : ""}
                </Text>
              )
              : busy ? <Text style={u.small} accessibilityLiveRegion="polite">{t("bulkArchive.ui.loading")}</Text> : null}
            {preview?.truncated ? <Text style={u.small}>{t("bulkArchive.summary.truncated")}</Text> : null}
          </View>
        )}
      {error ? <Text accessibilityRole="alert" style={u.error}>{t(error === "preview" ? "bulkArchive.ui.previewError" : "bulkArchive.ui.applyError")}</Text> : null}
      <View style={{ gap: 6 }}>
        {rows.map((row) => {
          const key = bulkPreviewRowKey(row);
          return <BulkRow key={key} row={row} mode={mode} checked={selected.has(key)} locked={!!result || busy} outcome={result ? outcome.get(key) ?? null : undefined} onToggle={onToggle} />;
        })}
      </View>
    </DecisionSheet>
  );
}

function BulkRow({ row, mode, checked, locked, outcome, onToggle }: {
  row: BulkArchivePreviewItem;
  mode: Mode;
  checked: boolean;
  locked: boolean;
  /** undefined before apply; null when the row was not sent. */
  outcome?: BulkArchiveResult["items"][number] | null;
  onToggle: (rowKey: string) => void;
}) {
  const { t } = useTranslation();
  const selectable = rowSelectable(row, mode);
  const disabled = !selectable || locked;
  const title = row.title || t(`bulkArchive.type.${row.type}`);
  const reason = !selectable ? (row.blocked ?? (mode === "restore" ? "not_archived" : "already_archived")) : null;
  const status = outcome
    ? outcome.status === "ok"
      ? t(mode === "archive" ? "bulkArchive.ui.rowArchived" : `bulkArchive.ui.rowRestored.${row.type === "note" ? "note" : "paused"}`)
      : t(bulkReasonKey(outcome.reason))
    : outcome === null
      ? reason ? t(bulkReasonKey(reason)) : t("bulkArchive.ui.rowNotSent")
      : reason ? t(bulkReasonKey(reason)) : null;
  const tone = outcome?.status === "ok" ? "#246455" : outcome || reason ? "#985212" : p.muted;
  // After apply only records that actually changed stay ticked.
  const on = checked && selectable && (outcome === undefined || outcome?.status === "ok");
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled }}
      aria-checked={on}
      accessibilityLabel={status ? `${title}: ${status}` : title}
      disabled={disabled}
      onPress={() => onToggle(bulkPreviewRowKey(row))}
      style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: on ? p.lilac : "#FFFFFF", borderWidth: 1, borderColor: p.line }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: selectable ? p.purple : p.line, backgroundColor: on ? p.purple : "transparent", alignItems: "center", justifyContent: "center" }}>
        {on ? <Check size={14} color="#FFFFFF" /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={u.bold} numberOfLines={2}>{title}</Text>
        {status ? <Text style={[u.small, { color: tone }]}>{status}</Text> : null}
      </View>
    </Pressable>
  );
}
