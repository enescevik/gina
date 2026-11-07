import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { runHealthChecks } from './health-check.mjs';

export const PRIVATE_EDGE_FUNCTIONS = [
  'prova-generate', 'learning-source', 'delete-account', 'apple-token',
  'prova-review', 'library-media', 'timetable-import',
];

export async function probePrivateEdge(url, fetcher = fetch) {
  const origin = new URL(url);
  if (origin.protocol !== 'https:' || !/^[a-z]{20}\.supabase\.co$/.test(origin.hostname)) {
    throw new Error('invalid-edge-origin');
  }
  return Promise.all(PRIVATE_EDGE_FUNCTIONS.map(async name => {
    const endpoint = `${origin.origin}/functions/v1/${name}`;
    try {
      const responses = await Promise.all(['OPTIONS', 'GET'].map(async method => {
        const response = await fetcher(endpoint, { method, redirect: 'manual', signal: AbortSignal.timeout(15000) });
        await response.body?.cancel();
        return response.status;
      }));
      const [preflight, anonymous] = responses;
      return { id: `private-edge-${name}`, status: preflight === 204 && anonymous === 401 ? 'pass' : 'fail' };
    } catch {
      return { id: `private-edge-${name}`, status: 'fail' };
    }
  }));
}

export function healthTransitions(checks, previous) {
  const incidents = new Set(previous?.incidents ?? []);
  const opened = [], resolved = [];
  for (const { id, status } of checks) {
    if (status === 'fail' && !incidents.has(id)) {
      incidents.add(id);
      opened.push(id);
    } else if (status === 'pass' && incidents.delete(id)) {
      resolved.push(id);
    }
  }
  return { incidents: [...incidents].sort(), opened, resolved };
}

export function securityTransitions(alerts, previous) {
  const active = [...new Set(alerts.map(alert => alert.number))].sort((a, b) => a - b);
  if (!active.every(number => Number.isSafeInteger(number) && number > 0)) throw new Error('invalid-alert-number');
  const prior = new Set(previous?.active ?? []);
  const current = new Set(active);
  return {
    active,
    opened: previous ? active.filter(number => !prior.has(number)) : [],
    resolved: [...prior].filter(number => !current.has(number)).sort((a, b) => a - b),
  };
}

async function main() {
  const [mode, previousPath, statePath] = process.argv.slice(2);
  const previous = existsSync(previousPath) ? JSON.parse(readFileSync(previousPath, 'utf8')) : null;
  if (previous && (previous.mode !== mode || previous.version !== 1)) throw new Error('invalid-monitor-state');
  let delta;
  let skipped = [];
  if (mode === 'health') {
    const [publicHealth, edge] = await Promise.all([
      runHealthChecks({ env: process.env }),
      probePrivateEdge(process.env.MONITOR_SUPABASE_URL),
    ]);
    const checks = [...publicHealth.checks, ...edge].filter(check => check.id !== 'edge-functions');
    skipped = checks.filter(check => check.status === 'skip').map(check => check.id);
    delta = healthTransitions(checks, previous);
  } else if (mode === 'security') {
    const alerts = JSON.parse(readFileSync('security-alerts.json', 'utf8')).flat();
    delta = securityTransitions(alerts, previous);
  } else {
    throw new Error('invalid-monitor-mode');
  }

  writeFileSync(statePath, JSON.stringify({ mode, version: 1, ...delta }));
  const lines = [
    `## ${mode === 'health' ? 'Production health' : 'Weekly CodeQL difference'}`,
    '',
    `New: ${delta.opened.join(', ') || 'none'}`,
    `Recovered or no longer open: ${delta.resolved.join(', ') || 'none'}`,
    `Open: ${(delta.incidents ?? delta.active).length}`,
    `Skipped: ${skipped.join(', ') || 'none'}`,
  ];
  if (mode === 'security' && !previous) lines.push('Initial baseline recorded.');
  console.log(lines.join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
