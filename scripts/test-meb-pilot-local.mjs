// D15: runs docs/release/d15-2026-11-06/run-meb-pilot.mjs end-to-end against the disposable isolated stack.
// Invoked only by `python3 scripts/test-isolated-services.py --run-local --meb-pilot` (Auth + PostgREST + Storage
// on loopback, empty cloned DB). Edge handlers run unchanged under scripts/d15-meb-pilot-edge.ts: REAL official
// ÖDSGM/EBA download, DETERMINISTIC provider (no paid call). Prints only {"checks": {...}} on stdout.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const authPort = Number(process.env.GINA_QA_AUTH_PORT), restPort = Number(process.env.GINA_QA_REST_PORT), storagePort = Number(process.env.GINA_QA_STORAGE_PORT || 0);
if (![authPort, restPort, storagePort].every((v) => Number.isInteger(v) && v > 1024 && v < 65536) || !process.env.GINA_QA_SERVICE) throw Error('isolated_runner_required');
const ROOT = new URL('../', import.meta.url);
const OUT = new URL('docs/release/d15-2026-11-06/local/', ROOT);
let edgePort = 0, edge;
const proxy = http.createServer((req, res) => {
  const routes = [['/auth/v1', authPort], ['/rest/v1', restPort], ['/storage/v1', storagePort], ['/functions/v1', edgePort]];
  const route = routes.find(([prefix, port]) => port && (req.url === prefix || req.url.startsWith(prefix + '/')));
  if (!route) { res.writeHead(404); res.end(); return; }
  const [prefix, port] = route;
  const upstream = http.request({ hostname: '127.0.0.1', port, path: req.url.slice(prefix.length) || '/', method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  upstream.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(upstream);
});
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${proxy.address().port}`;
const checks = {};
const dir = mkdtempSync(join(tmpdir(), 'gina-d15-state-'));
try {
  // Deno.resolveDns needs permission for the system resolver (host:53); everything else stays loopback/official.
  const resolvers = existsSync('/etc/resolv.conf') ? [...readFileSync('/etc/resolv.conf', 'utf8').matchAll(/^nameserver\s+([0-9.]+)\s*$/gm)].map((m) => `${m[1]}:53`) : [];
  if (!resolvers.length) throw Error('d15_no_ipv4_resolver');
  edge = spawn(process.env.GINA_QA_DENO_PATH || 'deno', ['run', '--frozen', '--config', 'supabase/functions/deno.json',
    `--allow-net=127.0.0.1,odsgm.meb.gov.tr,meb.ai,cdn.eba.gov.tr,${resolvers.join(',')}`,
    '--allow-env=GINA_QA_ISOLATED,SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,ANTHROPIC_API_KEY,OPENAI_API_KEY,GEMINI_API_KEY',
    'scripts/d15-meb-pilot-edge.ts'], { cwd: ROOT.pathname, stdio: ['ignore', 'pipe', 'inherit'],
    env: { PATH: process.env.PATH, HOME: process.env.HOME, DENO_DIR: process.env.DENO_DIR ?? '', GINA_QA_ISOLATED: '1', SUPABASE_URL: base, SUPABASE_ANON_KEY: process.env.GINA_QA_ANON, SUPABASE_SERVICE_ROLE_KEY: process.env.GINA_QA_SERVICE, ANTHROPIC_API_KEY: 'synthetic-local-only' } });
  edgePort = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('d15_edge_start_timeout')), 60000);
    const lines = createInterface({ input: edge.stdout });
    edge.once('exit', () => { clearTimeout(timer); reject(Error('d15_edge_start_failed')); });
    lines.on('line', (line) => { try { const v = JSON.parse(line); if (Number.isInteger(v.port)) { clearTimeout(timer); resolve(v.port); } } catch { /* log line */ } });
  });
  // Production parity: D1 shared-source → question group conversion is on in production (C14b); the template has it off.
  const flagged = await fetch(`${base}/rest/v1/app_settings?key=eq.question_groups.enabled`, { method: 'PATCH', headers: { apikey: process.env.GINA_QA_SERVICE, authorization: `Bearer ${process.env.GINA_QA_SERVICE}`, 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify({ value: true }) });
  checks['harness.question_groups_enabled_like_production'] = flagged.ok;
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (/^(stage-.*|calls)\.json(l)?$|^(chain-trace|questions-for-human-review)\.json$/.test(f)) unlinkSync(new URL(f, OUT));
  const env = { ...process.env, GINA_MEB_PILOT_TARGET: 'local', GINA_MEB_PILOT_URL: base, GINA_MEB_PILOT_STATE: join(dir, 'state.json'), GINA_MEB_PILOT_OUT: OUT.pathname.replace(/\/$/, ''), GINA_MEB_PILOT_QA_STATS: `http://127.0.0.1:${edgePort}/__qa-provider-stats` };
  const plan = [['preflight'], ['setup'], ['override'], ['admin-setup', '--allow-temp-admin'], ['source'], ['extract'], ['review'], ['scope'], ['select'], ['generate'], ['assign'], ['cleanup', '--withdraw'], ['verify']];
  for (const [stage, ...flags] of plan) {
    const code = await new Promise((resolve) => {
      const child = spawn('node', ['docs/release/d15-2026-11-06/run-meb-pilot.mjs', stage, ...flags], { cwd: ROOT.pathname, env, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', (d) => process.stderr.write(d));
      child.stderr.on('data', (d) => process.stderr.write(d));
      child.on('exit', resolve);
    });
    const file = new URL(`stage-${stage}.json`, OUT);
    const result = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { checks: [{ name: 'stage_report_missing', ok: false }] };
    for (const c of result.checks) checks[`${stage}.${c.name}`] = c.ok;
    if (code !== 0) { checks[`${stage}.exit_zero`] = false; if (!['cleanup', 'verify'].includes(stage)) break; }
  }
} catch (e) {
  checks['harness.' + String(e.message).slice(0, 60)] = false;
} finally {
  edge?.kill('SIGTERM');
  proxy.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log(JSON.stringify({ checks }));
process.exitCode = Object.values(checks).length && Object.values(checks).every(Boolean) ? 0 : 1;
