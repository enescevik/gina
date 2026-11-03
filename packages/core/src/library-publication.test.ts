import { describe, it, expect } from "vitest";
import { libraryPublishCommandSchema } from "./library-publication";
const command = {
  request: "00000000-0000-4000-8000-000000000001",
  package_id: "00000000-0000-4000-8000-000000000002",
  expected_version: 0,
  review_fingerprint: "a".repeat(64),
  title: "Geometri",
  description: "Çizimli sorular",
  plans: ["plus", "pro"],
  curriculum_label: "5. sınıf Matematik 2026",
  confirmed: true,
  status: "published",
  reason: "",
};
describe("publication command", () => {
  it("requires explicit consent, nonempty distinct plans and verified revision", () => {
    expect(libraryPublishCommandSchema.safeParse(command).success).toBe(true);
    for (const patch of [
      { confirmed: false },
      { plans: [] },
      { plans: ["plus", "plus"] },
      { expected_version: -1 },
      { review_fingerprint: "stale" },
      { curriculum_label: "" },
    ])
      expect(
        libraryPublishCommandSchema.safeParse({ ...command, ...patch }).success,
      ).toBe(false);
  });
  it("requires a meaningful withdrawal reason and rejects hidden payload fields", () => {
    expect(
      libraryPublishCommandSchema.safeParse({ ...command, status: "archived" })
        .success,
    ).toBe(false);
    expect(
      libraryPublishCommandSchema.safeParse({
        ...command,
        status: "archived",
        reason: "Kaynak düzeltmesi",
      }).success,
    ).toBe(true);
    expect(
      libraryPublishCommandSchema.safeParse({ ...command, actor_id: "spoof" })
        .success,
    ).toBe(false);
  });
});
