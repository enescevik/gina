#!/usr/bin/env node
// Geri dönüş iskeleti — VARSAYILAN DRY-RUN. --execute olmadan hiçbir API çağrısı/komut çalışmaz.
//   web | backoffice  --to <pages-deployment-id>   : Cloudflare Pages önceki dağıtıma dönüş (API rollback uç noktası)
//   tablet           --to <eas-hosting-deployment-id> : `tablet` alias'ını önceki EAS Hosting dağıtımına bağlar (--prod YOK)
//   db               --name <slug>                   : geri alma migration'ı YOKTUR; ileri düzeltme migration dosyası iskeleti üretir
// Secret'lar env'den okunur (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID); yazdırılmaz.
// Kullanım: node scripts/rollback.mjs <web|backoffice|tablet|db> [--to ID] [--name slug] [--execute] [--json]
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PAGES_PROJECTS = { web: 'gina-web', backoffice: 'gina-backoffice' };
export const TARGETS = ['web', 'backoffice', 'tablet', 'db'];

export function parseRollbackArgs(argv) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { to: { type: 'string' }, name: { type: 'string' }, execute: { type: 'boolean', default: false }, json: { type: 'boolean', default: false }, help: { type: 'boolean', default: false } } });
  if (values.help) return { target: 'help' };
  const target = positionals[0];
  if (!TARGETS.includes(target)) throw new Error(`unknown-target: ${target ?? '(boş)'}; geçerli: ${TARGETS.join(', ')}`);
  if (positionals.length > 1) throw new Error('too-many-positionals');
  if (['web', 'backoffice'].includes(target)) {
    if (!values.to) throw new Error('missing-to: Pages dağıtım kimliği (UUID) gerekir; `wrangler pages deployment list --project-name <proje>` ile bul');
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(values.to)) throw new Error('invalid-to: Pages dağıtım kimliği UUID biçiminde olmalı');
  }
  if (target === 'tablet') {
    if (!values.to) throw new Error('missing-to: EAS Hosting dağıtım kimliği gerekir (ör. önceki `sbfnt5ls4x`; docs/release/tablet-*/package.json previousDeploymentId)');
    if (!/^[a-z0-9]{6,16}$/.test(values.to)) throw new Error('invalid-to: EAS Hosting dağıtım kimliği küçük harf/rakam olmalı');
  }
  if (target === 'db') {
    if (!values.name || !/^[a-z][a-z0-9_]{2,60}$/.test(values.name)) throw new Error('missing-name: --name snake_case slug gerekir (ör. fix_notes_policy)');
    if (values.to) throw new Error('db-has-no-rollback-target: geri alma migration’ı yoktur; ileri düzeltme üretilir');
  }
  return { target, ...values };
}

export function migrationTimestamp(now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
}

export function forwardFixTemplate({ name, version, incident = '' }) {
  return `-- ${version}_${name}.sql — İLERİ DÜZELTME (forward-fix). Geri alma migration'ı yoktur.
-- Neden: ${incident || '<hangi yayın/migration, hangi belirti>'}
-- İlke: üretim verisi silinmez/sıfırlanmaz; önceki migration geri alınmaz, yeni migration ile düzeltilir.
--   1) Önce izole boş DB'de uygula ve pgTAP çalıştır (supabase test db).
--   2) Yayımlanmış/atanmış soru, yıldız/puan/cevap kanıtı sessizce değişmez.
--   3) Veri düzeltmesi gerekiyorsa etkilenen satırları önce JSON anlık görüntü olarak al (.codex-setup/, repoya girmez).
--   4) Uygulama: node scripts/release-local.mjs migrations:apply --execute (tek işlem, schema_migrations kaydı).
begin;

-- TODO: düzeltme SQL'i

commit;
`;
}

/** Plan: dry-run'da yalnız yazılır; --execute'ta çalışır. Argv/URL'lerde secret yoktur. */
export function buildRollbackPlan(args, { env = {}, now = new Date() } = {}) {
  const steps = [];
  if (args.target === 'web' || args.target === 'backoffice') {
    const project = PAGES_PROJECTS[args.target];
    steps.push({ id: 'list', kind: 'shell', title: `Mevcut dağıtımları listele (hedef kimlik listede olmalı)`, argv: ['pnpm', 'exec', 'wrangler', 'pages', 'deployment', 'list', `--project-name=${project}`] });
    steps.push({ id: 'rollback', kind: 'http', title: `Pages üretim dağıtımını ${args.to} kimliğine geri al`, method: 'POST', url: `https://api.cloudflare.com/client/v4/accounts/<CLOUDFLARE_ACCOUNT_ID>/pages/projects/${project}/deployments/${args.to}/rollback`, env: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'], note: 'Alternatif: Cloudflare panosu → Workers & Pages → proje → Deployments → ⋯ → Rollback to this deployment.' });
    steps.push({ id: 'verify', kind: 'shell', title: `Geri dönüş sonrası doğrulama: canlı hash (${args.target}) ${args.target === 'backoffice' ? '+ Access kapısı' : ''}`, argv: ['node', 'scripts/release-local.mjs', 'verify', '--target', args.target, '--execute'], note: args.target === 'backoffice' ? 'Access kontrolü: node scripts/check-backoffice-access.mjs' : 'Geri dönülen dağıtımın yerel çıktısı yoksa hash karşılaştırması yapılamaz; o zaman kök yanıt + health-check ile sınırlı kal.' });
    steps.push({ id: 'health', kind: 'shell', title: 'Sağlık kontrolü', argv: ['node', 'scripts/health-check.mjs', '--pretty'] });
  } else if (args.target === 'tablet') {
    steps.push({ id: 'previous-record', kind: 'check', title: `Önceki yayın kaydı: docs/release/tablet-*/previous-release.json ve package.json previousDeploymentId = ${args.to} olmalı` });
    steps.push({ id: 'alias', kind: 'shell', title: `\`tablet\` alias’ını ${args.to} dağıtımına bağla (--prod YOK; ana web değişmez)`, argv: ['eas', 'deploy:alias', '--alias', 'tablet', '--id', args.to, '--non-interactive'], cwd: 'apps/mobile' });
    steps.push({ id: 'verify', kind: 'shell', title: 'Canlı alias: release.json/manifest/IPA hash önceki kayıtla aynı olmalı', argv: ['node', 'scripts/release-local.mjs', 'verify', '--target', 'tablet', '--expected-build', '<önceki build>', '--expected-sha256', '<önceki sha256>', '--execute'] });
    steps.push({ id: 'docs', kind: 'check', title: 'TABLET-KABLOSUZ-DAGITIM.md canlı sürüm satırını geri dönüşle güncelle; kullanıcıya iPad’de sayfayı yeniden açmasını söyle' });
  } else if (args.target === 'db') {
    const version = migrationTimestamp(now);
    steps.push({ id: 'policy', kind: 'check', title: 'Geri alma migration’ı YOK: ileri düzeltme ilkesi. Üretim DB sıfırlanmaz, `db reset` çalıştırılmaz.' });
    steps.push({ id: 'snapshot', kind: 'check', title: 'Etkilenen tabloların JSON anlık görüntüsü (.codex-setup/, repoya girmez) ve Supabase yedek/PITR noktasını kaydet' });
    steps.push({ id: 'template', kind: 'write', title: `İleri düzeltme migration dosyası: supabase/migrations/${version}_${args.name}.sql`, path: join('supabase/migrations', `${version}_${args.name}.sql`) });
    steps.push({ id: 'test', kind: 'shell', title: 'İzole DB’de uygula + pgTAP', argv: ['pnpm', 'exec', 'supabase', 'test', 'db'] });
    steps.push({ id: 'apply', kind: 'shell', title: 'Üretime tek işlemde uygula (release-local)', argv: ['node', 'scripts/release-local.mjs', 'migrations:apply', '--execute'] });
  }
  return steps;
}

export function renderRollbackPlan(args, steps, execute) {
  const lines = [`rollback ${args.target}${args.to ? ` → ${args.to}` : ''}${args.name ? ` (${args.name})` : ''} — ${execute ? 'GERÇEK ÇALIŞTIRMA' : 'DRY-RUN (hiçbir komut/API çağrısı yapılmadı)'}`];
  steps.forEach((s, i) => {
    lines.push(`${i + 1}. [${s.kind}] ${s.title}`);
    if (s.argv) lines.push(`     $ ${s.cwd ? `(cd ${s.cwd}) ` : ''}${s.argv.join(' ')}`);
    if (s.url) lines.push(`     ${s.method} ${s.url}`);
    if (s.env) lines.push(`     env: ${s.env.join(', ')} (yalnız adlar)`);
    if (s.path) lines.push(`     → ${s.path}`);
    if (s.note) lines.push(`     not: ${s.note}`);
  });
  return lines.join('\n');
}

async function executeRollback(args, steps, env, fetcher = fetch) {
  for (const s of steps) {
    console.log(`\n== ${s.id}: ${s.title}`);
    if (s.kind === 'shell') {
      if (s.argv.some(a => a.startsWith('<'))) { console.log('  yer tutucu argüman var; bu adım elle çalıştırılır'); continue; }
      const r = spawnSync(s.argv[0], s.argv.slice(1), { cwd: join(ROOT, s.cwd ?? '.'), env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error(`step-failed: ${s.id} (${r.status})`);
    } else if (s.kind === 'http') {
      for (const name of s.env) if (!env[name]) throw new Error(`missing-env: ${name}`);
      if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID)) throw new Error('invalid-account-id-format');
      const url = s.url.replace('<CLOUDFLARE_ACCOUNT_ID>', env.CLOUDFLARE_ACCOUNT_ID);
      const r = await fetcher(url, { method: s.method, headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`rollback-api-failed: HTTP ${r.status}`); // gövde yazdırılmaz
      const body = await r.json().catch(() => ({}));
      console.log(JSON.stringify({ success: body.success ?? null, id: body.result?.id ?? null, url: body.result?.url ?? null }));
    } else if (s.kind === 'write') {
      const path = join(ROOT, s.path);
      if (existsSync(path)) throw new Error('migration-file-exists');
      writeFileSync(path, forwardFixTemplate({ name: args.name, version: s.path.match(/(\d{14})_/)[1] }));
      console.log(`  yazıldı: ${s.path}`);
    } else console.log('  (elle kontrol)');
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  let args;
  try { args = parseRollbackArgs(argv); } catch (e) { console.error(`rollback: ${e.message}`); return 2; }
  if (args.target === 'help') { console.log('node scripts/rollback.mjs <web|backoffice|tablet|db> [--to ID] [--name slug] [--execute] [--json]'); return 0; }
  try {
    const steps = buildRollbackPlan(args, { env });
    if (args.json) console.log(JSON.stringify({ target: args.target, to: args.to ?? null, dryRun: !args.execute, steps }, null, 2));
    else console.log(renderRollbackPlan(args, steps, args.execute));
    if (!args.execute) { if (!args.json) console.log('\nDRY-RUN tamam. Gerçek geri dönüş için --execute ekle.'); return 0; }
    await executeRollback(args, steps, env);
    return 0;
  } catch (e) { console.error(`rollback: ${e.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
