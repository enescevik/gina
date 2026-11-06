import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  buildGradePayload,
  GRADE_SYSTEM,
  type GradeQuestionRow,
  gradeSchema,
  sharedSourcePlan,
  validateGradeReport,
} from "./grade-report.ts";
import { runAiOperation } from "./ai-operation.ts";
const refs =new Map([["M1", { topic: "Kesirler", grade: true }], ["M2", {
  topic: "Uzunluk",
  grade: false,
}]]);
const sample = () => ({
  degerlendirmeler: [{
    ref: "M1",
    puan: 75,
    kisa_geri_bildirim: "Paydaları eşitlemeyi tekrar deneyelim.",
    eksikler: [],
    iyilestirme_onerileri: [],
  }],
  ozet: {
    guclu_konular: ["Uzunluk"],
    zayif_konular: ["Kesirler"],
    genel_oneri: "İki soruluk kısa bir çalışma.",
    konu_analizi: [{
      konu: "Kesirler",
      kanitlar: ["M1"],
      gozlem: "Bir adım eksik.",
      sonraki_adim: "Kesirleri çizerek karşılaştıralım.",
    }],
    calisma_adimlari: [{
      konu: "Kesirler",
      etkinlik: "İki kesri çiz.",
      sure_dk: 5,
      basari_olcutu: "Büyük olanı gerekçeyle seç.",
    }],
    veli_destegi: [],
    sinirlar: ["Yalnız iki soru değerlendirildi."],
  },
});
const rejects = (r: unknown) => {
  try {
    validateGradeReport(r, refs);
  } catch {
    return;
  }
  throw Error("invalid report accepted");
};
Deno.test("accepts source-grounded report", () => {
  validateGradeReport(sample(), refs);
});
Deno.test("rejects hallucinated references and topics", () => {
  const r = sample();
  r.ozet.konu_analizi[0].kanitlar = ["M99"];
  rejects(r);
  const t = sample();
  t.ozet.zayif_konular = ["Cebir"];
  rejects(t);
});
Deno.test("evidence must belong to the stated topic", () => {
  const r = sample();
  r.ozet.konu_analizi[0].kanitlar = ["M2"];
  rejects(r);
});
Deno.test("rejects duplicate scores and missing requested grades", () => {
  const r = sample();
  r.degerlendirmeler.push(r.degerlendirmeler[0]);
  rejects(r);
  const s = sample();
  s.degerlendirmeler = [];
  rejects(s);
});
Deno.test("rejects grading parent-reviewed or multiple choice questions", () => {
  const r = sample();
  r.degerlendirmeler[0].ref = "M2";
  rejects(r);
});
Deno.test("rejects excessive session duration and missing limitations", () => {
  const r = sample();
  r.ozet.calisma_adimlari[0].sure_dk = 120;
  rejects(r);
  const s = sample();
  s.ozet.sinirlar = [];
  rejects(s);
});

Deno.test("grade: unreadable material can remain explicitly ungraded", () => {
  const report: unknown = {
    ...sample(),
    degerlendirmeler: [{
      ...sample().degerlendirmeler[0],
      puan: null,
      kisa_geri_bildirim: "M1 görseli okunamıyor; veli kontrolü gerekiyor.",
    }],
  };
  if (validateGradeReport(report, refs).degerlendirmeler[0].puan !== null) {
    throw Error("must not invent zero score");
  }
});

Deno.test("P04: an item not requested for grading (blank answer) cannot receive a score, not even 0", () => {
  const r = sample();
  r.degerlendirmeler.push({ ref: "M2", puan: 0, kisa_geri_bildirim: "Boş.", eksikler: [], iyilestirme_onerileri: [] });
  rejects(r);
  const z = sample();
  z.degerlendirmeler = [{ ref: "M2", puan: 0, kisa_geri_bildirim: "Boş.", eksikler: [], iyilestirme_onerileri: [] }];
  rejects(z);
});

Deno.test("D5: invalid reports carry a fixed rule name for diagnostics, never content", () => {
  const code = (r: unknown) => {
    try {
      validateGradeReport(r, refs);
    } catch (e) {
      if ((e as Error).message !== "ai_result_invalid") throw e;
      return (e as { validationCode?: string }).validationCode;
    }
    throw Error("invalid report accepted");
  };
  const count = sample();
  count.degerlendirmeler = [];
  const evidence = sample();
  evidence.ozet.konu_analizi[0].kanitlar = ["M1: paydaları eşitlemedi"];
  const topic = sample();
  topic.ozet.zayif_konular = ["Kesirlerde toplama"];
  const steps = sample();
  steps.ozet.calisma_adimlari[0].sure_dk = 30;
  const limits = sample();
  limits.ozet.sinirlar = [];
  const item = sample();
  item.degerlendirmeler[0].kisa_geri_bildirim = " ";
  const got = [count, evidence, topic, steps, limits, item].map(code).join();
  if (got !== "envelope,evidence,topic,steps,fields,item") throw Error(got);
});

// ---------------------------------------------------------------------------------------------------------------
// D6/B1 — gerçekçi model çıktısı fixture'ları. Soru/konu yapısı D5'in A ve C denemeleriyle aynı (stage-prova.json,
// run-d5.mjs). Model çıktısı D5'te saklanmadığı için içerik D5 prova-review gerçek çıktısının biçimine (aynı soru
// için 5 maddelik kanıt listesi, uzun sınır notu) göre kuruldu; sentetiktir, gerçek çağrı yoktur.
type Refs = Map<string, { topic: string; grade: boolean }>;
function check(value: unknown, message = "assertion failed"): asserts value {
  if (!value) throw Error(message);
}
const ruleOf = (r: unknown, rs: Refs) => {
  try {
    validateGradeReport(r, rs);
  } catch (e) {
    if ((e as Error).message !== "ai_result_invalid") throw e;
    return (e as { validationCode?: string }).validationCode ?? "?";
  }
  return "accepted";
};
// C denemesi: ortak kaynaklı grup (Çevre, Alan) + rubrikli Kesirler sorusu; üçü de cevaplı açık uçlu.
const refsC: Refs = new Map([
  ["M1", { topic: "Çevre", grade: true }],
  ["M2", { topic: "Alan", grade: true }],
  ["M3", { topic: "Kesirler", grade: true }],
]);
// A denemesi: aynı üç soru + AI'nın ürettiği 2 şıklı (puanlama_gerekli=false) ve 1 açık uçlu Kesirler sorusu.
const refsA: Refs = new Map([
  ["M1", { topic: "Çevre", grade: true }],
  ["M2", { topic: "Alan", grade: true }],
  ["M3", { topic: "Kesirler", grade: true }],
  ["M4", { topic: "Kesirler", grade: false }],
  ["M5", { topic: "Kesirler", grade: false }],
  ["M6", { topic: "Kesirler", grade: true }],
]);
const graded = (ref: string, puan: number | null, eksikler: string[] = [], oneriler: string[] = []) => ({
  ref,
  puan,
  kisa_geri_bildirim: puan === null
    ? "Soru metninde kenar uzunlukları yok; ortak metin verilmediği için puan verilemedi."
    : "Cevap beklenen cevapla karşılaştırıldı; gerekçe aşağıda.",
  eksikler,
  iyilestirme_onerileri: oneriler,
});
const realisticC = () => ({
  degerlendirmeler: [
    graded("M1", 20, ["Yalnız iki kenar toplandı.", "Çevrenin tüm kenarların toplamı olduğu yazılmadı."], [
      "Dikdörtgenin dört kenarını çizip tek tek topla.",
    ]),
    graded("M2", 95, [], [""]),
    // D5 prova-review gerçek çıktısı aynı soru için 5 kanıt maddesi yazdı; v3 istemi eksikleri sınırlamıyordu.
    graded("M3", 60, [
      "2/4 kesri yazılmamış.",
      "Sadeleştirme işlemi gösterilmemiş.",
      "1/2 kesir olarak yazılmamış.",
      "Rubrikteki 40 puanlık ölçüt karşılanmadı.",
    ], ["Önce kesri yaz, sonra sadeleştir.", "Pay ve paydayı aynı sayıya böl.", "Sonucu kesir olarak yaz.", "Şekil çiz."]),
  ],
  ozet: {
    guclu_konular: ["Alan"],
    zayif_konular: ["Çevre", "Kesirler"],
    genel_oneri:
      "Bu denemede üç açık uçlu soru değerlendirildi. Alan hesabı doğru ve işlem gösterilmiş. Çevre sorusunda tüm kenarları toplamak gerekiyor. Kesirlerde sonuç doğru, ancak kesir yazımı ve sadeleştirme adımı eksik. Bir sonraki adımda çevre ve kesir yazımı birlikte çalışılabilir.",
    konu_analizi: [
      { konu: "Çevre", kanitlar: ["M1"], gozlem: "İki kenar toplanmış; kavram yanılgısı ya da dikkat hatası olabilir.", sonraki_adim: "Dört kenarı çizerek topla." },
      { konu: "Alan", kanitlar: ["M2"], gozlem: "Alan formülü doğru uygulanmış.", sonraki_adim: "Farklı ölçülerle pekiştir." },
      { konu: "Kesirler", kanitlar: ["M3", "M3"], gozlem: "Eşdeğer cevap doğru; kesir gösterimi eksik.", sonraki_adim: "Kesir yaz ve sadeleştir." },
    ],
    calisma_adimlari: [
      { konu: "Çevre", etkinlik: "Dikdörtgen çiz, dört kenarı yaz ve topla.", sure_dk: 10, basari_olcutu: "Üç dikdörtgenin çevresini doğru bulur." },
      { konu: "Kesirler", etkinlik: "Pasta modelinde kesir yaz ve sadeleştir.", sure_dk: 15, basari_olcutu: "Dört kesri doğru sadeleştirir." },
      { konu: "Alan", etkinlik: "Kareli kâğıtta alan say.", sure_dk: 5, basari_olcutu: "Sayımla formül sonucunu karşılaştırır." },
      { konu: "Kesirler", etkinlik: "Eş kesir kartları eşleştir.", sure_dk: 10, basari_olcutu: "Beş eşleşmeyi doğru yapar." },
      { konu: "Çevre", etkinlik: "Masanın çevresini ölç.", sure_dk: 20, basari_olcutu: "Ölçümü toplamla doğrular." },
    ],
    veli_destegi: ["Birlikte bir dikdörtgen çizin.", "Kesirleri mutfakta gösterin.", "Doğru adımları övün."],
    sinirlar: [
      "Yalnız üç soru değerlendirildi.",
      "Sonuçlar yalnız bu denemeye dayanır.",
      "Çevre ve alan sorularının ortak metni verilmedi.",
      "Öğrenci zihinden hesaplamış olabilir.",
      "MEB uyumu doğrulanmadı.",
      "Bu sonuç yalnız veliye öneridir.",
    ],
  },
});

Deno.test("D6/B1: realistic attempt C output is accepted and normalized to the prompt limits", () => {
  const out = validateGradeReport(realisticC(), refsC);
  check(out.degerlendirmeler.length === 3);
  check(out.degerlendirmeler[2].eksikler.length === 3 && out.degerlendirmeler[2].iyilestirme_onerileri.length === 3, "lists cut to 3");
  check(out.degerlendirmeler[1].iyilestirme_onerileri.length === 0, "blank suggestion dropped, not rejected");
  check(out.ozet.sinirlar.length === 5 && out.ozet.calisma_adimlari.length === 4, "presentation caps");
  check(out.ozet.konu_analizi[2].kanitlar.join() === "M3", "evidence deduplicated");
  // Önbellek yolu (job.cached) aynı doğrulayıcıdan geçer: normalleştirilmiş çıktı yeniden kabul edilir ve değişmez.
  check(JSON.stringify(validateGradeReport(out, refsC)) === JSON.stringify(out), "idempotent for cached replay");
});

Deno.test("D6/B1: attempt A (multiple choice not requested) accepts only the requested open answers", () => {
  const r = realisticC();
  r.degerlendirmeler.push(graded("M6", 100));
  r.ozet.konu_analizi[2].kanitlar = ["M3", "M4", "M6"];
  const out = validateGradeReport(r, refsA);
  check(out.degerlendirmeler.map((g) => g.ref).join() === "M1,M2,M3,M6");
  check(out.ozet.konu_analizi[2].kanitlar.join() === "M3,M4,M6", "MC refs are valid evidence of their topic");
});

Deno.test("D6/B1: harmless topic spelling differences map to the canonical name; invented topics do not", () => {
  const r = realisticC();
  r.ozet.zayif_konular = [" çevre", "KESİRLER"];
  r.ozet.konu_analizi[0].konu = "Çevre ";
  const out = validateGradeReport(r, refsC);
  check(out.ozet.zayif_konular.join() === "Çevre,Kesirler" && out.ozet.konu_analizi[0].konu === "Çevre", JSON.stringify(out.ozet.zayif_konular));
  const merged = realisticC();
  merged.ozet.konu_analizi[0].konu = "Çevre ve alan";
  check(ruleOf(merged, refsC) === "topic");
  const sub = realisticC();
  sub.ozet.calisma_adimlari[0].konu = "Genel tekrar";
  check(ruleOf(sub, refsC) === "topic");
});

Deno.test("D6/B1: broken or partial output is still rejected with a fixed rule name", () => {
  type R = ReturnType<typeof realisticC>;
  const cases: [string, (r: R) => unknown, Refs][] = [
    ["envelope", () => '{"degerlendirmeler": [', refsC],
    ["envelope", () => null, refsC],
    ["envelope", (r) => ({ ...r, degerlendirmeler: r.degerlendirmeler.slice(0, 2) }), refsC], // kısmi: bir madde eksik
    ["item", (r) => ({ ...r, degerlendirmeler: [r.degerlendirmeler[0], r.degerlendirmeler[1], { ...r.degerlendirmeler[2], ref: "M9" }] }), refsC],
    ["item", (r) => ({ ...r, degerlendirmeler: [r.degerlendirmeler[0], r.degerlendirmeler[1], { ...r.degerlendirmeler[2], puan: 150 }] }), refsC],
    ["item", (r) => ({ ...r, degerlendirmeler: [r.degerlendirmeler[0], r.degerlendirmeler[1], { ...r.degerlendirmeler[2], eksikler: [3] }] }), refsC],
    ["item", (r) => ({ ...r, degerlendirmeler: [r.degerlendirmeler[0], r.degerlendirmeler[1], r.degerlendirmeler[2], graded("M4", 0)] }), refsA], // istenmeyen şıklı madde
    ["fields", (r) => ({ ...r, ozet: undefined }), refsC],
    ["fields", (r) => ({ ...r, ozet: { ...r.ozet, sinirlar: [" "] } }), refsC],
    ["fields", (r) => ({ ...r, ozet: { ...r.ozet, konu_analizi: [] } }), refsC],
    ["evidence", (r) => ({ ...r, ozet: { ...r.ozet, konu_analizi: [{ ...r.ozet.konu_analizi[0], kanitlar: ["M1: iki kenar toplandı"] }] } }), refsC],
    ["evidence", (r) => ({ ...r, ozet: { ...r.ozet, konu_analizi: [{ ...r.ozet.konu_analizi[0], kanitlar: ["M2"] }] } }), refsC],
    ["evidence", (r) => ({ ...r, ozet: { ...r.ozet, konu_analizi: [{ ...r.ozet.konu_analizi[0], kanitlar: [] }] } }), refsC],
    ["steps", (r) => ({ ...r, ozet: { ...r.ozet, calisma_adimlari: [{ ...r.ozet.calisma_adimlari[0], sure_dk: 45 }] } }), refsC],
    ["steps", (r) => ({ ...r, ozet: { ...r.ozet, calisma_adimlari: [{ ...r.ozet.calisma_adimlari[0], sure_dk: 7.5 }] } }), refsC],
  ];
  const got = cases.map(([, make, rs]) => ruleOf(make(realisticC()), rs));
  check(got.join() === cases.map(([c]) => c).join(), got.join());
});

Deno.test("D6/B1: per-request schema pins refs, topics and evidence to the payload values", () => {
  // deno-lint-ignore no-explicit-any
  const s = gradeSchema(refsA) as any;
  const g = s.properties.degerlendirmeler.items.properties;
  check(JSON.stringify(g.ref.enum) === '["M1","M2","M3","M6"]', "only requested refs can be graded");
  const o = s.properties.ozet.properties;
  for (const t of [o.guclu_konular.items, o.zayif_konular.items, o.konu_analizi.items.properties.konu, o.calisma_adimlari.items.properties.konu]) {
    check(JSON.stringify(t.enum) === '["Çevre","Alan","Kesirler"]', JSON.stringify(t));
  }
  check(JSON.stringify(o.konu_analizi.items.properties.kanitlar.items.enum) === '["M1","M2","M3","M4","M5","M6"]');
  // Her nesne düzeyinde tüm alanlar zorunlu ve ek alan yok (structured output sözleşmesi).
  // deno-lint-ignore no-explicit-any
  const walk = (n: any): void => {
    if (n?.type === "object") {
      check(n.additionalProperties === false && JSON.stringify(n.required) === JSON.stringify(Object.keys(n.properties)));
      Object.values(n.properties).forEach(walk);
    }
    if (n?.type === "array") walk(n.items);
  };
  walk(s);
  // Puanlanacak madde yoksa boş enum (geçersiz şema) yazılmaz.
  // deno-lint-ignore no-explicit-any
  const none = gradeSchema(new Map([["M1", { topic: "Kesirler", grade: false }]])) as any;
  check(!("enum" in none.properties.degerlendirmeler.items.properties.ref));
  // İstem doğrulayıcının kurallarını açıkça söyler.
  for (const rule of ["en çok 3 somut eksik", "birebir yaz", "kanitlar yalnız", "sure_dk 5 ile 20", "sinirlar en az 1, en çok 5", "100 üzerinden"]) {
    check(GRADE_SYSTEM.includes(rule), rule);
  }
});

Deno.test("D6/B1: invalid paid grade output is saved uncertain with its rule; no second paid call", async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let reservations = 0;
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "reserve_ai_operation") {
        reservations++;
        // İkinci istek: iş belirsiz kaldığı için rezervasyon yeni ücretli çağrıya izin vermez.
        return Promise.resolve({ data: reservations === 1 ? { id: "job", lease: "l" } : { error: "ai_result_uncertain" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;
  const bad = realisticC();
  bad.ozet.konu_analizi[0].kanitlar = ["M1: iki kenar toplandı"];
  const original = globalThis.fetch;
  const requests: string[] = [];
  const responses = [
    new Response(JSON.stringify({ input_tokens: 900 })),
    new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(bad) }], usage: { input_tokens: 900, output_tokens: 700 } })),
  ];
  globalThis.fetch = (input) => {
    requests.push(String(input));
    const next = responses.shift();
    return next ? Promise.resolve(next) : Promise.reject(Error("unexpected paid call"));
  };
  try {
    const config = { model: "synthetic-model", promptVersion: "test", maxInputTokens: 8000, maxOutputTokens: 4000 };
    const run = () =>
      runAiOperation(db, { familyId: "f", userId: "u" }, "grade", "attempt", "k", config, GRADE_SYSTEM, "{}", gradeSchema(refsC), (v) => validateGradeReport(v, refsC));
    const first = await run();
    check(first instanceof Response && first.status === 502);
    const finish = calls.find((c) => c.name === "finish_ai_operation")!.args;
    check(finish.p_uncertain === true && finish.p_error === "ai_result_invalid_evidence", JSON.stringify(finish));
    const second = await run();
    check(second instanceof Response && second.status === 409);
    check(requests.length === 2, `provider requests ${requests.length}`);
  } finally {
    globalThis.fetch = original;
  }
});

// ---------------------------------------------------------------------------------------------------------------
// D9: grup sorularının ortak metni/tablosu puanlama yükünde bir kez; bağlı maddeler `ortak_kaynak` ref'iyle.
// D1/D5 tablo fixture'ı (generation-result.test.ts ile aynı): ortak TABLO, bitişik olmayan 1. ve 4. soruya bağlı.
const d5Table = "Cisim | Dinamometre (N)\nA | 4\nB | 7\nC | 10";
const p1 = "Tablodaki cisimlerden hangisine en büyük kuvvet uygulanmıştır?";
const p4 = "Tabloda verilen değerlere göre A ile C arasındaki fark kaç newtondur?";
const open = (id: string, stem: string, provenance: unknown = { generator: "ai" }): GradeQuestionRow => ({
  id, topic: "Kuvvetin ölçülmesi", kind: "open_ended", stem, choices: [], correct_key: null,
  expected_answer: "Beklenen", solution: "Çözüm", provenance,
});
const ids = ["q1", "q2", "q3", "q4"];
const d1Questions = [
  open("q1", `Ortak tablo\n${d5Table}\n\n${p1}`),
  open("q2", "Dinamometre hangi ilkeyle çalışır?"),
  open("q3", "Kuvvetin birimi nedir?"),
  open("q4", `Ortak tablo\n${d5Table}\n\n${p4}`),
];
const d1Members = [
  { question_id: "q1", prompt: p1, source_group: { id: "g1", title: "Ortak tablo", body: d5Table } },
  { question_id: "q4", prompt: p4, source_group: { id: "g1", title: "Ortak tablo", body: d5Table } },
];
const answered = ids.map((id) => ({ question_id: id, answer_text: "C cismi" }));

Deno.test("D9: D1 group — shared table sent once, linked non-adjacent items reference it, prompts kept apart", () => {
  const { payload, refs } = buildGradePayload(ids, d1Questions, answered, d1Members);
  // deno-lint-ignore no-explicit-any
  const p = payload as any;
  check(p.ortak_kaynaklar.length === 1, JSON.stringify(p.ortak_kaynaklar));
  check(JSON.stringify(p.ortak_kaynaklar[0]) === JSON.stringify({ kaynak: "K1", baslik: "Ortak tablo", icerik: d5Table, maddeler: ["M1", "M4"] }));
  check(p.maddeler[0].ortak_kaynak === "K1" && p.maddeler[0].soru === p1);
  check(p.maddeler[3].ortak_kaynak === "K1" && p.maddeler[3].soru === p4);
  check(!("ortak_kaynak" in p.maddeler[1]) && p.maddeler[1].soru === "Dinamometre hangi ilkeyle çalışır?");
  check(JSON.stringify(payload).split("Dinamometre (N)").length === 2, "table must appear exactly once");
  // Refs (şema/kanıt enum'u) yalnız madde ref'leri; K ref'i hiçbir enum'a girmez.
  check(JSON.stringify([...refs.keys()]) === '["M1","M2","M3","M4"]');
  const schema = JSON.stringify(gradeSchema(refs));
  check(!schema.includes('"K1"'), "shared source ref leaked into the schema");
  check(GRADE_SYSTEM.includes("ortak_kaynaklar") && GRADE_SYSTEM.includes("Kaynak ref'lerini"), "prompt must explain shared sources");
});

Deno.test("D9: legacy v5 (table only in provenance) and v6 ungrouped self-contained rows also send the source once", () => {
  const shared = { id: "tablo_1", kind: "table", content: d5Table };
  // v5: gövde yalnız soru, tablo yalnız provenance'ta (D5'te çocuğa eksik giden biçim).
  const v5 = [open("q1", p1, { generator: "ai", shared_source_id: "tablo_1", shared_source: shared }),
    open("q2", p4, { generator: "ai", shared_source_id: "tablo_1", shared_source: shared })];
  const a = sharedSourcePlan(["q1", "q2"], (id) => (id === "q1" ? "M1" : "M2"), v5, []);
  check(a.sources.length === 1 && a.sources[0].baslik === "Ortak kaynak" && a.sources[0].icerik === d5Table);
  check(a.byQuestion.get("q2")!.soru === p4 && a.byQuestion.get("q2")!.kaynak === "K1");
  // v6, grup kurulamadı (bayrak kapalı): gövde kendi başına okunur biçimde, shared_prompt ayrı.
  const v6 = (id: string, prompt: string) =>
    open(id, `Ortak tablo\n${d5Table}\n\n${prompt}`, {
      generator: "ai", shared_source_id: "tablo_1", shared_source: shared, shared_source_title: "Ortak tablo", shared_prompt: prompt,
    });
  const b = sharedSourcePlan(["q1", "q2"], (id) => (id === "q1" ? "M1" : "M2"), [v6("q1", p1), v6("q2", p4)], []);
  check(b.sources.length === 1 && b.sources[0].baslik === "Ortak tablo" && JSON.stringify(b.sources[0].maddeler) === '["M1","M2"]');
  check(b.byQuestion.get("q1")!.soru === p1);
  // Gövde metni başka biçimde taşıyor: kaynaksız, gövde aynen (bilgi kaybı ya da çift gönderim yok).
  const odd = open("q1", `Önce tabloyu oku:\n${d5Table}\n${p1}`, { generator: "ai", shared_source_id: "tablo_1", shared_source: shared, shared_prompt: p1 });
  check(sharedSourcePlan(["q1"], () => "M1", [odd], []).sources.length === 0);
  // Veli sorusu provenance'ı (generator: parent) hiçbir zaman kaynak üretmez; yalnız D1 grubu üretir.
  check(sharedSourcePlan(["q1"], () => "M1", [open("q1", p1, { generator: "parent", shared_source: shared })], []).sources.length === 0);
});

Deno.test("D9: payload without groups keeps the D6 shape; masking covers shared content", () => {
  const plain: GradeQuestionRow[] = [
    open("q1", "Dikdörtgenin çevresi kaç cm'dir?"),
    { ...open("q2", "Hangisi kesirdir?"), kind: "multiple_choice", choices: [{ key: "A", text: "1/2" }], correct_key: "A" },
  ];
  const ans = [{ question_id: "q1", answer_text: "28" }, { question_id: "q2", answer_key: "A", is_correct: true }];
  const { payload } = buildGradePayload(["q1", "q2"], plain, ans, []);
  // D6 (v4) prova-grade/index.ts içindeki eski satır içi yükün alan sırası.
  check(JSON.stringify(Object.keys(payload)) === '["maddeler"]');
  check(JSON.stringify(Object.keys(payload.maddeler[0])) === JSON.stringify([
    "ref", "konu", "tur", "soru", "beklenen_cevap", "cozum_yolu", "alternatif_dogru_cevaplar", "rubrik", "degerlendirme_amaci", "secenekler",
    "dogru_secim", "secilen", "dogru_mu", "puanlama_gerekli", "veli_puani", "ogrenci_cevabi",
  ]), JSON.stringify(Object.keys(payload.maddeler[0])));
  check(!("alternatif_dogru_cevaplar" in payload.maddeler[1]) && payload.maddeler[1].puanlama_gerekli === false);
  const mask = (t: string) => t.replaceAll("Deniz", "[ad]");
  const group = { id: "g", title: "Ortak metin", body: "Deniz dinamometreyle ölçtü." };
  const named = [{ question_id: "q1", prompt: "Deniz kaç N ölçtü?", source_group: group },
    { question_id: "q2", prompt: "Deniz hangi birimi kullandı?", source_group: group }];
  const masked = JSON.stringify(buildGradePayload(["q1", "q2"], [open("q1", "x"), open("q2", "y")], answered, named, mask).payload);
  check(!masked.includes("Deniz") && masked.includes("[ad] dinamometreyle"), masked);
});

Deno.test("D9: same group attempt builds the same paid-job hash; a repeat after an invalid result is not charged again", async () => {
  const build = () => JSON.stringify(buildGradePayload(ids, d1Questions, answered, d1Members).payload);
  check(build() === build(), "payload must be deterministic");
  const hashes: unknown[] = [];
  let reservations = 0;
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name === "reserve_ai_operation") {
        reservations++;
        hashes.push(args.p_hash);
        return Promise.resolve({ data: reservations === 1 ? { id: "job", lease: "l" } : { error: "ai_result_uncertain" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;
  const { refs } = buildGradePayload(ids, d1Questions, answered, d1Members);
  const original = globalThis.fetch;
  let requests = 0;
  const responses = [
    new Response(JSON.stringify({ input_tokens: 900 })),
    new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], usage: { input_tokens: 900, output_tokens: 10 } })),
  ];
  globalThis.fetch = () => {
    requests++;
    const next = responses.shift();
    return next ? Promise.resolve(next) : Promise.reject(Error("unexpected paid call"));
  };
  try {
    const config = { model: "synthetic-model", promptVersion: "test", maxInputTokens: 8000, maxOutputTokens: 4000 };
    const run = () =>
      runAiOperation(db, { familyId: "f", userId: "u" }, "grade", "attempt", "k", config, GRADE_SYSTEM, build(), gradeSchema(refs), (v) => validateGradeReport(v, refs));
    const first = await run();
    check(first instanceof Response && first.status === 502);
    const second = await run();
    check(second instanceof Response && second.status === 409);
    check(hashes.length === 2 && hashes[0] === hashes[1], "repeat must hit the same job");
    check(requests === 2, `provider requests ${requests}`);
  } finally {
    globalThis.fetch = original;
  }
});

// ---------------------------------------------------------------------------------------------------------------
// D13: amaç duyarlı puanlama (prova-grade/v7-purpose-aware). Canlı vaka: "Pastanın yarısı yenmiş, yani 0,5." rubrik
// [2/4 yazar 40, 1/2 sadeleştirir ya da yarısı der 60]. Yalnız sonuç → tam puan; süreç → ölçütlere göre kısmi.
import { REVIEW_SYSTEM } from "./review-report.ts";
const pastaRubric = (assesses?: string) => ({
  generator: "ai",
  rubric: {
    criteria: [{ text: "Yenen kısmı 2/4 olarak yazar", points: 40 }, { text: "Kesri 1/2 olarak sadeleştirir ya da yarısı der", points: 60 }],
    alternative_answers: ["0,5", "yarısı"],
    ...(assesses === undefined ? {} : { assesses }),
  },
});
Deno.test("D13: grading payload carries the question purpose (result / process / infer for legacy)", () => {
  const qs: GradeQuestionRow[] = [
    open("q1", "4 dilimlik pastanın 2 dilimi yendi. Pastanın ne kadarı yendi?", pastaRubric("result")),
    open("q2", "4 dilimlik pastanın 2 dilimi yendi. Yenen kısmı kesirle yaz, sadeleştir ve işlemini göster.", pastaRubric("process")),
    open("q3", "Eski soru", pastaRubric()),
    open("q4", "Bozuk alan", pastaRubric("everything")),
    open("q5", "Veli sorusu, rubriksiz", { generator: "parent" }),
    { ...open("q6", "Hangisi kesirdir?"), kind: "multiple_choice", choices: [{ key: "A", text: "1/2" }], correct_key: "A" },
  ];
  const ans = ["q1", "q2", "q3", "q4", "q5"].map((id) => ({ question_id: id, answer_text: "Pastanın yarısı yenmiş, yani 0,5." }))
    .concat([{ question_id: "q6", answer_text: "" }]);
  const { payload } = buildGradePayload(qs.map((q) => q.id), qs, ans, []);
  // deno-lint-ignore no-explicit-any
  const m = payload.maddeler as any[];
  check(JSON.stringify(m.map((x) => x.degerlendirme_amaci ?? null)) ===
    JSON.stringify(["sonuc", "surec", "sorudan_cikar", "sorudan_cikar", "sorudan_cikar", null]), JSON.stringify(m.map((x) => x.degerlendirme_amaci)));
  check(m.slice(0, 5).every((x) => x.puanlama_gerekli === true));
  // Süreç maddesinde de alternatifler ve rubrik aynen gider (sonuç ölçütü için doğru sayılır).
  check(JSON.stringify(m[1].alternatif_dogru_cevaplar) === '["0,5","yarısı"]' && m[1].rubrik.length === 2);
});
Deno.test("D13: grade and review prompts state both purpose branches and the stem-inference default", () => {
  for (const [name, prompt] of [["grade", GRADE_SYSTEM], ["review", REVIEW_SYSTEM]] as const) {
    for (
      const rule of [
        "degerlendirme_amaci",
        '"sonuc": soru yalnız sonucu ölçer',
        "ara adımları ya da rubrikteki ara gösterimi yazmamış olsa bile tam doğru say (90–100)",
        '"surec": soru işlem adımlarını, gerekçeyi ya da belirli bir gösterimi ölçer',
        "doğru son cevap yalnız gerçekten karşıladığı ölçütlerin puanını alır",
        "Alternatif cevaplar sonuç ölçütü için doğru sayılır",
        '"sorudan_cikar": amaç belirtilmemiştir; sorunun metninden karar ver',
      ]
    ) check(prompt.includes(rule), `${name}: ${rule}`);
    // v6'nın koşulsuz "adımsız da tam puan" cümlesi kalktı (artık yalnız "sonuc" dalında).
    check(!prompt.includes("veriyorsa, ara adımları ya da rubrikteki ara gösterimi yazmamış olsa bile tam doğru say (90–100). rubrik verilmişse"), name);
    check(!prompt.includes("${"), `${name}: template interpolated`);
  }
});
