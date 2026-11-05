import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildRollbackPlan, forwardFixTemplate, migrationTimestamp, parseRollbackArgs } from './rollback.mjs';

const uuid = '8b9132a2-ba72-4469-a2a9-248231515537';

test('argümanlar: hedef/kimlik biçimi doğrulanır; db için --to yoktur', () => {
  assert.equal(parseRollbackArgs(['web', '--to', uuid]).execute, false);
  assert.throws(() => parseRollbackArgs(['prod']), /unknown-target/);
  assert.throws(() => parseRollbackArgs(['web']), /missing-to/);
  assert.throws(() => parseRollbackArgs(['web', '--to', 'abc']), /invalid-to/);
  assert.throws(() => parseRollbackArgs(['tablet']), /missing-to/);
  assert.throws(() => parseRollbackArgs(['tablet', '--to', '../x']), /invalid-to/);
  assert.equal(parseRollbackArgs(['tablet', '--to', 'sbfnt5ls4x']).to, 'sbfnt5ls4x');
  assert.throws(() => parseRollbackArgs(['db']), /missing-name/);
  assert.throws(() => parseRollbackArgs(['db', '--name', 'Fix Notes']), /missing-name/);
  assert.throws(() => parseRollbackArgs(['db', '--name', 'fix_notes', '--to', uuid]), /db-has-no-rollback-target/);
});

test('plan: Pages geri dönüşü API rollback + doğrulama; tablet alias --prod içermez; db ileri düzeltme', () => {
  const web = buildRollbackPlan(parseRollbackArgs(['web', '--to', uuid]));
  assert.deepEqual(web.map(s => s.id), ['list', 'rollback', 'verify', 'health']);
  assert.match(web[1].url, new RegExp(`/pages/projects/gina-web/deployments/${uuid}/rollback$`));
  assert.ok(web[1].url.includes('<CLOUDFLARE_ACCOUNT_ID>'));
  const bo = buildRollbackPlan(parseRollbackArgs(['backoffice', '--to', uuid]));
  assert.match(bo[1].url, /gina-backoffice/); assert.match(bo[2].note, /check-backoffice-access/);
  const tablet = buildRollbackPlan(parseRollbackArgs(['tablet', '--to', 'sbfnt5ls4x']));
  const alias = tablet.find(s => s.id === 'alias');
  assert.deepEqual(alias.argv, ['eas', 'deploy:alias', '--alias', 'tablet', '--id', 'sbfnt5ls4x', '--non-interactive']);
  assert.ok(tablet.every(s => !(s.argv ?? []).includes('--prod')));
  const db = buildRollbackPlan(parseRollbackArgs(['db', '--name', 'fix_notes_policy']), { now: new Date('2026-11-06T02:03:04Z') });
  assert.equal(db.find(s => s.id === 'template').path, 'supabase/migrations/20261106020304_fix_notes_policy.sql');
  assert.ok(db.some(s => /db reset/.test(s.title)));
  assert.equal(migrationTimestamp(new Date('2026-01-02T03:04:05Z')), '20260102030405');
  const tpl = forwardFixTemplate({ name: 'fix_notes_policy', version: '20261106020304' });
  assert.match(tpl, /İLERİ DÜZELTME/); assert.match(tpl, /^begin;$/m); assert.match(tpl, /^commit;$/m);
});

test('CLI dry-run: komut/API çağrısı yapmaz, token yazmaz; geçersiz argüman 2', () => {
  const run = args => spawnSync(process.execPath, [fileURLToPath(new URL('./rollback.mjs', import.meta.url)), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, CLOUDFLARE_API_TOKEN: 'cf-secret-do-not-log', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32) } });
  const dry = run(['web', '--to', uuid]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /DRY-RUN/); assert.match(dry.stdout, /rollback/);
  assert.doesNotMatch(dry.stdout + dry.stderr, /cf-secret-do-not-log|aaaaaaaa/);
  const json = JSON.parse(run(['tablet', '--to', 'sbfnt5ls4x', '--json']).stdout);
  assert.equal(json.dryRun, true); assert.equal(json.steps.length, 4);
  assert.equal(run(['db']).status, 2);
  assert.equal(run(['--help']).status, 0);
});
