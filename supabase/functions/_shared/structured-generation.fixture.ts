// QT-AI test verisi: sağlayıcının döndürdüğü biçimde (model biçimi) sentetik yapılandırılmış sorular.
// Gerçek sağlayıcı çağrısı yok; red-team testleri bu nesneleri bozarak üretir. Kişi adı ve görsel yok.
type Q = Record<string, unknown>;
const common = (type: string, stem: string, structure: Q, over: Q = {}): Q => ({
  interaction_type: type,
  schema_version: 1,
  topic: "Canlılar",
  difficulty: "kolay",
  stem,
  structure,
  solution: "ÇÖZÜM-GİZLİ-" + type,
  explanation: "",
  source_urls: [],
  block_id: "",
  outcome_ids: [],
  cognitive_demand: "hatirlama",
  intended_difficulty: "kolay",
  shared_source_id: "",
  ...over,
});
export const aiStructured = {
  true_false: () =>
    common("true_false", "Aşağıdaki ifadeler doğru mu, yanlış mı?", {
      statements: [
        { id: "s1", text: "Güneş bir yıldızdır.", answer: true },
        { id: "s2", text: "Ay kendi ışığını üretir.", answer: false },
        { id: "s3", text: "Bitkiler büyümek için suya ihtiyaç duyar.", answer: true },
      ],
    }),
  fill_blank_bank: () =>
    common("fill_blank", "Boşluğa uygun kelimeyi yerleştir.", {
      input: "bank",
      segments: [
        { type: "text", text: "Su donunca ", id: "", accepted: [], tokens: [] },
        { type: "blank", text: "", id: "b1", accepted: [], tokens: ["w1"] },
        { type: "text", text: " olur.", id: "", accepted: [], tokens: [] },
      ],
      bank: [{ id: "w1", text: "buz" }, { id: "w2", text: "buhar" }],
      bank_reuse: false,
      case_insensitive: false,
    }),
  fill_blank_keyboard: () =>
    common("fill_blank", "Boşlukları doldur.", {
      input: "keyboard",
      segments: [
        { type: "text", text: "Bir haftada ", id: "", accepted: [], tokens: [] },
        { type: "blank", text: "", id: "b1", accepted: ["7", "yedi"], tokens: [] },
        { type: "text", text: " gün vardır.", id: "", accepted: [], tokens: [] },
      ],
      bank: [],
      bank_reuse: false,
      case_insensitive: true,
    }),
  matching: () =>
    common("matching", "Organları görevleriyle eşleştir.", {
      policy: "one_to_one",
      left: [{ id: "l1", text: "Kalp" }, { id: "l2", text: "Akciğer" }],
      right: [{ id: "r1", text: "Kanı pompalar" }, { id: "r2", text: "Solunum yapar" }, { id: "r3", text: "Besinleri sindirir" }],
      pairs: [{ left: "l1", right: "r1" }, { left: "l2", right: "r2" }],
    }),
  numeric_unit: () =>
    common("numeric", "1 metre 50 santimetre kaç santimetredir?", {
      units: [{ id: "cm", text: "cm" }, { id: "m", text: "m" }],
      unit_required: true,
      work_area: false,
      value: "150",
      unit: "cm",
      unit_factors: [{ unit: "cm", factor: 1 }, { unit: "m", factor: 100 }],
      abs_tolerance: 0,
      rel_tolerance: 0,
      unit_weight: 0,
      process_required: false,
    }),
  numeric_plain: () =>
    common("numeric", "8 ile 5'in toplamı kaçtır?", {
      units: [],
      unit_required: false,
      work_area: true,
      value: "13",
      unit: "",
      unit_factors: [],
      abs_tolerance: 0,
      rel_tolerance: 0,
      unit_weight: 0,
      process_required: false,
    }),
  ordering: () =>
    common("ordering", "Bitkinin büyüme aşamalarını sırala.", {
      mode: "sequence",
      items: [{ id: "a", text: "Tohum" }, { id: "b", text: "Filiz" }, { id: "c", text: "Çiçek açan bitki" }],
      orders: [["a", "b", "c"]],
    }),
  ordering_sentence: () =>
    common("ordering", "Kelimeleri sıralayarak cümle kur.", {
      mode: "sentence",
      items: [{ id: "w1", text: "Kedi" }, { id: "w2", text: "süt" }, { id: "w3", text: "içti." }],
      // Türkçede iki dil bilgisine uygun sıra: ikisi de kabul listesinde.
      orders: [["w1", "w2", "w3"], ["w2", "w1", "w3"]],
    }),
  classification: () =>
    common("classification", "Canlıları gruplarına yerleştir.", {
      categories: [{ id: "c1", text: "Hayvan", capacity: 0 }, { id: "c2", text: "Bitki", capacity: 2 }],
      items: [
        { id: "i1", text: "Kedi", category: "c1" },
        { id: "i2", text: "Papatya", category: "c2" },
        { id: "i3", text: "Serçe", category: "c1" },
        { id: "i4", text: "Elma ağacı", category: "c2" },
      ],
    }),
};
export type AiStructuredName = keyof typeof aiStructured;
/** Derin kopya + yol üzerinde değişiklik (red-team). */
// deno-lint-ignore no-explicit-any
type Any = Record<string, any>;
export function mutate(q: Q, fn: (s: Any, q: Any) => void): Q {
  const c = structuredClone(q) as Any;
  fn(c.structure, c);
  return c;
}
