import { describe, expect, it } from "vitest";
import {
  createLearningPlanJournal,
  type LearningPlanCommand,
  type LearningPlanContent,
  learningPlanContentSchema,
  learningPlanForDay,
  type LearningPlanRow,
} from "./learning-plan";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const content: LearningPlanContent = {
  kind: "homework",
  title: "Kesirler",
  subject: "Matematik",
  topic: "",
  planned_on: "2026-11-01",
  due_on: "2026-11-03",
  time: null,
  steps: [{ id: id(1), label: "İki örnek çöz", checked: false }],
  done: false,
  archived: false,
  source_id: null,
};
const row = (v: Partial<LearningPlanContent>): LearningPlanRow => ({
  id: id(2),
  child_id: id(3),
  revision: 1,
  content: { ...content, ...v },
  updated_at: "2026-11-01T00:00:00Z",
  done_at: null,
  source: null,
});
describe("dated learning plans", () => {
  it("keeps unfinished work visible after its due day without generating copies", () =>
    expect(learningPlanForDay([row({})], "2026-11-14")).toHaveLength(1));
  it("does not show future work or archived work", () =>
    expect(
      learningPlanForDay([
        row({ planned_on: "2026-11-15", due_on: null }),
        row({ archived: true }),
      ], "2026-11-14"),
    ).toEqual([]));
  it("does not imply a completed session repeats the next day", () =>
    expect(learningPlanForDay([row({ done: true })], "2026-11-04")).toEqual(
      [],
    ));
  it("rejects invalid dates, earlier deadlines and duplicate step identities", () => {
    for (
      const delta of [{ planned_on: "2026-02-30" }, { due_on: "2026-10-31" }, {
        time: "25:10",
      }, { steps: [content.steps[0], content.steps[0]] }]
    ) {
      expect(
        learningPlanContentSchema.safeParse({ ...content, ...delta }).success,
      ).toBe(false);
    }
  });
  it("does not require an invented deadline or reward", () =>
    expect(
      learningPlanContentSchema.safeParse({
        ...content,
        due_on: null,
        steps: [],
      }).success,
    ).toBe(true));
});
function setup() {
  const map = new Map<string, string>();
  let current = true;
  const store = {
    keys: () => [...map.keys()],
    get: (k: string) => map.get(k) ?? null,
    set: (k: string, v: string) => {
      map.set(k, v);
    },
    remove: (k: string) => {
      map.delete(k);
    },
  };
  let send = async (
    c: LearningPlanCommand,
  ): Promise<
    { data: unknown; error: { code?: string; message: string } | null }
  > => ({
    data: {
      request: c.p_request_id,
      child_id: c.p_child_id,
      id: c.p_id,
      revision: c.p_revision + 1,
    },
    error: null,
  });
  const journal = () =>
    createLearningPlanJournal({
      store,
      user: id(10),
      family: id(11),
      child: id(3),
      guard: () => {
        if (!current) throw Error("session_changed");
      },
      uuid: () => id(20),
      send: (c) => send(c),
    });
  return {
    journal,
    map,
    setSend: (v: typeof send) => {
      send = v;
    },
    logout: () => {
      current = false;
    },
  };
}
describe("learning plan durable command", () => {
  it("survives a lost response and reopening with the original id and revision", async () => {
    const s = setup(),
      j = s.journal(),
      c = j.prepare({ p_id: id(2), p_revision: 0, p_content: content });
    s.setSend(async () => {
      throw Error("offline");
    });
    await expect(j.send(c)).rejects.toThrow("offline");
    expect(s.journal().read()).toEqual(c);
    expect(() => j.prepare({ p_id: id(99), p_revision: 0, p_content: content }))
      .toThrow("plan_pending");
    s.setSend(async (v) => ({
      data: {
        request: v.p_request_id,
        child_id: v.p_child_id,
        id: v.p_id,
        revision: 1,
      },
      error: null,
    }));
    await s.journal().send(c);
    expect(j.read()).toBeNull();
  });
  it("retains an unknown or mismatched receipt", async () => {
    const s = setup(),
      j = s.journal(),
      c = j.prepare({ p_id: id(2), p_revision: 0, p_content: content });
    s.setSend(async () => ({
      data: {
        request: c.p_request_id,
        child_id: c.p_child_id,
        id: id(99),
        revision: 1,
      },
      error: null,
    }));
    await expect(j.send(c)).rejects.toThrow("plan_receipt_invalid");
    expect(j.read()).toEqual(c);
  });
  it("releases a rolled back stale revision but never silently resubmits it", async () => {
    const s = setup(),
      j = s.journal(),
      c = j.prepare({ p_id: id(2), p_revision: 0, p_content: content });
    s.setSend(async () => ({
      data: null,
      error: { code: "P0001", message: "plan_changed" },
    }));
    await expect(j.send(c)).rejects.toMatchObject({ message: "plan_changed" });
    expect(j.read()).toBeNull();
  });
  it("rejects changed commands and session changes", async () => {
    const s = setup(),
      j = s.journal(),
      c = j.prepare({ p_id: id(2), p_revision: 0, p_content: content });
    await expect(j.send({ ...c, p_id: id(99) })).rejects.toThrow(
      "plan_command_changed",
    );
    s.logout();
    expect(() => j.read()).toThrow("session_changed");
  });
});
