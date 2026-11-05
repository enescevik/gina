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

import {
  curriculumSourceFetchTargetSchema,
  curriculumSourceFreshnessSchema,
  curriculumSourceReviewCommandSchema,
  curriculumSourceRowSchema,
} from "./curriculum-review";
describe("source acquisition contracts", () => {
  const revision = {
    id: "00000000-0000-4000-8000-000000000011",
    sha256: "b".repeat(64),
    bytes: 23454,
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    resolved_url: "https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/ilkmat2.xlsx",
    redirect_chain: [{ url: "https://meb.ai/ankmeb3", status: 302 }],
    inspection: { entries: 12, flags: [] },
    retrieved_at: "2026-11-05T20:26:33Z",
    last_checked_at: "2026-11-05T20:26:33Z",
    status: "diff_review_required",
    extraction_status: "queued",
    review_note: null,
    reviewed_at: null,
    candidates: 0,
    published_candidates: 0,
  };
  const row = {
    id: "00000000-0000-4000-8000-000000000010",
    source_key: "oyss:2026-2027:1:matematik",
    exam_family: "oyss",
    school_year: "2026-2027",
    term: 1,
    label: "İlköğretim Matematik",
    index_url: "https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724",
    link_url: "https://meb.ai/ankmeb3",
    freshness: "diff_review_required",
    last_checked_at: "2026-11-05T20:26:33Z",
    last_check_error: null,
    index_published_on: "2026-09-07",
    index_updated_on: "2026-09-10",
    approved: { revision_id: "00000000-0000-4000-8000-000000000012", sha256: "a".repeat(64), retrieved_at: "2026-11-03T00:00:00Z", last_checked_at: "2026-11-05T20:26:33Z" },
    revisions: [revision],
  };
  it("admin queue rows keep approved copy and pending revisions apart", () => {
    const parsed = curriculumSourceRowSchema.parse(row);
    expect(parsed.approved?.sha256).not.toBe(parsed.revisions[0]?.sha256);
    expect(curriculumSourceRowSchema.safeParse({ ...row, freshness: "approved" }).success).toBe(false);
    expect(curriculumSourceRowSchema.safeParse({ ...row, exam_family: "lgs" }).success).toBe(false);
  });
  it("parent freshness never claims official verification and names the fallback", () => {
    expect(curriculumSourceFreshnessSchema.parse({ status: "unpublished", alternative: "free_study", officially_verified: false }).alternative).toBe("free_study");
    expect(curriculumSourceFreshnessSchema.safeParse({ status: "verified", officially_verified: true }).success).toBe(false);
    expect(curriculumSourceFreshnessSchema.safeParse({ status: "approved", officially_verified: false }).success).toBe(false);
    expect(curriculumSourceFreshnessSchema.parse({ status: "unverified", last_approved_retrieved_at: "2026-11-03T00:00:00Z", last_approved_sha256: "a".repeat(64), alternative: null, officially_verified: false }).status).toBe("unverified");
  });
  it("source review needs an explicit confirmed note; fetch target cannot guess scope", () => {
    const base = { request: "00000000-0000-4000-8000-000000000001", revision_id: "00000000-0000-4000-8000-000000000011", action: "approve", note: "Hash manifest ile aynı", confirmed: true };
    expect(curriculumSourceReviewCommandSchema.safeParse(base).success).toBe(true);
    expect(curriculumSourceReviewCommandSchema.safeParse({ ...base, confirmed: false }).success).toBe(false);
    expect(curriculumSourceReviewCommandSchema.safeParse({ ...base, action: "publish" }).success).toBe(false);
    const target = { exam_family: "oyss", school_year: "2026-2027", term: 1, subject: "Matematik", grade: 5 };
    expect(curriculumSourceFetchTargetSchema.safeParse(target).success).toBe(true);
    expect(curriculumSourceFetchTargetSchema.safeParse({ ...target, school_year: "2026-2028" }).success).toBe(false);
    expect(curriculumSourceFetchTargetSchema.safeParse({ ...target, link_url: "http://meb.ai/x" }).success).toBe(false);
    expect(curriculumSourceFetchTargetSchema.safeParse({ ...target, approved: true }).success).toBe(false);
  });
});
