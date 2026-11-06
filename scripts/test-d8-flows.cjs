// D8 — D4'ten devreden düzeltmeler, gerçek uygulamada (Playwright, gerçek izole Auth/REST/Storage/Realtime).
// Yalnız `test-isolated-services.py --run-local --ui-hold` geçici sentetik fixture'ı kabul edilir (loopback, @example.invalid).
// Ortam: GINA_QA_UI_FIXTURE, GINA_QA_WEB, GINA_QA_WEB_BACKEND, GINA_QA_WEB_ANON, GINA_QA_PLAYWRIGHT_PATH,
// GINA_D8_OUT (çıktı klasörü), GINA_D8_DB (yalnız `gina_http_*_audit` geçici DB), GINA_D8_ONLY (isteğe bağlı akış listesi).
// Taklitler açıkça yazılır: (A) süre dolumu için tarayıcı saati ileri alınır (sunucu saati değişmez);
// (B) süre dolumunun sunucu tarafı için geçici DB'de denemenin started_at/deadline_at değerleri 11 dk geriye çekilir
// (çocuk süre bitmişken ekrana dönmüş gibi). Web taklidi cihaz kabulü değildir.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const { createClient } = require(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'));
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const DB = process.env.GINA_D8_DB || ''; assert.match(DB, /^gina_http_[0-9a-f]{16}_audit$/, 'disposable DB only');
const out = path.resolve(process.env.GINA_D8_OUT || path.join(__dirname, '../docs/release/d8-2026-11-06/ui'));
fs.mkdirSync(out, { recursive: true });
const only = (process.env.GINA_D8_ONLY || '').split(',').filter(Boolean);
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 } };
const ALL = ['phone', 'tablet'];
const TAG = crypto.randomUUID().slice(0, 4);
const results = [];
const record = (check, passed, detail) => { results.push({ check, passed, ...(detail === undefined ? {} : { detail }) }); console.error((passed ? 'ok ' : 'FAIL ') + check + (passed ? '' : ' ' + JSON.stringify(detail).slice(0, 500))); };
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
    m[size] = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth,
      keys: (document.body.innerText.match(/\b(?:d8|sharedQuestions|repeatCalendar|prova|provaV5|experience|learningPlan|guidedInput)\.[a-zA-Z0-9_.]+\b/g) || []).slice(0, 4) }));
  }
  await p.setViewportSize(sizes.phone);
  return m;
}
const clean = m => Object.values(m).every(v => v.overflow <= 1 && v.keys.length === 0);
async function signIn(p) {
  await p.goto(web + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.email); await p.getByLabel('Şifre', { exact: true }).fill(f.password);
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
const sample = async p => { const s = []; for (let i = 0; i < 6; i++) { s.push(await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)); await p.waitForTimeout(40); } return s; };

const flows = {};

// (1) Kalan sabit fade'ler: veli inceleme alanındaki "Soruyu göster" penceresi (parent-review-workspace) ve
// soru görselini büyütme penceresi (question-media). reduce → açılışta çalışan animasyon 0; normal → >0.
flows.modal_motion = async () => {
  const probe = async (motion, which) => {
    const p = await context({ reducedMotion: motion });
    try {
      await signIn(p);
      await p.goto(web + `/parent/prova/review/${f.attemptId}`); await p.waitForTimeout(3500);
      // "Soruyu göster" yalnız defter (çizimli not) görünümünde; o görünüme geçilir.
      if (which === 'question_preview') { await btn(p, 'Çizimli not ekle').first().click(); await p.waitForTimeout(1500); }
      const trigger = which === 'question_preview'
        ? p.getByRole('button', { name: 'Soruyu göster', exact: true }).first()
        : p.getByRole('button', { name: /^Görseli büyüt/ }).first();
      if (!(await trigger.count())) { fs.writeFileSync(path.join(out, `FAILED-modal-${which}.txt`), (await body(p)).slice(0, 4000)); await p.screenshot({ path: path.join(out, `FAILED-modal-${which}.png`), fullPage: true }); return { motion, which, error: 'trigger_absent' }; }
      await trigger.click();
      const samples = await sample(p);
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(out, `modal-${which}-${motion}-phone.png`) });
      return { motion, which, runningAnimationsDuringOpen: samples };
    } catch (e) { await failDump(p, `modal-${which}-${motion}`); return { motion, which, error: String(e.message).split('\n')[0] }; }
    finally { await p.context().close(); }
  };
  for (const which of ['question_preview']) {
    const reduce = await probe('reduce', which), normal = await probe('no-preference', which);
    const ok = !reduce.error && !normal.error && reduce.runningAnimationsDuringOpen.every(n => n === 0) && normal.runningAnimationsDuringOpen.some(n => n > 0);
    record(`c12_12_${which}_respects_reduced_motion`, ok, { reduce, normal });
  }
};

// (2) D4-1: ortak kaynak sihirbazında Sınıf 1–12 radyo grubu; seçilen sınıf kayda gider.
flows.shared_source_grade = async (db, p) => {
  await p.goto(web + '/parent/prova/shared-source'); await p.getByText('Birlikte düşünülen sorular').first().waitFor();
  await p.getByRole('radio', { name: '7. sınıf', exact: true }).waitFor();
  const textGrade = await p.getByRole('textbox', { name: 'Sınıf', exact: true }).count();
  const radios = await p.getByRole('radio', { name: /^\d+\. sınıf$/ }).count();
  const group = await p.getByRole('radiogroup', { name: 'Sınıf' }).count();
  await p.getByRole('radio', { name: '7. sınıf', exact: true }).click();
  const checked = await p.getByRole('radio', { name: '7. sınıf', exact: true }).getAttribute('aria-checked');
  const otherChecked = await p.getByRole('radio', { name: '5. sınıf', exact: true }).getAttribute('aria-checked');
  await p.getByLabel('Ders', { exact: true }).first().fill('Türkçe');
  await p.getByLabel('İçeriğin başlığı', { exact: true }).fill(`D8 okuma metni ${TAG}`);
  await p.getByLabel('Ortak metin', { exact: true }).fill('Ali sabah erkenden kalktı, kahvaltısını yaptı ve kütüphaneye gitti. Orada iki kitap seçti.');
  const step1 = await shot(p, 'shared-source-grade');
  await btn(p, 'Sorulara geç').click();
  await p.getByLabel('Soru', { exact: true }).waitFor();
  await p.getByLabel('Soru', { exact: true }).fill('Ali sabah nereye gitti?');
  await p.getByLabel('Beklenen cevap', { exact: true }).fill('Kütüphaneye');
  await p.getByLabel('Çözüm açıklaması', { exact: true }).fill('Metnin ikinci cümlesinde yazıyor.');
  await p.getByRole('tab', { name: 'Soru 2', exact: true }).first().click();
  await p.getByLabel('Soru', { exact: true }).fill('Ali kaç kitap seçti?');
  await p.getByLabel('Beklenen cevap', { exact: true }).fill('İki');
  await p.getByLabel('Çözüm açıklaması', { exact: true }).fill('Metnin son cümlesi.');
  await btn(p, 'Önizle').click();
  await p.getByText('Ali kaç kitap seçti?').first().waitFor();
  await btn(p, 'Soru grubunu kaydet').click();
  await btn(p, 'Prova hazırla').waitFor({ timeout: 30000 });
  const row = (await db.from('question_source_groups').select('id,grade').eq('title', `D8 okuma metni ${TAG}`)).data?.[0];
  record('d4_1_shared_source_grade_choice', textGrade === 0 && radios === 12 && group === 1 && checked === 'true' && otherChecked === 'false' && row?.grade === 7 && clean(step1),
    { textGrade, radios, radiogroup: group, checked7: checked, checked5: otherChecked, savedGrade: row?.grade, sizes: step1 });
};

// (4) D4-3: tekrar takvimi gün düzenleme — serbest metin yerine ortak tarih/saat seçicileri.
flows.repeat_datetime = async (db, p) => {
  await p.goto(web + `/parent/prova/repeat/${f.attemptId}`); await p.getByText('1 · Birlikte bakacağınız sorular').first().waitFor();
  const qs = p.getByRole('button', { name: /^\d+\. soru · / });
  const nq = await qs.count();
  for (let i = 0; i < nq; i++) await qs.nth(i).click();
  await p.getByRole('button', { name: /^1\. buluşma · / }).first().click();
  await p.getByRole('button', { name: 'Gün ve içeriği düzenle: 1. buluşma', exact: true }).click();
  const freeDate = await p.getByLabel('Tarih (YYYY-AA-GG)', { exact: true }).count();
  const freeTime = await p.getByLabel('Saat (SS:DD)', { exact: true }).count();
  await p.getByRole('button', { name: /^Buluşma günü: / }).first().click();
  await btn(p, 'Bir hafta sonra').first().click();
  await p.getByRole('button', { name: /^Başlama saati: / }).first().click();
  await btn(p, 'Saat artır').first().click();
  await btn(p, ':30').first().click();
  const want = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const dateLabel = await p.getByRole('button', { name: /^Buluşma günü: / }).first().getAttribute('aria-label');
  const timeLabel = await p.getByRole('button', { name: /^Başlama saati: / }).first().getAttribute('aria-label');
  const filled = await shot(p, 'repeat-datetime');
  await btn(p, 'Planı kontrol et').click(); await p.waitForTimeout(1200);
  const apply = p.getByRole('button', { name: /takvim/i }).filter({ hasText: /ekle|yerleştir|kaydet/i }).first();
  await apply.click();
  await p.getByText('Tekrar günleri takvimde').first().waitFor({ timeout: 30000 });
  const ev = psql(`select to_char(starts_at at time zone 'Europe/Istanbul','YYYY-MM-DD HH24:MI') from public.events where family_id='${f.familyId}' and title = 'Birlikte kısa tekrar' and created_at > now() - interval '3 minutes' order by starts_at limit 1;`);
  record('d4_3_repeat_day_uses_date_time_choice', freeDate === 0 && freeTime === 0 && ev === `${want} 18:30` && /18:30/.test(timeLabel || '') && clean(filled),
    { freeTextDateFields: freeDate, freeTextTimeFields: freeTime, dateLabel, timeLabel, expectedEvent: `${want} 18:30`, savedEvent: ev, sizes: filled });
};

async function timedExam(db, title) {
  const ex = (await db.from('exams').select('question_ids,subject,grade').eq('id', f.examId).single()).data;
  return (await db.from('exams').insert({ family_id: f.familyId, child_id: f.childId, title, subject: ex.subject, grade: ex.grade,
    question_ids: ex.question_ids, status: 'assigned', timed: true, duration_minutes: 10 }).select('id').single()).data.id;
}
async function startChildExam(p, db, examId) {
  const childName = (await db.from('children').select('name').eq('id', f.childId).single()).data.name;
  await signIn(p); await enterChildMode(p, childName);
  await p.goto(web + `/parent/child-mode/prova/${examId}`); await p.waitForTimeout(3000);
  const startBtn = p.getByRole('button', { name: /^(Başla|Başlayalım|Denemeye başla|Prova’ya başla|Hazırım)/ }).first();
  if (await startBtn.count()) { await startBtn.click(); await p.waitForTimeout(2500); }
  const radio = p.getByRole('radio').first();
  if (await radio.count()) { await radio.click(); await p.waitForTimeout(2500); }
}

// (3a) D4-2, istemci yolu: tarayıcı saati 10:05 ileri → otomatik bitirme → sonuçta "Süre doldu" notu.
flows.timeup_client = async (db, p) => {
  const examId = await timedExam(db, `D8 süreli A ${TAG}`);
  await p.clock.install();
  await startChildExam(p, db, examId);
  await p.clock.fastForward('10:05');
  await p.getByText('Deneme bitti!').first().waitFor({ timeout: 30000 });
  const ended = await shot(p, 'timeup-child-client');
  const t = await body(p);
  const a = (await db.from('exam_attempts').select('status').eq('exam_id', examId)).data?.[0];
  record('d4_2_child_result_shows_time_up_client', /Süre doldu/.test(t) && /kendiliğinden kapandı/.test(t) && a?.status !== 'in_progress' && clean(ended),
    { status: a?.status, note: (t.match(/Süre doldu[^\n]*\n?[^\n]*/) || [''])[0].replace(/\n/g, ' '), pageErrors: p.errors.slice(0, 3), sizes: ended });
};

// (3b) D4-2, sunucu yolu: deneme başladıktan sonra geçici DB'de süre 11 dk geriye çekilir; çocuk ekrana döner →
// otomatik bitirme; sonuç (yeniden yüklemede de) ve veli sonuç ekranı "Süre doldu" der. Süresiz deneme demez.
flows.timeup_server = async (db, p) => {
  const examId = await timedExam(db, `D8 süreli B ${TAG}`);
  await startChildExam(p, db, examId);
  const attemptId = psql(`update public.exam_attempts set started_at = started_at - interval '11 minutes', deadline_at = deadline_at - interval '11 minutes' where exam_id='${examId}' and status='in_progress' returning id;`).split('\n')[0];
  await p.reload(); await p.getByText('Deneme bitti!').first().waitFor({ timeout: 30000 });
  const first = /Süre doldu/.test(await body(p));
  await p.reload(); await p.getByText('Deneme bitti!').first().waitFor({ timeout: 30000 });
  const childReload = await shot(p, 'timeup-child-server');
  const tChild = await body(p);
  const row = psql(`select status || '|' || (finished_at >= deadline_at)::text from public.exam_attempts where id='${attemptId}';`);
  const parent = await context();
  try {
    await signIn(parent);
    await parent.goto(web + `/parent/prova/attempt/${attemptId}`); await parent.getByText(/Çoktan seçmeli|Puan|sonuç/i).first().waitFor({ timeout: 30000 });
    await parent.waitForTimeout(1500);
    const parentShot = await shot(parent, 'timeup-parent');
    const tParent = await body(parent);
    await parent.goto(web + `/parent/prova/attempt/${f.attemptId}`); await parent.waitForTimeout(4000);
    const untimedSays = /Süre doldu/.test(await body(parent));
    record('d4_2_time_up_server_child_and_parent', first && /Süre doldu/.test(tChild) && /Süre doldu/.test(tParent) && /Süre dolunca deneme kendiliğinden bitti/.test(tParent) && !untimedSays && clean(childReload) && clean(parentShot),
      { attemptRow: row, childFirst: first, childAfterReload: /Süre doldu/.test(tChild), parentNote: (tParent.match(/Süre doldu[^\n]*\n?[^\n]*/) || [''])[0].replace(/\n/g, ' '), untimedAttemptShowsTimeUp: untimedSays, pageErrors: [...p.errors, ...parent.errors].slice(0, 3), child: childReload, parent: parentShot });
  } finally { await parent.context().close(); }
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
      if (name !== 'modal_motion') { p = await context(); if (!name.startsWith('timeup')) await signIn(p); }
      await fn(db, p);
      if (p && p.errors.length) record(name + '_no_page_errors', false, p.errors.slice(0, 3));
    } catch (e) {
      record(name, false, { error: String(e.message).split('\n')[0] });
      await failDump(p, name);
    } finally { if (p) await p.context().close().catch(() => {}); }
  }
  const file = path.join(out, only.length ? `checks-${only.join('_')}.json` : 'checks.json');
  fs.writeFileSync(file, JSON.stringify({ environment: 'disposable-local-auth-rest-storage-realtime-edge', results }, null, 1));
  console.log(JSON.stringify(results.map(r => [r.check, r.passed])));
  await browser.close();
})().catch(async e => { console.error('FATAL', e.stack); if (browser) await browser.close(); process.exit(1); });
