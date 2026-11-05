import { describe, expect, it } from "vitest";
import {
  canSupersede,
  contributionTrailSchema,
  creditsNeeded,
  isServedToFamilies,
  libraryContentItemSchema,
  previewLibraryPolicy,
  rankingEligibility,
} from "./library-lifecycle";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("library policy preview (mirrors public.library_policy_preview)", () => {
  const rules = [
    { threshold: 5, kind: "library" as const, amount: 20 },
    { threshold: 10, kind: "library" as const, amount: 50 },
  ];
  it("adds overlapping rules at common multiples and reports the stacking point", () => {
    const p = previewLibraryPolicy(10, rules);
    expect(p.totals.library).toBe(90);
    expect(p.stacking[0]).toMatchObject({ first_common_count: 10, combined_amount_at_common: 70 });
  });
  it("computes the next milestone across rules", () => {
    const p = previewLibraryPolicy(7, rules);
    expect(p.next).toEqual({ count: 10, remaining: 3, grants: [{ index: 0, kind: "library", amount: 20 }, { index: 1, kind: "library", amount: 50 }] });
  });
  it("ignores disabled rules and caps plan days by validity like the grant path", () => {
    expect(previewLibraryPolicy(10, [{ threshold: 5, kind: "library", amount: 20, enabled: false }]).totals.library).toBe(0);
    expect(previewLibraryPolicy(5, [{ threshold: 5, kind: "plan", plan: "plus", amount: 30, valid_days: 10 }]).totals.plan_days).toBe(10);
    expect(previewLibraryPolicy(5, [{ threshold: 5, kind: "plan", plan: "plus", amount: 30, valid_days: 10 }]).rules[0]?.next_at).toBe(10);
  });
  it("rejects invalid rules and counts", () => {
    expect(() => previewLibraryPolicy(1, [{ threshold: 0, kind: "library", amount: 1 }])).toThrow("invalid_input");
    expect(() => previewLibraryPolicy(1, [{ threshold: 1, kind: "stars" as never, amount: 1 }])).toThrow("invalid_input");
    expect(() => previewLibraryPolicy(1, [{ threshold: 1, kind: "plan", amount: 1 }])).toThrow("invalid_input");
    expect(() => previewLibraryPolicy(-1, [])).toThrow("invalid_input");
    expect(previewLibraryPolicy(3, []).next).toBeNull();
  });
});

describe("credit consumption", () => {
  it("charges only unowned units once, by their question count", () => {
    const units = [
      { key: "source:segments", count: 3, owned: true },
      { key: "question:question-4", count: 1, owned: false },
    ];
    expect(creditsNeeded(units, ["source:segments"])).toBe(0);
    expect(creditsNeeded(units, ["source:segments", "question:question-4", "question:question-4"])).toBe(1);
  });
});

describe("lifecycle status", () => {
  it("approved is not served; only live published items are", () => {
    const base = {
      kind: "package", id: uuid(1), title: "T", grade: 5, subject: "Matematik", version: 1, publication_version: null,
      series_key: "k", previous_id: null, parent_id: null, source_family_id: null, prereview_status: null, admin_decision: "suitable",
      live: false, created_at: "2026-11-06T00:00:00Z", updated_at: "2026-11-06T00:00:00Z",
    };
    const approved = libraryContentItemSchema.parse({ ...base, status: "approved" });
    expect(isServedToFamilies(approved)).toBe(false);
    expect(isServedToFamilies({ status: "published", live: false })).toBe(false);
    expect(isServedToFamilies({ status: "published", live: true })).toBe(true);
    expect(libraryContentItemSchema.safeParse({ ...base, status: "rejected" }).success).toBe(false);
  });
});

describe("rejection → correction chain", () => {
  const trail = contributionTrailSchema.parse({
    chain_id: uuid(1),
    family_id: null,
    current: uuid(2),
    steps: [
      { id: uuid(1), version: 1, status: "rejected", created_at: "2026-11-06T00:00:00Z", supersedes_id: null, title: "Çevre", question_count: 1, decision: "rejected", review_note: "Çözüm eksik", reviewed_at: "2026-11-06T00:01:00Z", package_id: null, prereview_status: null, prereview_at: null, package_status: null },
      { id: uuid(2), version: 2, status: "pending", created_at: "2026-11-06T00:02:00Z", supersedes_id: uuid(1), title: "Çevre", question_count: 1, decision: null, review_note: null, reviewed_at: null, package_id: null, prereview_status: "pending", prereview_at: null, package_status: null },
    ],
  });
  it("links the correction to the rejected copy and blocks a second correction", () => {
    expect(trail.steps[1]?.supersedes_id).toBe(uuid(1));
    expect(canSupersede(uuid(1), trail)).toBe(false);
    expect(canSupersede(uuid(2), trail)).toBe(false);
    const withdrawn = { ...trail, steps: trail.steps.map((s) => s.id === uuid(2) ? { ...s, status: "withdrawn" as const } : s) };
    expect(canSupersede(uuid(1), withdrawn)).toBe(true);
  });
});

describe("cohort ranking eligibility (mirrors gina.cohort_ranking_rows)", () => {
  const scored = { reviewed: true, outcome: "scored", points: 2 };
  const base = { consent: true, attemptStatus: "submitted", rows: [scored], requiresReview: true, published: true };
  it("only finished, consented, scored and published entries rank", () => {
    expect(rankingEligibility(base)).toEqual({ eligible: true, reason: "eligible" });
    expect(rankingEligibility({ ...base, consent: false }).reason).toBe("no_consent");
    expect(rankingEligibility({ ...base, attemptStatus: "in_progress" }).reason).toBe("unfinished");
    expect(rankingEligibility({ ...base, rows: [{ reviewed: false, outcome: "unreadable", points: null }] }).reason).toBe("unreadable");
    expect(rankingEligibility({ ...base, rows: [{ reviewed: false, outcome: "pending", points: null }] }).reason).toBe("unscored");
    expect(rankingEligibility({ ...base, published: false }).reason).toBe("results_not_published");
    expect(rankingEligibility({ ...base, requiresReview: false, published: false, rows: [{ reviewed: true, outcome: "automatic", points: 0 }] }).eligible).toBe(true);
  });
  it("an unanswered multiple-choice item scores zero, it is not unscored", () => {
    expect(rankingEligibility({ ...base, requiresReview: false, rows: [{ reviewed: true, outcome: "automatic", points: 0 }] }).reason).toBe("eligible");
  });
});
