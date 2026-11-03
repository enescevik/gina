import { describe, expect, it } from "vitest";
import { createSetupAiJournal } from "./setup-ai-journal";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const payload = {
  kind: "task" as const,
  grade: 0,
  age_band: "2-5" as const,
  interests: [],
  locale: "tr" as const,
  source_id: id(8),
  source_ai_consent: true as const,
};
const result = {
  suggestions: [{
    title: "Birlikte oku",
    reason: "Belgedeki etkinlik",
    icon: "read-book",
    stars: 1,
    source_id: id(8),
  }],
};
function fixture() {
  const data = new Map<string, string>();
  let active = true;
  const store = {
    get: (k: string) => data.get(k) ?? null,
    set: (k: string, v: string) => {
      data.set(k, v);
    },
    remove: (k: string) => {
      data.delete(k);
    },
    keys: () => [...data.keys()],
  };
  const open = (user = id(1), context = "child1") =>
    createSetupAiJournal({
      store,
      user,
      family: id(2),
      kind: "task",
      context,
      id: () => id(9),
      guard: () => {
        if (!active) throw Error("logout");
      },
    });
  return {
    open,
    data,
    store,
    logout: () => {
      active = false;
      data.clear();
    },
  };
}
describe("setup AI recovery", () => {
  it("restores exact request and consent after reload without raw document bytes", () => {
    const f = fixture();
    const c = f.open().prepare(payload, "Plan.pdf");
    expect(f.open().read()).toEqual(c);
    expect(() => f.open().prepare(payload)).toThrow("setup_pending");
    expect(Object.keys(c)).toEqual(["request_id", "payload", "name"]);
  });
  it("recovers completed suggestions for selection without another generation", () => {
    const f = fixture(), j = f.open(), c = j.prepare(payload);
    j.complete(c, result);
    expect(f.open().read()?.result).toEqual(result);
  });
  it("isolates parents and child contexts", () => {
    const f = fixture();
    f.open().prepare(payload);
    expect(f.open(id(3)).read()).toBeNull();
    expect(f.open(id(1), "child2").read()).toBeNull();
  });
  it("stops if storage is unavailable, consent missing or data malformed", () => {
    const f = fixture();
    expect(() => f.open().prepare({ ...payload, source_ai_consent: undefined }))
      .toThrow();
    f.store.set = () => {
      throw Error("disk");
    };
    expect(() => f.open().prepare(payload)).toThrow("disk");
    expect(f.data.size).toBe(0);
  });
  it("does not resurrect a cancelled or logged-out job from a late response", () => {
    const f = fixture(), j = f.open(), c = j.prepare(payload);
    j.discard();
    expect(() => j.complete(c, result)).toThrow("setup_command_changed");
    const next = j.prepare(payload);
    f.logout();
    expect(() => j.complete(next, result)).toThrow("logout");
    expect(f.data.size).toBe(0);
  });
  it("rejects mismatched source identity and changed request payload", () => {
    const f = fixture(), j = f.open(), c = j.prepare(payload);
    expect(() =>
      j.complete(c, {
        suggestions: [{ ...result.suggestions[0]!, source_id: id(10) }],
      })
    ).toThrow("setup_source_changed");
    expect(() =>
      j.complete({ ...c, payload: { ...payload, grade: 5 } }, result)
    ).toThrow("setup_command_changed");
  });
});
