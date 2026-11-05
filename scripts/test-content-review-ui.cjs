// Content review UI tour (E01 + M01 + P05 + S06). Run only through scripts/test-content-review-ui.py:
// disposable local Auth/PostgREST, synthetic example.invalid admin, no Edge runtime, no paid AI call.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_CQUI_FIXTURE));
assert.match(f.email, /^gina-cqui-[0-9a-f]+@example\.invalid$/);
assert.match(f.db, /^gina_cqui_[0-9a-f]+_audit$/);
const ROOT = path.resolve(__dirname, '..'), OUT = ROOT + '/apps/backoffice/out';
const SHOTS = ROOT + '/docs/release/content-prereview-2026-11-06/ui';
const BUILD_URL = 'http://gina-cqui.invalid', BUILD_ANON = 'cqui-placeholder-anon';
fs.mkdirSync(SHOTS, { recursive: true });
const checks = {};
let browser, p, server, stage = 'setup';

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
async function api(token, method, route, body, extra = {}) {
  const r = await fetch(`http://127.0.0.1:${f.rest}${route}`, { method, headers: { apikey: f.anon, authorization: 'Bearer ' + token, 'content-type': 'application/json', ...extra }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(r.ok, 'local_api_failed ' + route + ' ' + r.status);
  return r.status === 204 ? null : r.json();
}
const ok = (name) => { checks[name] = true; };

(async () => {
  const site = await serve();
  const login = await fetch(`http://127.0.0.1:${f.auth}/token?grant_type=password`, { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
  assert.equal(login.status, 200);
  const token = (await login.json()).access_token;

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  let edgeCalls = 0;
  // The static build points at a placeholder origin; this maps it to the disposable services. No Edge runtime
  // exists in this environment, so /functions/v1 answers 404 like a gateway without that function.
  await c.route(BUILD_URL + '/**', async (r) => {
    const req = r.request(), url = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const port = url.pathname.startsWith('/auth/v1') ? f.auth : url.pathname.startsWith('/rest/v1') ? f.rest : null;
    if (!port) { if (url.pathname.startsWith('/functions/v1')) edgeCalls++; return r.fulfill({ status: 404, headers: cors, body: '' }); }
    const headers = { ...req.headers() };
    if (headers.apikey === BUILD_ANON) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + BUILD_ANON) headers.authorization = 'Bearer ' + f.anon;
    try {
      const target = `http://127.0.0.1:${port}${url.pathname.replace(/^\/(auth|rest)\/v1/, '') || '/'}${url.search}`;
      const x = await r.fetch({ url: target, headers });
      await r.fulfill({ response: x, headers: { ...x.headers(), ...cors } });
    } catch { await r.fulfill({ status: 503, headers: cors, body: 'Local service unavailable' }); }
  });
  p = await c.newPage();
  p.setDefaultTimeout(20000);
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
  ok('admin_login');

  stage = 'library_items';
  await p.goto(site + '/library?tab=items');
  const approvedRow = p.locator('[data-testid=content-item]').filter({ hasText: 'Geometri havuzu (AI uygun)' });
  await approvedRow.waitFor();
  const badge = approvedRow.locator('[data-testid=prereview-badge]');
  assert.equal(await badge.getAttribute('data-status'), 'ai_approved');
  assert.match(await badge.innerText(), /AI uygun buldu \(yayın değil\)/);
  assert.match(await badge.innerText(), /Güven: %93/);
  const decision = approvedRow.locator('[data-testid=admin-decision]');
  const decisionText = await decision.innerText();
  assert.match(decisionText, /Taslak · yönetici kararı bekliyor/);
  assert.match(decisionText, /Ailelere açık değil/);
  assert.doesNotMatch(decisionText, /AI/);
  assert.equal(await decision.locator('[data-testid=prereview-badge]').count(), 0);
  ok('prereview_badge_separate_from_admin_decision');
  const rejectRow = p.locator('[data-testid=content-item]').filter({ hasText: 'AI ret önerisi' });
  assert.equal(await rejectRow.locator('[data-testid=prereview-badge]').getAttribute('data-status'), 'ai_rejected_suggestion');
  assert.match(await rejectRow.locator('[data-testid=admin-decision]').innerText(), /Yönetici kararı yok/);
  ok('ai_reject_suggestion_does_not_reject');
  await p.getByRole('table', { name: 'Kütüphane içerikleri' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await shot('01-library-items-prereview-badge');

  stage = 'gate_closed';
  const gate = p.getByTestId('prereview-gate-closed');
  assert.match(await gate.innerText(), /content_prereview\.enabled/);
  assert.equal(await approvedRow.getByRole('button', { name: 'AI ön incelemesi iste' }).isDisabled(), true);
  assert.equal(await p.getByRole('button', { name: 'Karar bekleyen tümünü kuyruğa al' }).isDisabled(), true);
  await gate.scrollIntoViewIfNeeded();
  await shot('02-gate-closed-reason');
  ok('gate_closed_explains_reason_and_disables_requests');

  stage = 'trail';
  await p.getByRole('combobox', { name: /^AI ön inceleme/ }).selectOption('needs_admin');
  const contribution = p.locator('[data-testid=content-item]').filter({ hasText: 'Çevre sorusu (düzeltilmiş)' });
  await contribution.waitFor();
  assert.equal(await p.locator('[data-testid=content-item]').count(), 1);
  assert.match(await contribution.locator('[data-testid=prereview-badge]').innerText(), /BEKLİYOR — yönetici kararı/);
  await contribution.getByRole('button', { name: 'Ret → düzeltme izini göster' }).click();
  const trail = p.getByTestId('contribution-trail');
  await trail.waitFor();
  const trailText = await trail.innerText();
  assert.match(trailText, /1\. kopya · Reddedildi/);
  assert.match(trailText, /Cevap anahtarı eksik; birimi ekleyin\./);
  assert.match(trailText, /2\. kopya · İnceleme bekliyor · güncel kopya · önceki reddedilen kopyanın düzeltmesi/);
  await trail.scrollIntoViewIfNeeded();
  await shot('03-contribution-correction-trail');
  ok('rejection_correction_trail_visible');

  stage = 'request_with_gate_open_edge_missing';
  await api(token, 'PATCH', '/app_settings?key=eq.content_prereview.enabled', { value: true }, { prefer: 'return=minimal' });
  await p.goto(site + '/library?tab=items');
  const row2 = p.locator('[data-testid=content-item]').filter({ hasText: 'AI ret önerisi' });
  await row2.waitFor();
  await p.getByText('AI ön inceleme açık.', { exact: false }).waitFor();
  const before = edgeCalls;
  await row2.getByRole('button', { name: 'AI ön incelemesi iste' }).click();
  await row2.getByText(/AI ön inceleme hizmetine \(content-prereview\) ulaşılamadı/).waitFor();
  assert.equal(edgeCalls, before + 1);
  assert.equal(await row2.locator('[data-testid=prereview-badge]').getAttribute('data-status'), 'ai_rejected_suggestion');
  await shot('04-request-edge-missing');
  await api(token, 'PATCH', '/app_settings?key=eq.content_prereview.enabled', { value: false }, { prefer: 'return=minimal' });
  ok('request_without_edge_shows_explicit_error_and_keeps_verdict');

  stage = 'policy_preview';
  await p.goto(site + '/library?tab=policy');
  const preview = p.getByTestId('policy-preview');
  await preview.getByText(/kabul edilen soruda toplam/).waitFor();
  await preview.scrollIntoViewIfNeeded();
  await shot('05-policy-preview');
  ok('policy_preview_visible');

  stage = 'curriculum_sources';
  await p.goto(site + '/library?tab=curriculum');
  const sources = p.getByTestId('curriculum-sources');
  await sources.waitFor();
  const math = sources.locator('[data-testid=curriculum-source]').filter({ hasText: 'İlköğretim Matematik' });
  await math.waitFor();
  assert.equal(await sources.locator('[data-testid=curriculum-source]').count(), 3);
  assert.equal(await math.locator('[data-testid=source-revision]').count(), 2);
  assert.match(await math.innerText(), /Yeni sürüm — fark incelemesi gerekli/);
  assert.match(await math.getByTestId('source-stale').innerText(), /Son kontrol 10 gün önce/);
  assert.equal(await sources.locator('[data-testid=curriculum-source]').filter({ hasText: 'Türkçe' }).getByTestId('source-stale').count(), 0);
  assert.match(await sources.locator('[data-testid=curriculum-source]').filter({ hasText: 'Fen Bilimleri' }).getByTestId('source-stale').innerText(), /doğrulanamadı/);
  await sources.scrollIntoViewIfNeeded();
  await shot('06-curriculum-source-revisions');
  ok('source_revisions_hash_last_check_diff_and_stale_visible');
  await math.getByRole('button', { name: 'Resmî dizini kontrol et' }).click();
  await math.getByText(/curriculum-source-fetch sunucu fonksiyonuna ulaşılamadı/).waitFor();
  await math.scrollIntoViewIfNeeded();
  await shot('07-official-index-check-edge-missing');
  ok('official_index_check_without_edge_explicit_error');
  await math.locator('[data-testid=source-revision][data-status=diff_review_required]').getByRole('button', { name: 'Bu sürümü onayla' }).click();
  await math.getByLabel('Karşılaştırma notu').fill('Yerel sentetik test: iki dosyanın sayfa ve hücreleri karşılaştırıldı.');
  await math.getByLabel('Resmî dosyayı ve özeti kontrol ettim.').check();
  await math.getByRole('button', { name: 'Kararı kaydet' }).click();
  await math.getByText(/Karar kaydedildi: Onaylı kopya/).waitFor();
  await math.locator('[data-testid=source-revision][data-status=superseded]').waitFor();
  assert.equal(await math.getAttribute('data-freshness'), 'verified');
  await shot('08-revision-approved');
  ok('revision_approve_with_note_and_confirmation');

  stage = 'ai_matrix';
  await p.goto(site + '/ai');
  const matrix = p.getByTestId('ai-policy-matrix');
  await matrix.waitFor();
  assert.ok(await matrix.getByRole('table', { name: 'Paket ve işlem sınırları' }).locator('tbody tr').count() >= 3);
  assert.match(await matrix.innerText(), /Fotoğraftan takvim/);
  assert.match(await matrix.innerText(), /Desteklenmiyor|Destekleniyor/);
  await matrix.scrollIntoViewIfNeeded();
  await shot('09-ai-policy-matrix');
  ok('ai_policy_matrix_read_only_table');
  await p.getByRole('button', { name: 'Kapatma etkisi' }).first().click();
  const disable = p.getByTestId('model-disable-preview');
  await disable.waitFor();
  assert.match(await disable.innerText(), /Etkilenen paketler/);
  await disable.scrollIntoViewIfNeeded();
  await shot('10-model-disable-preview');
  ok('model_disable_impact_preview');
  await p.getByRole('combobox', { name: /^Mevcut sağlayıcı/ }).selectOption('anthropic');
  await p.getByRole('combobox', { name: /^Hedef sağlayıcı/ }).selectOption('gemini');
  await p.getByRole('button', { name: 'Etkiyi hesapla' }).click();
  const impact = p.getByTestId('provider-change-impact');
  await impact.waitFor();
  assert.match(await impact.innerText(), /Geçiş şu an mümkün değil: sağlayıcı yapılandırılmadı/);
  assert.match(await impact.innerText(), /GEMINI_API_KEY/);
  await impact.scrollIntoViewIfNeeded();
  await shot('11-provider-change-impact');
  ok('provider_change_impact_blocked_with_reasons');

  stage = 'failure_queue';
  await p.goto(site + '/operations');
  const status = p.getByTestId('failure-queue-status');
  await status.getByText('1–25 / 27 kayıt', { exact: false }).waitFor();
  await p.getByRole('button', { name: 'Sonraki 25' }).click();
  await status.getByText('26–27 / 27 kayıt', { exact: false }).waitFor();
  await p.getByRole('combobox', { name: /^İşlem türü/ }).selectOption('plan');
  await status.getByText('/ 13 kayıt', { exact: false }).waitFor();
  await p.getByRole('combobox', { name: /^Göster/ }).selectOption('done');
  await status.getByText('/ 7 kayıt', { exact: false }).waitFor();
  await shot('12-operations-failure-queue');
  ok('failure_queue_server_side_filter_and_pagination');

  assert.deepEqual(errors, []);
  ok('no_page_exceptions_or_horizontal_overflow');
  console.log(JSON.stringify(checks));
  await browser.close();
  server.close();
})().catch(async (e) => {
  checks['failed_at_' + stage] = false;
  console.error('CHECK_FAILED ' + stage + ' ' + String(e && e.message).slice(0, 800));
  if (p) {
    try { await p.screenshot({ path: '/tmp/gina-cqui-failed.png' }); } catch {}
  }
  console.log(JSON.stringify(checks));
  if (browser) await browser.close();
  if (server) server.close();
  process.exitCode = 1;
});
