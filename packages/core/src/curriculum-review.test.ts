import { describe, expect, it } from "vitest";
import {
  curriculumBundleSchema,
  curriculumCommandSchema,
  curriculumReviewSchema,
} from "./curriculum-review";
const candidate = {
  key: "tr-test-g5",
  academic_year: "2026-2027",
  term: 1,
  exam: 1,
  grade: 5,
  subject: "Matematik",
  label: "Senaryo 1",
  source_url: "https://cdn.eba.gov.tr/source.xlsx",
  source_sha256: "a".repeat(64),
  sheet: "5. Sınıf",
  header_cell: "C6",
  question_count: 2,
  blocks: [{
    count: 2,
    count_cell: "C12",
    outcomes: [{
      cell: "B12",
      text: "Birlikte ölçülen birinci çıktı",
      code: "MAT.5.1.1",
    }, { cell: "B13", text: "İkinci çıktı", code: null }],
  }],
  review_reasons: ["source_review_required", "uncoded_source_instruction"],
};
const bundle = () => ({
  schema: "gina.curriculum-review.v1",
  candidates: [JSON.parse(JSON.stringify(candidate))],
});
const review = () => ({
  programme: "Program sürümü",
  school_scope: "Okul kapsamı",
  programme_url: "https://tymm.meb.gov.tr/program",
  source_checked: true,
  counts_checked: true,
  applicability_checked: true,
  issues_resolution: "Kod olmayan yönerge kaynakla karşılaştırıldı.",
  note: "Kaynak kontrolü kaydedildi.",
});
describe("source review contract", () => {
  it("retains shared blocks, source cells and uncoded instructions", () => {
    const parsed = curriculumBundleSchema.parse(bundle());
    expect(parsed.candidates[0]!.question_count).toBe(2);
    expect(parsed.candidates[0]!.blocks[0]!.outcomes).toEqual(
      candidate.blocks[0]!.outcomes,
    );
  });
  it("rejects duplicated candidates and false question totals", () => {
    const v = bundle();
    v.candidates.push(JSON.parse(JSON.stringify(candidate)));
    expect(curriculumBundleSchema.safeParse(v).success).toBe(false);
    v.candidates.pop();
    v.candidates[0]!.question_count = 4;
    expect(curriculumBundleSchema.safeParse(v).success).toBe(false);
  });
  it("cannot smuggle approval into intake", () => {
    expect(
      curriculumBundleSchema.safeParse({ ...bundle(), published: true })
        .success,
    ).toBe(false);
    const v = bundle();
    expect(
      curriculumBundleSchema.safeParse({
        ...v,
        candidates: [{ ...candidate, status: "published" }],
      }).success,
    ).toBe(false);
  });
  it("rejects official-looking foreign URLs, credentials and non-HTTPS", () => {
    for (
      const source_url of [
        "https://meb.gov.tr.evil.test/a",
        "https://meb.gov.tr@evil.test/a",
        "http://meb.gov.tr/a",
        "javascript:alert(1)",
        "https://evil.test/meb.gov.tr",
      ]
    ) {
      expect(
        curriculumBundleSchema.safeParse({
          ...bundle(),
          candidates: [{ ...candidate, source_url }],
        }).success,
      ).toBe(false);
    }
  });
  it("requires all source, count and applicability checks", () => {
    expect(curriculumReviewSchema.safeParse(review()).success).toBe(true);
    for (
      const key of ["source_checked", "counts_checked", "applicability_checked"]
    ) {
      expect(
        curriculumReviewSchema.safeParse({ ...review(), [key]: false }).success,
      ).toBe(false);
    }
    expect(
      curriculumReviewSchema.safeParse({ ...review(), school_scope: "" })
        .success,
    ).toBe(false);
  });
  it("does not turn primary practice into common written exams", () => {
    expect(
      curriculumBundleSchema.safeParse({
        ...bundle(),
        candidates: [{ ...candidate, grade: 3 }],
      }).success,
    ).toBe(false);
  });
  it("publication is a different command with confirmation and a revision", () => {
    const base = {
      request: "00000000-0000-4000-8000-000000000001",
      id: "00000000-0000-4000-8000-000000000002",
      action: "publish",
      note: "Kaynak incelendi",
      revision: 1,
      confirmed: true,
    };
    expect(curriculumCommandSchema.safeParse(base).success).toBe(true);
    expect(
      curriculumCommandSchema.safeParse({ ...base, confirmed: false }).success,
    ).toBe(false);
    expect(curriculumCommandSchema.safeParse({ ...base, revision: -1 }).success)
      .toBe(false);
  });
});
