import { describe, expect, it } from "vitest";
import {
  addRow,
  authorGuidance,
  blockedForTrack,
  buildStructuredContent,
  moveRow,
  newStructuredDraft,
  reconcileBlanks,
  removeRow,
  structuredDraftErrors,
  structuredSaveErrorCodes,
  unsupportedTypesForChild,
  type StructuredDraft,
} from "./question-authoring";
import { questionContentErrors, STRUCTURED_INTERACTION_TYPES } from "./question-types";

const tf = (): StructuredDraft => ({
  type: "true_false",
  seq: 3,
  statements: [
    { id: "s1", text: "Güneş bir yıldızdır.", answer: true },
    { id: "s2", text: "Ay kendi ışığını üretir.", answer: false },
    { id: "s3", text: "Dünya Güneş'in çevresinde döner.", answer: true },
  ],
});

describe("authoring drafts build valid server payloads", () => {
  it("every empty draft is invalid with server codes, never throws", () => {
    for (const type of STRUCTURED_INTERACTION_TYPES) {
      const d = newStructuredDraft(type);
      expect(structuredDraftErrors(d).length).toBeGreaterThan(0);
    }
  });
  it("true/false: ids stable when reordered; key follows ids", () => {
    const d = tf();
    const moved = { ...d, statements: moveRow((d as Extract<StructuredDraft, { type: "true_false" }>).statements, 0, 1) } as StructuredDraft;
    const { payload, answer_key } = buildStructuredContent(moved);
    expect((payload.statements as { id: string }[]).map((s) => s.id)).toEqual(["s2", "s1", "s3"]);
    expect(answer_key).toEqual({ answers: { s1: true, s2: false, s3: true } });
    expect(structuredDraftErrors(moved)).toEqual([]);
  });
  it("true/false: added row gets a fresh id even after a delete; missing answer = key_missing_id", () => {
    let d = removeRow(tf(), "s3");
    d = addRow(d);
    const ids = (d as Extract<StructuredDraft, { type: "true_false" }>).statements.map((s) => s.id);
    expect(ids).toEqual(["s1", "s2", "s4"]);
    expect(structuredDraftErrors(d)).toEqual(["row_empty", "statements_invalid"]);
    const filled = { ...d, statements: (d as Extract<StructuredDraft, { type: "true_false" }>).statements.map((s) => ({ ...s, text: s.text || "Su 100 derecede kaynar." })) } as StructuredDraft;
    expect(structuredDraftErrors(filled)).toEqual(["key_missing_id"]);
  });
  it("fill blank (bank): one token per blank + distractors; ids survive an inserted blank", () => {
    let d = newStructuredDraft("fill_blank") as Extract<StructuredDraft, { type: "fill_blank" }>;
    d = reconcileBlanks(d, "Su donunca [[katı]] olur.");
    expect(d.blanks).toEqual([{ id: "b1", raw: "katı" }]);
    d = reconcileBlanks(d, "Su [[0]] derecede donunca [[katı]] olur.");
    expect(d.blanks.map((b) => b.id)).toEqual(["b2", "b1"]);
    d = { ...(addRow(d) as typeof d) };
    d.distractors = [{ id: d.distractors[0]!.id, text: "buhar" }];
    const { payload, answer_key } = buildStructuredContent(d);
    expect(payload.bank).toEqual([{ id: "wb2", text: "0" }, { id: "wb1", text: "katı" }, { id: "d3", text: "buhar" }]);
    expect(answer_key).toEqual({ blanks: { b2: { tokens: ["wb2"] }, b1: { tokens: ["wb1"] } } });
    expect(questionContentErrors("fill_blank", payload, answer_key)).toEqual([]);
  });
  it("fill blank: editing an answer in place keeps its id", () => {
    let d = newStructuredDraft("fill_blank") as Extract<StructuredDraft, { type: "fill_blank" }>;
    d = reconcileBlanks(d, "[[Ankra]] başkenttir.");
    d = reconcileBlanks(d, "[[Ankara|ankara]] başkenttir.");
    expect(d.blanks).toEqual([{ id: "b1", raw: "Ankara|ankara" }]);
    d = { ...d, input: "keyboard", caseInsensitive: true };
    const c = buildStructuredContent(d);
    expect(c.answer_key).toEqual({ blanks: { b1: { accepted: ["Ankara", "ankara"] } }, case_insensitive: true });
    expect(structuredDraftErrors(d)).toEqual([]);
  });
  it("fill blank: an empty [[ ]] is reported, no blanks = segments_invalid", () => {
    let d = newStructuredDraft("fill_blank") as Extract<StructuredDraft, { type: "fill_blank" }>;
    d = reconcileBlanks(d, "Boş [[ ]] var.");
    expect(structuredDraftErrors(d)).toContain("blank_empty");
    d = reconcileBlanks(d, "Hiç boşluk yok.");
    expect(structuredDraftErrors(d)).toContain("segments_invalid");
  });
  it("matching: distractor on the right, one_to_one duplicate is refused", () => {
    const d: StructuredDraft = {
      type: "matching", seq: 6, policy: "one_to_one",
      left: [{ id: "l1", text: "Kalp" }, { id: "l2", text: "Akciğer" }],
      right: [{ id: "r1", text: "Kan pompalar" }, { id: "r2", text: "Solunum" }, { id: "r3", text: "Görme" }],
      pairs: { l1: "r1", l2: "r2" },
    };
    expect(structuredDraftErrors(d)).toEqual([]);
    expect(structuredDraftErrors({ ...d, pairs: { l1: "r1", l2: "r1" } })).toContain("key_not_one_to_one");
    expect(structuredDraftErrors({ ...d, policy: "many_to_one", pairs: { l1: "r1", l2: "r1" } })).toEqual([]);
    const removed = removeRow(d, "r1");
    expect((removed as typeof d).pairs).toEqual({ l2: "r2" });
  });
  it("numeric: units, conversion, tolerances, unit weight, process", () => {
    const d: StructuredDraft = {
      type: "numeric", seq: 2, value: "150", units: [{ id: "u1", text: "cm" }, { id: "u2", text: "m" }], unitRequired: true, unit: "u1",
      factors: { u2: "100" }, absTolerance: "0,5", relTolerancePct: "", unitWeightPct: "25", processRequired: true, workArea: true,
    };
    const c = buildStructuredContent(d);
    expect(c.payload).toEqual({ units: [{ id: "u1", text: "cm" }, { id: "u2", text: "m" }], unit_required: true, work_area: true });
    expect(c.answer_key).toEqual({ value: "150", unit: "u1", unit_factors: { u1: 1, u2: 100 }, abs_tolerance: 0.5, unit_weight: 0.25, process_required: true });
    expect(structuredDraftErrors(d)).toEqual([]);
    expect(structuredDraftErrors({ ...d, unitWeightPct: "80" })).toContain("tolerance_invalid");
    expect(structuredDraftErrors({ ...d, unit: null })).toContain("key_unit_invalid");
    expect(structuredDraftErrors({ ...d, value: "2+3" })).toContain("key_value_invalid");
    const plain = { ...d, unitRequired: false, unit: null, factors: {}, unitWeightPct: "" } as StructuredDraft;
    expect(buildStructuredContent(plain).payload).toEqual({ units: [], unit_required: false, work_area: true });
    expect(structuredDraftErrors(plain)).toEqual([]);
  });
  it("ordering: up to 5 accepted orders, duplicates refused, new item appended to alternatives", () => {
    let d: StructuredDraft = { type: "ordering", seq: 3, mode: "sentence", items: [{ id: "o1", text: "Ben" }, { id: "o2", text: "okula" }, { id: "o3", text: "gidiyorum" }], alternatives: [["o2", "o1", "o3"]] };
    expect(structuredDraftErrors(d)).toEqual([]);
    expect(structuredDraftErrors({ ...d, alternatives: [["o1", "o2", "o3"]] })).toContain("order_duplicate");
    d = addRow(d);
    expect((d as Extract<StructuredDraft, { type: "ordering" }>).alternatives).toEqual([["o2", "o1", "o3", "o4"]]);
    const many = { ...d, alternatives: [1, 2, 3, 4, 5].map(() => ["o1"]) } as StructuredDraft;
    expect(structuredDraftErrors(many)).toContain("orders_too_many");
  });
  it("classification: capacity optional, exceeded capacity reported", () => {
    const d: StructuredDraft = {
      type: "classification", seq: 4,
      categories: [{ id: "c1", text: "Hayvan", capacity: "1" }, { id: "c2", text: "Bitki", capacity: "" }],
      items: [{ id: "i1", text: "Kedi", category: "c1" }, { id: "i2", text: "Gül", category: "c2" }],
    };
    expect(buildStructuredContent(d).payload.categories).toEqual([{ id: "c1", text: "Hayvan", capacity: 1 }, { id: "c2", text: "Bitki" }]);
    expect(structuredDraftErrors(d)).toEqual([]);
    const over = { ...d, items: d.items.map((i) => ({ ...i, category: "c1" })) } as StructuredDraft;
    expect(structuredDraftErrors(over)).toContain("capacity_exceeded");
    expect((removeRow(d, "c1") as typeof d).items[0]!.category).toBeNull();
  });
});

describe("guidance, server errors, track and device support", () => {
  it("guidance is advisory only", () => {
    const d = tf() as Extract<StructuredDraft, { type: "true_false" }>;
    expect(authorGuidance(d)).toEqual([]);
    expect(authorGuidance({ ...d, statements: d.statements.slice(0, 2) })).toContain("tf_count");
    expect(authorGuidance({ ...d, statements: [{ id: "s1", text: "Kedi memelidir ve uçar.", answer: false }] })).toContain("tf_single_judgement");
    let f = newStructuredDraft("fill_blank") as Extract<StructuredDraft, { type: "fill_blank" }>;
    f = reconcileBlanks(f, "[[a]] [[b]] [[c]] [[d]]");
    expect(authorGuidance(f)).toContain("fill_typing_suggest");
    expect(structuredDraftErrors(f)).toEqual([]);
  });
  it("server DETAIL codes are split", () => {
    expect(structuredSaveErrorCodes({ message: "question_structure_invalid", details: "key_missing_id,weights_invalid" })).toEqual(["key_missing_id", "weights_invalid"]);
    expect(structuredSaveErrorCodes({ message: "question_points_invalid", details: null })).toEqual(["question_points_invalid"]);
    expect(structuredSaveErrorCodes(null)).toEqual([]);
  });
  it("meb_common blocks practice-only types, numeric stays allowed", () => {
    expect(blockedForTrack("meb_common", ["true_false", "numeric", null, "matching", "true_false"])).toEqual(["true_false", "matching"]);
    expect(blockedForTrack("free", ["true_false"])).toEqual([]);
  });
  it("device support is a warning list", () => {
    const dev = (types: string[] | null) => ({ device_id: "d", name: "iPad", question_types: types, reported_at: null });
    expect(unsupportedTypesForChild([], ["numeric"])).toEqual({ missing: ["numeric"], noDevice: true });
    expect(unsupportedTypesForChild([dev(null)], ["numeric", "matching"])).toEqual({ missing: ["numeric", "matching"], noDevice: false });
    expect(unsupportedTypesForChild([dev(["numeric"]), dev(["matching"])], ["numeric", "matching"]).missing).toEqual(["numeric", "matching"]);
    expect(unsupportedTypesForChild([dev(["numeric", "matching"])], ["numeric", "matching"]).missing).toEqual([]);
    expect(unsupportedTypesForChild([dev(["numeric"])], ["numeric", "ordering"]).missing).toEqual(["ordering"]);
    expect(unsupportedTypesForChild([dev(null)], [])).toEqual({ missing: [], noDevice: false });
  });
});

import { structuredFitsKind } from "./question-authoring";
describe("structuredFitsKind (7 Kasım 2026 kararı)", () => {
  it("numeric fits open-ended / written purpose without Mixed; other structured types need Mixed", () => {
    expect(structuredFitsKind("open_ended", "numeric")).toBe(true);
    expect(structuredFitsKind("open_ended", "true_false")).toBe(false);
    expect(structuredFitsKind("multiple_choice", "numeric")).toBe(false);
    expect(structuredFitsKind("mixed", "matching")).toBe(true);
  });
});
