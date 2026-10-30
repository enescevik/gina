// Resimli v3 setlerinden (1254px lossless WebP kaynak) uygulama için hafif kopyalar ve Metro statik eşlemeleri üretir.
// Çalıştırma: node scripts/generate-illustrated.mjs  (repo kökünden; sharp kökte kurulu)
//
// Çıktılar (deterministik; her çalıştırmada aynı bayt):
//   packages/assets/generated/illustrated-v3/{kategori}/{slug}.webp   → 256px kare, alfa korunur
//   packages/assets/generated/illustrated-v3/{kategori}/index.json    → boyut/sha256 listesi (paket ölçümü)
//   apps/mobile/src/generated/illustrated/{kategori}.ts               → statik require eşlemesi
//
// Kaynaklar (packages/assets/**/illustrated-v3/) değiştirilmez; slug ve dosya yolu manifest.json'dan okunur,
// dosya uydurulmaz. Boyut: en büyük kullanım 96 dp rozet/kart; 256px @3x'te ~85 dp, @2x'te 128 dp keskinlik verir.
// 512px'e gerçek bir kullanım (ör. tam ekran ödül) çıkana kadar gerek yok; SIZES dizisine eklenebilir.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = join(root, "packages/assets/generated/illustrated-v3");
const MAP_ROOT = join(root, "apps/mobile/src/generated/illustrated");

/** Kategori → kaynak dizini ve üretilecek boyutlar (yalnız gereken). */
const CATEGORIES = [
  { name: "avatars", src: "packages/assets/avatars/illustrated-v3", sizes: [256] },
  { name: "tasks", src: "packages/assets/icons/tasks/illustrated-v3", sizes: [256] },
  { name: "subjects", src: "packages/assets/icons/subjects/illustrated-v3", sizes: [256] },
  { name: "events", src: "packages/assets/icons/events/illustrated-v3", sizes: [256] },
  { name: "gamification", src: "packages/assets/gamification/illustrated-v3", sizes: [256] },
];

// Tek boyut üretildiğinde dosya adı {slug}.webp; birden fazla boyutta {slug}-{size}.webp.
const fileName = (slug, size, sizes) => (sizes.length === 1 ? `${slug}.webp` : `${slug}-${size}.webp`);

const pascal = (s) => s.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

const only = process.argv.slice(2);
let grand = 0;

for (const cat of CATEGORIES) {
  if (only.length && !only.includes(cat.name)) continue;
  const srcDir = join(root, cat.src);
  const manifest = JSON.parse(readFileSync(join(srcDir, "manifest.json"), "utf8"));
  const outDir = join(OUT_ROOT, cat.name);
  // Dosyalar yerinde üzerine yazılır (çalışan Metro geçici olarak eksik dosya görmesin); artık dosyalar sonda silinir.
  mkdirSync(outDir, { recursive: true });

  const index = [];
  let total = 0;
  for (const entry of manifest) {
    const srcFile = join(srcDir, entry.file);
    if (!existsSync(srcFile)) throw new Error(`${cat.name}: manifestte olan kaynak yok: ${entry.file}`);
    const [x0, y0, x1, y1] = entry.content_bounds_alpha32 ?? [0, 0, entry.width, entry.height];
    // İçerik sınırına göre kırp (optik hizalama, %4 pay), sonra kareye contain ile sığdır: oran ve alfa korunur.
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
    const left = Math.max(0, x0 - pad);
    const top = Math.max(0, y0 - pad);
    const width = Math.min(entry.width - left, x1 - x0 + pad * 2);
    const height = Math.min(entry.height - top, y1 - y0 + pad * 2);
    for (const size of cat.sizes) {
      const buf = await sharp(srcFile)
        .extract({ left, top, width, height })
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 88, alphaQuality: 100, effort: 6 })
        .toBuffer();
      const name = fileName(entry.slug, size, cat.sizes);
      writeFileSync(join(outDir, name), buf);
      index.push({ slug: entry.slug, size, file: name, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") });
      total += buf.length;
    }
  }
  // Bu dizin yalnız bu scriptin çıktısıdır: manifestte artık olmayan eski slug dosyalarını kaldır.
  const keep = new Set([...index.map((i) => i.file), "index.json"]);
  for (const f of readdirSync(outDir)) if (!keep.has(f)) rmSync(join(outDir, f));
  writeFileSync(join(outDir, "index.json"), `${JSON.stringify({ source: cat.src, sizes: cat.sizes, total_bytes: total, files: index }, null, 2)}\n`);

  // Statik require eşlemesi (Metro dinamik require desteklemez). Varsayılan boyut: listedeki en büyük.
  const size = Math.max(...cat.sizes);
  const rel = `../../../../../packages/assets/generated/illustrated-v3/${cat.name}`;
  const lines = manifest.map((e) => `  "${e.slug}": require("${rel}/${fileName(e.slug, size, cat.sizes)}"),`);
  const typeName = `Illustrated${pascal(cat.name)}Slug`;
  const ts = [
    "// OTOMATİK ÜRETİLDİ: node scripts/generate-illustrated.mjs — elle düzenleme.",
    `// Kaynak: ${cat.src}/manifest.json (${manifest.length} slug, ${size}px WebP).`,
    "",
    `export const ILLUSTRATED_${cat.name.toUpperCase()} = {`,
    ...lines,
    "} as const;",
    "",
    `export type ${typeName} = keyof typeof ILLUSTRATED_${cat.name.toUpperCase()};`,
    "",
    `export const ILLUSTRATED_${cat.name.toUpperCase()}_SLUGS = Object.keys(ILLUSTRATED_${cat.name.toUpperCase()}) as ${typeName}[];`,
    "",
    `export function isIllustrated${pascal(cat.name)}Slug(slug: string | null | undefined): slug is ${typeName} {`,
    `  return !!slug && Object.prototype.hasOwnProperty.call(ILLUSTRATED_${cat.name.toUpperCase()}, slug);`,
    "}",
    "",
  ].join("\n");
  mkdirSync(MAP_ROOT, { recursive: true });
  writeFileSync(join(MAP_ROOT, `${cat.name}.ts`), ts);

  grand += total;
  console.log(`${cat.name}: ${manifest.length} slug × ${cat.sizes.join("/")}px = ${(total / 1024).toFixed(1)} KB`);
}
console.log(`toplam ${(grand / 1024).toFixed(1)} KB`);
