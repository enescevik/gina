import { describe, expect, it } from "vitest";
import { createProvaGenerationJournal } from "./prova-generation-journal";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = {
  draft_id: id(3),
  subject: "Fen",
  grade: 5,
  topic_plan: [{ topic: "Isı", count: 1 }],
  blueprint_id: null,
  count: 1,
  kind: "open_ended" as const,
  assessment: "written" as const,
  difficulty: "orta" as const,
  note: "",
  locale: "tr" as const,
};
const result = {
  ok: true as const,
  model: "test",
  prompt_version: "v1",
  remaining: 4,
  questions: [{
    id: id(9),
    topic: "Isı",
    kind: "open_ended" as const,
    difficulty: "orta" as const,
    stem: "Isı nedir?",
    choices: null,
    correct_key: null,
    expected_answer: "Enerji aktarımı",
    solution: "Açıklama",
    explanation: null,
    source_urls: [],
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
  const open = (user = id(1), draft = id(3)) =>
    createProvaGenerationJournal({
      store,
      user,
      family: id(2),
      draft,
      id: () => id(8),
      guard() {
        if (!active) throw Error("logout");
      },
    });
  return {
    data,
    open,
    store,
    logout() {
      active = false;
      data.clear();
    },
  };
}
describe("paid Prova generation recovery", () => {
  it("restores original request, keeps another parent/draft isolated", () => {
    const f = fixture(), r = f.open().prepare(input);
    expect(f.open().read()).toEqual(r);
    expect(f.open(id(5)).read()).toBeNull();
    expect(f.open(id(1), id(6)).read()).toBeNull();
  });
  it("cannot replace or locally discard uncertain paid work", () => {
    const j = fixture().open();
    j.prepare(input);
    expect(() => j.prepare(input)).toThrow("generation_pending");
    expect(() => j.release()).toThrow("generation_result_uncertain");
  });
  it("stores received questions for selection after reload without regeneration", () => {
    const f = fixture(), j = f.open(), r = j.prepare(input);
    j.complete(r, result);
    expect(f.open().read()?.result).toEqual(result);
    j.release();
    expect(j.read()).toBeNull();
  });
  it("requires matching server cancellation acknowledgement even after definite failure", () => {
    const j = fixture().open(), r = j.prepare(input);
    j.failed(r);
    expect(() => j.release()).toThrow("generation_result_uncertain");
    expect(() => j.cancel(r, { request_id: id(7), status: "cancelled" }))
      .toThrow("generation_request_changed");
    j.cancel(r, { request_id: r.request_id, status: "cancelled" });
    expect(j.read()).toBeNull();
  });
  it("does not accept malformed, missing or repeated result questions", () => {
    const j = fixture().open(), r = j.prepare(input);
    for (
      const value of [{ ...result, questions: [] }, {
        ...result,
        questions: [result.questions[0], result.questions[0]],
      }, { ...result, ok: false }]
    ) expect(() => j.complete(r, value)).toThrow();
    expect(j.read()).toEqual(r);
  });
  it("rejects wrong draft, missing document consent and count mismatch before sending", () => {
    for (
      const payload of [{ ...input, draft_id: id(6) }, {
        ...input,
        source_id: id(7),
      }, { ...input, count: 2 }]
    ) expect(() => fixture().open().prepare(payload)).toThrow();
  });
  it("storage failure prevents a new request and logout prevents late resurrection", () => {
    const f = fixture(), j = f.open();
    f.store.set = () => {
      throw Error("disk");
    };
    expect(() => j.prepare(input)).toThrow("disk");
    const g = fixture(), k = g.open(), r = k.prepare(input);
    g.logout();
    expect(() => k.complete(r, result)).toThrow("logout");
    expect(g.data.size).toBe(0);
  });
  it("cancelled request cannot be resurrected by a late result", () => {
    const j = fixture().open(), r = j.prepare(input);
    j.cancel(r, { request_id: r.request_id, status: "cancelled" });
    expect(() => j.complete(r, result)).toThrow("generation_request_changed");
  });
});
