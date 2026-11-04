import { describe, expect, it } from "vitest";
import {
  cohortReviewCommandSchema,
  createCohortAppealJournal,
  validCohortPoints,
} from "./cohort-review";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const command = {
  p_request: id(1),
  p_group: id(2),
  p_child: id(3),
  p_ord: 4,
  p_review_revision: 1,
  p_reason: "Please check the explanation.",
};
function fixture() {
  const rows = new Map<string, string>();
  let active = true;
  let send = async () => ({
    data: { entry: id(9), ord: 4, revision: 1, status: "open" } as unknown,
    error: null as { code?: string; message: string } | null,
  });
  const store = {
    get: (k: string) => rows.get(k) ?? null,
    set: (k: string, v: string) => {
      rows.set(k, v);
    },
    remove: (k: string) => {
      rows.delete(k);
    },
    keys: () => [...rows.keys()],
  };
  const open = (user = id(5), family = id(6)) =>
    createCohortAppealJournal({
      store,
      user,
      family,
      guard() {
        if (!active) throw Error("logout");
      },
      send: () => send(),
    });
  return {
    rows,
    open,
    setSend: (fn: typeof send) => {
      send = fn;
    },
    logout: () => {
      active = false;
      rows.clear();
    },
  };
}
describe("cohort review", () => {
  it("requires exact rubric keys and bounded integer points", () => {
    const c = [{ id: "a", criterion: "Explain", points: 2 }, {
      id: "b",
      criterion: "Check",
      points: 1,
    }];
    expect(validCohortPoints(c, { a: 2, b: 1 }, "scored")).toBe(true);
    for (
      const p of ([{ a: 3, b: 0 }, { a: 1.5, b: 1 }, { a: 1 }, {
        a: 1,
        b: 1,
        c: 0,
      }] as Record<string, number>[])
    ) expect(validCohortPoints(c, p, "scored")).toBe(false);
    expect(validCohortPoints(c, { a: 1, b: 0 }, "unreadable")).toBe(false);
    expect(validCohortPoints(c, { a: 0, b: 0 }, "not_answered")).toBe(true);
  });
  it("rejects forged or incomplete review commands", () => {
    const c = {
      action: "review",
      request: id(1),
      entry: id(2),
      ord: 1,
      revision: 0,
      hash: "a".repeat(64),
      points: { c1: 1 },
      outcome: "scored",
      feedback: "Evidence is present.",
      appealRevision: null,
      response: null,
    };
    expect(cohortReviewCommandSchema.safeParse(c).success).toBe(true);
    for (
      const change of [
        { revision: -1 },
        { ord: 0 },
        { hash: "bad" },
        { family_id: id(4) },
        { points: { c1: -1 } },
        { outcome: "published" },
      ]
    ) {
      expect(cohortReviewCommandSchema.safeParse({ ...c, ...change }).success)
        .toBe(false);
    }
  });
  it("preserves original appeal after lost reply and reload", async () => {
    const f = fixture(), j = f.open(), c = j.prepare(command);
    f.setSend(async () => {
      throw Error("network");
    });
    await expect(j.send(c)).rejects.toThrow("network");
    expect(f.open().read()).toEqual(c);
    expect(f.open(id(7)).read()).toBeNull();
    expect(f.open(id(5), id(8)).read()).toBeNull();
    f.setSend(async () => ({
      data: { entry: id(9), ord: 4, revision: 1, status: "open" },
      error: null,
    }));
    await f.open().send(c);
    expect(j.read()).toBeNull();
  });
  it("does not replace a pending question or reason", async () => {
    const f = fixture(), j = f.open(), c = j.prepare(command);
    expect(() => j.prepare({ ...command, p_request: id(8) })).toThrow(
      "cohort_appeal_pending",
    );
    await expect(j.send({ ...c, p_ord: 2 })).rejects.toThrow(
      "cohort_appeal_changed",
    );
    expect(j.read()).toEqual(c);
  });
  it("retains malformed or uncertain acknowledgements", async () => {
    const f = fixture(), j = f.open(), c = j.prepare(command);
    for (
      const data of [null, {
        entry: id(9),
        ord: 3,
        revision: 1,
        status: "open",
      }, { entry: id(9), ord: 4, revision: 1, status: "resolved" }]
    ) {
      f.setSend(async () => ({ data, error: null }));
      await expect(j.send(c)).rejects.toThrow();
      expect(j.read()).toEqual(c);
    }
  });
  it("definitive revision rejection releases old command", async () => {
    const f = fixture(), j = f.open(), c = j.prepare(command);
    f.setSend(async () => ({
      data: null,
      error: { code: "P0001", message: "group_review_changed" },
    }));
    await expect(j.send(c)).rejects.toMatchObject({
      message: "group_review_changed",
    });
    expect(j.read()).toBeNull();
  });
  it("logout cannot resurrect an in-flight appeal", async () => {
    const f = fixture(), j = f.open(), c = j.prepare(command);
    f.setSend(async () => {
      f.logout();
      return {
        data: { entry: id(9), ord: 4, revision: 1, status: "open" },
        error: null,
      };
    });
    await expect(j.send(c)).rejects.toThrow("logout");
    expect(f.rows.size).toBe(0);
  });
});
