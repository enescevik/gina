const { loopbackFixtureRouteFetch } = require('./loopback-fixture-fetch.cjs');
const loopbackFixtureFetch = require('./loopback-fixture-fetch.cjs');
// D2 UI checks (C06/AUTH-1 remainder) against a disposable local Auth/REST/Realtime fixture (synthetic data only).
// - Parent-phone child mode follows the server PIN rule: a child without a PIN enters directly, a child with a
//   PIN uses the shared PinEntry; a PIN added meanwhile switches back to PinEntry.
// - A tablet paired while the app was closed shows "… joined / not my family" on open, before the child area
//   (both with a stale non-device token and with an already refreshed device token); "not my family" revokes
//   it and the parent who paired gets an inbox note without personal data; outside the window no card.
// Usage: GINA_QA_UI_FIXTURE=<fixture.json> GINA_D2_WEB=http://127.0.0.1:<port> GINA_D2_OUT=<dir> \
//        GINA_QA_PLAYWRIGHT_PATH=<playwright> [GINA_D2_FAIL_DIR=<dir>] node scripts/test-d2-pin-receipt-ui.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1');
assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const WEB = process.env.GINA_D2_WEB; assert.match(WEB, /^http:\/\/127\.0\.0\.1:\d+$/);
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.GINA_D2_OUT || root + '/docs/release/d2-2026-11-06'); fs.mkdirSync(out + '/screenshots', { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const t = (key, vars = {}) => { let s = tr[key]; assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 } };
const results = []; const pass = (check, extra = {}) => { results.push({ check, passed: true, ...extra }); console.log('ok', check); };
let browser, stage = 'setup'; const pages = [];

const psql = (db, text) => execFileSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8' }).trim();
const candidates = psql('postgres', "select datname from pg_database where datname ~ '^gina_http_[0-9a-f]+_audit$';").split('\n').filter(Boolean);
const db = candidates.find((name) => psql(name, `select count(*) from auth.users where id='${f.userId}';`) === '1');
assert.ok(db, 'fixture database not found');
const sql = (text) => psql(db, text);

async function auth(pathname, body) {
  const res = await loopbackFixtureFetch(f.url + '/auth/v1/' + pathname, { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.ok(res.ok, pathname + ' ' + res.status); return res.json();
}
async function rpc(name, args, token) {
  const res = await loopbackFixtureFetch(f.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: f.anon, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function routeLocal(context) {
  await context.route(f.url + '/**', async (route) => {
    try {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const res = await loopbackFixtureRouteFetch(route); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
    } catch { await route.fulfill({ status: 503, body: 'Local fixture unavailable' }).catch(() => {}); }
  });
}
async function newContext(size) {
  const context = await browser.newContext({ viewport: sizes[size], locale: 'tr-TR', hasTouch: true });
  await routeLocal(context); return context;
}
async function pageIn(context) {
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message)); pages.push(page); return page;
}
async function shot(page, name, focus) {
  if (focus) await page.getByTestId(focus).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/screenshots/${name}.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': horizontal overflow');
  const body = await page.locator('body').innerText();
  assert.ok(!/\b(u02|c06|u01|experience|unified|auth1|d2|inbox)\.[a-zA-Z]/.test(body), name + ': raw i18n key visible');
  assert.ok(!/ailesi ailesi/i.test(body), name + ': repeated family word');
}
async function both(page, name, focus) {
  const size = page.viewportSize();
  await page.setViewportSize(sizes.phone); await shot(page, name + '-phone', focus);
  await page.setViewportSize(sizes.tablet); await shot(page, name + '-tablet', focus);
  await page.setViewportSize(size);
}
const button = (page, name) => page.getByRole('button', { name, exact: true });
const text = (page, value) => page.getByText(value, { exact: true }).first();
const sessionOf = (page) => page.evaluate(() => { const k = Object.keys(localStorage).find((key) => key.endsWith('-auth-token')); return k ? { key: k, value: JSON.parse(localStorage.getItem(k)) } : null; });
const claimsOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).gina ?? {};

async function newCode(page, name) {
  await page.goto(WEB + '/device/pair'); await button(page, t('unified.pairCodeAction')).waitFor();
  await page.getByLabel(t('unified.deviceName'), { exact: true }).fill(name);
  await button(page, t('unified.pairCodeAction')).click(); await page.getByTestId('pairing-active').waitFor();
  const shown = (await page.getByTestId('pairing-code').innerText()).trim();
  assert.match(shown, /^[ACDEFHJKMNPRTUVWXY3479]{4} [ACDEFHJKMNPRTUVWXY3479]{4}$/);
  return shown.replace(/\s/g, '');
}
async function parentPairs(code, token) {
  const preview = await rpc('preview_device_pairing', { p_code: code }, token);
  assert.equal(preview.body?.status, 'ok', JSON.stringify(preview.body));
  const res = await rpc('pair_child_device', { p_code: code, p_preview_token: preview.body.preview_token }, token);
  assert.equal(res.status, 200, JSON.stringify(res.body)); return res.body;
}
async function exitChildMode(page) {
  await page.getByRole('button', { name: t('room.parentExit') }).first().click();
  await page.getByLabel(t('childMode.parentPin'), { exact: true }).fill('5678');
  await button(page, t('childMode.exit')).click(); await page.waitForURL('**/parent');
}

(async () => {
  stage = 'fixture';
  const parentToken = (await auth('token?grant_type=password', { email: f.email, password: f.password })).access_token;
  // Ece has PIN 1234 (fixture); Can has none. Parent PIN 5678 (fixture). No paired devices; clean inbox.
  sql(`update public.devices set revoked_at=now() where family_id='${f.familyId}' and revoked_at is null;
       update public.families set name='Yılmaz Ailesi' where id='${f.familyId}';
       update public.children set name='Ece', avatar='avatar-default', sort_order=0 where id='${f.childId}';
       delete from public.children where family_id='${f.familyId}' and id<>'${f.childId}';
       insert into public.children(family_id,name,sort_order) values('${f.familyId}','Can',1);
       insert into public.active_families values('${f.userId}','${f.familyId}') on conflict(user_id) do update set family_id=excluded.family_id;
       update public.child_pins set failed_count=0, locked_until=null;
       update public.parent_pins set failed_count=0, locked_until=null;`);
  const canId = sql(`select id from public.children where family_id='${f.familyId}' and name='Can';`);
  assert.equal(sql(`select count(*) from public.child_pins where child_id='${canId}';`), '0');
  assert.equal(sql(`select count(*) from public.child_pins where child_id='${f.childId}';`), '1');
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  // 1) PIN-less child on the parent's phone: no PIN boxes, plain explanation, direct entry.
  stage = 'pinless_child';
  const parentCtx = await newContext('phone'); const parent = await pageIn(parentCtx);
  await parent.goto(WEB); await parent.getByLabel('E-posta', { exact: true }).fill(f.email); await parent.getByLabel('Şifre', { exact: true }).fill(f.password);
  await button(parent, 'Giriş yap').click(); await parent.waitForURL('**/parent');
  await parent.goto(WEB + '/parent/child-mode'); await text(parent, t('d2.childMode.intro')).waitFor();
  await both(parent, 'child-mode-picker');
  await parent.getByRole('button', { name: /Can/ }).first().click();
  await parent.getByTestId('child-mode-no-pin').waitFor();
  assert.ok((await parent.getByTestId('child-mode-no-pin').innerText()).includes(t('d2.childMode.noPinBody', { name: 'Can' })));
  assert.equal(await parent.getByLabel(t('childV5.pinLabel'), { exact: true }).count(), 0, 'no PIN boxes for a PIN-less child');
  assert.equal(await parent.getByText(t('experience.pin.prompt'), { exact: true }).count(), 0);
  await both(parent, 'child-mode-pinless', 'child-mode-no-pin');
  await parent.getByTestId('child-mode-enter').click(); await parent.waitForURL('**/parent/child-mode/today');
  assert.equal(sql(`select coalesce(sum(failed_count),0) from public.child_pins p join public.children c on c.id=p.child_id where c.family_id='${f.familyId}';`), '0', 'no failed attempt counted');
  await shot(parent, 'child-mode-pinless-inside-phone');
  await exitChildMode(parent);
  pass('pinless_child_enters_directly_on_parent_phone');

  // 2) Child with a PIN: shared PinEntry, wrong PIN refused, correct PIN enters.
  stage = 'pin_child';
  await parent.goto(WEB + '/parent/child-mode'); await parent.getByRole('button', { name: /Ece/ }).first().click();
  const pinField = parent.getByLabel(t('childV5.pinLabel'), { exact: true }); await pinField.waitFor();
  assert.equal(await parent.getByTestId('child-mode-no-pin').count(), 0);
  assert.equal(await pinField.getAttribute('maxlength'), '4');
  await pinField.fill('0000'); await button(parent, t('unified.enterMyWorld')).click(); await text(parent, t('child.wrongPin')).waitFor();
  assert.equal(await pinField.inputValue(), '');
  await both(parent, 'child-mode-pin-wrong');
  await pinField.fill('1234'); await button(parent, t('unified.enterMyWorld')).click(); await parent.waitForURL('**/parent/child-mode/today');
  await exitChildMode(parent);
  pass('pin_child_uses_shared_pin_entry');

  // 3) A PIN added on another phone while the PIN-less screen is open: server refuses, screen asks for the PIN.
  stage = 'pin_added_meanwhile';
  await parent.goto(WEB + '/parent/child-mode'); await parent.getByRole('button', { name: /Can/ }).first().click();
  await parent.getByTestId('child-mode-no-pin').waitFor();
  sql(`insert into public.child_pins(child_id,pin_hash) values('${canId}',extensions.crypt('4321',extensions.gen_salt('bf')));`);
  await parent.getByTestId('child-mode-enter').click();
  await text(parent, t('d2.childMode.pinAdded')).waitFor();
  await parent.getByLabel(t('childV5.pinLabel'), { exact: true }).waitFor();
  assert.ok(parent.url().endsWith('/parent/child-mode'), 'stays on the entry screen');
  await shot(parent, 'child-mode-pin-added-phone');
  await parent.getByLabel(t('childV5.pinLabel'), { exact: true }).fill('4321'); await button(parent, t('unified.enterMyWorld')).click();
  await parent.waitForURL('**/parent/child-mode/today'); await exitChildMode(parent);
  sql(`delete from public.child_pins where child_id='${canId}';`);
  pass('pin_added_meanwhile_switches_to_pin_entry');

  // 4) Tablet closed while the parent pairs it; on open (stale token without device role) the card shows first.
  stage = 'receipt_on_open_stale_token';
  const t1 = await newContext('tablet');
  let tab = await pageIn(t1);
  const code1 = await newCode(tab, 'Salon tableti');
  await tab.close();
  const device1 = await parentPairs(code1, parentToken);
  assert.equal(sql(`select paired_by from gina.device_pairers where device_id='${device1}';`), f.userId, 'pairer kept server-side');
  tab = await pageIn(t1);
  await tab.goto(WEB);
  await tab.getByTestId('pairing-receipt').waitFor({ timeout: 45000 });
  await tab.getByTestId('pairing-receipt-on-open').waitFor();
  assert.ok((await tab.getByTestId('pairing-receipt-family').innerText()).includes('Yılmaz Ailesi'));
  assert.ok(!tab.url().includes('/child'), 'child area not entered before the card');
  await both(tab, 'tablet-receipt-on-open', 'pairing-receipt');
  pass('closed_tablet_shows_receipt_on_open_before_child_area');

  // 5) "Not my family" → device revoked, tablet back to pairing; the parent who paired gets an inbox note.
  stage = 'reject_on_open';
  await tab.getByTestId('pairing-not-my-family').click();
  await tab.getByTestId('pairing-rejected').waitFor();
  assert.equal(sql(`select (revoked_at is not null)::text from public.devices where id='${device1}';`), 'true');
  await button(tab, t('unified.pairCodeAction')).waitFor();
  assert.ok(!tab.url().includes('/child'));
  await both(tab, 'tablet-rejected-on-open', 'pairing-rejected');
  const notes = sql(`select user_id||'|'||title||'|'||body from gina.parent_inbox where kind='device_pairing_rejected' and family_id='${f.familyId}';`).split('\n').filter(Boolean);
  assert.equal(notes.length, 1, 'exactly one note'); assert.ok(notes[0].startsWith(f.userId + '|'), 'note goes to the parent who paired');
  assert.ok(!/Salon|Yılmaz|Ece|Can|[0-9a-f]{8}-[0-9a-f]{4}/.test(notes[0].split('|').slice(1).join('|')), 'no personal data in the note');
  pass('reject_on_open_revokes_and_returns_to_pairing');

  stage = 'parent_notice';
  await parent.goto(WEB + '/parent/inbox'); await text(parent, 'Bir tablet eşlemeyi geri aldı').waitFor();
  await parent.getByRole('button', { name: t('inbox.read'), exact: true }).first().click();
  await parent.getByText(/bu ailenin kendi ailesi olmadığını bildirdi/).first().waitFor();
  await both(parent, 'parent-inbox-pairing-rejected');
  assert.equal(sql(`select (read_at is not null)::text from gina.parent_inbox where kind='device_pairing_rejected' and user_id='${f.userId}';`), 'true');
  pass('parent_gets_inbox_note_without_personal_data');

  // 6) Token already refreshed to the device role (app closed, token renewed): the child-area gate sends the
  //    tablet to the card first; "Continue" is remembered, the next open goes straight to the child area.
  stage = 'receipt_gate_device_token';
  const t2 = await newContext('tablet');
  tab = await pageIn(t2);
  const code2 = await newCode(tab, 'Oyun tableti');
  const stored = await sessionOf(tab); assert.ok(stored?.value?.refresh_token);
  await tab.close();
  const device2 = await parentPairs(code2, parentToken);
  const renewed = await auth('token?grant_type=refresh_token', { refresh_token: stored.value.refresh_token });
  assert.equal(claimsOf(renewed.access_token).role, 'device');
  tab = await pageIn(t2);
  await tab.addInitScript(([key, value]) => { if (!sessionStorage.getItem('d2-seeded')) { localStorage.setItem(key, value); sessionStorage.setItem('d2-seeded', '1'); } }, [stored.key, JSON.stringify(renewed)]);
  await tab.goto(WEB + '/child/today');
  await tab.waitForURL('**/device/pair?receipt=1**', { timeout: 30000 });
  await tab.getByTestId('pairing-receipt').waitFor(); await tab.getByTestId('pairing-receipt-on-open').waitFor();
  await both(tab, 'tablet-receipt-gate', 'pairing-receipt');
  await tab.getByTestId('pairing-continue').click();
  await tab.waitForURL(/\/child$/, { timeout: 30000 });
  assert.equal(sql(`select (revoked_at is null)::text from public.devices where id='${device2}';`), 'true');
  const ack = await tab.evaluate(() => localStorage.getItem('gina-pairing-receipt-ack'));
  assert.deepEqual(Object.keys(JSON.parse(ack)).sort(), ['device_id', 'paired_at'], 'only ids/time kept locally');
  await tab.close();
  tab = await pageIn(t2); await tab.goto(WEB);
  await tab.waitForURL(/\/child$/, { timeout: 30000 }); await tab.waitForTimeout(2500);
  assert.equal(await tab.getByTestId('pairing-receipt').count(), 0, 'confirmed pairing does not ask again');
  assert.ok(tab.url().endsWith('/child'));
  pass('device_token_gate_shows_card_then_remembers_continue');

  // 7) Outside the 15-minute window no card is offered (server decides), even without a local confirmation.
  stage = 'window_closed';
  await tab.evaluate(() => localStorage.removeItem('gina-pairing-receipt-ack'));
  await tab.close();
  sql(`update public.devices set paired_at=now()-interval '16 minutes' where id='${device2}';`);
  tab = await pageIn(t2); await tab.goto(WEB + '/child/today');
  await tab.waitForURL(/\/child$/, { timeout: 30000 }); await tab.waitForTimeout(2500);
  assert.equal(await tab.getByTestId('pairing-receipt').count(), 0);
  assert.ok(!tab.url().includes('/device/pair'));
  await shot(tab, 'tablet-window-closed-child-tablet');
  assert.equal(sql(`select count(*) from gina.parent_inbox where kind='device_pairing_rejected' and family_id='${f.familyId}';`), '1', 'no extra note');
  pass('no_card_after_undo_window');

  for (const page of pages) assert.deepEqual(page.errors, [], 'runtime errors');
  pass('no_runtime_errors_overflow_or_raw_keys');
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-real-auth-rest-realtime', viewports: sizes, results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length }));
  await browser.close();
})().catch(async (e) => {
  console.log('CHECK_FAILED ' + stage + ' ' + String(e.message).slice(0, 900));
  const failDir = process.env.GINA_D2_FAIL_DIR || '/tmp';
  for (const [i, page] of pages.entries()) {
    if (page.isClosed()) continue;
    await page.screenshot({ path: `${failDir}/d2-failed-${i}.png`, fullPage: true }).catch(() => {});
    fs.writeFileSync(`${failDir}/d2-failed-${i}.txt`, await page.locator('body').innerText().catch(() => '') + '\nURL ' + page.url() + '\nERRORS ' + JSON.stringify(page.errors));
  }
  if (browser) await browser.close();
  process.exitCode = 1;
});
