// D6/B3 — Rubrik puan ölçeği. Veli rubriği ve açık uçlu puan 0–100 üzerindendir; AI üretimi ölçütleri çoğu zaman
// küçük puanlarla (ör. 1–2, soru başına toplam 5–6) yazar. AI rubriği okunurken toplam 100'e oranlanır, böylece
// inceleme ekranı ve AI puanlama istemi aynı ölçeği görür. Saklanan satır değişmez; veli rubriği olduğu gibi kalır.
// Bağımlılıksızdır: Edge (Deno) bu dosyayı göreli yolla içe aktarır.

export interface RubricCriterionPoints {
  points: number;
}

/** Toplamı 100'e oranlar (en büyük kalan yöntemi, tam sayı). Toplam 0 ya da zaten 100 ise dokunmaz. */
export function scaleRubricTo100<T extends RubricCriterionPoints>(criteria: T[]): T[] {
  const valid = (p: number) => (Number.isFinite(p) && p > 0 ? p : 0);
  const total = criteria.reduce((n, c) => n + valid(c.points), 0);
  if (!criteria.length || total <= 0 || total === 100) return criteria;
  const raw = criteria.map((c) => (valid(c.points) * 100) / total);
  const floors = raw.map(Math.floor);
  let rest = 100 - floors.reduce((n, v) => n + v, 0);
  const order = raw
    .map((v, i) => ({ i, v, frac: v - Math.floor(v) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    rest--;
  }
  return criteria.map((c, i) => ({ ...c, points: floors[i] ?? 0 }));
}

/** Yalnız AI üretimi rubrik ölçeklenir (provenance.generator === "ai"); veli rubriği olduğu gibi kalır. */
export function rubricNeedsScaling(provenance: unknown): boolean {
  return !!provenance && typeof provenance === "object" &&
    (provenance as { generator?: unknown }).generator === "ai";
}
