// P04 UI bağlama kabulü. Yalnız test-isolated-services.py --ui-hold'un geçici sentetik fixture'ı kabul edilir.
// Ortam: GINA_QA_UI_FIXTURE (fixture JSON), GINA_QA_WEB (yerel web export adresi), GINA_QA_WEB_BACKEND (export'a gömülü
// loopback yer tutucu adres; istekler fixture'a yönlendirilir), GINA_QA_WEB_ANON (gömülü yer tutucu anon anahtar),
// GINA_QA_PLAYWRIGHT_PATH. Ücretli AI çağrısı yok; puanlar veli RPC'leriyle verilir.
const fs = require('node:fs'), assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const out = __dirname; const results = []; let browser, page, kid, stage = 'setup';
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const TITLE = 'Fen – Işık ve Gölge (P04 ' + randomUUID().slice(0, 4) + ')';
// Satır bazlı: başlıktan sonraki n satır (aynı kart).
const after = (body, n = 3) => body.split('\n').flatMap((l, i, a) => l.trim() === TITLE ? [a.slice(i + 1, i + 1 + n).join(' | ')] : []);
const drawing = { version: 1, width: 1000, height: 1400, elements: [{ id: randomUUID(), type: 'stroke', color: '#201951', size: 4, points: [[120, 140], [260, 300], [420, 330], [520, 260]] }] };

(async () => {
  const login = await fetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
  assert.ok(login.ok); const session = await login.json();
  async function api(path, body, prefer) {
    const res = await fetch(f.url + '/rest/v1/' + path, { method: body ? 'POST' : 'GET', headers: { apikey: f.anon, authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); assert.ok(res.ok, path + ' ' + text.slice(0, 300)); return text ? JSON.parse(text) : null;
  }
  stage = 'seed';
  const child = (await api(`children?id=eq.${f.childId}&select=id,name`))[0]; assert.ok(child);
  const qs = await api('question_bank', [
    { family_id: f.familyId, grade: 5, subject: 'Fen Bilimleri', topic: 'Işık', kind: 'multiple_choice', stem: 'Hangisi doğal ışık kaynağıdır?', choices: [{ key: 'A', text: 'Güneş' }, { key: 'B', text: 'Ay' }], correct_key: 'A', expected_answer: null },
    { family_id: f.familyId, grade: 5, subject: 'Fen Bilimleri', topic: 'Işık', kind: 'open_ended', stem: 'Işığın yayılmasını çizerek göster.', choices: null, correct_key: null, expected_answer: 'Işık doğrusal yollarla her yöne yayılır.' },
    { family_id: f.familyId, grade: 5, subject: 'Fen Bilimleri', topic: 'Gölge', kind: 'open_ended', stem: 'Gölge nasıl oluşur?', choices: null, correct_key: null, expected_answer: 'Işığın önüne saydam olmayan bir cisim konunca.' },
  ], 'return=representation');
  const [mc, drawn, blank] = qs.map(q => q.id);
  const exam = (await api('exams', [{ family_id: f.familyId, child_id: child.id, title: TITLE, subject: 'Fen Bilimleri', grade: 5, question_ids: [mc, drawn, blank], status: 'assigned' }], 'return=representation'))[0];
  const started = await api('rpc/start_exam_attempt', { p_exam_id: exam.id }); const attemptId = Array.isArray(started) ? started[0].id : started.id;
  await api('rpc/submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: attemptId, p_question_id: mc, p_expected_revision: 0, p_answer_key: 'A' });
  // Yalnız çizim: metin yok, defterde bir çizgi.
  await api('rpc/submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: attemptId, p_question_id: drawn, p_expected_revision: 0, p_answer_document: drawing });
  // Üçüncü soru hiç cevaplanmadı.
  await api('rpc/finish_exam_attempt', { p_attempt_id: attemptId });
  const s0 = await api('rpc/get_attempt_summary', { p_attempt_id: attemptId });
  assert.deepEqual([s0.status, s0.review_state, s0.pending_open_count, s0.unanswered_open_count, s0.provisional, s0.score_pct], ['submitted', 'pending_review', 1, 1, true, 100]);
  results.push({ check: 'server_drawing_only_pending_blank_unanswered_provisional_100', passed: true });

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function context() {
    const c = await browser.newContext({ viewport: sizes.phone, locale: 'tr-TR' });
    // Export'a gömülü yer tutucu backend → bu geçici fixture (yalnız loopback). Anahtar yer tutucusu fixture anon'u ile değişir.
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
    const p = await c.newPage(); p.setDefaultTimeout(25000);
    const errors = []; p.on('pageerror', e => errors.push(e.message)); p.errors = errors;
    return p;
  }
  const text = p => p.locator('body').innerText();
  async function waitText(p, needle) { await p.waitForFunction(n => document.body.innerText.includes(n), needle, { timeout: 25000 }); }
  async function shot(p, name) {
    await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': no horizontal overflow');
    assert.ok(!/prova\.ai\.|prova\.provisional|provaBuilder\./.test(await text(p)), name + ': translations resolved');
  }
  async function signIn(p) {
    await p.goto(web); await p.getByLabel('E-posta', { exact: true }).fill(f.email); await p.getByLabel('Şifre', { exact: true }).fill(f.password);
    await p.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await p.waitForURL('**/parent');
  }
  page = await context(); stage = 'login'; await signIn(page);

  stage = 'hub_pending';
  for (const [size, vp] of Object.entries(sizes)) {
    await page.setViewportSize(vp); await page.goto(`${web}/parent/prova`);
    await waitText(page, TITLE);
    const cards = after(await text(page), 2);
    assert.ok(cards.some(c => c.includes('1 açık uçlu cevap incelemeni bekliyor · 1 soru cevapsız')), size + ' hub card: ' + cards.join(' // '));
    await shot(page, `hub-pending-${size}`);
  }
  results.push({ check: 'hub_review_card_shows_waiting_and_unanswered_counts', passed: true });

  stage = 'attempt_pending';
  for (const [size, vp] of Object.entries(sizes)) {
    await page.setViewportSize(vp); await page.goto(`${web}/parent/prova/attempt/${attemptId}`);
    await waitText(page, 'Ara sonuç'); await waitText(page, '3. soru · Cevap yok');
    const body = await text(page);
    for (const n of ['1 açık uçlu cevap incelemeni bekliyor', '1 soru cevapsız', '100 / 100', '2. soru · Puan bekliyor', 'Cevap yok: 0 puan ver', 'Açık uçlu: 0 puanlandı · 1 bekliyor · 1 cevap yok'])
      assert.ok(body.includes(n), size + ' missing ' + n);
    assert.ok(!body.includes('Puan: 0 / 100') && !body.includes('2 / 2 puanlandı'), 'no auto zero');
    // Önce inceleme durumu, sonra puan.
    assert.ok(body.indexOf('1 açık uçlu cevap incelemeni bekliyor') < body.indexOf('Ara sonuç'), 'review state before score');
    await shot(page, `attempt-pending-${size}`);
  }
  results.push({ check: 'parent_summary_review_state_first_then_provisional_score_and_no_answer_not_zero', passed: true });

  stage = 'review_workspace';
  await page.setViewportSize(sizes.phone);
  await page.goto(`${web}/parent/prova/review/${attemptId}?questionId=${blank}`);
  await waitText(page, 'Bu soru için cevap gönderilmemiş'); await shot(page, 'review-blank-question-phone');
  await page.setViewportSize(sizes.desktop); await page.waitForTimeout(800);
  const navStates = (await text(page)).match(/Cevap yok|İnceleme bekliyor|Değerlendirildi/g) ?? [];
  await shot(page, 'review-blank-question-desktop');
  results.push({ check: 'review_workspace_blank_question_shows_no_answer', passed: true, detail: { desktopStateLabels: navStates } });

  stage = 'progress';
  await page.goto(`${web}/parent/prova/progress?childId=${child.id}`);
  await waitText(page, 'değerlendirme bekliyor'); await shot(page, 'progress-pending-phone');
  const lp = await api('rpc/learning_progress_education', { p_child_id: child.id, p_days: 30, p_period: 'all' });
  const topic = lp.topics.find(t => t.topic === 'Gölge' && t.subject === 'Fen Bilimleri'); assert.ok(topic, 'topic Gölge present');
  assert.equal(topic.wrong ?? 0, 0, 'blank open answer not counted wrong');
  const light = lp.topics.find(t => t.topic === 'Işık' && t.subject === 'Fen Bilimleri'); assert.ok((light.pending ?? 0) >= 1 && (light.wrong ?? 0) === 0, 'drawing pending not wrong');
  results.push({ check: 'progress_counts_pending_and_blank_not_wrong', passed: true, detail: { isik: { pending: light.pending, wrong: light.wrong, correct: light.correct }, golge: { pending: topic.pending, wrong: topic.wrong, blank: topic.blank } } });

  stage = 'child_mode_pending';
  kid = await context(); await signIn(kid);
  await kid.goto(`${web}/parent/child-mode`);
  await kid.getByText(child.name, { exact: true }).first().click();
  await kid.getByLabel('Çocuk PIN’i').fill('1234'); await kid.getByRole('button', { name: 'Dünyama gir' }).click();
  await kid.waitForURL('**/child-mode/today');
  for (const [size, vp] of Object.entries(sizes)) {
    await kid.setViewportSize(vp); await kid.goto(`${web}/parent/child-mode/prova`);
    await waitText(kid, TITLE); await waitText(kid, 'Açık uçlu cevaplarını ebeveynin inceleyecek; puanın şimdilik ara sonuç.');
    const body = await text(kid); const card = after(body, 4)[0] ?? ''; assert.ok(card.includes('Ara sonuç') && card.includes('Çoktan seçmeli: 1 / 1 doğru') && card.includes('puanın şimdilik ara sonuç'), 'child card: ' + card);
    assert.ok(!body.includes('boş bıraktın') && !/\b0 \/ 100\b/.test(body), 'child sees no blank count or zero');
    await shot(kid, `child-prova-pending-${size}`);
  }
  results.push({ check: 'child_list_partial_result_consistent_with_parent_review', passed: true });

  stage = 'give_zero';
  await page.setViewportSize(sizes.phone); await page.goto(`${web}/parent/prova/attempt/${attemptId}`);
  await waitText(page, '3. soru · Cevap yok');
  await page.getByRole('button', { name: '3. soruya 0 puan ver; çocuk bu soruya cevap vermedi' }).click();
  await waitText(page, '3. soru · 0 / 100'); await waitText(page, '50 / 100');
  let body = await text(page); assert.ok(body.includes('Ara sonuç') && body.includes('1 açık uçlu cevap incelemeni bekliyor') && !body.includes('1 soru cevapsız'));
  await shot(page, 'attempt-after-explicit-zero-phone');
  const s1 = await api('rpc/get_attempt_summary', { p_attempt_id: attemptId });
  assert.deepEqual([s1.status, s1.pending_open_count, s1.unanswered_open_count, s1.provisional, s1.score_pct, s1.open_graded], ['submitted', 1, 0, true, 50, 1]);
  results.push({ check: 'explicit_zero_from_ui_is_graded_attempt_still_provisional_50', passed: true });

  stage = 'graded';
  // Çizimli cevabın puanı: velinin puan RPC'si (inceleme çalışma alanı bu turda sürülmedi).
  await api('rpc/score_open_answer', { p_attempt_id: attemptId, p_question_id: drawn, p_score: 80 });
  for (const [size, vp] of Object.entries(sizes)) {
    await page.setViewportSize(vp); await page.goto(`${web}/parent/prova/attempt/${attemptId}`);
    await waitText(page, 'Puan: 60 / 100'); body = await text(page);
    assert.ok(!body.includes('Ara sonuç') && !body.includes('incelemeni bekliyor') && !body.includes('Cevap yok: 0 puan ver'), size + ' graded view clean');
    assert.ok(body.includes('2. soru · 80 / 100') && body.includes('3. soru · 0 / 100'));
    await shot(page, `attempt-graded-${size}`);
  }
  const s2 = await api('rpc/get_attempt_summary', { p_attempt_id: attemptId });
  assert.deepEqual([s2.status, s2.review_state, s2.provisional, s2.score_pct], ['graded', 'graded', false, 60]); assert.ok(s2.graded_at);
  await page.setViewportSize(sizes.phone); await page.goto(`${web}/parent/prova`);
  await waitText(page, TITLE); body = await text(page);
  const hubCards = after(body); assert.ok(hubCards.length >= 1 && hubCards.every(c => !c.includes('incelemeni bekliyor')) && hubCards.some(c => c.includes('Çoktan seçmeli: 1 / 1 doğru')), 'hub no longer pending: ' + hubCards.join(' // ')); await shot(page, 'hub-graded-phone');
  for (const [size, vp] of Object.entries(sizes)) {
    await kid.setViewportSize(vp); await kid.goto(`${web}/parent/child-mode/prova`);
    await waitText(kid, TITLE); await kid.waitForTimeout(800); body = await text(kid);
    const kidCards = after(body); assert.ok(kidCards.length === 1 && !kidCards[0].includes('Ara sonuç') && kidCards[0].includes('Çoktan seçmeli: 1 / 1 doğru'), size + ' child no longer provisional: ' + kidCards.join(' // '));
    await shot(kid, `child-prova-graded-${size}`);
  }
  results.push({ check: 'parent_score_closes_attempt_graded_60_hub_and_child_consistent', passed: true });

  assert.deepEqual([...page.errors, ...kid.errors], []); results.push({ check: 'no_runtime_page_errors', passed: true });
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-real-auth-rest + expo web export', viewports: sizes, results }, null, 2) + '\n');
  console.log(JSON.stringify(results)); await browser.close();
})().catch(async e => {
  console.log('CHECK_FAILED ' + stage + ' ' + String(e.message).slice(0, 900));
  const dir = process.env.GINA_QA_FAIL_DIR || out;
  if (kid) { try { await kid.screenshot({ path: dir + '/failed-kid-' + stage + '.png' }); fs.writeFileSync(dir + '/failed-kid-' + stage + '.txt', await kid.locator('body').innerText()); } catch {} }
  if (page) { try { await page.screenshot({ path: dir + '/failed-' + stage + '.png' }); fs.writeFileSync(dir + '/failed-' + stage + '.txt', await page.locator('body').innerText()); } catch {} }
  if (browser) await browser.close(); process.exitCode = 1;
});
