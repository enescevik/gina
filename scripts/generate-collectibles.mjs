// ESKİ: Collectible artık scripts/generate-illustrated.mjs çıktısını kullanır (aynı kırpma/kalite, bayt bayt aynı WebP).
// apps/mobile/assets/collectibles artık referans edilmiyor; silinmesi sahibin onayına bırakıldı.
// Resimli v3 koleksiyon görsellerinden (1254px kaynak, ~0.7 MB) uygulama için hafif kopyalar üretir.
// Çalıştırma: node scripts/generate-collectibles.mjs → apps/mobile/assets/collectibles/{slug}.webp (256px, alfa korunur)
// Kaynaklar packages/assets/gamification/illustrated-v3/ altında kalır; README: "yalnız gerekli görselleri yükle".

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "packages/assets/gamification/illustrated-v3");
const OUT = join(root, "apps/mobile/assets/collectibles");
const SIZE = 256;

const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8"));
mkdirSync(OUT, { recursive: true });

let total = 0;
for (const entry of manifest) {
  const [x0, y0, x1, y1] = entry.content_bounds_alpha32 ?? [0, 0, entry.width, entry.height];
  // İçerik sınırına göre kırp (optik hizalama), sonra kareye contain ile sığdır.
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  const left = Math.max(0, x0 - pad);
  const top = Math.max(0, y0 - pad);
  const width = Math.min(entry.width - left, x1 - x0 + pad * 2);
  const height = Math.min(entry.height - top, y1 - y0 + pad * 2);
  const buf = await sharp(join(SRC, entry.file))
    .extract({ left, top, width, height })
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toBuffer();
  writeFileSync(join(OUT, `${entry.slug}.webp`), buf);
  total += buf.length;
  console.log(`${entry.slug}: ${Math.round(buf.length / 1024)} KB`);
}
console.log(`toplam ${manifest.length} dosya, ${Math.round(total / 1024)} KB`);
