import { describe, expect, it } from "vitest";
import fixtures from "./fixtures.json";
import {
  answerErrors, answerState, emptyAnswer, moveItem, parseNumberInput, questionContentErrors, setPair, setNumeric,
  setPlacement, setTrueFalse, categoryFull, structuredAnswerSchema, studentPayloadSchemas, fillBlankFromMarkup,
  type StructuredAnswer, type StructuredInteractionType,
} from "./index";

// Ortak örnekler: aynı fixtures.json SQL golden testini (supabase/tests/140) de üretir.
describe("shared fixtures: content validation mirrors SQL codes", () => {
  for (const c of fixtures.content) {
    it(c.name, () => {
      const errs = questionContentErrors(c.type, c.payload, c.key);
      if (c.valid) expect(errs).toEqual([]);
      else for (const e of c.errors ?? []) expect(errs).toContain(e);
    });
  }
});
describe("shared fixtures: answer validation mirrors SQL codes", () => {
  for (const a of fixtures.answers) {
    it(a.name, () => {
      const errs = answerErrors(a.type as StructuredInteractionType, a.payload, a.answer);
      if (a.valid) expect(errs).toEqual([]);
      else expect(errs).toContain(a.error);
    });
  }
});
describe("shared fixtures: answer state equals SQL answer_state (not a score)", () => {
  for (const s of fixtures.scoring) {
    it(s.name, () => {
      const answer = s.answer ? structuredAnswerSchema.parse(s.answer) : null;
      const payload = studentPayloadSchemas[s.type as StructuredInteractionType].parse(s.payload);
      expect(answerState(s.type as StructuredInteractionType, payload, answer as StructuredAnswer | null)).toBe(s.expect.answer_state);
    });
  }
});
describe("shared fixtures: number parsing equals SQL qt_parse_number", () => {
  for (const [input, value] of fixtures.numbers as [string, string | null][]) {
    it(JSON.stringify(input), () => {
      const got = parseNumberInput(input);
      if (value === null) expect(got).toBeNull();
      else expect(got).toBeCloseTo(Number(value), 10);
    });
  }
});

describe("answer helpers", () => {
  it("true/false set and clear (undo)", () => {
    let a = emptyAnswer("true_false");
    a = setTrueFalse(a, "s1", true);
    expect(a.items).toEqual({ s1: true });
    a = setTrueFalse(a, "s1", null);
    expect(a.items).toEqual({});
  });
  it("matching one-to-one swaps a used right item", () => {
    let a = emptyAnswer("matching");
    a = setPair(a, "l1", "r1", "one_to_one");
    a = setPair(a, "l2", "r1", "one_to_one");
    expect(a.pairs).toEqual({ l2: "r1" });
    a = setPair(a, "l1", "r1", "many_to_one");
    expect(a.pairs).toEqual({ l2: "r1", l1: "r1" });
    a = setPair(a, "l1", null, "many_to_one");
    expect(a.pairs).toEqual({ l2: "r1" });
  });
  it("ordering starts from displayed order and moves by index (no drag needed)", () => {
    let a = emptyAnswer("ordering", { items: [{ id: "c", text: "C" }, { id: "a", text: "A" }, { id: "b", text: "B" }], mode: "sequence" });
    expect(a.order).toEqual(["c", "a", "b"]);
    a = moveItem(a, "c", 2);
    expect(a.order).toEqual(["a", "b", "c"]);
    a = moveItem(a, "b", 0);
    expect(a.order).toEqual(["b", "a", "c"]);
  });
  it("classification capacity", () => {
    const p = { items: [{ id: "i1", text: "a" }, { id: "i2", text: "b" }], categories: [{ id: "c1", text: "X", capacity: 1 }, { id: "c2", text: "Y" }] };
    let a = setPlacement(emptyAnswer("classification"), "i1", "c1");
    expect(categoryFull(p, a, "c1")).toBe(true);
    expect(categoryFull(p, a, "c2")).toBe(false);
    a = setPlacement(a, "i1", null);
    expect(categoryFull(p, a, "c1")).toBe(false);
  });
  it("numeric clears empty value and keeps unit", () => {
    let a = setNumeric(emptyAnswer("numeric"), { value: "12,5", unit: "cm" });
    expect(a).toEqual({ type: "numeric", v: 1, value: "12,5", unit: "cm" });
    a = setNumeric(a, { value: "" });
    expect(a).toEqual({ type: "numeric", v: 1, unit: "cm" });
  });
  it("answers are keyed by stable ids: shuffled display does not change validity", () => {
    const p = { left: [{ id: "l1", text: "a" }, { id: "l2", text: "b" }], right: [{ id: "r2", text: "y" }, { id: "r1", text: "x" }], policy: "one_to_one" };
    expect(answerErrors("matching", p, { type: "matching", v: 1, pairs: { l1: "r1", l2: "r2" } })).toEqual([]);
  });
  it("fill blank markup", () => {
    const r = fillBlankFromMarkup("Türkiye'nin başkenti [[Ankara|ANKARA]] şehridir.");
    expect(r.segments.map((s) => s.type)).toEqual(["text", "blank", "text"]);
    expect(r.accepted).toEqual({ b1: ["Ankara", "ANKARA"] });
  });
});

import { AnswerJournal } from "../answer-journal";
describe("offline answer journal carries structured answers", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => void m.set(k, v), remove: (k: string) => void m.delete(k), keys: () => [...m.keys()], m };
  };
  const scope = "gina.answer-journal.v1:00000000-0000-4000-8000-000000000001:00000000-0000-4000-8000-000000000002:00000000-0000-4000-8000-000000000003:00000000-0000-4000-8000-000000000004:";
  const q = "00000000-0000-4000-8000-0000000000aa";
  it("persists, restores and sends exact structured answer; old v1 records still load", async () => {
    const store = mem();
    let n = 0;
    const j = new AnswerJournal(store, scope, () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`);
    const answer = { type: "matching" as const, v: 1 as const, pairs: { l1: "r1" } };
    j.edit(q, { answer }, 0);
    expect(j.restore()[q]).toEqual({ answer });
    let sent: unknown;
    await j.send(q, async (r) => { sent = r.answer; return 1; }, () => {});
    expect(sent).toEqual({ answer });
    expect(j.restore()).toEqual({});
    store.set(scope + q, JSON.stringify({ version: 1, revision: 2, latest: { key: "A" }, pending: null }));
    expect(j.restore()[q]).toEqual({ key: "A" });
  });
  it("rejects a malformed structured answer in local storage instead of sending it", () => {
    const store = mem();
    const j = new AnswerJournal(store, scope, () => "00000000-0000-4000-8000-000000000009");
    store.set(scope + q, JSON.stringify({ version: 1, revision: 0, latest: { answer: { type: "matching", v: 1, pairs: { l1: 5 } } }, pending: null }));
    expect(() => j.restore()).toThrow("answer_local_invalid");
  });
});
