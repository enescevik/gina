import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Probe without cookies, credentials or redirect following. A successful origin
// response is a failure here: no application file should bypass the Access gate.
export async function checkBackofficeAccess({ project, team, preview, fetcher = fetch }) {
  if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(project ?? '') ||
      !/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(team ?? '')) {
    throw Error('Invalid Pages project or Access team name');
  }
  const origin = `https://${project}.pages.dev`;
  const previewOrigin = preview ?? `https://access-check-${randomUUID()}.${project}.pages.dev`;
  const parsed = new URL(previewOrigin);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port ||
      parsed.pathname !== '/' || parsed.search || parsed.hash ||
      !parsed.hostname.endsWith(`.${project}.pages.dev`) ||
      parsed.hostname.slice(0, -`.${project}.pages.dev`.length).includes('.')) {
    throw Error('Preview must be a deployment hostname of this Pages project');
  }
  const results = [];
  for (const host of [origin, parsed.origin]) {
    for (const path of ['/', '/sign-in', '/dashboard', '/support', '/library-publication', '/brand/logo.png']) {
      const url = host + path;
      try {
        const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
        let destination;
        try { destination = new URL(response.headers.get('location')); } catch { /* fail closed */ }
        const protectedByAccess = [302, 303, 307, 308].includes(response.status) &&
          destination?.origin === `https://${team}.cloudflareaccess.com` &&
          !destination.username && !destination.password &&
          destination.pathname === `/cdn-cgi/access/login/${new URL(host).hostname}`;
        results.push({ url, status: response.status, protectedByAccess: !!protectedByAccess });
        await response.body?.cancel();
      } catch {
        results.push({ url, status: null, protectedByAccess: false });
      }
    }
  }
  // Never print the Location query: Cloudflare places transient signed data there.
  return { ok: results.every(r => r.protectedByAccess), team, project, checks: results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await checkBackofficeAccess({
      project: process.env.CF_PAGES_PROJECT ?? 'gina-backoffice',
      team: process.env.CF_ACCESS_TEAM ?? 'gina-family',
      preview: process.env.CF_PREVIEW_ORIGIN,
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
