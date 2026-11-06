// C08 kabul (Playwright, gerçek izole Auth/REST/Storage/Edge + web export). Yalnız
// test-isolated-services.py --with-storage --ui-hold'un geçici sentetik fixture'ı (loopback) kabul edilir.
// Ortam: GINA_QA_UI_FIXTURE, GINA_QA_WEB, GINA_QA_WEB_BACKEND, GINA_QA_WEB_ANON, GINA_QA_PLAYWRIGHT_PATH.
// Gerçek: kullanım kartı get_ai_usage'tan, AI önerisi prova-grade Edge + deterministik sağlayıcıdan, veli kaydı
// save_answer_review'dan. Taklit (açıkça): gövdesiz gateway 401 bu test tarafından enjekte edilir; yenilemeden
// sonraki prova-review yanıtı sentetiktir (yerel Edge'de prova-review uç noktası yok).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const { createClient } = require(path.resolve(__dirname, '../../../../node_modules/@supabase/supabase-js'));
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
assert.ok(f.c08AttemptId && f.c08QuestionId, 'c08 fixture ids');
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const out = __dirname; const results = []; let browser, stage = 'setup';
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail === undefined ? {} : { detail }) }); console.error('ok ' + check); };

(async () => {
  const db = createClient(f.url, f.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.ok(!(await db.auth.signInWithPassword({ email: f.email, password: f.password })).error, 'login');
  const must = async (p, label) => { const r = await p; if (r.error) throw new Error(label + ': ' + (r.error.message || JSON.stringify(r.error))); return r.data; };
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const traffic = { review: 0, refresh: 0, reviewBodies: [] };
  const c = await browser.newContext({ viewport: sizes.desktop, locale: 'tr-TR' });
  await c.route(backend + '/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = req.url();
    if (url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token')) traffic.refresh++;
    if (url.includes('/functions/v1/prova-review')) {
      traffic.review++; traffic.reviewBodies.push(req.postData());
      // 1. çağrı: hosted gateway verify_jwt reddinin taklidi — 401, gövde yok.
      if (traffic.review === 1) return route.fulfill({ status: 401, body: '', headers: { 'access-control-allow-origin': '*' } });
      // 2. çağrı (yenilemeden sonra): sentetik öneri; yerel Edge'de bu uç kayıtlı değil.
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ id: '00000000-0000-4000-8000-0000000c0801', result: { score: 70, readable: true, feedback: 'Sentetik öneri.', evidence: ['Sentetik kanıt'], next_step: 'Sentetik adım.', limitation: '' } }) });
    }
    const headers = { ...req.headers() };
    if (headers.apikey === placeholderAnon) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + placeholderAnon) headers.authorization = 'Bearer ' + f.anon;
    try {
      const res = await route.fetch({ url: f.url + url.slice(backend.length), headers });
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
    } catch { await route.fulfill({ status: 503, body: 'fixture unavailable' }); }
  });
  const page = await c.newPage(); page.setDefaultTimeout(25000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const body = () => page.locator('body').innerText();
  async function shot(name, list) {
    for (const size of list) {
      await page.setViewportSize(sizes[size]); await page.waitForTimeout(700);
      await page.screenshot({ path: `${out}/${name}-${size}.png`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `${name}-${size}: horizontal overflow ${overflow}`);
      assert.ok(!/\bc08\.|provaC04\.|parentReview\./.test(await body()), `${name}-${size}: untranslated key`);
    }
    await page.setViewportSize(sizes.desktop);
  }

  stage = 'login';
  await page.goto(web); await page.getByLabel('E-posta', { exact: true }).fill(f.email); await page.getByLabel('Şifre', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await page.waitForURL('**/parent');

  // 1) Paketler: kullanım / yenilenme / medya — get_ai_usage tek kaynak; 7 günlük ipucu görünmez.
  stage = 'usage';
  await page.goto(web + '/parent/subscription');
  const card = page.getByTestId('ai-usage-card'); await card.waitFor();
  const text = await card.innerText();
  for (const row of ['Haftalık aile özeti', 'Fotoğraftan takvim ve belge analizi', 'Açık uçlu cevap önerisi', 'Çalışma planı', 'Prova soru üretimi']) assert.ok(text.includes(row), 'usage row ' + row);
  assert.match(text, /en çok 5 dosya, toplam 20 MB/);
  assert.match(text, /Haklar .* tarihinde yenilenir/);
  assert.ok(!/ipucu/i.test(await body()), 'daily tips must not be advertised');
  const usage = await must(db.rpc('get_ai_usage'), 'usage');
  const imp = usage.operations.find(o => o.action === 'import');
  assert.ok(text.includes(`Bu dönem ${imp.used} / ${imp.limit} kullanıldı · ${imp.remaining} kaldı`), 'import counts equal server');
  await shot('usage-card', ['phone', 'tablet', 'desktop']);
  pass('usage_card_matches_get_ai_usage', { import: { used: imp.used, limit: imp.limit, remaining: imp.remaining }, media_max_files: usage.media.max_files });
  pass('daily_tips_not_shown');

  // 2) Deneme özeti: AI önerisi ayrı, onay bekliyor; ara sonuç.
  stage = 'attempt';
  await page.goto(web + '/parent/prova/attempt/' + f.c08AttemptId);
  await page.getByTestId('attempt-ai-suggestion').waitFor();
  assert.match(await page.getByTestId('attempt-ai-suggestion').innerText(), /AI önerisi 70\/100 · onayın bekleniyor/);
  await shot('attempt-ai-suggestion', ['phone', 'desktop']);
  pass('attempt_shows_ai_suggestion_not_final');

  // 3) İnceleme: taslak yaz → AI önerisi al → gövdesiz 401 → oturum yenile → aynı istek bir kez → taslak korunur.
  stage = 'review_401';
  await page.goto(web + `/parent/prova/review/${f.c08AttemptId}?questionId=${f.c08QuestionId}`);
  await page.getByTestId('review-ai-suggestion').waitFor();
  assert.match(await page.getByTestId('review-ai-suggestion').innerText(), /AI önerisi: 70\/100/);
  const feedback = page.getByLabel('Çocuğa geri bildirim', { exact: true });
  await feedback.fill('C08 taslak: birimi de yaz.');
  await page.getByRole('button', { name: 'AI önerisi al' }).click();
  await page.getByRole('switch', { name: 'Bu inceleme için paylaşmayı onaylıyorum.' }).click();
  await page.getByRole('button', { name: 'Çözümü incele' }).click();
  await page.getByText('Sentetik öneri.').waitFor();
  assert.equal(traffic.review, 2, 'exactly one retry after refresh');
  assert.ok(traffic.refresh >= 1, 'session refreshed');
  assert.equal(traffic.reviewBodies[0], traffic.reviewBodies[1], 'same request body retried');
  assert.equal(await feedback.inputValue(), 'C08 taslak: birimi de yaz.', 'draft preserved');
  pass('gateway_401_refreshes_session_and_retries_once_draft_kept', { review_calls: traffic.review, refresh_calls: traffic.refresh });
  await shot('review-after-401-retry', ['desktop']);

  // 4) AI önerisini puan alanına al → veli kaydeder → kesin puan veli kaydı.
  stage = 'review_confirm';
  const before = await must(db.from('exam_answers').select('score,graded_by,ai_score').eq('attempt_id', f.c08AttemptId).eq('question_id', f.c08QuestionId).single(), 'before');
  assert.deepEqual([before.score, before.graded_by, before.ai_score], [null, null, 70]);
  await page.getByRole('button', { name: 'Öneriyi puan alanına al (70)' }).click();
  assert.equal(await page.getByLabel('Puan', { exact: true }).inputValue(), '70');
  await shot('review-suggestion-in-score', ['phone', 'tablet', 'desktop']);
  await page.getByRole('button', { name: 'Kaydet ve özete dön' }).click();
  let after;
  for (let i = 0; i < 40; i++) {
    after = await must(db.from('exam_answers').select('score,graded_by').eq('attempt_id', f.c08AttemptId).eq('question_id', f.c08QuestionId).single(), 'after');
    if (after.graded_by === 'parent') break; await page.waitForTimeout(500);
  }
  assert.deepEqual([after.score, after.graded_by], [70, 'parent']);
  const summary = await must(db.rpc('get_attempt_summary', { p_attempt_id: f.c08AttemptId }), 'summary');
  assert.equal(summary.review_state, 'graded');
  pass('parent_confirmation_makes_score_final', { score: after.score, graded_by: after.graded_by, review_state: summary.review_state });
  await page.goto(web + '/parent/prova/attempt/' + f.c08AttemptId);
  await page.getByText(/70/).first().waitFor();
  assert.equal(await page.getByTestId('attempt-ai-suggestion').count(), 0, 'suggestion label gone after confirmation');
  await shot('attempt-confirmed', ['phone']);
  pass('attempt_after_confirmation_no_pending_suggestion');
  assert.deepEqual(errors, [], 'page errors');
  pass('no_page_errors');
})().catch(e => { results.push({ check: 'failed_at_' + stage, passed: false, detail: String(e.message || e).slice(0, 400) }); console.error(e); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); fs.writeFileSync(path.join(out, 'ui-checks.json'), JSON.stringify({ environment: 'isolated-auth-rest-storage-edge + expo web export + Playwright chrome', results }, null, 2)); });
