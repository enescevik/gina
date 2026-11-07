import { expect, it } from "vitest";
import {
  type BookletQuestion,
  bookletFontFaceCss,
  bookletOrder,
  buildBookletHtml,
  withBookletFonts,
} from "./prova-booklet";
const q: BookletQuestion = {
  id: "q1",
  topic: "Çevre",
  kind: "open_ended",
  difficulty: "orta",
  stem: "Legacy complete text",
  choices: null,
  correct_key: null,
  expected_answer: "ANSWER_SECRET",
  solution: "SOLUTION_SECRET",
  context: {
    group_id: "g1",
    title: "Okul bahçesi",
    body: "SHARED_SOURCE",
    prompt: "Bahçenin çevresi kaç metredir?",
  },
  images: [{ dataUri: "data:image/png;base64,YQ==", alt: "Garden" }],
};
const labels = {
  answerKey: "Cevap anahtarı",
  name: "Ad",
  date: "Tarih",
  topics: "Konular",
  questionCount: "2 soru",
  solution: "Çözüm",
  expected: "Beklenen",
  difficulty: (d: string) => d,
};
const render = (questions: BookletQuestion[]) =>
  buildBookletHtml({ title: "Test", labels, questions });
it("prints shared text and image once for consecutive members, with separate questions", () => {
  const html = render([q, {
    ...q,
    id: "q2",
    context: { ...q.context!, prompt: "Alanı bul." },
  }]);
  const student = html.split('<section class="key">')[0]!;
  expect(student.match(/SHARED_SOURCE/g)).toHaveLength(1);
  expect(student.match(/data:image\/png/g)).toHaveLength(1);
  expect(student).toContain("Alanı bul.");
  expect(student).not.toContain("Legacy complete text");
  expect(student).not.toContain("ANSWER_SECRET");
  expect(student).not.toContain("SOLUTION_SECRET");
  expect(html).toContain("ANSWER_SECRET");
});
it("repeats common context if another group interrupts the sequence", () => {
  expect(render([q, { ...q, context: undefined }, q]).match(/SHARED_SOURCE/g))
    .toHaveLength(2);
});
it("escapes shared text and never accepts remote or active image URLs", () => {
  const html = render([{
    ...q,
    context: {
      ...q.context!,
      body: "<script>alert(1)</script>",
      title: "<img src=x>",
    },
  }]);
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(() =>
    render([{ ...q, images: [{ dataUri: "https://private/file", alt: "x" }] }])
  ).toThrow("invalid_booklet_image");
});

it("D4-4: gömülü yazı tipleri @font-face olarak head'e eklenir, bozuk base64 atlanır", () => {
  const html = "<!doctype html><html><head><style>x{}</style></head><body>i</body></html>";
  const out = withBookletFonts(html, [
    { family: "Nunito", weight: 400, base64: "AAEAAA==" },
    { family: "Baloo 2", weight: 700, base64: "x\"); } body { color: red" },
  ]);
  expect(out).toContain('@font-face { font-family: "Nunito"; font-style: normal; font-weight: 400; src: url(data:font/ttf;base64,AAEAAA==) format("truetype"); }');
  expect(out).not.toContain("Baloo 2");
  expect(out.indexOf("@font-face")).toBeLessThan(out.indexOf("</head>"));
  expect(withBookletFonts(html, [])).toBe(html);
  expect(bookletFontFaceCss([])).toBe("");
});

// ---------------------------------------------------------------------------------------------
// QT: yapılandırılmış türlerin kâğıt düzeni (öğrenci nüshası) ve özel anahtar nüshası
const sq = (id: string, interaction_type: string, payload: unknown, answer_key?: unknown): BookletQuestion => ({
  id, topic: "Şekiller ve Ölçme", kind: "structured", difficulty: "orta", stem: `Soru ${id}: ığüşöç İ`, choices: null,
  correct_key: null, expected_answer: null, solution: null, interaction_type, payload, answer_key,
});
const QT: BookletQuestion[] = [
  sq("t1", "true_false", { statements: [{ id: "s1", text: "Güneş bir yıldızdır." }, { id: "s2", text: "Ay ışık üretir." }] }, { answers: { s1: true, s2: false } }),
  sq("f1", "fill_blank", { segments: [{ type: "text", text: "Su donunca " }, { type: "blank", id: "b1" }, { type: "text", text: " olur." }], input: "bank", bank: [{ id: "wb1", text: "katı" }, { id: "d1", text: "buhar" }], bank_reuse: false }, { blanks: { b1: { tokens: ["wb1"] } } }),
  sq("f2", "fill_blank", { segments: [{ type: "blank", id: "b1" }, { type: "text", text: " başkenttir." }], input: "keyboard" }, { blanks: { b1: { accepted: ["Ankara", "ankara"] } }, case_insensitive: true }),
  sq("m1", "matching", { left: [{ id: "l1", text: "Kalp" }, { id: "l2", text: "Akciğer" }], right: [{ id: "r1", text: "Kan pompalar" }, { id: "r2", text: "Solunum" }, { id: "r3", text: "Görme" }], policy: "one_to_one" }, { pairs: { l1: "r1", l2: "r2" } }),
  sq("n1", "numeric", { units: [{ id: "u1", text: "cm" }, { id: "u2", text: "m" }], unit_required: true, work_area: true }, { value: "150", unit: "u1", unit_factors: { u1: 1, u2: 100 }, abs_tolerance: 0.5, process_required: true }),
  sq("o1", "ordering", { items: [{ id: "o1", text: "Tohum" }, { id: "o2", text: "Filiz" }, { id: "o3", text: "Ağaç" }], mode: "sequence" }, { orders: [["o1", "o2", "o3"]] }),
  sq("c1", "classification", { items: [{ id: "i1", text: "Kedi" }, { id: "i2", text: "Gül" }, { id: "i3", text: "Kartal" }], categories: [{ id: "c1", text: "Hayvan", capacity: 2 }, { id: "c2", text: "Bitki" }] }, { membership: { i1: "c1", i2: "c2", i3: "c1" } }),
];
const qtRender = (copy: "student" | "key", qs = QT) => buildBookletHtml({ title: "Türkçe Ğ", labels, questions: qs, copy });
const between = (html: string, from: string, to?: string) => html.slice(html.indexOf(from), to ? html.indexOf(to) : undefined);

it("QT: student copy has no answer-key section and no key values at all", () => {
  const html = qtRender("student");
  expect(html).not.toContain('<section class="key">');
  expect(html).not.toContain("Kabul edilen sıra");
  expect(html).not.toContain("İşlem gerekli");
  expect(html).not.toContain("ankara"); // keyboard alternatives live only in the key
  expect(html).toContain("ığüşöç İ"); // Turkish characters kept (font embedded separately)
  expect(html).toContain('<meta charset="utf-8"/>');
});
it("QT: question order preserved and every type has a paper answer area", () => {
  const html = qtRender("student");
  const order = QT.map((q) => html.indexOf(`Soru ${q.id}:`));
  expect(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1]!))).toBe(true);
  // T/F: D/Y boxes per statement
  expect(between(html, "Soru t1:", "Soru f1:").match(/class="sq"/g)).toHaveLength(4);
  // fill blank: numbered line + word bank list; keyboard version has no bank
  const f1 = between(html, "Soru f1:", "Soru f2:");
  expect(f1).toContain('<span class="blank"><sup>1</sup></span>');
  expect(f1).toContain("<span>katı</span>");
  expect(f1).toContain("<span>buhar</span>");
  expect(between(html, "Soru f2:", "Soru m1:")).not.toContain('class="bank"');
  // matching: two columns with a letter slot for each left item, distractor on the right
  const m1 = between(html, "Soru m1:", "Soru n1:");
  expect(m1.match(/class="slot"/g)).toHaveLength(2);
  expect(m1).toContain("<b>C)</b>");
  // numeric: answer box + unit line + work lines
  const n1 = between(html, "Soru n1:", "Soru o1:");
  expect(n1).toContain('class="ansbox"');
  expect(n1).toContain('class="unitline"');
  expect(n1).toContain("(cm, m)");
  // ordering: numbered slots, one per item
  expect(between(html, "Soru o1:", "Soru c1:").match(/class="slot"/g)).toHaveLength(3);
  // classification: one column per category, capacity visible
  const c1 = between(html, "Soru c1:");
  expect(c1.match(/<th>/g)).toHaveLength(2);
  expect(c1).toContain("en çok 2");
  // long text cannot overflow the page
  expect(html).toContain("table-layout: fixed");
  expect(html).toContain("overflow-wrap: anywhere");
});
it("QT: paper order never shows the authored (usually correct) order", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  for (const seed of ["x", "y", "z", "q1:items"]) expect(bookletOrder(items, seed).map((i) => i.id)).not.toEqual(["a", "b", "c"]);
  expect(bookletOrder(items, "same")).toEqual(bookletOrder(items, "same"));
  expect(bookletOrder([{ id: "a" }], "s")).toEqual([{ id: "a" }]);
});
it("QT: answer key copy lists correct values with the same letters as the paper copy", () => {
  const key = qtRender("key");
  const student = qtRender("student");
  expect(key).not.toContain('class="cover"');
  expect(key).not.toContain("<main>");
  expect(key).toContain("a) <b>D</b>");
  expect(key).toContain("b) <b>Y</b>");
  expect(key).toContain("(1) <b>katı</b>");
  expect(key).toContain("(1) <b>Ankara / ankara</b>");
  expect(key).toContain("Büyük/küçük harf fark etmez.");
  expect(key).toContain("<b>150 cm</b>");
  expect(key).toContain("1 m = 100 cm");
  expect(key).toContain("İşlem gerekli: veli puanlar.");
  // matching letter in the key = letter printed next to "Kan pompalar" on paper
  const printed = /<b>([A-Z])\)<\/b> Kan pompalar/.exec(student)![1];
  expect(key).toContain(`1 → <b>${printed}</b> · Kalp`);
  // ordering letters follow the printed (shuffled) letters
  const at = (t: string) => /<b>([A-Z])\)<\/b> (\S+)<\/td>/g;
  const letters = Object.fromEntries([...between(student, "Soru o1:", "Soru c1:").matchAll(at(""))].map((m) => [m[2], m[1]]));
  expect(key).toContain(`Kabul edilen sıra 1: <b>${letters["Tohum"]}, ${letters["Filiz"]}, ${letters["Ağaç"]}</b>`);
  expect(key).toMatch(/Hayvan: <b>[A-C], [A-C]<\/b>/);
});
it("QT: missing private key renders a calm placeholder, never the student payload as an answer", () => {
  const key = qtRender("key", [{ ...QT[0]!, answer_key: undefined }]);
  expect(key).toContain("Anahtar alınamadı");
});
it("QT: shared source printed once even when members are structured", () => {
  const ctx = { group_id: "g9", title: "Ortak metin", body: "SHARED_QT", prompt: "İlk soru" };
  const html = qtRender("student", [{ ...QT[0]!, context: ctx }, { ...QT[3]!, context: { ...ctx, prompt: "İkinci soru" } }]);
  expect(html.match(/SHARED_QT/g)).toHaveLength(1);
});
it("QT: structured text is escaped", () => {
  const html = qtRender("student", [sq("x1", "true_false", { statements: [{ id: "s1", text: "<script>x</script>" }] })]);
  expect(html).not.toContain("<script>x");
});

// ---------------------------------------------------------------------------------------------
// QT Faz 2A/2B: kâğıt cevap alanları, uyaran ve özel anahtar
const IMG = "data:image/png;base64,iVBORw0KGgo=";
const P2: BookletQuestion[] = [
  sq("mk", "mark_text", { unit: "word", segments: [{ id: "k1", text: "Kedi" }, { text: " " }, { id: "k2", text: "koştu" }, { text: "." }], max_select: 1 }, { targets: ["k2"] }),
  sq("ef", "error_fix", { unit: "word", segments: [{ id: "k1", text: "Ben" }, { text: " " }, { id: "k2", text: "gitdim" }] }, { errors: { k2: { accepted: ["gittim"] } }, fix_policy: "review_unmatched" }),
  sq("mc", "multi_choice", { options: [{ id: "o1", text: "2" }, { id: "o2", text: "3" }, { id: "o3", text: "9" }], select_count: 2 }, { correct: ["o1", "o3"] }),
  sq("ts", "two_stage", { stage1: { prompt: "Hangisi?", options: [{ id: "a1", text: "X" }, { id: "a2", text: "Y" }] }, stage2: { prompt: "Neden?", mode: "text" } }, { stage1: "a2" }),
  sq("rg", "region_select", { figure: { kind: "grid", rows: 2, cols: 2 }, regions: [{ id: "g1_1", text: "A1" }, { id: "g1_2", text: "A2" }, { id: "g2_1", text: "B1" }, { id: "g2_2", text: "B2" }] }, { count: 3 }),
  sq("rs", "region_select", { figure: { kind: "sectors" }, regions: [1, 2, 3, 4].map((n) => ({ id: `d${n}`, text: String(n) })) }, { targets: ["d1"] }),
  { ...sq("ri", "region_select", { figure: { kind: "image", source: "question_media" }, regions: [{ id: "b1", text: "Göl", box: [0.1, 0.1, 0.2, 0.2] }, { id: "b2", text: "Dağ", box: [0.6, 0.5, 0.3, 0.3] }] }, { targets: ["b2"] }), images: [{ dataUri: IMG, alt: "Harita" }] },
  sq("cr", "clock", { mode: "read", display: "analog", step_minutes: 5, shown_time: "08:30" }, { time: "08:30", accept_12h: true }),
  sq("cs", "clock", { mode: "set", display: "digital", step_minutes: 15 }, { time: "10:15" }),
  sq("st", "true_false", { statements: [{ id: "s1", text: "3-B daha çok okudu." }], stimulus: { kind: "bar_chart", alt: "GIZLI_ALT kitap sayıları", caption: "Okunan kitaplar", bars: [{ label: "3-A", value: 12 }, { label: "3-B", value: 15 }] } }, { answers: { s1: true } }),
  sq("tb", "numeric", { units: [], unit_required: false, stimulus: { kind: "table", alt: "TABLO_ALT fiyatlar", columns: ["Ürün", "Fiyat"], rows: [["Elma", 5]] } }, { value: "5" }),
];
it("QT 2A/2B: student copy has a paper answer area per type and never a key", () => {
  const html = qtRender("student", P2);
  const part = (id: string, next?: string) => between(html, `Soru ${id}:`, next ? `Soru ${next}:` : undefined);
  expect(part("mk", "ef")).toContain("kelimelerin altını çiz");
  expect(part("mk", "ef")).toContain("En çok 1");
  expect(part("ef", "mc")).toContain('class="lines"');
  expect(part("mc", "ts")).toContain("2 seçenek işaretle.");
  expect(part("mc", "ts").match(/class="sq"/g)).toHaveLength(3);
  expect(part("ts", "rg")).toContain("1. aşama");
  expect(part("ts", "rg")).toContain("2. aşama");
  expect(part("rg", "rs").match(/class="rcell"/g)).toHaveLength(4);
  expect(part("rs", "ri").match(/<path /g)).toHaveLength(4);
  const ri = part("ri", "cr");
  expect(ri).toContain('class="regimg"');
  expect(ri.match(/class="rbox"/g)).toHaveLength(2);
  expect(ri.match(/data:image\/png/g)).toHaveLength(1); // not printed twice
  expect(part("cr", "cs")).toContain('class="clock"');
  expect(part("cr", "cs").match(/<line /g)).toHaveLength(2); // hands at shown time
  expect(part("cs", "st")).not.toContain('class="clock"'); // digital set: time line only
  expect(part("cs", "st")).toContain('class="unitline"');
  expect(part("st", "tb")).toContain('svg class="chart"');
  expect(part("tb")).toContain("<th>Ürün</th>");
  for (const secret of ["GIZLI_ALT", "TABLO_ALT", "gittim", "10:15", "Dağ)", "bölge boyanmalı", "veli puanlar", "12 saatlik"]) expect(html).not.toContain(secret);
  expect(html).not.toContain('<section class="key">');
});
it("QT 2A/2B: private key lists values and stimulus alt text", () => {
  const key = qtRender("key", P2);
  expect(key).toContain("<b>koştu</b>");
  expect(key).toContain("gitdim → <b>gittim</b>");
  expect(key).toContain("<b>A, C</b>");
  expect(key).toContain("1. aşama: <b>B</b> · Y");
  expect(key).toContain("Serbest cevap: veli değerlendirir.");
  expect(key).toContain("3 bölge boyanmalı");
  expect(key).toContain("<b>1</b>"); // sector label
  expect(key).toContain("B (Dağ)");
  expect(key).toContain("<b>08:30</b>");
  expect(key).toContain("12 saatlik okuma");
  expect(key).toContain("<b>10:15</b>");
  expect(key).toContain("Uyaran açıklaması: GIZLI_ALT kitap sayıları");
  expect(key).toContain("Uyaran açıklaması: TABLO_ALT fiyatlar");
});
it("QT 2B: region image must be an embedded data image", () => {
  expect(() => qtRender("student", [{ ...P2[6]!, images: [{ dataUri: "https://x/y.png", alt: "x" }] }])).toThrow("invalid_booklet_image");
});

it("prints numbered crossword cells and hides solution words from the student copy", () => {
  const html = render([{
    ...q, kind: "structured", interaction_type: "crossword", context: undefined, images: [],
    payload: { rows: 3, cols: 3, clues: [{ id: "c", dir: "across", row: 1, col: 1, length: 3, text: "Denizde yol alan taşıt." }] },
    answer_key: { answers: { c: "BOT" } },
  }]);
  const [student, teacher] = html.split('<section class="key">');
  expect(student).toContain('<table class="grid crossword-grid">');
  expect(student).toContain("<td>1</td>");
  expect(student).toContain("Denizde yol alan taşıt.");
  expect(student).not.toContain("<b>BOT</b>");
  expect(teacher).toContain("<b>BOT</b>");
});
