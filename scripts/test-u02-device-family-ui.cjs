// U02 UI checks against a disposable local Auth/REST/Realtime fixture (synthetic data only).
// Usage: GINA_QA_UI_FIXTURE=<fixture.json> GINA_U02_WEB=http://127.0.0.1:<port> \
//        GINA_QA_PLAYWRIGHT_PATH=<playwright> [GINA_U02_OUT=<dir>] [GINA_U02_FAIL_DIR=<dir>] node scripts/test-u02-device-family-ui.cjs
// D2: pairing is the C13-AUTH-1 flow — 8-character code shown 4+4, parent preview (device + family) →
// confirm with the single-use preview token, and the tablet confirms the receiving family before child mode.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1');
assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const WEB = process.env.GINA_U02_WEB; assert.match(WEB, /^http:\/\/127\.0\.0\.1:\d+$/);
const root = path.resolve(__dirname, '..');
const out = process.env.GINA_U02_OUT ? path.resolve(process.env.GINA_U02_OUT) : root + '/docs/release/u02-2026-11-06'; fs.mkdirSync(out + '/screenshots', { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const t = (key, vars = {}) => { let s = tr[key] ?? key.split('.').reduce((v, k) => v?.[k], tr); assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const results = []; const pass = (check, extra = {}) => { results.push({ check, passed: true, ...extra }); console.log('ok', check); };
let browser, stage = 'setup'; const pages = [];

// Locate this fixture's own disposable database (other agents may run their own in parallel).
const psql = (db, text) => execFileSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8' }).trim();
const candidates = psql('postgres', "select datname from pg_database where datname ~ '^gina_http_[0-9a-f]+_audit$';").split('\n').filter(Boolean);
const db = candidates.find((name) => psql(name, `select count(*) from auth.users where id='${f.userId}';`) === '1');
assert.ok(db, 'fixture database not found');
const sql = (text) => psql(db, text);

async function auth(pathname, body) {
  const res = await fetch(f.url + '/auth/v1/' + pathname, { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.ok(res.ok, pathname + ' ' + res.status); return res.json();
}
async function routeLocal(context) {
  await context.route(f.url + '/**', async (route) => {
    try {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const res = await route.fetch(); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
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
  const text = await page.locator('body').innerText();
  assert.ok(!/\b(u02|c06|auth1|d2|experience|unified)\.[a-zA-Z]/.test(text), name + ': raw i18n key visible');
}
async function signIn(page, email, password) {
  await page.goto(WEB); await page.getByLabel('E-posta', { exact: true }).fill(email); await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await page.waitForURL('**/parent');
}
const button = (page, name) => page.getByRole('button', { name, exact: true });
const text = (page, value) => page.getByText(value, { exact: true }).first();

const CODE = /^[ACDEFHJKMNPRTUVWXY3479]{8}$/;
const grouped = (code) => code.slice(0, 4) + ' ' + code.slice(4);
async function shownCode(page) {
  const shown = (await page.getByTestId('pairing-code').innerText()).trim();
  assert.match(shown, /^[ACDEFHJKMNPRTUVWXY3479]{4} [ACDEFHJKMNPRTUVWXY3479]{4}$/, 'grouped 8-char code');
  return shown.replace(/\s/g, '');
}
async function rpc(name, args, token) {
  const res = await fetch(f.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: f.anon, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  return { status: res.status, body: await res.json().catch(() => null) };
}
function decodeQr(png) {
  const result = execFileSync('swift', [root + '/scripts/u02/decode-qr.swift', png], { encoding: 'utf8', timeout: 180000 }).trim();
  return result.split(' ').slice(1).join(' ');
}

(async () => {
  stage = 'fixture';
  const login = await auth('token?grant_type=password', { email: f.email, password: f.password }); const parentToken = login.access_token;
  const familyName = sql(`select name from public.families where id='${f.familyId}';`);
  // Exactly one active child named Ece with PIN 1234 (set by the fixture); no paired devices yet.
  sql(`update public.devices set revoked_at=now() where family_id='${f.familyId}' and revoked_at is null;
       update public.children set name='Ece', avatar='avatar-default' where id='${f.childId}';
       delete from public.children where family_id='${f.familyId}' and id<>'${f.childId}';
       delete from public.families where name='Eşin ailesi';
       insert into public.active_families values('${f.userId}','${f.familyId}') on conflict(user_id) do update set family_id=excluded.family_id;
       update public.child_pins set failed_count=0, locked_until=null;`);
  assert.equal(sql(`select count(*) from public.children where family_id='${f.familyId}' and archived_at is null;`), '1');
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  // 1) Families: single family -> switch tab explains, join tab separate.
  stage = 'families_single';
  const parent = await newPage('phone'); await signIn(parent, f.email, f.password);
  await parent.goto(WEB + '/parent/families'); await text(parent, t('u02.family.onlyOneTitle')).waitFor();
  await text(parent, t('u02.family.switchExplain')).waitFor();
  await shot(parent, 'families-single-phone');
  pass('single_family_switch_tab_explains_no_merge');

  // 2) Partner created a separate family with their own child -> join shows two-family impact.
  stage = 'families_two';
  const partnerEmail = 'gina-' + randomUUID() + '@example.invalid', partnerPassword = randomUUID() + 'A!';
  const partner = await auth('signup', { email: partnerEmail, password: partnerPassword });
  const partnerFamily = randomUUID();
  sql(`insert into public.families(id,name,created_by) values('${partnerFamily}','Eşin ailesi','${partner.user.id}');
       insert into public.family_members(family_id,user_id) values('${partnerFamily}','${partner.user.id}');
       insert into public.children(family_id,name) values('${partnerFamily}','Ece (eşin profili)');`);
  const invite = sql(`select invite_code from public.families where id='${partnerFamily}';`);
  await button(parent, t('u02.family.tab.join')).click();
  await parent.getByLabel(t('parent.inviteCode'), { exact: true }).fill(invite);
  await button(parent, t('experience.family.preview')).click();
  await parent.getByTestId('family-two-families').waitFor();
  await text(parent, t('u02.family.twoTitle')).waitFor();
  const impact = await parent.getByTestId('family-join-impact').innerText();
  assert.ok(impact.includes(t('u02.family.noMerge')) && impact.includes('Eşin ailesi'));
  assert.ok(!/birleştir(il)?di|birleştirme yapıl/i.test(impact.replace(t('u02.family.noMerge'), '').replace(t('u02.family.twoSeparate'), '')));
  await shot(parent, 'families-join-two-families-phone', 'family-two-families');
  await parent.setViewportSize(sizes.tablet); await shot(parent, 'families-join-two-families-tablet', 'family-two-families');
  await parent.setViewportSize(sizes.desktop); await shot(parent, 'families-join-two-families-desktop', 'family-join-impact');
  await parent.setViewportSize(sizes.phone);
  await button(parent, t('c06.family.joinAction', { name: 'Eşin ailesi' })).click();
  await parent.waitForURL('**/parent');
  assert.equal(sql(`select count(*) from public.family_members where user_id='${f.userId}';`), '2');
  assert.equal(sql(`select count(*) from public.children where family_id='${f.familyId}';`), '1');
  assert.equal(sql(`select count(*) from public.children where family_id='${partnerFamily}';`), '1');
  pass('join_keeps_both_families_and_children_unmerged');

  stage = 'families_switch';
  await parent.goto(WEB + '/parent/families'); await parent.getByTestId('family-current').waitFor();
  assert.ok((await parent.getByTestId('family-current').innerText()).includes('Eşin ailesi'));
  await parent.getByRole('button', { name: new RegExp('^' + familyName) }).first().click();
  await parent.getByTestId('family-switch-impact').waitFor();
  const switchText = await parent.getByTestId('family-switch-impact').innerText();
  assert.ok(switchText.includes('Ece (eşin profili)') && switchText.includes(t('u02.family.devicesStay')));
  await shot(parent, 'families-switch-impact-phone', 'family-switch-impact');
  await parent.setViewportSize(sizes.tablet); await shot(parent, 'families-switch-impact-tablet', 'family-switch-impact'); await parent.setViewportSize(sizes.phone);
  await button(parent, t('c06.family.switchAction', { name: familyName })).click(); await parent.waitForURL('**/parent');
  assert.equal(sql(`select family_id from public.active_families where user_id='${f.userId}';`), f.familyId);
  pass('switch_shows_what_stays_and_returns_to_original_family');

  // 3) Same-phone child mode with ONE child: shared PIN control, wrong PIN, recovery path.
  stage = 'child_mode_single';
  await parent.goto(WEB + '/parent/child-mode'); await parent.getByLabel(t('childV5.pinLabel'), { exact: true }).waitFor();
  await text(parent, t('child.hello', { name: 'Ece' })).waitFor();
  await parent.getByLabel(t('childV5.pinLabel'), { exact: true }).fill('0000');
  await button(parent, t('unified.enterMyWorld')).click(); await text(parent, t('child.wrongPin')).waitFor();
  assert.equal(await parent.getByLabel(t('childV5.pinLabel'), { exact: true }).inputValue(), '');
  await button(parent, t('experience.pin.help')).click(); await text(parent, t('u02.pinRecovery.lock')).waitFor();
  await shot(parent, 'child-mode-single-wrong-pin-recovery-phone');
  pass('child_mode_single_child_same_pin_control_wrong_pin_and_recovery');

  // 4) Device pairing: tablet shows QR + code; QR decodes to the short-lived code only.
  stage = 'device_request';
  const device = await newPage('tablet');
  await device.goto(WEB + '/device/pair'); await button(device, t('unified.pairCodeAction')).waitFor();
  await device.getByLabel(t('unified.deviceName'), { exact: true }).fill('Ortak tablet');
  await shot(device, 'device-pair-start-tablet');
  await button(device, t('unified.pairCodeAction')).click();
  await device.getByTestId('pairing-active').waitFor();
  const qrPng = out + '/screenshots/device-pair-qr-element.png';
  await device.getByTestId('pairing-qr').screenshot({ path: qrPng });
  const link = decodeQr(qrPng);
  const code = new URL(link).searchParams.get('code');
  assert.match(code, CODE); assert.equal(new URL(link).pathname, '/parent/pair-device');
  assert.deepEqual([...new URL(link).searchParams.keys()], ['code']);
  assert.ok(!/Ortak|Ece|example|family/i.test(link), 'QR must not carry personal data');
  assert.equal(await shownCode(device), code);
  assert.ok((await device.getByTestId('pairing-active').innerText()).includes(grouped(code)));
  await shot(device, 'device-pair-qr-tablet');
  await shot(device, 'device-pair-steps-tablet', 'pairing-steps');
  await device.setViewportSize(sizes.phone); await shot(device, 'device-pair-qr-phone', 'pairing-qr');
  await device.setViewportSize(sizes.desktop); await shot(device, 'device-pair-qr-desktop'); await device.setViewportSize(sizes.tablet);
  pass('qr_decodes_to_pairing_link_with_only_code', { qr_payload_shape: '/parent/pair-device?code=<8 chars>' });

  // 5) Parent opens the scanned link: confirmation, then access setup (single child, personal device).
  stage = 'parent_pair';
  assert.equal(new URL(link).origin, WEB);
  await parent.goto(link);
  await text(parent, t('u02.parentPair.fromQr')).waitFor();
  // Preview first: device name + receiving family; nothing is paired yet.
  await parent.getByTestId('pairing-target').waitFor();
  { const target = await parent.getByTestId('pairing-target').innerText(); assert.ok(target.includes('Ortak tablet') && target.includes(familyName), target); }
  assert.equal(sql(`select (consumed_at is null)::text from public.device_pairings where code='${code}';`), 'true', 'not consumed before confirm');
  await shot(parent, 'parent-pair-from-qr-phone', 'pairing-target');
  await button(parent, t('u02.parentPair.confirm')).click();
  await parent.waitForURL('**/parent/device-access**');
  await parent.getByTestId('device-access-summary').waitFor();
  const deviceId = new URL(parent.url()).searchParams.get('deviceId'); assert.match(deviceId, /^[0-9a-f-]{36}$/);
  assert.equal(sql(`select name||'|'||access_mode||'|'||pin_policy from public.devices where id='${deviceId}';`), 'Ortak tablet|selected|required');
  assert.equal(sql(`select count(*) from public.device_pairing_previews where code='${code}' and used_at is not null;`), '1', 'paired with a used preview token');
  pass('parent_previews_then_confirms_pairing_device_locked_until_configured');

  stage = 'draft_preserved';
  await parent.getByRole('radio', { name: new RegExp(t('experience.device.personal')) }).click();
  await parent.getByRole('radio', { name: /Ece/ }).click();
  await text(parent, t('u02.access.unsaved')).waitFor();
  const summary = await parent.getByTestId('device-access-summary').innerText();
  assert.ok(summary.includes(t('u02.access.single')) && summary.includes('Ece') && summary.includes(t('u02.access.pinRequired')));
  await shot(parent, 'device-access-single-unsaved-phone', 'device-access-summary');
  await button(parent, t('common.back')).last().click();
  await text(parent, t('experience.deviceLeaveTitle')).waitFor();
  await shot(parent, 'device-access-leave-guard-phone');
  await button(parent, t('experience.keepEditing')).click();
  assert.ok((await parent.getByTestId('device-access-summary').innerText()).includes('Ece'));
  assert.ok((await parent.getByTestId('device-access-summary').innerText()).includes(t('u02.access.unsaved')));
  pass('unsaved_access_draft_survives_leave_attempt');
  await button(parent, t('common.save')).click(); await text(parent, t('experience.device.saved')).waitFor();
  assert.equal(sql(`select string_agg(c.name,',') from public.device_children dc join public.children c on c.id=dc.child_id where dc.device_id='${deviceId}';`), 'Ece');
  await parent.setViewportSize(sizes.tablet); await shot(parent, 'device-access-single-saved-tablet', 'device-access-summary');
  await parent.setViewportSize(sizes.desktop); await shot(parent, 'device-access-single-saved-desktop'); await parent.setViewportSize(sizes.phone);
  pass('single_child_personal_device_saved');

  // 6) Child device: profile -> wrong PIN -> recovery -> correct PIN.
  stage = 'child_pin';
  // C13-AUTH-1: the waiting tablet names the receiving family before child mode.
  await device.getByTestId('pairing-receipt').waitFor({ timeout: 45000 });
  assert.ok((await device.getByTestId('pairing-receipt-family').innerText()).includes(familyName));
  await button(device, t('auth1.device.continue')).click();
  await device.waitForURL('**/child', { timeout: 40000 });
  await device.getByText('Ece', { exact: true }).first().click();
  await device.waitForURL('**/child/pin**');
  await device.getByLabel(t('childV5.pinLabel'), { exact: true }).fill('0000');
  await button(device, t('unified.enterMyWorld')).click(); await text(device, t('child.wrongPin')).waitFor();
  await shot(device, 'child-pin-wrong-tablet');
  await button(device, t('experience.pin.help')).click(); await text(device, t('u02.pinRecovery.child.step2')).waitFor();
  await shot(device, 'child-pin-recovery-tablet');
  await device.setViewportSize(sizes.phone); await shot(device, 'child-pin-recovery-phone'); await device.setViewportSize(sizes.tablet);
  await device.getByLabel(t('childV5.pinLabel'), { exact: true }).fill('1234');
  await button(device, t('unified.enterMyWorld')).click(); await device.waitForURL('**/child/today');
  pass('child_device_wrong_pin_recovery_then_correct_pin');

  // 7) Multi-child shared device: second child without PIN; inline shared PIN control.
  stage = 'multi_child';
  sql(`insert into public.children(family_id,name,sort_order) values('${f.familyId}','Can',1);`);
  await parent.goto(WEB + '/parent/device-access?deviceId=' + deviceId); await parent.getByTestId('device-access-summary').waitFor();
  await parent.getByRole('radio', { name: new RegExp(t('experience.device.shared')) }).click();
  await parent.getByRole('checkbox', { name: /Can/ }).click();
  await text(parent, t('u02.access.pinMissing', { names: 'Can' })).waitFor();
  assert.ok((await parent.getByTestId('device-access-summary').innerText()).includes(t('u02.access.shared')));
  await shot(parent, 'device-access-shared-missing-pin-phone', 'device-access-summary');
  await parent.setViewportSize(sizes.desktop); await shot(parent, 'device-access-shared-missing-pin-desktop'); await parent.setViewportSize(sizes.phone);
  await parent.getByLabel(t('parentV5.childPinLabel', { name: 'Can' }), { exact: true }).fill('2468');
  await parent.getByLabel(t('experience.confirmPin'), { exact: true }).fill('2469');
  await text(parent, t('experience.pinMismatch')).waitFor();
  await shot(parent, 'pin-setup-mismatch-phone');
  await parent.getByLabel(t('experience.confirmPin'), { exact: true }).fill('2468');
  await button(parent, t('parent.savePin')).click();
  // Saved PIN refreshes access data; the inline setup (and its saved note) may unmount right away.
  await text(parent, t('u02.access.pinMissing', { names: 'Can' })).waitFor({ state: 'hidden' });
  assert.equal(sql(`select count(*) from public.child_pins p join public.children c on c.id=p.child_id where c.name='Can' and c.family_id='${f.familyId}';`), '1');
  // The saved PIN refreshes the access query; the unsaved device draft (Ece + Can, shared) must remain.
  await parent.waitForTimeout(1500);
  { const kept = await parent.getByTestId('device-access-summary').innerText(); assert.ok(kept.includes('Ece, Can') && kept.includes(t('u02.access.shared')), kept); }
  await button(parent, t('common.save')).click(); await text(parent, t('experience.device.saved')).waitFor();
  assert.equal(sql(`select string_agg(c.name,',' order by c.name) from public.device_children dc join public.children c on c.id=dc.child_id where dc.device_id='${deviceId}';`), 'Can,Ece');
  pass('multi_child_shared_device_inline_pin_and_draft_kept');

  stage = 'child_mode_multi';
  await parent.goto(WEB + '/parent/child-mode'); await text(parent, 'Can').waitFor();
  await text(parent, t('d2.childMode.intro')).waitFor();
  await shot(parent, 'child-mode-multi-picker-phone');
  await parent.getByRole('button', { name: /Can/ }).first().click();
  await parent.getByLabel(t('childV5.pinLabel'), { exact: true }).waitFor();
  await shot(parent, 'child-mode-multi-pin-phone');
  pass('child_mode_multi_child_picker_then_shared_pin_control');

  // 8) Expired code: device countdown ends -> refresh; parent typing the old code gets the expiry guidance.
  stage = 'expired';
  const device2 = await newPage('phone');
  await device2.clock.install();
  await device2.goto(WEB + '/device/pair'); await button(device2, t('unified.pairCodeAction')).click();
  await device2.getByTestId('pairing-active').waitFor();
  const oldCode = await shownCode(device2);
  sql(`update public.device_pairings set expires_at=now()-interval '1 second' where code='${oldCode}';`);
  await device2.clock.fastForward('10:05');
  await device2.getByTestId('pairing-expired').waitFor();
  assert.equal(await device2.getByTestId('pairing-qr').count(), 0);
  await shot(device2, 'device-pair-expired-phone', 'pairing-expired');
  await parent.goto(WEB + '/parent/pair-device'); await parent.getByLabel(t('auth1.parentPair.codeLabel'), { exact: true }).fill(oldCode);
  await button(parent, t('c06.pair.show')).click(); await text(parent, t('u02.parentPair.expiredTitle')).waitFor();
  assert.equal(await parent.getByTestId('pairing-target').count(), 0);
  await shot(parent, 'parent-pair-expired-code-phone');
  await button(device2, t('accountV5.newCode')).click(); await device2.getByTestId('pairing-active').waitFor();
  const newCode = await shownCode(device2);
  assert.notEqual(newCode, oldCode);
  assert.equal(sql(`select count(*) from public.device_pairings where code='${oldCode}';`), '0');
  pass('expired_code_hides_qr_refreshes_and_parent_gets_guidance');

  // 9) Access revoked while the child device session is open.
  const revokeDevice = async (id) => {
    const res = await fetch(f.url + '/rest/v1/rpc/revoke_device', { method: 'POST', headers: { apikey: f.anon, authorization: 'Bearer ' + parentToken, 'content-type': 'application/json' }, body: JSON.stringify({ p_device_id: id }) });
    assert.ok(res.ok, 'revoke ' + res.status);
  };
  // 9a) PIN screen open when the parent revokes: the open session must leave for pairing.
  //     (The app's own background checks win the race against a PIN submit, so the PIN-screen
  //     revoked card is a fallback that this run could not reach; see README limits.)
  stage = 'revoke_on_pin_screen';
  await device.goto(WEB + '/child'); await device.getByText('Ece', { exact: true }).first().click(); await device.waitForURL('**/child/pin**');
  let started = Date.now();
  await revokeDevice(deviceId);
  await device.waitForURL('**/device/pair**', { timeout: 45000 });
  await button(device, t('unified.pairCodeAction')).waitFor();
  await shot(device, 'device-pair-after-revoke-tablet');
  pass('revoked_on_open_pin_screen_returns_to_pairing', { seconds: Math.round((Date.now() - started) / 1000) });

  // 9b) Child already inside (phone, no PIN device): the open session leaves within the layout's check interval.
  stage = 'revoke_inside_child_world';
  const deviceId2 = await (async () => {
    const legacy = await rpc('pair_child_device', { p_code: newCode }, parentToken);
    assert.ok(/client_update_required/.test(JSON.stringify(legacy.body)), 'token-less signature refused ' + JSON.stringify(legacy.body));
    const preview = await rpc('preview_device_pairing', { p_code: newCode }, parentToken);
    assert.equal(preview.body?.status, 'ok', JSON.stringify(preview.body));
    const res = await rpc('pair_child_device', { p_code: newCode, p_preview_token: preview.body.preview_token }, parentToken);
    assert.equal(res.status, 200, 'pair2 ' + JSON.stringify(res.body)); return res.body;
  })();
  const cfg = await fetch(f.url + '/rest/v1/rpc/configure_child_device', { method: 'POST', headers: { apikey: f.anon, authorization: 'Bearer ' + parentToken, 'content-type': 'application/json' }, body: JSON.stringify({ p_device_id: deviceId2, p_name: 'Telefon', p_child_ids: [f.childId], p_pin_required: false }) });
  assert.ok(cfg.ok, 'configure2 ' + cfg.status);
  await device2.clock.resume().catch(() => {});
  await device2.getByTestId('pairing-receipt').waitFor({ timeout: 60000 });
  await button(device2, t('auth1.device.continue')).click();
  await device2.waitForURL('**/child', { timeout: 60000 });
  await device2.getByText('Ece', { exact: true }).first().click();
  await device2.waitForURL('**/child/today', { timeout: 30000 });
  started = Date.now();
  await revokeDevice(deviceId2);
  await device2.clock.fastForward('00:35').catch(() => {});
  await device2.waitForURL('**/device/pair**', { timeout: 70000 });
  await button(device2, t('unified.pairCodeAction')).waitFor();
  await shot(device2, 'device-after-revoke-open-session-phone');
  pass('revoked_while_inside_child_world_returns_to_pairing', { seconds: Math.round((Date.now() - started) / 1000) });

  for (const page of pages) assert.deepEqual(page.errors, []);
  pass('no_runtime_errors_or_horizontal_overflow');
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-real-auth-rest-realtime', viewports: sizes, results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length }));
  await browser.close();
})().catch(async (e) => {
  console.log('CHECK_FAILED ' + stage + ' ' + String(e.message).slice(0, 900));
  for (const [i, page] of pages.entries()) {
    const failDir = process.env.GINA_U02_FAIL_DIR || '/tmp';
    await page.screenshot({ path: `${failDir}/gina-u02-failed-${i}.png`, fullPage: true }).catch(() => {});
    fs.writeFileSync(`${failDir}/gina-u02-failed-${i}.txt`, await page.locator('body').innerText().catch(() => '') + '\nURL ' + page.url() + '\nERRORS ' + JSON.stringify(page.errors));
  }
  if (browser) await browser.close();
  process.exitCode = 1;
});
