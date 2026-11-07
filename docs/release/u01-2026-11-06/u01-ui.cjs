const loopbackFixtureFetch = require('../../../scripts/loopback-fixture-fetch.cjs');
// U01 giriş/kurtarma UI kontrolleri. Yalnız test-isolated-services.py --ui-hold fixture'ı ve bu checkout'un
// web exportuyla çalıştır: GINA_QA_UI_FIXTURE=<yol> GINA_QA_WEB_DIR=<export> node docs/release/u01-2026-11-06/u01-ui.cjs
// Sentetik example.invalid hesapları kullanır; şifre/anahtar rapora yazılmaz.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1');
assert.match(f.email, /@example\.invalid$/);
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs/release/u01-2026-11-06');
const WEB = process.env.GINA_QA_WEB_DIR;
const tr = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/core/src/i18n/tr.json')));
const PHONE = { width: 390, height: 844 }, DESKTOP = { width: 1280, height: 800 };
const checks = {};
const check = (name, ok) => { checks[name] = !!ok; if (!ok) console.error('FAIL', name); };

function serve() {
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.join(WEB, clean);
      if (!file.startsWith(WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        const html = path.join(WEB, clean + '.html');
        file = fs.existsSync(html) ? html : path.join(WEB, 'index.html');
      }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(server));
  });
}
async function rest(p, token, body) {
  const res = await loopbackFixtureFetch(f.url + '/rest/v1/' + p, { method: body ? 'POST' : 'GET', headers: { apikey: f.anon, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(p + ' ' + res.status);
  return res.json();
}
async function token(email, password) {
  const res = await loopbackFixtureFetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.ok(res.ok, 'login ' + res.status);
  return (await res.json()).access_token;
}

(async () => {
  const server = await serve();
  const APP = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: process.env.GINA_QA_BROWSER_CHANNEL || 'chrome', headless: true });
  const errors = [];
  async function open(viewport) {
    const context = await browser.newContext({ viewport, locale: 'tr-TR' });
    await context.route(f.url + '/**', async route => {
      try {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        const res = await route.fetch({ maxRedirects: 0 });
        await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
      } catch { await route.fulfill({ status: 503, body: 'unavailable' }); }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
    return { context, page };
  }
  const shot = async (page, name) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
    check(name + '_no_horizontal_overflow', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    const body = await page.locator('body').innerText();
    check(name + '_no_raw_i18n_key', !/\bu01\.[a-zA-Z]+/.test(body));
  };
  const text = async page => page.locator('body').innerText();
  const stamp = Date.now().toString(16);
  const pw = 'U01-' + stamp + '-Sentetik!';

  for (const [label, viewport] of [['phone', PHONE], ['desktop', DESKTOP]]) {
    const { context, page } = await open(viewport);
    // 1) Sign-in: intent tabs, social reason, child device alternative.
    await page.goto(APP + '/');
    await page.waitForURL('**/sign-in**');
    await page.getByRole('button', { name: tr['u01.intentSignIn'], pressed: true }).waitFor();
    let body = await text(page);
    check(label + '_intent_tabs', (await page.getByRole('group', { name: tr['u01.intentLabel'] }).getByRole('button').count()) === 2);
    check(label + '_social_disabled_reason', await page.getByText(tr['u01.socialNotEnabled']).waitFor({ timeout: 10000 }).then(() => true, () => false));
    check(label + '_child_device_alternative', body.includes(tr['unified.childDeviceTitle']) && body.includes(tr['unified.connectDevice']));
    await shot(page, `sign-in-${label}`);
    // 2) Wrong password.
    await page.getByLabel(tr['auth.email'], { exact: true }).fill(f.email);
    await page.getByLabel(tr['auth.password'], { exact: true }).fill('yanlis-sifre-123');
    await page.getByRole('button', { name: tr['auth.signIn'], exact: true }).click();
    await page.getByText(tr['auth.invalidLogin']).waitFor();
    check(label + '_wrong_password_message', true);
    check(label + '_wrong_password_offers_reset', (await page.getByRole('button', { name: tr['accountV5.forgot'] }).count()) === 1);
    await shot(page, `sign-in-wrong-password-${label}`);
    // 3) Sign-up intent: a single adult statement.
    await page.getByRole('button', { name: tr['u01.intentSignUp'] }).click();
    body = await text(page);
    check(label + '_signup_single_adult_switch', (await page.getByRole('switch', { name: tr['accountV5.adult'] }).count()) === 1 && (await page.getByRole('switch', { name: tr['experience.social.adult'] }).count()) === 0);
    check(label + '_signup_child_device_alternative', body.includes(tr['unified.childDeviceTitle']));
    check(label + '_signup_disabled_reason', body.includes(tr['u01.adultRequired']));
    await shot(page, `sign-up-${label}`);
    const email = `gina-u01-${label}-${stamp}@example.invalid`;
    await page.getByLabel(tr['auth.email'], { exact: true }).fill(email);
    await page.getByLabel(tr['auth.password'], { exact: true }).fill(pw);
    await page.getByRole('switch', { name: tr['accountV5.adult'] }).click();
    await page.getByRole('button', { name: tr['auth.signUp'], exact: true }).click();
    // 4) Family: intent first, deletion not a main action, neutral placeholder.
    await page.waitForURL('**/family**', { timeout: 30000 });
    await page.getByText(tr['u01.familyIntentTitle']).waitFor();
    body = await text(page);
    check(label + '_family_intent_first', body.includes(tr['u01.familyCreateTitle']) && body.includes(tr['u01.familyJoinTitle']) && !body.includes(tr['experience.family.joinTitle']));
    check(label + '_family_deletion_collapsed', !body.includes(tr['accountV5.deleteNow']) && body.includes(tr['u01.showDeletion']));
    await shot(page, `family-intent-${label}`);
    if (label === 'phone') {
      // Join intent: invite preview with the fixture family's real code.
      await page.getByText(tr['u01.familyJoinTitle']).first().click();
      const invite = (await rest('families?select=invite_code&id=eq.' + f.familyId, await token(f.email, f.password)))[0].invite_code;
      await page.getByLabel(tr['parent.inviteCode']).fill('00000000');
      await page.getByRole('button', { name: tr['experience.family.preview'] }).click();
      await page.waitForTimeout(1500);
      await shot(page, 'family-join-invalid-phone');
      check('phone_join_invalid_code_message', (await text(page)).includes(tr['experience.errors.invalid_invite_code'] ?? tr['unified.errorCode']) || (await page.getByRole('alert').count()) > 0);
      await page.getByLabel(tr['parent.inviteCode']).fill(invite);
      await page.getByRole('button', { name: tr['experience.family.preview'] }).click();
      await page.getByRole('button', { name: tr['experience.family.useThis'] }).waitFor();
      await shot(page, 'family-join-preview-phone');
      await page.getByRole('button', { name: tr['experience.family.useThis'] }).click();
      await page.waitForURL('**/parent**', { timeout: 30000 });
      check('phone_join_family_reaches_parent', /\/parent/.test(page.url()));
      await shot(page, 'family-joined-phone');
    } else {
      await page.getByText(tr['u01.familyCreateTitle']).first().click();
      const name = page.getByLabel(tr['family.name']);
      check('desktop_family_placeholder_neutral', (await name.getAttribute('placeholder')) === tr['u01.familyNamePlaceholder'] && !/Çevik/.test(tr['u01.familyNamePlaceholder']));
      await shot(page, 'family-create-desktop');
      await name.fill('U01 Sentetik Aile');
      await page.getByRole('button', { name: tr['auth.createFamily'] }).click();
      await page.waitForURL('**/parent**', { timeout: 30000 });
      check('desktop_create_family_reaches_parent', /\/parent/.test(page.url()));
    }
    await context.close();
  }

  // 5) Expired / cancelled / other-device returns and in-place resend (phone).
  {
    const { context, page } = await open(PHONE);
    await page.goto(APP + '/auth-callback?error=access_denied&error_code=otp_expired');
    await page.getByText(tr['u01.linkExpired']).waitFor();
    check('callback_expired_offers_resend', (await page.getByRole('button', { name: tr['u01.resendSignup'] }).count()) === 1);
    await page.getByLabel(tr['auth.email'], { exact: true }).fill(`gina-u01-resend-${stamp}@example.invalid`);
    await page.getByRole('button', { name: tr['u01.resendSignup'] }).click();
    await page.waitForTimeout(2500);
    const resendBody = await text(page);
    checks.callback_resend_result = resendBody.includes(tr['u01.resendSent']) ? 'sent' : 'error_shown:' + (await page.getByRole('alert').allInnerTexts()).join('|').slice(0, 120);
    await shot(page, 'callback-expired-phone');
    await page.goto(APP + '/auth-callback?error=access_denied&error_description=user+cancelled');
    await page.getByText(tr['u01.cancelled']).waitFor();
    check('callback_cancelled_distinct', (await text(page)).includes(tr['u01.cancelledTitle']) && !(await text(page)).includes(tr['u01.linkExpired']));
    await shot(page, 'callback-cancelled-phone');
    await page.getByRole('button', { name: tr['u01.backToSignIn'] }).click();
    await page.waitForURL('**/sign-in**');
    check('callback_cancelled_returns_to_usable_sign_in', await page.getByRole('button', { name: tr['auth.signIn'], exact: true }).waitFor({ timeout: 10000 }).then(() => true, () => false));
    await page.goto(APP + '/auth-callback?code=00000000-0000-4000-8000-000000000000');
    await page.waitForTimeout(4000);
    const otherBody = await text(page);
    check('callback_foreign_code_not_infinite_loading', otherBody.includes(tr['u01.otherDevice']) || otherBody.includes(tr['u01.linkExpired']) || otherBody.includes(tr['experience.social.failed']));
    await shot(page, 'callback-other-device-phone');
    await page.goto(APP + '/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    await page.getByText(tr['accountV5.resetExpired']).waitFor();
    check('reset_expired_inline_request', (await page.getByRole('button', { name: tr['accountV5.sendReset'] }).count()) === 1);
    await page.getByLabel(tr['auth.email'], { exact: true }).fill(f.email);
    await page.getByRole('button', { name: tr['accountV5.sendReset'] }).click();
    await page.waitForTimeout(2500);
    checks.reset_resend_result = await page.getByText(tr['accountV5.resetSent']).waitFor({ timeout: 10000 }).then(() => 'sent', async () => 'error_shown:' + (await page.getByRole('alert').allInnerTexts()).join('|').slice(0, 120));
    await shot(page, 'reset-expired-phone');
    await page.goto(APP + '/#error=access_denied&error_code=otp_expired');
    await page.waitForURL('**/sign-in**');
    await page.getByText(tr['u01.linkExpired']).waitFor();
    check('root_expired_link_explained_on_sign_in', (await page.getByRole('button', { name: tr['u01.resendPrompt'] }).count()) === 1);
    await shot(page, 'root-expired-link-phone');
    await page.goto(APP + '/sign-in?reason=session_expired');
    await page.getByText(tr['u01.sessionExpired']).waitFor();
    check('session_expired_notice', true);
    await shot(page, 'session-expired-phone');
    await page.goto(APP + '/sign-in?mode=reset&from=admin');
    await page.getByText(tr['u01.adminResetHelp']).waitFor();
    check('admin_reset_return_help', true);
    await shot(page, 'reset-from-admin-phone');
    // Offline sign-in.
    await context.route(f.url + '/auth/**', route => route.abort('internetdisconnected'));
    await page.goto(APP + '/sign-in');
    await page.getByLabel(tr['auth.email'], { exact: true }).fill(f.email);
    await page.getByLabel(tr['auth.password'], { exact: true }).fill('herhangi-bir-sifre');
    await page.getByRole('button', { name: tr['auth.signIn'], exact: true }).click();
    await page.waitForTimeout(6000);
    check('offline_sign_in_network_message', (await text(page)).includes(tr['release.networkError']));
    await shot(page, 'sign-in-offline-phone');
    await context.close();
  }

  // 6) Child lock: URL, back key and OAuth return do not reach sign-in/reset/callback or parent screens.
  {
    const { context, page } = await open(PHONE);
    await page.goto(APP + '/sign-in');
    await page.getByLabel(tr['auth.email'], { exact: true }).fill(f.email);
    await page.getByLabel(tr['auth.password'], { exact: true }).fill(f.password);
    await page.getByRole('button', { name: tr['auth.signIn'], exact: true }).click();
    await page.waitForURL('**/parent**', { timeout: 30000 });
    // Same storage write the child-mode screen performs after the parent picks a child.
    await page.evaluate(([u, c]) => localStorage.setItem('gina-child-mode:' + u, JSON.stringify({ id: c, name: 'Sentetik' })), [f.userId, f.childId]);
    await page.goto(APP + '/parent/child-mode');
    await page.waitForTimeout(3000);
    const lockedUrl = page.url();
    for (const target of ['/sign-in', '/sign-in?mode=up', '/auth-callback?code=00000000-0000-4000-8000-000000000000', '/reset-password', '/family', '/', '/parent/menu']) {
      await page.goto(APP + target);
      await page.waitForTimeout(2500);
      const url = new URL(page.url());
      const body = await text(page);
      const escaped = /\/(sign-in|auth-callback|reset-password|family)$/.test(url.pathname) || url.pathname === '/parent/menu' || body.includes(tr['unified.parentLogin']);
      check('child_lock_url_' + target.replace(/[^a-z]+/gi, '_'), !escaped && /child-mode/.test(url.pathname));
    }
    await shot(page, 'child-lock-after-url-phone');
    await page.goBack(); await page.waitForTimeout(1500);
    await page.goBack(); await page.waitForTimeout(1500);
    const back = new URL(page.url());
    check('child_lock_back_key', /child-mode/.test(back.pathname));
    await shot(page, 'child-lock-after-back-phone');
    checks.child_lock_start_url = new URL(lockedUrl).pathname;
    await context.close();
  }

  checks.page_errors = errors.length;
  fs.writeFileSync(path.join(OUT, 'ui-checks.json'), JSON.stringify(checks, null, 2) + '\n');
  console.log(JSON.stringify(checks, null, 2));
  await browser.close();
  server.close();
  const failed = Object.entries(checks).filter(([, v]) => v === false);
  process.exitCode = failed.length ? 1 : 0;
})().catch(e => { console.error('stage error', e.message.slice(0, 400)); fs.writeFileSync(path.join(OUT, 'ui-checks.json'), JSON.stringify({ ...checks, stage_error: e.message.slice(0, 200) }, null, 2) + '\n'); process.exit(1); });
