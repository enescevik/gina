import { describe, expect, it } from "vitest";
import {
  addImageBox,
  AUTHOR_PRACTICE_ONLY_TYPES,
  buildPhase2Content,
  buildStimulus,
  newPhase2Draft,
  newStimulusDraft,
  clockRequires12h,
  normalizeTime,
  PHASE2_INTERACTION_TYPES,
  phase2DraftErrors,
  reconcileTokens,
  resizeImageBox,
  shapeRegions,
  splitPassage,
  stimulusDraftOf,
  type Phase2Draft,
} from "./question-authoring-p2";
import { aiTypesAllowed, blockedForTrack } from "./question-authoring";
import { generationPayloadSchema } from "./prova-generation-journal";
import { questionContentErrors } from "./question-types";

type Of<T extends Phase2Draft["type"]> = Extract<Phase2Draft, { type: T }>;

describe("phase 2 authoring drafts", () => {
  it("every empty draft is invalid and never throws", () => {
    for (const t of PHASE2_INTERACTION_TYPES) expect(phase2DraftErrors(newPhase2Draft(t)).length).toBeGreaterThan(0);
  });
  it("passage split keeps Turkish letters, apostrophes and punctuation outside units", () => {
    const parts = splitPassage("Ali'nin kedisi, çok şirin. Gölge ığdır!", "word");
    expect(parts.filter((p) => p.unit).map((p) => p.text)).toEqual(["Ali'nin", "kedisi", "çok", "şirin", "Gölge", "ığdır"]);
    expect(parts.map((p) => p.text).join("")).toBe("Ali'nin kedisi, çok şirin. Gölge ığdır!");
    const sent = splitPassage("Kedi uyudu. Köpek havladı! Kuş", "sentence");
    expect(sent.filter((p) => p.unit).map((p) => p.text)).toEqual(["Kedi uyudu.", "Köpek havladı!", "Kuş"]);
    expect(sent.map((p) => p.text).join("")).toBe("Kedi uyudu. Köpek havladı! Kuş");
  });
  it("mark_text: repeated words get distinct ids; ids survive an inserted word", () => {
    let d = newPhase2Draft("mark_text") as Of<"mark_text">;
    d = reconcileTokens(d, "kedi ve kedi");
    expect(d.tokens.map((t) => t.id)).toEqual(["k1", "k2", "k3"]);
    d = { ...d, targets: ["k3"] };
    d = reconcileTokens(d, "beyaz kedi ve kedi");
    expect(d.tokens).toEqual([{ id: "k4", text: "beyaz" }, { id: "k1", text: "kedi" }, { id: "k2", text: "ve" }, { id: "k3", text: "kedi" }]);
    const c = buildPhase2Content(d);
    expect(c.answer_key).toEqual({ targets: ["k3"] });
    expect(questionContentErrors("mark_text", c.payload, c.answer_key)).toEqual([]);
    expect(phase2DraftErrors({ ...d, targets: d.tokens.map((t) => t.id) })).toContain("selection_balance_invalid");
    expect(phase2DraftErrors({ ...d, maxSelect: "9" })).toContain("max_select_invalid");
  });
  it("error_fix: corrections with alternatives, review policy", () => {
    let d = newPhase2Draft("error_fix") as Of<"error_fix">;
    d = reconcileTokens(d, "Ben okula gitdim ve döndüm.");
    const wrong = d.tokens.find((t) => t.text === "gitdim")!.id;
    d = { ...d, errors: { [wrong]: "gittim|Gittim" } };
    const c = buildPhase2Content(d);
    expect(c.answer_key).toEqual({ errors: { [wrong]: { accepted: ["gittim", "Gittim"] } }, fix_policy: "review_unmatched" });
    expect(phase2DraftErrors(d)).toEqual([]);
    expect(phase2DraftErrors({ ...d, errors: { [wrong]: " " } })).toContain("key_value_invalid");
  });
  it("multi_choice: select_count follows the key when shown", () => {
    const d: Phase2Draft = { type: "multi_choice", seq: 4, tellCount: true, options: ["2", "3", "4", "9"].map((x, i) => ({ id: `o${i + 1}`, text: x })), correct: ["o4", "o1"] };
    const c = buildPhase2Content(d);
    expect(c).toEqual({ payload: { options: d.options, select_count: 2 }, answer_key: { correct: ["o1", "o4"] } });
    expect(phase2DraftErrors(d)).toEqual([]);
    expect(phase2DraftErrors({ ...d, correct: ["o1", "o2", "o3", "o4"] })).toContain("selection_balance_invalid");
  });
  it("two_stage: choice and text second stage", () => {
    const d: Phase2Draft = { type: "two_stage", seq: 4, prompt1: "Hangisi?", options1: [{ id: "a1", text: "X" }, { id: "a2", text: "Y" }], correct1: "a2",
      prompt2: "Neden?", mode2: "choice", options2: [{ id: "g3", text: "Çünkü A" }, { id: "g4", text: "Çünkü B" }], correct2: "g3" };
    expect(phase2DraftErrors(d)).toEqual([]);
    const text = { ...d, mode2: "text" as const, correct2: null };
    expect(buildPhase2Content(text).answer_key).toEqual({ stage1: "a2" });
    expect(phase2DraftErrors(text)).toEqual([]);
    expect(phase2DraftErrors({ ...d, correct1: null })).toContain("key_value_invalid");
  });
  it("region_select: grid targets / sectors count / image boxes", () => {
    const grid = { ...(newPhase2Draft("region_select") as Of<"region_select">), rows: 2, cols: 3, targets: ["g1_1", "g2_3"] };
    expect(shapeRegions(grid).map((r) => r.text)).toEqual(["A1", "A2", "A3", "B1", "B2", "B3"]);
    expect(phase2DraftErrors(grid)).toEqual([]);
    const sectors = { ...grid, figure: "sectors" as const, sectors: 8, keyMode: "count" as const, count: "3" };
    expect(buildPhase2Content(sectors)).toMatchObject({ payload: { figure: { kind: "sectors" } }, answer_key: { count: 3 } });
    expect(phase2DraftErrors(sectors)).toEqual([]);
    expect(phase2DraftErrors({ ...sectors, count: "8" })).toContain("key_value_invalid");
    let img: Of<"region_select"> = { ...grid, figure: "image", targets: [] };
    img = addImageBox(img, 0.05, 0.5);
    img = addImageBox(img, 0.9, 0.95, 0.3);
    expect(img.boxes.map((b) => b.box)).toEqual([[0, 0.4, 0.2, 0.2], [0.7, 0.7, 0.3, 0.3]]);
    img = { ...img, targets: [img.boxes[0]!.id] };
    expect(phase2DraftErrors(img)).toEqual(["region_image_required"]);
    expect(phase2DraftErrors(img, { hasImage: true })).toEqual([]);
    expect(resizeImageBox(img, img.boxes[1]!.id, 0.1).boxes[1]!.box).toEqual([0.8, 0.8, 0.1, 0.1]);
    expect(phase2DraftErrors({ ...img, keyMode: "count", count: "1" }, { hasImage: true })).toEqual([]); // count ignored for image: targets used
  });
  it("clock: read mode shows the key time; times normalised; off-step refused", () => {
    const d: Phase2Draft = { type: "clock", seq: 0, mode: "read", display: "analog", step: 5, time: "8.30", accept12h: true };
    expect(buildPhase2Content(d)).toEqual({ payload: { mode: "read", display: "analog", step_minutes: 5, shown_time: "08:30" }, answer_key: { time: "08:30", accept_12h: true } });
    expect(phase2DraftErrors(d)).toEqual([]);
    expect(phase2DraftErrors({ ...d, time: "08:32" })).toContain("key_not_on_step");
    expect(phase2DraftErrors({ ...d, time: "25:00" })).toContain("key_invalid");
    expect(buildPhase2Content({ ...d, mode: "set" }).payload).toEqual({ mode: "set", display: "analog", step_minutes: 5 });
    expect(normalizeTime("7 05")).toBe("07:05");
  });
  it("stimulus: table and bar chart with mandatory alt text, attachable to a 1A type", () => {
    const table = buildStimulus({ ...newStimulusDraft(), kind: "table", alt: "Sınıfların kitap sayıları", text: "Sınıf | Kitap\n3-A | 12\n3-B | 15" })!;
    expect(table).toEqual({ kind: "table", alt: "Sınıfların kitap sayıları", columns: ["Sınıf", "Kitap"], rows: [["3-A", 12], ["3-B", 15]] });
    const tf = { statements: [{ id: "s1", text: "3-B daha çok kitap okudu." }] };
    expect(questionContentErrors("true_false", { ...tf, stimulus: table }, { answers: { s1: true } })).toEqual([]);
    const chart = buildStimulus({ ...newStimulusDraft(), kind: "bar_chart", alt: "Haftalık yağmur", text: "Pzt: 3\nSalı: 5,5", unit: "mm" })!;
    expect(chart).toEqual({ kind: "bar_chart", alt: "Haftalık yağmur", unit: "mm", bars: [{ label: "Pzt", value: 3 }, { label: "Salı", value: 5.5 }] });
    expect(questionContentErrors("true_false", { ...tf, stimulus: { ...chart, alt: "x" } }, { answers: { s1: true } })).toEqual(["stimulus_alt_invalid"]);
    expect(questionContentErrors("true_false", { ...tf, stimulus: buildStimulus({ ...newStimulusDraft(), kind: "bar_chart", alt: "Haftalık yağmur", text: "Pzt: çok" }) }, { answers: { s1: true } })).toEqual(["stimulus_invalid"]);
    expect(buildStimulus(newStimulusDraft())).toBeNull();
    expect(buildStimulus(stimulusDraftOf(chart))).toEqual(chart);
    expect(phase2DraftErrors({ type: "clock", seq: 0, mode: "set", display: "digital", step: 15, time: "10:15", accept12h: false }, { stimulus: table })).toEqual([]);
  });
  it("track and AI picker: all 2A/2B types are practice-only; gated off by default", () => {
    for (const t of PHASE2_INTERACTION_TYPES) expect(AUTHOR_PRACTICE_ONLY_TYPES.has(t)).toBe(true);
    expect(blockedForTrack("meb_common", ["clock", "numeric", "mark_text"])).toEqual(["clock", "mark_text"]);
    expect(aiTypesAllowed(false)).toHaveLength(8);
    expect(aiTypesAllowed(false, { phase2a: true })).toContain("two_stage");
    expect(aiTypesAllowed(false, { phase2a: true })).not.toContain("clock");
    expect(aiTypesAllowed(true, { phase2a: true, phase2b: true })).toEqual(["open_ended", "numeric"]);
    const base = { draft_id: "00000000-0000-4000-8000-000000000003", subject: "Fen", grade: 5, topic_plan: [{ topic: "Isı", count: 1 }], blueprint_id: null, count: 1,
      kind: "mixed", assessment: "practice", difficulty: "orta", note: "", locale: "tr" };
    expect(generationPayloadSchema.safeParse({ ...base, interaction_types: ["clock", "mark_text"] }).success).toBe(true);
  });
  it("clock: grade 1-4 requires 12-hour acceptance; grade 5+ may turn it off", () => {
    const d: Phase2Draft = { type: "clock", seq: 0, mode: "set", display: "analog", step: 5, time: "08:30", accept12h: false };
    expect(clockRequires12h(3)).toBe(true);
    expect(clockRequires12h(4)).toBe(true);
    expect(clockRequires12h(5)).toBe(false);
    expect(clockRequires12h(null)).toBe(false);
    expect(phase2DraftErrors(d, { grade: 2 })).toEqual(["clock_12h_required"]);
    expect(phase2DraftErrors({ ...d, accept12h: true }, { grade: 2 })).toEqual([]);
    expect(phase2DraftErrors(d, { grade: 7 })).toEqual([]);
    expect(phase2DraftErrors(d)).toEqual([]);
  });
});
