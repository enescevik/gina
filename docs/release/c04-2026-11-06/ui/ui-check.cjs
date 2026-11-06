// C04 kabul zinciri (Playwright, gerçek izole Auth/REST/Storage/Edge). Yalnız
// test-isolated-services.py --with-storage --ui-hold'un geçici sentetik fixture'ı kabul edilir (loopback).
// Ortam: GINA_QA_UI_FIXTURE, GINA_QA_WEB (statik export), GINA_QA_WEB_BACKEND (export'a gömülü yer tutucu),
// GINA_QA_WEB_ANON (yer tutucu anon), GINA_QA_PLAYWRIGHT_PATH. AI: izole Edge'deki gerçek prova-generate
// handler'ı + deterministik sağlayıcı (scripts/isolated-ai-provider.ts) — ücretli/gerçek AI değil.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const { createClient } = require(path.resolve(__dirname, '../../../../node_modules/@supabase/supabase-js'));
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const out = __dirname; const results = []; let browser, stage = 'setup', page, childPage;
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const TAG = crypto.randomUUID().slice(0, 4);
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail === undefined ? {} : { detail }) }); console.error('ok ' + check); };

(async () => {
  const db = createClient(f.url, f.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await db.auth.signInWithPassword({ email: f.email, password: f.password });
  assert.ok(!login.error, 'login');
  const must = async (p, label) => { const r = await p; if (r.error) throw new Error(label + ': ' + (r.error.message || JSON.stringify(r.error))); return r.data; };

  // ---- Sentetik tohum: çocuk 6. sınıf + eğitim dönemi; kütüphane şıklısı; ortak GÖRSELE bağlı iki soru.
  stage = 'seed';
  await must(db.from('children').update({ grade: 6 }).eq('id', f.childId), 'child_grade');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const edu = await db.rpc('get_child_education', { p_child_id: f.childId });
  if (!edu.data?.current) {
    await must(db.rpc('change_child_education', { p_request_id: crypto.randomUUID(), p_child_id: f.childId, p_revision: edu.data?.revision ?? 0, p_action: 'initial',
      p_academic_year: Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 9 ? 1 : 0), p_grade: 6, p_school: 'Sentetik Ortaokulu', p_starts_on: today, p_timetable_revision: 0, p_keep_timetable: true }), 'education_initial');
  }
  const period = (await must(db.rpc('get_child_education', { p_child_id: f.childId }), 'education_read')).current;
  assert.ok(period?.id, 'education period');
  const libId = crypto.randomUUID();
  await must(db.rpc('save_question_with_sources', { p_request_id: libId, p_question: { grade: 6, subject: 'Matematik', topic: 'Kesirler', kind: 'multiple_choice', difficulty: 'orta',
    stem: `Kütüphane sorusu ${TAG}: Hangisi 1/2'ye eşittir?`, choices: [{ key: 'A', text: '2/4' }, { key: 'B', text: '1/3' }, { key: 'C', text: '3/4' }, { key: 'D', text: '2/3' }], correct_key: 'A',
    solution: '2/4 sadeleşince 1/2 olur.', explanation: 'B, C ve D yarımdan farklıdır.' }, p_images: [] }), 'library_question');
  // Ortak görsel: learning-source Edge (gerçek handler) → Storage imzalı yükleme → finalize.
  const fixtureTs = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/functions/ai-preflight/fixture.ts'), 'utf8');
  const png = Buffer.from(fixtureTs.match(/"([A-Za-z0-9+/=]{100,})"/)[1], 'base64');
  const imageId = crypto.randomUUID();
  const reserve = await must(db.functions.invoke('learning-source', { body: { action: 'reserve', id: imageId, kind: 'question_image', name: 'ortak.png', mime: 'image/png', bytes: png.length,
    sha256: crypto.createHash('sha256').update(png).digest('hex'), consent: true } }), 'image_reserve');
  await must(db.storage.from(reserve.bucket).uploadToSignedUrl(reserve.path, reserve.token, png, { contentType: 'image/png' }), 'image_upload');
  await must(db.functions.invoke('learning-source', { body: { action: 'finalize', id: imageId } }), 'image_finalize');
  const groupId = crypto.randomUUID();
  await must(db.rpc('save_question_source_group', { p_request_id: groupId, p_group: { title: `Ders programı ${TAG}`, body: 'Görseldeki haftalık ders programını incele.', subject: 'Matematik', grade: 6 },
    p_questions: [
      { kind: 'open_ended', topic: 'Tablo okuma', difficulty: 'orta', stem: 'Pazartesi ilk ders hangisidir?', expected_answer: 'Matematik', solution: 'Pazartesi satırını oku.' },
      { kind: 'open_ended', topic: 'Tablo okuma', difficulty: 'orta', stem: 'Matematik dersi kaç dakika sürer?', expected_answer: '40 dakika', solution: '09:00–09:40 arası.' },
    ], p_images: [{ source_id: imageId, alt: 'Sentetik haftalık ders programı görseli' }] }), 'shared_image_group');
  const members = await must(db.from('question_source_members').select('question_id,position').eq('group_id', groupId).order('position'), 'group_members');
  assert.equal(members.length, 2);
  // Görsel bağı RLS ile veliye doğrudan açık değil; çocuk ekranında görselin yüklendiği ayrıca doğrulanır.
  pass('seed_library_and_shared_image_group', { members: 2, image_source: 'question_image' });

  // ---- Tarayıcı
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function context(viewport) {
    const c = await browser.newContext({ viewport: viewport || sizes.phone, locale: 'tr-TR' });
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
    p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
    return p;
  }
  const body = p => p.locator('body').innerText();
  async function shot(p, name, sizesToTake) {
    for (const size of sizesToTake || ['phone']) {
      await p.setViewportSize(sizes[size]); await p.waitForTimeout(700);
      await p.screenshot({ path: `${out}/${name}-${size}.png`, fullPage: true });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `${name}-${size}: horizontal overflow ${overflow}`);
      assert.ok(!/provaC04\.|provaBuilder\.|provaP0[12]\.|parentReview\./.test(await body(p)), `${name}-${size}: untranslated key`);
    }
    await p.setViewportSize(sizes.phone);
  }
  async function signIn(p) {
    await p.goto(web); await p.getByLabel('E-posta', { exact: true }).fill(f.email); await p.getByLabel('Şifre', { exact: true }).fill(f.password);
    await p.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await p.waitForURL('**/parent');
  }
  const btn = (p, name) => p.getByRole('button', { name, exact: true });
  page = await context(); stage = 'login'; await signIn(page);

  // ---- 1) Merkez: Hazırla / Gönderilenler / İncelenecekler
  stage = 'hub';
  await page.goto(web + '/parent/prova');
  for (const label of ['Hazırla', 'Gönderilenler', 'İncelenecekler']) await page.getByRole('tab', { name: new RegExp('^' + label) }).waitFor();
  await shot(page, 'hub-prepare', ['phone', 'tablet', 'desktop']);
  pass('hub_three_tabs');

  // ---- 2) Hazırlayıcı: başlangıç + bağlam kartı
  stage = 'builder_start';
  await btn(page, 'Prova hazırla').first().click();
  await page.waitForURL('**/parent/prova/builder**');
  const childName = (await must(db.from('children').select('name').eq('id', f.childId).single(), 'child_name')).name;
  await page.getByRole('button', { name: new RegExp('^' + childName) }).first().click();
  await btn(page, 'Konu pekiştirme').click();
  await btn(page, 'Matematik').click();
  await btn(page, 'Fen Bilimleri').click();
  await page.getByText('Sınav bilgisi', { exact: true }).waitFor();
  await btn(page, 'Tek ders').click();
  await page.getByText(/“Tek ders” seçtin ama 2 ders var/).waitFor();
  pass('context_single_subject_mismatch_explained');
  await btn(page, 'Karma (birden çok ders)').click();
  await btn(page, 'MEB Ortak Yazılı').click();
  await btn(page, '1. dönem').click();
  await page.getByRole('switch', { name: 'Bu kapsam okulun duyurusuna dayanıyor' }).click();
  await page.getByText(/Sentetik Ortaokulu/).first().waitFor();
  await shot(page, 'builder-context', ['phone', 'tablet', 'desktop']);
  await btn(page, 'Devam et').click();
  stage = 'builder_scope';
  await page.getByLabel('Konu ekle', { exact: true }).fill('Kuvvet');
  await btn(page, 'Ekle').click();
  await page.getByRole('button', { name: 'Kuvvet', exact: true }).waitFor();
  // hedef: kütüphane 1 + ortak görsel grubu 2 + elle 1 + AI 2 = 6
  await page.getByRole('radio', { name: '5', exact: true }).first().click();
  await page.getByLabel('Soru sayısı artır', { exact: true }).first().click();
  await btn(page, 'Karışık').click();
  await page.getByLabel(/^Soru sayısı: 6/).first().waitFor();
  await btn(page, 'Devam et').click();
  stage = 'builder_questions';
  await page.getByText(/0 \/ 6|0\/6/).first().waitFor();
  const draftId = new URL(page.url()).searchParams.get('draftId'); assert.ok(draftId, 'draft saved with id');
  pass('draft_saved_on_step');

  // 2a) Kütüphane: şıklı + ortak görsel grubu
  stage = 'picker_library';
  await btn(page, 'Soru ekle').first().click();
  await btn(page, 'Kütüphane').click();
  await page.getByText(`Kütüphane sorusu ${TAG}`, { exact: false }).first().click();
  await page.getByText(`Ders programı ${TAG}`, { exact: false }).first().click();
  await btn(page, 'Seçtiklerimi ekle').click();
  await page.getByText(/3 \/ 6|3\/6/).first().waitFor();
  pass('library_question_and_shared_image_group_added');

  // 2b) Elle: editörde alternatif cevap + rubrik
  stage = 'manual_editor';
  await btn(page, 'Soru ekle').first().click();
  await btn(page, 'Kendim ekleyeceğim').click();
  await btn(page, 'Soru ekle').last().click();
  await page.waitForURL('**/parent/prova/question**');
  await page.getByLabel('Konu', { exact: true }).fill('Kesirler');
  await btn(page, 'Açık uçlu').click();
  await page.getByLabel('Soru', { exact: true }).fill(`Elle soru ${TAG}: 3/6 kesrini sadeleştir.`);
  await btn(page, 'Devam').click();
  await page.getByLabel('Beklenen cevap', { exact: true }).fill('1/2');
  await page.getByLabel('Kabul edilecek diğer doğru cevaplar (isteğe bağlı)', { exact: true }).fill('0,5\nyarım');
  await page.getByLabel('Puanlama ölçütleri (isteğe bağlı)', { exact: true }).fill('Ortak böleni bulur | 40\nSonucu doğru yazar | 60');
  await page.getByLabel('Çözüm yolu', { exact: true }).fill('Pay ve paydayı 3 ile böl.');
  await shot(page, 'editor-rubric', ['phone', 'tablet']);
  await btn(page, 'Devam').click();
  await btn(page, 'Kaydet').click();
  await page.waitForURL('**/parent/prova/builder**');
  await page.getByText(/4 \/ 6|4\/6/).first().waitFor();
  const manual = (await must(db.from('question_bank').select('id,provenance').ilike('stem', `Elle soru ${TAG}%`), 'manual_row'))[0];
  assert.deepEqual(manual.provenance.rubric.alternative_answers, ['0,5', 'yarım']);
  assert.equal(manual.provenance.rubric.criteria.length, 2);
  pass('manual_question_with_alternatives_and_rubric');

  // 2c) AI: kalan 2 soru tek üretim; tümünü seç; ikinci ücret yok
  stage = 'ai_generate';
  const ent0 = await must(db.rpc('get_prova_entitlement'), 'entitlement_before');
  await btn(page, 'Soru ekle').first().click();
  await btn(page, 'AI ile hazırla').click();
  await btn(page, 'Fen Bilimleri').last().click();
  await btn(page, 'Kuvvet').last().click();
  await btn(page, 'Kalan 2 soruyu AI ile tamamla').click();
  await shot(page, 'ai-fill-remaining', ['phone', 'tablet']);
  await btn(page, 'Soruları hazırla').click();
  await page.getByText(/Önerilerin tümünü seç \(2\)/).waitFor({ timeout: 60000 });
  const ent1 = await must(db.rpc('get_prova_entitlement'), 'entitlement_after_generate');
  await btn(page, 'Önerilerin tümünü seç (2)').click();
  await page.getByText('2 seçildi').waitFor();
  await shot(page, 'ai-select-all', ['phone']);
  await btn(page, 'Seçtiklerimi ekle').click();
  await page.getByText(/6 \/ 6|6\/6/).first().waitFor();
  const ent2 = await must(db.rpc('get_prova_entitlement'), 'entitlement_after_select');
  assert.equal(ent0.ai_generate_remaining - ent1.ai_generate_remaining, 2, 'one generation of 2 consumed 2');
  assert.equal(ent1.ai_generate_remaining, ent2.ai_generate_remaining, 'selecting all suggestions costs nothing');
  pass('ai_partial_generation_select_all_single_charge', { before: ent0.ai_generate_remaining, afterGenerate: ent1.ai_generate_remaining, afterSelect: ent2.ai_generate_remaining });
  await page.getByText(/Bu taslakta: Senin eklediğin/).last().waitFor();
  const mix = (await body(page)).match(/Bu taslakta: Senin eklediğin[^\n]*/)[0];
  assert.match(mix, /AI/); assert.match(mix, /Kütüphane/); assert.match(mix, /ortak kaynak/i);
  await shot(page, 'builder-mixed-sources', ['phone', 'tablet', 'desktop']);
  pass('one_draft_three_sources_plus_shared_image', { mix });

  // ---- 3) Kaydet → yeniden aç (sayfa yenile)
  stage = 'save_reopen';
  await btn(page, 'Taslağı sakla').click();
  await page.waitForTimeout(1200);
  await page.goto(web + `/parent/prova/builder?draftId=${draftId}`);
  await page.getByText(/6 \/ 6|6\/6/).first().waitFor();
  const saved = (await must(db.rpc('get_prova_drafts', { p_id: draftId }), 'draft_read'))[0];
  assert.equal(saved.content.blocks.length, 5); // 1 kütüphane + 1 grup + 1 elle + 2 AI
  assert.deepEqual(new Set(saved.content.blocks.map(b => b.source)), new Set(['library', 'manual', 'ai']));
  assert.equal(saved.content.context.scope, 'mixed'); assert.equal(saved.content.context.track, 'meb_common');
  assert.equal(saved.content.context.term, 1); assert.equal(saved.content.context.schoolDeclared, true);
  assert.equal(saved.content.context.periodId, period.id);
  pass('save_and_reopen_keeps_blocks_and_context', { blocks: saved.content.blocks.map(b => b.source) });

  // ---- 4) Kontrol → gönder
  stage = 'send';
  await btn(page, 'Önizle ve kontrol et').click();
  await page.getByLabel('Prova’nın adı', { exact: true }).fill(`C04 karma ${TAG}`);
  await page.getByRole('switch', { name: 'Soruları, kaynakları ve cevapları kontrol ettim.' }).click();
  await shot(page, 'builder-review', ['phone', 'tablet', 'desktop']);
  await btn(page, 'Çocuğuma gönder').click();
  await page.waitForURL('**/parent/prova');
  const exam = (await must(db.from('exams').select('id,question_ids,exam_scope,assessment_track,term,education_period_id,school_declared,content_locked_at').eq('id', draftId), 'exam_read'))[0];
  assert.equal(exam.question_ids.length, 6);
  assert.deepEqual([exam.exam_scope, exam.assessment_track, exam.term, exam.education_period_id, exam.school_declared], ['mixed', 'meb_common', 1, period.id, true]);
  pass('assigned_with_context_columns', { questions: 6, track: exam.assessment_track, term: exam.term });
  await page.getByRole('tab', { name: /^Gönderilenler/ }).click();
  await page.getByText(`C04 karma ${TAG}`).first().waitFor();
  await shot(page, 'hub-sent', ['phone', 'tablet', 'desktop']);

  // ---- 5) Atanmış sürüm düzenlemeden etkilenmez
  stage = 'immutability';
  const direct = await db.from('question_bank').update({ stem: 'Değiştirildi' }).eq('id', manual.id).select('id');
  assert.ok(direct.error, 'assigned manual question cannot be overwritten');
  const nextGroup = crypto.randomUUID();
  await must(db.rpc('save_question_source_group', { p_request_id: nextGroup, p_previous_id: groupId, p_group: { title: `Ders programı ${TAG} v2`, body: 'Güncellenmiş yönerge metni burada.', subject: 'Matematik', grade: 6 },
    p_questions: [
      { kind: 'open_ended', topic: 'Tablo okuma', difficulty: 'orta', stem: 'Salı ilk ders hangisidir?', expected_answer: 'Fen', solution: 'Salı satırı.' },
      { kind: 'open_ended', topic: 'Tablo okuma', difficulty: 'orta', stem: 'Fen dersi saat kaçta başlar?', expected_answer: '10:00', solution: 'Salı 10:00.' },
    ], p_images: [{ source_id: imageId, alt: 'Sentetik haftalık ders programı görseli' }] }), 'group_new_version');
  const examAfter = (await must(db.from('exams').select('question_ids').eq('id', draftId), 'exam_after_edit'))[0];
  assert.deepEqual(examAfter.question_ids, exam.question_ids, 'assigned exam keeps its frozen question ids');
  pass('assigned_version_unaffected_by_edits', { direct_update_error: direct.error.message });

  // ---- 6) Çocuk modu: çöz (öğrenci yanıtlarında cevap anahtarı yok)
  stage = 'child_solve';
  const child = await context(); childPage = child;
  await signIn(child);
  const childPayloads = [];
  child.on('response', async r => { if (r.url().startsWith(backend) && /rest\/v1|functions\/v1/.test(r.url())) { try { childPayloads.push(await r.text()); } catch {} } });
  await child.goto(web + '/parent/child-mode');
  await btn(child, childName).click();
  await child.getByLabel('Çocuk PIN’i', { exact: true }).fill('1234');
  await btn(child, 'Dünyama gir').click();
  await child.waitForURL('**/parent/child-mode/today');
  await child.goto(web + `/parent/child-mode/prova/${draftId}`);
  await child.getByText(/Kütüphane sorusu|Pazartesi ilk ders|Elle soru|Sentetik AI sorusu/).first().waitFor();
  await shot(child, 'child-question-1', ['phone', 'tablet']);
  const visited = [];
  let typed = 0;
  for (let i = 0; i < 6; i++) {
    await child.waitForTimeout(600);
    const text = await body(child);
    visited.push(text.slice(0, 4000));
    if (await child.getByRole('radio').count()) {
      await child.getByRole('radio').filter({ hasText: /2\/4|Seçenek B/ }).first().click();
    } else if (i === 1 || i === 3) {
      // Açık uçlu: deftere klavye cevabı (bir soru bilinçli olarak boş bırakılır).
      const tab = child.getByRole('tab', { name: 'Defter' }).or(btn(child, 'Defter')).first();
      if (await tab.count()) await tab.click();
      await child.waitForTimeout(500);
      // Defterde kalemle çizim (çocuğun gerçek cevap biçimi): sayfa ızgarasına bir çizgi.
      await child.mouse.move(90, 430); await child.mouse.down();
      for (let k = 1; k <= 12; k++) await child.mouse.move(90 + k * 14, 430 + (k % 3) * 18);
      await child.mouse.up();
      await child.getByText('Kaydedildi').first().waitFor({ timeout: 15000 });
      await child.waitForTimeout(1200);
      if (i === 1) await shot(child, 'child-notebook-ink', ['phone']);
      typed++;
      const soru = child.getByRole('tab', { name: 'Soru' }).or(btn(child, 'Soru')).first();
      if (await soru.count()) await soru.click().catch(() => {});
    }
    if (i === 1) await shot(child, 'child-shared-image-question', ['phone', 'tablet']);
    const next = child.getByRole('button', { name: /^Sonraki( soru)?$/ }).first();
    if (i < 5) { await next.click(); }
  }
  const all = visited.join('\n');
  assert.ok(all.includes('Görseldeki haftalık ders programını incele'), 'child sees the shared prompt');
  await child.getByRole('button', { name: /Bitir|Teslim et|Cevaplarımı gönder/ }).last().click();
  await child.waitForTimeout(800);
  const confirm = child.getByRole('button', { name: /Cevaplarımı gönder|Gönder|Bitir|Teslim et/ }).last();
  if (await confirm.count()) await confirm.click().catch(() => {});
  await child.getByText(/Deneme bitti|ebeveynin inceleyecek/).first().waitFor({ timeout: 30000 });
  await shot(child, 'child-finished', ['phone', 'tablet']);
  const leaked = childPayloads.filter(t => /Pay ve paydayı 3 ile böl|Ortak böleni bulur|"expected_answer"|"correct_key"|Sentetik beklenen cevap|Alternatif cevap|"rubric"/.test(t));
  assert.equal(leaked.length, 0, 'child-mode responses contain no answer key/rubric');
  pass('child_solved_without_answer_key', { responses: childPayloads.length });
  const attempt = (await must(db.from('exam_attempts').select('id,status,provisional,open_pending,open_unanswered').eq('exam_id', draftId), 'attempt'))[0];
  assert.ok(attempt && attempt.status !== 'in_progress');
  assert.equal(typed, 2); assert.equal(attempt.open_pending, 2, 'two drawn answers wait for the parent (not auto 0)');
  pass('attempt_submitted_pending_review', { status: attempt.status, provisional: attempt.provisional, open_pending: attempt.open_pending, open_unanswered: attempt.open_unanswered });

  // ---- 7) Veli incele: İncelenecekler → özet → soru (şık gerekçesi, alternatif + rubrik, defter katmanı)
  stage = 'parent_review';
  await page.goto(web + '/parent/prova');
  await page.getByRole('tab', { name: /^İncelenecekler/ }).click();
  await page.getByText(`C04 karma ${TAG}`).first().click();
  await page.waitForURL('**/parent/prova/attempt/**');
  await shot(page, 'attempt-summary', ['phone', 'tablet', 'desktop']);
  await page.goto(web + `/parent/prova/review/${attempt.id}?questionId=${exam.question_ids[0]}`);
  await page.getByText(`Kütüphane sorusu ${TAG}`, { exact: false }).first().waitFor();
  await page.getByText('Seçtiği cevap').or(page.getByText(/Seçilen|seçtiği/i)).first().waitFor().catch(() => {});
  await page.getByRole('button', { name: /^(Çözüm açıklaması|Cevap anahtarı)$/ }).first().click();
  await page.getByText('Şıkların gerekçesi').waitFor();
  await shot(page, 'review-mc-reason', ['phone', 'tablet', 'desktop']);
  const manualIndex = exam.question_ids.indexOf(manual.id);
  await page.goto(web + `/parent/prova/review/${attempt.id}?questionId=${manual.id}`);
  await page.getByText(`Elle soru ${TAG}`, { exact: false }).first().waitFor();
  // Defterli cevapta soru panosu kapalıdır; "Soruyu göster" ile soru + anahtar her zaman erişilebilir.
  await shot(page, 'review-open-notebook', ['phone', 'tablet', 'desktop']);
  // Telefonda: Değerlendirme sekmesi → "Soruyu göster" → soru, görsel ve cevap anahtarı.
  await page.getByRole('button', { name: 'Değerlendirmeye geç', exact: true }).click();
  if (!(await page.getByRole('button', { name: 'Soru alanını küçült', exact: true }).count())) await page.getByRole('button', { name: 'Soruyu göster', exact: true }).last().click();
  await page.getByRole('button', { name: /^Cevap anahtarı$/ }).first().click();
  await page.getByText('Kabul edilen diğer cevaplar').waitFor();
  await page.getByText(/Ortak böleni bulur — 40 puan/).waitFor();
  await shot(page, 'review-open-rubric', ['phone', 'tablet', 'desktop']);
  pass('review_shows_choice_reason_alternatives_rubric', { manualIndex });
  const scoreBox = page.getByLabel('Puan', { exact: true }).first();
  await scoreBox.fill('80');
  await shot(page, 'review-open-parent-score', ['phone']);
  await page.getByRole('button', { name: /^Kaydet ve (sonraki|özete dön)$/ }).last().click();
  await page.waitForTimeout(1500);
  const graded = (await must(db.from('exam_answers').select('score,graded_by').eq('attempt_id', attempt.id).eq('question_id', manual.id), 'manual_score'))[0];
  assert.equal(graded?.score, 80); assert.equal(graded?.graded_by, 'parent');
  pass('parent_final_score_saved_separately', graded);

  // ---- 8) Gelişim aynı sınav sürümüne bağlı
  stage = 'progress';
  await page.goto(web + '/parent/prova/progress');
  await page.waitForTimeout(1500);
  await shot(page, 'progress', ['phone', 'tablet', 'desktop']);
  const stats = await must(db.rpc('get_attempt_topic_stats', { p_attempt_id: attempt.id }), 'topic_stats');
  pass('progress_reads_same_attempt', { topics: stats.map(s => s.topic) });

  for (const p of [page, child]) assert.deepEqual(p.errors, [], 'no page errors');
  pass('no_runtime_errors');
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-auth-rest-storage-edge (deterministic AI provider)', results }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, count: results.length }));
  await browser.close();
})().catch(async e => {
  console.log('CHECK_FAILED ' + stage + ' ' + String(e && e.message).slice(0, 800));
  try { if (page) { await page.screenshot({ path: path.join(process.env.GINA_QA_FAIL_DIR || '/tmp', 'c04-ui-failed.png'), fullPage: true }); fs.writeFileSync(path.join(process.env.GINA_QA_FAIL_DIR || '/tmp', 'c04-ui-failed.txt'), await page.locator('body').innerText()); } } catch {}
  try { if (childPage) { await childPage.screenshot({ path: path.join(process.env.GINA_QA_FAIL_DIR || '/tmp', 'c04-ui-child-failed.png'), fullPage: true }); fs.writeFileSync(path.join(process.env.GINA_QA_FAIL_DIR || '/tmp', 'c04-ui-child-failed.txt'), await childPage.locator('body').innerText()); } } catch {}
  fs.writeFileSync(out + '/ui-checks.partial.json', JSON.stringify({ failed_stage: stage, results }, null, 2) + '\n');
  if (browser) await browser.close(); process.exitCode = 1;
});
