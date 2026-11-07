const loopbackFixtureFetch = require('./loopback-fixture-fetch.cjs');
// H02 backoffice tours. Run only through `scripts/test-h02-panel-extraction.py --run-local --with-ui`: disposable
// Auth/PostgREST + the real Supabase edge-runtime image (curriculum-source-fetch + curriculum-source-extract, real
// ÖDSGM network), synthetic example.invalid admin, static backoffice export built against a placeholder origin.
// Desktop 1280×800: empty catalogue → registered target → official index links → Türkçe → download → extract (double
// click) → draft review. Tablet 768×1024: per-level subject (İngilizce, level required) → download → extract from the
// queue → draft review. Nothing is approved or published.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_H02_UI_FIXTURE));
assert.match(f.email, /^gina-h02-admin-[0-9a-f]+@example\.invalid$/);
assert.match(f.db, /^gina_h02_[0-9a-f]+_audit$/);
const ROOT = path.resolve(__dirname, '..'), OUT = ROOT + '/apps/backoffice/out';
const SHOTS = ROOT + '/docs/release/h02-2026-11-06/ui';
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
let token = null;
async function sources() {
  const r = await loopbackFixtureFetch(`http://127.0.0.1:${f.rest}/rpc/admin_list_curriculum_sources`, { method: 'POST', headers: { apikey: f.anon, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 200);
  return r.json();
}

async function context(viewport, label) {
  const c = await browser.newContext({ viewport, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const calls = { extract: 0, fetch: 0 };
  await c.route(BUILD_URL + '/**', async (r) => {
    const req = r.request(), url = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    let target;
    if (url.pathname.startsWith('/auth/v1')) target = `http://127.0.0.1:${f.auth}${url.pathname.slice(8) || '/'}${url.search}`;
    else if (url.pathname.startsWith('/rest/v1')) target = `http://127.0.0.1:${f.rest}${url.pathname.slice(8) || '/'}${url.search}`;
    else if (url.pathname.startsWith('/functions/v1/')) {
      if (url.pathname.endsWith('/curriculum-source-extract')) calls.extract++;
      else calls.fetch++;
      target = `http://127.0.0.1:${f.edge}${url.pathname}${url.search}`;
    }
    if (!target) return r.fulfill({ status: 404, headers: cors, body: '' });
    const headers = { ...req.headers() };
    if (headers.apikey === BUILD_ANON) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + BUILD_ANON) headers.authorization = 'Bearer ' + f.anon;
    try {
      const x = await r.fetch({ url: target, headers, timeout: 160000 });
      await r.fulfill({ response: x, headers: { ...x.headers(), ...cors } });
    } catch { await r.fulfill({ status: 503, headers: cors, body: 'Local service unavailable' }); }
  });
  p = await c.newPage();
  p.setDefaultTimeout(30000);
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const shot = async (name) => {
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${SHOTS}/${label}-${name}.png` });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow on ' + label + '-' + name);
  };
  return { c, calls, errors, shot };
}

async function login(site) {
  await p.goto(site + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.email);
  await p.getByLabel('Şifre', { exact: true }).fill(f.password);
  await p.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await p.waitForURL('**/dashboard');
}

(async () => {
  const site = await serve();
  const auth = await loopbackFixtureFetch(`http://127.0.0.1:${f.auth}/token?grant_type=password`, { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
  assert.equal(auth.status, 200);
  token = (await auth.json()).access_token;
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  // ---------------------------------------------------------------- desktop 1280×800
  stage = 'desktop_login';
  let d = await context({ width: 1280, height: 800 }, 'desktop');
  await login(site);
  ok('desktop_admin_login');

  stage = 'desktop_empty';
  await p.goto(site + '/library?tab=curriculum');
  const pipe = p.getByTestId('curriculum-pipeline');
  await p.getByTestId('sources-empty').waitFor();
  assert.match(await p.getByTestId('sources-empty').innerText(), /İlk indirme/);
  assert.equal(await p.getByTestId('curriculum-source').count(), 0);
  assert.doesNotMatch(await pipe.innerText(), /GINA_ADMIN_ACCESS_TOKEN|--process-queue/);
  const row = pipe.locator('[data-testid=source-target]').filter({ hasText: '2026-2027 · 1. dönem' });
  await row.scrollIntoViewIfNeeded();
  await d.shot('01-empty-catalogue-registered-target');
  ok('empty_catalogue_has_a_start_path_and_no_token_command');

  stage = 'desktop_links';
  await row.getByRole('button', { name: 'İlk indirme' }).click();
  const box = p.getByTestId('first-download');
  await box.getByRole('button', { name: 'Resmî dizindeki dersleri getir' }).click();
  const subject = box.getByLabel('Ders (resmî dizindeki bağlantı)');
  await subject.waitFor({ timeout: 60000 });
  const options = await subject.locator('option').allInnerTexts();
  assert.ok(options.includes('Türkçe') && options.some((o) => /^İngilizce \(1\. bağlantı/.test(o)) && options.some((o) => /^İngilizce \(2\. bağlantı/.test(o)), options.join('|'));
  assert.equal(d.calls.extract, 0);
  await box.scrollIntoViewIfNeeded();
  await d.shot('02-official-index-links');
  ok('official_index_links_listed_from_registered_target');

  stage = 'desktop_download';
  await subject.selectOption({ label: 'Türkçe' });
  await box.getByRole('button', { name: 'İndirmeyi başlat' }).click();
  await box.getByTestId('first-download-message').filter({ hasText: /İndirildi: yeni kaynak sürümü .* kaydedildi \(inceleme bekliyor, çıkarma sırada\)\. Hiçbir şey onaylanmadı veya yayımlanmadı\./ }).waitFor({ timeout: 90000 });
  await p.locator('[data-testid=curriculum-source]').filter({ hasText: 'Türkçe · 2026-2027 · 1. dönem' }).waitFor();
  await pipe.locator('[data-testid=queue-item]').filter({ hasText: 'Türkçe' }).waitFor();
  await d.shot('03-first-download-done-queued');
  ok('first_download_from_panel_creates_queued_revision');

  stage = 'desktop_extract';
  const extractBtn = box.getByTestId('extract-button');
  await extractBtn.dblclick();
  await box.getByTestId('extract-message').filter({ hasText: /Çıkarıldı: 46 senaryo adayı taslak olarak içe alındı \(46 yeni, 0 mevcut\)\. Hiçbiri onaylanmadı veya yayımlanmadı/ }).waitFor({ timeout: 160000 });
  const turkce = (await sources()).find((s) => s.label === 'Türkçe');
  assert.equal(turkce.revisions.length, 1);
  assert.equal(turkce.revisions[0].extraction_status, 'done');
  assert.equal(turkce.revisions[0].extraction_attempts, 1, 'double click = one extraction attempt');
  assert.equal(turkce.revisions[0].draft_candidates, 46);
  assert.equal(turkce.revisions[0].status, 'pending_review', 'source approval stays a separate decision');
  assert.ok(d.calls.extract >= 1 && d.calls.extract <= 2);
  await box.scrollIntoViewIfNeeded();
  await d.shot('04-extracted-46-drafts');
  ok('extraction_from_panel_double_click_single_attempt');

  stage = 'desktop_source_card';
  await p.getByTestId('queue-empty').waitFor();
  const card = p.locator('[data-testid=curriculum-source]').filter({ hasText: 'Türkçe · 2026-2027 · 1. dönem' });
  await card.locator('[data-testid=source-revision]').filter({ hasText: '46 aday · 46 taslak · 0 yayımlı' }).waitFor();
  assert.match(await card.getByTestId('extraction-state').innerText(), /çıkarıldı · 1 deneme/);
  assert.equal(await card.getByTestId('extract-button').count(), 0, 'no extract button after done');
  await card.scrollIntoViewIfNeeded();
  await d.shot('05-source-card-extracted');
  ok('source_card_shows_extraction_state_and_counts');

  stage = 'desktop_draft_review';
  const aside = p.getByRole('complementary', { name: 'Senaryo adayları' });
  await aside.getByText('46 kayıt').waitFor({ timeout: 30000 });
  const first = aside.getByRole('button').filter({ hasText: 'Türkçe · 5. sınıf' }).first();
  assert.match(await first.innerText(), /Kaynak incelemesi bekliyor/);
  assert.match(await first.innerText(), /Kaynak sürümü inceleme bekliyor/);
  await first.click();
  await p.locator('.curriculum-detail').getByText(/Sayfa: .+ · Senaryo başlığı:/).waitFor();
  await p.locator('.curriculum-detail').scrollIntoViewIfNeeded();
  await d.shot('06-draft-review-detail');
  ok('draft_review_opens_from_panel');
  assert.deepEqual(d.errors, []);
  await d.c.close();

  // ---------------------------------------------------------------- tablet 768×1024
  stage = 'tablet_login';
  d = await context({ width: 768, height: 1024 }, 'tablet');
  await login(site);
  await p.goto(site + '/library?tab=curriculum');
  ok('tablet_admin_login');

  stage = 'tablet_level';
  const tpipe = p.getByTestId('curriculum-pipeline');
  await tpipe.locator('[data-testid=source-target]').filter({ hasText: '2026-2027 · 1. dönem' }).getByRole('button', { name: 'İlk indirme' }).click();
  const tbox = p.getByTestId('first-download');
  await tbox.getByRole('button', { name: 'Resmî dizindeki dersleri getir' }).click();
  const tsubject = tbox.getByLabel('Ders (resmî dizindeki bağlantı)');
  await tsubject.waitFor({ timeout: 60000 });
  const turkceOpt = (await tsubject.locator('option').allInnerTexts()).find((o) => o.startsWith('Türkçe'));
  assert.equal(turkceOpt, 'Türkçe · zaten kayıtlı');
  const eng1 = (await tsubject.locator('option').allInnerTexts()).find((o) => /^İngilizce \(1\. bağlantı/.test(o));
  await tsubject.selectOption({ label: eng1 });
  await tbox.getByRole('note').filter({ hasText: 'birden fazla bağlantı var' }).waitFor();
  assert.equal(await tbox.getByRole('button', { name: 'İndirmeyi başlat' }).isDisabled(), true, 'level is required for a per-level subject');
  await tbox.scrollIntoViewIfNeeded();
  await d.shot('01-per-level-subject-needs-level');
  await tbox.getByLabel('Okul kademesi').selectOption({ label: 'Ortaokul (5–8)' });
  await tbox.getByRole('button', { name: 'İndirmeyi başlat' }).click();
  await tbox.getByTestId('first-download-message').filter({ hasText: /İndirildi: yeni kaynak sürümü/ }).waitFor({ timeout: 90000 });
  await d.shot('02-level-download-done');
  ok('per_level_subject_requires_level_then_downloads');

  stage = 'tablet_queue_extract';
  const item = tpipe.locator('[data-testid=queue-item]').filter({ hasText: 'İngilizce' });
  await item.waitFor();
  assert.equal(await item.getAttribute('data-extraction'), 'queued');
  await item.getByTestId('extract-button').click();
  // The message stays visible after the queue item disappears (it moves below the emptied queue).
  await tpipe.getByTestId('extract-message').filter({ hasText: /Çıkarıldı: 40 senaryo adayı taslak olarak içe alındı/ }).waitFor({ timeout: 160000 });
  await tpipe.getByTestId('queue-empty').waitFor();
  await tpipe.getByTestId('queue-empty').scrollIntoViewIfNeeded();
  await d.shot('03-extracted-from-queue');
  ok('extraction_from_queue_on_tablet');

  stage = 'tablet_source_card_and_review';
  const engCard = p.locator('[data-testid=curriculum-source]').filter({ hasText: 'İngilizce · Ortaokul (5–8) · 2026-2027 · 1. dönem' });
  await engCard.locator('[data-testid=source-revision]').filter({ hasText: '40 aday · 40 taslak · 0 yayımlı' }).waitFor();
  await engCard.scrollIntoViewIfNeeded();
  await d.shot('04-level-source-card');
  await p.getByLabel('Ders', { exact: true }).selectOption({ label: 'İngilizce' });
  const taside = p.getByRole('complementary', { name: 'Senaryo adayları' });
  await taside.getByText('40 kayıt').waitFor();
  await taside.getByRole('button').filter({ hasText: 'İngilizce · 5. sınıf' }).first().click();
  await p.locator('.curriculum-detail').getByText(/Sayfa: .+ · Senaryo başlığı:/).waitFor();
  await p.locator('.curriculum-detail').scrollIntoViewIfNeeded();
  await d.shot('05-draft-review-detail');
  const all = await sources();
  assert.equal(all.length, 2);
  assert.ok(all.every((s) => s.approved === null && s.revisions.every((r) => r.published_candidates === 0)), 'nothing approved or published');
  ok('tablet_draft_review_nothing_approved_or_published');
  assert.deepEqual(d.errors, []);
  ok('no_page_exceptions_or_horizontal_overflow');
  await d.c.close();
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
