import { validateGradeReport } from "./grade-report.ts";
const refs = new Map([["M1", { topic: "Kesirler", grade: true }], ["M2", {
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
