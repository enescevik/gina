// C05 parent catalog (mobile web export, 390×844) tour. Run only through
// `scripts/test-curriculum-pipeline-chain.py --run-local --with-ui` with GINA_C05_MOBILE_WEB pointing at an
// `expo export -p web` built against the placeholder origin http://gina-c05m.invalid (never a real project).
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_C05_UI_FIXTURE));
assert.match(f.parent_email, /^gina-c05-parent-[0-9a-f]+@example\.invalid$/);
const WEB = path.resolve(process.env.GINA_C05_MOBILE_WEB);
const SHOTS = path.resolve(__dirname, '..') + '/docs/release/c05-2026-11-06/ui';
const BUILD_URL = 'http://gina-c05m.invalid', BUILD_ANON = 'c05m-placeholder-anon';
const checks = {};
let browser, p, server, stage = 'setup';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webp': 'image/webp', '.ico': 'image/x-icon' };
function serve() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = [WEB + u, WEB + u + '.html', WEB + u + '/index.html'].find((c) => c.startsWith(WEB) && fs.existsSync(c) && fs.statSync(c).isFile());
      if (!file) file = WEB + '/index.html';
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}
const ok = (name) => { checks[name] = true; };

(async () => {
  const site = await serve();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', isMobile: true, hasTouch: true });
  await c.route(BUILD_URL + '/**', async (r) => {
    const req = r.request(), url = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const port = url.pathname.startsWith('/auth/v1') ? f.auth : url.pathname.startsWith('/rest/v1') ? f.rest : null;
    if (!port) return r.fulfill({ status: 404, headers: cors, body: '' });
    const headers = { ...req.headers() };
    if (headers.apikey === BUILD_ANON) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + BUILD_ANON) headers.authorization = 'Bearer ' + f.anon;
    try {
      const x = await r.fetch({ url: `http://127.0.0.1:${port}${url.pathname.slice(8) || '/'}${url.search}`, headers });
      await r.fulfill({ response: x, headers: { ...x.headers(), ...cors } });
    } catch { await r.fulfill({ status: 503, headers: cors, body: 'Local service unavailable' }); }
  });
  p = await c.newPage();
  p.setDefaultTimeout(30000);
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  async function shot(name) {
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow on ' + name);
  }
  async function scope({ year, term }) {
    await p.goto(site + '/parent/prova/catalog');
    await p.getByText('Türkçe', { exact: true }).first().click();
    if (year) {
      const field = p.getByLabel('Öğretim yılı');
      await field.fill(year);
    }
    await p.getByText(`${term}. dönem`, { exact: true }).first().click();
    await p.getByText('Devam et', { exact: true }).last().click();
  }

  stage = 'login';
  await p.goto(site + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.parent_email);
  await p.getByLabel('Şifre', { exact: true }).fill(f.parent_password);
  await p.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await p.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 });
  ok('parent_login');

  stage = 'term1_stale';
  await scope({ term: 1 });
  await p.getByText(/Son başarılı kontrol 9 gün önce; güncellik eski olabilir/).waitFor();
  await p.getByText('Okulun senaryosunu biliyorum', { exact: true }).click();
  await p.getByText('Senaryo 1', { exact: false }).first().waitFor();
  await shot('m1-term1-published-scenario-stale-notice-390');
  ok('term1_shows_published_scenario_and_stale_notice');

  stage = 'term2_unverified';
  await scope({ term: 2 });
  await p.getByText(/Kaynağın güncelliği doğrulanamadı/).first().waitFor();
  await p.getByText(/Serbest çalışma veya elle girilen dağılımla devam edebilirsin/).first().waitFor();
  await p.getByText('Bu kapsamda yayımlanmış senaryo yok', { exact: true }).waitFor();
  assert.equal(await p.getByText(/Senaryolar son onaylı kopyaya dayanır/).count(), 0, 'no approved copy: stale notice must not claim one');
  assert.equal(await p.getByText('Senaryo 1', { exact: false }).count(), 0, 'term 2 does not borrow term-1 scenarios');
  await shot('m2-term2-unverified-free-study-390');
  ok('term2_unverified_free_study_no_term1_scenarios');

  stage = 'next_year_not_fetched';
  await scope({ year: '2027-2028', term: 1 });
  await p.getByText(/2027-2028 · 1\. dönem için resmî dizin kayıtlı ama dosya henüz incelenmedi\. Başka dönemin dosyası kullanılmaz\./).waitFor();
  await p.getByText(/Bu yıl\/dönem için yayımlanmış resmî dağılım yok/).first().waitFor();
  await shot('m3-next-year-registered-not-fetched-390');
  ok('next_year_registered_index_not_fetched_explicit');

  assert.deepEqual(errors, []);
  ok('no_page_exceptions_or_horizontal_overflow');
  console.log(JSON.stringify(checks));
  await browser.close();
  server.close();
})().catch(async (e) => {
  checks['failed_at_' + stage] = false;
  console.error('CHECK_FAILED ' + stage + ' ' + String(e && e.message).slice(0, 800));
  if (p) { try { await p.screenshot({ path: SHOTS + '/failed-mobile-' + stage + '.png', fullPage: true }); } catch {} }
  console.log(JSON.stringify(checks));
  if (browser) await browser.close();
  if (server) server.close();
  process.exitCode = 1;
});
