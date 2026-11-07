import assert from 'node:assert/strict';
import test from 'node:test';
import { healthTransitions, PRIVATE_EDGE_FUNCTIONS, probePrivateEdge, securityTransitions } from './production-monitor.mjs';

test('an outage opens once, a skipped check preserves it, and recovery permits a new incident', () => {
  const check = status => [{ id: 'edge', status }];
  const outage = healthTransitions(check('fail'));
  assert.deepEqual(outage, { incidents: ['edge'], opened: ['edge'], resolved: [] });
  const repeated = healthTransitions(check('fail'), outage);
  assert.deepEqual(repeated, { incidents: ['edge'], opened: [], resolved: [] });
  const skipped = healthTransitions(check('skip'), repeated);
  assert.deepEqual(skipped, repeated);
  const recovery = healthTransitions(check('pass'), skipped);
  assert.deepEqual(recovery, { incidents: [], opened: [], resolved: ['edge'] });
  assert.deepEqual(healthTransitions(check('fail'), recovery), outage);
});

test('private probes never authenticate or follow redirects and reject missing or exposed routes', async () => {
  const origin = 'https://abcdefghijklmnopqrst.supabase.co';
  const calls = [];
  const checks = await probePrivateEdge(origin, async (url, options) => {
    assert.ok(url.startsWith(origin + '/functions/v1/'));
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, 'manual');
    calls.push(options.method);
    const status = url.endsWith('/apple-token') ? 404
      : options.method === 'OPTIONS' ? 204 : url.endsWith('/library-media') ? 200 : 401;
    return { status };
  });
  assert.equal(calls.length, PRIVATE_EDGE_FUNCTIONS.length * 2);
  assert.deepEqual(checks.filter(check => check.status === 'fail').map(check => check.id),
    ['private-edge-apple-token', 'private-edge-library-media']);
  await assert.rejects(probePrivateEdge('https://example.com'), /invalid-edge-origin/);
});

test('security snapshots baseline existing alerts and report new, closed and reopened alerts', () => {
  const alerts = (...numbers) => numbers.map(number => ({ number }));
  const baseline = securityTransitions(alerts(2, 1, 1));
  assert.deepEqual(baseline, { active: [1, 2], opened: [], resolved: [] });
  const changed = securityTransitions(alerts(2, 3), baseline);
  assert.deepEqual(changed, { active: [2, 3], opened: [3], resolved: [1] });
  assert.deepEqual(securityTransitions(alerts(2, 3), changed).opened, []);
  assert.deepEqual(securityTransitions(alerts(1, 2, 3), changed).opened, [1]);
  assert.throws(() => securityTransitions(alerts('1')), /invalid-alert-number/);
});
