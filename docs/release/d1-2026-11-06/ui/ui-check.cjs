// D1 kabul zinciri (Playwright, gerçek izole Auth/REST/Storage/Edge). Yalnız
// `test-isolated-services.py --with-storage --ui-hold` geçici sentetik fixture'ı (loopback) kabul edilir.
// Ortam: GINA_QA_UI_FIXTURE, GINA_QA_WEB (statik export), GINA_QA_WEB_BACKEND (export'a gömülü yer tutucu),
// GINA_QA_WEB_ANON, GINA_QA_PLAYWRIGHT_PATH. Fixture GINA_QA_UI_SERVICE=1 ile servis anahtarını taşır (yalnız
// senaryo-bağlı uygunluk satırı ve AI uygunluk önerisi tohumu için). AI: izole Edge'deki değiştirilmemiş
// prova-generate handler'ı + deterministik sağlayıcı (scripts/isolated-ai-provider.ts) — gerçek/ücretli AI değil.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const { createClient } = require(path.resolve(__dirname, '../../../../node_modules/@supabase/supabase-js'));
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/); assert.ok(f.service, 'service key fixture');
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const out = __dirname; const results = []; let browser, stage = 'setup', page, childPage;
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const TAG = crypto.randomUUID().slice(0, 4);
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail === undefined ? {} : { detail }) }); console.error('ok ' + check); };

(async () => {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const db = createClient(f.url, f.anon, opts), svc = createClient(f.url, f.service, opts);
  const login = await db.auth.signInWithPassword({ email: f.email, password: f.password });
  assert.ok(!login.error, 'login');
  const must = async (p, label) => { const r = await p; if (r.error) throw new Error(label + ': ' + (r.error.message || JSON.stringify(r.error))); return r.data; };

  // ---- Tohum: 6. sınıf + eğitim dönemi; 2. dönem için yazılmış elle soru; taslak (1. dönem, Maarif, Fen Bilimleri).
  stage = 'seed';
  await must(db.from('children').update({ grade: 6 }).eq('id', f.childId), 'child_grade');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const edu = await db.rpc('get_child_education', { p_child_id: f.childId });
  if (!edu.data?.current) {
    await must(db.rpc('change_child_education', { p_request_id: crypto.randomUUID(), p_child_id: f.childId, p_revision: edu.data?.revision ?? 0, p_action: 'initial',
      p_academic_year: Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 9 ? 1 : 0), p_grade: 6, p_school: 'Sentetik Ortaokulu', p_starts_on: today, p_timetable_revision: 0, p_keep_timetable: true }), 'education_initial');
  }
  const period = (await must(db.rpc('get_child_education', { p_child_id: f.childId }), 'education_read')).current;
  const term2 = crypto.randomUUID();
  await must(db.rpc('save_question_with_sources', { p_request_id: term2, p_question: { grade: 6, subject: 'Fen Bilimleri', topic: 'Bitkiler', kind: 'open_ended', difficulty: 'orta',
    stem: `İkinci dönem sorusu ${TAG}: Tohumun çimlenmesi için gereken iki koşulu yaz.`, expected_answer: 'Su ve uygun sıcaklık', solution: 'Çimlenme koşulları.', term: 2, program: 'Maarif' }, p_images: [] }), 'term2_question');
  const draftId = crypto.randomUUID();
  const content = { childId: f.childId, grade: 6, title: '', purpose: 'practice', format: 'school', subjects: ['Fen Bilimleri'], topics: ['Bitkiler'], target: 3, minutes: null,
    difficulty: 'orta', kind: 'mixed', note: '', step: 0, blocks: [{ kind: 'question', id: term2, source: 'manual' }],
    context: { scope: 'subject', track: 'free', term: 1, program: 'Maarif', academicYear: period.academic_year, periodId: period.id, school: period.school, schoolDeclared: false } };
  await must(db.rpc('save_prova_draft', { p_request_id: crypto.randomUUID(), p_id: draftId, p_version: 0, p_content: content }), 'seed_draft');
  // C05 uygunluk: senaryo-bağlı bir soru (yalnız servis üretimi gibi) + ayrı AI önerisi.
  const fitQ = crypto.randomUUID();
  await must(svc.from('question_bank').insert({ id: fitQ, family_id: f.familyId, grade: 6, subject: 'Türkçe', topic: 'Blok 1', kind: 'open_ended', difficulty: 'orta',
    stem: `Senaryo sorusu ${TAG}: Metnin ana düşüncesini bir cümleyle yaz.`, expected_answer: 'Ana düşünce cümlesi', solution: 'Metnin bütününe bak.', created_by: f.userId,
    provenance: { generator: 'ai', content_fit: 'pending_human_review', catalogue_id: crypto.randomUUID(), catalogue_revision: 1, block_id: 'B1', outcome_ids: ['T.O.6.1', 'cell:C8'], scenario_version: 'synthetic@1',
      blueprint: { learning_blocks: [{ block_id: 'B1', outcomes: [{ code: 'T.O.6.1', cell: 'C7', text: 'Metnin ana düşüncesini belirler.' }, { code: null, cell: 'C8', text: 'Metindeki yardımcı düşünceleri belirler.' }] }] } } }), 'fit_question');
  await must(svc.rpc('record_scenario_question_fit_suggestion', { p_question_id: fitQ, p_verdict: { decision_reason: 'all_checks_passed', confidence: 0.82, findings: [], recommendation: 'approve' } }), 'fit_ai_suggestion');
  pass('seed_term2_question_draft_and_scenario_fit');

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
      assert.ok(!/\bd1\.|provaC04\.|provaBuilder\.|provaP0[12]\.|sharedQuestions\./.test(await body(p)), `${name}-${size}: untranslated key`);
    }
    await p.setViewportSize(sizes.phone);
  }
  async function signIn(p) {
    await p.goto(web); await p.getByLabel('E-posta', { exact: true }).fill(f.email); await p.getByLabel('Şifre', { exact: true }).fill(f.password);
    await p.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await p.waitForURL('**/parent');
  }
  const btn = (p, name) => p.getByRole('button', { name, exact: true });
  page = await context(); stage = 'login'; await signIn(page);

  // ---- 1) Ders kimliği: yazılan ad aynen, katalog bağı yalnız veli onayıyla
  stage = 'subject_link';
  await page.goto(web + `/parent/prova/builder?draftId=${draftId}`);
  await page.getByText('Ders kimliği', { exact: true }).waitFor();
  await page.getByText('Fen Bilimleri: katalog dersine bağlı değil').waitFor();
  const before = await must(db.rpc('child_subject_links', { p_child_id: f.childId }), 'links_before');
  assert.equal(before.links.length, 0, 'suggestion alone never links');
  await shot(page, 'subject-unlinked', ['phone', 'tablet', 'desktop']);
  await btn(page, 'Bağla: Fen Bilimleri').click();
  await page.getByText('Fen Bilimleri → katalogda “Fen Bilimleri”').waitFor();
  const after = await must(db.rpc('child_subject_links', { p_child_id: f.childId }), 'links_after');
  assert.equal(after.links[0]?.subject_id, 'subject-science'); assert.equal(after.links[0]?.title, 'Fen Bilimleri');
  await shot(page, 'subject-linked', ['phone', 'tablet', 'desktop']);
  pass('subject_text_linked_only_by_parent', { subject_id: after.links[0].subject_id });

  // ---- 2) Sorular adımı: 2. dönem sorusu soru düzeyinde işaretli
  stage = 'period_flag';
  await btn(page, 'Devam et').click();
  await btn(page, 'Devam et').click();
  await page.getByText(/1 \/ 3 soru hazır/).first().waitFor();
  await page.getByText('Bu soru 2. dönem için hazırlanmış; taslak 1. dönem').first().waitFor();
  await btn(page, 'Bilerek kullan').waitFor(); await btn(page, 'Taslaktan çıkar').waitFor();
  await shot(page, 'period-flag', ['phone', 'tablet', 'desktop']);
  pass('question_level_term_mismatch_flagged_with_fix_path');

  // ---- 3) AI: ortak metin + iki bağlı soru → tek grup seçimi
  stage = 'ai_group';
  const ent0 = await must(db.rpc('get_prova_entitlement'), 'entitlement_before');
  await btn(page, 'Soru ekle').first().click();
  await btn(page, 'AI ile hazırla').click();
  const fill = btn(page, 'Kalan 2 soruyu AI ile tamamla');
  if (!(await fill.count())) { await btn(page, 'Fen Bilimleri').last().click(); await btn(page, 'Bitkiler').last().click(); }
  await fill.click();
  await btn(page, 'Soruları hazırla').click();
  await page.getByText('Ortak kaynaklı 2 soru (birlikte eklenir)').first().waitFor({ timeout: 60000 });
  const aiText = await body(page);
  assert.equal(aiText.split('Sentetik ortak metin: bir bahçede ölçüm yapılır.').length - 1, 1, 'shared passage shown once in the suggestion');
  await shot(page, 'ai-group-suggestion', ['phone', 'tablet', 'desktop']);
  await btn(page, 'Önerilerin tümünü seç (2)').click();
  await page.getByText('1 seçildi').waitFor();
  await btn(page, 'Seçtiklerimi ekle').click();
  await page.getByText(/3 \/ 3 soru hazır/).first().waitFor();
  const ent1 = await must(db.rpc('get_prova_entitlement'), 'entitlement_after');
  assert.equal(ent0.ai_generate_remaining - ent1.ai_generate_remaining, 2, 'two generated questions charged once');
  const d1 = (await must(db.rpc('get_prova_drafts', { p_id: draftId }), 'draft_after_ai'))[0];
  const gBlock = d1.content.blocks.find(b => b.kind === 'group');
  assert.ok(gBlock && gBlock.source === 'ai', 'AI group stored as one group block');
  const group = await must(db.from('question_source_groups').select('id,title,body,version,finalized_at,question_source_members(question_id,position,prompt)').eq('id', gBlock.id).single(), 'ai_group');
  assert.equal(group.question_source_members.length, 2); assert.equal(group.body, 'Sentetik ortak metin: bir bahçede ölçüm yapılır.'); assert.ok(group.finalized_at);
  pass('ai_shared_text_and_two_linked_questions_saved_as_one_group', { group: group.id, members: 2, charged: ent0.ai_generate_remaining - ent1.ai_generate_remaining });

  // ---- 4) Grup taşınırken bölünmez
  stage = 'move_group';
  await page.getByRole('button', { name: 'Soru işlemleri' }).nth(1).click();
  await btn(page, 'Yukarı taşı').click();
  await btn(page, 'Taslağı sakla').click();
  await page.waitForTimeout(1500);
  const d2 = (await must(db.rpc('get_prova_drafts', { p_id: draftId }), 'draft_after_move'))[0];
  assert.deepEqual(d2.content.blocks.map(b => b.kind), ['group', 'question'], 'group moved as one block');
  await shot(page, 'builder-group-moved', ['phone', 'tablet', 'desktop']);
  pass('group_moves_as_one_block');

  // ---- 5) Dönem farkını bilerek kabul et → gönder
  stage = 'accept_and_send';
  await btn(page, 'Bilerek kullan').click();
  await page.getByText(/Dönem\/program farkını kabul ettin/).first().waitFor();
  await shot(page, 'period-accepted', ['phone']);
  await btn(page, 'Önizle ve kontrol et').click();
  await page.getByLabel('Prova’nın adı', { exact: true }).fill(`D1 ortak kaynak ${TAG}`);
  await page.getByRole('switch', { name: 'Soruları, kaynakları ve cevapları kontrol ettim.' }).click();
  await shot(page, 'builder-review', ['phone', 'tablet', 'desktop']);
  await btn(page, 'Çocuğuma gönder').click();
  await page.waitForURL('**/parent/prova');
  const exam = (await must(db.from('exams').select('id,question_ids,subject_links,preparation,term').eq('id', draftId), 'exam'))[0];
  const memberIds = [...group.question_source_members].sort((a, b) => a.position - b.position).map(m => m.question_id);
  assert.deepEqual(exam.question_ids, [...memberIds, term2], 'two members (in order) + one question, counted separately');
  assert.deepEqual(exam.subject_links, [{ title: 'Fen Bilimleri', subject_id: 'subject-science' }]);
  assert.deepEqual(exam.preparation.fitAccepted, [term2]);
  pass('assigned_exam_counts_members_separately_with_subject_snapshot', { question_ids: exam.question_ids.length, subject_links: exam.subject_links });
  // Atanmış sürüm donuk
  const direct = await db.from('question_bank').update({ stem: 'Değişti' }).eq('id', memberIds[0]).select('id');
  assert.ok(direct.error, 'assigned AI group member cannot be overwritten');
  pass('assigned_group_member_immutable', { error: direct.error.message });

  // ---- 6) Çocuk: ortak içerik her bağlı soru sayfasında bir kez; üç soru ayrı
  stage = 'child';
  const child = await context(); childPage = child;
  await signIn(child);
  const payloads = [];
  child.on('response', async r => { if (r.url().startsWith(backend) && /rest\/v1|functions\/v1/.test(r.url())) { try { payloads.push(await r.text()); } catch {} } });
  const childName = (await must(db.from('children').select('name').eq('id', f.childId).single(), 'child_name')).name;
  await child.goto(web + '/parent/child-mode');
  await btn(child, childName).click();
  await child.getByLabel('Çocuk PIN’i', { exact: true }).fill('1234');
  await btn(child, 'Dünyama gir').click();
  await child.waitForURL('**/parent/child-mode/today');
  await child.goto(web + `/parent/child-mode/prova/${draftId}`);
  const pages = [];
  for (let i = 0; i < 3; i++) {
    await child.getByText(new RegExp(`(Soru ${i + 1} / 3|${i + 1} / 3)`)).first().waitFor();
    await child.waitForTimeout(900);
    const text = await body(child);
    pages.push(text);
    if (i === 0) await shot(child, 'child-shared-q1', ['phone', 'tablet']);
    if (i === 1) await shot(child, 'child-shared-q2', ['phone']);
    if (i < 2) await child.getByRole('button', { name: /^Sonraki( soru)?$/ }).first().click();
  }
  const passage = 'Sentetik ortak metin: bir bahçede ölçüm yapılır.';
  assert.equal(pages[0].split(passage).length - 1, 1, 'first member: passage once'); assert.equal(pages[1].split(passage).length - 1, 1, 'second member: passage once');
  assert.equal(pages[2].split(passage).length - 1, 0, 'standalone question has no passage');
  assert.ok(pages[0].includes('Sentetik AI sorusu 1') && pages[1].includes('Sentetik AI sorusu 2'), 'each member shows its own prompt');
  const leaked = payloads.filter(t => /"expected_answer"|"correct_key"|Sentetik beklenen cevap|"rubric"|"shared_prompt"/.test(t));
  assert.equal(leaked.length, 0, 'child responses carry no answer key / provenance');
  pass('child_sees_shared_content_once_per_member_three_separate_questions', { responses: payloads.length });

  // ---- 7) Soru-kazanım uygunluğu: veli inceleme ekranı
  stage = 'fit_review';
  await page.goto(web + '/parent/prova?tab=review');
  await page.getByText('Soru-kazanım uygunluğu').first().click();
  await page.waitForURL('**/parent/prova/fit');
  await page.getByText(`Senaryo sorusu ${TAG}`, { exact: false }).waitFor();
  await page.getByText('T.O.6.1 — Metnin ana düşüncesini belirler.').waitFor();
  await page.getByText('AI önerisi', { exact: true }).waitFor();
  await page.getByText('Bu bir öneridir, karar değildir.').waitFor();
  await shot(page, 'fit-pending', ['phone', 'tablet', 'desktop']);
  assert.equal(await btn(page, 'Kararı kaydet').isDisabled(), true, 'cannot save without decision/reason/confirmation');
  await btn(page, 'T.O.6.1 — Metnin ana düşüncesini belirler.').click();
  await btn(page, 'Uygun').click();
  await page.getByLabel('Gerekçe', { exact: true }).fill('Soru metnin ana düşüncesini doğrudan soruyor.');
  await page.getByRole('switch', { name: 'Soruyu ve kazanımları okudum; bu karar benim' }).click();
  await btn(page, 'Kararı kaydet').click();
  await page.getByRole('button', { name: /^İncelenen \(/ }).first().click();
  await page.getByText('Kararın kaydedildi: Uygun').waitFor();
  const fit = await must(db.rpc('get_scenario_question_fit', { p_question_ids: [fitQ] }), 'fit_read');
  assert.equal(fit.items[0].decision, 'fit'); assert.deepEqual(fit.items[0].measured_outcome_ids, ['T.O.6.1']);
  assert.equal(fit.items[0].ai_suggestion.recommendation, 'approve'); assert.equal(fit.items[0].ai_is_decision, false);
  await shot(page, 'fit-reviewed', ['phone', 'tablet', 'desktop']);
  pass('fit_review_reasoned_parent_decision_ai_separate', { decision: fit.items[0].decision, measured: fit.items[0].measured_outcome_ids });

  for (const p of [page, child]) assert.deepEqual(p.errors, [], 'no page errors');
  pass('no_runtime_errors');
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-auth-rest-storage-edge (deterministic AI provider)', results }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, count: results.length }));
  await browser.close();
})().catch(async e => {
  console.log('CHECK_FAILED ' + stage + ' ' + String(e && e.message).slice(0, 800));
  const dir = process.env.GINA_QA_FAIL_DIR || '/tmp';
  try { if (page) { await page.screenshot({ path: path.join(dir, 'd1-ui-failed.png'), fullPage: true }); fs.writeFileSync(path.join(dir, 'd1-ui-failed.txt'), await page.locator('body').innerText()); } } catch {}
  try { if (childPage) { await childPage.screenshot({ path: path.join(dir, 'd1-ui-child-failed.png'), fullPage: true }); fs.writeFileSync(path.join(dir, 'd1-ui-child-failed.txt'), await childPage.locator('body').innerText()); } } catch {}
  fs.writeFileSync(out + '/ui-checks.partial.json', JSON.stringify({ failed_stage: stage, results }, null, 2) + '\n');
  if (browser) await browser.close(); process.exitCode = 1;
});
