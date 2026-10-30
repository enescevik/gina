#!/usr/bin/env node
// Read-only configuration preflight. Never builds, submits, logs in or writes to a database.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';

export function isPublicHttps(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return false;
    if (!host || host === 'localhost' || host === 'host.docker.internal' || /\.(localhost|local|invalid|test|example)$/.test(host)) return false;
    if (host.includes(':')) return false; // Use a public DNS name for release endpoints.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
          (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) ||
          (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19))) return false;
    }
    return host.includes('.');
  } catch { return false; }
}

export function publicKeyKind(value = '') {
  if (value.startsWith('sb_secret_')) return 'secret';
  if (/^sb_publishable_[a-zA-Z0-9_-]+$/.test(value)) return 'publishable';
  const parts = value.split('.');
  if (parts.length !== 3 || !parts.every(Boolean)) return value ? 'invalid' : 'missing';
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.role === 'service_role') return 'secret';
    return payload.role === 'anon' ? 'anon' : 'invalid';
  } catch { return 'invalid'; }
}

export function inspectTestflight({ app = {}, eas = {}, env = {}, exists = () => true }) {
  const expo = app.expo ?? {};
  const findings = [];
  const check = (id, condition, pass, fail) => findings.push({ id, status: condition ? 'pass' : 'block', message: condition ? pass : fail });
  check('bundle-id', expo.ios?.bundleIdentifier === 'com.enescevik.gina', 'Gina iOS bundle kimliği tanımlı.', 'Gina iOS bundle kimliği eksik veya beklenenden farklı.');
  check('app-version', /^\d+\.\d+\.\d+$/.test(expo.version ?? ''), 'Uygulama sürümü tanımlı.', 'Uygulama sürümü major.minor.patch biçiminde olmalı.');
  check('eas-project', /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(expo.extra?.eas?.projectId ?? ''), 'EAS proje kimliği biçimi geçerli; hesap bağlantısı ayrıca doğrulanmalı.', 'EAS projesi bağlanmamış: extra.eas.projectId yok/geçersiz.');
  check('asc-app', /^[1-9]\d{5,}$/.test(eas.submit?.production?.ios?.ascAppId ?? ''), 'App Store Connect uygulama kimliği tanımlı; hesapta varlığı ayrıca doğrulanmalı.', 'eas.json submit.production.ios.ascAppId gerçek sayısal Apple ID ile doldurulmalı.');
  const prod = eas.build?.production;
  check('store-profile', !!prod && !prod.developmentClient && !prod.ios?.simulator && (!prod.distribution || prod.distribution === 'store'), 'Production profili fiziksel cihaz/store dağıtımına uygun.', 'Production profili development client, simulator veya internal dağıtım olmamalı.');
  const icon = typeof expo.ios?.icon === 'string' ? expo.ios.icon : expo.ios?.icon?.light ?? expo.icon;
  check('ios-icon', typeof icon === 'string' && exists(icon), 'iOS ikon dosyası mevcut; çözünürlük ve alfa mağaza kontrolünde doğrulanmalı.', 'iOS ikon kaynağı bulunamadı.');
  check('supabase-url', isPublicHttps(env.EXPO_PUBLIC_SUPABASE_URL), 'Supabase adresi public HTTPS biçiminde; bağlantı ayrıca doğrulanmalı.', 'Supabase URL boş, yerel veya geçersiz. TestFlight build’i localhost/özel ağ adresi kullanamaz.');
  const kind = publicKeyKind(env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  check('supabase-public-key', kind === 'anon' || kind === 'publishable', 'Supabase public/anon anahtar biçimi uygun; proje eşleşmesi ayrıca doğrulanmalı.', kind === 'secret' ? 'Sunucu secret/service_role anahtarı istemci değişkeninde bulundu. Build durmalı; anahtarı istemciden kaldır.' : 'Supabase public/anon anahtarı eksik veya biçimi geçersiz.');
  for (const [id, key, feature] of [
    ['web-url', 'EXPO_PUBLIC_WEB_URL', 'Öğretmen paylaşım bağlantıları'],
    ['legal-url', 'EXPO_PUBLIC_LEGAL_BASE_URL', 'Gizlilik ve abonelik bağlantıları'],
  ]) {
    findings.push({ id, status: isPublicHttps(env[key]) ? 'pass' : 'warn', message: isPublicHttps(env[key]) ? `${feature}: HTTPS adresi tanımlı; sayfalar ayrıca açılmalı.` : `${feature}: yayın URL’si henüz hazır değil.` });
  }
  return {
    scope: 'ios-testflight-static-configuration-only',
    configurationReady: !findings.some(x => x.status === 'block'),
    findings,
    manualChecks: [
      'Apple Developer üyeliği, EAS oturumu, provisioning ve imzalı IPA.',
      'Supabase migrations, token hook, RLS ve gerçek cihazdan erişim.',
      'Onaylı v5 ekran entegrasyonu ve iPhone/iPad görsel kabulü.',
      'Hesap silme, veli beyanı/izinler ve yayınlanmış doğru gizlilik metinleri.',
      'Giriş, çocuk PIN, eşleştirme, görev/ödül, Prova, push ve IAP kapsam testleri.',
      'TestFlight test bilgileri, destek adresi ve test kullanıcıları.',
    ],
  };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({ args: argv, options: { 'env-file': { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean' } } });
    if (values.help) {
      console.log('node scripts/check-testflight.mjs [--env-file PATH] [--json]\nSalt okunur iOS yapılandırma kontrolü; ağ isteği/dağıtım yapmaz. Varsayılan env: apps/mobile/.env. Shell değişkenleri önceliklidir.');
      return 0;
    }
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const mobile = resolve(root, 'apps/mobile');
    const envPath = values['env-file'] ? resolve(values['env-file']) : resolve(mobile, '.env');
    if (values['env-file'] && !existsSync(envPath)) throw new Error('env-file-missing');
    const localEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
    const report = inspectTestflight({
      app: JSON.parse(readFileSync(resolve(mobile, 'app.json'), 'utf8')),
      eas: JSON.parse(readFileSync(resolve(mobile, 'eas.json'), 'utf8')),
      env: { ...localEnv, ...process.env },
      exists: p => existsSync(resolve(mobile, p)),
    });
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else {
      for (const f of report.findings) console.log(`${{ pass: 'OK', block: 'EKSİK', warn: 'BEKLİYOR' }[f.status]}  ${f.message}`);
      console.log('\n' + (report.configurationReady ? 'Yapılandırma kontrolü geçti; bu sonuç TestFlight yayına hazır onayı değildir.' : 'TestFlight yapılandırması henüz hazır değil.'));
      for (const m of report.manualChecks) console.log(`ELLE DOĞRULA  ${m}`);
    }
    return report.configurationReady ? 0 : 1;
  } catch {
    // Never echo parser errors: malformed environment files may contain secrets.
    console.error('check-testflight: parametre veya yapılandırma dosyası okunamadı. --help ile kullanımı kontrol et.');
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
