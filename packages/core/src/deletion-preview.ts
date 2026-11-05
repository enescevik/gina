import { z } from "zod";

/**
 * Permanent deletion impact preview (L03). The server RPC `deletion_preview(p_target)` returns the
 * shape below plus a short-lived `preview_token`; `confirm_child_deletion` / the delete-account Edge
 * function reject a token whose target changed, expired or was already used.
 */
export const deletionTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("child"), child_id: z.uuid() }),
  z.object({ kind: z.literal("account") }),
]);
export type DeletionTarget = z.infer<typeof deletionTargetSchema>;

const count = z.number().int().min(0);
const loose = z.record(z.string(), z.unknown());

export const deletionWarningSchema = z.enum([
  "active_device_sessions",
  "open_shares_revoked",
  "in_progress_attempts",
  "pending_task_reviews",
  "pending_reward_requests",
  "co_parent_private_notes_kept",
  "prova_drafts_keep_reference",
  "family_deleted",
  "ownership_transferred",
  "subscription_not_cancelled",
  "billing_in_progress",
]);
export type DeletionWarning = z.infer<typeof deletionWarningSchema>;

export const childDeletionCountsSchema = z.object({
  task_routines: count,
  task_completions: count,
  pending_task_reviews: count,
  stars: z.object({ events: count, balance: z.number().int() }),
  badges: count,
  rewards: z.object({ requests: count, pending: count, goals: count }),
  notes: z.object({ own: count, shared: count, child_authored: count }),
  prova: z.object({ exams: count, attempts: count, in_progress: count, answers: count, study_plans: count }),
  calendar: z.object({ events: count, timetables: count, education_periods: count }),
  grades: count,
  shares: z.object({ total: count, open: count }),
  devices: z.object({ allowed: count, active_sessions: count }),
  ai: z.object({ timetable_imports: count, answer_reviews: count, inbox: count }),
  files: z.object({ count: count, bytes: count, linked_family_files: count }),
});
export type ChildDeletionCounts = z.infer<typeof childDeletionCountsSchema>;

const subscriptionNotice = z.object({
  affected: z.boolean(),
  cancelled_by_deletion: z.literal(false),
  managed_in_store: z.literal(true),
  active: z.boolean().optional(),
});

const previewEnvelope = {
  preview_token: z.uuid(),
  expires_at: z.string(),
  generated_at: z.string(),
  ttl_seconds: count,
  warnings: z.array(z.string()),
  subscription: subscriptionNotice,
};

export const childDeletionPreviewSchema = z.object({
  kind: z.literal("child"),
  child: z.object({
    id: z.uuid(),
    name: z.string(),
    avatar: z.string().nullable(),
    grade: z.number().int().nullable(),
    family_id: z.uuid(),
    archived: z.boolean(),
    archive_revision: count,
  }),
  deletes: childDeletionCountsSchema,
  preserved: z.object({
    co_parent_private_notes: count,
    family_notes: count,
    family_files: z.object({ count: count, bytes: count }),
    family_questions: count,
    family_rewards: count,
    prova_drafts_referencing: count,
    other_children: count,
    usage_receipts: z.literal(true),
  }),
  alternatives: z.object({ archive_available: z.boolean(), already_archived: z.boolean() }),
  shares_active: count,
  ...previewEnvelope,
});
export type ChildDeletionPreview = z.infer<typeof childDeletionPreviewSchema>;

export const storeSubscriptionNoticeSchema = z.object({
  id: z.uuid(),
  family_id: z.uuid(),
  platform: z.enum(["apple", "google"]),
  plan: z.string(),
  status: z.string(),
  expires_at: z.string(),
  auto_renewing: z.boolean(),
  purchased_by_me: z.boolean(),
  cancelled_by_deletion: z.literal(false),
  managed_in_store: z.literal(true),
});

export const accountDeletionFamilySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  mode: z.enum(["transfer", "cascade"]),
  other_parents: count,
  children: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      archived: z.boolean(),
      counts: childDeletionCountsSchema.nullable(),
    }),
  ),
  deletes: loose,
  preserved: loose,
});

export const accountDeletionPreviewSchema = z.object({
  kind: z.literal("account"),
  families: z.array(accountDeletionFamilySchema),
  subscriptions: z.array(storeSubscriptionNoticeSchema),
  alternatives: z.object({ archive_available: z.literal(false), archivable_children: count }),
  ...previewEnvelope,
});
export type AccountDeletionPreview = z.infer<typeof accountDeletionPreviewSchema>;

export const deletionPreviewSchema = z.discriminatedUnion("kind", [childDeletionPreviewSchema, accountDeletionPreviewSchema]);
export type DeletionPreview = z.infer<typeof deletionPreviewSchema>;

/** Seconds the preview token can still be used for; 0 once it must be refreshed. */
export function previewSecondsLeft(preview: Pick<DeletionPreview, "expires_at">, now: Date = new Date()): number {
  const left = Math.floor((new Date(preview.expires_at).getTime() - now.getTime()) / 1000);
  return Number.isFinite(left) && left > 0 ? left : 0;
}

/** Keep a safety margin so a request sent at the last second does not fail server-side. */
export function isPreviewUsable(preview: Pick<DeletionPreview, "expires_at">, now: Date = new Date(), marginSeconds = 30): boolean {
  return previewSecondsLeft(preview, now) > marginSeconds;
}

/** Known warnings in display order (most consequential first); unknown codes are kept at the end. */
export function orderedDeletionWarnings(warnings: readonly string[]): string[] {
  const order = deletionWarningSchema.options as readonly string[];
  const known = order.filter((w) => warnings.includes(w));
  const unknown = warnings.filter((w) => !order.includes(w));
  return [...known, ...unknown];
}

export interface DeletionCountLine {
  key: string;
  count: number;
}

/**
 * Record groups to list under "what will be deleted", only those with records. Keys match
 * `deletionPreview.count.<key>` i18n entries. Clock-dependent or derived counters are skipped.
 */
export function childDeletionCountLines(counts: ChildDeletionCounts): DeletionCountLine[] {
  const lines: DeletionCountLine[] = [
    { key: "task_routines", count: counts.task_routines },
    { key: "task_completions", count: counts.task_completions },
    { key: "stars", count: counts.stars.events },
    { key: "badges", count: counts.badges },
    { key: "reward_requests", count: counts.rewards.requests },
    { key: "goals", count: counts.rewards.goals },
    { key: "notes", count: counts.notes.own + counts.notes.shared + counts.notes.child_authored },
    { key: "exams", count: counts.prova.exams },
    { key: "attempts", count: counts.prova.attempts },
    { key: "study_plans", count: counts.prova.study_plans },
    { key: "events", count: counts.calendar.events },
    { key: "timetables", count: counts.calendar.timetables },
    { key: "education_periods", count: counts.calendar.education_periods },
    { key: "grades", count: counts.grades },
    { key: "shares", count: counts.shares.total },
    { key: "devices", count: counts.devices.allowed },
    { key: "ai_records", count: counts.ai.timetable_imports + counts.ai.answer_reviews + counts.ai.inbox },
    { key: "files", count: counts.files.count },
  ];
  return lines.filter((line) => line.count > 0);
}

/** Sum child counters for a cascade family; `null` counters (transfer mode) contribute nothing. */
export function sumChildDeletionCounts(children: readonly { counts: ChildDeletionCounts | null }[]): ChildDeletionCounts | null {
  const present = children.map((c) => c.counts).filter((c): c is ChildDeletionCounts => c !== null);
  if (present.length === 0) return null;
  const add = <T extends Record<string, number>>(a: T, b: T): T =>
    Object.fromEntries(Object.keys(a).map((k) => [k, (a[k] ?? 0) + (b[k] ?? 0)])) as T;
  return present.reduce((acc, c) => ({
    task_routines: acc.task_routines + c.task_routines,
    task_completions: acc.task_completions + c.task_completions,
    pending_task_reviews: acc.pending_task_reviews + c.pending_task_reviews,
    stars: add(acc.stars, c.stars),
    badges: acc.badges + c.badges,
    rewards: add(acc.rewards, c.rewards),
    notes: add(acc.notes, c.notes),
    prova: add(acc.prova, c.prova),
    calendar: add(acc.calendar, c.calendar),
    grades: acc.grades + c.grades,
    shares: add(acc.shares, c.shares),
    devices: add(acc.devices, c.devices),
    ai: add(acc.ai, c.ai),
    files: add(acc.files, c.files),
  }));
}

/** Approximate storage size for people: "3,2 MB" (tr) / "3.2 MB" (en). Never pretends to be exact. */
export function formatApproximateBytes(bytes: number, locale: "tr" | "en" = "tr"): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value < 10 && unit > 0 && !Number.isInteger(value) ? 1 : 0;
  return `${value.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[unit] ?? "GB"}`;
}

/** Server error codes raised by the preview/confirm RPCs and the delete-account function. */
export const deletionErrorKeys: Record<string, string> = {
  deletion_preview_stale: "deletionPreview.error.stale",
  deletion_preview_expired: "deletionPreview.error.expired",
  deletion_preview_used: "deletionPreview.error.used",
  deletion_preview_not_found: "deletionPreview.error.notFound",
  deletion_preview_rate_limited: "deletionPreview.error.rateLimited",
  deletion_target_invalid: "deletionPreview.error.invalid",
  deletion_invalid: "deletionPreview.error.invalid",
  forbidden: "deletionPreview.error.forbidden",
};

/** Map a raw server error message/code to an i18n key; unknown errors fall back to the generic key. */
export function deletionErrorKey(message: string | null | undefined): string {
  if (!message) return "deletionPreview.error.generic";
  const code = Object.keys(deletionErrorKeys).find((key) => message === key || message.includes(key));
  return (code && deletionErrorKeys[code]) || "deletionPreview.error.generic";
}
