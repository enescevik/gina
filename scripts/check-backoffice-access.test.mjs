import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBackofficeAccess } from './check-backoffice-access.mjs';

const base = { project: 'gina-backoffice', team: 'gina-family', preview: 'https://build123.gina-backoffice.pages.dev' };
const redirect = url => new Response(null, { status: 302, headers: {
  location: `https://gina-family.cloudflareaccess.com/cdn-cgi/access/login/${new URL(url).hostname}?meta=do-not-log`,
} });

test('requires Access for both hosts, application routes and static assets; never follows redirects', async () => {
  const report = await checkBackofficeAccess({ ...base, fetcher: async (url, options) => {
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers, undefined);
    return redirect(url);
  } });
  assert.equal(report.ok, true);
  assert.equal(report.checks.length, 12);
  assert.equal(JSON.stringify(report).includes('do-not-log'), false);
});

for (const path of ['/', '/dashboard', '/brand/logo.png']) {
  test(`rejects a public production response at ${path} even when previews are protected`, async () => {
    const report = await checkBackofficeAccess({ ...base, fetcher: async url =>
      url === `https://gina-backoffice.pages.dev${path}` ? new Response('public') : redirect(url),
    });
    assert.equal(report.ok, false);
  });
}

for (const location of [
  'https://gina-family.cloudflareaccess.com.attacker.invalid/cdn-cgi/access/login/gina-backoffice.pages.dev',
  'http://gina-family.cloudflareaccess.com/cdn-cgi/access/login/gina-backoffice.pages.dev',
  'https://other-team.cloudflareaccess.com/cdn-cgi/access/login/gina-backoffice.pages.dev',
  'https://gina-family.cloudflareaccess.com/unrelated',
]) {
  test(`rejects unrelated or insecure redirect: ${location}`, async () => {
    const report = await checkBackofficeAccess({ ...base, fetcher: async () =>
      new Response(null, {status:302, headers:{location}}),
    });
    assert.equal(report.ok, false);
  });
}

test('network failures and bare 403 are not accepted as proof of configured Access', async () => {
  for (const fetcher of [async () => { throw Error('offline'); }, async () => new Response(null,{status:403})]) {
    assert.equal((await checkBackofficeAccess({ ...base, fetcher })).ok, false);
  }
});

test('rejects unrelated preview origins and invalid project names before requesting', async () => {
  const fetcher = async () => { assert.fail('must not request'); };
  for (const preview of ['http://build123.gina-backoffice.pages.dev', 'https://evil.invalid', 'https://gina-backoffice.pages.dev', 'https://x.gina-backoffice.pages.dev/?token=secret']) {
    await assert.rejects(checkBackofficeAccess({ ...base, preview, fetcher }));
  }
  await assert.rejects(checkBackofficeAccess({ ...base, project: '../wrong', fetcher }));
});
