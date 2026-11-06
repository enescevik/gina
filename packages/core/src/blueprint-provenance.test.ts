import { describe, expect, it } from "vitest";
import { blueprintInputSchema } from "./blueprint";
import {
  blueprintProvenanceLabel,
  blueprintProvenanceSchema,
  seedIsPersonalized,
  seedProvenanceInput,
} from "./blueprint-provenance";
import {
  legacyZeroApplyResultSchema,
  legacyZeroImpact,
  legacyZeroPreviewSchema,
  legacyZeroSelectable,
} from "./legacy-score-correction";

const base = {
  child_id: "20000000-0000-4000-8000-000000010801",
  grade: 5,
  subject: "Matematik",
  name: "Ada çalışma",
  academic_year: "2026-2027",
  term: 1,
  exam: 1,
  rows: [{ topic: "Blok 1", count: 2 }, { topic: "Blok 2", count: 3 }],
  source_url: "",
  confirmed: true as const,
};
const seed = {
  school: "unknown" as const,
  label: "Senaryo 1",
  rows: [{ topic: "Blok 1", count: 2 }, { topic: "Blok 2", count: 3 }],
};

describe("blueprint input (C01)", () => {
  it("still accepts the old payload and stored commands without new keys", () => {
    expect(blueprintInputSchema.safeParse(base).success).toBe(true);
  });
  it("accepts a school statement and personalization metadata", () => {
    expect(blueprintInputSchema.safeParse({
      ...base,
      school_scenario: "known",
      personalization: { basis: "catalogue_seed", base_label: "Senaryo 1", base_total: 5, base_blocks: 2 },
    }).success).toBe(true);
  });
  it("never lets the client claim school confirmation or official verification", () => {
    expect(blueprintInputSchema.safeParse({ ...base, school_confirmed: true }).success).toBe(false);
    expect(blueprintInputSchema.safeParse({ ...base, officially_verified: true }).success).toBe(false);
    expect(blueprintInputSchema.safeParse({ ...base, school_scenario: "confirmed" }).success).toBe(false);
    expect(blueprintInputSchema.safeParse({
      ...base,
      personalization: { basis: "school", base_label: "x", base_total: 1, base_blocks: 1 },
    }).success).toBe(false);
  });
});

describe("seed provenance", () => {
  it("unchanged seed: statement only, no personalization", () => {
    expect(seedProvenanceInput(seed, seed.rows)).toEqual({ school_scenario: "unknown" });
    expect(seedIsPersonalized(seed, seed.rows)).toBe(false);
  });
  it("changed counts or topics: personalization kept outside the name", () => {
    const rows = [{ topic: "Blok 1", count: 3 }, { topic: "Blok 2", count: 3 }];
    const out = seedProvenanceInput({ ...seed, school: "known" }, rows);
    expect(out).toEqual({
      school_scenario: "known",
      personalization: { basis: "catalogue_seed", base_label: "Senaryo 1", base_total: 5, base_blocks: 2 },
    });
    expect(blueprintInputSchema.safeParse({ ...base, rows, ...out }).success).toBe(true);
    expect(seedIsPersonalized(seed, [{ topic: "Blok 1", count: 2 }])).toBe(true);
  });
  it("drops personalization for an out-of-range seed instead of failing the save", () => {
    const big = { ...seed, rows: [{ topic: "Blok 1", count: 31 }] };
    expect(seedProvenanceInput(big, [{ topic: "Blok 1", count: 2 }])).toEqual({ school_scenario: "unknown" });
  });
});

describe("provenance label", () => {
  const row = {
    school_scenario: "unstated" as const,
    distribution_kind: "parent_study" as const,
    school_confirmed: false,
    official_source_verified: false,
    personalization: null,
  };
  it("parent entries are study or a statement, never school confirmed", () => {
    expect(blueprintProvenanceLabel(row)).toBe("study");
    expect(blueprintProvenanceLabel({ ...row, school_scenario: "known" })).toBe("parent_school_statement");
    expect(blueprintProvenanceLabel({ ...row, school_scenario: "known", school_confirmed: true })).toBe("parent_school_statement");
    expect(blueprintProvenanceLabel({ ...row, distribution_kind: "personalized", personalization: { basis: "catalogue_seed" } }))
      .toBe("personalized");
  });
  it("catalogue copy: confirmation and official verification are separate", () => {
    const cat = { ...row, distribution_kind: "school_catalogue" as const, school_scenario: "known" as const, school_confirmed: true };
    expect(blueprintProvenanceLabel(cat)).toBe("school_confirmed");
    expect(blueprintProvenanceLabel({ ...cat, official_source_verified: true })).toBe("official_verified");
  });
  it("parses server rows", () => {
    expect(blueprintProvenanceSchema.parse(row)).toEqual(row);
  });
});

describe("legacy auto-zero correction", () => {
  const preview = {
    scope: "family",
    family_id: "10000000-0000-4000-8000-000000010801",
    rule: "p04_legacy_auto_zero",
    eligible: 1,
    blocked: 1,
    already_corrected: 0,
    attempts: [
      {
        attempt_id: "60000000-0000-4000-8000-000000010811",
        exam_id: "54000000-0000-4000-8000-000000010811",
        child_id: "20000000-0000-4000-8000-000000010801",
        finished_at: "2026-10-28T09:00:00+00:00",
        blocked: null,
        before: { status: "graded", score_pct: 33, open_total: 2, open_graded: 2, open_pending: null, open_unanswered: null, provisional: null, graded_at: "2026-10-28T09:00:00+00:00" },
        after: { status: "submitted", score_pct: 100, open_total: 2, open_graded: 0, open_pending: 1, open_unanswered: 1, provisional: true },
        items: [
          { question_id: "40000000-0000-4000-8000-000000010802", position: 2, state: "pending" },
          { question_id: "40000000-0000-4000-8000-000000010803", position: 3, state: "unanswered" },
        ],
        kept_scores: 0,
      },
      {
        attempt_id: "60000000-0000-4000-8000-000000010815",
        exam_id: "54000000-0000-4000-8000-000000010815",
        child_id: "20000000-0000-4000-8000-000000010802",
        finished_at: "2026-11-01T09:00:00+00:00",
        blocked: "child_archived",
        before: { status: "graded", score_pct: 0, open_total: 1, open_graded: 1, open_pending: null, open_unanswered: null, provisional: null, graded_at: null },
        after: { status: "submitted", score_pct: null, open_total: 1, open_graded: 0, open_pending: 0, open_unanswered: 1, provisional: true },
        items: [{ question_id: "40000000-0000-4000-8000-000000010803", position: 1, state: "unanswered" }],
        kept_scores: 0,
      },
    ],
  };
  it("parses the preview and never selects an archived profile", () => {
    const parsed = legacyZeroPreviewSchema.parse(preview);
    expect(legacyZeroSelectable(parsed)).toEqual(["60000000-0000-4000-8000-000000010811"]);
    expect(legacyZeroImpact(parsed.attempts[0]!)).toEqual({
      scoreBefore: 33, scoreAfter: 100, becomesProvisional: true, pending: 1, unanswered: 1,
    });
  });
  it("parses apply results including idempotent outcomes", () => {
    expect(legacyZeroApplyResultSchema.parse({
      corrected: 0,
      results: [
        { attempt_id: "60000000-0000-4000-8000-000000010811", result: "already_corrected", after: preview.attempts[0]!.after },
        { attempt_id: "60000000-0000-4000-8000-000000010816", result: "not_found" },
      ],
    }).corrected).toBe(0);
  });
});
