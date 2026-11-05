import { describe, expect, it } from "vitest";
import catalog from "../../../docs/learning/catalog/subject-synonyms.json";
import {
  confirmSubjectChoice,
  groupSubjectSynonyms,
  normalizeSubjectAlias,
  readSubjectSuggestion,
} from "./subject-synonyms";

describe("normalizeSubjectAlias", () => {
  it("matches the SQL normaliser examples (pgTAP 104)", () => {
    expect(normalizeSubjectAlias("İNKILAP")).toBe("inkilap");
    expect(normalizeSubjectAlias("Fen Bil.")).toBe("fenbil");
    expect(normalizeSubjectAlias("Türkçe Dersi")).toBe("turkce");
    expect(normalizeSubjectAlias("Kur'an-ı Kerim")).toBe("kuranikerim");
    expect(normalizeSubjectAlias("  Görsel   Sanatlar ")).toBe("gorselsanatlar");
    expect(normalizeSubjectAlias("dersi")).toBe("dersi");
    expect(normalizeSubjectAlias("...")).toBe("");
  });

  it("keeps catalog aliases unambiguous across subjects", () => {
    const owners = new Map<string, Set<string>>();
    for (const s of catalog.subjects)
      for (const a of [s.label_tr, s.label_en, ...s.aliases]) {
        const n = normalizeSubjectAlias(a);
        expect(n.length).toBeGreaterThan(0);
        owners.set(n, (owners.get(n) ?? new Set()).add(s.id));
      }
    const shared = [...owners].filter(([, ids]) => ids.size > 1);
    expect(shared).toEqual([]);
  });

  it("covers exactly 20 proposed ids on top of 12 existing", () => {
    expect(catalog.subjects.filter((s) => s.proposed)).toHaveLength(20);
    expect(catalog.subjects.filter((s) => !s.proposed)).toHaveLength(12);
  });
});

const single = {
  input: "MAT",
  normalized: "mat",
  grade: 6,
  match: "single",
  requires_confirmation: true,
  keep_label: true,
  scope_note: false,
  candidates: [
    {
      subject_id: "subject-math",
      label_tr: "Matematik",
      label_en: "Mathematics",
      grade_min: 1,
      grade_max: 12,
      in_grade_scope: true,
      matched_alias: "MAT",
    },
  ],
};

describe("subject suggestion contract", () => {
  it("rejects a server answer that would bind silently", () => {
    expect(() =>
      readSubjectSuggestion({ ...single, requires_confirmation: false }),
    ).toThrow();
    expect(readSubjectSuggestion(single).match).toBe("single");
  });

  it("never binds without the parent's choice, even with one candidate", () => {
    const s = readSubjectSuggestion(single);
    expect(confirmSubjectChoice(s, null)).toEqual({
      subject_id: null,
      label: "MAT",
    });
    expect(confirmSubjectChoice(s, "subject-math")).toEqual({
      subject_id: "subject-math",
      label: "MAT",
    });
    expect(confirmSubjectChoice(s, "subject-physics").subject_id).toBeNull();
  });

  it("groups synonyms per subject and merges grade runs", () => {
    const grouped = groupSubjectSynonyms([
      { subject_id: "subject-inkilap", alias: "İnkılap", alias_normalized: "inkilap", grade_min: 8, grade_max: 8, source: "catalog" },
      { subject_id: "subject-inkilap", alias: "İnkılap", alias_normalized: "inkilap", grade_min: 12, grade_max: 12, source: "catalog" },
      { subject_id: "subject-history", alias: "İnkılap", alias_normalized: "inkilap", grade_min: 9, grade_max: 11, source: "policy_ambiguity" },
    ]);
    expect(grouped.get("subject-inkilap")).toEqual([
      { alias: "İnkılap", grades: "8, 12", ambiguity: false },
    ]);
    expect(grouped.get("subject-history")?.[0]?.ambiguity).toBe(true);
  });
});
