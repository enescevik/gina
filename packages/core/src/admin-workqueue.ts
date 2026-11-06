import { z } from "zod";

/**
 * B01 backoffice contracts: `admin_workqueue`, `admin_families_search`,
 * `admin_family_entitlement_timeline`, `admin_override_preview` and `admin_override_apply`.
 * The server decides visibility (live admin/operations role check on every call); this layer
 * validates replies, groups them for the UI and keeps the "wrong family" check explicit.
 * No backoffice page is wired to it on this branch.
 */
const uuid = z.uuid();
const count = z.number().int().min(0);
const plan = z.enum(["free", "plus", "pro"]);
const entitlementSource = z.enum(["free", "store", "comp", "beta"]);
const effective = z.object({ plan, source: entitlementSource, expires_at: z.string().nullable() });

export const ADMIN_QUEUE_ROLES = ["admin", "support", "content", "finance", "release"] as const;
export type AdminQueueRole = (typeof ADMIN_QUEUE_ROLES)[number];
export const workqueueItemSchema = z.object({
  role: z.enum(ADMIN_QUEUE_ROLES),
  queue: z.enum(["support", "review", "school", "billing", "release", "ai"]),
  key: z.string().min(1),
  count,
  oldest_since: z.string().nullable(),
  oldest_waiting_seconds: count.nullable(),
  reason: z.string().min(1),
});
export type WorkqueueItem = z.infer<typeof workqueueItemSchema>;
export const workqueueSchema = z.object({
  as_of: z.string(),
  roles: z.array(z.enum(ADMIN_QUEUE_ROLES)),
  items: z.array(workqueueItemSchema),
});
export type Workqueue = z.infer<typeof workqueueSchema>;

/** Items grouped by role in the server's order; roles the caller lacks are absent, never empty. */
export function groupWorkqueue(q: Workqueue): { role: AdminQueueRole; items: WorkqueueItem[]; pending: number }[] {
  const groups = new Map<AdminQueueRole, WorkqueueItem[]>();
  for (const item of q.items) {
    if (!q.roles.includes(item.role)) throw new Error("workqueue_role_leak");
    groups.set(item.role, [...(groups.get(item.role) ?? []), item]);
  }
  return [...groups].map(([role, items]) => ({ role, items, pending: items.reduce((n, i) => n + i.count, 0) }));
}
/** i18n key for a queue item (`admin.workqueue.<key>`) and its reason (`admin.workqueue.reason.<reason>`). */
export const workqueueItemKey = (item: WorkqueueItem) => `admin.workqueue.${item.key}`;
export const workqueueReasonKey = (item: WorkqueueItem) => `admin.workqueue.reason.${item.reason}`;
/** Rounded waiting label: minutes under an hour, hours under two days, otherwise days. */
export function waitingLabel(seconds: number | null): { unit: "minutes" | "hours" | "days"; value: number } | null {
  if (seconds === null) return null;
  if (seconds < 3600) return { unit: "minutes", value: Math.floor(seconds / 60) };
  if (seconds < 2 * 86400) return { unit: "hours", value: Math.floor(seconds / 3600) };
  return { unit: "days", value: Math.floor(seconds / 86400) };
}

export const familySearchRowSchema = z.object({
  id: uuid,
  name: z.string(),
  created_at: z.string(),
  timezone: z.string(),
  member_count: count,
  child_count: count,
  archived_child_count: count,
  device_count: count,
  plan,
  plan_source: entitlementSource,
  plan_expires_at: z.string().nullable(),
  store_status: z.enum(["active", "grace", "on_hold", "expired", "revoked"]).nullable(),
  active_override_count: count,
  last_activity_at: z.string().nullable(),
  matched_on: z.array(z.enum(["id", "invite_code", "name", "child_name", "email"])),
}).strict();
export type FamilySearchRow = z.infer<typeof familySearchRowSchema>;
/** D12 (D11-K1): server-side sort for `admin_families_search`; "newest" is the pre-D12 default. */
export const FAMILY_SORTS = ["newest", "expiring"] as const;
export const familySortSchema = z.enum(FAMILY_SORTS);
export type FamilySort = z.infer<typeof familySortSchema>;
/** "Ends within N days" window used by /families (support queue). Server accepts 1–90. */
export const FAMILY_EXPIRING_DAYS = 14;
/** RPC args for `admin_families_search`; the D12 params are omitted when unused so a pre-D12 database still accepts the call. */
export function familySearchArgs(query: string | null, cursor: string | null, limit: number, opts: { expiringWithinDays?: number | null; sort?: FamilySort } = {}) {
  const args: Record<string, unknown> = { p_query: query, p_cursor: cursor, p_limit: limit };
  if (opts.expiringWithinDays != null) args.p_expiring_within_days = opts.expiringWithinDays;
  if (opts.sort && opts.sort !== "newest") args.p_sort = opts.sort;
  return args;
}
export const familiesSearchSchema = z.object({
  as_of: z.string(),
  query: z.string().nullable(),
  limit: z.number().int().min(1).max(200),
  /** D12: echoed by the server; absent on a pre-D12 database. */
  sort: familySortSchema.optional(),
  expiring_within_days: z.number().int().min(1).max(90).nullable().optional(),
  has_more: z.boolean(),
  rows: z.array(familySearchRowSchema),
  next_cursor: z.string().nullable(),
}).refine((p) => p.has_more === (p.next_cursor !== null), "cursor_mismatch");
export type FamiliesSearch = z.infer<typeof familiesSearchSchema>;
export const FAMILY_SEARCH_MAX_QUERY = 120;
/** Trim and bound the query; `null` means "list everything". */
export function normalizeFamilyQuery(raw: string): string | null {
  const q = raw.trim();
  if (!q) return null;
  if (q.length > FAMILY_SEARCH_MAX_QUERY) throw new Error("query_too_long");
  return q;
}
/** Append a page; a reply whose cursor does not follow the previous page is rejected (stale request). */
export function appendFamilyPage(pages: FamilySearchRow[], page: FamiliesSearch, expectedCursor: string | null, lastCursor: string | null) {
  if (expectedCursor !== lastCursor) throw new Error("page_out_of_order");
  const seen = new Set(pages.map((r) => r.id));
  const fresh = page.rows.filter((r) => !seen.has(r.id));
  return { rows: [...pages, ...fresh], cursor: page.next_cursor, hasMore: page.has_more };
}

/** D12 (D11-K2): `admin_audit_actors` — staff account id → display label (email); `null` when not resolvable. */
export const AUDIT_ACTORS_MAX = 200;
export const auditActorsSchema = z.array(z.object({ id: uuid, label: z.string().nullable() }).strict());
export type AuditActor = z.infer<typeof auditActorsSchema>[number];
/** Distinct non-null actor ids not yet resolved, capped at the server limit. */
export function unresolvedActorIds(ids: (string | null)[], known: ReadonlyMap<string, string | null>, self: string): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!id || id === self || known.has(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length === AUDIT_ACTORS_MAX) break;
  }
  return out;
}
export type ActorLabel = { kind: "system" } | { kind: "self" } | { kind: "named"; label: string } | { kind: "other" };
/** Who did it: system (no actor), the signed-in admin, a resolved staff label, or an unresolved other admin. */
export function actorLabel(id: string | null, self: string, known: ReadonlyMap<string, string | null>): ActorLabel {
  if (id === null) return { kind: "system" };
  if (id === self) return { kind: "self" };
  const label = known.get(id);
  return label ? { kind: "named", label } : { kind: "other" };
}

export const TIMELINE_STORE_KINDS = [
  "store_subscription", "store_purchase", "store_renewal", "store_renewal_resumed", "store_cancel", "store_refund",
  "store_refund_declined", "store_refund_reversed", "store_revoke", "store_expired", "store_grace", "store_on_hold",
  "store_paused", "store_plan_change", "store_other",
] as const;
export const TIMELINE_OPERATOR_KINDS = ["comp_granted", "comp_revoked", "comp_expired", "store_check_requested"] as const;
export const timelineKindSchema = z.enum([...TIMELINE_STORE_KINDS, ...TIMELINE_OPERATOR_KINDS]);
export type TimelineKind = z.infer<typeof timelineKindSchema>;
export const timelineEventSchema = z.object({
  occurred_at: z.string(),
  kind: timelineKindSchema,
  id: z.string().min(1),
  family_of: z.enum(["store", "operator"]),
  data: z.record(z.string(), z.unknown()),
});
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export const entitlementTimelineSchema = z.object({
  as_of: z.string(),
  family: z.object({ id: uuid, name: z.string(), timezone: z.string(), created_at: z.string(), effective }),
  limit: z.number().int().min(1).max(200),
  has_more: z.boolean(),
  events: z.array(timelineEventSchema),
  next_cursor: z.string().nullable(),
});
export type EntitlementTimeline = z.infer<typeof entitlementTimelineSchema>;
/** Refund, cancellation and operator compensation are different things; the UI must label them apart. */
export type TimelineGroup = "purchase" | "renewal" | "cancellation" | "refund" | "revocation" | "lapse" | "compensation" | "verification" | "other";
export function timelineGroup(kind: TimelineKind): TimelineGroup {
  switch (kind) {
    case "store_subscription": case "store_purchase": case "store_plan_change": return "purchase";
    case "store_renewal": case "store_renewal_resumed": return "renewal";
    case "store_cancel": return "cancellation";
    case "store_refund": case "store_refund_declined": case "store_refund_reversed": return "refund";
    case "store_revoke": return "revocation";
    case "store_expired": case "store_grace": case "store_on_hold": case "store_paused": return "lapse";
    case "comp_granted": case "comp_revoked": case "comp_expired": return "compensation";
    case "store_check_requested": return "verification";
    default: return "other";
  }
}
/** A page that belongs to another family must never be merged into an open family tab. */
export function appendTimelinePage(current: EntitlementTimeline | null, page: EntitlementTimeline): EntitlementTimeline {
  if (!current) return page;
  if (current.family.id !== page.family.id) throw new Error("timeline_family_mismatch");
  const seen = new Set(current.events.map((e) => `${e.kind}:${e.id}`));
  return { ...page, events: [...current.events, ...page.events.filter((e) => !seen.has(`${e.kind}:${e.id}`))] };
}

export const OVERRIDE_BLOCKERS = [
  "override_plan_free", "override_reason_required", "override_ends_at_invalid", "override_too_long", "plan_not_above_current",
] as const;
export const overrideBlockerSchema = z.enum(OVERRIDE_BLOCKERS);
export type OverrideBlocker = z.infer<typeof overrideBlockerSchema>;
export const overrideConflictSchema = z.object({
  override_id: uuid,
  plan,
  starts_at: z.string(),
  ends_at: z.string(),
  reason: z.string(),
  relation: z.enum(["scheduled", "higher_plan_active", "same_plan_covers_request", "same_plan_shorter", "lower_plan_active"]),
});
export const overrideChangeSchema = z.object({
  limit: z.enum(["max_children", "max_devices", "max_active_tasks_per_child", "max_notes", "history_days", "ai_weekly"]),
  before: z.string().nullable(),
  after: z.string().nullable(),
  direction: z.enum(["opens", "closes", "same"]),
});
export const overridePreviewSchema = z.object({
  as_of: z.string(),
  family: z.object({ id: uuid, name: z.string(), timezone: z.string(), created_at: z.string(), member_count: count, child_count: count }),
  request: z.object({ plan, until: z.string().nullable(), reason_ok: z.boolean() }),
  before: effective,
  after: effective,
  reverts_to: effective.extend({ note: z.string() }),
  changes: z.array(overrideChangeSchema),
  conflicts: z.array(overrideConflictSchema),
  presets: z.array(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]), until: z.string() })).length(3),
  blockers: z.array(overrideBlockerSchema),
  can_apply: z.boolean(),
  replace_required: z.boolean(),
}).refine((p) => p.can_apply === (p.blockers.length === 0), "can_apply_mismatch");
export type OverridePreview = z.infer<typeof overridePreviewSchema>;
export const overrideApplyResultSchema = z.object({
  request_id: uuid,
  action: z.literal("grant"),
  override_id: uuid,
  family_id: uuid,
  replayed: z.boolean(),
  before: effective.optional(),
  after: effective.optional(),
  replaced: z.array(uuid).optional(),
});
export type OverrideApplyResult = z.infer<typeof overrideApplyResultSchema>;
export const overrideRequestSchema = z.object({
  family_id: uuid,
  plan: z.enum(["plus", "pro"]),
  until: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(3).max(1000),
}).strict();
export type OverrideRequest = z.infer<typeof overrideRequestSchema>;

/** The preview is for the family the operator opened; a different family is a wrong-target error, not a warning. */
export function assertPreviewFamily(preview: OverridePreview, expectedFamilyId: string): OverridePreview {
  if (preview.family.id !== expectedFamilyId) throw new Error("override_wrong_family");
  return preview;
}
export const presetUntil = (preview: OverridePreview, days: 7 | 30 | 90) =>
  preview.presets.find((p) => p.days === days)?.until ?? null;
export const openedLimits = (preview: OverridePreview) => preview.changes.filter((c) => c.direction === "opens").map((c) => c.limit);
export const closedLimits = (preview: OverridePreview) => preview.changes.filter((c) => c.direction === "closes").map((c) => c.limit);
export const overrideBlockerKey = (b: OverrideBlocker) => `admin.override.blocker.${b}`;
/** RPC arguments for `admin_override_apply`; the key is generated once per operator intent and reused on retry. */
export function overrideApplyArgs(request: OverrideRequest, idempotencyKey: string, replaceConflicts = false) {
  if (!z.uuid().safeParse(idempotencyKey).success) throw new Error("idempotency_key_invalid");
  return {
    p_family_id: request.family_id,
    p_plan: request.plan,
    p_until: request.until,
    p_reason: request.reason.trim(),
    p_idempotency_key: idempotencyKey,
    p_replace_conflicts: replaceConflicts,
  };
}
/** A reply must echo the key and family of the request it answers. */
export function readOverrideApplyResult(request: OverrideRequest, idempotencyKey: string, data: unknown): OverrideApplyResult {
  const result = overrideApplyResultSchema.parse(data);
  if (result.request_id !== idempotencyKey || result.family_id !== request.family_id) throw new Error("override_receipt_invalid");
  return result;
}
