// C13 phase of the end-to-end family chain: C01–C11 endpoints over the real isolated GoTrue + PostgREST
// (and, when Deno is available, the unchanged curriculum-source-fetch / content-prereview Edge handlers).
// Same pattern as the Q02 chain: every positive step is repeated by a foreign family / child device /
// sibling device / revoked device / narrow operator role / forged or expired token and the refusal is asserted.
// Imported by scripts/test-e2e-family-chain.mjs; never runs on its own; no provider or hosted call.
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export async function c13Phase(x) {
  const { check, denied, must, rpc, rest, sign, claims, token, base, lossyBase, setLossy, admin, account, refresh, timed, notes,
    a1, a2, b1, devA, tabA, devB, sup, c1, c2, bc, attempt, q2, today } = x;
  const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const statusOf = async (bearer, fn, args) => { const r = await rest(base, bearer, 'rpc/' + fn, { method: 'POST', body: JSON.stringify(args) }); return { status: r.status, body: (await r.text()).slice(0, 200) }; };

  // ---- 1. dated plan (C02) + routines (C13 PERF-1 body): parent, own device, shared tablet on the other child, foreign.
  const week = { p_child_id: c1, p_from: today, p_to: addDays(today, 6) };
  const plan42 = await timed('c13_plan_for_days_42_parent_ms', () => rpc(a1.c, 'plan_for_days', { p_child_id: c1, p_from: today, p_to: addDays(today, 41) }, 'c13_plan_for_days_42_parent'));
  check('c13_plan_for_days_42_days', Array.isArray(plan42) && plan42.length === 42, plan42?.length);
  await denied(a1.c.rpc('plan_for_days', { p_child_id: c1, p_from: today, p_to: addDays(today, 42) }), 'c13_plan_for_days_43_days_refused', /plan_day_invalid/);
  const devWeek = await rpc(devA.c, 'plan_for_days', week, 'c13_device_reads_own_week');
  check('c13_device_week_7_days', devWeek.length === 7, devWeek.length);
  await denied(devA.c.rpc('plan_for_days', { ...week, p_child_id: c2 }), 'c13_device_cannot_read_sibling_week');
  await denied(b1.c.rpc('plan_for_days', week), 'c13_foreign_parent_cannot_read_week');
  await denied(devB.c.rpc('plan_for_days', week), 'c13_foreign_device_cannot_read_week');
  const routines = await rpc(a1.c, 'routines_for_day', { p_child_id: c1, p_day: today }, 'c13_parent_routines_for_day');
  check('c13_routines_for_day_lists_routines', Array.isArray(routines.routines) && routines.routines.length >= 1, JSON.stringify(routines).slice(0, 160));
  await denied(b1.c.rpc('routines_for_day', { p_child_id: c1, p_day: today }), 'c13_foreign_parent_cannot_read_routines');
  await denied(devA.c.rpc('routines_for_day', { p_child_id: c2, p_day: today }), 'c13_device_cannot_read_sibling_routines');

  // ---- 2. subject links (C02): double tap, lost response replay, two parents racing on the same alias.
  const subjects = await must(admin.from('guided_input_options').select('id').eq('kind', 'subject').eq('active', true).limit(2), 'c13_subject_options');
  if (subjects.length >= 2) {
    const [s1, s2] = subjects.map(s => s.id);
    const link = { p_request_id: randomUUID(), p_child_id: c1, p_links: [{ title: 'Synthetic Mat', subject_id: s1, expected: null }], p_source: 'manual' };
    const [t1, t2] = await Promise.all([a1.c.rpc('set_child_subject_links', link), a1.c.rpc('set_child_subject_links', link)]);
    check('c13_subject_link_double_tap_same_receipt', !t1.error && !t2.error && JSON.stringify(t1.data) === JSON.stringify(t2.data), JSON.stringify([t1.error?.message, t2.error?.message]));
    setLossy('drop');
    const lostLink = { ...link, p_request_id: randomUUID(), p_links: [{ title: 'Synthetic Fen', subject_id: s2, expected: null }] };
    const lost = await rest(lossyBase, await token(a1.c), 'rpc/set_child_subject_links', { method: 'POST', body: JSON.stringify(lostLink) }).then(() => 'responded', () => 'lost');
    setLossy('pass');
    check('c13_subject_link_lost_response', lost === 'lost', lost);
    const replay = await rpc(a1.c, 'set_child_subject_links', lostLink, 'c13_subject_link_replay_after_loss');
    check('c13_subject_link_replay_returns_receipt', !!replay, JSON.stringify(replay).slice(0, 120));
    const race = [{ c: a1.c, s: s1 }, { c: a2.c, s: s2 }].map(({ c, s }) => c.rpc('set_child_subject_links', { p_request_id: randomUUID(), p_child_id: c1, p_links: [{ title: 'Synthetic Race', subject_id: s, expected: null }], p_source: 'manual' }));
    const raced = await Promise.all(race);
    const wins = raced.filter(r => !r.error).length, conflicts = raced.filter(r => /subject_link_changed/.test(r.error?.message || '')).length;
    check('c13_subject_link_two_parents_one_winner', wins === 1 && conflicts === 1, JSON.stringify(raced.map(r => r.error?.message ?? 'ok')));
    const links = await rpc(a2.c, 'child_subject_links', { p_child_id: c1 }, 'c13_co_parent_reads_links');
    check('c13_co_parent_sees_links', JSON.stringify(links).includes('Synthetic Mat'), JSON.stringify(links).slice(0, 160));
    await denied(b1.c.rpc('child_subject_links', { p_child_id: c1 }), 'c13_foreign_parent_cannot_read_links');
    await denied(b1.c.rpc('set_child_subject_links', { ...link, p_request_id: randomUUID() }), 'c13_foreign_parent_cannot_write_links');
    await denied(devA.c.rpc('set_child_subject_links', { ...link, p_request_id: randomUUID() }), 'c13_device_cannot_write_links');
    await denied(devB.c.rpc('child_subject_links', { p_child_id: c1 }), 'c13_foreign_device_cannot_read_links');
  } else {
    notes.push({ observation: 'c13_subject_options_missing', count: subjects.length });
  }

  // ---- 3. AI grade acceptance (C08), AI usage, weekly review (C04), legacy correction (C01), pairing preview (C06), channels (C10).
  await denied(b1.c.rpc('accept_ai_grade', { p_attempt_id: attempt, p_question_id: q2, p_expected: 1 }), 'c13_foreign_parent_cannot_accept_ai_grade');
  await denied(devA.c.rpc('accept_ai_grade', { p_attempt_id: attempt, p_question_id: q2, p_expected: 1 }), 'c13_device_cannot_accept_ai_grade');
  check('c13_parent_reads_ai_usage', !!(await rpc(a1.c, 'get_ai_usage', {}, 'c13_get_ai_usage')));
  await denied(devA.c.rpc('get_ai_usage', {}), 'c13_device_cannot_read_ai_usage');
  const monday = addDays(today, -((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7));
  check('c13_parent_weekly_review_children', !!(await rpc(a1.c, 'weekly_review_children', { p_week: monday }, 'c13_weekly_review_children')));
  await denied(devA.c.rpc('weekly_review_children', { p_week: monday }), 'c13_device_cannot_read_weekly_review');
  await denied(b1.c.rpc('get_family_weekly_review', { p_week: monday }).then(r => r.error ? r : { error: JSON.stringify(r.data).includes(a1.family) ? null : { message: 'no foreign rows' } }), 'c13_foreign_weekly_review_has_no_a_rows');
  await rpc(a1.c, 'preview_legacy_open_zero_corrections', { p_family_id: a1.family }, 'c13_parent_legacy_preview_own');
  await denied(b1.c.rpc('preview_legacy_open_zero_corrections', { p_family_id: a1.family }), 'c13_foreign_parent_legacy_preview_denied');
  await denied(b1.c.rpc('apply_legacy_open_zero_corrections', { p_request_id: randomUUID(), p_attempt_ids: [attempt], p_family_id: a1.family }), 'c13_foreign_parent_legacy_apply_denied');
  await denied(sup.c.rpc('preview_legacy_open_zero_corrections', { p_family_id: a1.family }), 'c13_support_legacy_preview_denied');
  const preview = await rpc(a1.c, 'preview_device_pairing', { p_code: '000000' }, 'c13_parent_pairing_preview');
  check('c13_pairing_preview_unknown_code', preview?.status === 'invalid_or_expired', JSON.stringify(preview));
  await denied(devA.c.rpc('preview_device_pairing', { p_code: '000000' }), 'c13_device_cannot_preview_pairing');
  await rpc(a1.c, 'my_notification_channels', {}, 'c13_parent_channels');
  await denied(devA.c.rpc('my_notification_channels', {}), 'c13_device_cannot_read_channels');

  // ---- 4. narrow operator roles (C07/C09/C10/C11) with real accounts; claim alone never grants a role.
  const op = async (role) => {
    const p = await account('c13_' + role);
    await must(admin.from('operations_members').insert({ user_id: p.user, role, expires_at: new Date(Date.now() + 3600000).toISOString() }), 'c13_grant_' + role);
    await refresh(p.c); return p;
  };
  const content = await op('content'), finance = await op('finance'), release = await op('release'), support = await op('support');
  await rpc(content.c, 'admin_library_content_page', { p_limit: 20 }, 'c13_content_reads_library_page');
  await rpc(content.c, 'operator_prereview_notices', { p_unread_only: false, p_limit: 20 }, 'c13_content_reads_prereview_notices');
  await rpc(support.c, 'support_canned_replies', {}, 'c13_support_reads_canned_replies');
  await rpc(release.c, 'release_channel_failures', { p_limit: 5 }, 'c13_release_reads_channel_failures');
  for (const [who, fn, args] of [
    [support, 'admin_library_content_page', { p_limit: 20 }], [finance, 'admin_library_content_page', { p_limit: 20 }],
    [content, 'support_canned_replies', {}], [release, 'support_canned_replies', {}],
    [support, 'operator_prereview_notices', { p_unread_only: false, p_limit: 5 }], [content, 'release_channel_failures', { p_limit: 5 }],
    [finance, 'admin_subject_synonyms', {}], [content, 'admin_curriculum_pipeline', {}], [a1, 'admin_library_content_page', { p_limit: 20 }],
    [devA, 'support_canned_replies', {}],
  ]) await denied(who.c.rpc(fn, args), `c13_${who.label}_cannot_${fn}`);
  // forged operator claim on a parent token (signature valid, no operations_members row)
  const b1Claims = claims((await b1.c.auth.getSession()).data.session);
  const forgedOp = sign({ ...b1Claims, gina: { ...b1Claims.gina, admin: true, operation_roles: ['content', 'support'] } });
  const forgedPage = await statusOf(forgedOp, 'admin_library_content_page', { p_limit: 20 });
  check('c13_forged_operator_claim_denied', forgedPage.status >= 400, JSON.stringify(forgedPage));
  // revoke content role while the session is open: next call refused
  await must(admin.from('operations_members').update({ revoked_at: new Date().toISOString() }).eq('user_id', content.user), 'c13_revoke_content');
  await denied(content.c.rpc('admin_library_content_page', { p_limit: 20 }), 'c13_revoked_content_old_token_denied');
  // expired token on a new endpoint
  const a1Claims = claims((await a1.c.auth.getSession()).data.session);
  // PostgREST tolerates 30 s clock skew on exp (observed: exp-30 s still 200); beyond it the token is refused.
  const skew = sign({ ...a1Claims, iat: a1Claims.iat - 7200, exp: Math.floor(Date.now() / 1000) - 20 });
  notes.push({ observation: 'c13_postgrest_exp_skew_20s_status', status: (await statusOf(skew, 'plan_for_days', week)).status });
  const expired = sign({ ...a1Claims, iat: a1Claims.iat - 7200, exp: Math.floor(Date.now() / 1000) - 120 });
  const expiredPlan = await statusOf(expired, 'plan_for_days', week);
  check('c13_expired_token_plan_401', expiredPlan.status === 401, JSON.stringify(expiredPlan));
  const forgedFamily = sign({ ...b1Claims, gina: { ...b1Claims.gina, family_id: a1.family } });
  const forgedPlan = await statusOf(forgedFamily, 'plan_for_days', week);
  check('c13_forged_family_claim_plan_denied', forgedPlan.status >= 400, JSON.stringify(forgedPlan));
  const anonPlan = await statusOf(process.env.GINA_QA_ANON, 'plan_for_days', week);
  check('c13_anon_plan_denied', anonPlan.status >= 400, JSON.stringify(anonPlan));
  const anonUnsub = await statusOf(process.env.GINA_QA_ANON, 'unsubscribe_with_token', { p_token: 'bogus' });
  check('c13_anon_unsubscribe_bogus_token_no_effect', anonUnsub.status < 500, JSON.stringify(anonUnsub));

  // ---- 5. Edge (unchanged handlers in a local Deno process): curriculum-source-fetch (admin only) and content-prereview.
  const edge = await startEdge(base);
  if (!edge) { notes.push({ observation: 'c13_edge_not_started' }); return; }
  try {
    const call = (path, bearer, body, headers = {}) => fetch(`http://127.0.0.1:${edge.port}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}), ...headers }, body });
    const target = JSON.stringify({ request_id: randomUUID(), target: { exam_family: 'lgs', year: '2026', term: 1, subject: 'matematik' } });
    for (const [label, bearer] of [['anon', process.env.GINA_QA_ANON], ['parent', await token(a1.c)], ['device', await token(devA.c)], ['release_op', await token(release.c)]]) {
      const r = await call('curriculum-source-fetch', bearer, target);
      check(`c13_edge_curriculum_fetch_${label}_forbidden`, r.status === 403 || r.status === 401, r.status + ' ' + (await r.text()).slice(0, 80));
    }
    const forgedAdmin = await call('curriculum-source-fetch', sign({ ...b1Claims, gina: { ...b1Claims.gina, admin: true } }), target);
    check('c13_edge_curriculum_fetch_forged_admin_forbidden', forgedAdmin.status === 403 || forgedAdmin.status === 401, forgedAdmin.status);
    const pre = JSON.stringify({ kind: 'curriculum_candidate', id: randomUUID() });
    for (const [label, bearer] of [['anon', process.env.GINA_QA_ANON], ['parent', await token(a1.c)], ['device', await token(devA.c)], ['support_op', await token(support.c)]]) {
      const r = await call('content-prereview', bearer, pre);
      check(`c13_edge_prereview_${label}_forbidden`, r.status === 403, r.status + ' ' + (await r.text()).slice(0, 80));
    }
    const drain = await call('content-prereview', await token(a1.c), JSON.stringify({ drain: true }));
    check('c13_edge_prereview_drain_needs_system', drain.status === 403, drain.status);
    const wrongCron = await call('content-prereview', null, JSON.stringify({ drain: true }), { 'x-cron-secret': 'wrong' });
    check('c13_edge_prereview_wrong_cron_secret_forbidden', wrongCron.status === 403, wrongCron.status);
    const huge = await call('content-prereview', await token(a1.c), JSON.stringify({ kind: 'curriculum_candidate', id: randomUUID(), pad: 'x'.repeat(300 * 1024) }));
    check('c13_edge_prereview_oversized_body_400', huge.status === 400, huge.status);
  } finally { edge.stop(); }
}

async function startEdge(base) {
  const deno = process.env.GINA_QA_DENO_PATH || 'deno';
  let child;
  try {
    child = spawn(deno, ['run', '--cached-only', '--frozen', '--config', 'supabase/functions/deno.json', '--allow-net=127.0.0.1',
      '--allow-env=GINA_QA_ISOLATED,SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,CONTENT_PREREVIEW_SECRET,ANTHROPIC_API_KEY',
      'scripts/test-e2e-family-chain.c13-edge.ts'], { stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, GINA_QA_ISOLATED: '1', SUPABASE_URL: base,
      SUPABASE_ANON_KEY: process.env.GINA_QA_ANON, SUPABASE_SERVICE_ROLE_KEY: process.env.GINA_QA_SERVICE, CONTENT_PREREVIEW_SECRET: randomUUID() + randomUUID() } });
  } catch { return null; }
  const port = await new Promise(resolve => {
    const timer = setTimeout(() => resolve(0), 20000);
    const lines = createInterface({ input: child.stdout });
    child.once('error', () => { clearTimeout(timer); resolve(0); }); child.once('exit', () => { clearTimeout(timer); resolve(0); });
    lines.on('line', l => { try { const v = JSON.parse(l); if (Number.isInteger(v.port)) { clearTimeout(timer); lines.close(); resolve(v.port); } } catch {} });
  });
  if (!port) { child.kill('SIGKILL'); return null; }
  return { port, stop: () => child.kill('SIGTERM') };
}
