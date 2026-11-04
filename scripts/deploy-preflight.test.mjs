import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { deploymentReadiness } from './deploy-preflight.mjs';

const config = {
  CLOUDFLARE_API_TOKEN: 'private-token-do-not-log', CLOUDFLARE_ACCOUNT_ID: 'account',
  EXPO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public',
};
test('explicit publication fails when nothing is configured', () => {
  for (const target of ['web', 'backoffice']) {
    assert.equal(deploymentReadiness(target, {}, 'workflow_dispatch').fail, true);
    assert.equal(deploymentReadiness(target, {}, 'push').fail, false);
    assert.equal(deploymentReadiness(target, {}, 'push').ready, false);
  }
});
test('a partial or whitespace configuration fails on push as well', () => {
  for (const target of ['web', 'backoffice']) {
    assert.equal(deploymentReadiness(target, { CLOUDFLARE_API_TOKEN: 'exists' }, 'push').fail, true);
    assert.equal(deploymentReadiness(target, { ...config, CLOUDFLARE_ACCOUNT_ID: '  ' }, 'push').fail, true);
  }
});
test('each application requires its own public configuration', () => {
  assert.equal(deploymentReadiness('web', config, 'push').ready, true);
  assert.equal(deploymentReadiness('backoffice', config, 'workflow_dispatch').ready, true);
  assert.equal(deploymentReadiness('backoffice', { ...config, NEXT_PUBLIC_SUPABASE_URL: undefined }, 'push').fail, true);
  assert.throws(() => deploymentReadiness('unknown', config, 'push'), /Unknown deployment target/);
});
test('CLI writes a failed release status and only missing names, never secret values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gina-deploy-preflight-'));
  try {
    const output = join(dir, 'output'); const summary = join(dir, 'summary');
    const result = spawnSync(process.execPath, ['scripts/deploy-preflight.mjs', 'web'], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8',
      env: { ...config, EXPO_PUBLIC_SUPABASE_URL: '', GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
    });
    assert.equal(result.status, 1);
    assert.equal(readFileSync(output, 'utf8'), 'ready=false\n');
    const report = result.stdout + result.stderr + readFileSync(summary, 'utf8');
    assert.match(report, /YAYIN YAPILMADI/);
    assert.match(report, /EXPO_PUBLIC_SUPABASE_URL/);
    assert.doesNotMatch(report, /private-token-do-not-log|https:\/\/test/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
