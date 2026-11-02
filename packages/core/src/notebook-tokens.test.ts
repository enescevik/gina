import { describe, expect, it } from "vitest";
import { notebookTokens } from "./notebook-tokens";

describe("values copied from shared question content", () => {
  it("keeps metre and area units whole", () => {
    expect(
      notebookTokens("Bahçe: 8 m, 6 m; alan 48 m², 600 cm², 8 mm, 2,5 km."),
    )
      .toEqual(["8 m", "6 m", "48 m²", "600 cm²", "8 mm", "2,5 km"]);
  });
  it("does not turn words beginning with m into measurements", () => {
    expect(notebookTokens("8 mart, 6 masa; 3 çocuk bahçeye geldi.")).toEqual(
      [],
    );
  });
  it("preserves segment and angle notation without inventing values", () => {
    expect(notebookTokens("|AB| = 6 cm, ∠A 35°, |CD|, √9; 35°"))
      .toEqual(["|AB| = 6 cm", "∠A", "35°", "|CD|", "√9"]);
  });
});
