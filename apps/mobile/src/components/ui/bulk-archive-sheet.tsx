import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import {
  type BulkArchivePreview,
  type BulkArchivePreviewItem,
  type BulkArchiveResult,
  bulkPreviewRowKey,
  bulkReasonKey,
  summarizeBulkResult,
} from "@gina/core";
import { p, u } from "@/components/planner/ui";
import { Button } from "./button";
import { DecisionSheet } from "./decision-sheet";
import { Pressable } from "./pressable";

// Draft for L02. Presentational only: the caller owns the preview call, the
// idempotency key, the apply/restore RPC and list refresh. Not imported yet;
// the task/reward/note/Prova screens are wired separately.
export function BulkArchiveSheet({ visible, mode, preview, selected, result, busy, onToggle, onSubmit, onClose }: {
  visible: boolean;
  mode: "archive" | "restore";
  preview: BulkArchivePreview | null;
  selected: ReadonlySet<string>;
  result: BulkArchiveResult | null;
  busy?: boolean;
  onToggle: (rowKey: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rows = preview?.items ?? [];
  const selectable = rows.filter((row) => (mode === "archive" ? !row.blocked && !row.archived : row.archived && row.type !== "school_bag"));
  const chosen = selectable.filter((row) => selected.has(bulkPreviewRowKey(row))).length;
  const summary = result ? summarizeBulkResult(result) : null;
  return (
    <DecisionSheet
      visible={visible}
      title={t("bulkArchive.title")}
      onClose={onClose}
      footer={
        <View style={{ gap: 8 }}>
          {summary
            ? <Button title={t("common.ok")} onPress={onClose} />
            : <Button title={t(mode === "archive" ? "bulkArchive.apply" : "bulkArchive.restore")} loading={busy} disabled={busy || chosen === 0} onPress={onSubmit} />}
          {!summary ? <Button title={t("common.cancel")} variant="ghost" disabled={busy} onPress={onClose} /> : null}
        </View>
      }
    >
      {summary
        ? (
          <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
            <Text style={u.bold}>{t(mode === "archive" ? "bulkArchive.summary.ok" : "bulkArchive.summary.restored", { count: summary.ok })}</Text>
            {summary.skipped > 0 ? <Text style={u.copy}>{t("bulkArchive.summary.skipped", { count: summary.skipped })}</Text> : null}
            {summary.partial ? <Text style={u.small}>{t("bulkArchive.summary.partial")}</Text> : null}
            {summary.reasons.map((reason) => <Text key={reason.reason} style={u.small}>{`${reason.count} × ${t(reason.key)}`}</Text>)}
          </View>
        )
        : (
          <View style={{ gap: 12 }}>
            <Text style={u.copy}>{t(mode === "archive" ? "bulkArchive.effect.archive" : "bulkArchive.effect.restore")}</Text>
            {preview
              ? (
                <Text style={u.bold} accessibilityLiveRegion="polite">
                  {t("bulkArchive.summary.archivable", { count: chosen })}
                  {preview.summary.blocked > 0 ? ` · ${t("bulkArchive.summary.blocked", { count: preview.summary.blocked })}` : ""}
                </Text>
              )
              : null}
            {preview?.truncated ? <Text style={u.small}>{t("bulkArchive.summary.truncated")}</Text> : null}
            <View style={{ gap: 6 }}>
              {rows.map((row) => <BulkRow key={bulkPreviewRowKey(row)} row={row} mode={mode} checked={selected.has(bulkPreviewRowKey(row))} onToggle={onToggle} />)}
            </View>
          </View>
        )}
    </DecisionSheet>
  );
}

function BulkRow({ row, mode, checked, onToggle }: { row: BulkArchivePreviewItem; mode: "archive" | "restore"; checked: boolean; onToggle: (rowKey: string) => void }) {
  const { t } = useTranslation();
  const disabled = mode === "archive" ? Boolean(row.blocked) || row.archived : !row.archived || row.type === "school_bag";
  const detail = row.type === "event" && row.scope ? t(`bulkArchive.eventScope.${row.scope === "occurrence" ? "occurrence" : "series"}`) : row.type === "school_bag" && row.mode ? t(`bulkArchive.bagMode.${row.mode}`) : null;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={`${t(`bulkArchive.type.${row.type}`)}: ${row.title ?? ""}`}
      disabled={disabled}
      onPress={() => onToggle(bulkPreviewRowKey(row))}
      style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: checked ? p.lilac : p.cream, borderWidth: 1, borderColor: p.line, opacity: disabled ? 0.6 : 1 }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: p.purple, backgroundColor: checked ? p.purple : "transparent" }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={u.bold} numberOfLines={2}>{row.title ?? t(`bulkArchive.type.${row.type}`)}</Text>
        <Text style={u.small}>{[t(`bulkArchive.type.${row.type}`), detail].filter(Boolean).join(" · ")}</Text>
        {row.blocked ? <Text style={[u.small, { color: p.muted }]}>{t(bulkReasonKey(row.blocked))}</Text> : null}
      </View>
    </Pressable>
  );
}
