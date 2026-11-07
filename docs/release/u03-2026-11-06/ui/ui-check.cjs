const loopbackFixtureFetch = require('../../../../scripts/loopback-fixture-fetch.cjs');
// U03 (veli Bugün, menü, bildirim girişleri) UI acceptance against the disposable synthetic fixture from
// `GINA_QA_UI_FIXTURE=<unique path> scripts/test-isolated-services.py --run-local --ui-hold`.
// The web export is built against a placeholder origin (GINA_QA_PLACEHOLDER_URL / _ANON); this script forwards those
// requests to the fixture's loopback proxy and serves the export itself (GINA_QA_WEB_DIST).
// Never targets production or the shared local demo DB. Prints no credentials.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const fixturePath = process.env.GINA_QA_UI_FIXTURE; assert.ok(fixturePath, 'GINA_QA_UI_FIXTURE required (unique per run)');
const f = JSON.parse(fs.readFileSync(fixturePath)); assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const placeholder = process.env.GINA_QA_PLACEHOLDER_URL || 'http://127.0.0.1:65433', placeholderAnon = process.env.GINA_QA_PLACEHOLDER_ANON || 'placeholder-anon-u03';
const dist = process.env.GINA_QA_WEB_DIST; assert.ok(dist && fs.existsSync(path.join(dist, 'index.html')), 'GINA_QA_WEB_DIST required');
const ROOT = process.cwd();
const out = path.join(ROOT, 'docs/release/u03-2026-11-06/ui'); fs.mkdirSync(out, { recursive: true });
const failRoot = process.env.GINA_QA_FAIL_DIR || require('node:os').tmpdir();
const tr = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/core/src/i18n/tr.json')));
const t = (key, vars = {}) => {
  let v = tr[key];
  if (v === undefined) { const parts = key.split('.'); for (let i = parts.length - 1; i > 0 && v === undefined; i--) { const head = tr[parts.slice(0, i).join('.')]; if (head && typeof head === 'object') v = parts.slice(i).reduce((o, k) => o?.[k], head); } }
  assert.equal(typeof v, 'string', 'missing i18n ' + key);
  return v.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k]));
};
const VIEWPORTS = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const results = []; let browser, page, server, stage = 'setup';
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail ? { detail } : {}) }); console.log('PASS ' + check); };
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
const at = (date, hm) => new Date(`${date}T${hm}:00+03:00`).toISOString();
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webp': 'image/webp' };
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\.\.+/g, '');
      const tries = [path.join(dist, clean), path.join(dist, clean + '.html'), path.join(dist, clean, 'index.html')];
      let file = tries.find(p => p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isFile());
      if (!file) file = path.join(dist, 'index.html');
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

async function token(email, password) {
  const r = await loopbackFixtureFetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.ok(r.ok, 'login ' + r.status); return r.json();
}
async function refresh(session) {
  const r = await loopbackFixtureFetch(f.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
  assert.ok(r.ok, 'refresh ' + r.status); return r.json();
}
function client(sessionRef) {
  return async function api(p, body, { method, prefer } = {}) {
    const res = await loopbackFixtureFetch(f.url + '/rest/v1/' + p, { method: method || (body ? 'POST' : 'GET'), headers: { apikey: f.anon, authorization: 'Bearer ' + sessionRef.s.access_token, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); const data = text ? JSON.parse(text) : null;
    assert.ok(res.ok, p.split('?')[0] + ' ' + res.status + ' ' + JSON.stringify(data).slice(0, 200)); return data;
  };
}

(async () => {
  // ---------- synthetic data (disposable DB only) ----------
  const A = { s: await token(f.email, f.password) }; const api = client(A);
  const profile = name => ({ p_request_id: randomUUID(), p_profile: { name, birth_year: 2016, grade: 4, gender: 'unspecified', avatar: 'avatar-default', interests: [] }, p_tasks: [] });
  // Re-runs against the same held fixture reuse the seed (a failed run does not double the data).
  const existing = await api('children?select=id&name=eq.Ece');
  const seeded = existing.length > 0;
  const ece = seeded ? existing[0].id : await api('rpc/save_child_setup', profile('Ece'));
  const kids = await api('children?select=id,name&archived_at=is.null&order=sort_order');
  assert.ok(kids.length >= 3, 'three children');
  const main = kids.find(k => k.id === f.childId), sib = kids.find(k => k.id !== f.childId && k.id !== ece);
  if (!seeded) {
  for (const k of kids) await api('rpc/set_child_pin', { p_child_id: k.id, p_pin: '1234' });
  const tpl = async (child, title, icon) => (await api('task_templates', { family_id: f.familyId, child_id: child, title, icon, stars: 2, starts_on: today }, { prefer: 'return=representation' }))[0].id;
  const read = await tpl(main.id, 'Kitap oku', 'read-book'), teeth = await tpl(main.id, 'Dişlerini fırçala', 'brush-teeth');
  await tpl(main.id, 'Odayı topla', 'tidy-room');
  const bag = await tpl(sib.id, 'Çantayı hazırla', 'pack-school-bag');
  const piano = await tpl(ece, 'Piyano çalış', 'music'); await tpl(ece, 'Su iç', 'drink-water');
  // A real paired device completes the work (complete_task is device-only).
  const anon = await (await loopbackFixtureFetch(f.url + '/auth/v1/signup', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ data: {} }) })).json();
  assert.ok(anon.access_token, 'anonymous device session'); const D = { s: anon }; const dapi = client(D);
  const code = await dapi('rpc/request_pairing', { p_device_name: 'U03 tablet' });
  const deviceId = await api('rpc/pair_child_device', { p_code: code }); D.s = await refresh(D.s);
  async function complete(childId, template) {
    await api('rpc/configure_child_device', { p_device_id: deviceId, p_name: 'U03 tablet', p_child_ids: [childId], p_pin_required: true }); D.s = await refresh(D.s);
    assert.equal(await dapi('rpc/child_pin_login', { p_child_id: childId, p_pin: '1234' }), true); D.s = await refresh(D.s);
    const r = await dapi('rpc/complete_task', { p_template_id: template, p_due_date: today, p_client_id: randomUUID() });
    return Array.isArray(r) ? r[0] : r;
  }
  await complete(main.id, read);
  const returned = await complete(main.id, teeth);
  await api('rpc/review_task', { p_completion_id: returned.id, p_approve: false });
  await complete(sib.id, bag); await complete(ece, piano);
  await api('events', [
    { family_id: f.familyId, child_id: main.id, title: 'Yüzme kursu', type: 'activity', starts_at: at(today, '17:00'), ends_at: at(today, '18:00'), all_day: false },
    { family_id: f.familyId, child_id: main.id, title: 'Matematik yazılısı', type: 'exam', starts_at: at(addDays(today, 1), '10:00'), ends_at: at(addDays(today, 1), '11:00'), all_day: false },
  ]);
  }
  const pendingApprovals = (await api(`task_completions?select=id&family_id=eq.${f.familyId}&status=eq.done`)).length;
  assert.equal(pendingApprovals, 3, 'three submissions wait for approval');

  // ---------- browser ----------
  server = await serve(); const web = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const overrides = []; // { test(url, method), handle(route) }
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const errors = [];
  async function newPage(viewport, init) {
    const ctx = await browser.newContext({ viewport, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
    if (init) await ctx.addInitScript(init);
    await ctx.route(placeholder + '/**', async route => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const url = f.url + req.url().slice(placeholder.length);
      const o = overrides.find(x => x.test(url, req.method()));
      if (o) return o.handle(route);
      const headers = { ...req.headers() };
      for (const k of Object.keys(headers)) if (typeof headers[k] === 'string') headers[k] = headers[k].split(placeholderAnon).join(f.anon);
      try { const res = await route.fetch({ url, headers }); await route.fulfill({ response: res, headers: { ...res.headers(), ...cors } }); }
      catch { await route.fulfill({ status: 503, body: 'Local fixture unavailable' }).catch(() => undefined); }
    });
    const p = await ctx.newPage(); p.setDefaultTimeout(25000);
    p.on('pageerror', e => errors.push(e.message));
    return p;
  }
  async function login(p, email, password) {
    await p.goto(web); await p.getByLabel('E-posta', { exact: true }).fill(email); await p.getByLabel('Şifre', { exact: true }).fill(password);
    await p.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await p.waitForURL('**/parent');
  }
  async function shot(name, p = page) {
    await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${name}.png` });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': no horizontal overflow');
    const body = await p.locator('body').innerText();
    assert.ok(!/parentToday\.|parentHome\.|betaUx\.|\{\{/.test(body), name + ': translations resolved');
  }
  const y = async loc => (await loc.first().boundingBox()).y;
  const visible = (text, p = page) => p.getByText(text, { exact: true }).locator('visible=true').first();

  stage = 'many_children_phone';
  page = await newPage(VIEWPORTS.phone); await login(page, f.email, f.password);
  await visible(t('parent.waitingApproval')).waitFor();
  await page.getByTestId('home-next').waitFor();
  const nextText = await page.getByTestId('home-next').innerText();
  assert.ok(nextText.includes('Dişlerini fırçala') && nextText.includes(t('parentToday.returnedHint', { name: main.name })), 'returned task leads next-up with its explanation');
  assert.ok(await y(page.getByTestId('home-approvals')) < await y(page.getByTestId('home-next')), 'approvals first');
  assert.ok(await y(page.getByTestId('home-next')) < await y(page.getByTestId('home-plan')), 'next-up before plan');
  assert.ok(await page.getByRole('button', { name: t('parentPremium.showApprovals', { count: 3 }) }).count() === 1, '3 approvals collapse to 2 + show all');
  const hero = await page.getByTestId('home-hero').boundingBox(); assert.ok(hero.height <= 110, 'compact greeting ' + hero.height);
  // Link repetition: rewards once, Prova builder once (exam card), no rewards/prova duplicate in the strip.
  assert.equal(await page.getByText(t('parentHome.rewards'), { exact: true }).count(), 0, 'no separate Ödüller shortcut');
  assert.equal(await page.getByText(t('parentToday.rewardsLink'), { exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: t('parentHome.prepareProva'), exact: true }).count(), 1, 'one Prova hazırla');
  await visible('Matematik yazılısı').waitFor();
  await shot('home-many-phone');
  await page.getByTestId('home-tasks').scrollIntoViewIfNeeded(); await shot('home-many-tasks-phone');
  const taskRows = await page.getByTestId('home-tasks').innerText();
  assert.ok(taskRows.indexOf(t('parentHome.returned')) < taskRows.indexOf(t('parentHome.planned')), 'returned sorted before planned');
  pass('approvals_then_next_up_returned_task_first', { approvals: 3, hero_height: Math.round(hero.height) });
  pass('link_repetition_reduced');

  stage = 'selected_day';
  await page.getByRole('button', { name: t('planner.weekOverview') }).click();
  const dayChips = page.locator('[aria-pressed="false"]').filter({ hasText: /^\D+\d+$/ });
  await dayChips.first().click();
  await page.getByTestId('home-selected-day').waitFor();
  assert.equal(await page.getByTestId('home-today-scope').count(), 2, 'progress and tasks say their counts are today’s');
  assert.equal(await visible(t('parentHome.dailyTasks')).count(), 1, 'tasks heading stays today');
  await page.getByTestId('home-plan').scrollIntoViewIfNeeded(); await shot('home-selected-day-phone');
  await page.getByRole('button', { name: t('parentToday.backToToday') }).click();
  assert.equal(await page.getByTestId('home-selected-day').count(), 0);
  assert.equal(await page.getByTestId('home-today-scope').count(), 0);
  pass('selected_day_separate_from_today_counts');

  stage = 'filter_one_child';
  await page.getByRole('button', { name: t('parentHome.selectChild', { name: 'Ece' }) }).click();
  await page.waitForTimeout(400);
  assert.ok((await page.getByTestId('home-approvals').innerText()).includes('Piyano çalış'));
  assert.ok(!(await page.getByTestId('home-approvals').innerText()).includes('Kitap oku'), 'filter scopes approvals');
  await page.getByRole('button', { name: t('parentHome.all'), exact: true }).click();
  pass('child_filter_scopes_today');

  stage = 'tablet_desktop';
  await page.setViewportSize(VIEWPORTS.tablet); await page.getByTestId('home-scroll').evaluate(e => e.scrollTo(0, 0)); await shot('home-many-tablet');
  await page.setViewportSize(VIEWPORTS.desktop); await page.getByTestId('home-scroll').evaluate(e => e.scrollTo(0, 0)); await shot('home-many-desktop');
  pass('home_phone_tablet_desktop_no_overflow');

  stage = 'single_query_error';
  await page.setViewportSize(VIEWPORTS.phone);
  const brokenTemplates = { test: (u, m) => m === 'GET' && u.includes('/rest/v1/task_templates?'), handle: r => r.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'synthetic failure' }) }) };
  overrides.push(brokenTemplates);
  await page.reload(); await visible(t('parentToday.tasksError')).waitFor({ timeout: 30000 });
  assert.equal(await visible(t('release.loadError')).count(), 0, 'whole screen not closed');
  await visible(t('parent.waitingApproval')).waitFor(); await visible(t('parentToday.progressError')).waitFor();
  await visible('Yüzme kursu').waitFor();
  await page.getByTestId('home-tasks-state').scrollIntoViewIfNeeded();
  await shot('home-tasks-error-phone');
  overrides.splice(overrides.indexOf(brokenTemplates), 1);
  await page.getByTestId('home-tasks-state').getByRole('button', { name: t('common.retry') }).click();
  await page.getByTestId('home-tasks').waitFor();
  assert.equal(await visible(t('parentToday.tasksError')).count(), 0);
  pass('one_failing_query_closes_only_its_card_and_retries');
  const brokenEvents = { test: (u, m) => m === 'GET' && u.includes('/rest/v1/events?'), handle: r => r.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: '{"message":"synthetic"}' }) };
  overrides.push(brokenEvents); await page.reload();
  await visible(t('parentToday.planError')).waitFor({ timeout: 30000 }); await page.getByTestId('home-tasks').waitFor();
  assert.equal(await visible(t('release.loadError')).count(), 0);
  await page.getByTestId('home-plan-state').scrollIntoViewIfNeeded();
  await shot('home-plan-error-phone');
  overrides.splice(overrides.indexOf(brokenEvents), 1);
  pass('calendar_failure_isolated_to_plan_card');

  stage = 'offline_cached';
  await page.reload(); await page.getByTestId('home-tasks').waitFor();
  await page.context().setOffline(true);
  await page.getByTestId('home-offline-banner').waitFor({ timeout: 5000 });
  await page.getByTestId('home-tasks').waitFor();
  await shot('home-offline-cached-phone');
  await page.context().setOffline(false);
  await page.getByTestId('home-offline-banner').waitFor({ state: 'detached', timeout: 10000 });
  pass('offline_banner_keeps_cached_today_and_clears_on_reconnect');

  stage = 'unread_bell_inbox_prefs';
  const inboxStub = { test: u => u.includes('/rest/v1/rpc/parent_inbox'), handle: r => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ unread: 3, rows: [] }) }) };
  overrides.push(inboxStub); await page.reload();
  await page.getByTestId('home-unread').waitFor();
  const bell = page.getByRole('button', { name: t('parentToday.inboxUnread', { count: 3 }) }); await bell.waitFor();
  await page.getByTestId('home-scroll').evaluate(e => e.scrollTo(0, 0)); await shot('home-bell-unread-phone');
  await bell.click(); await page.waitForURL('**/parent/inbox');
  await page.getByRole('button', { name: t('inbox.preferences') }).click(); await page.waitForURL('**/parent/notifications');
  await visible(t('inbox.preferences')).waitFor();
  overrides.splice(overrides.indexOf(inboxStub), 1);
  pass('bell_opens_inbox_preferences_from_inbox', { unread_source: 'stubbed parent_inbox response' });

  stage = 'menu_groups';
  await page.goto(`${web}/parent/menu`);
  const tabs = ['menuFamily', 'menuDevices', 'menuLearning', 'menuAccount', 'menuHelp'].map(k => t('parentToday.' + k));
  for (const name of tabs) await page.getByRole('tab', { name }).waitFor();
  await visible(t('deletionPreview.dangerTitle')).waitFor();
  await shot('menu-family-phone');
  let childModeCards = 0; const seen = {};
  for (const name of tabs) {
    await page.getByRole('tab', { name }).click(); await page.waitForTimeout(300);
    childModeCards += await page.getByText(t('unified.samePhone'), { exact: true }).count();
    seen[name] = await page.locator('body').innerText();
  }
  assert.equal(childModeCards, 1, 'same-phone child mode card in one tab (A1-16)');
  assert.ok(seen[tabs[2]].includes(t('parent.grades')) && seen[tabs[2]].includes(t('parent.notes')) && seen[tabs[2]].includes(t('share.title')), 'learning group');
  assert.ok(seen[tabs[3]].includes(t('inbox.title')) && seen[tabs[3]].includes(t('inbox.preferences')) && seen[tabs[3]].includes(t('parent.subscription')) && seen[tabs[3]].includes(t('auth.signOut')), 'account group');
  assert.ok(seen[tabs[4]].includes(t('help.title')), 'help group');
  assert.ok(seen[tabs[1]].includes(t('parent.pairDevice')) && seen[tabs[1]].includes(t('parent.parentPin')), 'devices group with PIN');
  await page.getByRole('tab', { name: tabs[3] }).click(); await shot('menu-account-phone');
  await page.getByRole('tab', { name: tabs[1] }).click(); await shot('menu-devices-phone');
  await page.goto(`${web}/parent/menu?section=security`);
  await page.getByLabel(t('parentV5.newParentPin')).waitFor();
  assert.equal(await page.getByRole('tab', { name: tabs[1] }).getAttribute('aria-selected'), 'true', 'old security link opens devices');
  assert.ok(await y(page.getByLabel(t('parentV5.newParentPin'))) < await y(page.getByLabel(t('unified.pairCode'))), 'PIN first for the child-mode link');
  await page.setViewportSize(VIEWPORTS.tablet); await page.goto(`${web}/parent/menu`); await page.getByRole('tab', { name: tabs[0] }).waitFor(); await shot('menu-family-tablet');
  await page.setViewportSize(VIEWPORTS.desktop); await page.getByRole('tab', { name: tabs[2] }).click(); await shot('menu-learning-desktop');
  pass('menu_account_family_devices_learning_help_groups', { child_mode_cards: childModeCards });

  stage = 'slow_first_load';
  await page.setViewportSize(VIEWPORTS.phone);
  const slowChildren = { test: (u, m) => m === 'GET' && u.includes('/rest/v1/children?'), handle: async r => { await new Promise(res => setTimeout(res, 9000)); await r.fulfill({ status: 503, headers: cors, body: '{}' }).catch(() => undefined); } };
  overrides.push(slowChildren);
  await page.goto(`${web}/parent`);
  await visible(t('parentToday.slow')).waitFor({ timeout: 9000 });
  await shot('home-slow-phone');
  overrides.splice(overrides.indexOf(slowChildren), 1);
  pass('slow_first_load_says_still_connecting_with_retry');

  stage = 'offline_first_load';
  const offlinePage = await newPage(VIEWPORTS.phone);
  await login(offlinePage, f.email, f.password); await offlinePage.getByTestId('home-hero').waitFor();
  await offlinePage.context().setOffline(true);
  const started = Date.now();
  await offlinePage.reload().catch(() => undefined); // document itself may be served from the in-memory export only when online
  let offlineMs = null;
  try { await offlinePage.getByTestId('home-offline').waitFor({ timeout: 8000 }); offlineMs = Date.now() - started; } catch { /* reported below */ }
  if (offlineMs === null) {
    // Browser offline blocks even loopback document loads: emulate "app open, no network" instead.
    await offlinePage.context().setOffline(false);
    const offPage = await newPage(VIEWPORTS.phone, () => { Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }); });
    await login(offPage, f.email, f.password).catch(() => undefined);
    overrides.push({ test: u => u.includes('/rest/v1/'), handle: r => r.abort('internetdisconnected') });
    const s2 = Date.now(); await offPage.goto(`${web}/parent`);
    await offPage.getByTestId('home-offline').waitFor({ timeout: 8000 }); offlineMs = Date.now() - s2;
    await shot('home-offline-first-load-phone', offPage); overrides.pop();
    pass('offline_first_load_fast_clear_state', { ms_to_offline_state: offlineMs, method: 'navigator.onLine=false + REST aborted (internetdisconnected)' });
  } else {
    await shot('home-offline-first-load-phone', offlinePage); await offlinePage.context().setOffline(false);
    pass('offline_first_load_fast_clear_state', { ms_to_offline_state: offlineMs, method: 'context.setOffline(true) + reload' });
  }
  assert.ok(offlineMs < 5000, 'offline state in < 5 s, was ' + offlineMs);

  stage = 'zero_children';
  const email0 = `gina-${randomUUID()}@example.invalid`, password0 = 'U03-' + randomUUID();
  const signup = await loopbackFixtureFetch(f.url + '/auth/v1/signup', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: email0, password: password0 }) });
  assert.ok(signup.ok, 'synthetic signup ' + signup.status);
  const B = { s: await token(email0, password0) }; const bapi = client(B);
  await bapi('rpc/create_family', { p_name: 'Deneme Ailesi', p_display_name: 'Deniz' });
  B.s = await refresh(B.s);
  const empty = await newPage(VIEWPORTS.phone); await login(empty, email0, password0);
  await empty.getByTestId('home-empty').waitFor();
  assert.equal(await empty.getByRole('button', { name: t('parentPremium.addChild') }).count(), 1, 'one meaningful action');
  assert.equal(await empty.getByTestId('home-next').count() + await empty.getByTestId('home-quick-actions').count(), 0);
  await shot('home-zero-children-phone', empty);
  await empty.setViewportSize(VIEWPORTS.desktop); await shot('home-zero-children-desktop', empty);
  pass('zero_children_single_action');

  stage = 'one_child_zero_tasks';
  await bapi('rpc/save_child_setup', profile('Mert'));
  await empty.setViewportSize(VIEWPORTS.phone); await empty.reload();
  await empty.getByTestId('home-tasks').waitFor();
  assert.equal(await empty.getByRole('button', { name: t('parentHome.all'), exact: true }).count(), 0, 'no filter for a single child');
  assert.equal(await empty.getByRole('button', { name: t('betaUx.firstTask') }).count(), 1);
  assert.equal(await empty.getByRole('button', { name: t('parentHome.addTask') }).count(), 0, 'no second create-task shortcut');
  assert.equal(await empty.getByTestId('home-next').count(), 0);
  await shot('home-one-child-no-tasks-phone', empty);
  await empty.getByTestId('home-tasks').scrollIntoViewIfNeeded(); await shot('home-one-child-no-tasks-tasks-phone', empty);
  pass('one_child_zero_tasks_single_first_task_action');

  assert.deepEqual(errors, []); pass('no_runtime_errors');
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-real-auth-rest (test-isolated-services.py --ui-hold); inbox unread count stubbed; failures injected by Playwright route', viewports: Object.values(VIEWPORTS).map(v => `${v.width}x${v.height}`), today, results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length }));
  await browser.close(); server.close();
})().catch(async e => {
  console.log('CHECK_FAILED ' + stage + ' ' + String(e && e.message).slice(0, 700));
  if (page) { const failDir = fs.mkdtempSync(require('node:path').join(failRoot, 'gina-ui-failure-')); console.error('Failure artifacts: ' + failDir); await page.screenshot({ path: failDir + '/gina-u03-ui-failed.png' }).catch(() => undefined); fs.writeFileSync(failDir + '/gina-u03-ui-failure.txt', await page.locator('body').innerText().catch(() => '')); }
  if (browser) await browser.close(); if (server) server.close(); process.exitCode = 1;
});
