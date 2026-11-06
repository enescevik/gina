// C11 UI acceptance (backoffice + mobile web), only against the disposable fixture from
// `GINA_QA_UI_FIXTURE=… python3 scripts/test-isolated-services.py --run-local --ui-hold`, a backoffice export
// (GINA_QA_BACKOFFICE_DIST) and a mobile web export (GINA_QA_DIST) built against that fixture. Never demo/production.
// Checks: synonym add/deactivate/reactivate with history (suggest_subject follows), calendar publish review
// (blocked hidden region, medium needs review, checklist publish), holiday drafts → separate publish, mobile holiday
// suggestion accept/undo (plan marks lessons paused, timetable untouched), overflow + translations.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const mobileDist = path.resolve(process.env.GINA_QA_DIST), officeDist = path.resolve(process.env.GINA_QA_BACKOFFICE_DIST);
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/learning/catalog/education-calendars/tr-2026-2027.json')));
const out = process.cwd() + '/docs/release/c11-2026-11-06/ui'; fs.mkdirSync(out, { recursive: true });
const results = []; let stage = 'setup', browser; const servers = [];
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail ? { detail } : {}) }); console.log('PASS ' + check); };
const istanbulDay = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * 86400000));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };
function serve(dist) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\.\.+/g, '');
      const tries = [path.join(dist, clean), path.join(dist, clean + '.html'), path.join(dist, clean, 'index.html')];
      let file = tries.find((p) => p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isFile());
      if (!file) file = path.join(dist, 'index.html');
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
    });
    servers.push(s); s.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${s.address().port}`));
  });
}

(async () => {
try {
  const login = await fetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
  assert.ok(login.ok); const session = await login.json();
  async function api(p, body) {
    const res = await fetch(f.url + '/rest/v1/' + p, { method: body ? 'POST' : 'GET', headers: { apikey: f.anon, authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); assert.ok(res.ok, p + ' ' + text); return text ? JSON.parse(text) : null;
  }
  const rpc = (fn, args) => api('rpc/' + fn, args ?? {});
  const office = await serve(officeDist), web = await serve(mobileDist);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const newContext = async (viewport) => {
    const c = await browser.newContext({ viewport, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
    await c.route(f.url + '/**', async (route) => {
      try {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        const res = await route.fetch(); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
      } catch { await route.fulfill({ status: 503, body: 'Local service unavailable' }); }
    });
    const page = await c.newPage(); page.setDefaultTimeout(25000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    return { c, page, errors };
  };
  async function shot(page, name, pattern = /\bc11\.|schoolCalendar\.|c02\./) {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow: ' + name);
    assert.ok(!pattern.test(await page.locator('body').innerText()), 'translations resolved: ' + name);
  }

  // ------------------------------------------------------------- Backoffice
  stage = 'office_login';
  const O = await newContext({ width: 1280, height: 800 });
  await O.page.goto(office + '/sign-in');
  await O.page.getByLabel('E-posta', { exact: true }).fill(f.email);
  await O.page.getByLabel('Şifre', { exact: true }).fill(f.password);
  await O.page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await O.page.waitForURL('**/dashboard');

  stage = 'synonym_add';
  await O.page.goto(office + '/input-catalog');
  await O.page.getByRole('combobox', { name: 'Tür' }).selectOption('subject');
  await O.page.getByRole('heading', { name: 'Matematik', exact: true }).waitFor();
  const mathCard = O.page.locator('div.rounded-2xl', { has: O.page.getByRole('heading', { name: 'Matematik', exact: true }) }).first();
  await mathCard.getByRole('button', { name: 'Eşanlamlıları yönet' }).click();
  const editor = O.page.getByRole('region', { name: 'Matematik eşanlamlıları' });
  await editor.getByLabel('Yeni eşanlamlı').fill('Mat Uyg C11');
  await editor.getByLabel('En küçük sınıf').selectOption('5');
  await editor.getByLabel('En büyük sınıf').selectOption('8');
  const addButton = editor.getByRole('button', { name: 'Eşanlamlı ekle' });
  assert.equal(await addButton.isDisabled(), true, 'add disabled without note');
  await editor.getByLabel(/Gerekçe \(kaynak/).fill('Okul ders programı belgesinde böyle yazıyor');
  await addButton.click();
  await editor.getByText('Eşanlamlı eklendi.').waitFor();
  await editor.getByText('Mat Uyg C11', { exact: true }).waitFor();
  await editor.getByText(/Eklendi · matuygc11/).waitFor();
  let s = await rpc('suggest_subject', { p_text: 'mat uyg c11', p_grade: 6 });
  assert.deepEqual(s.candidates.map((c) => c.subject_id), ['subject-math']); assert.equal(s.requires_confirmation, true);
  await shot(O.page, 'office-synonym-added-1280x800');
  pass('synonym added from the editor with note; suggestion follows and still needs parent confirmation');

  stage = 'synonym_deactivate';
  await editor.getByRole('button', { name: 'MAT öneriden kaldır', exact: true }).first().click();
  const confirm = editor.getByRole('button', { name: 'Onayla' });
  assert.equal(await confirm.isDisabled(), true, 'confirm disabled without note');
  await editor.getByLabel('Gerekçe (en az 10 karakter)').fill('Bu okulda MAT farklı bir dersi gösteriyor');
  await confirm.click();
  await editor.getByText('Eşanlamlı öneriden kaldırıldı.').waitFor();
  s = await rpc('suggest_subject', { p_text: 'MAT', p_grade: 3 });
  assert.ok(!s.candidates.some((c) => c.subject_id === 'subject-math'), 'inactive MAT no longer suggests math');
  await shot(O.page, 'office-synonym-deactivated-1280x800');
  await editor.getByRole('button', { name: 'MAT yeniden aç', exact: true }).first().click();
  await editor.getByLabel('Gerekçe (en az 10 karakter)').fill('Okul teyidi sonrası geri açıldı');
  await editor.getByRole('button', { name: 'Onayla' }).click();
  await editor.getByText('Eşanlamlı yeniden açıldı.').waitFor();
  s = await rpc('suggest_subject', { p_text: 'MAT', p_grade: 3 });
  assert.ok(s.candidates.some((c) => c.subject_id === 'subject-math'));
  const history = await rpc('admin_subject_synonym_changes', { p_subject_id: 'subject-math' });
  assert.deepEqual(history.slice(0, 3).map((h) => h.action), ['reactivate', 'deactivate', 'add']);
  pass('catalog synonym deactivated and reactivated with notes; history shows all three changes');

  stage = 'calendar_import';
  const imported = await rpc('admin_import_education_calendar_seed', { p_request: randomUUID(), p_seed: seed, p_execute: true });
  assert.equal(imported.published, false);
  const cal = await rpc('admin_education_calendars');
  const placeName = (id) => cal.places.find((p) => p.id === id)?.name;
  const country = cal.calendars.filter((c) => placeName(c.place_id) === 'Türkiye');
  const sivas = cal.calendars.find((c) => placeName(c.place_id) === 'Sivas' && c.stage === 'primary');
  assert.equal(country.length, 4); assert.ok(sivas);
  await O.page.goto(office + '/education-calendars');
  await O.page.getByText('Kaynaklı tohum · güven orta', { exact: false }).first().waitFor();
  await shot(O.page, 'office-calendar-checks-1280x800');
  pass('calendar list shows seed provenance/confidence and publish checks');

  stage = 'calendar_blocked';
  const sivasCard = O.page.locator('article', { hasText: 'Sivas 2026-2027' }).filter({ hasText: 'İlkokul' }).first();
  await sivasCard.getByText(/Kapsam \(il\/okul\) gizli/).waitFor();
  await sivasCard.getByRole('button', { name: 'İncele ve düzenle' }).click();
  await O.page.getByRole('button', { name: 'Yayın önizlemesi' }).click();
  const review = O.page.getByLabel('Yayın incelemesi');
  await review.getByText(/Kapsam \(il\/okul\) gizli/).waitFor();
  await review.getByText(/Orta güvenli tohum/).waitFor();
  assert.equal(await review.getByRole('button', { name: 'İnceledim, takvimi yayımla' }).isDisabled(), true, 'blocked draft cannot be published');
  await shot(O.page, 'office-calendar-blocked-1280x800');
  await O.page.getByRole('button', { name: 'Kapat' }).click();
  pass('hidden-region medium draft shows blocks and the publish button stays disabled');

  stage = 'calendar_publish';
  const child = (await api(`children?select=id,name,grade&id=eq.${f.childId}`))[0];
  const stage4 = child.grade === 0 ? 'preschool' : child.grade <= 4 ? 'primary' : child.grade <= 8 ? 'middle' : 'high';
  const stageTr = { preschool: 'Okul öncesi', primary: 'İlkokul', middle: 'Ortaokul', high: 'Lise' }[stage4];
  const countryCard = O.page.locator('article', { hasText: 'Türkiye 2026-2027' }).filter({ hasText: stageTr }).first();
  await countryCard.getByRole('button', { name: 'İncele ve düzenle' }).click();
  await O.page.getByRole('button', { name: 'Yayın önizlemesi' }).click();
  const r2 = O.page.getByLabel('Yayın incelemesi');
  const publishBtn = r2.getByRole('button', { name: 'İnceledim, takvimi yayımla' });
  await r2.getByLabel('Kaynağı açtım; resmî yayın sayfası/belgesi').check();
  await r2.getByLabel(/dönem tarihlerini kaynakla/).check();
  assert.equal(await publishBtn.isDisabled(), true, 'incomplete checklist keeps publish disabled');
  await r2.getByLabel(/Kapsam \(ülke\/il\/okul\)/).check();
  await r2.getByLabel('İnceleme notu (en az 10 karakter)').fill('MEB haberi ve genelge açıldı; dönemler aynı.');
  await shot(O.page, 'office-calendar-review-1280x800');
  await publishBtn.click();
  await O.page.getByText('Takvim inceleme kaydıyla yayımlandı.').waitFor();
  const after = await rpc('admin_education_calendar_checks');
  const published = (await rpc('admin_education_calendars')).calendars.filter((c) => c.published);
  assert.equal(published.length, 1); assert.equal(published[0].stage, stage4);
  assert.ok(after.find((c) => c.calendar_id === published[0].id).last_review);
  pass('country calendar published only after the full checklist; review recorded', { stage: stage4 });

  stage = 'holidays';
  await O.page.getByRole('button', { name: 'Tatil günleri' }).click();
  await O.page.getByRole('button', { name: 'Tohumdaki resmî tatilleri önizle' }).click();
  await O.page.getByText('Önizleme hazır; henüz hiçbir şey yazılmadı.').waitFor();
  assert.equal((await rpc('admin_education_holidays', { p_academic_year: null })).length, 0, 'preview wrote nothing');
  const create = O.page.getByRole('button', { name: 'Taslakları oluştur' });
  assert.equal(await create.isDisabled(), true);
  await O.page.getByLabel(/Yalnız taslak oluşturulacağını/).check();
  await create.click();
  await O.page.getByText('Tatil taslakları oluşturuldu. Hiçbiri yayımlanmadı.').waitFor();
  const holidays = await rpc('admin_education_holidays', { p_academic_year: null });
  assert.ok(holidays.length >= 1 && holidays.every((h) => h.status === 'draft'));
  await O.page.getByRole('button', { name: 'Kaynağı doğruladım, yayımla' }).first().click();
  await O.page.getByText(/Tatil yayımlandı/).waitFor();
  assert.equal((await rpc('admin_education_holidays', { p_academic_year: null })).filter((h) => h.status === 'published').length, 1);
  await shot(O.page, 'office-holidays-1280x800');
  pass('holiday drafts imported after preview + confirmation; one published separately', { drafts: holidays.length });

  // ------------------------------------------------------------- Mobile
  stage = 'mobile_setup';
  const ed = await rpc('get_child_education', { p_child_id: f.childId });
  const today = istanbulDay(0);
  const action = ed.current ? 'correct' : 'initial';
  const year = ed.current ? ed.current.academic_year : 2026;
  const startsOn = ed.current ? ed.current.starts_on : today;
  const preview = await rpc('preview_education_calendar', { p_child_id: f.childId, p_place_id: 'ec000000-0000-4000-8000-000000000001', p_stage: stage4, p_academic_year: year, p_action: action, p_starts_on: startsOn });
  await rpc('change_child_education_with_calendar', { p_request_id: randomUUID(), p_child_id: f.childId, p_revision: ed.revision, p_action: action, p_academic_year: year,
    p_grade: ed.current ? ed.current.grade : child.grade, p_school: ed.current ? ed.current.school : null, p_starts_on: startsOn, p_timetable_revision: ed.timetable.revision, p_keep_timetable: true,
    p_place_id: 'ec000000-0000-4000-8000-000000000001', p_stage: stage4, p_calendar_id: preview.calendar?.id ?? null, p_calendar_revision: preview.calendar?.revision ?? null,
    p_reason: preview.warning ? 'personal' : null, p_detail: null });
  const sug = await rpc('education_holiday_suggestions', { p_child_id: f.childId });
  const brk = sug.items.find((i) => i.kind === 'break');
  assert.ok(brk, 'break suggestion from published calendar (16–20 Nov 2026 is within 21 days)');
  const ttBefore = (await api(`school_timetables?select=revision,lessons&child_id=eq.${f.childId}`))[0] ?? null;
  pass('child placed on the published country calendar; break suggestion exists', { window: `${brk.starts_on}..${brk.ends_on}`, lesson_days: brk.lesson_days });

  stage = 'mobile_accept';
  const M = await newContext({ width: 390, height: 844 });
  await M.page.goto(web);
  await M.page.getByLabel('E-posta', { exact: true }).fill(f.email);
  await M.page.getByLabel('Şifre', { exact: true }).fill(f.password);
  await M.page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await M.page.waitForURL('**/parent');
  await M.page.goto(`${web}/parent/education?childId=${f.childId}`);
  const card = M.page.getByTestId('c11-holiday-break');
  await card.waitFor();
  await card.getByText(/Ara tatil · 16 Kasım – 20 Kasım/).waitFor();
  await card.getByText(/Ders programı, görevler, yıldızlar ve sınıf değişmez/).waitFor();
  await card.scrollIntoViewIfNeeded();
  await shot(M.page, 'mobile-holiday-suggestion-390x844');
  await card.getByRole('button', { name: 'Tatil olarak işaretle' }).click();
  await M.page.getByText('Tatil olarak işaretlendi.').waitFor();
  const plan = await rpc('plan_for_day', { p_child_id: f.childId, p_day: brk.starts_on });
  assert.equal(plan.holiday.decision, 'accepted');
  assert.ok(plan.timetable.day_lessons.every((l) => l.paused === true));
  const ttAfter = (await api(`school_timetables?select=revision,lessons&child_id=eq.${f.childId}`))[0] ?? null;
  assert.deepEqual(ttAfter, ttBefore, 'timetable row unchanged by acceptance');
  await card.getByText(/dersler tatil olarak işaretli\. Program silinmedi\./).waitFor();
  await shot(M.page, 'mobile-holiday-accepted-390x844');
  pass('parent accepts the break: plan marks lessons paused, timetable row unchanged');

  stage = 'mobile_tablet_undo';
  const T = await newContext({ width: 768, height: 1024 });
  await T.page.goto(web);
  await T.page.getByLabel('E-posta', { exact: true }).fill(f.email);
  await T.page.getByLabel('Şifre', { exact: true }).fill(f.password);
  await T.page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await T.page.waitForURL('**/parent');
  await T.page.goto(`${web}/parent/education?childId=${f.childId}`);
  const tcard = T.page.getByTestId('c11-holiday-break');
  await tcard.getByRole('button', { name: 'Kararı geri al' }).click();
  await T.page.getByText('Karar geri alındı.').waitFor();
  assert.equal((await rpc('plan_for_day', { p_child_id: f.childId, p_day: brk.starts_on })).holiday.decision, null);
  await shot(T.page, 'tablet-holiday-undone-768x1024');
  // Phone view still shows "accepted" until refetch; a stale decision is rejected and the card refreshes.
  await M.page.getByRole('button', { name: 'Kararı geri al' }).click();
  await M.page.getByText('Bu öneri başka bir cihazda değişti. Güncel hâli gösteriliyor.').waitFor();
  await M.page.getByTestId('c11-holiday-break').getByRole('button', { name: 'Tatil olarak işaretle' }).waitFor();
  pass('second device undoes; stale first device gets a conflict message and refreshes (no double change)');

  for (const ctx of [O, M, T]) assert.deepEqual(ctx.errors, [], 'no page errors');
  pass('no page errors on backoffice / phone / tablet');
} catch (e) {
  results.push({ check: stage, passed: false, error: String(e && e.message || e).slice(0, 500) });
  console.error('FAIL ' + stage + ': ' + (e && e.message));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const s of servers) s.close();
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ when: new Date().toISOString(), environment: 'disposable-local-auth-postgrest + static exports', results }, null, 2));
}
})();
