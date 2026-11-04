import { describe, expect, it } from "vitest";
import {
  appendProvaBlocks,
  moveProvaBlock,
  newProvaDraft,
  provaGenerationKind,
  type ProvaBlock,
  provaDraftSchema,
} from "./prova-draft";
const q = (n: number, kind: "group" | "question" = "question"): ProvaBlock => ({
  kind,
  id: `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  source: "library",
});
describe("one Prova from multiple sources", () => {
  it("keeps written AI generation consistent for new and previously saved mixed drafts", () => {
    expect(newProvaDraft().kind).toBe("open_ended");
    const saved = { ...newProvaDraft(), kind: "mixed" as const };
    expect(provaGenerationKind(saved)).toBe("open_ended");
    expect(saved.kind).toBe("mixed");
    expect(provaGenerationKind({ purpose: "practice", kind: "multiple_choice" })).toBe("multiple_choice");
    expect(provaGenerationKind({ purpose: "trial", kind: "mixed" })).toBe("mixed");
  });
  it("appending returned selections preserves previous blocks and deduplicates retries", () => {
    const d = { ...newProvaDraft(), blocks: [q(1), q(2, "group")] };
    expect(appendProvaBlocks(d, [q(1), q(3), q(3)]).blocks).toEqual([
      q(1),
      q(2, "group"),
      q(3),
    ]);
    expect(d.blocks).toHaveLength(2);
  });
  it("moves an entire shared group and protects list boundaries", () => {
    const b = [q(1), q(2, "group"), q(3)];
    expect(moveProvaBlock(b, 1, 1)).toEqual([q(1), q(3), q(2, "group")]);
    expect(moveProvaBlock(b, 0, -1)).toBe(b);
  });
  it("never guesses a missing child grade", () => {
    expect(newProvaDraft().grade).toBeNull();
  });
  it("rejects oversized, duplicate and malformed persisted content", () => {
    const d = newProvaDraft();
    expect(provaDraftSchema.safeParse(d).success).toBe(true);
    for (
      const v of [
        { ...d, target: 0 },
        { ...d, grade: 13 },
        { ...d, blocks: [q(1), q(1)] },
        { ...d, minutes: 181 },
        { ...d, note: "x".repeat(1501) },
      ]
    ) expect(provaDraftSchema.safeParse(v).success).toBe(false);
  });
});
