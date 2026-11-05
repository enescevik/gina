import { describe, expect, it } from "vitest";

import { readChildStarBalance, starBalance, starTotalsByChild } from "./stars";

describe("Q02-3 server star balance readers", () => {
  it("child balance matches the old client-side ledger sum", () => {
    const ledger = [{ delta: 10 }, { delta: 5 }, { delta: 3 }, { delta: -2 }];
    const rpc = { child_id: "c1", balance: 16, today: "2026-11-06", today_delta: 1 };
    expect(readChildStarBalance(rpc)).toEqual({ balance: starBalance(ledger), todayDelta: 1 });
  });

  it("missing or malformed fields read as an empty ledger", () => {
    expect(readChildStarBalance(null)).toEqual({ balance: 0, todayDelta: 0 });
    expect(readChildStarBalance({ balance: "16", today_delta: 1.5 })).toEqual({ balance: 0, todayDelta: 0 });
  });

  it("family totals keep the old Map shape; children without rows read as 0", () => {
    const totals = starTotalsByChild([
      { child_id: "a", balance: 16 },
      { child_id: "b", balance: 7 },
    ]);
    expect(totals.get("a")).toBe(16);
    expect(totals.get("b")).toBe(7);
    expect(totals.get("c") ?? 0).toBe(0);
    expect(starTotalsByChild(null).size).toBe(0);
  });
});
