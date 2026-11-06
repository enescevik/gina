import { describe, expect, it } from "vitest";
import { newProvaDraft, provaDraftSchema } from "./prova-draft";
import { createProvaGenerationJournal } from "./prova-generation-journal";
import {
  type ProvaAiUnit,
  normalizeProvaLabel,
  provaAiUnits,
  provaQuestionPeriodIssues,
  readProvaQuestionFit,
  setProvaFitAccepted,
} from "./prova-question-fit";

const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("D1 question-level period fit", () => {
  it("flags only a known tag against a known draft value", () => {
    expect(provaQuestionPeriodIssues({ term: 1, program: "Maarif" }, { term: 2, program: "Maarif" })).toEqual(["term"]);
    expect(provaQuestionPeriodIssues({ term: 1, program: "Maarif" }, { term: null, program: "Eski program" })).toEqual(["program"]);
    expect(provaQuestionPeriodIssues({ term: null, program: null }, { term: 2, program: "X" })).toEqual([]);
    expect(provaQuestionPeriodIssues({ term: 1, program: "Maarif" }, { term: null, program: null })).toEqual([]);
    expect(provaQuestionPeriodIssues(undefined, { term: 2, program: null })).toEqual([]);
  });
  it("normalizes like the server (Turkish letters, case, punctuation, 'dersi')", () => {
    expect(normalizeProvaLabel("MAARİF")).toBe("maarif");
    expect(normalizeProvaLabel("Türkçe Dersi")).toBe("turkce");
    expect(provaQuestionPeriodIssues({ term: 1, program: "Maarif" }, { term: 1, program: "MAARİF" })).toEqual([]);
  });
  it("acceptance is explicit, unique and removable; drafts stay schema-valid", () => {
    const d = { ...newProvaDraft(), blocks: [] };
    const a = setProvaFitAccepted(d, [id(2), id(1), id(1)], true);
    expect(a.fitAccepted).toEqual([id(1), id(2)]);
    expect(provaDraftSchema.parse(a).fitAccepted).toEqual([id(1), id(2)]);
    const b = setProvaFitAccepted(a, [id(1), id(2)], false);
    expect("fitAccepted" in b).toBe(false);
    expect(() => provaDraftSchema.parse({ ...d, fitAccepted: ["x"] })).toThrow();
  });
  it("reads the server fit payload", () => {
    const fit = readProvaQuestionFit({
      child_id: "20000000-0000-4000-8000-000000012101",
      subjects: [{ alias_normalized: "fenbilimleri", title: "Fen Bilimleri", subject_id: "subject-science", label_tr: "Fen Bilimleri", label_en: "Science", active: true }],
      questions: [{ question_id: id(1), subject: "Fen Bilimleri", subject_id: "subject-science", subject_label_tr: "Fen Bilimleri", subject_label_en: "Science", term: 2, program: null, period_source: "parent" }],
    });
    expect(fit.questions[0]?.subject_id).toBe("subject-science");
    expect(() => readProvaQuestionFit({ child_id: "x", subjects: [], questions: [] })).toThrow();
  });
});

describe("D1 AI shared-source units", () => {
  const base = { topic: "Bitkiler", kind: "open_ended" as const, difficulty: "orta" as const, choices: null, correct_key: null, expected_answer: "x", solution: "y", explanation: null, source_urls: [] };
  const result = {
    ok: true as const, model: "m", prompt_version: "v6", remaining: 3,
    questions: [
      { ...base, id: id(1), stem: "Ortak metin\nP\n\nBir", group_id: id(9), prompt: "Bir", position: 1 },
      { ...base, id: id(2), stem: "Bağımsız" },
      { ...base, id: id(3), stem: "Ortak metin\nP\n\nİki", group_id: id(9), prompt: "İki", position: 2 },
    ],
    groups: [{ id: id(9), title: "Ortak metin", body: "P", kind: "text", question_ids: [id(1), id(3)] }],
  };
  it("a group is one unit with the passage once and member prompts; others stay single", () => {
    const units: ProvaAiUnit[] = provaAiUnits(result);
    expect(units.map((u) => u.kind)).toEqual(["group", "question"]);
    const g = units[0];
    if (!g || g.kind !== "group") throw Error("group expected");
    expect(g.body).toBe("P");
    expect(g.questions.map((q) => q.stem)).toEqual(["Bir", "İki"]);
    expect(g.questions.length).toBe(2);
  });
  it("old results without groups are unchanged single questions", () => {
    const { groups: _g, ...legacy } = result;
    const units = provaAiUnits({
      ...legacy,
      questions: legacy.questions.map((q) => ({ ...base, id: q.id, stem: q.stem })),
    });
    expect(units.every((u) => u.kind === "question")).toBe(true);
    expect(units.length).toBe(3);
  });
  it("journal keeps the group data of a completed generation", () => {
    const store = new Map<string, string>();
    const journal = createProvaGenerationJournal({
      store: { get: (k) => store.get(k) ?? null, set: (k, v) => void store.set(k, v), remove: (k) => void store.delete(k), keys: () => [...store.keys()] },
      user: "00000000-0000-4000-8000-000000012101", family: "10000000-0000-4000-8000-000000012101", draft: "50000000-0000-4000-8000-000000012101",
      id: () => "60000000-0000-4000-8000-000000012101", guard: () => {},
    });
    const r = journal.prepare({ draft_id: "50000000-0000-4000-8000-000000012101", subject: "Fen", grade: 6, topic_plan: [{ topic: "Bitkiler", count: 3 }], blueprint_id: null, count: 3, kind: "open_ended", assessment: "practice", difficulty: "orta", note: "", locale: "tr" });
    const done = journal.complete(r, result);
    expect(done.result?.groups?.[0]?.question_ids).toEqual([id(1), id(3)]);
    expect(provaAiUnits(journal.read()?.result)[0]?.kind).toBe("group");
  });
});
