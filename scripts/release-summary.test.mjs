import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mappingSummary, resultSummary } from './release-summary.mjs';

const secrets = { CLOUDFLARE_API_TOKEN: 'cf-secret-do-not-log', CLOUDFLARE_ACCOUNT_ID: 'acct-do-not-log', EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-do-not-log' };
const ci = { GITHUB_SHA: 'a'.repeat(40), GITHUB_REF_NAME: 'main', GITHUB_EVENT_NAME: 'push', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' };

test('eşleme özeti: commit/ref/run/sürüm ve secret ADLARI; değer yazılmaz', () => {
  const full = mappingSummary('web', { ...ci, ...secrets }, { appVersion: '0.1.0', nodeVersion: 'v22.22.2' });
  assert.equal(full.ready, true);
  assert.match(full.markdown, /secret CLOUDFLARE_API_TOKEN \| tanımlı/);
  assert.match(full.markdown, /app\.json sürümü \| 0\.1\.0/);
  assert.doesNotMatch(full.markdown, /do-not-log|abcdefghijklmnopqrst/);
  const partial = mappingSummary('backoffice', { ...ci, CLOUDFLARE_API_TOKEN: 'x' });
  assert.equal(partial.ready, false);
  assert.match(partial.markdown, /NEXT_PUBLIC_SUPABASE_URL \| YOK/);
  assert.match(partial.markdown, /YAYIN YAPILMAYACAK/);
  assert.throws(() => mappingSummary('prod', {}), /unknown-target/);
});

test('sonuç özeti: atlanan iş başarı sayılmaz; kanıtsız başarı doğrulanamadı (çıkış 1); gerçek yayın URL ile', () => {
  const skipped = resultSummary('web', { READY: 'false', OUTCOME: 'success' });
  assert.equal(skipped.status, 'skipped'); assert.match(skipped.title, /YAYIN YAPILMADI/); assert.equal(skipped.exitCode, 0);
  const unverified = resultSummary('web', { READY: 'true', OUTCOME: 'success' });
  assert.equal(unverified.status, 'unverified'); assert.equal(unverified.exitCode, 1); assert.match(unverified.title, /DOĞRULANAMADI/);
  const bogus = resultSummary('web', { READY: 'true', OUTCOME: 'success', DEPLOYMENT_URL: 'https://evil.invalid/x.pages.dev' });
  assert.equal(bogus.status, 'unverified');
  const ok = resultSummary('web', { READY: 'true', OUTCOME: 'success', DEPLOYMENT_URL: 'https://0d64fd42.gina-web.pages.dev/', GITHUB_SHA: 'b'.repeat(40), VERIFY_OUTCOME: 'success', HEALTH_OUTCOME: 'failure' });
  assert.equal(ok.status, 'published'); assert.equal(ok.exitCode, 0);
  assert.match(ok.title, /YAYIN YAPILDI — web: https:\/\/0d64fd42\.gina-web\.pages\.dev \(commit bbbbbbb\)/);
  assert.match(ok.markdown, /canlı hash doğrulaması: success/); assert.match(ok.markdown, /sağlık kontrolü: failure/);
  const failed = resultSummary('backoffice', { READY: 'true', OUTCOME: 'failure' });
  assert.equal(failed.status, 'failed'); assert.match(failed.title, /YAYIN BAŞARISIZ/); assert.equal(failed.exitCode, 0);
});

test('CLI: GITHUB_STEP_SUMMARY dosyasına yazar, sırları yazmaz; kanıtsız başarıda 1 döner', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gina-release-summary-'));
  try {
    const summary = join(dir, 'summary.md');
    const run = (args, env) => spawnSync(process.execPath, [fileURLToPath(new URL('./release-summary.mjs', import.meta.url)), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, GITHUB_STEP_SUMMARY: summary, ...env } });
    const mapping = run(['mapping', 'web'], { ...ci, ...secrets });
    assert.equal(mapping.status, 0, mapping.stderr);
    const text = readFileSync(summary, 'utf8');
    assert.match(text, /Yayın eşlemesi — web/); assert.match(text, /app\.json sürümü \| \d+\.\d+\.\d+/);
    assert.doesNotMatch(text + mapping.stdout, /do-not-log/);
    const skipped = run(['result', 'backoffice'], { READY: 'false', OUTCOME: 'success' });
    assert.equal(skipped.status, 0); assert.match(readFileSync(summary, 'utf8'), /YAYIN YAPILMADI — backoffice/);
    const unverified = run(['result', 'web'], { READY: 'true', OUTCOME: 'success' });
    assert.equal(unverified.status, 1); assert.match(unverified.stdout, /::error title=Yayın doğrulanamadı::/);
    assert.equal(run(['bogus', 'web'], {}).status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
