// D4 — C12'de GÖRÜLEMEYEN mobil alt akışlar (T1) + kalan P2'ler, gerçek uygulamada (Playwright, gerçek izole
// Auth/REST/Storage/Realtime/Edge). Yalnız `test-isolated-services.py --run-local --ui-hold` geçici sentetik fixture'ı
// kabul edilir (loopback, @example.invalid). AI: izole Edge'deki gerçek prova-generate + deterministik sağlayıcı.
// Ortam: GINA_QA_UI_FIXTURE, GINA_QA_WEB, GINA_QA_WEB_BACKEND, GINA_QA_WEB_ANON, GINA_QA_PLAYWRIGHT_PATH,
// GINA_D4_OUT (çıktı klasörü), GINA_D4_DB (yalnız `gina_http_*_audit` geçici DB; çalışma planı tohumu için),
// GINA_D4_ONLY (virgüllü akış listesi, isteğe bağlı).
// Taklitler açıkça yazılır: süre dolumu için tarayıcı saati (Playwright clock) ileri alınır; çalışma planı satırı
// geçici DB'ye doğrudan eklenir (izole sağlayıcı prova-plan şemasını üretmez). Web taklidi cihaz kabulü değildir.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const { createClient } = require(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'));
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const DB = process.env.GINA_D4_DB || ''; assert.match(DB, /^gina_http_[0-9a-f]{16}_audit$/, 'disposable DB only');
const out = path.resolve(process.env.GINA_D4_OUT || path.join(__dirname, '../docs/release/d4-2026-11-06/ui'));
fs.mkdirSync(out, { recursive: true });
const only = (process.env.GINA_D4_ONLY || '').split(',').filter(Boolean);
const sizes = {
  phone: { width: 390, height: 844 }, narrow: { width: 360, height: 640 },
  tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 },
};
const ALL = ['phone', 'narrow', 'tablet', 'desktop'];
const TAG = crypto.randomUUID().slice(0, 4);
const results = [];
const record = (check, passed, detail) => { results.push({ check, passed, ...(detail === undefined ? {} : { detail }) }); console.error((passed ? 'ok ' : 'FAIL ') + check + (passed ? '' : ' ' + JSON.stringify(detail).slice(0, 400))); };
let browser;

function psql(sql) {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' }).trim();
}

async function context(opts = {}) {
  const c = await browser.newContext({ viewport: sizes.phone, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', ...opts });
  await c.route(backend + '/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const headers = { ...req.headers() };
    if (headers.apikey === placeholderAnon) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + placeholderAnon) headers.authorization = 'Bearer ' + f.anon;
    try {
      const res = await route.fetch({ url: f.url + req.url().slice(backend.length), headers, timeout: 90000 });
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
    } catch { await route.fulfill({ status: 503, body: 'fixture unavailable' }); }
  });
  const p = await c.newPage(); p.setDefaultTimeout(25000);
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  return p;
}
const body = p => p.locator('body').innerText();
const btn = (p, n) => p.getByRole('button', { name: n, exact: true });
async function shot(p, name, list = ALL) {
  const m = {};
  for (const size of list) {
    await p.setViewportSize(sizes[size]); await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(out, `${name}-${size}.png`), fullPage: true });
    const a = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth,
      keys: (document.body.innerText.match(/\b(?:sharedQuestions|repeatCalendar|planCalendar|provaBuilder|prova|unified|provaV5|experience)\.[a-zA-Z0-9_.]+\b/g) || []).slice(0, 4) }));
    m[size] = a;
  }
  await p.setViewportSize(sizes.phone);
  return m;
}
const clean = m => Object.values(m).every(v => v.overflow <= 1 && v.keys.length === 0);
async function signIn(p, email = f.email, password = f.password) {
  await p.goto(web + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(email); await p.getByLabel('Şifre', { exact: true }).fill(password);
  await p.getByLabel('Şifre', { exact: true }).press('Enter');
  await p.waitForURL('**/parent', { timeout: 30000 });
}
async function enterChildMode(p, name) {
  await p.goto(web + '/parent/child-mode'); await p.waitForTimeout(1500);
  const pick = p.getByRole('button', { name: new RegExp('^' + name) }).first();
  if (await pick.count()) await pick.click();
  await p.getByLabel('Çocuk PIN’i', { exact: true }).fill('1234');
  await btn(p, 'Dünyama gir').click();
  await p.waitForURL('**/parent/child-mode/today', { timeout: 20000 });
}
async function failDump(p, name) {
  if (!p) return;
  try { await p.screenshot({ path: path.join(out, `FAILED-${name}.png`), fullPage: true }); fs.writeFileSync(path.join(out, `FAILED-${name}.txt`), (await body(p)).slice(0, 6000)); } catch {}
}

const flows = {};

// T1-a: ortak kaynak sihirbazı adım 2 (sorular) ve adım 3 (önizle + kaydet).
flows.shared_source = async (db, p) => {
  await p.goto(web + '/parent/prova/shared-source'); await p.getByText('Birlikte düşünülen sorular').first().waitFor();
  await p.getByLabel('Ders', { exact: true }).first().fill('Türkçe');
  await p.getByLabel('İçeriğin başlığı', { exact: true }).fill(`D4 okuma metni ${TAG}`);
  await p.getByLabel('Ortak metin', { exact: true }).fill('Ali sabah erkenden kalktı, kahvaltısını yaptı ve kütüphaneye gitti. Orada iki kitap seçti.');
  await btn(p, 'Sorulara geç').click();
  await p.getByLabel('Soru', { exact: true }).waitFor();
  const step2Empty = await shot(p, 'shared-source-step2-empty', ['phone', 'narrow']);
  // Boş soruyla önizlemeye geçilemez (doğrulama).
  await btn(p, 'Önizle').click();
  const blocked = /Soru 1/.test(await body(p)) && await p.getByLabel('Soru', { exact: true }).count() === 1;
  await p.getByLabel('Soru', { exact: true }).fill('Ali sabah nereye gitti?');
  await p.getByLabel('Beklenen cevap', { exact: true }).fill('Kütüphaneye');
  await p.getByLabel('Çözüm açıklaması', { exact: true }).fill('Metnin ikinci cümlesinde yazıyor.');
  await p.getByRole('tab', { name: 'Soru 2', exact: true }).first().click();
  await p.getByLabel('Soru', { exact: true }).fill('Ali kaç kitap seçti?');
  await p.getByLabel('Beklenen cevap', { exact: true }).fill('İki');
  await p.getByLabel('Çözüm açıklaması', { exact: true }).fill('Metnin son cümlesi.');
  const step2 = await shot(p, 'shared-source-step2');
  await btn(p, 'Önizle').click();
  await p.getByText('Ali kaç kitap seçti?').first().waitFor();
  const step3 = await shot(p, 'shared-source-step3');
  await btn(p, 'Soru grubunu kaydet').click();
  await btn(p, 'Prova hazırla').waitFor({ timeout: 30000 });
  const saved = await shot(p, 'shared-source-saved', ['phone', 'desktop']);
  const row = (await db.from('question_source_groups').select('id,title,version').eq('title', `D4 okuma metni ${TAG}`)).data?.[0];
  const members = row ? (await db.from('question_source_members').select('question_id').eq('group_id', row.id)).data?.length : 0;
  record('t1_shared_source_steps_2_3_save', !!row && members === 2 && blocked && clean(step2) && clean(step3) && clean(saved) && clean(step2Empty),
    { group: !!row, version: row?.version, members, emptyQuestionBlocked: blocked, step2, step3 });
};

// T1-b: dolu tekrar planı kaydı (soru + gün seç, bir günü düzenle → kontrol et → takvime ekle → kayıtlı özet).
flows.repeat_save = async (db, p) => {
  await p.goto(web + `/parent/prova/repeat/${f.attemptId}`); await p.getByText('1 · Birlikte bakacağınız sorular').first().waitFor();
  const choose = await shot(p, 'repeat-choose', ['phone', 'narrow']);
  const qs = p.getByRole('button', { name: /^\d+\. soru · / });
  const nq = await qs.count();
  for (let i = 0; i < nq; i++) await qs.nth(i).click();
  for (const d of [1, 2, 3]) await p.getByRole('button', { name: new RegExp(`^${d}\\. buluşma · `) }).first().click();
  await p.getByRole('button', { name: 'Gün ve içeriği düzenle: 1. buluşma', exact: true }).click();
  const time = p.getByLabel('Saat (SS:DD)', { exact: true }).first();
  await time.fill('18:30');
  const filled = await shot(p, 'repeat-filled', ['phone', 'narrow', 'tablet', 'desktop']);
  await btn(p, 'Planı kontrol et').click();
  await p.waitForTimeout(1200);
  const preview = await shot(p, 'repeat-preview');
  const apply = p.getByRole('button', { name: /takvim/i }).filter({ hasText: /ekle|yerleştir|kaydet/i }).first();
  await apply.click();
  await p.getByText('Tekrar günleri takvimde').first().waitFor({ timeout: 30000 });
  const saved = await shot(p, 'repeat-saved');
  const savedText = await body(p);
  await p.reload(); await p.waitForTimeout(3500);
  const again = /Tekrar günleri takvimde/.test(await body(p));
  const ev = psql(`select count(*) || '|' || coalesce(string_agg(to_char(starts_at at time zone 'Europe/Istanbul','HH24:MI'), ',' order by starts_at), '') from public.events where family_id='${f.familyId}' and title = 'Birlikte kısa tekrar' and created_at > now() - interval '3 minutes';`);
  const [count, times] = ev.split('|');
  record('t1_repeat_plan_save_filled', nq > 0 && again && Number(count) === 3 && times.split(',')[0] === '18:30' && clean(choose) && clean(filled) && clean(preview) && clean(saved),
    { questionsSelected: nq, eventsCreated: Number(count), times, reopenShowsSaved: again, savedSummary: (savedText.match(/Tekrar günleri takvimde[\s\S]{0,200}/) || [''])[0], filled, preview, saved });
};

// T1-c: çalışma planı gün onayı + takvim çakışması uyarısı.
flows.plan_days = async (db, p) => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const plan = { ozet: 'Sentetik tekrar planı: kesirlere kısa tekrarlar.', gunler: [
    { gun: 1, konu: 'Kesirler', etkinlik: 'Örnekleri yeniden çöz', sure_dk: 20 },
    { gun: 2, konu: 'Ondalık sayılar', etkinlik: '5 soruluk mini deneme', sure_dk: 25 },
    { gun: 3, konu: 'Kesirler', etkinlik: 'Hatalı soruları yeniden dene', sure_dk: 15 } ], gorev_onerileri: ['Kesir kartları'] };
  const id = psql(`insert into public.study_plans (family_id, child_id, attempt_id, subject, grade, weak_topics, plan, status, prompt_version)
    values ('${f.familyId}', '${f.childId}', '${f.attemptId}', 'Matematik', 4, '[{"topic":"Kesirler","pct":40,"total":5}]'::jsonb, '${JSON.stringify(plan).replace(/'/g, "''")}'::jsonb, 'draft', 'd4-synthetic') returning id;`).split('\n')[0];
  await p.goto(web + `/parent/prova/plan/${id}`); await p.getByText('Sentetik tekrar planı').first().waitFor();
  const start = await shot(p, 'plan-days-start', ['phone', 'narrow']);
  const text0 = await body(p);
  record('t1_plan_page_opens', /Kesirler/.test(text0), { start, snippet: text0.slice(0, 300) });
  // Gün seç (1 ve 2), 1. günün saatini düzenle → gözden geçir (çakışma uyarısı) → takvime ekle.
  for (const d of [1, 2]) await p.getByRole('button', { name: new RegExp(`^${d}\\. gün · `) }).first().click();
  const selected = await shot(p, 'plan-days-selected', ['phone', 'narrow', 'tablet', 'desktop']);
  await p.getByRole('button', { name: /^Seçilen 2 günü gözden geçir$/ }).click();
  await p.waitForTimeout(1500);
  const preview = await shot(p, 'plan-days-preview');
  const text1 = await body(p);
  const overlap = /Bu saatlerde başka planlar var/.test(text1);
  await p.getByRole('button', { name: /^2 etkinliği takvime ekle$/ }).click();
  await p.waitForTimeout(3500);
  const done = await shot(p, 'plan-days-saved');
  const links = (await db.from('study_plan_calendar_items').select('day,event_id').eq('plan_id', id)).data || [];
  const status = psql(`select status from public.study_plans where id='${id}';`);
  await p.reload(); await p.waitForTimeout(3000);
  const reopened = await body(p);
  record('t1_plan_day_confirm', links.length === 2 && clean(selected) && clean(preview) && clean(done),
    { linked: links.map(l => l.day).sort(), planStatusAfter: status, overlapWarningShown: overlap, overlapText: (text1.match(/Bu saatlerde başka planlar var[\s\S]{0,160}/) || [''])[0],
      reopenedListsLinkedDays: /1\. gün · /.test(reopened), selected, preview, done });
};

// T1-d: "Belgeden yararlan" (belge yükle → onay → AI → seç → taslağa ekle).
flows.document = async (db, p) => {
  const fixtureTs = fs.readFileSync(path.resolve(__dirname, '../supabase/functions/ai-preflight/fixture.ts'), 'utf8');
  const png = Buffer.from(fixtureTs.match(/"([A-Za-z0-9+/=]{100,})"/)[1], 'base64');
  const childName = (await db.from('children').select('name').eq('id', f.childId).single()).data.name;
  await p.goto(web + '/parent/prova/builder');
  await p.getByRole('button', { name: new RegExp('^' + childName) }).first().click();
  await btn(p, 'Konu pekiştirme').click();
  await btn(p, 'Matematik').click();
  await btn(p, 'Devam et').click();
  await p.getByLabel('Konu ekle', { exact: true }).fill('Kesirler');
  await btn(p, 'Ekle').click();
  await btn(p, 'Devam et').click();
  await btn(p, 'Soru ekle').first().click();
  await btn(p, 'Belgeden yararlan').click();
  await p.waitForTimeout(800);
  const open = await shot(p, 'document-open', ['phone', 'narrow']);
  // Tek ders + kapsamdaki konu (Kesirler) varsayılan olarak seçili gelir; dokunmak seçimi kaldırır.
  const chooser = p.waitForEvent('filechooser');
  await btn(p, 'Dosyalar').first().click();
  await (await chooser).setFiles({ name: 'd4-calisma-kagidi.png', mimeType: 'image/png', buffer: png });
  await p.getByText(/d4-calisma-kagidi\.png/).first().waitFor();
  const generate = btn(p, 'Soruları hazırla');
  const costLine = ((await body(p)).match(/\d+ soru üretimi[^\n]*/) || [''])[0];
  const disabledWithoutConsent = await generate.isDisabled();
  await p.getByRole('switch', { name: /Seçtiğim kaynakların özel saklanmasını/ }).click();
  const ready = await shot(p, 'document-ready');
  await btn(p, 'Soruları hazırla').click();
  await p.getByText(/Önerilerin tümünü seç/).first().waitFor({ timeout: 90000 });
  const proposals = await shot(p, 'document-proposals');
  await p.getByRole('button', { name: /^Önerilerin tümünü seç/ }).first().click();
  await btn(p, 'Seçtiklerimi ekle').click();
  await p.waitForTimeout(1500);
  const added = await shot(p, 'document-added', ['phone', 'desktop']);
  const mix = ((await body(p)).match(/Bu taslakta:[^\n]*/) || [''])[0];
  const src = (await db.from('learning_sources').select('id,kind,status').eq('family_id', f.familyId).eq('kind', 'document').order('created_at', { ascending: false }).limit(1)).data?.[0];
  record('t1_document_source_flow', /belge/i.test(mix) && disabledWithoutConsent && clean(open) && clean(ready) && clean(proposals) && clean(added),
    { mix, costLine, generateDisabledWithoutConsent: disabledWithoutConsent, documentSource: src ? { kind: src.kind, status: src.status } : 'not readable by parent (RLS) or absent', open, ready, proposals, added });
};

// T1-e: 10 dakikalık süreli Prova; tarayıcı saati 10 dk ileri alınır → otomatik bitirme.
flows.timer = async (db, p) => {
  const imageExam = (await db.from('exams').select('question_ids,subject,grade').eq('id', f.examId).single()).data;
  const examId = (await db.from('exams').insert({ family_id: f.familyId, child_id: f.childId, title: `D4 süreli ${TAG}`, subject: imageExam.subject, grade: imageExam.grade,
    question_ids: imageExam.question_ids, status: 'assigned', timed: true, duration_minutes: 10 }).select('id').single()).data.id;
  await p.clock.install();
  const childName = (await db.from('children').select('name').eq('id', f.childId).single()).data.name;
  await signIn(p); await enterChildMode(p, childName);
  await p.goto(web + `/parent/child-mode/prova/${examId}`); await p.waitForTimeout(3000);
  const startBtn = p.getByRole('button', { name: /^(Başla|Başlayalım|Denemeye başla|Prova’ya başla|Hazırım)/ }).first();
  if (await startBtn.count()) { await startBtn.click(); await p.waitForTimeout(2500); }
  const running = await shot(p, 'timer-running', ['phone', 'tablet']);
  const t0 = await body(p);
  const radio = p.getByRole('radio').first();
  if (await radio.count()) { await radio.click(); await p.waitForTimeout(2500); }
  const attempt0 = (await db.from('exam_attempts').select('id,status,deadline_at,started_at').eq('exam_id', examId)).data?.[0];
  await p.clock.fastForward('10:05');
  await p.waitForTimeout(250);
  const tMoment = await body(p);
  await p.screenshot({ path: path.join(out, 'timer-timeup-moment-phone.png') });
  await p.getByText('Deneme bitti!').first().waitFor({ timeout: 30000 });
  const ended = await shot(p, 'timer-ended', ['phone', 'narrow', 'tablet', 'desktop']);
  const t1 = await body(p);
  const attempt1 = (await db.from('exam_attempts').select('id,status,finished_at').eq('exam_id', examId)).data?.[0];
  const minutes = attempt0?.deadline_at ? Math.round((new Date(attempt0.deadline_at) - new Date(attempt0.started_at)) / 60000) : null;
  const resultLine = (t1.match(/Çoktan seçmeli:[^\n]*\n?[^\n]*/) || [''])[0].replace(/\n/g, ' ');
  record('t1_timer_10min_auto_finish', minutes === 10 && attempt0?.status === 'in_progress' && attempt1?.status !== 'in_progress' && !!attempt1?.finished_at && /1 \/ 1/.test(resultLine) && clean(running) && clean(ended),
    { minutes, before: attempt0?.status, after: attempt1?.status, clockBefore: (t0.match(/\d{1,2}:\d{2}/) || [])[0], timeUpMomentShowsSüreDoldu: /Süre doldu/.test(tMoment),
      resultShowsTimeEnded: /Süre doldu/.test(t1), resultLine, pageErrors: p.errors.slice(0, 3), running, ended });
};

// T1-f: veli PIN'i tanımsız kartı (yalnız gözlem; D2 alanı).
flows.parent_pin_card = async (db) => {
  const email = `d4-${crypto.randomUUID().slice(0, 8)}@example.invalid`, password = crypto.randomBytes(12).toString('hex') + 'A1!';
  const fresh = createClient(f.url, f.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const up = await fresh.auth.signUp({ email, password });
  assert.ok(up.data.session, 'fresh signup');
  const fam = await fresh.rpc('create_family', { p_name: 'D4 Örnek Ailesi', p_display_name: 'D4 veli' });
  await fresh.auth.refreshSession();
  const one = await fresh.rpc('save_child_setup', { p_request_id: crypto.randomUUID(), p_profile: { name: 'Pinsiz Çocuk', birth_year: 2016, grade: 4, gender: 'unspecified', avatar: 'avatar-default', interests: [] }, p_tasks: [] });
  const p = await context();
  await signIn(p, email, password);
  await p.goto(web + '/parent/child-mode'); await p.getByText('Önce ebeveyn alanını koruyalım').first().waitFor();
  const m = await shot(p, 'parent-pin-missing');
  const actions = await p.evaluate(() => [...document.querySelectorAll('[role=button]')].map(b => b.getAttribute('aria-label') || b.innerText.trim()).filter(Boolean).slice(0, 12));
  const childVisible = /Pinsiz Çocuk/.test(await body(p));
  const setPin = p.getByRole('button', { name: /PIN/ }).first();
  let target = null;
  if (await setPin.count()) { await setPin.click(); await p.waitForTimeout(1500); target = new URL(p.url()).pathname + new URL(p.url()).search; await shot(p, 'parent-pin-missing-target', ['phone']); }
  record('t1_parent_pin_missing_card_observed', !fam.error && !one.error && clean(m), { childPickerVisibleBeforePin: childVisible, actions, setPinTarget: target, sizes: m, pageErrors: p.errors.slice(0, 3) });
  await p.context().close();
};

// Q00-C12-12: azaltılmış harekette karar penceresi (DecisionSheet: çocuk Prova "gönder" onayı) solmadan açılır.
flows.modal_motion = async (db) => {
  const ex = (await db.from('exams').select('question_ids,subject,grade').eq('id', f.examId).single()).data;
  const childName = (await db.from('children').select('name').eq('id', f.childId).single()).data.name;
  const probe = async motion => {
    const examId = (await db.from('exams').insert({ family_id: f.familyId, child_id: f.childId, title: `D4 hareket ${motion} ${TAG}`, subject: ex.subject, grade: ex.grade,
      question_ids: ex.question_ids.slice(0, 1), status: 'assigned' }).select('id').single()).data.id;
    const p = await context({ reducedMotion: motion });
    try {
      await signIn(p); await enterChildMode(p, childName);
      await p.goto(web + `/parent/child-mode/prova/${examId}`); await p.waitForTimeout(3500);
      const title = p.getByText('Cevaplarını göndermeye hazır mısın?');
      for (let i = 0; i < 4 && !(await title.count()); i++) {
        const go = p.getByRole('button', { name: /^(Sonraki( soru)?|Bitir|Cevaplarımı gönder)$/ }).last();
        if (!(await go.count())) break;
        await go.click(); await p.waitForTimeout(i === 0 ? 0 : 400);
      }
      const samples = [];
      for (let i = 0; i < 6; i++) { samples.push(await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)); await p.waitForTimeout(40); }
      await title.first().waitFor({ timeout: 5000 });
      await p.screenshot({ path: path.join(out, `modal-${motion}-phone.png`) });
      return { motion, runningAnimationsDuringOpen: samples };
    } catch (e) { await failDump(p, 'modal-' + motion); return { motion, error: String(e.message).split('\n')[0] }; }
    finally { await p.context().close(); }
  };
  const reduce = await probe('reduce'), normal = await probe('no-preference');
  record('c12_12_modal_respects_reduced_motion', !reduce.error && !normal.error && reduce.runningAnimationsDuringOpen.every(n => n === 0) && normal.runningAnimationsDuringOpen.some(n => n > 0), { reduce, normal });
};

// Q00-C12-13: giriş ekranında klavye; kaydırma kabı odak alırsa görünür halka taşır.
flows.sign_in_focus = async () => {
  const p = await context();
  await p.goto(web + '/sign-in'); await p.waitForTimeout(1500);
  const order = [];
  for (let i = 0; i < 14; i++) {
    await p.keyboard.press('Tab');
    order.push(await p.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a);
      return { n: a === document.body ? 'BODY (sekme dizisinin sonu)' : (a.getAttribute('aria-label') || a.innerText || a.getAttribute('placeholder') || a.tagName).trim().slice(0, 30), scroller: a.hasAttribute('data-gina-scroll'), ring: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' }; }));
  }
  const scrollStops = order.filter(o => o.scroller);
  // Kaydırma kabı Chrome'da odaklanabilir (odaklanabilir kaydırıcı); klavye kipinde odaklanınca halka görünmeli.
  const scroller = await p.evaluate(() => { const e = document.querySelector('[data-gina-scroll]'); if (!e) return null; e.focus(); const s = getComputedStyle(e);
    return { focused: document.activeElement === e, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}` }; });
  await p.screenshot({ path: path.join(out, 'sign-in-scroll-focus-phone.png') });
  record('c12_13_sign_in_scroll_focus_visible', scrollStops.every(o => o.ring) && !!scroller?.focused && /^solid 3px/.test(scroller.outline),
    { order, scrollStopsInTabOrder: scrollStops.length, scrollerProgrammaticFocus: scroller });
  await p.context().close();
};

// Q00-C12-T3: kitapçık sınıf alanı seçim (radyo), serbest metin değil.
flows.booklet_grade = async (db, p) => {
  await p.goto(web + '/parent/prova/booklet'); await p.waitForTimeout(2500);
  const textGrade = await p.getByRole('textbox', { name: 'Sınıf', exact: true }).count();
  const radios = await p.getByRole('radio', { name: /\. sınıf$/ }).count();
  await p.getByRole('radio', { name: '6. sınıf', exact: true }).click();
  const checked = await p.getByRole('radio', { name: '6. sınıf', exact: true }).getAttribute('aria-checked');
  const m = await shot(p, 'booklet-grade');
  record('c12_t3_booklet_grade_choice', textGrade === 0 && radios === 12 && checked === 'true' && clean(m), { textGrade, radios, checked, sizes: m });
};

(async () => {
  const db = createClient(f.url, f.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await db.auth.signInWithPassword({ email: f.email, password: f.password });
  assert.ok(!login.error, 'login');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [name, fn] of Object.entries(flows)) {
    if (only.length && !only.includes(name)) continue;
    let p = null;
    try {
      if (!['parent_pin_card', 'modal_motion', 'sign_in_focus'].includes(name)) { p = await context(); if (name !== 'timer') await signIn(p); }
      await fn(db, p);
      if (p && p.errors.length) record(name + '_no_page_errors', false, p.errors.slice(0, 3));
    } catch (e) {
      record(name, false, { error: String(e.message).split('\n')[0] });
      await failDump(p, name);
    } finally { if (p) await p.context().close().catch(() => {}); }
  }
  const file = path.join(out, only.length ? `checks-${only.join('_')}.json` : 'checks.json');
  fs.writeFileSync(file, JSON.stringify({ environment: 'disposable-local-auth-rest-storage-realtime-edge (deterministic AI provider)', results }, null, 1));
  console.log(JSON.stringify(results.map(r => [r.check, r.passed])));
  await browser.close();
})().catch(async e => { console.error('FATAL', e.stack); if (browser) await browser.close(); process.exit(1); });
