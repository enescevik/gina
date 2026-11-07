// QT-AI backoffice questions page tour. Run only through scripts/test-qt-backoffice-ui.py:
// disposable local Auth/PostgREST, synthetic example.invalid admin, no Edge runtime, no paid AI call.
// Screens: docs/release/qt-2026-11-07/screens/backoffice/ (1280×800 desktop, 768×1024 tablet).
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QTAI_FIXTURE));
assert.match(f.email, /^gina-qtai-[0-9a-f]+@example\.invalid$/);
assert.match(f.db, /^gina_qtai_[0-9a-f]+_audit$/);
const ROOT = path.resolve(__dirname, '..'), OUT = ROOT + '/apps/backoffice/out';
const SHOTS = ROOT + '/docs/release/qt-2026-11-07/screens/backoffice';
const BUILD_URL = 'http://gina-qtai.invalid', BUILD_ANON = 'qtai-placeholder-anon';
fs.mkdirSync(SHOTS, { recursive: true });
const checks = {};
let browser, server, stage = 'setup';
const sizes = { desktop: { width: 1280, height: 800 }, tablet: { width: 768, height: 1024 } };

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };
function serve() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u.endsWith('/')) u += 'index';
      const candidates = [OUT + u, OUT + u + '.html'];
      const file = candidates.find((c) => c.startsWith(OUT) && fs.existsSync(c) && fs.statSync(c).isFile());
      if (!file) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}
const ok = (name) => { checks[name] = true; };

(async () => {
  const site = await serve();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const c = await browser.newContext({ viewport: sizes.desktop, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const keyCalls = [];
  await c.route(BUILD_URL + '/**', async (r) => {
    const req = r.request(), url = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const port = url.pathname.startsWith('/auth/v1') ? f.auth : url.pathname.startsWith('/rest/v1') ? f.rest : null;
    if (!port) return r.fulfill({ status: 404, headers: cors, body: '' });
    if (url.pathname.endsWith('/rpc/get_question_answer_keys')) keyCalls.push(req.postData());
    const headers = { ...req.headers() };
    if (headers.apikey === BUILD_ANON) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + BUILD_ANON) headers.authorization = 'Bearer ' + f.anon;
    try {
      const target = `http://127.0.0.1:${port}${url.pathname.replace(/^\/(auth|rest)\/v1/, '') || '/'}${url.search}`;
      const x = await r.fetch({ url: target, headers });
      await r.fulfill({ response: x, headers: { ...x.headers(), ...cors } });
    } catch { await r.fulfill({ status: 503, headers: cors, body: 'Local service unavailable' }); }
  });
  const p = await c.newPage();
  p.setDefaultTimeout(20000);
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  async function shot(name) {
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow on ' + name);
  }

  stage = 'login';
  await p.goto(site + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.email);
  await p.getByLabel('Şifre', { exact: true }).fill(f.password);
  await p.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await p.waitForURL('**/dashboard');
  ok('admin_login');

  for (const [size, vp] of Object.entries(sizes)) {
    stage = 'list_' + size;
    await p.setViewportSize(vp);
    await p.goto(site + '/questions');
    const table = p.locator('table.table').first();
    await table.waitFor();
    const text = await table.innerText();
    for (const label of ['Doğru / Yanlış', 'Boşluk doldurma', 'Eşleştirme', 'Sayısal cevap', 'Sıralama', 'Sınıflandırma', 'Çoktan seçmeli',
      'Metinde işaretleme', 'Hata bulma ve düzeltme', 'Birden çok doğru', 'İki aşamalı', 'Bölge boyama', 'Saat']) {
      assert.ok(text.includes(label), 'type label missing: ' + label);
    }
    assert.ok(text.includes('3 ifade'), 'structured summary missing');
    ok('list_shows_type_labels_and_summary_' + size);
    await shot(`${size}-01-questions-list`);

    stage = 'filter_' + size;
    const only = async (value, label) => {
      await p.getByRole('combobox', { name: 'Tür' }).selectOption(value);
      await p.getByText(value ? '1 soru' : `${f.total} soru`, { exact: true }).waitFor();
      const rows = p.locator('table.table tbody tr');
      if (value) {
        await rows.filter({ hasText: label }).first().waitFor();
        assert.equal(await rows.count(), 1);
        assert.match(await rows.first().innerText(), label);
      }
    };
    await only('matching', /Eşleştirme/);
    ok('type_filter_structured_' + size);
    await only('multiple_choice', /Çoktan seçmeli/);
    ok('type_filter_legacy_' + size);
    await only('', null);

    stage = 'preview_' + size;
    for (const [type, keyText] of [['Eşleştirme', 'Kanı pompalar'], ['Sıralama', 'Kedi → süt → içti.'], ['Doğru / Yanlış', 'Yanlış'],
      ['Metinde işaretleme', 'koştu, zıpladı'], ['Hata bulma ve düzeltme', 'herkes'], ['Birden çok doğru', 'Elma, Muz'], ['İki aşamalı', 'Soğuyan su buza dönüşür.'],
      ['Bölge boyama', '3 / 4'], ['Saat', '03:15']]) {
      const row = p.locator('table.table tbody tr').filter({ hasText: type });
      await row.getByRole('button', { name: 'Düzenle' }).click();
      const preview = p.getByTestId('structured-preview');
      await preview.waitFor();
      const keyBox = preview.getByRole('region', { name: /Özel cevap anahtarı/ });
      await keyBox.getByText('Yapı geçerli', { exact: false }).waitFor();
      assert.ok((await keyBox.innerText()).includes(keyText), `key text for ${type}`);
      const student = await preview.getByRole('region', { name: /Öğrencinin gördüğü/ }).innerText();
      assert.ok(!student.includes('ÇÖZÜM-GİZLİ'), 'solution leaked into student preview');
      assert.equal(await p.locator('#q-stem').count(), 0, 'structured stem must not be editable');
      ok(`preview_${type}_${size}`);
      const shots = { 'Eşleştirme': '02-structured-preview-matching', 'Birden çok doğru': '03-multi-choice-bar-chart-stimulus', 'İki aşamalı': '04-two-stage',
        'Bölge boyama': '05-region-select-grid', 'Hata bulma ve düzeltme': '06-error-fix' };
      if (type === 'Birden çok doğru') {
        assert.ok(await preview.getByTestId('stimulus-preview').isVisible(), 'stimulus rendered');
        assert.match(await preview.getByTestId('stimulus-preview').innerText(), /Alternatif metin: Sütun grafiği/);
      }
      if (shots[type]) {
        await preview.scrollIntoViewIfNeeded();
        await shot(`${size}-${shots[type]}`);
      }
      await p.getByRole('button', { name: 'Kapat' }).click();
    }
  }

  stage = 'meta_save';
  await p.setViewportSize(sizes.desktop);
  const row = p.locator('table.table tbody tr').filter({ hasText: 'Sınıflandırma' });
  await row.getByRole('button', { name: 'Düzenle' }).click();
  await p.locator('#q-explanation').fill('Hayvanlar ve bitkiler canlıdır.');
  await p.getByRole('button', { name: 'Kaydet' }).click();
  await p.getByText('Kaydedildi', { exact: false }).first().waitFor();
  ok('structured_meta_save_keeps_content_hash_valid');

  assert.ok(keyCalls.length >= 18, 'answer keys read through get_question_answer_keys');
  ok('keys_read_via_rpc_only');
  assert.deepEqual(errors, []);
  ok('no_page_errors');
  console.log(JSON.stringify(checks));
  await browser.close();
  server.close();
})().catch(async (e) => {
  console.error(stage + ': ' + (e && e.stack || e));
  try { await browser?.close(); } catch {}
  server?.close();
  console.log(JSON.stringify({ ...checks, failed_stage: stage }));
  process.exit(1);
});
