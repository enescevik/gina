import { describe, expect, it } from "vitest";
import { buildRevisionFields, loadRevisionFields } from "./structured-revision-fields";

describe("structured revision authoring", () => {
  it("restores a boolean answer without dropping false", () => {
    const payload = { statements: [{ id: "s1", text: "Kedi kuştur." }] };
    const key = { answers: { s1: false } };
    const form = loadRevisionFields("true_false", payload, key);
    expect(form?.type).toBe("true_false");
    expect(buildRevisionFields(form!)).toEqual({ payload, answer_key: key });
  });

  it("uses only real identifier suffixes to seed additions", () => {
    const id = "s" + "9".repeat(50_000);
    const payload = { statements: [{ id, text: 'Literal "id":"s999999"' }, { id: "s2_145", text: "İkinci ifade." }] };
    const form = loadRevisionFields("true_false", payload, { answers: { [id]: true, s2_145: false } });
    expect(form?.seq).toBe(145);
  });

  it("keeps ordering alternatives and image region coordinates", () => {
    const order = { items: [{ id: "a", text: "A" }, { id: "b", text: "B" }], mode: "sequence" };
    const orderKey = { orders: [["a", "b"], ["b", "a"]] };
    const image = { figure: { kind: "image", source: "question_media" }, regions: [{ id: "r1", text: "Sol", box: [0.1, 0.2, 0.3, 0.4] }] };
    const imageKey = { targets: ["r1"] };
    for (const [type, payload, key] of [["ordering", order, orderKey], ["region_select", image, imageKey]] as const) {
      expect(buildRevisionFields(loadRevisionFields(type, payload, key)!)).toEqual({ payload, answer_key: key });
    }
  });

  it("does not silently rewrite a saved word bank with alternative tokens", () => {
    expect(loadRevisionFields("fill_blank", {
      segments: [{ type: "blank", id: "a" }], input: "bank", bank_reuse: false,
      bank: [{ id: "one", text: "Bir" }, { id: "also", text: "1" }],
    }, { blanks: { a: { tokens: ["one", "also"] } } })).toBeNull();
  });
});
