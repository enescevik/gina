import { describe, expect, it } from "vitest";
import {
  createLearningPlanImportJournal,
  learningPlanImportViewSchema,
} from "./learning-plan-import";
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const content = {
  kind: "homework" as const,
  title: "Kesirler",
  subject: "Matematik",
  topic: "",
  planned_on: "2026-11-05",
  due_on: null,
  time: null,
  steps: [],
  done: false,
  archived: false,
  source_id: uuid(6),
};
function setup() {
  const map = new Map<string, string>();
  let mode = "lost", live = true;
  const calls: unknown[] = [];
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
  const journal = () =>
    createLearningPlanImportJournal({
      store,
      user: uuid(1),
      family: uuid(2),
      child: uuid(3),
      guard: () => {
        if (!live) throw Error("session");
      },
      uuid: () => uuid(4),
      send: async (c) => {
        calls.push(c);
        if (mode === "lost") throw Error("network");
        if (mode === "invalid") {
          return {
            data: null,
            error: { code: "P0001", message: "plan_changed" },
          };
        }
        return {
          error: null,
          data: {
            request: c.p_request_id,
            import: c.p_import_id,
            child: c.p_child_id,
            ids: c.p_items.map((i) => mode === "bad" ? uuid(99) : i.id),
          },
        };
      },
    });
  return {
    journal,
    map,
    calls,
    mode: (v: string) => {
      mode = v;
    },
    logout: () => {
      live = false;
      map.clear();
    },
    input: {
      p_import_id: uuid(5),
      p_items: [{ index: 0, id: uuid(7), content }],
    },
  };
}
describe("learning plan import command", () => {
  it("persists exact batch before network, recovers after reopening without new ids", async () => {
    const f = setup(), j = f.journal(), c = j.prepare(f.input);
    await expect(j.send(c)).rejects.toThrow("network");
    expect(f.journal().read()).toEqual(c);
    f.mode("ok");
    await f.journal().send(c);
    expect(f.calls).toEqual([c, c]);
    expect(j.read()).toBeNull();
  });
  it("cannot change selected children/items while an unresolved batch exists", () => {
    const f = setup(), j = f.journal();
    j.prepare(f.input);
    expect(() => j.prepare({ ...f.input, p_import_id: uuid(8) })).toThrow(
      "plan_pending",
    );
  });
  it("rejects duplicate source selection before any write", () => {
    const f = setup();
    expect(() =>
      f.journal().prepare({
        ...f.input,
        p_items: [...f.input.p_items, ...f.input.p_items],
      })
    ).toThrow();
    expect(f.map.size).toBe(0);
  });
  it("only confirmed SQL rejection clears pending state", async () => {
    const f = setup(), j = f.journal(), c = j.prepare(f.input);
    f.mode("invalid");
    await expect(j.send(c)).rejects.toMatchObject({ message: "plan_changed" });
    expect(j.read()).toBeNull();
  });
  it("wrong receipt keeps exact pending command", async () => {
    const f = setup(), j = f.journal(), c = j.prepare(f.input);
    f.mode("bad");
    await expect(j.send(c)).rejects.toThrow("plan_receipt_invalid");
    expect(j.read()).toEqual(c);
  });
  it("logout prevents an old editor from sending", async () => {
    const f = setup(), j = f.journal(), c = j.prepare(f.input);
    f.logout();
    await expect(j.send(c)).rejects.toThrow("session");
    expect(f.calls).toHaveLength(0);
  });
  it("unknown draft versions and malformed dates fail closed", () => {
    expect(() =>
      learningPlanImportViewSchema.parse({
        id: uuid(5),
        child_id: uuid(3),
        source_id: uuid(6),
        locale: "tr",
        grade: 5,
        status: "done",
        draft: {
          items: [{
            kind: "homework",
            title: "Title",
            subject: "",
            topic: "",
            due_on: "2026-02-30",
            time: null,
            page: 1,
            steps: [],
            note: "",
          }],
          warnings: [],
        },
        applied: {},
      })
    ).toThrow();
  });
});
