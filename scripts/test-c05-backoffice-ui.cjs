const loopbackFixtureFetch = require('./loopback-fixture-fetch.cjs');
// C05 backoffice tour. Run only through `scripts/test-curriculum-pipeline-chain.py --run-local --with-ui`:
// disposable Auth/PostgREST + the real Supabase edge-runtime image (curriculum-source-fetch, real ÖDSGM network),
// synthetic example.invalid admin, static backoffice export built against a placeholder origin.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_C05_UI_FIXTURE));
assert.match(f.email, /^gina-c05-admin-[0-9a-f]+@example\.invalid$/);
assert.match(f.db, /^gina_c05_[0-9a-f]+_audit$/);
const ROOT = path.resolve(__dirname, '..'), OUT = ROOT + '/apps/backoffice/out';
const SHOTS = ROOT + '/docs/release/c05-2026-11-06/ui';
const BUILD_URL = 'http://gina-c05ui.invalid', BUILD_ANON = 'c05-placeholder-anon';
fs.mkdirSync(SHOTS, { recursive: true });
const checks = {};
let browser, p, server, stage = 'setup';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };
function serve() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u.endsWith('/')) u += 'index';
      const file = [OUT + u, OUT + u + '.html'].find((c) => c.startsWith(OUT) && fs.existsSync(c) && fs.statSync(c).isFile());
      if (!file) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}
const ok = (name) => { checks[name] = true; };

(async () => {
  const site = await serve();
  const login = await loopbackFixtureFetch(`http://127.0.0.1:${f.auth}/token?grant_type=password`, { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
  assert.equal(login.status, 200);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  let edgeCalls = 0;
  await c.route(BUILD_URL + '/**', async (r) => {
    const req = r.request(), url = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    let target;
    if (url.pathname.startsWith('/auth/v1')) target = `http://127.0.0.1:${f.auth}${url.pathname.slice(8) || '/'}${url.search}`;
    else if (url.pathname.startsWith('/rest/v1')) target = `http://127.0.0.1:${f.rest}${url.pathname.slice(8) || '/'}${url.search}`;
    else if (url.pathname.startsWith('/functions/v1/')) { edgeCalls++; target = `http://127.0.0.1:${f.edge}${url.pathname}${url.search}`; }
    if (!target) return r.fulfill({ status: 404, headers: cors, body: '' });
    const headers = { ...req.headers() };
    if (headers.apikey === BUILD_ANON) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + BUILD_ANON) headers.authorization = 'Bearer ' + f.anon;
    try {
      const x = await r.fetch({ url: target, headers, timeout: 120000 });
      await r.fulfill({ response: x, headers: { ...x.headers(), ...cors } });
    } catch { await r.fulfill({ status: 503, headers: cors, body: 'Local service unavailable' }); }
  });
  p = await c.newPage();
  p.setDefaultTimeout(30000);
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  async function shot(name) {
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${SHOTS}/${name}.png` });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow on ' + name);
  }

  stage = 'login';
  await p.goto(site + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.email);
  await p.getByLabel('Şifre', { exact: true }).fill(f.password);
  await p.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await p.waitForURL('**/dashboard');
  ok('admin_login_non_family_member');

  stage = 'targets';
  await p.goto(site + '/library?tab=curriculum');
  const pipe = p.getByTestId('curriculum-pipeline');
  await pipe.locator('[data-testid=source-target]').first().waitFor();
  assert.equal(await pipe.locator('[data-testid=source-target]').count(), 2);
  assert.match(await pipe.locator('[data-testid=source-target]').filter({ hasText: '2026-2027 · 1. dönem' }).innerText(), /Etkin · başlangıç kaydı/);
  assert.match(await pipe.locator('[data-testid=source-target]').filter({ hasText: '2026-2027 · 2. dönem' }).innerText(), /Emekli/);
  await pipe.scrollIntoViewIfNeeded();
  await shot('01-targets-seed-and-retired-term2');
  ok('targets_listed_with_status');

  stage = 'add_target_invalid';
  await pipe.getByRole('button', { name: 'Yeni yıl/dönem dizini ekle' }).click();
  const form = pipe.getByRole('form', { name: 'Dizin hedefi formu' });
  await form.getByLabel('Eğitim yılı').fill('2027-2028');
  await form.getByLabel('Dönem').selectOption('1');
  await form.getByLabel(/Resmî dizin sayfası/).fill('https://meb.ai/c05-qa');
  await form.getByLabel(/Not/).fill('QA: kısaltma adresi dizin değildir');
  await form.getByRole('button', { name: 'Hedefi kaydet' }).click();
  await pipe.getByText(/Yalnız resmî https:\/\/…meb\.gov\.tr dizin sayfası kaydedilebilir/).waitFor();
  await shot('02-target-shortener-rejected');
  ok('target_non_index_host_rejected_with_reason');

  stage = 'add_target_valid';
  await form.getByLabel(/Resmî dizin sayfası/).fill('https://odsgm.meb.gov.tr/www/c05-qa-2027-2028/icerik/1');
  await form.getByLabel(/Not/).fill('QA: 2027-2028 dizini yayımlandığında eklenecek sayfanın biçimi (sentetik)');
  await form.getByRole('button', { name: 'Hedefi kaydet' }).click();
  await pipe.getByText(/2027-2028 · 1\. dönem hedefi eklendi\. Hiçbir dosya indirilmedi/).waitFor();
  await pipe.locator('[data-testid=source-target]').filter({ hasText: '2027-2028 · 1. dönem' }).waitFor();
  assert.equal(await pipe.locator('[data-testid=source-target]').count(), 3);
  await shot('03-target-added-no-download');
  ok('new_year_target_added_without_download');

  stage = 'queue';
  const failed = pipe.locator('[data-testid=queue-item][data-extraction=failed]');
  await failed.waitFor();
  assert.match(await failed.innerText(), /çıkarma başarısız: worksheet_path/);
  assert.match(await pipe.getByTestId('operator-step').innerText(), /sunucuda, sizin oturumunuzla/); // H02: no terminal/token step
  await failed.scrollIntoViewIfNeeded();
  await shot('04-extraction-queue-failed-with-reason');
  ok('extraction_queue_and_operator_step_visible');

  stage = 'candidate_badges';
  const badges = p.locator('[data-testid=candidate-pipeline-badges]');
  await badges.first().waitFor();
  const all = await badges.allInnerTexts();
  assert.ok(all.some((t) => /Kaynak sürümü onaylı/.test(t)), 'approved source badge');
  assert.ok(all.some((t) => /AI ön inceleme: AI uygun buldu \(yayın değil\)/.test(t)), 'E01 AI badge, not a decision');
  assert.ok(all.some((t) => /AI ön inceleme: istenmedi/.test(t)), 'unrequested AI pre-review shown honestly');
  await badges.first().scrollIntoViewIfNeeded();
  await shot('05-candidate-source-and-ai-badges');
  ok('candidate_list_shows_source_status_and_separate_ai_prereview');

  stage = 'stale_then_real_edge_check';
  const card = p.locator('[data-testid=curriculum-source]').filter({ hasText: 'Türkçe · 2026-2027 · 1. dönem' });
  await card.getByTestId('source-stale').waitFor();
  assert.match(await card.getByTestId('source-stale').innerText(), /9 gün önce/);
  assert.equal(await card.getAttribute('data-freshness'), 'diff_review_required');
  await card.scrollIntoViewIfNeeded();
  await shot('06-source-stale-and-diff-review');
  const before = edgeCalls;
  await card.getByRole('button', { name: 'Resmî dizini kontrol et' }).click();
  await card.getByText(/Resmî dizin kontrol edildi\. Güncellik: Güncel \(onaylı kopya ile aynı\)\. Hiçbir şey yayımlanmadı\./).waitFor({ timeout: 120000 });
  assert.equal(edgeCalls, before + 1);
  await p.waitForTimeout(800);
  const fresh = p.locator('[data-testid=curriculum-source]').filter({ hasText: 'Türkçe · 2026-2027 · 1. dönem' });
  assert.equal(await fresh.getByTestId('source-stale').count(), 0, 'stale alert gone after a real successful check');
  await fresh.scrollIntoViewIfNeeded();
  await shot('07-real-edge-check-unchanged-hash');
  ok('real_edge_check_from_ui_same_hash_no_new_revision');

  assert.deepEqual(errors, []);
  ok('no_page_exceptions_or_horizontal_overflow');
  console.log(JSON.stringify(checks));
  await browser.close();
  server.close();
})().catch(async (e) => {
  checks['failed_at_' + stage] = false;
  console.error('CHECK_FAILED ' + stage + ' ' + String(e && e.message).slice(0, 800));
  if (p) { try { await p.screenshot({ path: SHOTS + '/failed-' + stage + '.png' }); } catch {} }
  console.log(JSON.stringify(checks));
  if (browser) await browser.close();
  if (server) server.close();
  process.exitCode = 1;
});
