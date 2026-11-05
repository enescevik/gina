import { z } from "zod";
import { isCalendarDate } from "./form-validation";

// Client contract for bulk_archive_preview / bulk_archive_apply / bulk_restore_apply.
// The server decides; this layer only shapes requests, validates replies and
// turns per-record reasons into i18n keys. No screen is wired to it yet.
export const BULK_ARCHIVE_TYPES = [
  "task_routine",
  "reward",
  "note",
  "prova_draft",
  "learning_plan",
  "event",
  "school_bag",
] as const;
export type BulkArchiveType = (typeof BULK_ARCHIVE_TYPES)[number];
export const BULK_ARCHIVE_REASONS = [
  "not_found",
  "already_archived",
  "not_archived",
  "changed",
  "child_archived",
  "reward_has_goals",
  "reward_pending_request",
  "task_pending_review",
  "note_not_author",
  "prova_draft_assigned",
  "prova_has_answers",
  "event_is_timetable",
  "event_not_recurring",
  "bag_day_past",
  "nothing_to_change",
  "plan_limit",
  "type_invalid",
  "item_invalid",
  "failed",
] as const;
export type BulkArchiveReason = (typeof BULK_ARCHIVE_REASONS)[number];
const id = z.uuid();
const day = z.string().refine(isCalendarDate);
const type = z.enum(BULK_ARCHIVE_TYPES);
const revision = z.number().int().nonnegative();
export const bulkArchiveScopeSchema = z
  .object({
    types: z.array(type).min(1),
    child_id: id.optional(),
    period_id: id.optional(),
    from: day.optional(),
    to: day.optional(),
    status: z.enum(["all", "active", "paused"]).optional(),
    event_scope: z.enum(["series", "occurrence"]).optional(),
    bag_mode: z.enum(["reset_checks", "clear_day"]).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((s) => !(s.from && s.to) || s.from <= s.to, "range")
  .refine(
    (s) => s.event_scope !== "occurrence" || (!!s.from && s.from === s.to),
    "occurrence_needs_one_day",
  )
  .refine(
    (s) =>
      !s.types.includes("school_bag") || (!!s.child_id && !!s.from && !!s.to),
    "bag_needs_child_and_days",
  );
export type BulkArchiveScope = z.infer<typeof bulkArchiveScopeSchema>;
const recordItem = z
  .object({
    type: z.enum([
      "task_routine",
      "reward",
      "note",
      "prova_draft",
      "learning_plan",
    ]),
    id,
    revision,
  })
  .strict();
const eventItem = z
  .object({
    type: z.literal("event"),
    id,
    revision: revision.optional(),
    occurrence_date: day.optional(),
  })
  .strict();
const bagItem = z
  .object({
    type: z.literal("school_bag"),
    child_id: id,
    day,
    mode: z.enum(["reset_checks", "clear_day"]).optional(),
    revision: revision.optional(),
    program_revision: revision.optional(),
  })
  .strict();
export const bulkArchiveItemSchema = z.discriminatedUnion("type", [
  recordItem,
  eventItem,
  bagItem,
]);
export type BulkArchiveItem = z.infer<typeof bulkArchiveItemSchema>;
export const bulkArchiveItemsSchema = z.array(bulkArchiveItemSchema).min(1).max(200);
const itemKey = z.object({
  id: id.nullable().optional(),
  occurrence_date: z.string().optional(),
  child_id: id.optional(),
  day: z.string().optional(),
  mode: z.string().optional(),
});
export const bulkArchivePreviewItemSchema = z.object({
  type,
  id: id.nullable(),
  key: itemKey,
  title: z.string().nullable(),
  child_id: id.nullable(),
  revision: z.number().int(),
  archived: z.boolean(),
  blocked: z.string().nullable(),
  active: z.boolean().optional(),
  scope: z.enum(["single", "series", "occurrence"]).optional(),
  series: z.boolean().optional(),
  mode: z.enum(["reset_checks", "clear_day"]).optional(),
  program_revision: z.number().int().optional(),
  day: z.string().optional(),
  planned_on: z.string().optional(),
  pending_requests: z.number().int().optional(),
  active_goals: z.number().int().optional(),
  item_count: z.number().int().optional(),
  checked_count: z.number().int().optional(),
});
export type BulkArchivePreviewItem = z.infer<typeof bulkArchivePreviewItemSchema>;
export const bulkArchivePreviewSchema = z.object({
  family_id: id,
  today: z.string(),
  generated_at: z.string(),
  scope: z.record(z.string(), z.unknown()),
  truncated: z.boolean(),
  items: z.array(bulkArchivePreviewItemSchema),
  summary: z.object({
    total: z.number().int(),
    archivable: z.number().int(),
    blocked: z.number().int(),
    by_type: z.record(z.string(), z.number().int()),
    blocked_reasons: z.record(z.string(), z.number().int()),
  }),
});
export type BulkArchivePreview = z.infer<typeof bulkArchivePreviewSchema>;
export const bulkArchiveResultSchema = z.object({
  run_id: id,
  operation: z.enum(["archive", "restore"]),
  items: z.array(
    z.object({
      type: z.string(),
      key: itemKey,
      status: z.enum(["ok", "skipped"]),
      reason: z.string().nullable(),
      result: z.unknown().nullable(),
    }),
  ),
  summary: z.object({
    ok: z.number().int(),
    skipped: z.number().int(),
    reasons: z.record(z.string(), z.number().int()),
  }),
});
export type BulkArchiveResult = z.infer<typeof bulkArchiveResultSchema>;

/** Only archivable preview rows become apply items, carrying the revision the parent saw. */
export function bulkItemsFromPreview(
  preview: BulkArchivePreview,
  selected?: ReadonlySet<string>,
): BulkArchiveItem[] {
  const items: BulkArchiveItem[] = [];
  for (const row of preview.items) {
    if (row.blocked || row.archived) continue;
    if (selected && !selected.has(bulkPreviewRowKey(row))) continue;
    if (row.type === "school_bag") {
      if (!row.child_id || !row.day) continue;
      items.push({
        type: "school_bag",
        child_id: row.child_id,
        day: row.day,
        mode: row.mode ?? "reset_checks",
        revision: row.revision,
        program_revision: row.program_revision,
      });
    } else if (row.type === "event") {
      if (!row.id) continue;
      items.push({
        type: "event",
        id: row.id,
        revision: row.revision,
        ...(row.key.occurrence_date
          ? { occurrence_date: row.key.occurrence_date }
          : {}),
      });
    } else if (row.id) {
      items.push({ type: row.type, id: row.id, revision: row.revision });
    }
  }
  return bulkArchiveItemsSchema.parse(items);
}
/** Archived preview rows (scope.archived=true) become restore items. */
export function bulkRestoreItemsFromPreview(
  preview: BulkArchivePreview,
  selected?: ReadonlySet<string>,
): BulkArchiveItem[] {
  const items: BulkArchiveItem[] = [];
  for (const row of preview.items) {
    if (!row.archived || !row.id || row.type === "school_bag") continue;
    if (selected && !selected.has(bulkPreviewRowKey(row))) continue;
    items.push(
      row.type === "event"
        ? { type: "event", id: row.id, revision: row.revision }
        : { type: row.type, id: row.id, revision: row.revision },
    );
  }
  return bulkArchiveItemsSchema.parse(items);
}
/** Stable selection key for a preview row (list checkboxes, result matching). */
export function bulkPreviewRowKey(
  row: Pick<BulkArchivePreviewItem, "type" | "key">,
): string {
  const k = row.key;
  return [row.type, k.id ?? "", k.occurrence_date ?? "", k.child_id ?? "", k.day ?? "", k.mode ?? ""].join("|");
}
export function bulkReasonKey(reason: string | null | undefined): string {
  return `bulkArchive.reason.${
    (BULK_ARCHIVE_REASONS as readonly string[]).includes(reason ?? "")
      ? reason
      : "failed"
  }`;
}
/** Validates a server reply against the key the client sent; a foreign run id is rejected. */
export function readBulkResult(
  raw: unknown,
  idempotencyKey: string,
  operation: "archive" | "restore",
): BulkArchiveResult {
  const result = bulkArchiveResultSchema.parse(raw);
  if (result.run_id !== idempotencyKey || result.operation !== operation) {
    throw new Error("bulk_result_mismatch");
  }
  return result;
}
export function summarizeBulkResult(result: BulkArchiveResult) {
  const reasons = Object.entries(result.summary.reasons)
    .map(([reason, count]) => ({ reason, count, key: bulkReasonKey(reason) }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
  return {
    ok: result.summary.ok,
    skipped: result.summary.skipped,
    partial: result.summary.ok > 0 && result.summary.skipped > 0,
    reasons,
  };
}
