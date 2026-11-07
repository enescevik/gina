const loopbackFixtureFetch = require('../../../../scripts/loopback-fixture-fetch.cjs');
// C09 backoffice tour against the disposable gina_c09_* services + the unchanged content-prereview Edge
// (deterministic provider boundary). Synthetic data only; nothing leaves the machine.
// Usage: C09_WORK=<scratch> SHOT_DIR=<dir> GINA_QA_PLAYWRIGHT_PATH=<playwright> node tour.cjs
const fs = require('node:fs'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.C09_WORK + '/fixture.json'));
assert.match(f.db, /^gina_c09_[0-9a-f]+_audit$/); assert.equal(new URL(f.url).hostname, '127.0.0.1');
const outDir = process.env.SHOT_DIR; fs.mkdirSync(outDir, { recursive: true });
const CS = { ok: 'c0910000-0000-4000-8000-000000000001', ambiguous: 'c0910000-0000-4000-8000-000000000002', wrong: 'c0910000-0000-4000-8000-000000000003', image: 'c0910000-0000-4000-8000-000000000004' };
const CC = { current: 'c0940000-0000-4000-8000-000000000001', old: 'c0940000-0000-4000-8000-000000000002' };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', f.db, '-v', 'ON_ERROR_STOP=1'], { input: q }).toString().trim();
const results = [];
let browser;
const stats = async () => (await loopbackFixtureFetch(f.edge + '/content-prereview/__qa-provider-stats')).json();

async function session(who) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage(); p.setDefaultTimeout(20000);
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  await p.goto(f.app + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.creds[who].email);
  await p.getByLabel('Şifre', { exact: true }).fill(f.creds[who].password);
  await p.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await p.waitForURL(u => !u.pathname.startsWith('/sign-in'));
  return p;
}
async function shot(p, name, full = false) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${outDir}/${name}.png`, fullPage: full });
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow on ' + name);
}
async function check(name, fn) {
  try { const detail = await fn(); results.push({ check: name, passed: true, ...(detail ? { detail } : {}) }); console.log('PASS', name, JSON.stringify(detail ?? '')); }
  catch (e) { results.push({ check: name, passed: false, error: String(e.message || e).slice(0, 600) }); console.log('FAIL', name, String(e.message || e).slice(0, 600)); }
}
async function rpc(p, fn, args = {}) {
  return await p.evaluate(async ({ url, anon, fn, args }) => {
    const key = Object.keys(localStorage).find(k => k.endsWith('-auth-token'));
    const token = JSON.parse(localStorage.getItem(key)).access_token;
    const r = await fetch(url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: anon, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(args) });
    const text = await r.text();
    return { status: r.status, forbidden: r.status === 401 || r.status === 403 || /"forbidden"|42501/.test(text), text: text.slice(0, 300) };
  }, { url: f.url, anon: f.anon, fn, args });
}
const ai = (id) => sql(`select prereview_status||'|'||coalesce(prereview_verdict->>'decision_reason','')||'|'||attempts from gina.content_prereviews where target_id='${id}'`);
const row = (p, text) => p.getByTestId('content-item').filter({ hasText: text });
async function openItems(p) {
  await p.goto(f.app + '/library?tab=items');
  await p.getByTestId('prereview-decision-queue').waitFor();
  await p.getByTestId('content-count').waitFor();
  await p.waitForTimeout(800);
}

(async () => {
  // System Chrome (as in the C07 tour); no browser download.
  browser = await chromium.launch({ headless: true, channel: process.env.GINA_QA_CHANNEL || 'chrome' });
  const pages = {};

  await check('scheduled_drain_through_real_edge', async () => {
    const before = (await stats()).calls;
    const r = await loopbackFixtureFetch(f.url + '/functions/v1/content-prereview', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': f.cron_secret }, body: JSON.stringify({ drain: true, limit: 10 }) });
    const body = await r.json();
    assert.equal(r.status, 200, JSON.stringify(body));
    assert.equal(ai(CS.wrong).split('|')[0], 'ai_rejected_suggestion');
    assert.equal(ai(CS.image).split('|').slice(0, 2).join('|'), 'needs_admin|media_not_reviewed');
    assert.equal(ai(CC.old).split('|').slice(0, 2).join('|'), 'needs_admin|source_superseded');
    const calls = (await stats()).calls - before;
    assert.equal(calls, 2, 'obsolete candidate never reaches the provider');
    assert.equal(sql(`select prereview_verdict->'media'->>'image_dependent_correctness' from gina.content_prereviews where target_id='${CS.image}'`), 'not_proven');
    assert.equal(sql(`select status from gina.contribution_sets where id='${CS.wrong}'`), 'pending', 'reject suggestion does not reject');
    const bad = await loopbackFixtureFetch(f.url + '/functions/v1/content-prereview', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': 'wrong' }, body: JSON.stringify({ drain: true }) });
    assert.equal(bad.status, 403);
    return { processed: body.processed, provider_calls: calls, results: body.results.map(x => `${x.kind}:${x.prereview_status}:${x.reason ?? ''}`) };
  });

  await check('content_operator_without_family_sees_queue_and_notices', async () => {
    assert.equal(sql(`select count(*) from public.family_members where user_id in('${f.users.content}','${f.users.admin}')`), '0');
    const p = pages.content = await session('content');
    await openItems(p);
    const q = p.getByTestId('prereview-decision-queue');
    assert.match(await p.getByTestId('prereview-waiting-count').innerText(), /^3 kayıt yönetici kararı bekliyor/);
    assert.match(await p.getByTestId('prereview-unread').innerText(), /3 yeni bildirim/);
    assert.equal(await q.getByTestId('prereview-notice').count(), 3);
    assert.equal(sql(`select count(*) from public.push_outbox where kind='content_prereview_needs_admin'`), '0', 'nobody with a family is an admin: no push, in-app notice instead');
    await shot(p, '01-content-operator-queue');
    return { waiting: await p.getByTestId('prereview-waiting-count').innerText() };
  });

  await check('media_flag_and_candidate_source_badges', async () => {
    const p = pages.content;
    const img = row(p, 'C09 görselli');
    await img.getByTestId('prereview-media-flag').waitFor();
    assert.match(await img.getByTestId('prereview-media-flag').innerText(), /1 görsel AI'ya gösterilmedi/);
    const kindSel = p.getByRole('combobox', { name: /Tür/ });
    await kindSel.selectOption('curriculum_candidate');
    await p.getByTestId('candidate-source-badge').first().waitFor();
    const old = row(p, 'C09 eski kaynak senaryosu').getByTestId('candidate-source-badge');
    const cur = row(p, 'C09 güncel senaryo').getByTestId('candidate-source-badge');
    assert.equal(await old.getAttribute('data-source'), 'superseded');
    assert.equal(await old.getAttribute('data-obsolete'), 'true');
    assert.match(await old.innerText(), /AI'ya gönderilmez/);
    assert.equal(await cur.getAttribute('data-source'), 'approved');
    assert.equal(await cur.getAttribute('data-obsolete'), 'false');
    await shot(p, '02-candidate-source-badges');
    await kindSel.selectOption('');
    return { old: await old.innerText(), current: await cur.innerText() };
  });

  await check('ui_request_correct_record_ai_approval_logged_apart_from_admin_decision', async () => {
    const p = pages.content;
    await openItems(p);
    const before = (await stats()).calls;
    const r = row(p, 'C09 doğru');
    await r.getByRole('button', { name: 'AI ön incelemesi iste' }).click();
    await r.getByRole('status').filter({ hasText: /AI ön incelemesi tamamlandı/ }).waitFor();
    assert.equal(ai(CS.ok).split('|')[0], 'ai_approved');
    assert.equal((await stats()).calls - before, 1);
    assert.equal(sql(`select count(*) from public.audit_log where action='content_prereview.ai_approved' and actor_id is null and target_id='contribution_set:${CS.ok}'`), '1', 'AI approval: own audit entry, system actor');
    assert.equal(sql(`select status||'|'||coalesce(reviewed_by::text,'-') from gina.contribution_sets where id='${CS.ok}'`), 'pending|-', 'no admin decision forged');
    const decisionCell = await r.getByTestId('admin-decision').innerText();
    assert.doesNotMatch(decisionCell, /AI/);
    assert.match(decisionCell, /Ailelere açık değil/);
    await shot(p, '03-ai-approved-not-a-decision');
    // Same content + prompt version: no second paid call.
    await r.getByRole('button', { name: 'AI ön incelemesi iste' }).click();
    await r.getByRole('status').filter({ hasText: /önceki AI sonucu geçerli/ }).waitFor();
    assert.equal((await stats()).calls - before, 1, 'cached, no new provider call');
    return { decision_cell: decisionCell.replace(/\s+/g, ' ') };
  });

  await check('ui_request_ambiguous_record_lands_in_admin_queue_with_notice', async () => {
    const p = pages.content;
    const r = row(p, 'C09 belirsiz');
    await r.getByRole('button', { name: 'AI ön incelemesi iste' }).click();
    await r.getByRole('status').filter({ hasText: /BEKLİYOR/ }).waitFor();
    assert.equal(ai(CS.ambiguous).split('|').slice(0, 2).join('|'), 'needs_admin|low_confidence');
    await openItems(p);
    assert.match(await p.getByTestId('prereview-unread').innerText(), /4 yeni bildirim/);
    assert.match(await p.getByTestId('prereview-waiting-count').innerText(), /^4 kayıt/);
    await p.getByRole('button', { name: 'Listede yalnız BEKLİYOR kayıtları göster' }).click();
    await p.waitForTimeout(1000);
    await row(p, 'C09 belirsiz').waitFor();
    assert.equal(await row(p, 'C09 doğru').count(), 0, 'ai_approved row is not in the admin queue filter');
    await shot(p, '04-ambiguous-in-admin-queue');
    return { needs_admin_rows: await p.getByTestId('content-item').count() };
  });

  await check('non_family_admin_gets_notices_and_marks_read', async () => {
    const p = pages.admin = await session('admin');
    await openItems(p);
    assert.match(await p.getByTestId('prereview-unread').innerText(), /4 yeni bildirim/);
    await shot(p, '05-admin-notices-unread');
    await p.getByRole('button', { name: 'Tümünü okundu işaretle' }).click();
    await p.waitForTimeout(800);
    assert.equal(await p.getByTestId('prereview-unread').count(), 0);
    assert.equal(sql(`select count(*) from gina.operator_prereview_notices where user_id='${f.users.admin}' and read_at is null`), '0');
    assert.equal(sql(`select count(*) from gina.operator_prereview_notices where user_id='${f.users.content}' and read_at is null`), '4', 'read state is per operator');
    await shot(p, '06-admin-notices-read');
    return null;
  });

  await check('admin_decision_separate_from_ai_record', async () => {
    const p = pages.admin;
    const r = await rpc(p, 'admin_decide_contribution_set', { p_request_id: '0c090000-0000-4000-8000-000000000001', p_id: CS.ok, p_approve: false, p_note: 'Sentetik yönetici reddi (C09 testi).', p_teachers: {}, p_confirmed: true });
    assert.equal(r.status, 200, r.text);
    assert.equal(sql(`select status||'|'||reviewed_by from gina.contribution_sets where id='${CS.ok}'`), `rejected|${f.users.admin}`);
    assert.equal(ai(CS.ok).split('|')[0], 'ai_approved', 'admin decision does not rewrite the AI record');
    await openItems(p);
    await shot(p, '07-admin-decided-ai-record-kept');
    return { contribution: 'rejected by admin', ai: 'ai_approved (unchanged, separate record)' };
  });

  await check('finance_role_cannot_see_prereview_queue', async () => {
    const p = pages.finance = await session('finance');
    for (const fn of ['admin_content_prereviews', 'operator_prereview_notices', 'admin_prereview_candidate_context']) {
      const r = await rpc(p, fn, fn === 'admin_prereview_candidate_context' ? { p_ids: [CC.old] } : {});
      assert.ok(r.forbidden, fn + ' ' + r.status);
    }
    return null;
  });

  await check('no_page_errors', async () => {
    assert.deepEqual(Object.values(pages).flatMap(p => p.errors), []);
    return null;
  });

  fs.writeFileSync(outDir + '/ui-checks.json', JSON.stringify({ db: 'gina_c09_<random>_audit', viewport: '1280x800', provider: 'deterministic loopback boundary (no hosted model)', results }, null, 2) + '\n');
  await browser.close();
  process.exit(results.every(r => r.passed) ? 0 : 1);
})().catch(async e => { console.error(e); try { await browser?.close(); } catch {} process.exit(2); });
