// H05 kabul (Playwright, gerçek izole Auth/REST + expo web export). Yalnız
// test-isolated-services.py --ui-hold'un geçici sentetik fixture'ı (loopback) kabul edilir.
// Ortam: GINA_QA_UI_FIXTURE, GINA_QA_WEB, GINA_QA_WEB_BACKEND, GINA_QA_WEB_ANON, GINA_QA_PLAYWRIGHT_PATH.
// Kontrol: Paketler ekranındaki AI ayrı onay açıklaması TR ve EN'de görünür; 390×844 ve 768×1024'te
// yatay taşma yok, metin görünür alanın içinde, yazı boyutu ≥14 px, çevrilmemiş anahtar yok.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const tr = JSON.parse(fs.readFileSync(__dirname + '/../../../../packages/core/src/i18n/tr.json'))['subscription.aiConsentNote'];
const en = JSON.parse(fs.readFileSync(__dirname + '/../../../../packages/core/src/i18n/en.json'))['subscription.aiConsentNote'];
const out = __dirname; const results = []; let browser, stage = 'setup';
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 } };
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail === undefined ? {} : { detail }) }); console.error('ok ' + check); };

async function run(locale, expected, login) {
  const c = await browser.newContext({ viewport: sizes.phone, locale });
  await c.route(backend + '/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const headers = { ...req.headers() };
    if (headers.apikey === placeholderAnon) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + placeholderAnon) headers.authorization = 'Bearer ' + f.anon;
    try {
      const res = await route.fetch({ url: f.url + req.url().slice(backend.length), headers });
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
    } catch { await route.fulfill({ status: 503, body: 'fixture unavailable' }); }
  });
  const page = await c.newPage(); page.setDefaultTimeout(25000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  stage = 'login-' + locale;
  await page.goto(web);
  await page.getByLabel(login.email, { exact: true }).fill(f.email); await page.getByLabel(login.password, { exact: true }).fill(f.password);
  await page.getByRole('button', { name: login.button, exact: true }).click(); await page.waitForURL('**/parent');
  stage = 'subscription-' + locale;
  await page.goto(web + '/parent/subscription');
  const note = page.getByTestId('subscription-ai-consent-note'); await note.waitFor();
  assert.equal((await note.innerText()).trim(), expected, locale + ': note text');
  for (const [name, size] of Object.entries(sizes)) {
    await page.setViewportSize(size); await page.waitForTimeout(700);
    await note.scrollIntoViewIfNeeded();
    const m = await note.evaluate(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return { left: r.left, right: r.right, width: r.width, height: r.height, fontSize: parseFloat(s.fontSize), lineHeight: s.lineHeight,
        scrollW: el.scrollWidth, clientW: el.clientWidth, overflow: document.documentElement.scrollWidth - innerWidth, vw: innerWidth }; });
    assert.ok(m.overflow <= 1, `${locale}-${name}: horizontal page overflow ${m.overflow}`);
    assert.ok(m.left >= 0 && m.right <= m.vw + 0.5, `${locale}-${name}: note outside viewport`);
    assert.ok(m.scrollW <= m.clientW + 1, `${locale}-${name}: note text clipped`);
    assert.ok(m.fontSize >= 14, `${locale}-${name}: font ${m.fontSize}`);
    assert.ok(!/\bsubscription\.|\bc08\.|\biap\./.test(await page.locator('body').innerText()), `${locale}-${name}: untranslated key`);
    await page.screenshot({ path: `${out}/subscription-${locale}-${name}.png`, fullPage: true });
    pass(`note_readable_${locale}_${name}`, m);
  }
  assert.deepEqual(errors, [], locale + ': page errors');
  await c.close();
}

(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  await run('tr-TR', tr, { email: 'E-posta', password: 'Şifre', button: 'Giriş yap' });
  await run('en-US', en, { email: 'Email', password: 'Password', button: 'Sign in' });
})().then(() => {
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ passed: results.length, failed: 0, results }, null, 2) + '\n');
}).catch(e => {
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ passed: results.length, failed: 1, stage, error: String(e && e.message || e), results }, null, 2) + '\n');
  console.error('FAIL ' + stage + ': ' + (e && e.message)); process.exitCode = 1;
}).finally(() => browser && browser.close());
