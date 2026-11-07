const loopbackFixtureFetch = require('../../../../scripts/loopback-fixture-fetch.cjs');
// D12 — D11-K1 (/families "Bitişi 14 gün içinde" + sıralama) ve D11-K2 (/overrides "Yapan" e-postası) Playwright kontrolleri.
// Ortam D11 ile aynı: `python3 scripts/test-isolated-services.py --run-local --ui-hold` (GINA_QA_UI_SERVICE=1, benzersiz
// GINA_QA_UI_FIXTURE) tek kullanımlık DB klonu + geçici GoTrue/PostgREST açar; fixture sentetik yönetici hesabını verir.
// Ortam değişkenleri: GINA_QA_UI_FIXTURE, GINA_BO_WEB, GINA_BO_BACKEND, GINA_BO_ANON, GINA_QA_PLAYWRIGHT_PATH, GINA_D12_OUT.
// Gizli değer (şifre, JWT, servis anahtarı) dosyaya veya çıktıya yazılmaz; yalnız @example.invalid hesaplar.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/); assert.ok(f.service, 'GINA_QA_UI_SERVICE=1 required');
const web = process.env.GINA_BO_WEB, backend = process.env.GINA_BO_BACKEND, placeholderAnon = process.env.GINA_BO_ANON;
assert.equal(new URL(web).hostname, '127.0.0.1'); assert.equal(new URL(backend).hostname, '127.0.0.1');
const out = path.resolve(process.env.GINA_D12_OUT); fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true });
const sizes = { d1280: { width: 1280, height: 800 }, t768: { width: 768, height: 1024 } };
const results = [];
const pass = (check, detail = {}) => { results.push({ check, passed: true, detail }); console.error('ok', check, JSON.stringify(detail)); };

async function rest(method, p, body, token = f.service, extra = {}) {
  const res = await loopbackFixtureFetch(f.url + p, { method, headers: { apikey: token === f.service ? f.service : f.anon, authorization: 'Bearer ' + token, 'content-type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) { const e = Error(`${method} ${p.split('?')[0]} ${res.status} ${String(text).slice(0, 200)}`); e.status = res.status; e.body = data; throw e; }
  return data;
}
const svc = (method, p, body) => rest(method, '/rest/v1' + p, body, f.service, { prefer: 'return=representation' });
const status = async (fn) => { try { await fn(); return 'allowed'; } catch (e) { return `${e.status}:${e.body?.code ?? ''}`; } };
const newUser = async (prefix) => {
  const pw = randomBytes(18).toString('base64url') + 'aA1!';
  const u = await rest('POST', '/auth/v1/admin/users', { email: `${prefix}-${randomBytes(4).toString('hex')}@example.invalid`, password: pw, email_confirm: true });
  return { id: u.id, email: u.email, pw };
};
const tokenOf = async (u) => (await rest('POST', '/auth/v1/token?grant_type=password', { email: u.email, password: u.pw }, f.anon)).access_token;

(async () => {
  const userToken = (await rest('POST', '/auth/v1/token?grant_type=password', { email: f.email, password: f.password }, f.anon)).access_token;
  const asAdmin = (name, args) => rest('POST', '/rest/v1/rpc/' + name, args, userToken);

  // ---- Tohum ----
  const tag = 'D12-' + randomBytes(3).toString('hex');
  const other = await newUser('d12-other'); await svc('POST', '/admins', { user_id: other.id });
  const support = await newUser('d12-support');
  await svc('POST', '/operations_members', { user_id: support.id, role: 'support', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() });
  const parent = await newUser('d12-parent');
  const now = Date.now(), day = 864e5;
  const fams = [];
  for (let i = 0; i < 55; i++) fams.push({ id: randomUUID(), name: `${tag} yakın ${String(i + 1).padStart(2, '0')}`, ends: now + ((i % 13) + 1) * day - 3600e3 });
  for (let i = 0; i < 5; i++) fams.push({ id: randomUUID(), name: `${tag} uzak ${i + 1}`, ends: now + 20 * day });
  for (let i = 0; i < 5; i++) fams.push({ id: randomUUID(), name: `${tag} ücretsiz ${i + 1}`, ends: null });
  await svc('POST', '/families', fams.map((x) => ({ id: x.id, name: x.name, created_by: parent.id, timezone: 'Europe/Istanbul', locale: 'tr' })));
  await svc('POST', '/entitlement_overrides', fams.filter((x) => x.ends).map((x) => ({ family_id: x.id, plan: 'plus', reason: `${tag} sentetik`, granted_by: f.userId, starts_at: new Date(now - day).toISOString(), ends_at: new Date(x.ends).toISOString() })));
  const auditSeed = [[other.id, 'other'], [parent.id, 'parent'], [f.userId, 'self'], [null, 'system']].map(([actor, k], i) => ({ actor_id: actor, action: 'entitlement_overrides.insert', target_table: 'entitlement_overrides', target_id: randomUUID(), family_id: f.familyId, reason: `${tag} yapan ${k}` }));
  await svc('POST', '/audit_log', auditSeed);

  // ---- Sunucu: eski çağrı biçimi ve rol kapıları (gerçek PostgREST + JWT) ----
  const oldPage = await asAdmin('admin_families_search', { p_query: null, p_cursor: null, p_limit: 5 });
  assert.equal(oldPage.sort, 'newest'); assert.ok(oldPage.next_cursor && !oldPage.next_cursor.startsWith('expiring|'), 'old cursor format');
  const supportToken = await tokenOf(support), parentToken = await tokenOf(parent);
  const gates = {
    admin_actors: await status(() => rest('POST', '/rest/v1/rpc/admin_audit_actors', { p_ids: [other.id] }, userToken)),
    support_actors: await status(() => rest('POST', '/rest/v1/rpc/admin_audit_actors', { p_ids: [other.id] }, supportToken)),
    parent_actors: await status(() => rest('POST', '/rest/v1/rpc/admin_audit_actors', { p_ids: [other.id] }, parentToken)),
    anon_actors: await status(() => rest('POST', '/rest/v1/rpc/admin_audit_actors', { p_ids: [other.id] }, f.anon)),
    support_families_filter: await status(() => rest('POST', '/rest/v1/rpc/admin_families_search', { p_limit: 5, p_expiring_within_days: 14, p_sort: 'expiring' }, supportToken)),
    anon_families: await status(() => rest('POST', '/rest/v1/rpc/admin_families_search', { p_limit: 5 }, f.anon)),
  };
  assert.equal(gates.admin_actors, 'allowed'); assert.equal(gates.support_families_filter, 'allowed');
  for (const k of ['support_actors', 'parent_actors', 'anon_actors', 'anon_families']) assert.match(gates[k], /^40[13]:42501$/, k + ' ' + gates[k]);
  const resolved = await asAdmin('admin_audit_actors', { p_ids: [other.id, parent.id, support.id] });
  const byId = Object.fromEntries(resolved.map((r) => [r.id, r.label]));
  assert.equal(byId[other.id], other.email); assert.equal(byId[support.id], support.email); assert.equal(byId[parent.id], null);
  assert.deepEqual(Object.keys(resolved[0]).sort(), ['id', 'label']);
  pass('k_server_contract_and_role_gates', { old_call: 'newest/<created_at>|<id>', gates, parent_label: null, fields: ['id', 'label'] });

  // Beklenen /families listesi (süzgeç + bitişi en yakın), tamamı.
  const expected = [];
  for (let cursor = null; ;) {
    const pg = await asAdmin('admin_families_search', { p_query: null, p_cursor: cursor, p_limit: 200, p_expiring_within_days: 14, p_sort: 'expiring' });
    expected.push(...pg.rows); if (!pg.has_more) break; cursor = pg.next_cursor;
  }
  assert.ok(expected.length >= 55, 'seeded near families present');
  for (let i = 1; i < expected.length; i++) assert.ok(expected[i - 1].plan_expires_at <= expected[i].plan_expires_at || new Date(expected[i - 1].plan_expires_at) <= new Date(expected[i].plan_expires_at), 'server order');
  const seededNames = new Set(expected.map((r) => r.name).filter((n) => n.startsWith(tag)));
  assert.equal(seededNames.size, 55, 'only the 55 near families of this run'); assert.ok(![...seededNames].some((n) => /uzak|ücretsiz/.test(n)));

  // ---- Tarayıcı ----
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: sizes.d1280, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const rpcCalls = [];
  await ctx.route(backend + '/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const m = req.url().match(/\/rest\/v1\/rpc\/([a-z_]+)/); if (m) rpcCalls.push({ fn: m[1], body: req.postDataJSON?.() ?? null });
    const headers = { ...req.headers() };
    if (headers.apikey === placeholderAnon) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + placeholderAnon) headers.authorization = 'Bearer ' + f.anon;
    try {
      const res = await route.fetch({ url: f.url + req.url().slice(backend.length), headers });
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*', 'access-control-expose-headers': '*' } });
    } catch { await route.fulfill({ status: 503, body: 'fixture unavailable' }); }
  });
  const p = await ctx.newPage(); p.setDefaultTimeout(25000);
  const pageErrors = []; let nativeDialogs = 0;
  p.on('pageerror', (e) => pageErrors.push(e.message));
  p.on('dialog', async (d) => { nativeDialogs++; await d.dismiss(); });
  const shot = async (name) => { await p.screenshot({ path: path.join(out, 'screenshots', name + '.png'), fullPage: false }); };
  const go = async (route) => { await p.goto(`${web}/${route.replace(/^([^?]+)/, '$1.html')}`); await p.waitForTimeout(1800); };
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const rowNames = () => p.locator('[data-family-row] .font-semibold').allInnerTexts();

  await p.goto(web + '/sign-in.html');
  await p.fill('#email', f.email); await p.fill('#password', f.password);
  await p.locator('button[type=submit]').click();
  await p.waitForURL('**/dashboard**', { timeout: 30000 });

  // K1: /families süzgeç + sıralama, iki ölçüde.
  const k1 = {};
  for (const [size, vp] of Object.entries(sizes)) {
    await p.setViewportSize(vp); await go('families');
    await p.getByTestId('families-status').waitFor();
    const before = rpcCalls.length;
    await p.getByTestId('families-expiring').check();
    await p.getByTestId('families-sort').selectOption('expiring');
    await p.waitForFunction(() => document.querySelectorAll('[data-testid=families-days-left]').length > 0);
    await p.waitForTimeout(800);
    const calls = rpcCalls.slice(before).filter((c) => c.fn === 'admin_families_search');
    assert.ok(calls.some((c) => c.body?.p_expiring_within_days === 14 && c.body?.p_sort === 'expiring'), 'server-side filter/sort params sent');
    let names = await rowNames();
    assert.deepEqual(names, expected.slice(0, 50).map((r) => r.name), 'first page = server order');
    const badges = await p.getByTestId('families-days-left').allInnerTexts();
    assert.equal(badges.length, names.length); assert.ok(badges.every((b) => /^(\d+ gün kaldı|1 gün kaldı|Bugün bitiyor)$/.test(b)), 'badges ' + badges.slice(0, 3));
    const statusText = await p.getByTestId('families-status').innerText();
    await shot(`families-expiring-${size}`);
    assert.ok((await overflow()) <= 0, 'overflow /families ' + size);
    if (expected.length > 50) {
      await p.getByRole('button', { name: 'Daha fazla aile yükle' }).click();
      await p.waitForFunction((n) => document.querySelectorAll('[data-family-row]').length > n, 50);
      await p.waitForTimeout(500);
      names = await rowNames();
      const pageCalls = rpcCalls.slice(before).filter((c) => c.fn === 'admin_families_search' && c.body?.p_cursor);
      assert.ok(pageCalls.length >= 1 && pageCalls.every((c) => String(c.body.p_cursor).startsWith('expiring|') && c.body.p_sort === 'expiring' && c.body.p_expiring_within_days === 14), 'next page keeps filter/sort and tagged cursor');
    }
    assert.deepEqual(names, expected.slice(0, names.length).map((r) => r.name));
    assert.equal(new Set(names).size, names.length, 'no duplicate rows');
    assert.ok(!names.some((n) => n.startsWith(tag) && /uzak|ücretsiz/.test(n)), 'out-of-window families hidden');
    const endText = await p.getByTestId('families-status').innerText();
    // Süzgeç kalkınca liste yeniden ilk sayfa olur ve ücretsiz/uzak aileler tekrar görünebilir.
    await p.getByTestId('families-expiring').uncheck(); await p.waitForTimeout(1500);
    assert.equal(await p.getByTestId('families-days-left').count(), 0, 'no badges without filter');
    await p.getByTestId('families-sort').selectOption('newest'); await p.waitForTimeout(1500);
    const newestNames = await rowNames();
    assert.ok(newestNames.length > 0);
    k1[size] = { first_page: 50, after_more: names.length, expected_total: expected.length, status: statusText, end_status: endText };
  }
  pass('k1_families_expiring_filter_sort_paging', k1);

  // K2: /overrides "Yapan".
  const k2 = {};
  for (const [size, vp] of Object.entries(sizes)) {
    await p.setViewportSize(vp);
    const before = rpcCalls.length;
    await go('overrides');
    const row = (k) => p.locator('[data-testid=override-audit] tr').filter({ hasText: `${tag} yapan ${k}` }).getByTestId('override-audit-actor').locator('span').first();
    await row('other').waitFor();
    await p.waitForFunction((email) => [...document.querySelectorAll('[data-testid=override-audit-actor]')].some((n) => n.textContent.includes(email)), other.email);
    const got = { other: await row('other').innerText(), parent: await row('parent').innerText(), self: await row('self').innerText(), system: await row('system').innerText() };
    assert.deepEqual(got, { other: other.email, parent: 'Başka yönetici', self: 'Siz', system: 'Sistem (otomatik)' });
    const cells = await p.getByTestId('override-audit-actor').locator('span').allInnerTexts();
    assert.ok(!cells.some((c) => /[0-9a-f]{8}-[0-9a-f]{4}-/i.test(c)), 'no raw UUID in the visible actor label');
    const note = await p.getByTestId('override-audit-status').innerText();
    assert.match(note, /e-postasıyla gösterilir/);
    const actorCalls = rpcCalls.slice(before).filter((c) => c.fn === 'admin_audit_actors');
    assert.ok(actorCalls.length >= 1 && actorCalls.every((c) => !c.body.p_ids.includes(f.userId)), 'self id is not sent');
    await p.locator('[data-testid=override-audit] tr').filter({ hasText: `${tag} yapan other` }).scrollIntoViewIfNeeded();
    await shot(`overrides-actor-${size}`);
    assert.ok((await overflow()) <= 0, 'overflow /overrides ' + size);
    k2[size] = { ...got, other: 'email of the other admin', actor_rpc_calls: actorCalls.length };
  }
  pass('k2_override_audit_actor_labels', k2);

  assert.equal(nativeDialogs, 0, 'native browser dialogs'); assert.deepEqual(pageErrors, [], 'page errors');
  pass('no_native_dialogs_no_page_errors', { native_dialogs: nativeDialogs, page_errors: 0 });
  await browser.close();
})().then(() => { fs.writeFileSync(path.join(out, 'ui-checks.json'), JSON.stringify({ passed: true, results }, null, 2)); console.log(JSON.stringify({ passed: true, count: results.length })); },
  (e) => { results.push({ check: 'failure', passed: false, detail: String(e.message).split('\n')[0].slice(0, 400) }); fs.writeFileSync(path.join(out, 'ui-checks.json'), JSON.stringify({ passed: false, results }, null, 2)); console.error(e); process.exit(1); });
