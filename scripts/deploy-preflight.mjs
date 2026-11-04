import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function deploymentReadiness(target, env, event) {
  if (!['web', 'backoffice'].includes(target)) throw new Error('Unknown deployment target');
  const prefix = target === 'web' ? 'EXPO_PUBLIC' : 'NEXT_PUBLIC';
  const required = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID',
    `${prefix}_SUPABASE_URL`, `${prefix}_SUPABASE_ANON_KEY`];
  const missing = required.filter(name => typeof env[name] !== 'string' || !env[name].trim());
  const ready = missing.length === 0;
  // A repository with no deployment setup can still run ordinary development CI.
  // Explicit releases and incomplete configurations must never report success.
  const fail = !ready && (event === 'workflow_dispatch' || missing.length !== required.length);
  return { ready, fail, missing };
}

export function reportDeploymentReadiness(target, env = process.env) {
  const result = deploymentReadiness(target, env, env.GITHUB_EVENT_NAME);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `ready=${result.ready}\n`);
  const message = result.ready
    ? `${target}: yapılandırma mevcut; yükleme henüz yapılmadı.`
    : `${target}: YAYIN YAPILMADI. Eksik ayarlar: ${result.missing.join(', ')}.`;
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${message}\n`);
  // Names only. Do not serialize env, credentials, or a provider response here.
  console.log(result.ready ? message : `::${result.fail ? 'error' : 'warning'} title=Yayın yapılmadı::${message}`);
  return result.fail ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = reportDeploymentReadiness(process.argv[2]);
}
