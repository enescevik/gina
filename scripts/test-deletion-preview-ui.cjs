const loopbackFixtureFetch = require('./loopback-fixture-fetch.cjs');
// L03 UI acceptance against the disposable synthetic fixture from
// `GINA_QA_UI_FIXTURE=<unique path> scripts/test-isolated-services.py --run-local --ui-hold`.
// The web export is built against a placeholder origin (GINA_QA_PLACEHOLDER_URL / _ANON); this script
// forwards those requests to the fixture's loopback proxy and serves the export itself (GINA_QA_WEB_DIST).
// Never targets production or the shared local demo DB. Prints no credentials.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const fixturePath = process.env.GINA_QA_UI_FIXTURE; assert.ok(fixturePath, 'GINA_QA_UI_FIXTURE required (unique per run)');
const f = JSON.parse(fs.readFileSync(fixturePath)); assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const placeholder = process.env.GINA_QA_PLACEHOLDER_URL || 'http://127.0.0.1:65431', placeholderAnon = process.env.GINA_QA_PLACEHOLDER_ANON || 'placeholder-anon-l03';
const dist = process.env.GINA_QA_WEB_DIST; assert.ok(dist && fs.existsSync(path.join(dist, 'index.html')), 'GINA_QA_WEB_DIST required');
const out = process.cwd() + '/docs/release/deletion-preview-2026-11-06/ui'; fs.mkdirSync(out, { recursive: true });
const failRoot = process.env.GINA_QA_FAIL_DIR || require('node:os').tmpdir();
const results = []; let browser, page, server, stage = 'setup';
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail ? { detail } : {}) }); };

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webp': 'image/webp' };
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\.\.+/g, '');
      const tries = [path.join(dist, clean), path.join(dist, clean + '.html'), path.join(dist, clean, 'index.html')];
      let file = tries.find(p => p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isFile());
      if (!file) file = path.join(dist, 'index.html');
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

(async () => {
  const login = await loopbackFixtureFetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
  assert.ok(login.ok); const session = await login.json();
  async function api(p, body, { method, prefer } = {}) {
    const res = await loopbackFixtureFetch(f.url + '/rest/v1/' + p, { method: method || (body ? 'POST' : 'GET'), headers: { apikey: f.anon, authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
  }
  const must = async (...a) => { const r = await api(...a); assert.ok(r.ok, a[0] + ' ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 200)); return r.data; };
  // Fresh synthetic children keep each flow independent from the shared fixture state.
  const [deniz, ece, mert, lale] = await must('children', [
    { family_id: f.familyId, name: 'Deniz', grade: 3 }, { family_id: f.familyId, name: 'Ece', grade: 5 },
    { family_id: f.familyId, name: 'Mert', grade: 2 }, { family_id: f.familyId, name: 'Lale', grade: 4 }], { prefer: 'return=representation' });
  await must('task_templates', [{ family_id: f.familyId, child_id: ece.id, title: 'Kitap oku', icon: 'read-book', stars: 2 }, { family_id: f.familyId, child_id: ece.id, title: 'Çantayı hazırla', icon: 'pack-school-bag', stars: 1 }]);
  const childExists = async id => (await must(`children?id=eq.${id}&select=id,name,archived_at`)).length === 1;

  server = await serve(); const web = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const confirmCalls = [], previewCalls = [], edgeBodies = [];
  let loseNextConfirm = false, edgeMode = null;
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await ctx.route(placeholder + '/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const url = f.url + req.url().slice(placeholder.length);
    const headers = { ...req.headers() };
    for (const k of Object.keys(headers)) if (typeof headers[k] === 'string') headers[k] = headers[k].split(placeholderAnon).join(f.anon);
    if (url.includes('/rest/v1/rpc/deletion_preview')) previewCalls.push(Date.now());
    if (url.includes('/functions/v1/delete-account')) {
      // The isolated runner starts no Edge runtime without --with-storage; the 409 is a stand-in for the
      // real handler's documented response (covered by its Deno tests). The request body is real.
      edgeBodies.push(JSON.parse(req.postData() || '{}'));
      if (edgeMode === 'stale') return route.fulfill({ status: 409, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: 'deletion_preview_stale' }) });
      return route.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: 'deletion_failed' }) });
    }
    if (url.includes('/rest/v1/rpc/confirm_child_deletion')) confirmCalls.push(JSON.parse(req.postData() || '{}'));
    try {
      const res = await route.fetch({ url, headers });
      if (url.includes('/rest/v1/rpc/confirm_child_deletion') && loseNextConfirm) {
        loseNextConfirm = false; assert.ok(res.ok(), 'server applied the first confirm');
        return route.fulfill({ status: 503, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Synthetic lost response' }) });
      }
      await route.fulfill({ response: res, headers: { ...res.headers(), ...cors } });
    } catch { await route.fulfill({ status: 503, body: 'Local fixture unavailable' }); }
  });
  page = await ctx.newPage(); page.setDefaultTimeout(25000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const sheet = () => page.getByRole('dialog').or(page.locator('[aria-modal="true"]')).last();
  async function shot(name) {
    await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${name}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': no horizontal overflow');
    assert.ok(!(await page.locator('body').innerText()).includes('deletionPreview.'), name + ': translations resolved');
  }
  const confirmButton = () => page.getByRole('button', { name: 'Kalıcı olarak sil', exact: true });
  const openChildSheet = async name => {
    await page.getByRole('button', { name: `${name} profilini kalıcı sil`, exact: true }).click();
    await page.getByText('Silinecekler', { exact: true }).waitFor();
  };

  stage = 'login';
  await page.goto(web); await page.getByLabel('E-posta', { exact: true }).fill(f.email); await page.getByLabel('Şifre', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await page.waitForURL('**/parent');

  stage = 'danger_zone';
  await page.goto(`${web}/parent/menu`); await page.getByText('Tehlikeli işlemler', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Deniz profilini kalıcı sil', exact: true }).scrollIntoViewIfNeeded(); await shot('menu-danger-zone-phone');
  // Child settings (PIN card) no longer carries a permanent delete control.
  await page.getByRole('button', { name: 'Çocuk ayarları' }).first().click().catch(() => undefined);
  assert.equal(await page.getByRole('button', { name: /profilini sil$/ }).count(), 0, 'old in-card delete removed');
  pass('permanent_delete_separate_from_pin_card');

  stage = 'archive_path';
  await openChildSheet('Deniz');
  await page.getByText('Bunun yerine arşivle', { exact: true }).first().waitFor();
  await page.getByText(/aboneliği iptal etmez/).first().waitFor();
  assert.equal(await confirmButton().isDisabled(), true, 'confirm disabled before typing the name');
  await shot('preview-archive-offer-phone');
  await page.getByRole('button', { name: 'Bunun yerine arşivle', exact: true }).click();
  await page.waitForURL(u => u.pathname.endsWith('/parent/profile-archive') && u.searchParams.get('childId') === deniz.id);
  await page.waitForTimeout(800); await shot('archive-path-phone');
  assert.ok(await childExists(deniz.id), 'archive path deletes nothing'); assert.equal(confirmCalls.length, 0);
  pass('preview_then_archive_path_deletes_nothing');

  stage = 'delete_double_tap';
  await page.goto(`${web}/parent/menu`); await openChildSheet('Ece');
  await page.getByText('2 görev rutini', { exact: true }).waitFor();
  await page.getByLabel('Profil adı').fill('Ec'); assert.equal(await confirmButton().isDisabled(), true, 'wrong name keeps confirm disabled');
  await page.getByLabel('Profil adı').fill('ece'); assert.equal(await confirmButton().isDisabled(), false, 'name match is case-insensitive');
  await shot('preview-delete-ready-phone');
  await confirmButton().dblclick(); // double tap
  await page.getByText('Ece profili silindi.', { exact: true }).waitFor();
  await page.waitForTimeout(800);
  assert.equal(await childExists(ece.id), false, 'child deleted');
  assert.equal(confirmCalls.length, 1, 'double tap sent one confirm');
  const replay = await api('rpc/confirm_child_deletion', confirmCalls[0]);
  assert.ok(replay.ok && replay.data.deleted === true, 'same request id replays the receipt');
  await shot('delete-done-phone');
  pass('preview_then_delete_double_tap_once_and_receipt_replay', { confirm_requests: confirmCalls.length });

  stage = 'stale';
  const before = previewCalls.length;
  await openChildSheet('Mert');
  await must(`children?id=eq.${mert.id}`, { name: 'Mert Can' }, { method: 'PATCH' }); // target changes after preview
  await page.getByLabel('Profil adı').fill('Mert'); await confirmButton().click();
  await page.getByText('Önizlemeden sonra kayıtlar değişti. Güncel önizlemeyi yükleyip yeniden kontrol et.', { exact: true }).waitFor();
  await page.getByText('Onaylamak için profil adını aynen yaz: Mert Can', { exact: true }).waitFor();
  assert.ok(previewCalls.length >= before + 2, 'stale error reloaded the preview');
  assert.equal(await confirmButton().isDisabled(), true, 'old typed name no longer matches');
  assert.ok(await childExists(mert.id), 'stale token deleted nothing');
  await shot('stale-refreshed-phone');
  pass('stale_preview_rejected_and_reloaded');

  stage = 'lost_response';
  const firstNew = confirmCalls.length;
  loseNextConfirm = true;
  await page.getByLabel('Profil adı').fill('Mert Can'); await confirmButton().click();
  await page.getByText(/Silme tamamlanamadı/).waitFor();
  await shot('lost-response-phone');
  await confirmButton().click();
  await page.getByText('Mert Can profili silindi.', { exact: true }).waitFor();
  const retried = confirmCalls.slice(firstNew);
  assert.equal(retried.length, 2); assert.equal(retried[0].p_request_id, retried[1].p_request_id, 'retry reuses the request id'); assert.equal(retried[0].p_preview_token, retried[1].p_preview_token);
  assert.equal(await childExists(mert.id), false);
  pass('lost_response_retry_same_request_id_deletes_once');

  stage = 'desktop_child';
  await page.setViewportSize({ width: 1280, height: 800 });
  await openChildSheet('Lale'); await shot('preview-child-desktop');
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).last().click();
  assert.ok(await childExists(lale.id), 'cancel deletes nothing');
  pass('cancel_keeps_child');

  stage = 'account';
  await page.goto(`${web}/parent/menu?section=account`);
  await page.getByRole('button', { name: 'Hesap silme etkisini gör', exact: true }).click();
  await page.getByText(/ailede başka veli (yok|var)/).first().waitFor();
  await page.getByText(/Yeniden doğrulama/).first().waitFor();
  assert.equal(await confirmButton().isDisabled(), true, 'account confirm needs reauth');
  await shot('preview-account-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await shot('preview-account-phone');
  await page.getByLabel('Şifre', { exact: true }).last().fill('synthetic-wrong-password');
  await page.getByRole('switch', { name: 'Bu işlemin geri alınamayacağını anladım.' }).click();
  edgeMode = 'stale'; const accountPreviewsBefore = previewCalls.length;
  await confirmButton().click();
  await page.getByText('Önizlemeden sonra kayıtlar değişti. Güncel önizlemeyi yükleyip yeniden kontrol et.', { exact: true }).waitFor();
  await page.waitForTimeout(800);
  assert.equal(edgeBodies.length, 1); assert.match(edgeBodies[0].preview_token, /^[0-9a-f-]{36}$/); assert.equal(edgeBodies[0].confirm, true);
  assert.ok(previewCalls.length > accountPreviewsBefore, 'account preview reloaded after 409 stale');
  await shot('account-stale-phone');
  pass('account_delete_sends_preview_token_and_reloads_on_stale', { edge_response: 'stubbed_409' });

  assert.deepEqual(errors, []); pass('no_runtime_errors_phone_and_desktop');
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-real-auth-rest; delete-account edge response stubbed', viewports: ['390x844', '1280x800'], results }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 1));
  await browser.close(); server.close();
})().catch(async e => {
  console.log('CHECK_FAILED ' + stage + ' ' + String(e && e.message).slice(0, 700));
  if (page) { const failDir = fs.mkdtempSync(require('node:path').join(failRoot, 'gina-ui-failure-')); console.error('Failure artifacts: ' + failDir); await page.screenshot({ path: failDir + '/gina-l03-ui-failed.png' }).catch(() => undefined); fs.writeFileSync(failDir + '/gina-l03-ui-failure.txt', await page.locator('body').innerText().catch(() => '')); }
  if (browser) await browser.close(); if (server) server.close(); process.exitCode = 1;
});
