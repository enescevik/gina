// Yan Yana marka geçişi: platform ikon/splash/favicon/bildirim dosyalarını SVG kaynaktan üretir.
// Çalıştırma: node scripts/generate-brand.mjs  (çıktılar packages/assets/brand/* ve apps/mobile/assets/images/*)
// Kurallar: App Store ikonu alfasız tam kare; Android ön katman içerik 626/1024 güvenli dairede;
// monochrome beyaz siluet; splash işareti tuvalin ≤%60'ı; maskable %80 güvenli daire; eski
// yıldız-tik markası yalnız ödül simgesi olarak kalır (packages/assets/brand/logo-mark.svg dokunulmaz).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "packages/assets/brand/yan-yana");
const BRAND = join(root, "packages/assets/brand");
const APP = join(root, "apps/mobile/assets/images");

const CREAM = "#FFF8EF";
const mark = readFileSync(join(SRC, "logo-mark.svg"), "utf8");
const markMono = readFileSync(join(SRC, "logo-mark-mono.svg"), "utf8");
const wordmark = readFileSync(join(SRC, "logo-wordmark.svg"), "utf8");

const monoAs = (color) => Buffer.from(markMono.replaceAll("currentColor", color));
const markBuf = Buffer.from(mark);

async function renderMark(source, px) {
  return sharp(source, { density: 300 }).resize(px, px, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function onBackground(fgBuf, size, background, { flatten = false } = {}) {
  // composite sharp'ta en son uygulanır; alfasız çıktı için ikinci geçişte düzleştir.
  const composed = await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: fgBuf, gravity: "center" }])
    .png()
    .toBuffer();
  if (!flatten) return composed;
  return sharp(composed).flatten({ background }).removeAlpha().png().toBuffer();
}

function roundedSquareSvg(size, radiusRatio, fill) {
  const r = Math.round(size * radiusRatio);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${fill}"/></svg>`);
}

function circleSvg(size, fill) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${fill}"/></svg>`);
}

const out = async (relPath, buf) => {
  const p = join(BRAND, relPath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
  console.log("yazıldı:", relPath, buf.length, "bayt");
};

// iOS -------------------------------------------------------------------------
const mark62 = await renderMark(markBuf, Math.round(1024 * 0.62));
await out("ios/ios-icon-light.png", await onBackground(mark62, 1024, CREAM, { flatten: true }));
await out("ios/ios-icon-dark.png", await onBackground(mark62, 1024, { r: 0, g: 0, b: 0, alpha: 0 }));
const grayMark = await sharp(await renderMark(markBuf, Math.round(1024 * 0.62))).grayscale().png().toBuffer();
await out("ios/ios-icon-tinted.png", await onBackground(grayMark, 1024, { r: 0, g: 0, b: 0, alpha: 0 }));
writeFileSync(join(BRAND, "ios/icon-background.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${CREAM}"/></svg>`);
writeFileSync(join(BRAND, "ios/icon-foreground.svg"), mark);

// Android ----------------------------------------------------------------------
const markSafe = await renderMark(markBuf, 560); // 626 px güvenli dairenin içinde
await out("android/android-icon-foreground.png", await onBackground(markSafe, 1024, { r: 0, g: 0, b: 0, alpha: 0 }));
await out("android/android-icon-background.png", await sharp({ create: { width: 1024, height: 1024, channels: 3, background: CREAM } }).png().toBuffer());
const whiteSafe = await renderMark(monoAs("#FFFFFF"), 560);
await out("android/android-icon-monochrome.png", await onBackground(whiteSafe, 1024, { r: 0, g: 0, b: 0, alpha: 0 }));
{
  const composed = await sharp(roundedSquareSvg(1024, 0.17, CREAM)).composite([{ input: mark62, gravity: "center" }]).png().toBuffer();
  await out("android/android-icon-legacy.png", composed);
}
await out("android/play-store-icon.png", await onBackground(await renderMark(markBuf, 318), 512, CREAM, { flatten: true }));
await out("android/notification-icon.png", await onBackground(await renderMark(monoAs("#FFFFFF"), 72), 96, { r: 0, g: 0, b: 0, alpha: 0 }));

// Splash -----------------------------------------------------------------------
const splashMark = await renderMark(markBuf, Math.round(1024 * 0.55));
await out("splash/splash-icon.png", await onBackground(splashMark, 1024, { r: 0, g: 0, b: 0, alpha: 0 }));
await out("splash/splash-icon-dark.png", await onBackground(splashMark, 1024, { r: 0, g: 0, b: 0, alpha: 0 }));

// Web --------------------------------------------------------------------------
writeFileSync(join(BRAND, "web/favicon.svg"), mark);
await out("web/favicon-32.png", await renderMark(markBuf, 32));
await out("web/favicon-48.png", await renderMark(markBuf, 48));
await out("web/apple-touch-icon-180.png", await onBackground(await renderMark(markBuf, 120), 180, CREAM, { flatten: true }));
await out("web/icon-192.png", await renderMark(markBuf, 192));
await out("web/icon-512.png", await renderMark(markBuf, 512));
for (const size of [192, 512]) {
  const safe = await renderMark(markBuf, Math.round(size * 0.55)); // %80 güvenli dairenin içinde kal
  await out(`web/icon-${size}-maskable.png`, await onBackground(safe, size, CREAM, { flatten: true }));
}

// E-posta ve og ------------------------------------------------------------------
const word = await sharp(Buffer.from(wordmark), { density: 300 }).resize(440, 160, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
{
  const composed = await sharp({ create: { width: 480, height: 160, channels: 4, background: CREAM } })
    .composite([{ input: word, gravity: "center" }])
    .png()
    .toBuffer();
  await out("email/email-logo@2x.png", await sharp(composed).flatten({ background: CREAM }).removeAlpha().png().toBuffer());
}
const ogMark = await renderMark(markBuf, 360);
{
  const composed = await sharp({ create: { width: 1200, height: 630, channels: 4, background: CREAM } })
    .composite([{ input: ogMark, left: 120, top: 135 }])
    .png()
    .toBuffer();
  await out("og-image.png", await sharp(composed).flatten({ background: CREAM }).removeAlpha().png().toBuffer());
}

// Uygulama kopyaları ---------------------------------------------------------------
const appCopies = {
  "ios/ios-icon-light.png": "icon.png",
  "ios/ios-icon-dark.png": "icon-dark.png",
  "ios/ios-icon-tinted.png": "icon-tinted.png",
  "android/android-icon-foreground.png": "android-icon-foreground.png",
  "android/android-icon-background.png": "android-icon-background.png",
  "android/android-icon-monochrome.png": "android-icon-monochrome.png",
  "splash/splash-icon.png": "splash-icon.png",
  "splash/splash-icon-dark.png": "splash-icon-dark.png",
  "web/favicon-48.png": "favicon.png",
};
mkdirSync(APP, { recursive: true });
for (const [from, to] of Object.entries(appCopies)) {
  writeFileSync(join(APP, to), readFileSync(join(BRAND, from)));
  console.log("uygulamaya kopyalandı:", to);
}
console.log("tamam");
