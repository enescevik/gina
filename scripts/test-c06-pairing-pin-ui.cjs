const { loopbackFixtureRouteFetch } = require('./loopback-fixture-fetch.cjs');
const loopbackFixtureFetch = require('./loopback-fixture-fetch.cjs');
// C06 UI checks against a disposable local Auth/REST/Realtime fixture (synthetic data only).
// Usage: GINA_QA_UI_FIXTURE=<fixture.json> GINA_C06_WEB=http://127.0.0.1:<port> \
//        GINA_QA_PLAYWRIGHT_PATH=<playwright> node scripts/test-c06-pairing-pin-ui.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1');
assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const WEB = process.env.GINA_C06_WEB; assert.match(WEB, /^http:\/\/127\.0\.0\.1:\d+$/);
const root = path.resolve(__dirname, '..');
const out = process.env.GINA_C06_OUT ? path.resolve(process.env.GINA_C06_OUT) : root + '/docs/release/c06-2026-11-06'; fs.mkdirSync(out + '/screenshots', { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const t = (key, vars = {}) => { let s = tr[key] ?? key.split('.').reduce((v, k) => v?.[k], tr); assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const results = []; const pass = (check, extra = {}) => { results.push({ check, passed: true, ...extra }); console.log('ok', check); };
let browser, stage = 'setup'; const pages = [];

const psql = (db, text) => execFileSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8' }).trim();
const candidates = psql('postgres', "select datname from pg_database where datname ~ '^gina_http_[0-9a-f]+_audit$';").split('\n').filter(Boolean);
const db = candidates.find((name) => psql(name, `select count(*) from auth.users where id='${f.userId}';`) === '1');
assert.ok(db, 'fixture database not found');
const sql = (text) => psql(db, text);
// Auth tables belong to the Auth service role; touched only in this disposable clone (synthetic users).
const authSql = (text) => execFileSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'supabase_admin', '-d', db, '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8' }).trim();

async function auth(pathname, body, token) {
  const res = await loopbackFixtureFetch(f.url + '/auth/v1/' + pathname, { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
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
async function newPage(size, locale = 'tr-TR') {
  const context = await browser.newContext({ viewport: sizes[size], locale, hasTouch: size !== 'desktop' });
  await routeLocal(context); const page = await context.newPage(); page.setDefaultTimeout(25000);
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message)); pages.push(page); return page;
}
async function shot(page, name, focus) {
  if (focus) await page.getByTestId(focus).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/screenshots/${name}.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': horizontal overflow');
  const body = await page.locator('body').innerText();
  assert.ok(!/\b(u02|c06|u01|experience|unified|auth1)\.[a-zA-Z]/.test(body), name + ': raw i18n key visible');
  assert.ok(!/ailesi ailesi/i.test(body), name + ': repeated family word');
}
const button = (page, name) => page.getByRole('button', { name, exact: true });
const text = (page, value) => page.getByText(value, { exact: true }).first();
async function fillSignIn(page, email, password) {
  await page.getByLabel('E-posta', { exact: true }).fill(email); await page.getByLabel('Şifre', { exact: true }).fill(password);
  await button(page, 'Giriş yap').click();
}
async function signIn(page, email = f.email, password = f.password) { await page.goto(WEB); await fillSignIn(page, email, password); await page.waitForURL('**/parent'); }
const pending = (page) => page.evaluate(() => sessionStorage.getItem('gina-pending-pairing'));
const tokenOf = (page) => page.evaluate(() => { const k = Object.keys(localStorage).find((key) => key.endsWith('-auth-token')); return k ? JSON.parse(localStorage.getItem(k)).access_token : null; });
function decodeQr(png) {
  const result = execFileSync('swift', [root + '/scripts/u02/decode-qr.swift', png], { encoding: 'utf8', timeout: 240000 }).trim();
  return result.split(' ').slice(1).join(' ');
}
async function newCode(page, name) {
  await page.goto(WEB + '/device/pair'); await button(page, t('unified.pairCodeAction')).waitFor();
  if (name) await page.getByLabel(t('unified.deviceName'), { exact: true }).fill(name);
  await button(page, t('unified.pairCodeAction')).click(); await page.getByTestId('pairing-active').waitFor();
  // C13-AUTH-1: 8 characters, shown as 4+4.
  const shown = (await page.getByTestId('pairing-code').innerText()).trim();
  assert.match(shown, /^[ACDEFHJKMNPRTUVWXY3479]{4} [ACDEFHJKMNPRTUVWXY3479]{4}$/, 'grouped 8-char code');
  return shown.replace(/\s/g, '');
}

(async () => {
  stage = 'fixture';
  const parentToken = (await auth('token?grant_type=password', { email: f.email, password: f.password })).body.access_token;
  sql(`update public.devices set revoked_at=now() where family_id='${f.familyId}' and revoked_at is null;
       delete from public.families where name='Demir Ailesi';
       insert into public.active_families values('${f.userId}','${f.familyId}') on conflict(user_id) do update set family_id=excluded.family_id;
       update public.parent_pins set failed_count=0, locked_until=null;
       delete from public.device_pairing_locks; delete from public.device_pairing_attempts;
       update public.families set name='Yılmaz Ailesi' where id='${f.familyId}';
       update public.children set name='Ece', avatar='avatar-default' where id='${f.childId}';
       delete from public.children where family_id='${f.familyId}' and id<>'${f.childId}';
       insert into public.children(family_id,name,sort_order) values('${f.familyId}','Can',1);
       update public.child_pins set failed_count=0, locked_until=null;`);
  const canId = sql(`select id from public.children where family_id='${f.familyId}' and name='Can';`);
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  // 1) Menu has one pairing path: a link to /parent/pair-device (no second code field); parent PIN uses PinSetup.
  stage = 'menu_single_path';
  const parent = await newPage('phone'); await signIn(parent);
  await parent.goto(WEB + '/parent/menu?section=devices'); await text(parent, t('unified.connectedDevices')).waitFor();
  assert.equal(await parent.getByLabel(t('auth1.parentPair.codeLabel'), { exact: true }).count(), 0, 'menu must not keep its own code field');
  await parent.getByTestId('parent-pin-setup').waitFor();
  await parent.getByLabel(t('parentV5.newParentPin'), { exact: true }).fill('2580');
  await parent.getByLabel(t('experience.confirmPin'), { exact: true }).fill('2580');
  await button(parent, t('parent.savePin')).click(); await text(parent, t('unified.pinSaved')).waitFor();
  assert.equal(sql(`select pin_hash = extensions.crypt('2580', pin_hash) from public.parent_pins where family_id='${f.familyId}';`), 't');
  await shot(parent, 'menu-devices-single-path-phone');
  await parent.setViewportSize(sizes.desktop); await shot(parent, 'menu-devices-single-path-desktop'); await parent.setViewportSize(sizes.phone);
  await parent.getByRole('button', { name: new RegExp('^' + t('parent.pairDevice')) }).first().click();
  await parent.waitForURL('**/parent/pair-device'); await parent.getByLabel(t('auth1.parentPair.codeLabel'), { exact: true }).waitFor();
  pass('menu_links_to_single_pair_screen_and_parent_pin_uses_shared_setup');

  // 2) Child tablet makes a QR; it decodes to the code-only link.
  stage = 'device_qr';
  const tablet = await newPage('tablet');
  const code1 = await newCode(tablet, 'Salon tableti');
  const qrPng = out + '/screenshots/device-pair-qr-element.png';
  await tablet.getByTestId('pairing-qr').screenshot({ path: qrPng });
  const link = decodeQr(qrPng);
  assert.equal(new URL(link).origin, WEB); assert.equal(new URL(link).pathname, '/parent/pair-device');
  assert.equal(new URL(link).searchParams.get('code'), code1);
  pass('qr_decodes_to_code_only_link');

  // 3) Signed-out parent scans: sign-in first, code kept (tab only), then target shown — not paired yet.
  stage = 'qr_signed_out_handoff';
  const fresh = await newPage('phone');
  await fresh.goto(link); await fresh.waitForURL('**/sign-in**');
  const kept = JSON.parse(await pending(fresh)); assert.equal(kept.code, code1); assert.deepEqual(Object.keys(kept).sort(), ['code', 'savedAt']);
  await shot(fresh, 'qr-signed-out-sign-in-phone');
  await fillSignIn(fresh, f.email, f.password);
  await fresh.waitForURL('**/parent/pair-device?resume=1');
  await fresh.getByTestId('pairing-target').waitFor();
  const target = await fresh.getByTestId('pairing-target').innerText();
  assert.ok(target.includes('Salon tableti') && target.includes('Yılmaz Ailesi'), target);
  await text(fresh, t('c06.pair.resumed')).waitFor();
  assert.equal(sql(`select (consumed_at is null)::text from public.device_pairings where code='${code1}';`), 'true', 'not consumed before confirm');
  assert.equal(sql(`select count(*) from public.devices d join public.device_pairings p on p.auth_user_id=d.auth_user_id where p.code='${code1}' and d.revoked_at is null;`), '0', 'not paired before confirm');
  await shot(fresh, 'pair-target-after-sign-in-phone', 'pairing-target');
  await fresh.setViewportSize(sizes.tablet); await shot(fresh, 'pair-target-after-sign-in-tablet', 'pairing-target');
  await fresh.setViewportSize(sizes.desktop); await shot(fresh, 'pair-target-after-sign-in-desktop', 'pairing-target'); await fresh.setViewportSize(sizes.phone);
  await button(fresh, t('u02.parentPair.confirm')).click();
  await fresh.waitForURL('**/parent/device-access**');
  const deviceId = new URL(fresh.url()).searchParams.get('deviceId');
  assert.equal(sql(`select name||'|'||access_mode||'|'||pin_policy||'|'||family_id from public.devices where id='${deviceId}';`), `Salon tableti|selected|required|${f.familyId}`);
  assert.equal(await pending(fresh), null, 'kept code removed after use');
  assert.equal(sql(`select count(*) from public.device_pairing_previews where code='${code1}' and used_at is not null;`), '1', 'paired with a used preview token');
  pass('qr_sign_in_target_confirm_pairs_once_without_losing_code');

  // 3b) C13-AUTH-1: the waiting tablet shows which family received it before entering child mode.
  stage = 'device_receipt';
  await tablet.getByTestId('pairing-receipt').waitFor({ timeout: 45000 });
  assert.ok((await tablet.getByTestId('pairing-receipt-family').innerText()).includes('Yılmaz Ailesi'));
  await tablet.getByRole('button', { name: t('auth1.device.notMyFamily'), exact: true }).waitFor();
  await shot(tablet, 'device-paired-receipt-tablet', 'pairing-receipt');
  await tablet.setViewportSize(sizes.phone); await shot(tablet, 'device-paired-receipt-phone', 'pairing-receipt'); await tablet.setViewportSize(sizes.tablet);
  await button(tablet, t('auth1.device.continue')).click();
  await tablet.waitForURL('**/child', { timeout: 20000 });
  pass('device_shows_receiving_family_then_continues');

  // 4) Replaying the used QR link (signed in) or typing it again cannot pair a second time.
  stage = 'replay';
  await fresh.goto(link); await text(fresh, t('u02.parentPair.expiredTitle')).waitFor();
  assert.equal(await fresh.getByTestId('pairing-target').count(), 0);
  await shot(fresh, 'pair-used-code-phone');
  await fresh.goto(WEB + '/parent/pair-device'); await fresh.getByLabel(t('auth1.parentPair.codeLabel'), { exact: true }).fill(code1.slice(0, 4).toLowerCase() + '-' + code1.slice(4).toLowerCase());
  assert.equal(await fresh.getByLabel(t('auth1.parentPair.codeLabel'), { exact: true }).inputValue(), code1.slice(0, 4) + ' ' + code1.slice(4), 'typed code normalised and grouped');
  await button(fresh, t('c06.pair.show')).click(); await text(fresh, t('u02.parentPair.expiredTitle')).waitFor();
  assert.equal(sql(`select count(*) from public.devices where id='${deviceId}';`), '1');
  pass('used_code_replay_is_refused');

  // 5) Code expires on the server while the parent is signing in: shown as expired, never paired.
  stage = 'expired_server';
  const phoneDevice = await newPage('phone');
  const code2 = await newCode(phoneDevice, 'Telefon');
  const late = await newPage('phone');
  await late.goto(WEB + '/parent/pair-device?code=' + code2); await late.waitForURL('**/sign-in**');
  sql(`update public.device_pairings set expires_at=now()-interval '1 second' where code='${code2}';`);
  await fillSignIn(late, f.email, f.password);
  await late.waitForURL('**/parent/pair-device?resume=1');
  await text(late, t('u02.parentPair.expiredTitle')).waitFor();
  assert.equal(await late.getByTestId('pairing-target').count(), 0);
  assert.equal(await pending(late), null);
  assert.equal(sql(`select (consumed_at is null)::text from public.device_pairings where code='${code2}';`), 'true');
  await shot(late, 'pair-expired-after-sign-in-phone');
  pass('server_expiry_during_sign_in_is_safe');

  // 6) Kept code older than 10 minutes is dropped locally: sign-in goes to the normal home.
  stage = 'expired_local';
  const code3 = await newCode(phoneDevice);
  const slow = await newPage('phone'); await slow.clock.install();
  await slow.goto(WEB + '/parent/pair-device?code=' + code3); await slow.waitForURL('**/sign-in**');
  assert.equal(JSON.parse(await pending(slow)).code, code3);
  await slow.clock.fastForward('10:30');
  await fillSignIn(slow, f.email, f.password);
  await slow.waitForURL('**/parent');
  assert.equal(await pending(slow), null);
  assert.equal(sql(`select (consumed_at is null)::text from public.device_pairings where code='${code3}';`), 'true');
  pass('locally_expired_code_is_dropped_after_sign_in');

  // 7) Confirm access for the tablet (one child, PIN required) and enter as Ece.
  stage = 'configure_and_enter';
  await fresh.goto(WEB + '/parent/device-access?deviceId=' + deviceId); await fresh.getByTestId('device-access-summary').waitFor();
  await fresh.getByRole('radio', { name: new RegExp(t('experience.device.personal')) }).click();
  await fresh.getByRole('radio', { name: /Ece/ }).click();
  await button(fresh, t('common.save')).click(); await text(fresh, t('experience.device.saved')).waitFor();
  await tablet.waitForURL('**/child', { timeout: 45000 });
  await tablet.getByText('Ece', { exact: true }).first().click(); await tablet.waitForURL('**/child/pin**');
  await tablet.getByLabel(t('childV5.pinLabel'), { exact: true }).fill('1234');
  await button(tablet, t('unified.enterMyWorld')).click(); await tablet.waitForURL('**/child/today');
  pass('configured_single_child_device_enters_with_pin');

  // 8) The child cannot reach parent screens or parent/sibling RPCs.
  stage = 'child_boundaries';
  for (const p of ['/parent/menu?section=devices', '/parent/pair-device?code=' + code3, '/parent/device-access?deviceId=' + deviceId]) {
    await tablet.goto(WEB + p); await tablet.waitForURL((u) => u.pathname.startsWith('/child'), { timeout: 20000 });
    assert.equal(await tablet.getByLabel(t('auth1.parentPair.codeLabel'), { exact: true }).count(), 0);
  }
  const deviceToken = await tokenOf(tablet); assert.ok(deviceToken);
  const denied = {
    preview: await rpc('preview_device_pairing', { p_code: code3 }, deviceToken),
    pair: await rpc('pair_child_device', { p_code: code3, p_preview_token: randomUUID() }, deviceToken),
    parentPin: await rpc('verify_parent_pin', { p_pin: '2580' }, deviceToken),
    sibling: await rpc('child_pin_login', { p_child_id: canId, p_pin: '' }, deviceToken),
    configure: await rpc('configure_child_device', { p_device_id: deviceId, p_name: 'x', p_child_ids: [canId], p_pin_required: false }, deviceToken),
  };
  for (const [name, res] of Object.entries(denied)) assert.ok(res.status === 403 || res.body?.code === '42501', name + ' ' + JSON.stringify(res));
  assert.equal(sql(`select (consumed_at is null)::text from public.device_pairings where code='${code3}';`), 'true');
  pass('child_device_cannot_reach_parent_or_sibling', { denied: Object.fromEntries(Object.entries(denied).map(([k, v]) => [k, v.status])) });

  // 9) Parent revokes while the child is inside: the open app leaves with the reason shown.
  stage = 'revoke_reason';
  await tablet.goto(WEB + '/child/today'); await tablet.waitForURL('**/child/today');
  const started = Date.now();
  const revoke = await rpc('revoke_device', { p_device_id: deviceId }, parentToken); assert.ok(revoke.status < 300, 'revoke ' + revoke.status);
  await tablet.waitForURL('**/device/pair?revoked=1', { timeout: 60000 });
  await text(tablet, t('u02.revoked.title')).waitFor();
  const afterRevoke = await rpc('child_pin_login', { p_child_id: f.childId, p_pin: '1234' }, deviceToken);
  assert.ok(afterRevoke.status === 403 || afterRevoke.body?.code === '42501', 'old device token denied after revoke');
  await shot(tablet, 'device-revoked-reason-tablet');
  await tablet.setViewportSize(sizes.phone); await shot(tablet, 'device-revoked-reason-phone'); await tablet.setViewportSize(sizes.tablet);
  pass('revoked_device_leaves_open_session_and_sees_reason', { seconds: Math.round((Date.now() - started) / 1000) });

  // 10) Parent exit PIN on the parent phone: shared PinEntry, 5 wrong -> server wait, then exit.
  stage = 'parent_exit_pin';
  await parent.goto(WEB + '/parent/child-mode'); await parent.getByText('Ece', { exact: true }).first().click();
  await parent.getByLabel(t('childV5.pinLabel'), { exact: true }).fill('1234');
  await button(parent, t('unified.enterMyWorld')).click(); await parent.waitForURL('**/parent/child-mode/today');
  await parent.getByRole('button', { name: t('room.parentExit') }).first().click();
  const exitPin = parent.getByLabel(t('childMode.parentPin'), { exact: true });
  await exitPin.waitFor();
  assert.equal(await exitPin.getAttribute('type'), 'password'); assert.equal(await exitPin.getAttribute('maxlength'), '4');
  await text(parent, t('u02.pinRecovery.lock')).waitFor();
  for (const wrong of ['0000', '0001', '0002', '0003', '0004']) {
    await exitPin.fill(wrong); await button(parent, t('childMode.exit')).click();
    await text(parent, t('childMode.wrongParentPin')).waitFor();
    assert.equal(await exitPin.inputValue(), '');
  }
  await exitPin.fill('2580'); await button(parent, t('childMode.exit')).click();
  await text(parent, t('release.pinLocked')).waitFor();
  assert.ok(parent.url().includes('/parent/child-mode/'), 'locked PIN keeps child mode');
  await button(parent, t('unified.forgotParentPin')).click(); await text(parent, t('unified.forgotParentPinHelp')).waitFor();
  await shot(parent, 'parent-exit-pin-locked-phone');
  await parent.setViewportSize(sizes.tablet); await shot(parent, 'parent-exit-pin-locked-tablet'); await parent.setViewportSize(sizes.phone);
  sql(`update public.parent_pins set locked_until=now()-interval '1 second' where family_id='${f.familyId}';`);
  await exitPin.fill('2580'); await button(parent, t('childMode.exit')).click();
  await parent.waitForURL('**/parent');
  pass('parent_exit_pin_shared_control_lock_and_exit');

  // 11) Family switch/join texts: no "Ailesi ailesinde"; join/switch keeps both families.
  stage = 'family_texts';
  const partnerEmail = 'gina-' + randomUUID() + '@example.invalid', partnerPassword = randomUUID() + 'A!';
  const partner = (await auth('signup', { email: partnerEmail, password: partnerPassword })).body;
  const partnerFamily = randomUUID();
  sql(`insert into public.families(id,name,created_by) values('${partnerFamily}','Demir Ailesi','${partner.user.id}');
       insert into public.family_members(family_id,user_id) values('${partnerFamily}','${partner.user.id}');
       insert into public.children(family_id,name) values('${partnerFamily}','Deniz');`);
  const invite = sql(`select invite_code from public.families where id='${partnerFamily}';`);
  await parent.goto(WEB + '/parent/families'); await button(parent, t('u02.family.tab.join')).click();
  await parent.getByLabel(t('parent.inviteCode'), { exact: true }).fill(invite);
  await button(parent, t('experience.family.preview')).click();
  const joinText = await parent.getByTestId('family-join-impact').innerText();
  assert.ok(joinText.includes(t('c06.family.joinOpens', { name: 'Demir Ailesi' })) && joinText.includes(t('c06.family.joinKeeps', { name: 'Yılmaz Ailesi' })), joinText);
  await shot(parent, 'family-join-impact-phone', 'family-join-impact');
  await button(parent, t('c06.family.joinAction', { name: 'Demir Ailesi' })).click(); await parent.waitForURL('**/parent');
  await parent.goto(WEB + '/parent/families'); await parent.getByTestId('family-current').waitFor();
  await parent.getByRole('button', { name: /^Yılmaz Ailesi/ }).first().click();
  const switchText = await parent.getByTestId('family-switch-impact').innerText();
  assert.ok(switchText.includes('“Demir Ailesi”') && switchText.includes('Deniz') && !/ailesi ailesi/i.test(switchText), switchText);
  await shot(parent, 'family-switch-impact-phone', 'family-switch-impact');
  await parent.setViewportSize(sizes.desktop); await shot(parent, 'family-switch-impact-desktop', 'family-switch-impact'); await parent.setViewportSize(sizes.phone);
  await button(parent, t('c06.family.switchAction', { name: 'Yılmaz Ailesi' })).click(); await parent.waitForURL('**/parent');
  assert.equal(sql(`select family_id from public.active_families where user_id='${f.userId}';`), f.familyId);
  assert.equal(sql(`select count(*) from public.children where family_id in ('${f.familyId}','${partnerFamily}') and archived_at is null;`), '3');
  pass('family_join_and_switch_texts_without_repeated_word');

  // 11b) C13-AUTH-1: a stranger family pairs a waiting tablet; the tablet undoes it with one tap.
  stage = 'device_not_my_family';
  const partnerToken = (await auth('token?grant_type=password', { email: partnerEmail, password: partnerPassword })).body.access_token;
  const stray = await newPage('tablet');
  const code4 = await newCode(stray, 'Oyun odası tableti');
  const strayPreview = await rpc('preview_device_pairing', { p_code: code4 }, partnerToken);
  assert.equal(strayPreview.body?.status, 'ok', JSON.stringify(strayPreview.body));
  await rpc('pair_child_device', { p_code: code4 }, partnerToken).then((r) => assert.ok(/client_update_required/.test(JSON.stringify(r.body)), 'legacy signature refused ' + JSON.stringify(r.body)));
  const strayPair = await rpc('pair_child_device', { p_code: code4, p_preview_token: strayPreview.body.preview_token }, partnerToken);
  assert.equal(strayPair.status, 200, JSON.stringify(strayPair.body));
  await stray.getByTestId('pairing-receipt').waitFor({ timeout: 45000 });
  assert.ok((await stray.getByTestId('pairing-receipt-family').innerText()).includes('Demir Ailesi'));
  await shot(stray, 'device-wrong-family-receipt-tablet', 'pairing-receipt');
  await stray.setViewportSize(sizes.phone); await shot(stray, 'device-wrong-family-receipt-phone', 'pairing-receipt'); await stray.setViewportSize(sizes.tablet);
  await button(stray, t('auth1.device.notMyFamily')).click();
  await stray.getByTestId('pairing-rejected').waitFor();
  assert.equal(sql(`select (d.revoked_at is not null)::text from public.devices d join public.device_pairings p on p.auth_user_id=d.auth_user_id where p.code='${code4}';`), 'true', 'stray pairing revoked');
  assert.equal(stray.url().includes('/child'), false);
  await shot(stray, 'device-not-my-family-done-tablet', 'pairing-rejected');
  const code5 = await newCode(stray);
  assert.notEqual(code5, code4);
  pass('device_not_my_family_undoes_pairing_and_gets_new_code');

  // 11c) C13-AUTH-1: guessing codes in the parent app locks trying for 15 minutes (server-side count).
  stage = 'bruteforce_lock';
  sql(`delete from public.device_pairing_attempts where user_id='${f.userId}' or family_id='${f.familyId}'; delete from public.device_pairing_locks;`);
  await parent.goto(WEB + '/parent/pair-device'); const field = parent.getByLabel(t('auth1.parentPair.codeLabel'), { exact: true }); await field.waitFor();
  for (let i = 0; i < 10; i++) {
    await field.fill('YYYY' + 'ACDEFHJKMN'[i] + 'PRT'); await button(parent, t('c06.pair.show')).click();
    if (i < 9) {
      await parent.getByTestId('pairing-invalid').waitFor();
      await text(parent, t('auth1.parentPair.attemptsLeft', { count: 9 - i })).waitFor();
      if (i === 0) await shot(parent, 'parent-pair-wrong-code-phone', 'pairing-invalid');
    }
  }
  await parent.getByTestId('pairing-locked').waitFor();
  assert.ok((await parent.getByTestId('pairing-locked').innerText()).includes(t('auth1.parentPair.lockedTitle')));
  assert.equal(sql(`select count(*) from public.device_pairing_locks where scope='user' and subject='${f.userId}' and locked_until > now() + interval '14 minutes';`), '1');
  await shot(parent, 'parent-pair-locked-phone', 'pairing-locked');
  await parent.setViewportSize(sizes.tablet); await shot(parent, 'parent-pair-locked-tablet', 'pairing-locked'); await parent.setViewportSize(sizes.phone);
  // While locked, even the right (live) code shows no target and cannot pair.
  await field.fill(code5);
  assert.equal(await button(parent, t('c06.pair.show')).isDisabled(), true, 'show disabled while locked');
  const lockedPreview = await rpc('preview_device_pairing', { p_code: code5 }, await tokenOf(parent));
  assert.equal(lockedPreview.body?.status, 'pairing_locked', JSON.stringify(lockedPreview.body));
  assert.equal(await parent.getByTestId('pairing-target').count(), 0);
  assert.equal(sql(`select (consumed_at is null)::text from public.device_pairings where code='${code5}';`), 'true');
  pass('bruteforce_guessing_locks_preview_for_15_minutes', { lock_seconds: lockedPreview.body?.retry_after_seconds });

  // 12) Password recovery with real GoTrue links (PKCE): other device, used, expired, same device.
  stage = 'recovery';
  const rEmail = 'gina-' + randomUUID() + '@example.invalid', rPassword = randomUUID() + 'A!';
  assert.ok((await auth('signup', { email: rEmail, password: rPassword })).ok);
  const requestReset = async (page) => {
    authSql(`update auth.users set recovery_sent_at=now()-interval '2 minutes' where email='${rEmail}';`);
    await page.goto(WEB + '/sign-in?mode=reset'); await page.getByLabel('E-posta', { exact: true }).fill(rEmail);
    await button(page, t('accountV5.sendReset')).click(); await text(page, t('accountV5.resetSent')).waitFor();
    const token = authSql(`select recovery_token from auth.users where email='${rEmail}';`); assert.ok(token.length > 10, 'recovery token missing');
    return f.url + '/auth/v1/verify?token=' + encodeURIComponent(token) + '&type=recovery&redirect_to=' + encodeURIComponent(WEB + '/reset-password');
  };
  const requester = await newPage('phone'); const other = await newPage('desktop');
  const link1 = await requestReset(requester);
  await other.goto(link1); await other.waitForURL('**/reset-password**');
  const landed = (u) => { const url = new URL(u); const hash = new URLSearchParams(url.hash.slice(1)); return { code: url.searchParams.has('code'), error_code: url.searchParams.get('error_code') ?? hash.get('error_code') }; };
  const otherLanding = landed(other.url());
  await text(other, t('u01.newResetLink')).waitFor();
  assert.equal(await other.getByLabel(t('accountV5.confirmPassword'), { exact: true }).count(), 0, 'other device must not get a password form');
  await shot(other, 'reset-other-device-desktop');
  await other.goto(link1); await other.waitForURL('**/reset-password**'); const reusedLanding = landed(other.url()); await text(other, t('u01.newResetLink')).waitFor();
  assert.equal(await other.getByLabel(t('accountV5.confirmPassword'), { exact: true }).count(), 0);
  await shot(other, 'reset-used-link-desktop');
  assert.equal(otherLanding.code, true, 'other device received a real PKCE code');
  assert.ok(reusedLanding.error_code, 'reused link rejected by Auth');
  pass('reset_link_other_device_and_reused_link_get_new_link_form', { other_device_landing: otherLanding, reused_landing: reusedLanding });
  const link2 = await requestReset(requester);
  authSql(`update auth.users set recovery_sent_at=now()-interval '2 days' where email='${rEmail}';`);
  await requester.goto(link2); await requester.waitForURL('**/reset-password**'); const expiredLanding = landed(requester.url()); await text(requester, t('u01.newResetLink')).waitFor();
  assert.ok(expiredLanding.error_code, 'expired link rejected by Auth');
  assert.equal(await requester.getByLabel(t('accountV5.confirmPassword'), { exact: true }).count(), 0);
  await shot(requester, 'reset-expired-link-phone');
  pass('expired_reset_link_gets_new_link_form', { expired_landing: expiredLanding });
  const link3 = await requestReset(requester);
  await requester.goto(link3); await requester.waitForURL('**/reset-password**');
  const newPassword = randomUUID() + 'B!';
  await requester.getByLabel(t('auth.password'), { exact: true }).fill(newPassword);
  await requester.getByLabel(t('accountV5.confirmPassword'), { exact: true }).fill(newPassword);
  await button(requester, t('common.save')).click(); await text(requester, t('accountV5.passwordChanged')).waitFor();
  assert.ok((await auth('token?grant_type=password', { email: rEmail, password: newPassword })).ok, 'new password works');
  assert.ok(!(await auth('token?grant_type=password', { email: rEmail, password: rPassword })).ok, 'old password refused');
  await shot(requester, 'reset-same-device-done-phone');
  pass('same_device_reset_sets_new_password');

  // 13) Session revocation: signing out everywhere ends the other browser on its next refresh.
  stage = 'session_revoke';
  const s1 = await newPage('phone'); const s2 = await newPage('desktop');
  await signIn(s1); await signIn(s2);
  const s1Token = await tokenOf(s1);
  assert.ok((await auth('logout?scope=global', {}, s1Token)).status < 300);
  await s2.evaluate(() => { const k = Object.keys(localStorage).find((key) => key.endsWith('-auth-token')); const v = JSON.parse(localStorage.getItem(k)); v.expires_at = Math.floor(Date.now() / 1000) - 60; localStorage.setItem(k, JSON.stringify(v)); });
  await s2.goto(WEB + '/parent/menu'); await s2.waitForURL('**/sign-in**', { timeout: 30000 });
  await shot(s2, 'session-revoked-sign-in-desktop');
  pass('revoked_session_returns_to_sign_in_on_refresh');

  for (const page of pages) assert.deepEqual(page.errors, []);
  pass('no_runtime_errors_overflow_raw_keys_or_repeated_family_word');
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-real-auth-rest-realtime', viewports: sizes, results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length }));
  await browser.close();
})().catch(async (e) => {
  console.log('CHECK_FAILED ' + stage + ' ' + String(e.message).slice(0, 1200));
  const dir = process.env.GINA_C06_FAIL_DIR || '/tmp';
  for (const [i, page] of pages.entries()) {
    await page.screenshot({ path: `${dir}/c06-failed-${i}.png`, fullPage: true }).catch(() => {});
    fs.writeFileSync(`${dir}/c06-failed-${i}.txt`, await page.locator('body').innerText().catch(() => '') + '\nURL ' + page.url() + '\nERRORS ' + JSON.stringify(page.errors));
  }
  if (browser) await browser.close();
  process.exitCode = 1;
});
