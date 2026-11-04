import { describe, expect, it } from "vitest";
import { weeklyReviewSchema } from "./weekly-review";
const fixture = () => ({
  week_start: "2026-10-26",
  weeks: [
    "2026-10-26",
    "2026-10-19",
    "2026-10-12",
    "2026-10-05",
    "2026-09-28",
    "2026-09-21",
    "2026-09-14",
    "2026-09-07",
  ],
  timezone: "Europe/Istanbul",
  state: "ready",
  snapshot_at: "2026-11-02T10:00:00Z",
  children: [{
    alias: "Çocuk A",
    name: "Ece",
    grade: 2,
    stars_earned: 4,
    tasks: [{ status: "approved", count: 2 }],
  }],
  summary: {
    haftanin_ozeti: "Kayıtlı iki görev onaylandı.",
    cocuk_basina: [{
      etiket: "Çocuk A",
      basarilar: ["İki görev onaylandı."],
      zorlananlar: [],
      oneri: "Birlikte küçük bir adım seçebilirsiniz.",
    }],
    veliye_oneriler: [],
  },
  remaining: 3,
  can_generate: false,
  access: "available",
});
describe("weekly family view boundary", () => {
  it("accepts a saved snapshot with no next generation", () =>
    expect(weeklyReviewSchema.parse(fixture()).state).toBe("ready"));
  it("does not guess identities for legacy contexts", () => {
    const v = fixture();
    return expect(
      weeklyReviewSchema.parse({
        ...v,
        children: [{ ...v.children[0]!, name: null }],
      }).children[0]!.name,
    ).toBeNull();
  });
  it("rejects another child alias", () => {
    const v = fixture();
    v.summary.cocuk_basina[0]!.etiket = "Çocuk B";
    expect(weeklyReviewSchema.safeParse(v).success).toBe(false);
  });
  it("rejects duplicate output aliases", () => {
    const v = fixture();
    v.summary.cocuk_basina.push(v.summary.cocuk_basina[0]!);
    expect(weeklyReviewSchema.safeParse(v).success).toBe(false);
  });
  it("rejects a missing child assessment", () => {
    const v = fixture();
    v.summary.cocuk_basina = [];
    expect(weeklyReviewSchema.safeParse(v).success).toBe(false);
  });
  it("never shows stale output for an uncertain request", () =>
    expect(
      weeklyReviewSchema.safeParse({ ...fixture(), state: "uncertain" })
        .success,
    ).toBe(false));
  it("rejects contradictory quota/ready generation permissions", () => {
    for (
      const v of [{ ...fixture(), can_generate: true }, {
        ...fixture(),
        state: "empty",
        summary: null,
        can_generate: true,
        remaining: 0,
      }]
    ) expect(weeklyReviewSchema.safeParse(v).success).toBe(false);
  });
  it("does not require an active subscription to read saved output", () =>
    expect(
      weeklyReviewSchema.safeParse({
        ...fixture(),
        access: "disabled",
        remaining: 0,
      }).success,
    ).toBe(true));
  it("rejects out-of-range selected week", () =>
    expect(
      weeklyReviewSchema.safeParse({ ...fixture(), week_start: "2026-11-02" })
        .success,
    ).toBe(false));
  it("allows a verified empty week without manufacturing output", () =>
    expect(
      weeklyReviewSchema.safeParse({
        ...fixture(),
        state: "empty",
        summary: null,
        can_generate: true,
      }).success,
    ).toBe(true));
  it("rejects private provider details accidentally sent to the client", () =>
    expect(
      weeklyReviewSchema.safeParse({
        ...fixture(),
        config: { apiKey: "synthetic" },
      }).success,
    ).toBe(false));
});
