import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Usage: node scripts/prepare-tablet-install.mjs STORE_JSON TABLET_JSON ICON_PNG OUTPUT_DIR
// Both JSON files must come from `eas build:view ID --json`.
const [storeFile, tabletFile, iconFile, outputDir] = process.argv.slice(2);
if (!outputDir || !iconFile || !tabletFile || !storeFile) throw new Error('Expected STORE_JSON TABLET_JSON ICON_PNG OUTPUT_DIR');
const store = JSON.parse(readFileSync(storeFile, 'utf8'));
const tablet = JSON.parse(readFileSync(tabletFile, 'utf8'));
for (const build of [store, tablet]) {
  if (build.status !== 'FINISHED' || build.platform !== 'IOS' || build.isForIosSimulator ||
      build.app?.id !== '8fc01433-eb6f-419e-a20b-edc30c8abe84' ||
      build.appIdentifier !== 'com.enescevik.gina' || !/^\d+$/.test(build.appBuildVersion) ||
      !/^[a-f0-9]{40}$/.test(build.gitCommitHash) || !/^[a-f0-9-]{36}$/.test(build.id)) {
    throw new Error('Only a completed, physical-device Gina build may be published');
  }
}
if (store.distribution !== 'STORE' || tablet.distribution !== 'INTERNAL' ||
    store.appBuildVersion !== tablet.appBuildVersion || store.appVersion !== tablet.appVersion ||
    store.gitCommitHash !== tablet.gitCommitHash) {
  throw new Error('Tablet and TestFlight source commit and version must match');
}
const out = resolve(outputDir);
const recordPath = resolve(out, 'release.json');
if (existsSync(recordPath)) {
  const previous = JSON.parse(readFileSync(recordPath, 'utf8'));
  if (Number(previous.build) > Number(tablet.appBuildVersion)) throw new Error('Refusing to replace a newer tablet release');
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const installUrl = `https://expo.dev/accounts/enescevik/projects/gina-aile/builds/${tablet.id}`;
const record = { version: tablet.appVersion, build: tablet.appBuildVersion, sourceCommit: tablet.gitCommitHash,
  storeBuildId: store.id, tabletBuildId: tablet.id, installUrl };
mkdirSync(out, { recursive: true });
copyFileSync(iconFile, resolve(out, 'icon.png'));
writeFileSync(recordPath, JSON.stringify(record, null, 2) + '\n');
writeFileSync(resolve(out, 'index.html'), `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>GINA · Tablet kurulumu</title>
<link rel="icon" type="image/png" href="icon.png?v=mint1"><link rel="apple-touch-icon" href="icon.png?v=mint1"><meta name="theme-color" content="#6650CD">
<style>*{box-sizing:border-box}body{margin:0;background:#f8f5ef;color:#292149;font-family:system-ui,-apple-system,sans-serif;min-height:100svh;display:grid;place-items:center;padding:28px}main{width:min(100%,480px);background:white;padding:38px;border-radius:28px;box-shadow:0 16px 60px #2921490c}img{width:88px;height:88px;border-radius:22px}h1{font-size:29px;letter-spacing:-.8px;margin-bottom:8px}p{line-height:1.65;color:#625a74}a{display:block;padding:18px;text-align:center;background:#6242c6;color:white;text-decoration:none;border-radius:15px;font-weight:650;margin:28px 0}small{display:block;line-height:1.6;color:#71697e}.version{display:inline-block;background:#eee8fc;color:#51349d;border-radius:40px;padding:8px 14px;font-weight:600;margin-top:12px}ol{padding-left:22px;line-height:1.8;color:#625a74}footer{border-top:1px solid #eee8f4;margin-top:26px;padding-top:20px}</style></head>
<body><main><img src="icon.png" alt="Gina"><h1>Gina tabletinde.</h1>
<p>Kayıtlı iPad için güncel test sürümü.</p><div class="version">${escape(tablet.appVersion)} (${escape(tablet.appBuildVersion)})</div>
<a href="${escape(installUrl)}">Yükle / Güncelle</a>
<ol><li>Bu sayfayı iPad’de Safari ile aç.</li><li>Yukarıdaki düğmeye, ardından Expo sayfasında Install’a dokun.</li><li>Yükleme tamamlandığında ana ekrandan Gina’yı aç.</li></ol>
<footer><small>TestFlight ve kablo gerekmez. Yalnız kayıtlı test cihazında çalışır. Mevcut uygulamayı silmeden güncelle. Yeni sürüm yayımlandığında bu sayfayı yeniden aç.</small></footer>
</main></body></html>`);
console.log(JSON.stringify(record));
