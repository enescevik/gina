const loopbackFixtureFetch = require('../../../../scripts/loopback-fixture-fetch.cjs');
// P01/P02 + P04 inceleme düzeltmesi UI kabulü. Yalnız test-isolated-services.py --ui-hold'un geçici sentetik
// fixture'ı kabul edilir (loopback). Ortam: GINA_QA_UI_FIXTURE, GINA_QA_WEB, GINA_QA_WEB_BACKEND, GINA_QA_WEB_ANON,
// GINA_QA_PLAYWRIGHT_PATH. Ücretli AI çağrısı yok: "AI" bloğu deterministik sentetik bir soru, senaryo kataloğu
// yanıtı sentetik bir senaryoyla (resmî içerik kopyalanmadan) Playwright'ta sabitlenir.
const fs = require('node:fs'), assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const only = (process.env.GINA_QA_ONLY || '').split(',').filter(Boolean);
const want = name => !only.length || only.includes(name);
const out = __dirname; const results = []; let browser, stage = 'setup';
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const TAG = randomUUID().slice(0, 4);

(async () => {
  const login = await loopbackFixtureFetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
  assert.ok(login.ok); const session = await login.json();
  async function api(path, body, prefer, method) {
    const res = await loopbackFixtureFetch(f.url + '/rest/v1/' + path, { method: method || (body ? 'POST' : 'GET'), headers: { apikey: f.anon, authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); if (!res.ok) throw new Error(path + ' ' + res.status + ' ' + text.slice(0, 300)); return text ? JSON.parse(text) : null;
  }
  stage = 'seed';
  let child = (await api(`children?id=eq.${f.childId}&select=id,name,grade`))[0]; assert.ok(child);
  if (!(child.grade >= 5 && child.grade <= 8)) {
    await api(`children?id=eq.${child.id}`, { grade: 6 }, 'return=minimal', 'PATCH');
    child = (await api(`children?id=eq.${child.id}&select=id,name,grade`))[0];
  }
  const G = child.grade; assert.ok(G >= 5 && G <= 8, 'child grade ' + G);
  // Tohumdan önce bu sınıfın bankasındaki dersler: katalog dersleri bankada olmasa da listelenmeli.
  const bankBefore = [...new Set((await api(`current_question_bank?select=subject&grade=eq.${G}`)).map(r => r.subject))];
  results.push({ check: 'bank_subjects_before_seed', passed: true, detail: { grade: G, subjects: bankBefore } });

  // Sentetik sorular (özgün, telifli içerik değil).
  const q = (over) => ({ grade: G, subject: 'Matematik', topic: 'Kesirler', kind: 'open_ended', difficulty: 'orta', stem: 'Bir pastanın 3/8’i yendi. Kalan kısmı kesirle yaz.', choices: null, correct_key: null, expected_answer: '5/8', solution: '8/8 − 3/8 = 5/8', explanation: null, scenario_code: null, ...over });
  const save = async (body) => { const id = randomUUID(); await api('rpc/save_question_with_sources', { p_request_id: id, p_question: body, p_images: [] }); return id; };
  const manualId = await save(q({ stem: `Elle eklenen soru ${TAG}: 2/5 ile 1/5 toplamı kaçtır?`, expected_answer: '3/5', solution: '2/5 + 1/5 = 3/5' }));
  const aiId = await save(q({ stem: `AI önerisi (deterministik sentetik) ${TAG}: 7/10 − 2/10 işleminin sonucu nedir?`, expected_answer: '5/10 = 1/2', solution: '7/10 − 2/10 = 5/10' }));
  const libId = await save(q({ kind: 'multiple_choice', stem: `Kütüphane sorusu ${TAG}: Hangisi 1/2’ye eşittir?`, choices: [{ key: 'A', text: '2/4' }, { key: 'B', text: '1/3' }, { key: 'C', text: '3/4' }, { key: 'D', text: '2/3' }], correct_key: 'A', expected_answer: null, solution: '2/4 sadeleşince 1/2 olur.' }));
  const offId = await save(q({ grade: G + 1, subject: 'Fen Bilimleri', topic: 'Kuvvet', stem: `Başka sınıf sorusu ${TAG}: Sürtünme kuvvetine bir örnek yaz.`, expected_answer: 'Fren yapan bisiklet', solution: 'Yüzeyler arasındaki direnç.' }));
  let groupId = null, groupNote = null;
  try {
    groupId = randomUUID();
    await api('rpc/save_question_source_group', { p_request_id: groupId, p_group: { title: `Bahçe planı ${TAG}`, body: 'Bir bahçe 12 eş parçaya bölünmüştür. 3 parçaya domates, 4 parçaya biber ekilmiştir.', subject: 'Matematik', grade: G }, p_questions: [
      { kind: 'open_ended', topic: 'Kesirler', difficulty: 'orta', stem: 'Domates ekilen kısım bahçenin kaçta kaçıdır?', choices: null, correct_key: null, expected_answer: '3/12 = 1/4', solution: '3 parça / 12 parça' },
      { kind: 'open_ended', topic: 'Kesirler', difficulty: 'orta', stem: 'Boş kalan kısım bahçenin kaçta kaçıdır?', choices: null, correct_key: null, expected_answer: '5/12', solution: '12 − 3 − 4 = 5' },
    ], p_images: [] });
  } catch (e) { groupNote = String(e.message).slice(0, 160); groupId = null; }
  results.push({ check: 'shared_source_group_seeded', passed: !!groupId, detail: groupNote });

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function context(extraRoutes) {
    const c = await browser.newContext({ viewport: sizes.phone, locale: 'tr-TR' });
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
    // Playwright: sonra kaydedilen route önce çalışır; sentetik yanıtlar yönlendirmenin önünde.
    if (extraRoutes) await extraRoutes(c);
    const p = await c.newPage(); p.setDefaultTimeout(25000);
    const errors = []; p.on('pageerror', e => errors.push(e.message)); p.errors = errors;
    return p;
  }
  const text = p => p.locator('body').innerText();
  async function waitText(p, needle) { await p.waitForFunction(n => document.body.innerText.includes(n), needle, { timeout: 25000 }); }
  async function shot(p, name) {
    await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 1, name + ': horizontal overflow ' + overflow);
    assert.ok(!/provaP0[12]\.|provaBuilder\.|catalogFlow\.|parentReview\./.test(await text(p)), name + ': translations resolved');
  }
  async function signIn(p) {
    await p.goto(web); await p.getByLabel('E-posta', { exact: true }).fill(f.email); await p.getByLabel('Şifre', { exact: true }).fill(f.password);
    await p.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await p.waitForURL('**/parent');
  }
  const page = await context(); stage = 'login'; await signIn(page);

  // 1) Boş bankada ders seçimi + suggest_subject onayı.
  if (want('subjects')) {
    stage = 'builder_subjects';
    for (const [size, vp] of Object.entries(sizes)) {
      await page.setViewportSize(vp); await page.goto(`${web}/parent/prova/builder?childId=${child.id}`);
      await waitText(page, 'Dersler'); await waitText(page, 'Matematik'); await waitText(page, 'Türkçe'); await waitText(page, 'Sosyal Bilgiler');
      const body = await text(page);
      const notInBank = ['Matematik', 'Türkçe', 'Fen Bilimleri', 'Sosyal Bilgiler', 'İngilizce'].filter(s => !bankBefore.includes(s));
      assert.ok(notInBank.length >= 3, 'need catalogue subjects absent from bank: ' + notInBank);
      for (const s of notInBank) assert.ok(body.includes(s), size + ' catalogue subject absent from bank still listed: ' + s);
      await shot(page, `builder-empty-bank-subjects-${size}`);
    }
    await page.setViewportSize(sizes.phone);
    await page.getByLabel('Başka ders ekle', { exact: true }).fill('mat');
    await page.getByRole('button', { name: 'Ekle', exact: true }).click();
    await waitText(page, '“mat” için hangi dersi kastettin?');
    const before = await text(page);
    assert.ok(before.includes('Yazdığım gibi ekle: mat'), 'keep-label option');
    await page.getByText('Yazdığım gibi ekle: mat', { exact: true }).scrollIntoViewIfNeeded();
    await shot(page, 'builder-suggest-subject-phone');
    await page.getByRole('button', { name: 'Matematik', exact: true }).last().click();
    await page.waitForFunction(() => !document.body.innerText.includes('hangi dersi kastettin'));
    results.push({ check: 'empty_bank_subject_list_from_catalogue_and_suggest_subject_needs_confirmation', passed: true });
  }

  // 2) Karma taslak: elle + AI + kütüphane + ortak kaynak + uygunsuz soru tek taslakta.
  if (want('mixed')) {
    stage = 'mixed_draft';
    const draftId = randomUUID();
    const blocks = [
      { kind: 'question', id: manualId, source: 'manual' },
      { kind: 'question', id: aiId, source: 'ai' },
      { kind: 'question', id: libId, source: 'library' },
      ...(groupId ? [{ kind: 'group', id: groupId, source: 'library' }] : []),
      { kind: 'question', id: offId, source: 'manual' },
    ];
    const content = { childId: child.id, grade: G, title: `Karma çalışma ${TAG}`, purpose: 'practice', format: 'school', subjects: ['Matematik'], topics: [], target: 6, minutes: null, difficulty: 'orta', kind: 'mixed', note: '', step: 2, blocks };
    const r1 = await api('rpc/save_prova_draft', { p_id: draftId, p_version: 0, p_content: content, p_request_id: randomUUID() });
    for (const [size, vp] of Object.entries(sizes)) {
      await page.setViewportSize(vp); await page.goto(`${web}/parent/prova/builder?draftId=${draftId}`);
      await waitText(page, 'Bu taslakta:'); await waitText(page, 'Bu seçime uygun değil');
      const body = await text(page);
      for (const n of ['Senin eklediğin', 'AI önerisi', 'Kütüphane', 'uyumsuz']) assert.ok(body.includes(n), size + ' missing ' + n);
      if (groupId) assert.ok(body.includes('1 ortak kaynak grubu'), size + ' group count');
      assert.ok(body.includes(`ders: Fen Bilimleri`) && body.includes(`${G + 1}. sınıf sorusu`), size + ' issue detail');
      await shot(page, `builder-mixed-draft-${size}`);
      await page.getByText('Bu seçime uygun değil', { exact: false }).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(300); await page.screenshot({ path: `${out}/builder-mixed-draft-unsuitable-${size}.png` });
    }
    // Çocuk/sınıf değişince: başlangıç adımında uyarı (soru silinmez).
    const r2 = await api('rpc/save_prova_draft', { p_id: draftId, p_version: r1.version, p_content: { ...content, step: 0, subjects: ['Türkçe'] }, p_request_id: randomUUID() });
    await page.setViewportSize(sizes.phone); await page.goto(`${web}/parent/prova/builder?draftId=${draftId}`);
    await waitText(page, 'Seçimin değişti:');
    await shot(page, 'builder-scope-changed-phone');
    const kept = (await api('rpc/get_prova_drafts', { p_id: draftId }))[0];
    assert.equal(kept.content.blocks.length, blocks.length, 'blocks kept after scope change');
    assert.equal(kept.version, r2.version, 'no extra save from viewing');
    results.push({ check: 'mixed_draft_sources_shared_group_and_unsuitable_marks_without_deleting', passed: true, detail: { blocks: blocks.length, group: !!groupId } });
  }

  // 3) Adımlı soru editörü; doğru şık başlangıçta boş.
  if (want('editor')) {
    stage = 'editor';
    for (const [size, vp] of Object.entries(sizes)) {
      await page.setViewportSize(vp); await page.goto(`${web}/parent/prova/question?subject=Matematik&grade=${G}`);
      await waitText(page, 'Soru ve görsel');
      await shot(page, `editor-step1-${size}`);
    }
    await page.setViewportSize(sizes.phone);
    await page.getByLabel('Konu', { exact: true }).fill('Kesirler');
    await page.getByLabel('Soru', { exact: true }).fill(`Editör sorusu ${TAG}: 3/4 ile 1/4 farkı kaçtır?`);
    await page.getByRole('button', { name: 'Devam', exact: true }).click();
    await waitText(page, 'Doğru şıkkı kendin işaretle');
    const selected = await page.evaluate(() => ['A', 'B', 'C', 'D'].map(k => document.querySelector(`[aria-label="${k} seçeneğini doğru cevap yap"]`)?.getAttribute('aria-selected')));
    assert.ok(selected.every(v => v !== 'true'), 'no choice preselected ' + JSON.stringify(selected));
    for (const [k, v] of [['A', '1/2'], ['B', '1/4'], ['C', '2/4 değil'], ['D', '1']]) await page.getByLabel(`${k} seçeneği`, { exact: true }).fill(v);
    await page.getByRole('button', { name: 'Devam', exact: true }).click();
    await waitText(page, 'Doğru şıkkı işaretle.');
    await shot(page, 'editor-step2-correct-missing-phone');
    await page.getByLabel('A seçeneğini doğru cevap yap', { exact: true }).click();
    await page.getByLabel('Çözüm yolu', { exact: true }).fill('3/4 − 1/4 = 2/4 = 1/2');
    await page.getByRole('button', { name: 'Devam', exact: true }).click();
    await waitText(page, 'Öğrencinin göreceği');
    const prev = await text(page);
    assert.ok(prev.includes('Doğru cevap, ölçüt ve çözüm çocuğa gösterilmez.') && !prev.includes('3/4 − 1/4 = 2/4'), 'preview hides solution');
    for (const [size, vp] of Object.entries(sizes)) { await page.setViewportSize(vp); await page.getByText('Öğrencinin göreceği', { exact: false }).first().scrollIntoViewIfNeeded(); await shot(page, `editor-step3-preview-${size}`); }
    await page.setViewportSize(sizes.phone);
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
    let saved = [];
    for (let i = 0; i < 30 && !saved.length; i++) {
      await page.waitForTimeout(500);
      saved = await api(`question_bank?select=id,correct_key,kind&stem=like.*${encodeURIComponent('Editör sorusu ' + TAG)}*`);
    }
    await page.screenshot({ path: `${out}/editor-after-save-phone.png` });
    assert.equal(saved.length, 1); assert.equal(saved[0].correct_key, 'A');
    results.push({ check: 'stepped_editor_correct_choice_starts_empty_preview_hides_answer_saves_once', passed: true });
  }

  // 4) Senaryo: "Henüz bilmiyorum" yolu → çalışma senaryosu → dağılım değişirse "kişiselleştirilmiş çalışma".
  if (want('catalog')) {
    stage = 'catalog_unknown';
    const scenario = {
      id: randomUUID(), revision: 1, content_hash: 'c'.repeat(64),
      programme: 'Sentetik test programı', school_scope: 'Sentetik test kapsamı (UI testi)', programme_url: 'https://tymm.meb.gov.tr/',
      candidate: { key: 'p01-synthetic', academic_year: '', term: 1, exam: 1, grade: G, subject: 'Matematik', label: `Sentetik senaryo ${TAG}`,
        source_url: 'https://odsgm.meb.gov.tr/', source_sha256: 'd'.repeat(64), sheet: 'Test', header_cell: 'A1', question_count: 5,
        blocks: [
          { count: 3, count_cell: 'C2', outcomes: [{ cell: 'B2', text: 'Kesirlerle toplama ve çıkarma işlemi yapar (sentetik).', code: null }] },
          { count: 2, count_cell: 'C3', outcomes: [{ cell: 'B3', text: 'Ondalık gösterimleri karşılaştırır (sentetik).', code: null }] },
        ], review_reasons: ['UI test için sentetik'] },
    };
    let freshnessMode = 'error';
    const cpage = await context(async c => {
      await c.route('**/rest/v1/rpc/get_curriculum_scenarios', async route => {
        const body = JSON.parse(route.request().postData() || '{}');
        scenario.candidate.academic_year = body.p_year;
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([scenario]) });
      });
      await c.route('**/rest/v1/rpc/get_curriculum_source_freshness', async route => {
        if (freshnessMode === 'error') return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"offline"}' });
        return route.fallback();
      });
    });
    await signIn(cpage);
    await cpage.goto(`${web}/parent/prova/catalog`);
    await waitText(cpage, 'Öğretim yılı');
    await cpage.getByText(child.name, { exact: true }).first().click();
    await cpage.getByRole('button', { name: 'Matematik', exact: true }).first().click();
    await cpage.screenshot({ path: `${out}/catalog-scope-phone.png` });
    await cpage.getByRole('button', { name: 'Devam et', exact: true }).click();
    await waitText(cpage, 'Güncellik doğrulanamadı.');
    await waitText(cpage, 'Okulun senaryosunu biliyorum');
    const step1 = await text(cpage);
    assert.ok(!step1.includes(`Sentetik senaryo ${TAG}`), 'scenario not silently shown before school answer');
    for (const [size, vp] of Object.entries(sizes)) { await cpage.setViewportSize(vp); await shot(cpage, `catalog-school-question-freshness-unknown-${size}`); }
    await cpage.setViewportSize(sizes.phone);
    await cpage.getByText('Henüz bilmiyorum', { exact: true }).click();
    await waitText(cpage, `Çalışma senaryosu · Sentetik senaryo ${TAG}`);
    await cpage.getByText(`Çalışma senaryosu · Sentetik senaryo ${TAG}`, { exact: true }).click();
    await cpage.getByRole('button', { name: 'Devam et', exact: true }).click();
    await waitText(cpage, 'Tam senaryo: 2 öğrenme grubu · 5 soru');
    const step2 = await text(cpage);
    assert.ok(step2.includes('okul doğrulaması ve resmî uygunluk iddiası yoktur'), 'unknown notice');
    assert.ok(!step2.includes('Okulun duyurusuyla senaryo'), 'no school confirmation toggle on unknown path');
    for (const [size, vp] of Object.entries(sizes)) { await cpage.setViewportSize(vp); await shot(cpage, `catalog-unknown-study-${size}`); }
    await cpage.setViewportSize(sizes.phone);
    await cpage.getByRole('button', { name: 'Çalışma dağılımı olarak devam et', exact: true }).click();
    await cpage.waitForURL('**/parent/prova/blueprint**');
    await waitText(cpage, 'Çalışma senaryosu');
    await shot(cpage, 'blueprint-study-seed-phone');
    await cpage.getByLabel('2. satırın soru sayısını artır', { exact: true }).click();
    await waitText(cpage, 'Kişiselleştirilmiş çalışma');
    await waitText(cpage, '5 → 6 soru');
    for (const [size, vp] of Object.entries(sizes)) { await cpage.setViewportSize(vp); await cpage.getByText('Kişiselleştirilmiş çalışma', { exact: true }).first().scrollIntoViewIfNeeded(); await shot(cpage, `blueprint-personalized-${size}`); }
    await cpage.setViewportSize(sizes.phone);
    await cpage.getByRole('button', { name: 'Devam et', exact: true }).click();
    await waitText(cpage, `Sentetik senaryo ${TAG} · Kişiselleştirilmiş çalışma`);
    await cpage.getByText('Bu dağılımın okulun seçimi olmadığını', { exact: false }).first().click();
    await shot(cpage, 'blueprint-personalized-review-phone');
    await cpage.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await page.waitForTimeout(1500);
    const bps = await api(`exam_blueprints?select=name,rows,source_context&name=like.*${encodeURIComponent(TAG)}*`);
    assert.equal(bps.length, 1, 'one blueprint saved'); assert.ok(bps[0].name.includes('Kişiselleştirilmiş çalışma'));
    const ctx = bps[0].source_context || {};
    results.push({ check: 'scenario_unknown_path_study_label_freshness_unverified_personalized_saved_without_school_confirmation', passed: true, detail: { name: bps[0].name, rows: bps[0].rows, source_context: ctx } });
    // Katalog okul onayıyla (reviewed_catalogue) kaydedilmez. Sunucu veli girişli dağılımda da school_confirmed=true
    // yazıyor (20261103076000_family_blueprint.sql); migration yasak olduğu için kalan sınır olarak raporlanır.
    assert.notEqual(ctx.origin, 'reviewed_catalogue');
    assert.equal(ctx.origin, 'parent_entered');
    assert.deepEqual(cpage.errors, []);
    await cpage.context().close();
  }

  // 5) Kitapçık: öğrenci nüshası ve cevap anahtarı ayrı belgeler.
  if (want('booklet')) {
    stage = 'booklet';
    await page.setViewportSize(sizes.phone);
    await page.evaluate(() => {
      window.__booklets = [];
      const append = Node.prototype.appendChild;
      Node.prototype.appendChild = function (node) {
        const r = append.call(this, node);
        if (node && node.tagName === 'IFRAME' && node.contentWindow) {
          node.contentWindow.print = () => window.__booklets.push(node.contentDocument.documentElement.outerHTML);
        }
        return r;
      };
    });
    await page.goto(`${web}/parent/prova/booklet`);
    await waitText(page, 'Öğrenci nüshası ve cevap anahtarı ayrı belgedir');
    await page.getByLabel('Ders', { exact: true }).fill('Matematik');
    await page.getByLabel('Sınıf', { exact: true }).fill(String(G));
    await page.waitForFunction(() => /\b[1-9]\d* soru seçildi|Seçilen: [1-9]/.test(document.body.innerText) || document.body.innerText.includes('Kesirler'));
    for (const [size, vp] of Object.entries(sizes)) { await page.setViewportSize(vp); await shot(page, `booklet-two-copies-${size}`); }
    await page.setViewportSize(sizes.phone);
    await page.evaluate(() => {
      const append = Node.prototype.appendChild; window.__booklets = window.__booklets || [];
      if (!window.__patched) { window.__patched = true; Node.prototype.appendChild = function (node) { const r = append.call(this, node); if (node && node.tagName === 'IFRAME' && node.contentWindow) node.contentWindow.print = () => window.__booklets.push(node.contentDocument.documentElement.outerHTML); return r; }; }
    });
    await page.getByRole('button', { name: 'Öğrenci nüshasını oluştur', exact: true }).click();
    await page.waitForFunction(() => window.__booklets.length === 1);
    await page.getByRole('button', { name: 'Cevap anahtarını ayrı oluştur', exact: true }).click();
    await page.waitForFunction(() => window.__booklets.length === 2);
    const [student, key] = await page.evaluate(() => window.__booklets);
    assert.ok(!student.includes('class="key"') && student.includes('<main>') && student.includes(`Elle eklenen soru`), 'student copy has questions, no key');
    assert.ok(key.includes('class="key"') && !key.includes('<main>') && !key.includes('class="cover"'), 'key copy has no question pages');
    assert.ok(!student.includes('2/5 + 1/5 = 3/5'), 'student copy has no solution');
    const view = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await view.setContent(student); await view.screenshot({ path: `${out}/booklet-student-copy.png`, fullPage: true });
    await view.pdf({ path: `${out}/booklet-student-copy.pdf`, format: 'A4' });
    await view.setContent(key); await view.screenshot({ path: `${out}/booklet-answer-key.png`, fullPage: true });
    await view.pdf({ path: `${out}/booklet-answer-key.pdf`, format: 'A4' });
    await view.close();
    results.push({ check: 'booklet_student_copy_and_answer_key_are_separate_documents', passed: true });
  }

  // 6) İnceleme çalışma alanı: boş açık uçlu soruda "Cevap yok", puan kutusu yer tutucusu "—".
  if (want('review')) {
    stage = 'review_blank';
    const exam = (await api('exams', [{ family_id: f.familyId, child_id: child.id, title: `İnceleme boş ${TAG}`, subject: 'Matematik', grade: G, question_ids: [aiId, manualId], status: 'assigned' }], 'return=representation'))[0];
    const started = await api('rpc/start_exam_attempt', { p_exam_id: exam.id }); const attemptId = Array.isArray(started) ? started[0].id : started.id;
    await api('rpc/submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: attemptId, p_question_id: aiId, p_expected_revision: 0, p_answer_text: '1/2' });
    await api('rpc/finish_exam_attempt', { p_attempt_id: attemptId });
    for (const [size, vp] of Object.entries(sizes)) {
      await page.setViewportSize(vp); await page.goto(`${web}/parent/prova/review/${attemptId}?questionId=${manualId}`);
      await waitText(page, 'Bu soru için cevap gönderilmemiş.');
      const body = await text(page);
      assert.ok(body.includes('Cevap yok'), size + ' footer Cevap yok');
      assert.ok(!body.includes('Değerlendirme bekliyor'), size + ' no "Değerlendirme bekliyor" on blank');
      const ph = await page.getByLabel('Puan', { exact: true }).first().getAttribute('placeholder').catch(() => null);
      if (ph !== null) assert.equal(ph, '—');
      results.push({ check: `review_blank_${size}`, passed: true, detail: { placeholder: ph } });
      await shot(page, `review-blank-question-${size}`);
    }
    // Cevaplı açık uçlu soru hâlâ "Değerlendirme bekliyor".
    await page.setViewportSize(sizes.phone); await page.goto(`${web}/parent/prova/review/${attemptId}?questionId=${aiId}`);
    await waitText(page, 'Değerlendirme bekliyor');
    await shot(page, 'review-answered-question-phone');
    results.push({ check: 'review_blank_question_no_answer_label_and_dash_placeholder', passed: true });
  }
  assert.deepEqual(page.errors, [], 'no page errors');
  results.push({ check: 'no_page_errors_no_overflow_translations_resolved', passed: true });
})().then(() => {
  fs.writeFileSync(`${out}/ui-checks.json`, JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, count: results.length }));
}).catch(e => {
  fs.writeFileSync(`${out}/ui-checks.json`, JSON.stringify({ ok: false, stage, error: String(e && e.message || e).slice(0, 600), results }, null, 2));
  console.error('FAILED at ' + stage + ': ' + String(e && e.message || e).slice(0, 600));
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });
