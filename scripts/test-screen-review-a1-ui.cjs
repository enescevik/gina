// Q00 A1 (auth/veli/aile/ayarlar) after-fix UI checks. Run only with the disposable test-isolated-services.py --ui-hold fixture and a web export of this checkout served on GINA_QA_WEB_URL (default http://127.0.0.1:8189).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync('/tmp/gina-experience-ui-private.json'));
assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
assert.equal(new URL(f.url).hostname, '127.0.0.1');
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs/release/experience-review/a1');
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.GINA_QA_WEB_URL || 'http://127.0.0.1:8189';
const VIEWPORTS = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const tr = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/core/src/i18n/tr.json')));
const t = new Proxy(tr, { get: (obj, key) => obj[key] ?? String(key).split('.').reduce((v, k) => v?.[k], obj) });

async function api(path, body, token) {
  const res = await fetch(f.url + '/rest/v1/' + path, { method: body ? 'POST' : 'GET', headers: { apikey: f.anon, authorization: 'Bearer ' + token, 'content-type': 'application/json', prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(path + ' ' + res.status + ' ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}
async function login(email = f.email, password = f.password) {
  const res = await fetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.ok(res.ok, 'login ' + res.status);
  return (await res.json()).access_token;
}
async function openBrowser(viewport = VIEWPORTS.phone, opts = {}) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport, locale: 'tr-TR', reducedMotion: opts.reducedMotion || 'no-preference', ...(opts.context || {}) });
  await context.route(f.url + '/**', async route => {
    try {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const res = await route.fetch();
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
    } catch { await route.fulfill({ status: 503, body: 'Local fixture unavailable' }); }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  return { browser, context, page, errors };
}
async function uiLogin(page, email = f.email, password = f.password) {
  await page.goto(APP + '/');
  await page.waitForTimeout(1500);
  if (/\/parent/.test(page.url())) return;
  await page.getByLabel('E-posta', { exact: true }).fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.waitForURL('**/parent', { timeout: 30000 });
}
const findings = [];
async function shot(page, name, note) {
  await page.waitForTimeout(400);
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, fullPage: !!note?.fullPage });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  const text = await page.locator('body').innerText();
  const unresolved = text.match(/\b[a-zA-Z]+\.[a-zA-Z]+\.[a-zA-Z.]+\b/g)?.filter(k => /^[a-z]+[A-Z0-9]?[a-zA-Z0-9]*\.[a-zA-Z]+/.test(k) && k in flatKeys) ?? [];
  findings.push({ name, overflow, unresolved, ...note });
  return { overflow, text, unresolved };
}
const flatKeys = {};
(function flat(o, p) { for (const [k, v] of Object.entries(o)) { const key = p ? p + '.' + k : k; if (v && typeof v === 'object') flat(v, key); else flatKeys[key] = true; } })(tr, '');
function report() {}


const results = [];
const check = (name, pass, detail = '') => { results.push({ check: name, passed: !!pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const dump = async (page, n = 30) => (await page.locator('body').innerText()).split('\n').slice(0, n).join('\n');
(async () => {
  const { browser, page, context, errors } = await openBrowser(VIEWPORTS.phone);
  // 1-2 sign-in keyboard
  await page.goto(APP + '/'); await page.getByRole('button', { name: 'Giriş yap', exact: true }).waitFor();
  const order = [];
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const e = document.activeElement; return (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24); })); }
  check('toggle_switch_not_in_tab_order', !order.includes('INPUT'), order.join(' → '));
  await page.getByLabel('E-posta', { exact: true }).fill(f.email); await page.getByLabel('Şifre', { exact: true }).focus(); await page.keyboard.type(f.password); await page.keyboard.press('Enter');
  await page.waitForURL('**/parent', { timeout: 20000 }).catch(() => {});
  check('enter_submits_sign_in', page.url().endsWith('/parent'), page.url());
  await page.waitForTimeout(2500); await shot(page, 'after-home-phone');
  // 3 bell label
  check('home_bell_labelled_as_inbox', await page.getByRole('button', { name: 'Duyurular', exact: true }).count() === 1);
  // 4 grades home button
  await page.goto(APP + '/parent/grades'); await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Ana sayfa', exact: true }).last().click(); await page.waitForTimeout(1500);
  check('grades_home_button_goes_home', page.url().endsWith('/parent'), page.url());
  // 5 families help text
  await page.goto(APP + '/parent/families'); await page.waitForTimeout(2500);
  check('families_invite_path_matches_menu', (await page.locator('body').innerText()).includes('Ayarlar → Ailem → “Diğer ebeveyni davet edin”'));
  await shot(page, 'after-families-phone');
  // 6 callback error title
  await page.goto(APP + '/auth-callback?error=access_denied'); await page.waitForTimeout(1500);
  check('callback_error_title_not_opening', !(await page.locator('body').innerText()).includes('Hesabınız açılıyor'));
  await shot(page, 'after-auth-callback-error-phone');
  // 8 device access summary without a selected child
  const c2 = await browser.newContext({ viewport: VIEWPORTS.phone, locale: 'tr-TR' });
  await c2.route(f.url + '/**', async route => { try { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); const res = await route.fetch(); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } }); } catch { await route.fulfill({ status: 503 }); } });
  const dev = await c2.newPage(); await dev.goto(APP + '/device/pair'); await dev.waitForTimeout(3000);
  await dev.getByLabel('Bu cihazın adı', { exact: true }).fill('Deneme tableti');
  await dev.getByRole('button', { name: 'Eşleştirme kodu oluştur', exact: true }).click(); await dev.waitForTimeout(2500);
  const code = (await dev.locator('body').innerText()).match(/\b\d{6}\b/)?.[0];
  await uiLogin(page); await page.goto(APP + '/parent/menu?section=devices'); await page.waitForTimeout(2000);
  await page.getByLabel('Çocuk cihazındaki 6 haneli kod', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Cihazı bağla', exact: true }).last().click(); await page.waitForTimeout(3500);
  let text = await page.locator('body').innerText();
  check('device_summary_no_child_sentence', text.includes('Henüz çocuk seçilmedi') && !text.includes('Henüz çocuk seçilmedi bu cihaz'), text.split('\n').find(l => l.includes('Henüz')) || '');
  await shot(page, 'after-device-access-no-child-phone');
  await page.getByRole('checkbox', { name: 'Synthetic child' }).or(page.getByRole('radio', { name: 'Synthetic child' })).first().click(); await page.waitForTimeout(500);
  text = await page.locator('body').innerText();
  check('device_summary_with_child_sentence', /Synthetic child bu cihazı/.test(text));
  await shot(page, 'after-device-access-child-phone');
  await c2.close();
  // 7 new user → empty home → wizard auto-open → saved feedback
  await page.goto(APP + '/parent/menu?section=account'); await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click(); await page.waitForTimeout(2500);
  const email = `gina-a1-after-${Date.now()}@example.invalid`, password = 'Deneme-Sifre-2026!';
  await page.goto(APP + '/'); await page.getByRole('button', { name: 'Kayıt ol', exact: true }).click();
  await page.getByLabel('E-posta', { exact: true }).fill(email); await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('switch', { name: /18 yaşını/ }).click(); await page.getByRole('button', { name: 'Kayıt ol', exact: true }).first().click();
  await page.waitForURL('**/family', { timeout: 20000 }); await page.waitForTimeout(1000);
  await page.getByLabel('Aile adı', { exact: true }).fill('A1 Sonra Ailesi');
  await page.getByRole('button', { name: 'Yeni aile oluştur', exact: true }).last().click();
  await page.waitForURL('**/parent', { timeout: 30000 }); await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Çocuk ekle', exact: true }).first().click(); await page.waitForTimeout(2500);
  text = await page.locator('body').innerText();
  check('empty_home_cta_opens_wizard_directly', page.url().includes('/parent/menu') && text.includes('1 / 4'), page.url());
  await shot(page, 'after-empty-home-cta-wizard-phone');
  await page.getByLabel('Adı veya takma adı', { exact: true }).fill('Ela');
  await page.getByRole('button', { name: 'Devam et', exact: true }).click(); await page.waitForTimeout(600);
  await page.getByLabel('Doğum yılı', { exact: true }).fill('2018'); await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Devam et', exact: true }).click(); await page.waitForTimeout(600);
  await page.getByRole('button', { name: /yıldız/ }).nth(0).click();
  await page.getByRole('button', { name: 'Devam et', exact: true }).click(); await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Kaydet', exact: true }).last().click(); await page.waitForTimeout(3500);
  text = await page.locator('body').innerText();
  check('child_saved_feedback_and_next_steps', text.includes('Çocuk profili eklendi') && await page.getByRole('button', { name: 'Çocuk cihazları', exact: true }).count() >= 1, text.split('\n').slice(8, 14).join(' | '));
  await shot(page, 'after-child-saved-feedback-phone');
  await page.getByRole('button', { name: 'Ana sayfa', exact: true }).last().click(); await page.waitForTimeout(2500);
  check('saved_feedback_home_button', page.url().endsWith('/parent'), page.url());
  await shot(page, 'after-home-one-child-phone');
    check('no_runtime_errors', errors.filter(e => !/Failed to load resource/.test(e)).length === 0, errors.slice(0, 3).join(' ; '));
  fs.writeFileSync(path.join(OUT, 'after-checks.json'), JSON.stringify({ environment: 'disposable-local-real-auth-rest-realtime', results }, null, 2) + '\n');
  report('s08.json');
  await browser.close();
  process.exitCode = results.every(r => r.passed) ? 0 : 1;
})().catch(e => { console.log('FAILED', e.message); process.exit(1); });
