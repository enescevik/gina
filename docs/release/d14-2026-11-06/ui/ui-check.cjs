// D14 kabul zinciri (Playwright, gerçek izole Auth/REST/Storage/Edge). Yalnız
// `test-isolated-services.py --with-storage --ui-hold` geçici sentetik fixture'ı (loopback) kabul edilir.
// Ortam: GINA_QA_UI_FIXTURE, GINA_QA_WEB (statik export), GINA_QA_WEB_BACKEND (export'a gömülü yer tutucu),
// GINA_QA_WEB_ANON, GINA_QA_PLAYWRIGHT_PATH. AI: izole Edge'deki değiştirilmemiş prova-generate + deterministik
// sağlayıcı (scripts/isolated-ai-provider.ts) — gerçek/ücretli AI değil. Kişi adı uyarısı için taslak konusu "Elif'in
// bahçesi" (sağlayıcı konuyu soru metnine yazar → D9 dedektörü "Elif"i işaretler).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const { createClient } = require(path.resolve(__dirname, '../../../../node_modules/@supabase/supabase-js'));
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const out = __dirname; const results = []; let browser, stage = 'setup', page;
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 } };
const TOPIC = "Elif'in bahçesi";
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail === undefined ? {} : { detail }) }); console.error('ok ' + check); };

(async () => {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const db = createClient(f.url, f.anon, opts);
  const login = await db.auth.signInWithPassword({ email: f.email, password: f.password });
  assert.ok(!login.error, 'login');
  const must = async (p, label) => { const r = await p; if (r.error) throw new Error(label + ': ' + (r.error.message || JSON.stringify(r.error))); return r.data; };
  const draftOf = async id => (await must(db.rpc('get_prova_drafts', { p_id: id }), 'draft'))[0];
  const row = async id => must(db.from('question_bank').select('*').eq('id', id).single(), 'row ' + id);

  // ---- Tohum: 6. sınıf + eğitim dönemi; boş taslak (3 soru, konu "Elif'in bahçesi").
  stage = 'seed';
  await must(db.from('children').update({ grade: 6 }).eq('id', f.childId), 'child_grade');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const edu = await db.rpc('get_child_education', { p_child_id: f.childId });
  if (!edu.data?.current) {
    await must(db.rpc('change_child_education', { p_request_id: crypto.randomUUID(), p_child_id: f.childId, p_revision: edu.data?.revision ?? 0, p_action: 'initial',
      p_academic_year: Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 9 ? 1 : 0), p_grade: 6, p_school: 'Sentetik Ortaokulu', p_starts_on: today, p_timetable_revision: 0, p_keep_timetable: true }), 'education_initial');
  }
  const period = (await must(db.rpc('get_child_education', { p_child_id: f.childId }), 'education_read')).current;
  const draftId = crypto.randomUUID();
  await must(db.rpc('save_prova_draft', { p_request_id: crypto.randomUUID(), p_id: draftId, p_version: 0, p_content: {
    childId: f.childId, grade: 6, title: '', purpose: 'practice', format: 'school', subjects: ['Fen Bilimleri'], topics: [TOPIC], target: 3, minutes: null,
    difficulty: 'orta', kind: 'mixed', note: '', step: 0, blocks: [],
    context: { scope: 'subject', track: 'free', term: 1, program: 'Maarif', academicYear: period.academic_year, periodId: period.id, school: period.school, schoolDeclared: false } } }), 'seed_draft');
  pass('seed_empty_draft');

  // ---- Tarayıcı (azaltılmış hareket açık)
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function context(viewport) {
    const c = await browser.newContext({ viewport: viewport || sizes.phone, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', reducedMotion: 'reduce' });
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
  async function shot(p, name, sizesToTake = ['phone', 'tablet']) {
    for (const size of sizesToTake) {
      await p.setViewportSize(sizes[size]); await p.waitForTimeout(700);
      await p.screenshot({ path: `${out}/${name}-${size}.png`, fullPage: true });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `${name}-${size}: horizontal overflow ${overflow}`);
      assert.ok(!/\bd1[04]\.|\bd1\.|provaC04\.|provaBuilder\.|provaP0[12]\.|sharedQuestions\.|prova\.ai\.errors\./.test(await body(p)), `${name}-${size}: untranslated key`);
    }
    await p.setViewportSize(sizes.phone);
  }
  const btn = (p, name) => p.getByRole('button', { name, exact: true });
  page = await context(); stage = 'login';
  await page.goto(web); await page.getByLabel('E-posta', { exact: true }).fill(f.email); await page.getByLabel('Şifre', { exact: true }).fill(f.password);
  await btn(page, 'Giriş yap').click(); await page.waitForURL('**/parent');

  // ---- 1) AI önerisi: kişi adı notu "Düzenle"yi önerir
  stage = 'ai_generate';
  await page.goto(web + `/parent/prova/builder?draftId=${draftId}`);
  await btn(page, 'Devam et').first().click();
  await btn(page, 'Devam et').first().click();
  await page.getByText(/0 \/ 3 soru hazır/).first().waitFor();
  const ent0 = await must(db.rpc('get_prova_entitlement'), 'entitlement_before');
  await btn(page, 'Soru ekle').first().click();
  await btn(page, 'AI ile hazırla').click();
  await btn(page, 'Soruları hazırla').waitFor();
  const fill = btn(page, 'Kalan 3 soruyu AI ile tamamla');
  if (await fill.count()) await fill.click();
  await page.getByText(`${TOPIC} · 3`).waitFor();
  await btn(page, 'Soruları hazırla').click();
  await page.getByText('Ortak kaynaklı 2 soru (birlikte eklenir)').first().waitFor({ timeout: 60000 });
  const ent1 = await must(db.rpc('get_prova_entitlement'), 'entitlement_after');
  const charged = ent0.ai_generate_remaining - ent1.ai_generate_remaining;
  assert.equal(charged, 3, 'three generated questions charged once');
  await page.getByText('Bu soruda bir kişi adı geçiyor: Elif.').first().waitFor();
  await page.getByText('“Düzenle” ile adı değiştirebilir', { exact: false }).first().waitFor();
  assert.ok(!(await body(page)).includes('AI sorusu burada düzenlenemez'), 'old no-edit note is gone where editing exists');
  await page.getByRole('button', { name: 'Bu AI sorusunu düzenle' }).first().waitFor();
  await btn(page, 'Ortak kaynağı ve soruları düzenle').waitFor();
  await shot(page, 'picker-ai-note');
  pass('picker_shows_person_name_note_with_edit_actions', { charged });

  // ---- 2) Tek soru: mevcut editör özgünle dolu açılır → ad çıkarılır → kaydet
  stage = 'edit_single';
  const aiIds = (await must(db.from('question_bank').select('id,stem,provenance').eq('provenance->>generator', 'ai').order('created_at', { ascending: false }).limit(3), 'ai_rows'));
  assert.equal(aiIds.length, 3);
  const single = aiIds.find(q => !/Sentetik ortak metin/.test(q.stem));
  const singleBefore = await row(single.id);
  await page.getByRole('button', { name: 'Bu AI sorusunu düzenle' }).first().click();
  await page.waitForURL('**/parent/prova/question**');
  await page.getByText('AI sorusunu düzenle').first().waitFor();
  const stem = page.getByLabel('Soru', { exact: true });
  assert.equal(await stem.inputValue(), singleBefore.stem, 'editor prefilled with the AI stem');
  await page.getByText('Ders ve sınıf AI önerisindeki gibi kalır: Fen Bilimleri · 6. sınıf').waitFor();
  await page.getByText('Hâlâ geçen ad: Elif').first().waitFor();
  assert.equal(await page.getByText('Görsel ekle', { exact: false }).count(), 0, 'no image editor on AI edit');
  await shot(page, 'editor-prefilled');
  const newStem = singleBefore.stem.replace("Elif'in bahçesi", 'bir öğrencinin bahçesi');
  await stem.fill(newStem);
  await page.getByText('İşaretli adlar metinden çıkarıldı; kaydedince not kalkar.').first().waitFor();
  await btn(page, 'Devam').click();
  if (singleBefore.kind === 'open_ended') {
    const rubricBox = page.getByLabel('Puanlama ölçütleri', { exact: false });
    if (await rubricBox.count()) assert.match(await rubricBox.first().inputValue(), /\| 50/, 'AI rubric prefilled on the 100 scale');
  }
  await btn(page, 'Devam').click();
  await shot(page, 'editor-preview');
  await btn(page, 'Kaydet ve taslakta kullan').click();
  await page.waitForURL('**/parent/prova/builder**');
  await page.getByText(/1 \/ 3 soru hazır/).first().waitFor();
  const d1 = await draftOf(draftId);
  assert.equal(d1.content.blocks.length, 1); const e1 = await row(d1.content.blocks[0].id);
  assert.notEqual(e1.id, single.id);
  assert.equal(e1.provenance.generator, 'ai_edited'); assert.equal(e1.provenance.edited_from, single.id); assert.equal(e1.provenance.edited_root, single.id);
  assert.equal(e1.provenance.model, singleBefore.provenance.model, 'model provenance kept');
  assert.equal(e1.provenance.content_review?.status, 'resolved'); assert.equal(e1.stem, newStem);
  assert.deepEqual(await row(single.id), singleBefore, 'original AI row unchanged');
  pass('single_ai_question_edited_as_new_row_and_added', { edited: e1.id, content_review: e1.provenance.content_review.status });

  // ---- 3) Seçici düzenlenmiş hâli gösterir; grup düzenlemesi = yeni grup sürümü
  stage = 'edit_group';
  await btn(page, 'Soru ekle').first().click();
  await btn(page, 'AI ile hazırla').click();
  await page.getByText(newStem).first().waitFor();
  await page.getByText('Düzenlendi', { exact: true }).first().waitFor();
  assert.equal((await body(page)).split('Bu soruda bir kişi adı geçiyor: Elif.').length - 1, 2, 'note gone for the edited question, still on the two group members');
  await shot(page, 'picker-after-edit');
  const memberOf = await must(db.from('question_source_members').select('group_id').eq('question_id', aiIds.find(q => q.id !== single.id).id).single(), 'member_of');
  const groupBefore = await must(db.from('question_source_groups').select('id,series_id,version,title,body,question_source_members(question_id,position,prompt)').eq('id', memberOf.group_id).single(), 'group_v1_before');
  assert.equal(groupBefore.version, 1);
  await btn(page, 'Ortak kaynağı ve soruları düzenle').click();
  await page.waitForURL('**/parent/prova/shared-source**');
  await page.getByText('AI ortak kaynağını düzenle').first().waitFor();
  await page.getByText('Ders ve sınıf AI önerisindeki gibi kalır: Fen Bilimleri · 6. sınıf').waitFor();
  await page.getByText('Hâlâ geçen ad: Elif').first().waitFor();
  await shot(page, 'group-editor-source');
  await page.getByLabel('Ortak metin', { exact: true }).fill('Sentetik ortak metin: bir bahçede iki ölçüm yapılır.');
  await btn(page, 'Sorulara geç').click();
  for (const n of [1, 2]) {
    await page.getByRole('tab', { name: `Soru ${n}`, exact: true }).click();
    const input = page.getByLabel('Soru', { exact: true });
    await input.fill((await input.inputValue()).replace("Elif'in bahçesi", 'okul bahçesi'));
  }
  assert.equal(await page.getByRole('button', { name: 'Soru ekle', exact: true }).count(), 0, 'no add-member control');
  await page.getByText('İşaretli adlar metinden çıkarıldı; kaydedince not kalkar.').first().waitFor();
  await shot(page, 'group-editor-questions');
  await btn(page, 'Önizle').click();
  await btn(page, 'Soru grubunu kaydet').click();
  await page.getByText('Soru grubu kaydedildi').waitFor();
  await btn(page, 'Taslakta kullan').click();
  await page.waitForURL('**/parent/prova/builder**');
  await page.getByText(/3 \/ 3 soru hazır/).first().waitFor();
  const d2 = await draftOf(draftId);
  const gBlock = d2.content.blocks.find(b => b.kind === 'group');
  const g2 = await must(db.from('question_source_groups').select('id,series_id,version,previous_id,body,question_source_members(question_id,position,prompt)').eq('id', gBlock.id).single(), 'group_v2');
  assert.equal(g2.version, 2); assert.equal(g2.series_id, groupBefore.series_id); assert.equal(g2.previous_id, groupBefore.id);
  assert.equal(g2.body, 'Sentetik ortak metin: bir bahçede iki ölçüm yapılır.');
  const g1Now = await must(db.from('question_source_groups').select('body,version').eq('id', groupBefore.id).single(), 'group_v1');
  assert.equal(g1Now.body, groupBefore.body, 'original group version unchanged');
  for (const m of g2.question_source_members) {
    const q = await row(m.question_id);
    assert.equal(q.provenance.generator, 'ai_edited'); assert.equal(q.provenance.edit_scope, 'group');
    assert.equal(q.stem, `${groupBefore.title}\n${g2.body}\n\n${m.prompt}`, 'member stem follows the group contract');
    assert.ok(!/Elif/.test(q.stem)); assert.equal(q.provenance.content_review?.status, 'resolved');
  }
  pass('ai_group_edited_as_new_version_and_added', { version: g2.version, members: g2.question_source_members.length });

  // ---- 4) Taslak 3. adım önizlemesinden düzenleme: blok yerinde değişir
  stage = 'edit_from_review';
  await btn(page, 'Önizle ve kontrol et').click();
  await page.getByText('Çocuğun göreceği görünüm').first().waitFor();
  await page.getByRole('button', { name: 'Bu AI sorusunu düzenle' }).first().waitFor();
  await shot(page, 'review-preview-edit');
  await page.getByRole('button', { name: 'Bu AI sorusunu düzenle' }).first().click();
  await page.waitForURL('**/parent/prova/question**');
  const stem2 = page.getByLabel('Soru', { exact: true });
  assert.equal(await stem2.inputValue(), newStem, 'second edit starts from the edited row');
  await stem2.fill(newStem + ' İki örnek ver.');
  await btn(page, 'Devam').click(); await btn(page, 'Devam').click();
  await btn(page, 'Kaydet ve taslakta kullan').click();
  await page.waitForURL('**/parent/prova/builder**');
  await page.waitForTimeout(1200);
  const d3 = await draftOf(draftId);
  assert.equal(d3.content.blocks.length, 2, 'block replaced, not appended');
  const e2 = await row(d3.content.blocks[0].id);
  assert.equal(e2.provenance.edited_from, e1.id); assert.equal(e2.provenance.edited_root, single.id);
  assert.equal(d3.content.blocks[1].id, g2.id, 'order kept');
  pass('review_preview_edit_replaces_block_in_place', { blocks: d3.content.blocks.map(b => b.kind) });

  // ---- 5) Gönderim: düzenlenmiş sorular atanır; ikinci AI ücreti yok
  stage = 'send';
  const ent2 = await must(db.rpc('get_prova_entitlement'), 'entitlement_end');
  assert.equal(ent2.ai_generate_remaining, ent1.ai_generate_remaining, 'edits never charge AI credit');
  await page.getByText(/3 \/ 3 soru hazır/).first().waitFor();
  const review = btn(page, 'Önizle ve kontrol et');
  if (await review.count()) await review.click();
  await page.getByLabel('Prova’nın adı', { exact: true }).fill('D14 düzenlenmiş AI');
  await page.getByRole('switch', { name: 'Soruları, kaynakları ve cevapları kontrol ettim.' }).click();
  await btn(page, 'Çocuğuma gönder').click();
  await page.waitForURL('**/parent/prova');
  const exam = (await must(db.from('exams').select('id,question_ids').eq('id', draftId), 'exam'))[0];
  const members = [...g2.question_source_members].sort((a, b) => a.position - b.position).map(m => m.question_id);
  assert.deepEqual(exam.question_ids, [e2.id, ...members], 'assigned exam uses the edited rows');
  pass('edited_rows_assigned_without_second_charge', { question_ids: exam.question_ids.length, remaining: ent2.ai_generate_remaining });

  assert.deepEqual(page.errors, [], 'no page errors');
  pass('no_runtime_errors');
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-auth-rest-storage-edge (deterministic AI provider), reducedMotion=reduce', results }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, count: results.length }));
  await browser.close();
})().catch(async e => {
  console.log('CHECK_FAILED ' + stage + ' ' + String(e && e.message).slice(0, 800));
  const dir = process.env.GINA_QA_FAIL_DIR || '/tmp';
  try { if (page) { await page.screenshot({ path: path.join(dir, 'd14-ui-failed.png'), fullPage: true }); fs.writeFileSync(path.join(dir, 'd14-ui-failed.txt'), await page.locator('body').innerText()); } } catch {}
  fs.writeFileSync(out + '/ui-checks.partial.json', JSON.stringify({ failed_stage: stage, results }, null, 2) + '\n');
  if (browser) await browser.close(); process.exitCode = 1;
});
