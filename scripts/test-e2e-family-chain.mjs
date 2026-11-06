// Q02 end-to-end family chain. Invoked only by scripts/test-e2e-family-chain.py against
// ephemeral loopback Auth/REST services in a disposable DB clone. No production, no paid AI.
// Every positive step is followed by the same request from a foreign family/role, asserting refusal.
// Unlike the 149-check contract, a failed check is recorded and the chain continues where it can.
import http from 'node:http';
import { createHmac, randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { c13Phase } from './test-e2e-family-chain.c13.mjs';
const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const authPort = Number(process.env.GINA_QA_AUTH_PORT), restPort = Number(process.env.GINA_QA_REST_PORT);
const secret = process.env.GINA_QA_JWT_SECRET;
if (![authPort, restPort].every(v => Number.isInteger(v) && v > 1024 && v < 65536) || !process.env.GINA_QA_SERVICE || !secret) throw Error('isolated_runner_required');

const checks = {}, failures = [], notes = [];
const check = (label, pass, detail) => { checks[label] = !!pass; if (!pass) failures.push({ label, detail: detail === undefined ? null : String(detail).slice(0, 400) }); return !!pass; };
const must = async (operation, label) => { const r = await operation; if (r.error) { check(label, false, r.error.message || JSON.stringify(r.error)); throw Error(label); } checks[label] = true; return r.data; };
const denied = async (operation, label, pattern) => { const r = await operation; const msg = r.error?.message || ''; const ok = !!r.error && (!pattern || pattern.test(msg)); return check(label, ok, r.error ? 'error=' + msg : 'allowed: ' + JSON.stringify(r.data).slice(0, 200)); };
const section = async (name, fn) => { try { await fn(); } catch (e) { const label = e instanceof Error && /^[a-z0-9_]+$/.test(e.message) ? e.message : name + '_section_failed'; if (!(label in checks)) check(label, false, e.message); notes.push({ section: name, aborted: label }); } };

// Loopback gateway: /auth/v1 and /rest/v1 like the official API gateway.
const proxy = http.createServer((req, res) => {
  const route = [['/auth/v1', authPort], ['/rest/v1', restPort]].find(([p]) => req.url === p || req.url.startsWith(p + '/'));
  if (!route) { res.writeHead(404); res.end(); return; }
  const up = http.request({ hostname: '127.0.0.1', port: route[1], path: req.url.slice(route[0].length) || '/', method: req.method, headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(up);
});
await new Promise(r => proxy.listen(0, '127.0.0.1', r));
const basePort = proxy.address().port, base = `http://127.0.0.1:${basePort}`;
// Lossy/slow network imitation in front of the gateway: 'delay' holds the response,
// 'drop' lets the server commit, then closes the client socket before any byte of the response.
let lossyMode = 'pass';
const lossy = http.createServer((req, res) => {
  const chunks = []; req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const up = http.request({ hostname: '127.0.0.1', port: basePort, path: req.url, method: req.method, headers: req.headers }, r => {
      const out = []; r.on('data', c => out.push(c));
      r.on('end', () => { if (lossyMode === 'drop') { res.socket.destroy(); return; } setTimeout(() => { res.writeHead(r.statusCode, r.headers); res.end(Buffer.concat(out)); }, lossyMode === 'delay' ? 1500 : 0); });
    });
    up.on('error', () => { res.writeHead(502); res.end(); }); up.end(Buffer.concat(chunks));
  });
});
await new Promise(r => lossy.listen(0, '127.0.0.1', r));
const lossyBase = `http://127.0.0.1:${lossy.address().port}`;

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const clients = [];
const client = () => { const c = createClient(base, process.env.GINA_QA_ANON, options); clients.push(c); return c; };
const admin = createClient(base, process.env.GINA_QA_SERVICE, options);
const rpc = (c, name, args, label = name) => must(c.rpc(name, args), label);
const claims = session => JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString());
const refresh = async c => (await must(c.auth.refreshSession(), 'refresh_session')).session;
const token = async c => (await c.auth.getSession()).data.session.access_token;
const sign = payload => { const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url'); const body = enc({ alg: 'HS256', typ: 'JWT' }) + '.' + enc(payload); return body + '.' + createHmac('sha256', secret).update(body).digest('base64url'); };
const rest = (origin, bearer, path, init = {}) => fetch(origin + '/rest/v1/' + path, { ...init, headers: { apikey: process.env.GINA_QA_ANON, Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) } });
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
const timing = {}; const timed = async (label, fn) => { const t = performance.now(); const v = await fn(); timing[label] = Math.round(performance.now() - t); return v; };

async function account(label) {
  const c = client(), password = randomBytes(24).toString('base64url'), email = `gina-${randomUUID()}@example.invalid`;
  const { user } = await must(admin.auth.admin.createUser({ email, password, email_confirm: true }), 'create_user_' + label);
  await must(c.auth.signInWithPassword({ email, password }), 'password_sign_in_' + label);
  return { c, email, password, user: user.id, label };
}
async function founder(label, familyName) {
  const p = await account(label);
  p.family = await rpc(p.c, 'create_family', { p_name: familyName, p_display_name: 'Synthetic ' + label }, 'create_family_' + label);
  const s = await refresh(p.c);
  check('claim_parent_' + label, claims(s).gina.family_id === p.family && claims(s).gina.role === 'parent', JSON.stringify(claims(s).gina));
  return p;
}
async function joiner(label, inviteCode, family) {
  const p = await account(label);
  const joined = await rpc(p.c, 'join_family', { p_invite_code: inviteCode, p_display_name: 'Synthetic ' + label }, 'join_family_' + label);
  check('join_returns_family_' + label, joined === family, joined);
  const s = await refresh(p.c); p.family = family;
  check('claim_co_parent_' + label, claims(s).gina.family_id === family && claims(s).gina.role === 'parent', JSON.stringify(claims(s).gina));
  return p;
}
async function device(parent, label, childIds, name) {
  const c = client(); await must(c.auth.signInAnonymously(), 'anonymous_sign_in_' + label);
  const code = await rpc(c, 'request_pairing', { p_device_name: name }, 'request_pairing_' + label);
  const id = await rpc(parent.c, 'pair_child_device', { p_code: code }, 'pair_' + label);
  await refresh(c);
  await rpc(parent.c, 'configure_child_device', { p_device_id: id, p_name: name, p_child_ids: childIds, p_pin_required: true }, 'configure_' + label);
  const s = await refresh(c);
  return { c, id, code, user: (await c.auth.getUser()).data.user.id, label, session: s };
}
async function login(dev, childId, pin, label) {
  const ok = await rpc(dev.c, 'child_pin_login', { p_child_id: childId, p_pin: pin }, 'pin_login_' + label);
  const s = await refresh(dev.c); dev.session = s;
  return check(label, ok === true && claims(s).gina.child_id === childId && claims(s).gina.role === 'device', JSON.stringify(claims(s).gina));
}
const childIds = async c => (await must(c.from('children').select('id').order('created_at'), 'read_children')).map(r => r.id).sort();

const out = {};
try {
  // ---------------------------------------------------------------- 1. registration, families, co-parents
  const a1 = await founder('a1', 'Synthetic family A'), b1 = await founder('b1', 'Synthetic family B');
  const inviteA = (await must(a1.c.from('families').select('invite_code').eq('id', a1.family).single(), 'founder_reads_own_invite')).invite_code;
  const inviteB = (await must(b1.c.from('families').select('invite_code').eq('id', b1.family).single(), 'founder_reads_own_invite_b')).invite_code;
  check('foreign_family_row_hidden', (await must(b1.c.from('families').select('id'), 'b_reads_families')).every(r => r.id !== a1.family));
  const badPreview = await b1.c.rpc('preview_family_invite', { p_invite_code: 'ZZZZZZZZ' });
  check('wrong_invite_code_rejected', !!badPreview.error || badPreview.data?.error, JSON.stringify(badPreview.data));
  const a2 = await joiner('a2', inviteA, a1.family), b2 = await joiner('b2', inviteB, b1.family);
  const b3 = await joiner('b3', inviteB, b1.family); // membership revocation subject
  // support operator and full admin (no family membership)
  const sup = await account('support');
  await must(admin.from('operations_members').insert({ user_id: sup.user, role: 'support', expires_at: new Date(Date.now() + 3600000).toISOString() }), 'grant_support');
  await refresh(sup.c);
  const adm = await account('admin');
  await must(admin.from('admins').insert({ user_id: adm.user }), 'grant_admin');
  const admSession = await refresh(adm.c);
  check('claim_admin_true', claims(admSession).gina?.admin === true, JSON.stringify(claims(admSession).gina));
  check('support_role_live', JSON.stringify(await rpc(sup.c, 'my_operation_roles', {})) === '["support"]');

  // ---------------------------------------------------------------- 2. children
  const profile = n => ({ name: n, birth_year: 2015, grade: 5, gender: 'unspecified', avatar: 'avatar-default', interests: [] });
  const setupC1 = { p_request_id: randomUUID(), p_profile: profile('Synthetic A child one'), p_tasks: [] };
  const c1 = await rpc(a1.c, 'save_child_setup', setupC1, 'child_c1');
  const [dup1, dup2] = await Promise.all([a1.c.rpc('save_child_setup', setupC1), a1.c.rpc('save_child_setup', setupC1)]);
  check('child_setup_parallel_replay_same_id', !dup1.error && !dup2.error && dup1.data === c1 && dup2.data === c1, JSON.stringify([dup1.error?.message, dup2.error?.message]));
  const c2 = await rpc(a2.c, 'save_child_setup', { p_request_id: randomUUID(), p_profile: profile('Synthetic A child two'), p_tasks: [] }, 'co_parent_creates_child_c2');
  const bc = await rpc(b1.c, 'save_child_setup', { p_request_id: randomUUID(), p_profile: profile('Synthetic B child'), p_tasks: [] }, 'child_bc');
  check('children_count_a_is_two', (await childIds(a1.c)).length === 2);
  check('co_parent_sees_same_children', JSON.stringify(await childIds(a2.c)) === JSON.stringify([c1, c2].sort()));
  check('foreign_parent_sees_no_a_children', !(await childIds(b1.c)).some(id => id === c1 || id === c2));
  check('support_sees_no_children', (await sup.c.from('children').select('id')).data?.length === 0);
  check('admin_sees_no_children_via_rest', (await adm.c.from('children').select('id')).data?.length === 0);
  const hijack = await b1.c.from('children').update({ name: 'Hijack' }).eq('id', c1).select();
  check('foreign_update_child_no_rows', !!hijack.error || hijack.data.length === 0, JSON.stringify(hijack.data));
  check('child_name_unchanged', (await must(a1.c.from('children').select('name').eq('id', c1).single(), 'read_c1')).name === 'Synthetic A child one');
  await rpc(a1.c, 'set_child_pin', { p_child_id: c1, p_pin: '1234' }, 'pin_c1');
  await rpc(a2.c, 'set_child_pin', { p_child_id: c2, p_pin: '2345' }, 'pin_c2_by_co_parent');
  await rpc(b1.c, 'set_child_pin', { p_child_id: bc, p_pin: '3456' }, 'pin_bc');
  await denied(b1.c.rpc('set_child_pin', { p_child_id: c1, p_pin: '0000' }), 'foreign_set_child_pin_denied');

  // ---------------------------------------------------------------- 3. devices: single-child phone + shared tablet
  const devA = await device(a1, 'devA', [c1], 'Synthetic child phone');
  // Free plan allows one device: the second pairing must be refused before the synthetic entitlement.
  const secondAnon = client(); await must(secondAnon.auth.signInAnonymously(), 'anonymous_second_device');
  const limitCode = await rpc(secondAnon, 'request_pairing', { p_device_name: 'Limit probe' }, 'request_pairing_limit_probe');
  await denied(a2.c.rpc('pair_child_device', { p_code: limitCode }), 'free_plan_second_device_refused', /plan_limit_devices/);
  await must(admin.from('entitlement_overrides').insert({ family_id: a1.family, plan: 'pro', reason: 'Q02 isolated chain', ends_at: new Date(Date.now() + 3600000).toISOString() }), 'synthetic_entitlement_a');
  const tabA = await device(a2, 'tabA', [c1, c2], 'Synthetic shared tablet');
  const devB = await device(b1, 'devB', [bc], 'Synthetic B phone');
  await denied(b1.c.rpc('configure_child_device', { p_device_id: devA.id, p_name: 'Stolen', p_child_ids: [c1], p_pin_required: false }), 'foreign_configure_device_denied');
  const foreignRevoke = await b1.c.rpc('revoke_device', { p_device_id: devA.id });
  const devARow = await must(admin.from('devices').select('revoked_at').eq('id', devA.id).single(), 'devA_row_after_foreign_revoke');
  check('foreign_revoke_device_has_no_effect', devARow.revoked_at === null, JSON.stringify(devARow));
  // Observation: the RPC answers success for a device outside the caller's family (silent no-op, no error).
  notes.push({ observation: 'foreign_revoke_device_response', error: foreignRevoke.error?.message ?? null, data: foreignRevoke.data ?? null });
  await denied(a1.c.rpc('pair_child_device', { p_code: devB.code }), 'used_pairing_code_cannot_be_reused');
  await login(devA, c1, '1234', 'devA_logs_in_c1');
  check('devA_wrong_child_denied', !!(await devA.c.rpc('child_pin_login', { p_child_id: c2, p_pin: '2345' })).error);
  await login(tabA, c2, '2345', 'tabA_logs_in_c2');
  check('tablet_sees_both_children', JSON.stringify(await childIds(tabA.c)) === JSON.stringify([c1, c2].sort()));
  check('phone_sees_only_c1', JSON.stringify(await childIds(devA.c)) === JSON.stringify([c1]));
  await login(devB, bc, '3456', 'devB_logs_in_bc');
  check('devB_sees_only_bc', JSON.stringify(await childIds(devB.c)) === JSON.stringify([bc]));

  // ---------------------------------------------------------------- 4. task/routine
  const taskC1 = randomUUID(), taskC2 = randomUUID();
  await must(a2.c.from('task_templates').insert({ id: taskC1, family_id: a1.family, child_id: c1, title: 'Synthetic reading', stars: 2, starts_on: today }), 'co_parent_creates_task');
  await must(a1.c.from('task_templates').insert({ id: taskC2, family_id: a1.family, child_id: c2, title: 'Synthetic tidy up', stars: 1, starts_on: today }), 'task_for_c2');
  const foreignTask = await b1.c.from('task_templates').insert({ family_id: a1.family, child_id: c1, title: 'Injected', stars: 1 }).select();
  check('foreign_task_insert_denied', !!foreignTask.error, JSON.stringify(foreignTask.data));
  const deviceTask = await devA.c.from('task_templates').insert({ family_id: a1.family, child_id: c1, title: 'Child made', stars: 10 }).select();
  check('device_task_insert_denied', !!deviceTask.error, JSON.stringify(deviceTask.data));
  // competing routine edits with the same revision: exactly one wins
  const routineValue = t => ({ title: t, icon: 'task-custom', stars: 2, days_of_week: [1, 2, 3, 4, 5], time_of_day: 'any', requires_approval: true });
  const [e1, e2] = await Promise.all([
    a1.c.rpc('change_task_routine', { p_request_id: randomUUID(), p_id: taskC1, p_revision: 1, p_action: 'save', p_value: routineValue('Edit by a1') }),
    a2.c.rpc('change_task_routine', { p_request_id: randomUUID(), p_id: taskC1, p_revision: 1, p_action: 'save', p_value: routineValue('Edit by a2') }),
  ]);
  const wins = [e1, e2].filter(r => !r.error).length;
  check('competing_routine_edit_one_winner', wins === 1 && [e1, e2].some(r => r.error?.message === 'task_routine_changed'), JSON.stringify([e1.error?.message, e2.error?.message]));
  const routineRow = await must(a1.c.from('task_templates').select('revision,title').eq('id', taskC1).single(), 'read_routine');
  check('routine_revision_advanced_once', routineRow.revision === 2, routineRow.revision);
  await denied(b1.c.rpc('change_task_routine', { p_request_id: randomUUID(), p_id: taskC1, p_revision: 2, p_action: 'pause' }), 'foreign_routine_change_denied');
  await denied(sup.c.rpc('change_task_routine', { p_request_id: randomUUID(), p_id: taskC1, p_revision: 2, p_action: 'pause' }), 'support_routine_change_denied');

  // ---------------------------------------------------------------- 5. child submission (+ lost response replay)
  const completionArgs = { p_template_id: taskC1, p_due_date: today, p_client_id: randomUUID() };
  const [s1, s2] = await Promise.all([devA.c.rpc('complete_task', completionArgs), devA.c.rpc('complete_task', completionArgs)]);
  const comp = (Array.isArray(s1.data) ? s1.data[0] : s1.data) || (Array.isArray(s2.data) ? s2.data[0] : s2.data);
  check('double_tap_complete_single_row', !s1.error && !s2.error && JSON.stringify(s1.data) === JSON.stringify(s2.data), JSON.stringify([s1.error?.message, s2.error?.message]));
  check('completion_rows_for_task_one', (await must(a1.c.from('task_completions').select('id').eq('template_id', taskC1), 'count_completions')).length === 1);
  await denied(tabA.c.rpc('complete_task', { p_template_id: taskC1, p_due_date: today, p_client_id: randomUUID() }), 'tablet_other_child_cannot_complete_c1_task');
  await denied(devB.c.rpc('complete_task', { p_template_id: taskC1, p_due_date: today, p_client_id: randomUUID() }), 'foreign_device_cannot_complete_task');
  await denied(b1.c.rpc('complete_task', { p_template_id: taskC1, p_due_date: today, p_client_id: randomUUID(), p_acting_child_id: c1 }), 'foreign_parent_cannot_complete_task');
  // lossy network: tablet (c2) completes its own task; the response is lost; the client retries with the same client id
  lossyMode = 'drop';
  const c2Args = { p_template_id: taskC2, p_due_date: today, p_client_id: randomUUID() };
  const lost = await rest(lossyBase, await token(tabA.c), 'rpc/complete_task', { method: 'POST', body: JSON.stringify(c2Args) }).then(() => 'responded', e => 'lost:' + e.cause?.code);
  lossyMode = 'pass';
  check('lossy_drop_client_saw_network_error', lost.startsWith('lost'), lost);
  const retried = await rpc(tabA.c, 'complete_task', c2Args, 'retry_after_lost_response');
  const retriedRow = Array.isArray(retried) ? retried[0] : retried;
  const c2Rows = await must(a1.c.from('task_completions').select('id,status').eq('template_id', taskC2), 'count_c2_completions');
  check('lost_response_retry_single_completion', c2Rows.length === 1 && c2Rows[0].id === retriedRow.id, JSON.stringify(c2Rows));
  lossyMode = 'delay';
  const slow = await timed('slow_complete_task_roundtrip_ms', async () => rest(lossyBase, await token(tabA.c), 'rpc/complete_task', { method: 'POST', body: JSON.stringify(c2Args) }));
  lossyMode = 'pass';
  check('slow_network_replay_still_single', slow.ok && (await must(a1.c.from('task_completions').select('id').eq('template_id', taskC2), 'count_c2_after_slow')).length === 1, slow.status);

  // ---------------------------------------------------------------- 6. parent approval
  await denied(b1.c.rpc('review_task', { p_completion_id: comp.id, p_approve: true }), 'foreign_review_denied');
  await denied(devA.c.rpc('review_task', { p_completion_id: comp.id, p_approve: true }), 'device_review_denied');
  await denied(sup.c.rpc('review_task', { p_completion_id: comp.id, p_approve: true }), 'support_review_denied');
  await denied(adm.c.rpc('review_task', { p_completion_id: comp.id, p_approve: true }), 'admin_review_denied');
  const reviewReq = { p_request_id: randomUUID(), p_completion_id: comp.id, p_approve: true, p_expected_completed_at: comp.completed_at };
  const [r1, r2] = await Promise.all([a1.c.rpc('review_task_once', reviewReq), a2.c.rpc('review_task_once', { ...reviewReq, p_request_id: randomUUID() })]);
  check('two_parents_approve_once', [r1, r2].filter(r => !r.error).length === 1 && [r1, r2].some(r => r.error?.message === 'already_reviewed'), JSON.stringify([r1.error?.message, r2.error?.message]));
  const starsC1 = (await must(a1.c.from('star_events').select('delta').eq('child_id', c1), 'stars_c1')).reduce((n, r) => n + r.delta, 0);
  check('stars_awarded_once', starsC1 === 2, starsC1);
  // Q02-3: sunucu tarafı bakiye defter toplamıyla aynı; veli, o çocuğun cihazı okur; yabancı aile/cihaz okuyamaz.
  const serverC1 = await rpc(a1.c, 'child_star_balance', { p_child_id: c1 }, 'server_balance_c1');
  check('server_child_balance_matches_ledger', serverC1.balance === starsC1, JSON.stringify(serverC1));
  const deviceC1 = await rpc(devA.c, 'child_star_balance', { p_child_id: c1 }, 'device_balance_c1');
  check('device_child_balance_matches_ledger', deviceC1.balance === starsC1, JSON.stringify(deviceC1));
  const familyTotals = await rpc(a1.c, 'family_star_balances', {}, 'family_star_balances');
  check('family_star_balances_match_ledger', familyTotals.find(r => r.child_id === c1)?.balance === starsC1, JSON.stringify(familyTotals));
  await denied(b1.c.rpc('child_star_balance', { p_child_id: c1 }), 'foreign_parent_balance_denied');
  await denied(devB.c.rpc('child_star_balance', { p_child_id: c1 }), 'foreign_device_balance_denied');
  await denied(devA.c.rpc('family_star_balances'), 'device_family_balances_denied');
  const c2Comp = retriedRow;
  await rpc(a2.c, 'review_task', { p_completion_id: c2Comp.id, p_approve: true }, 'approve_c2');

  // ---------------------------------------------------------------- 7. reward request
  const reward = await must(a1.c.from('family_rewards').insert({ family_id: a1.family, title: 'Synthetic cinema', cost_stars: 2 }).select().single(), 'create_reward');
  const foreignReward = await b1.c.from('family_rewards').insert({ family_id: a1.family, title: 'Injected', cost_stars: 1 }).select();
  check('foreign_reward_insert_denied', !!foreignReward.error);
  const key = randomUUID();
  const [rq1, rq2] = await Promise.all([devA.c.rpc('request_reward', { p_reward_id: reward.id, p_idempotency_key: key }), devA.c.rpc('request_reward', { p_reward_id: reward.id, p_idempotency_key: key })]);
  check('double_tap_reward_request_single', !rq1.error && !rq2.error && rq1.data.id === rq2.data.id, JSON.stringify([rq1.error?.message, rq2.error?.message]));
  const request = rq1.data;
  check('reward_requests_single_row', (await must(a1.c.from('reward_requests').select('id').eq('child_id', c1), 'count_requests')).length === 1);
  await denied(tabA.c.rpc('request_reward', { p_reward_id: reward.id, p_idempotency_key: key }), 'other_child_cannot_replay_key', /request_conflict/);
  await denied(devB.c.rpc('request_reward', { p_reward_id: reward.id, p_idempotency_key: randomUUID() }), 'foreign_device_reward_denied');
  await denied(b1.c.rpc('decide_reward_request', { p_request_id: request.id, p_approve: true }), 'foreign_decide_denied');
  await denied(sup.c.rpc('decide_reward_request', { p_request_id: request.id, p_approve: true }), 'support_decide_denied');
  const [d1, d2] = await Promise.all([a2.c.rpc('decide_reward_request', { p_request_id: request.id, p_approve: true }), a1.c.rpc('decide_reward_request', { p_request_id: request.id, p_approve: true })]);
  check('parallel_decide_both_return_approved', !d1.error && !d2.error && d1.data.status === 'approved' && d2.data.status === 'approved', JSON.stringify([d1.error?.message, d2.error?.message]));
  const starsAfter = (await must(a1.c.from('star_events').select('delta').eq('child_id', c1), 'stars_after_reward')).reduce((n, r) => n + r.delta, 0);
  check('reward_debited_once', starsAfter === 0, starsAfter);
  check('server_balance_after_reward', (await rpc(a1.c, 'child_star_balance', { p_child_id: c1 }, 'server_balance_after_reward')).balance === starsAfter);
  await denied(devA.c.rpc('request_reward', { p_reward_id: reward.id, p_idempotency_key: randomUUID() }), 'insufficient_stars_rejected', /insufficient_stars/);
  await denied(b1.c.rpc('reward_history', { p_id: reward.id }), 'foreign_reward_history_denied');

  // ---------------------------------------------------------------- 8. notes: private / shared / child
  const noteValue = (visibility, body) => ({ title: 'Synthetic note', body, subject: 'Matematik', visibility });
  const priv = await rpc(a1.c, 'save_parent_note', { p_request_id: randomUUID(), p_child_id: c1, p_value: noteValue('private', 'Private observation') }, 'private_note');
  check('co_parent_cannot_see_private_note', (await must(a2.c.from('notes').select('id'), 'a2_notes')).every(n => n.id !== priv.id));
  await denied(a2.c.rpc('note_history', { p_id: priv.id }), 'co_parent_private_history_denied');
  await denied(a2.c.rpc('save_parent_note', { p_request_id: randomUUID(), p_id: priv.id, p_revision: 1, p_action: 'save', p_child_id: c1, p_value: noteValue('family', 'Takeover') }), 'co_parent_cannot_edit_private_note');
  const shared = await rpc(a1.c, 'save_parent_note', { p_request_id: randomUUID(), p_id: priv.id, p_revision: 1, p_action: 'save', p_child_id: c1, p_value: noteValue('family', 'Shared observation') }, 'share_note');
  check('co_parent_sees_shared_note_current_text', (await must(a2.c.from('notes').select('id,body'), 'a2_notes_shared')).some(n => n.id === priv.id && n.body === 'Shared observation'));
  await denied(a2.c.rpc('note_history', { p_id: priv.id }), 'co_parent_shared_history_still_denied');
  check('foreign_parent_sees_no_notes', (await must(b1.c.from('notes').select('id'), 'b1_notes')).length === 0);
  check('device_cannot_see_family_note', (await must(devA.c.from('notes').select('id'), 'devA_notes')).length === 0);
  const childNote = await rpc(a2.c, 'save_parent_note', { p_request_id: randomUUID(), p_child_id: c1, p_value: noteValue('child', 'Message for child one') }, 'child_note');
  check('phone_c1_sees_child_note', (await must(devA.c.from('notes').select('id'), 'devA_child_note')).some(n => n.id === childNote.id));
  check('tablet_c2_does_not_see_c1_child_note', !(await must(tabA.c.from('notes').select('id'), 'tabA_notes')).some(n => n.id === childNote.id));
  const archived = await rpc(a1.c, 'save_parent_note', { p_request_id: randomUUID(), p_id: priv.id, p_revision: shared.revision, p_action: 'archive', p_child_id: c1 }, 'archive_note');
  check('archived_shared_note_hidden_from_co_parent', !(await must(a2.c.from('notes').select('id'), 'a2_after_archive')).some(n => n.id === priv.id));
  const restored = await rpc(a1.c, 'save_parent_note', { p_request_id: randomUUID(), p_id: priv.id, p_revision: archived.revision, p_action: 'restore', p_child_id: c1 }, 'restore_note');
  check('restored_note_comes_back_private', restored.visibility === 'private', restored.visibility);
  await denied(sup.c.from('notes').select('id').then(r => r.error ? r : { data: r.data, error: r.data.length ? null : { message: 'empty' } }), 'support_sees_no_notes_rows');

  // ---------------------------------------------------------------- 9-11. Prova: assignment, child answer, parent review
  const q = randomUUID();
  await must(a1.c.from('question_bank').insert({ id: q, family_id: a1.family, grade: 5, subject: 'Fen', topic: 'Işık', kind: 'multiple_choice', difficulty: 'orta', stem: 'Hangisi kendi ışığını üretir?', choices: [{ key: 'A', text: 'Güneş' }, { key: 'B', text: 'Ay' }], correct_key: 'A', solution: 'Güneş kendi ışığını üretir.' }), 'create_question');
  const q2 = randomUUID();
  await must(a1.c.from('question_bank').insert({ id: q2, family_id: a1.family, grade: 5, subject: 'Matematik', topic: 'Çevre', kind: 'open_ended', difficulty: 'orta', stem: 'Kenarları 8 ve 6 olan dikdörtgenin çevresi?', expected_answer: '28', solution: '2×(8+6)' }), 'create_open_question');
  check('foreign_parent_cannot_read_question', (await must(b1.c.from('question_bank').select('id').eq('id', q), 'b1_question')).length === 0);
  const content = childId => ({ childId, grade: 5, title: 'Synthetic chain Prova', purpose: 'written', format: 'school', subjects: ['Fen', 'Matematik'], topics: ['Işık', 'Çevre'], target: 2, minutes: null, difficulty: 'orta', kind: 'mixed', note: '', step: 2, blocks: [{ kind: 'question', id: q, source: 'manual' }, { kind: 'question', id: q2, source: 'manual' }] });
  const draftId = randomUUID();
  const draftArgs = { p_request_id: randomUUID(), p_id: draftId, p_version: 0, p_content: content(c1) };
  // slow network, then lost response, then normal replay: the draft must survive with one version
  lossyMode = 'delay';
  const slowDraft = await timed('slow_save_prova_draft_ms', async () => rest(lossyBase, await token(a1.c), 'rpc/save_prova_draft', { method: 'POST', body: JSON.stringify(draftArgs) }));
  const slowDraftBody = await slowDraft.json();
  lossyMode = 'drop';
  const lostDraft = await rest(lossyBase, await token(a1.c), 'rpc/save_prova_draft', { method: 'POST', body: JSON.stringify(draftArgs) }).then(() => 'responded', () => 'lost');
  lossyMode = 'pass';
  const savedDraft = await rpc(a1.c, 'save_prova_draft', draftArgs, 'save_prova_draft_replay');
  check('draft_survives_slow_and_lost_network_single_version', slowDraft.ok && lostDraft === 'lost' && JSON.stringify(savedDraft) === JSON.stringify(slowDraftBody), JSON.stringify([slowDraft.status, lostDraft, savedDraft, slowDraftBody]));
  const drafts = await rpc(a1.c, 'get_prova_drafts', {}, 'list_drafts');
  check('draft_listed_once', JSON.stringify(drafts).split(draftId).length - 1 >= 1 && (Array.isArray(drafts) ? drafts : drafts.rows || []).filter(d => d.id === draftId).length === 1, JSON.stringify(drafts).slice(0, 300));
  await denied(b1.c.rpc('save_prova_draft', { p_request_id: randomUUID(), p_id: randomUUID(), p_version: 0, p_content: content(c1) }), 'foreign_parent_cannot_draft_for_a_child');
  await denied(a2.c.rpc('save_prova_draft', { p_request_id: randomUUID(), p_id: draftId, p_version: 0, p_content: { ...content(c1), title: 'Stale edit' } }), 'stale_draft_version_rejected');
  // discard / restore a second draft; foreign discard denied
  const draft2 = randomUUID();
  const d2v = await rpc(a2.c, 'save_prova_draft', { p_request_id: randomUUID(), p_id: draft2, p_version: 0, p_content: { ...content(c2), title: 'Synthetic discard me' } }, 'second_draft');
  const d2version = typeof d2v === 'number' ? d2v : (d2v.version ?? d2v.p_version ?? 1);
  await denied(b1.c.rpc('set_prova_draft_discarded', { p_request_id: randomUUID(), p_id: draft2, p_version: d2version, p_discarded: true }), 'foreign_discard_denied');
  const discardReq = { p_request_id: randomUUID(), p_id: draft2, p_version: d2version, p_discarded: true };
  const disc = await rpc(a1.c, 'set_prova_draft_discarded', discardReq, 'discard_draft_by_co_parent');
  check('discard_replay_same_result', JSON.stringify(disc) === JSON.stringify(await rpc(a1.c, 'set_prova_draft_discarded', discardReq, 'discard_replay')));
  const discarded = await rpc(a2.c, 'get_discarded_prova_drafts', { p_child_id: c2 }, 'list_discarded');
  check('discarded_draft_listed', JSON.stringify(discarded).includes(draft2));
  await rpc(a2.c, 'set_prova_draft_discarded', { p_request_id: randomUUID(), p_id: draft2, p_version: disc.version ?? d2version + 1, p_discarded: false }, 'restore_draft');
  check('restored_draft_not_in_discarded_list', !JSON.stringify(await rpc(a2.c, 'get_discarded_prova_drafts', { p_child_id: c2 }, 'list_discarded_after')).includes(draft2));
  // assign
  const assignment = { p_request_id: randomUUID(), p_id: draftId, p_version: savedDraft.version ?? 1 };
  const [as1, as2] = await Promise.all([a1.c.rpc('submit_prova_draft', assignment), a1.c.rpc('submit_prova_draft', assignment)]);
  check('double_tap_assignment_single', !as1.error && !as2.error, JSON.stringify([as1.error?.message, as2.error?.message]));
  const exams = await must(a1.c.from('exams').select('id,question_ids,child_id'), 'exams_a');
  // Free-plan quota (1 Prova per month) consumed once under two simultaneous assignments in family B.
  const qb = randomUUID();
  await must(b1.c.from('question_bank').insert({ id: qb, family_id: b1.family, grade: 5, subject: 'Fen', topic: 'Işık', kind: 'multiple_choice', difficulty: 'orta', stem: 'B sorusu?', choices: [{ key: 'A', text: 'Evet' }, { key: 'B', text: 'Hayır' }], correct_key: 'A', solution: 'Evet.' }), 'create_question_b');
  const bDraft = title => ({ childId: bc, grade: 5, title, purpose: 'written', format: 'school', subjects: ['Fen'], topics: ['Işık'], target: 1, minutes: null, difficulty: 'orta', kind: 'multiple_choice', note: '', step: 2, blocks: [{ kind: 'question', id: qb, source: 'manual' }] });
  const bd1 = randomUUID(), bd2 = randomUUID();
  await rpc(b1.c, 'save_prova_draft', { p_request_id: randomUUID(), p_id: bd1, p_version: 0, p_content: bDraft('B quota one') }, 'b_draft_one');
  await rpc(b2.c, 'save_prova_draft', { p_request_id: randomUUID(), p_id: bd2, p_version: 0, p_content: bDraft('B quota two') }, 'b_draft_two');
  const [bs1, bs2] = await Promise.all([b1.c.rpc('submit_prova_draft', { p_request_id: randomUUID(), p_id: bd1, p_version: 1 }), b2.c.rpc('submit_prova_draft', { p_request_id: randomUUID(), p_id: bd2, p_version: 1 })]);
  check('free_plan_prova_quota_consumed_once_under_race', [bs1, bs2].filter(r => !r.error).length === 1 && [bs1, bs2].some(r => /plan_limit_prova_exams/.test(r.error?.message || '')), JSON.stringify([bs1.error?.message, bs2.error?.message]));
  check('free_plan_single_exam_row', (await must(b1.c.from('exams').select('id'), 'exams_b')).length === 1);
  const loserDraft = bs1.error ? bd1 : bd2;
  check('quota_loser_draft_preserved', JSON.stringify(await rpc(b1.c, 'get_prova_drafts', {}, 'b_drafts_after_quota')).includes(loserDraft));
  check('assignment_created_one_exam', exams.filter(e => e.id === draftId).length === 1, exams.length);
  check('foreign_parent_cannot_read_exam', (await must(b1.c.from('exams').select('id').eq('id', draftId), 'b1_exam')).length === 0);
  check('tablet_c2_cannot_read_c1_exam', (await must(tabA.c.from('exams').select('id').eq('id', draftId), 'tabA_exam')).length === 0);
  await denied(tabA.c.rpc('start_exam_attempt', { p_exam_id: draftId }), 'tablet_c2_cannot_start_c1_exam');
  const foreignQuestions = await devB.c.rpc('get_attempt_questions', { p_exam_id: draftId });
  check('foreign_device_reads_no_questions', !!foreignQuestions.error || (Array.isArray(foreignQuestions.data) && foreignQuestions.data.length === 0), JSON.stringify(foreignQuestions.data).slice(0, 200));
  const childQuestions = await rpc(devA.c, 'get_attempt_questions', { p_exam_id: draftId }, 'child_reads_questions');
  check('child_payload_has_no_answer_keys', !JSON.stringify(childQuestions).includes('correct_key') && !JSON.stringify(childQuestions).includes('expected_answer'));
  const started = await rpc(devA.c, 'start_exam_attempt', { p_exam_id: draftId }, 'start_attempt'); const attempt = Array.isArray(started) ? started[0].id : started.id;
  const doc = { version: 1, width: 1000, height: 1400, elements: [{ id: randomUUID(), type: 'stroke', color: '#201951', size: 4, points: [[20, 30], [80, 90], [120, 140]] }] };
  const ans = { p_request_id: randomUUID(), p_attempt_id: attempt, p_question_id: q2, p_expected_revision: 0, p_answer_text: '28 metre', p_answer_document: doc };
  const [w1, w2] = await Promise.all([devA.c.rpc('submit_exam_answer_v3', ans), devA.c.rpc('submit_exam_answer_v3', ans)]);
  check('double_tap_answer_same_revision', !w1.error && !w2.error && w1.data === w2.data, JSON.stringify([w1.error?.message, w2.error?.message, w1.data, w2.data]));
  // competing edits from two sessions of the same child (phone + tablet logged in as c1) with the same expected revision
  await rpc(tabA.c, 'child_logout', {}, 'tablet_logout_c2'); await login(tabA, c1, '1234', 'tabA_logs_in_c1');
  const [x1, x2] = await Promise.all([
    devA.c.rpc('submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: attempt, p_question_id: q2, p_expected_revision: w1.data, p_answer_text: 'phone edit' }),
    tabA.c.rpc('submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: attempt, p_question_id: q2, p_expected_revision: w1.data, p_answer_text: 'tablet edit' }),
  ]);
  check('two_sessions_same_revision_one_winner', [x1, x2].filter(r => !r.error).length === 1, JSON.stringify([x1.error?.message, x2.error?.message]));
  const savedAnswers = await rpc(devA.c, 'get_saved_exam_answers_v3', { p_attempt_id: attempt }, 'child_reads_saved');
  const current = savedAnswers.find(v => v.question_id === q2);
  check('loser_edit_did_not_overwrite', current && ['phone edit', 'tablet edit'].includes(current.answer_text) && current.answer_document !== undefined, JSON.stringify(current));
  await rpc(devA.c, 'submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: attempt, p_question_id: q, p_expected_revision: 0, p_answer_key: 'A' }, 'choice_answer');
  await rpc(devA.c, 'finish_exam_attempt', { p_attempt_id: attempt }, 'finish_attempt');
  await denied(devA.c.rpc('submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: attempt, p_question_id: q2, p_expected_revision: 99, p_answer_text: 'late' }), 'finished_attempt_rejects_late_edit');
  // parent review by co-parent; foreign/support/admin denied
  const review = await rpc(a2.c, 'get_answer_review', { p_attempt_id: attempt, p_question_id: q2 }, 'co_parent_reads_review');
  await denied(b1.c.rpc('get_answer_review', { p_attempt_id: attempt, p_question_id: q2 }), 'foreign_review_read_denied');
  await denied(sup.c.rpc('get_answer_review', { p_attempt_id: attempt, p_question_id: q2 }), 'support_review_read_denied');
  await denied(adm.c.rpc('get_answer_review', { p_attempt_id: attempt, p_question_id: q2 }), 'admin_review_read_denied');
  const marking = { p_request_id: randomUUID(), p_attempt_id: attempt, p_question_id: q2, p_revision: review.revision, p_answer_hash: review.answer_hash, p_score: 80, p_feedback: 'Doğru yoldasın.', p_document: { ...doc, elements: [] } };
  const [m1, m2] = await Promise.all([a2.c.rpc('save_answer_review', marking), a1.c.rpc('save_answer_review', { ...marking, p_request_id: randomUUID(), p_score: 20 })]);
  check('competing_reviews_one_winner', [m1, m2].filter(r => !r.error).length === 1 && [m1, m2].some(r => r.error?.message === 'review_changed'), JSON.stringify([m1.error?.message, m2.error?.message]));
  const feedback = await rpc(devA.c, 'get_child_answer_reviews', { p_attempt_id: attempt }, 'child_reads_feedback');
  check('child_sees_exactly_one_review_score', feedback.filter(v => v.question_id === q2).length === 1 && [80, 20].includes(feedback.find(v => v.question_id === q2).score));

  // ---------------------------------------------------------------- 12. period report & school grades
  const edu = await rpc(a1.c, 'get_child_education', { p_child_id: c1 }, 'read_education');
  const eduReq = { p_request_id: randomUUID(), p_child_id: c1, p_revision: edu.revision, p_action: 'initial', p_academic_year: 2026, p_grade: 5, p_school: 'Synthetic School', p_starts_on: today, p_timetable_revision: edu.timetable.revision, p_keep_timetable: true };
  await denied(b1.c.rpc('change_child_education', eduReq), 'foreign_education_change_denied');
  const [ed1, ed2] = await Promise.all([a1.c.rpc('change_child_education', eduReq), a2.c.rpc('change_child_education', { ...eduReq, p_request_id: randomUUID(), p_school: 'Other School' })]);
  check('competing_education_change_one_winner', [ed1, ed2].filter(r => !r.error).length === 1 && [ed1, ed2].some(r => r.error?.message === 'education_changed'), JSON.stringify([ed1.error?.message, ed2.error?.message]));
  const periods = await rpc(a2.c, 'education_report_periods', { p_child_id: c1 }, 'co_parent_reads_periods');
  check('one_period_recorded', periods.length === 1, JSON.stringify(periods));
  await denied(b1.c.rpc('education_report_periods', { p_child_id: c1 }), 'foreign_periods_denied');
  await denied(adm.c.rpc('education_report_periods', { p_child_id: c1 }), 'admin_periods_denied');
  await denied(a1.c.rpc('learning_progress_education', { p_child_id: c1, p_days: 30, p_subject: null, p_grade: null, p_period: randomUUID() }), 'unknown_period_rejected', /report_period_invalid/);
  // The attempt was recorded before the first period existed: it belongs to the 'unknown' period, never silently re-labelled.
  const reportPeriod = await rpc(a1.c, 'learning_progress_education', { p_child_id: c1, p_days: 30, p_subject: null, p_grade: null, p_period: periods[0].id }, 'period_report');
  check('new_period_report_excludes_earlier_attempt', reportPeriod.summary?.attempts === 0, JSON.stringify(reportPeriod.summary));
  const reportUnknown = await rpc(a1.c, 'learning_progress_education', { p_child_id: c1, p_days: 30, p_subject: null, p_grade: null, p_period: 'unknown' }, 'unknown_period_report');
  check('unknown_period_report_keeps_earlier_attempt', reportUnknown.summary?.attempts === 1 && reportUnknown.summary?.total === 2, JSON.stringify(reportUnknown.summary));
  await denied(b1.c.rpc('learning_progress_education', { p_child_id: c1, p_days: 30, p_subject: null, p_grade: null, p_period: periods[0].id }), 'foreign_period_report_denied');
  const gradeId = randomUUID(), gradeValue = (score, note) => ({ subject: 'Matematik', kind: 'exam', score, max_score: 100, graded_on: today, note });
  await rpc(a1.c, 'change_school_grade', { p_request_id: randomUUID(), p_id: gradeId, p_child_id: c1, p_revision: 0, p_action: 'save', p_value: gradeValue(85, 'first') }, 'save_grade');
  await denied(b1.c.rpc('change_school_grade', { p_request_id: randomUUID(), p_id: gradeId, p_child_id: c1, p_revision: 1, p_action: 'save', p_value: gradeValue(1, 'tamper') }), 'foreign_grade_change_denied');
  const [g1, g2] = await Promise.all([
    a1.c.rpc('change_school_grade', { p_request_id: randomUUID(), p_id: gradeId, p_child_id: c1, p_revision: 1, p_action: 'save', p_value: gradeValue(90, 'a1') }),
    a2.c.rpc('change_school_grade', { p_request_id: randomUUID(), p_id: gradeId, p_child_id: c1, p_revision: 1, p_action: 'save', p_value: gradeValue(70, 'a2') }),
  ]);
  check('competing_grade_edit_one_winner', [g1, g2].filter(r => !r.error).length === 1 && [g1, g2].some(r => r.error?.message === 'school_grade_changed'), JSON.stringify([g1.error?.message, g2.error?.message]));
  const records = await rpc(a2.c, 'school_grade_records', { p_child_id: c1, p_period: periods[0].id }, 'grade_records_for_period');
  check('grade_listed_in_period', JSON.stringify(records).includes(gradeId), JSON.stringify(records).slice(0, 200));
  await denied(b1.c.rpc('school_grade_records', { p_child_id: c1 }), 'foreign_grade_records_denied');

  // ---------------------------------------------------------------- 13. archive / restore
  const devAOldToken = await token(devA.c);
  await denied(b1.c.rpc('set_child_archived', { p_request_id: randomUUID(), p_child_id: c1, p_revision: 0, p_archived: true }), 'foreign_archive_denied');
  await denied(devA.c.rpc('set_child_archived', { p_request_id: randomUUID(), p_child_id: c1, p_revision: 0, p_archived: true }), 'device_archive_denied');
  const preview = await rpc(a1.c, 'get_child_archive_preview', { p_child_id: c1 }, 'archive_preview');
  check('archive_preview_is_object', preview && typeof preview === 'object');
  const archReq = { p_request_id: randomUUID(), p_child_id: c1, p_revision: 0, p_archived: true };
  const [ar1, ar2] = await Promise.all([a1.c.rpc('set_child_archived', archReq), a2.c.rpc('set_child_archived', { ...archReq, p_request_id: randomUUID() })]);
  check('competing_archive_one_winner', [ar1, ar2].filter(r => !r.error).length === 1 && [ar1, ar2].some(r => r.error?.message === 'archive_changed'), JSON.stringify([ar1.error?.message, ar2.error?.message]));
  const oldTokenRead = await rest(base, devAOldToken, 'children?select=id');
  check('archived_child_device_old_token_sees_nothing', oldTokenRead.ok && (await oldTokenRead.json()).length === 0, oldTokenRead.status);
  await denied(devA.c.rpc('complete_task', { p_template_id: taskC1, p_due_date: today, p_client_id: randomUUID() }), 'archived_child_device_cannot_write');
  check('tablet_still_sees_only_c2_after_archive', JSON.stringify(await childIds(tabA.c)) === JSON.stringify([c2]) || (await childIds(tabA.c)).length === 0, JSON.stringify(await childIds(tabA.c)));
  check('archived_child_tasks_paused', (await must(a1.c.from('task_templates').select('active').eq('id', taskC1).single(), 'archived_task')).active === false);
  const restore = await rpc(a2.c, 'set_child_archived', { p_request_id: randomUUID(), p_child_id: c1, p_revision: 1, p_archived: false }, 'restore_child');
  check('restore_revision_two', restore.revision === 2, JSON.stringify(restore));
  await refresh(devA.c);
  check('restored_child_device_still_blocked_until_reconfigured', (await childIds(devA.c)).length === 0);
  await rpc(a1.c, 'configure_child_device', { p_device_id: devA.id, p_name: 'Synthetic child phone', p_child_ids: [c1], p_pin_required: true }, 'reconfigure_devA');
  await refresh(devA.c);
  check('reconfigured_device_sees_c1_again', JSON.stringify(await childIds(devA.c)) === JSON.stringify([c1]));
  await login(devA, c1, '1234', 'devA_relogin_c1');
  check('grade_history_preserved_across_archive', JSON.stringify(await rpc(a1.c, 'school_grade_records', { p_child_id: c1 }, 'grades_after_restore')).includes(gradeId));

  // ---------------------------------------------------------------- C13. C01–C11 endpoints, narrow operators, Edge
  await section('c13', () => c13Phase({ check, denied, must, rpc, rest, sign, claims, token, base, lossyBase, setLossy: m => { lossyMode = m; },
    admin, account, refresh, timed, notes, a1, a2, b1, devA, tabA, devB, sup, c1, c2, bc, attempt, q2, today }));

  // ---------------------------------------------------------------- 14. token expiry, forged claims, role revocation in open sessions
  const a1Claims = claims((await a1.c.auth.getSession()).data.session);
  const expired = sign({ ...a1Claims, iat: a1Claims.iat - 7200, exp: Math.floor(Date.now() / 1000) - 60 });
  const expiredRead = await rest(base, expired, 'children?select=id');
  check('expired_token_rejected_401', expiredRead.status === 401, expiredRead.status + ' ' + (await expiredRead.text()).slice(0, 120));
  const tampered = (await token(a1.c)).replace(/\.[^.]+$/, '.' + randomBytes(32).toString('base64url'));
  check('tampered_signature_rejected_401', (await rest(base, tampered, 'children?select=id')).status === 401);
  const b1Claims = claims((await b1.c.auth.getSession()).data.session);
  const forged = sign({ ...b1Claims, gina: { ...b1Claims.gina, family_id: a1.family } });
  const forgedRead = await rest(base, forged, 'children?select=id');
  check('forged_family_claim_without_membership_reads_nothing', forgedRead.ok && (await forgedRead.json()).length === 0, forgedRead.status);
  const forgedRpc = await rest(base, forged, 'rpc/get_answer_review', { method: 'POST', body: JSON.stringify({ p_attempt_id: attempt, p_question_id: q2 }) });
  check('forged_family_claim_rpc_denied', !forgedRpc.ok, forgedRpc.status);
  const forgedAdmin = sign({ ...b1Claims, gina: { ...b1Claims.gina, admin: true } });
  const forgedAdminRpc = await rest(base, forgedAdmin, 'rpc/admin_search_families', { method: 'POST', body: JSON.stringify({ p_query: 'Synthetic' }) });
  check('forged_admin_claim_without_admins_row_denied', !forgedAdminRpc.ok, forgedAdminRpc.status + ' ' + (await forgedAdminRpc.text()).slice(0, 120));
  // real admin works, then the admins row is removed while the token is still valid
  const found = await rpc(adm.c, 'admin_search_families', { p_query: 'Synthetic' }, 'admin_search_families');
  check('admin_search_lists_both_families', found.some(f => f.id === a1.family) && found.some(f => f.id === b1.family), found.length);
  await must(admin.from('admins').delete().eq('user_id', adm.user), 'remove_admin_row');
  await denied(adm.c.rpc('admin_search_families', { p_query: 'Synthetic' }), 'revoked_admin_old_token_denied');
  // co-parent membership removed while signed in (role revocation): B3
  check('b3_reads_children_before_revocation', JSON.stringify(await childIds(b3.c)) === JSON.stringify([bc]));
  await must(admin.from('family_members').delete().eq('family_id', b1.family).eq('user_id', b3.user), 'remove_b3_membership');
  check('revoked_member_old_token_reads_nothing', (await childIds(b3.c)).length === 0);
  await denied(b3.c.from('task_templates').insert({ family_id: b1.family, child_id: bc, title: 'Ghost', stars: 1 }).select().then(r => r.error ? r : { data: r.data, error: r.data.length ? null : { message: 'no rows' } }), 'revoked_member_cannot_insert_task');
  await denied(b3.c.rpc('save_parent_note', { p_request_id: randomUUID(), p_child_id: bc, p_value: noteValue('private', 'ghost') }), 'revoked_member_rpc_denied');
  // device revocation in open session: shared tablet
  const tabOldToken = await token(tabA.c);
  await rpc(a1.c, 'revoke_device', { p_device_id: tabA.id }, 'revoke_tablet');
  const tabRead = await rest(base, tabOldToken, 'children?select=id');
  check('revoked_tablet_old_token_sees_nothing', tabRead.ok && (await tabRead.json()).length === 0);
  await denied(tabA.c.rpc('complete_task', { p_template_id: taskC2, p_due_date: today, p_client_id: randomUUID() }), 'revoked_tablet_cannot_write');
  // support operator can never see family content; revocation honoured in open session
  check('support_sees_no_exams', (await sup.c.from('exams').select('id')).data?.length === 0);
  await must(admin.from('operations_members').update({ revoked_at: new Date().toISOString() }).eq('user_id', sup.user), 'revoke_support');
  check('revoked_support_roles_empty', (await rpc(sup.c, 'my_operation_roles', {}, 'roles_after_revoke')).length === 0);

  // ---------------------------------------------------------------- 15. child delete, account delete
  const foreignDelete = await b1.c.from('children').delete().eq('id', c2).select();
  check('foreign_child_delete_no_rows', !!foreignDelete.error || foreignDelete.data.length === 0, JSON.stringify(foreignDelete.data));
  // Q02-6: veli REST ile çocuğu doğrudan silemez; silme önizleme + confirm_child_deletion (makbuzlu) ile.
  const deleteC2 = await a1.c.from('children').delete().eq('id', c2).select();
  notes.push({ observation: 'parent_direct_child_delete', error: deleteC2.error?.message ?? null, rows: deleteC2.data?.length ?? null });
  check('parent_direct_child_delete_refused', !!deleteC2.error || deleteC2.data.length === 0, JSON.stringify(deleteC2.data));
  check('child_still_present_after_refused_delete', (await must(admin.from('children').select('id').eq('id', c2), 'c2_after_refused')).length === 1);
  await denied(b1.c.rpc('deletion_preview', { p_target: { kind: 'child', child_id: c2 } }), 'foreign_child_deletion_preview_denied');
  const childPreview = await rpc(a1.c, 'deletion_preview', { p_target: { kind: 'child', child_id: c2 } }, 'child_deletion_preview');
  await denied(b1.c.rpc('confirm_child_deletion', { p_request_id: randomUUID(), p_child_id: c2, p_preview_token: childPreview.preview_token }), 'foreign_confirm_child_deletion_denied');
  const deleteReq = { p_request_id: randomUUID(), p_child_id: c2, p_preview_token: childPreview.preview_token };
  const confirmed = await rpc(a1.c, 'confirm_child_deletion', deleteReq, 'confirm_child_deletion');
  check('confirm_child_deletion_deleted', confirmed.deleted === true, JSON.stringify(confirmed));
  const replay = await rpc(a1.c, 'confirm_child_deletion', deleteReq, 'confirm_child_deletion_replay');
  check('confirm_child_deletion_replay_same', JSON.stringify(replay) === JSON.stringify(confirmed));
  check('deleted_child_row_gone', (await must(admin.from('children').select('id').eq('id', c2), 'c2_after_delete')).length === 0);
  check('deleted_child_tasks_gone', (await must(a1.c.from('task_templates').select('id').eq('child_id', c2), 'c2_tasks')).length === 0);
  check('deleted_child_completions_gone', (await must(a1.c.from('task_completions').select('id').eq('child_id', c2), 'c2_completions')).length === 0);
  // co-parent account deletion: family survives with successor; old token loses access
  const a2OldToken = await token(a2.c);
  await must(admin.auth.admin.deleteUser(a2.user, false), 'delete_account_a2');
  check('family_survives_co_parent_deletion', (await must(admin.from('families').select('id').eq('id', a1.family), 'family_a_after_a2')).length === 1);
  check('deleted_co_parent_old_token_reads_nothing', (await (await rest(base, a2OldToken, 'children?select=id')).json()).length === 0);
  check('co_parent_notes_removed_on_deletion', (await must(admin.from('notes').select('id').eq('author_user_id', a2.user), 'a2_notes_after')).length === 0);
  check('founder_still_reads_children', (await childIds(a1.c)).length >= 1);
  // last parent deletion cascades the family and anonymous device users
  const beforeB = await must(admin.from('children').select('id').eq('family_id', b1.family), 'b_children_before');
  const deleteA1 = await admin.auth.admin.deleteUser(a1.user, false);
  if (deleteA1.error && process.env.GINA_QA_DB) {
    // Diagnostic only inside the disposable DB: capture the Postgres error behind GoTrue's generic message.
    const { spawnSync } = await import('node:child_process');
    const psql = spawnSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'supabase_admin', '-d', process.env.GINA_QA_DB, '-v', 'ON_ERROR_STOP=1', '-c', `delete from auth.users where id='${a1.user}'`], { encoding: 'utf8' });
    notes.push({ observation: 'last_parent_deletion_sql_error', status: psql.status, stderr: psql.stderr.trim().slice(0, 600) });
  }
  check('delete_account_a1', !deleteA1.error, deleteA1.error?.message);
  if (deleteA1.error) throw Error('delete_account_a1');
  check('family_a_removed', (await must(admin.from('families').select('id').eq('id', a1.family), 'family_a_after')).length === 0);
  check('family_a_children_removed', (await must(admin.from('children').select('id').in('id', [c1, c2]), 'a_children_after')).length === 0);
  check('family_a_exams_removed', (await must(admin.from('exams').select('id').eq('id', draftId), 'a_exams_after')).length === 0);
  check('family_a_receipts_removed', (await must(admin.from('help_receipts').select('request_id').eq('family_id', a1.family), 'a_receipts_after')).length === 0);
  const devUser = await admin.auth.admin.getUserById(devA.user);
  check('anonymous_device_user_removed', !!devUser.error || !devUser.data?.user, JSON.stringify(devUser.data?.user?.id));
  const devAfter = await rest(base, await token(devA.c).catch(() => devAOldToken), 'children?select=id');
  check('orphaned_device_token_reads_nothing', !devAfter.ok || (await devAfter.json()).length === 0, devAfter.status);
  check('family_b_untouched', JSON.stringify(await must(admin.from('children').select('id').eq('family_id', b1.family), 'b_children_after')) === JSON.stringify(beforeB));
  check('family_b_parent_still_works', JSON.stringify(await childIds(b2.c)) === JSON.stringify([bc]));
} catch (error) {
  const label = error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'chain_aborted';
  if (!(label in checks)) check(label, false, error.message);
  notes.push({ aborted: label, stack: String(error.stack).split('\n').slice(0, 3).join(' | ') });
} finally {
  await Promise.all(clients.map(c => c.removeAllChannels()));
  await new Promise(r => lossy.close(r)); await new Promise(r => proxy.close(r));
  const passed = Object.values(checks).filter(Boolean).length, total = Object.keys(checks).length;
  try {
    // C13: GINA_QA_CHAIN_OUT selects the evidence folder (default: the original Q02 report folder).
    const outDir = new URL('../' + (process.env.GINA_QA_CHAIN_OUT || 'docs/release/q02-2026-11-06').replace(/\/?$/, '/'), import.meta.url);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(new URL('chain-details.json', outDir), JSON.stringify({ environment: 'disposable-local-auth-postgrest', passed, total, failures, notes, timing_ms: timing }, null, 2) + '\n');
  } catch {}
  if (failures.length) process.exitCode = 1;
  console.log(JSON.stringify({ checks }));
}
