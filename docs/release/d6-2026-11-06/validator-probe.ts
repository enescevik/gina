// D6 probe: which v3 (D5-deployed) validator rule rejects each realistic output shape, and does v4 accept it?
import { validateGradeReport as oldV } from "./old-grade-report.ts";
import { validateGradeReport as newV } from "file:///Users/enes/Documents/projs/gina/.claude/worktrees/agent-a806f94b1487b5558/supabase/functions/_shared/grade-report.ts";

type Refs = Map<string, { topic: string; grade: boolean }>;
const refsC: Refs = new Map([
  ["M1", { topic: "Çevre", grade: true }],
  ["M2", { topic: "Alan", grade: true }],
  ["M3", { topic: "Kesirler", grade: true }],
]);
const base = () => ({
  degerlendirmeler: [
    { ref: "M1", puan: 20, kisa_geri_bildirim: "x", eksikler: ["a"], iyilestirme_onerileri: ["b"] },
    { ref: "M2", puan: 95, kisa_geri_bildirim: "x", eksikler: [], iyilestirme_onerileri: [] },
    { ref: "M3", puan: 60, kisa_geri_bildirim: "x", eksikler: ["a"], iyilestirme_onerileri: ["b"] },
  ],
  ozet: {
    guclu_konular: ["Alan"], zayif_konular: ["Çevre", "Kesirler"], genel_oneri: "x",
    konu_analizi: [
      { konu: "Çevre", kanitlar: ["M1"], gozlem: "x", sonraki_adim: "y" },
      { konu: "Alan", kanitlar: ["M2"], gozlem: "x", sonraki_adim: "y" },
      { konu: "Kesirler", kanitlar: ["M3"], gozlem: "x", sonraki_adim: "y" },
    ],
    calisma_adimlari: [{ konu: "Çevre", etkinlik: "x", sure_dk: 10, basari_olcutu: "y" }],
    veli_destegi: ["x"], sinirlar: ["x"],
  },
});
const rule = (f: typeof oldV, v: unknown) => {
  try { f(v, refsC); return "accepted"; } catch (e) { return (e as { validationCode?: string }).validationCode ?? (e as Error).message; }
};
// deno-lint-ignore no-explicit-any
const variants: [string, (r: any) => void][] = [
  ["eksikler 4 (istem v3 eksik sayısını sınırlamıyordu)", (r) => { r.degerlendirmeler[2].eksikler = ["a", "b", "c", "d"]; }],
  ["iyilestirme 4", (r) => { r.degerlendirmeler[2].iyilestirme_onerileri = ["a", "b", "c", "d"]; }],
  ["tam doğru cevapta eksikler [\"\"]", (r) => { r.degerlendirmeler[1].eksikler = [""]; }],
  ["sinirlar 6 (istem 4+ konu + puansız madde refi istiyor)", (r) => { r.ozet.sinirlar = ["1", "2", "3", "4", "5", "6"]; }],
  ["calisma_adimlari 5", (r) => { r.ozet.calisma_adimlari = Array(5).fill(r.ozet.calisma_adimlari[0]); }],
  ["kanitlar açıklamalı (M1: ...)", (r) => { r.ozet.konu_analizi[0].kanitlar = ["M1: iki kenar topladı"]; }],
  ["birleştirilmiş konu (Çevre ve alan)", (r) => { r.ozet.konu_analizi.splice(0, 2, { konu: "Çevre ve alan", kanitlar: ["M1", "M2"], gozlem: "x", sonraki_adim: "y" }); }],
  ["konu adı küçük harf (çevre)", (r) => { r.ozet.zayif_konular = ["çevre", "Kesirler"]; }],
  ["pekiştirme adımı konusu 'Genel tekrar'", (r) => { r.ozet.calisma_adimlari[0].konu = "Genel tekrar"; }],
  ["şıklı/istenmeyen madde değerlendirildi", (r) => { r.degerlendirmeler.push({ ...r.degerlendirmeler[0], ref: "M4" }); }],
  ["sure_dk 25", (r) => { r.ozet.calisma_adimlari[0].sure_dk = 25; }],
];
const rows = variants.map(([name, mutate]) => {
  const r = base(); mutate(r);
  return { variant: name, v3_deployed: rule(oldV, r), v4_d6: rule(newV, r) };
});
console.log(JSON.stringify({ baseline: { v3: rule(oldV, base()), v4: rule(newV, base()) }, rows }, null, 1));
