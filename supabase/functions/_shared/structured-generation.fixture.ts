// QT-AI test verisi: sağlayıcının döndürdüğü biçimde (model biçimi) sentetik yapılandırılmış sorular.
// Gerçek sağlayıcı çağrısı yok; red-team testleri bu nesneleri bozarak üretir. Kişi adı ve görsel yok.
type Q = Record<string, unknown>;
/** Uyaran yok (model biçimi: bütün alanlar zorunlu, kullanılmayan boş). */
export const NO_STIMULUS = { kind: "none", caption: "", alt: "", columns: [], rows: [], bars: [], x_label: "", y_label: "", unit: "" };
const common = (type: string, stem: string, structure: Q, over: Q = {}): Q => ({
  interaction_type: type,
  schema_version: 1,
  topic: "Canlılar",
  difficulty: "kolay",
  stem,
  structure,
  stimulus: NO_STIMULUS,
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
  // ---- Faz 2A ----
  mark_text: () =>
    common("mark_text", "Cümledeki hareket bildiren sözcükleri işaretle.", {
      unit: "word",
      segments: [
        { id: "w1", text: "Kedi" }, { id: "", text: " " }, { id: "w2", text: "bahçede" }, { id: "", text: " " },
        { id: "w3", text: "koştu" }, { id: "", text: " ve " }, { id: "w4", text: "zıpladı" }, { id: "", text: "." },
      ],
      targets: ["w3", "w4"],
      max_select: 0,
    }),
  error_fix: () =>
    common("error_fix", "Cümledeki yazım yanlışını bul ve düzelt.", {
      unit: "word",
      segments: [
        { id: "w1", text: "Okula" }, { id: "", text: " " }, { id: "w2", text: "herkez" }, { id: "", text: " " },
        { id: "w3", text: "erken" }, { id: "", text: " " }, { id: "w4", text: "geldi" }, { id: "", text: "." },
      ],
      errors: [{ id: "w2", accepted: ["herkes"] }],
      find_weight: 0,
      fix_policy: "review_unmatched",
      case_insensitive: true,
    }),
  multi_choice: () =>
    common("multi_choice", "Hangileri memeli hayvandır? Doğru olanların hepsini seç.", {
      options: [{ id: "a", text: "Kedi" }, { id: "b", text: "Serçe" }, { id: "c", text: "İnek" }, { id: "d", text: "Balık" }],
      correct: ["a", "c"],
      select_count: 0,
    }),
  two_stage: () =>
    common("two_stage", "İki adımda cevapla.", {
      stage1: { prompt: "Su donunca hangi hâle geçer?", options: [{ id: "a", text: "Katı" }, { id: "b", text: "Gaz" }] },
      stage2: {
        prompt: "Seçimini hangi bilgi destekler?",
        mode: "choice",
        options: [{ id: "c", text: "Soğuyan su buza dönüşür." }, { id: "d", text: "Isınan su buharlaşır." }],
      },
      stage1_answer: "a",
      stage2_answer: "c",
    }),
  // ---- Faz 2B ----
  region_grid: () =>
    common("region_select", "Şeklin 3/4'ünü boya.", {
      figure: { kind: "grid", rows: 2, cols: 2 },
      regions: [
        { id: "r1", text: "1. satır 1. sütun" }, { id: "r2", text: "1. satır 2. sütun" },
        { id: "r3", text: "2. satır 1. sütun" }, { id: "r4", text: "2. satır 2. sütun" },
      ],
      key_mode: "count",
      count: 3,
      targets: [],
      max_select: 0,
    }),
  region_sectors: () =>
    common("region_select", "Dairenin yarısını boya.", {
      figure: { kind: "sectors", rows: 0, cols: 0 },
      regions: Array.from({ length: 6 }, (_, i) => ({ id: `d${i + 1}`, text: `${i + 1}. dilim` })),
      key_mode: "count",
      count: 3,
      targets: [],
      max_select: 0,
    }),
  clock_read: () =>
    common("clock", "Saat kaçı gösteriyor?", { mode: "read", display: "analog", step_minutes: 15, shown_time: "03:15", time: "03:15", accept_12h: true }),
  clock_set: () =>
    common("clock", "Saati 07:30 olarak kur.", { mode: "set", display: "analog", step_minutes: 30, shown_time: "", time: "07:30", accept_12h: true }),
  // ---- Uyaran (tablo / grafik) ----
  numeric_table: () => ({
    ...common("numeric", "Tabloya göre iki sınıfta toplam kaç öğrenci var?", {
      units: [], unit_required: false, work_area: true, value: "47", unit: "", unit_factors: [],
      abs_tolerance: 0, rel_tolerance: 0, unit_weight: 0, process_required: false,
    }),
    stimulus: { ...NO_STIMULUS, kind: "table", caption: "Sınıf mevcutları", alt: "İki satırlı tablo: 2-A sınıfında 23, 2-B sınıfında 24 öğrenci var.", columns: ["Sınıf", "Öğrenci"], rows: [["2-A", "23"], ["2-B", "24"]] },
  }),
  multi_choice_chart: () => ({
    ...common("multi_choice", "Grafiğe göre 10'dan fazla satılan meyveleri seç.", {
      options: [{ id: "a", text: "Elma" }, { id: "b", text: "Armut" }, { id: "c", text: "Muz" }],
      correct: ["a", "c"],
      select_count: 0,
    }),
    stimulus: {
      ...NO_STIMULUS, kind: "bar_chart", alt: "Sütun grafiği: Elma 12, Armut 7, Muz 15 kilogram satıldı.", x_label: "Meyve", y_label: "Satış", unit: "kg",
      bars: [{ label: "Elma", value: 12 }, { label: "Armut", value: 7 }, { label: "Muz", value: 15 }],
    },
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
