#!/usr/bin/env node
// GitHub Actions iş özeti (job summary) yazıcısı. Değer değil, yalnız ad ve durum yazar.
//   mapping <web|backoffice> : build/env/commit/sürüm eşlemesi tablosu (hangi secret adları tanımlı, commit, ref, run, node, app.json sürümü)
//   result  <web|backoffice> : nihai durum. READY != true → "YAYIN YAPILMADI" (atlandı; başarı değil).
//                              READY=true + OUTCOME=success + dağıtım URL'si → "YAYIN YAPILDI".
//                              READY=true + OUTCOME=success ama dağıtım URL'si yok → "YAYIN DOĞRULANAMADI", çıkış 1.
// Env: GITHUB_STEP_SUMMARY, GITHUB_SHA, GITHUB_REF_NAME, GITHUB_EVENT_NAME, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT,
//      READY, OUTCOME, DEPLOYMENT_URL, HEALTH_OUTCOME, VERIFY_OUTCOME ve kontrol edilen secret adları (yalnız varlık).
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SECRET_NAMES = {
  web: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'],
  backoffice: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
};

const present = v => typeof v === 'string' && v.trim() !== '';

export function mappingSummary(target, env, { appVersion = null, nodeVersion = process.version } = {}) {
  if (!SECRET_NAMES[target]) throw new Error('unknown-target');
  const rows = [
    ['Hedef', target === 'web' ? 'Veli webi → Cloudflare Pages' : 'Backoffice → Cloudflare Pages (Access arkasında)'],
    ['Pages projesi', env.CF_PAGES_PROJECT ?? (target === 'web' ? 'gina-web' : 'gina-backoffice')],
    ['Kaynak commit', env.GITHUB_SHA ?? '(yok)'],
    ['Ref / olay', `${env.GITHUB_REF_NAME ?? '(yok)'} / ${env.GITHUB_EVENT_NAME ?? '(yok)'}`],
    ['Run', `${env.GITHUB_RUN_ID ?? '(yok)'} (deneme ${env.GITHUB_RUN_ATTEMPT ?? '1'})`],
    ['Node', nodeVersion],
    ['app.json sürümü', appVersion ?? '(okunamadı)'],
    ...SECRET_NAMES[target].map(name => [`secret ${name}`, present(env[name]) ? 'tanımlı' : 'YOK']),
    ['service_role yasağı', 'public anahtar doğrulaması build adımında (scripts/public-build-env.mjs)'],
  ];
  const ready = SECRET_NAMES[target].every(n => present(env[n]));
  const md = [`### Yayın eşlemesi — ${target}`, '', '| Alan | Değer |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${v} |`), '', ready ? 'Yapılandırma tam; yükleme sonucu aşağıda ayrıca raporlanır.' : '**Yapılandırma eksik: bu çalıştırmada YAYIN YAPILMAYACAK.**', ''].join('\n');
  return { ready, markdown: md };
}

export function resultSummary(target, env) {
  const ready = env.READY === 'true';
  const outcome = env.OUTCOME ?? 'unknown';
  const url = present(env.DEPLOYMENT_URL) && /^https:\/\/[a-z0-9]+\.[a-z0-9-]+\.pages\.dev\/?$/.test(env.DEPLOYMENT_URL) ? env.DEPLOYMENT_URL.replace(/\/$/, '') : null;
  const extras = [];
  if (present(env.VERIFY_OUTCOME)) extras.push(`canlı hash doğrulaması: ${env.VERIFY_OUTCOME}`);
  if (present(env.HEALTH_OUTCOME)) extras.push(`sağlık kontrolü: ${env.HEALTH_OUTCOME}`);
  if (present(env.ACCESS_OUTCOME)) extras.push(`Access kapısı: ${env.ACCESS_OUTCOME}`);
  let status, title, exitCode = 0;
  if (!ready) { status = 'skipped'; title = `YAYIN YAPILMADI — ${target}: yayın ayarları eksik, iş atlandı. Atlanan iş başarı sayılmaz.`; }
  else if (outcome === 'success' && url) { status = 'published'; title = `YAYIN YAPILDI — ${target}: ${url} (commit ${(env.GITHUB_SHA ?? '').slice(0, 7) || '?'})`; }
  else if (outcome === 'success') { status = 'unverified'; title = `YAYIN DOĞRULANAMADI — ${target}: iş başarılı göründü ama dağıtım URL’si yok; kanıt olmadan yayın yapıldı denmez.`; exitCode = 1; }
  else { status = 'failed'; title = `YAYIN BAŞARISIZ — ${target}: iş sonucu ${outcome}.`; }
  const markdown = [`### Yayın sonucu — ${target}`, '', `**${title}**`, ...(extras.length ? ['', ...extras.map(e => `- ${e}`)] : []), ''].join('\n');
  return { status, title, markdown, exitCode };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const [mode, target] = argv;
  try {
    if (!['mapping', 'result'].includes(mode) || !SECRET_NAMES[target]) throw new Error('usage: release-summary.mjs <mapping|result> <web|backoffice>');
    let out;
    if (mode === 'mapping') {
      let appVersion = null;
      try { appVersion = JSON.parse(readFileSync(new URL('../apps/mobile/app.json', import.meta.url), 'utf8')).expo?.version ?? null; } catch { /* özet için isteğe bağlı */ }
      out = mappingSummary(target, env, { appVersion });
    } else out = resultSummary(target, env);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, out.markdown + '\n');
    console.log(out.markdown);
    if (mode === 'result' && out.exitCode) console.log(`::error title=Yayın doğrulanamadı::${out.title}`);
    return mode === 'result' ? out.exitCode : 0;
  } catch (e) { console.error(`release-summary: ${e.message}`); return 2; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
