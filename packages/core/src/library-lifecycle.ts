import { z } from "zod";

// Mirrors supabase/migrations/20261106110000_library_credit_safety.sql. The server is the
// authority; these schemas and pure functions let clients validate RPC payloads and show the
// same credit / ranking arithmetic before a round trip. Nothing here publishes or grants.

export const libraryContentKind = z.enum([
  "package",
  "contribution_set",
  "legacy_item",
  "collection",
  "legacy_contribution",
]);
export const libraryLifecycleStatus = z.enum([
  "draft",
  "reviewed",
  "approved",
  "published",
  "withdrawn",
]);
export const libraryContentItemSchema = z.object({
  kind: libraryContentKind,
  id: z.uuid(),
  title: z.string(),
  grade: z.number().int().nullable(),
  subject: z.string().nullable(),
  status: libraryLifecycleStatus,
  version: z.number().int().positive(),
  publication_version: z.number().int().positive().nullable(),
  series_key: z.string().nullable(),
  previous_id: z.uuid().nullable(),
  parent_id: z.uuid().nullable(),
  source_family_id: z.uuid().nullable(),
  prereview_status: z.enum([
    "pending",
    "ai_approved",
    "needs_admin",
    "ai_rejected_suggestion",
  ]).nullable(),
  admin_decision: z.string().nullable(),
  live: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LibraryContentItem = z.infer<typeof libraryContentItemSchema>;

/** Approval is an editorial state; only `published` + `live` is served to families. */
export function isServedToFamilies(item: Pick<LibraryContentItem, "status" | "live">) {
  return item.status === "published" && item.live;
}

export const rewardKind = z.enum(["library", "ai_questions", "plan"]);
export const rewardRuleSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().optional(),
  threshold: z.number().int().min(1).max(500),
  kind: rewardKind,
  amount: z.number().int().min(1).max(1000),
  plan: z.enum(["plus", "pro"]).nullable().optional(),
  valid_days: z.number().int().min(1).max(365).default(30),
  enabled: z.boolean().default(true),
}).refine((r) => r.kind !== "plan" || r.plan === "plus" || r.plan === "pro", {
  message: "plan rule needs a plan",
});
export type RewardRule = z.input<typeof rewardRuleSchema>;

export interface PolicyPreviewRule {
  index: number;
  threshold: number;
  kind: z.infer<typeof rewardKind>;
  amount: number;
  enabled: boolean;
  milestones: number;
  granted: number;
  plan_days: number;
  next_at: number | null;
}
export interface PolicyPreview {
  accepted_count: number;
  rules: PolicyPreviewRule[];
  totals: { library: number; ai_questions: number; plan_days: number };
  stacking: {
    rules: [number, number];
    kind: z.infer<typeof rewardKind>;
    first_common_count: number;
    combined_amount_at_common: number;
  }[];
  next: { count: number; remaining: number; grants: { index: number; kind: string; amount: number }[] } | null;
}
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Same arithmetic as public.library_policy_preview: each rule pays once per full multiple of its threshold. */
export function previewLibraryPolicy(acceptedCount: number, rules: RewardRule[]): PolicyPreview {
  if (!Number.isInteger(acceptedCount) || acceptedCount < 0 || acceptedCount > 100000) {
    throw new Error("invalid_input");
  }
  if (rules.length > 20) throw new Error("invalid_input");
  const parsed = rules.map((r) => {
    const result = rewardRuleSchema.safeParse(r);
    if (!result.success) throw new Error("invalid_input");
    return result.data;
  });
  const n = acceptedCount;
  const totals = { library: 0, ai_questions: 0, plan_days: 0 };
  const out: PolicyPreviewRule[] = parsed.map((r, index) => {
    const milestones = r.enabled ? Math.floor(n / r.threshold) : 0;
    const granted = milestones * r.amount;
    const plan_days = r.kind === "plan" ? milestones * Math.min(r.amount, r.valid_days) : 0;
    if (r.enabled) {
      if (r.kind === "library") totals.library += granted;
      else if (r.kind === "ai_questions") totals.ai_questions += granted;
      else totals.plan_days += plan_days;
    }
    return {
      index,
      threshold: r.threshold,
      kind: r.kind,
      amount: r.amount,
      enabled: r.enabled,
      milestones,
      granted,
      plan_days,
      next_at: r.enabled ? (Math.floor(n / r.threshold) + 1) * r.threshold : null,
    };
  });
  const stacking: PolicyPreview["stacking"] = [];
  for (const a of out) {
    if (!a.enabled) continue;
    for (const b of out) {
      if (!b.enabled || b.index <= a.index || b.kind !== a.kind) continue;
      const common = (a.threshold * b.threshold) / gcd(a.threshold, b.threshold);
      const days = (r: PolicyPreviewRule) =>
        Math.min(r.amount, parsed[r.index]?.valid_days ?? 30);
      stacking.push({
        rules: [a.index, b.index],
        kind: a.kind,
        first_common_count: common,
        combined_amount_at_common: a.kind === "plan" ? days(a) + days(b) : a.amount + b.amount,
      });
    }
  }
  const nextCounts = out.filter((r) => r.enabled && r.next_at !== null).map((r) => r.next_at as number);
  const next = nextCounts.length === 0 ? null : (() => {
    const count = Math.min(...nextCounts);
    return {
      count,
      remaining: count - n,
      grants: out.filter((r) => r.enabled && r.next_at === count).map((r) => ({
        index: r.index,
        kind: r.kind,
        amount: r.amount,
      })),
    };
  })();
  return { accepted_count: n, rules: out, totals, stacking, next };
}

export const familyLibraryCreditsSchema = z.object({
  family_id: z.uuid(),
  plan: z.enum(["free", "plus", "pro"]),
  monthly: z.object({
    limit: z.number().int().min(0),
    used: z.number().int().min(0),
    remaining: z.number().int().min(0),
    period_start: z.string(),
    renews_at: z.string(),
  }),
  bonus: z.object({
    earned: z.number().int().min(0),
    used: z.number().int().min(0),
    remaining: z.number().int().min(0),
    grants: z.array(z.object({
      id: z.uuid(),
      amount: z.number().int(),
      used: z.number().int(),
      remaining: z.number().int(),
      starts_at: z.string(),
      ends_at: z.string(),
      policy_id: z.uuid().nullable(),
      milestone: z.number().int().nullable(),
      reason: z.string(),
    })),
  }),
  total_remaining: z.number().int().min(0),
  expired_or_future_grants: z.number().int().min(0),
  contributions: z.object({
    accepted_questions: z.number().int().min(0),
    credited_sets: z.number().int().min(0),
    pending_sets: z.number().int().min(0),
    next_milestones: z.array(z.object({
      policy_id: z.uuid(),
      title: z.string(),
      threshold: z.number().int(),
      kind: rewardKind,
      amount: z.number().int(),
      valid_days: z.number().int(),
      reached: z.number().int(),
      next_at: z.number().int(),
      remaining_to_next: z.number().int().min(1),
    })),
  }),
});
export type FamilyLibraryCredits = z.infer<typeof familyLibraryCreditsSchema>;

/** A credit is consumed once per acquired question copy; re-opening an owned unit costs nothing. */
export function creditsNeeded(
  units: { key: string; count: number; owned: boolean }[],
  selected: string[],
) {
  const chosen = new Set(selected);
  return units.filter((u) => chosen.has(u.key) && !u.owned).reduce((sum, u) => sum + u.count, 0);
}

export const contributionTrailStepSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(["preparing", "pending", "approved", "rejected", "withdrawn"]),
  created_at: z.string(),
  supersedes_id: z.uuid().nullable(),
  question_id: z.uuid().nullable().optional(),
  title: z.string().nullable(),
  question_count: z.number().int(),
  decision: z.enum(["approved", "rejected"]).nullable(),
  review_note: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  reviewed_by: z.uuid().nullable().optional(),
  package_id: z.uuid().nullable(),
  prereview_status: z.string().nullable(),
  prereview_at: z.string().nullable(),
  package_status: libraryLifecycleStatus.nullable(),
});
export const contributionTrailSchema = z.object({
  chain_id: z.uuid(),
  family_id: z.uuid().nullable(),
  current: z.uuid().nullable(),
  steps: z.array(contributionTrailStepSchema),
});
export type ContributionTrail = z.infer<typeof contributionTrailSchema>;

/** A rejected copy can be corrected and resubmitted exactly once; approved copies are final. */
export function canSupersede(stepId: string, trail: ContributionTrail) {
  const step = trail.steps.find((s) => s.id === stepId);
  if (!step || (step.status !== "rejected" && step.status !== "withdrawn")) return false;
  return !trail.steps.some((s) => s.supersedes_id === stepId && s.status !== "withdrawn");
}

export const rankingReason = z.enum([
  "eligible",
  "no_consent",
  "unfinished",
  "unreadable",
  "unscored",
  "results_not_published",
]);
export type RankingReason = z.infer<typeof rankingReason>;

/** Same precedence as gina.cohort_ranking_rows: only finished, consented, fully scored and (for reviewed cohorts) published entries rank. */
export function rankingEligibility(entry: {
  consent: boolean;
  attemptStatus: string;
  rows: { reviewed: boolean; outcome: string; points: number | null }[];
  requiresReview: boolean;
  published: boolean;
}): { eligible: boolean; reason: RankingReason } {
  if (!entry.consent) return { eligible: false, reason: "no_consent" };
  if (entry.attemptStatus === "in_progress") return { eligible: false, reason: "unfinished" };
  if (entry.rows.some((r) => r.outcome === "unreadable")) return { eligible: false, reason: "unreadable" };
  if (entry.rows.some((r) => !r.reviewed || r.points === null)) return { eligible: false, reason: "unscored" };
  if (entry.requiresReview && !entry.published) return { eligible: false, reason: "results_not_published" };
  return { eligible: true, reason: "eligible" };
}

export const groupExamPhasesSchema = z.object({
  group_id: z.uuid(),
  status: z.enum(["published", "cancelled"]),
  participation: z.object({
    starts_at: z.string(),
    ends_at: z.string(),
    open: z.boolean(),
    phase: z.enum(["cancelled", "upcoming", "open", "closed"]),
    entries: z.number().int().nullable(),
    my_entries: z.array(z.object({
      child_id: z.uuid(),
      exam_id: z.uuid(),
      ranking_consent: z.boolean(),
      review_consent_at: z.string().nullable(),
    })).nullable(),
  }),
  child_time: z.object({
    duration_minutes: z.number().int().min(5).max(120),
    deadline_rule: z.string(),
    one_attempt: z.literal(true),
  }),
  review: z.object({
    required: z.boolean(),
    phase: z.enum([
      "automatic",
      "waiting_for_window",
      "in_review",
      "appeals_open",
      "ready_to_publish",
      "published",
    ]),
    pending: z.number().int().nullable(),
    unfinished: z.number().int().nullable(),
    appeals: z.number().int().nullable(),
    published: z.boolean(),
    publication_version: z.number().int().nullable(),
  }),
  ranking: z.object({
    optional: z.literal(true),
    consent_required: z.literal(true),
    secondary: z.literal(true),
    eligible_entries: z.number().int().min(0),
    excluded: z.record(z.string(), z.number().int()),
    mine: z.array(z.object({
      child_id: z.uuid(),
      eligible: z.boolean(),
      reason: rankingReason,
    })).nullable(),
  }),
});
export type GroupExamPhases = z.infer<typeof groupExamPhasesSchema>;
