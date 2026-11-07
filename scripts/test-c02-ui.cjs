const loopbackFixtureFetch = require('./loopback-fixture-fetch.cjs');
// C02 UI acceptance: subject identity across two devices (device-local U05 binding transferred only after
// the parent confirms; a second session binds another lesson), the same dated records on home / calendar
// (day + week strip) / task list for past–today–later, the later-dated routine picker, a planned education
// change (cancel) and the 14-day undo, and bulk re-spreading of hand-added homework.
// Only against the disposable fixture from
// `GINA_QA_UI_FIXTURE=… python3 scripts/test-isolated-services.py --run-local --ui-hold` and a web export built
// against it (GINA_QA_DIST). Never point this at demo/production.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const dist = path.resolve(process.env.GINA_QA_DIST);
const out = process.cwd() + '/docs/release/c02-2026-11-06/screenshots'; fs.mkdirSync(out, { recursive: true });
const results = []; let stage = 'setup', browser, server;
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail ? { detail } : {}) }); console.log('PASS ' + check); };
const istanbulDay = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * 86400000));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\.\.+/g, '');
      const tries = [path.join(dist, clean), path.join(dist, clean + '.html'), path.join(dist, clean, 'index.html')];
      let file = tries.find((p) => p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isFile());
      if (!file) file = path.join(dist, 'index.html');
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

(async () => {
try {
  const login = await loopbackFixtureFetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
  assert.ok(login.ok); const session = await login.json();
  async function api(p, body, prefer, method) {
    const res = await loopbackFixtureFetch(f.url + '/rest/v1/' + p, { method: method ?? (body ? 'POST' : 'GET'), headers: { apikey: f.anon, authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); assert.ok(res.ok, p + ' ' + text); return text ? JSON.parse(text) : null;
  }
  const rpc = (fn, args) => api('rpc/' + fn, args);
  await api(`families?id=eq.${f.familyId}`, { timezone: 'Europe/Istanbul' }, null, 'PATCH');
  const today = istanbulDay(0), yesterday = istanbulDay(-1), later = istanbulDay(3);
  const tag = randomUUID().slice(0, 4);
  const [ece] = await api('children', [{ family_id: f.familyId, name: `Ece ${tag}`, grade: 5 }], 'return=representation');
  // Timetable saved today (older days are "unknown"): MAT and TRK every day, old client shape.
  const lessons = [1, 2, 3, 4, 5, 6, 7].flatMap((d) => [
    { id: 'm' + d, day: d, title: 'MAT', start: '09:00', end: '09:40' },
    { id: 't' + d, day: d, title: 'TRK', start: '09:50', end: '10:30' },
  ]);
  await rpc('save_school_timetable_request', { p_request_id: randomUUID(), p_child_id: ece.id, p_revision: 0, p_lessons: lessons, p_settings: { start: '09:00', duration: 40, break: 10 } });
  // Routine: known for ten days, renamed today, and a later-dated change in three days.
  const R = randomUUID();
  const base = { icon: 'read-book', stars: 2, days_of_week: [1, 2, 3, 4, 5, 6, 7], time_of_day: 'evening', requires_approval: false };
  await api('task_templates', [{ id: R, family_id: f.familyId, child_id: ece.id, title: `Kitap oku ${tag}`, ...base, starts_on: istanbulDay(-10) }]);
  const rev = async () => (await api(`task_templates?id=eq.${R}&select=revision`))[0].revision;
  await rpc('change_task_routine', { p_request_id: randomUUID(), p_id: R, p_revision: await rev(), p_action: 'save', p_value: { title: `Kitap oku ${tag} (20 dk)`, ...base } });
  await rpc('change_task_routine', { p_request_id: randomUUID(), p_id: R, p_revision: await rev(), p_action: 'save', p_value: { title: `Kitap oku ${tag} (30 dk)`, ...base, stars: 3 }, p_effective_from: later });
  // Two hand-added homework items (not from a document), both planned today.
  const H = [randomUUID(), randomUUID(), randomUUID()];
  for (const [i, id] of H.entries()) {
    await rpc('save_learning_plan', { p_request_id: randomUUID(), p_child_id: ece.id, p_id: id, p_revision: 0, p_content: { kind: 'homework', title: `Ödev ${i + 1} ${tag}`, subject: 'Matematik', topic: '', planned_on: today, due_on: istanbulDay(6), time: null, steps: [], done: false, archived: false, source_id: null } });
  }
  const plan = (day) => rpc('plan_for_day', { p_child_id: ece.id, p_day: day });

  server = await serve(); const web = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const newContext = async (viewport) => {
    const c = await browser.newContext({ viewport, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
    await c.route(f.url + '/**', async (route) => { try { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); const res = await route.fetch({ maxRedirects: 0 }); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } }); } catch { await route.fulfill({ status: 503, body: 'Local fixture unavailable' }); } });
    const page = await c.newPage(); page.setDefaultTimeout(25000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    return { c, page, errors };
  };
  async function loginOn(page) {
    await page.goto(web);
    await page.getByLabel('E-posta', { exact: true }).fill(f.email);
    await page.getByLabel('Şifre', { exact: true }).fill(f.password);
    await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
    await page.waitForURL('**/parent');
  }
  async function shot(page, name) {
    await page.waitForFunction(() => !document.querySelector('[role=progressbar]')).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow: ' + name);
    const body = await page.locator('body').innerText();
    assert.ok(!/\bc02\.|dayPlan\.|planHistory\.|u05\./.test(body), 'translations resolved: ' + name);
  }

  // ---- Device A (phone): old U05 binding stored only on this device → explicit transfer.
  stage = 'device_a_import';
  const A = await newContext({ width: 390, height: 844 });
  await A.page.addInitScript(([key, value]) => { try { if (!localStorage.getItem(key + ':seeded')) { localStorage.setItem(key, value); localStorage.setItem(key + ':seeded', '1'); } } catch {} },
    ['gina:timetable:subjects:v1:' + [f.userId, f.familyId, ece.id].map(encodeURIComponent).join(':'), JSON.stringify({ mat: { subject_id: 'subject-math', label_tr: 'Matematik', label_en: 'Mathematics' } })]);
  await loginOn(A.page);
  await A.page.goto(`${web}/parent/calendar?childId=${ece.id}&date=${today}`);
  await A.page.getByRole('button', { name: 'Ders programı', exact: true }).first().click();
  await A.page.getByText('Bu cihazdaki ders eşleşmeleri', { exact: true }).waitFor();
  assert.deepEqual((await rpc('child_subject_links', { p_child_id: ece.id })).links, [], 'nothing on the server before the parent confirms');
  await A.page.getByText('MAT → Matematik', { exact: true }).waitFor();
  await shot(A.page, 'device-import-offer-phone');
  await A.page.getByRole('button', { name: '1 eşleşmeyi aileye aktar', exact: true }).click();
  await A.page.getByText('Bu cihazdaki ders eşleşmeleri', { exact: true }).waitFor({ state: 'detached' });
  const afterImport = (await rpc('child_subject_links', { p_child_id: ece.id })).links;
  assert.equal(afterImport.length, 1); assert.equal(afterImport[0].subject_id, 'subject-math'); assert.equal(afterImport[0].title, 'MAT'); assert.equal(afterImport[0].source, 'device_import');
  await A.page.getByRole('button', { name: 'Hafta tablosu', exact: true }).click();
  await A.page.getByText('Belgede: MAT', { exact: true }).first().waitFor();
  await shot(A.page, 'timetable-linked-week-phone');
  pass('device_local_binding_transferred_only_after_confirmation', { link: { title: afterImport[0].title, subject_id: afterImport[0].subject_id, source: afterImport[0].source } });

  // ---- Device B (tablet): fresh session sees the same identity, then binds TRK.
  stage = 'device_b';
  const B = await newContext({ width: 768, height: 1024 });
  await loginOn(B.page);
  await B.page.goto(`${web}/parent/calendar?childId=${ece.id}&date=${today}`);
  await B.page.getByText('Matematik', { exact: true }).first().waitFor();
  await B.page.getByText('Belgede: MAT', { exact: true }).first().waitFor();
  await B.page.getByRole('button', { name: 'Ders programı', exact: true }).first().click();
  await B.page.getByRole('button', { name: 'Hafta tablosu', exact: true }).click();
  await B.page.getByRole('button', { name: /^Pazartesi, \d+, TRK, / }).first().click();
  await B.page.getByText('Katalogdaki ders', { exact: true }).waitFor();
  const confirmTr = B.page.getByRole('button', { name: 'Türkçe olarak onayla', exact: true });
  await confirmTr.waitFor(); await confirmTr.scrollIntoViewIfNeeded();
  assert.equal((await rpc('child_subject_links', { p_child_id: ece.id })).links.length, 1, 'suggestion alone does not bind');
  await shot(B.page, 'subject-confirm-tablet');
  await confirmTr.click();
  await B.page.getByText('Katalog: Türkçe', { exact: true }).first().waitFor();
  const links2 = (await rpc('child_subject_links', { p_child_id: ece.id })).links;
  assert.deepEqual(links2.map((l) => [l.title, l.subject_id]).sort(), [['MAT', 'subject-math'], ['TRK', 'subject-turkish']]);
  await B.page.getByRole('button', { name: 'Vazgeç', exact: true }).first().click();
  pass('second_device_sees_same_identity_and_binds_with_confirmation');
  // Device A sees B's link after reload; the plan contract carries it too.
  await A.page.goto(`${web}/parent/calendar?childId=${ece.id}&date=${today}`);
  await A.page.getByText('Türkçe', { exact: true }).first().waitFor();
  await A.page.getByText('Belgede: TRK', { exact: true }).first().waitFor();
  const todayPlan = await plan(today);
  assert.deepEqual(todayPlan.timetable.day_lessons.map((l) => [l.title, l.subject_id]), [['MAT', 'subject-math'], ['TRK', 'subject-turkish']]);
  await shot(A.page, 'calendar-today-linked-phone');
  pass('device_a_sees_device_b_link_and_original_text', { day_lessons: todayPlan.timetable.day_lessons.map((l) => ({ title: l.title, subject_id: l.subject_id, label: l.subject_label_tr })) });

  // ---- Past / today / later: calendar day, week strip, task list and home show the same dated records.
  stage = 'dated';
  const P = { past: await plan(yesterday), today: todayPlan, later: await plan(later) };
  await A.page.goto(`${web}/parent/calendar?childId=${ece.id}&date=${yesterday}`);
  await A.page.getByText(`Kitap oku ${tag}`, { exact: true }).waitFor();
  await A.page.getByText(/Bu günün planı kayıtlarda yok/).first().waitFor();
  assert.equal(await A.page.getByText('Belgede: MAT', { exact: true }).count(), 0, 'past day is not filled with today\'s program');
  assert.equal(P.past.timetable.status, 'unknown_before');
  await shot(A.page, 'calendar-past-phone');
  if (yesterday >= (P.today.today.slice(0, 8) + '01') || true) {
    const strip = A.page.getByTestId(`c02-strip-count-${yesterday}`);
    if (await strip.count()) assert.equal((await strip.innerText()).replace(/\s/g, ''), `?·${P.past.routines.length}`, 'week strip: unknown past lessons');
  }
  await A.page.goto(`${web}/parent/calendar?childId=${ece.id}&date=${later}`);
  await A.page.getByText(`Kitap oku ${tag} (30 dk)`, { exact: true }).waitFor();
  assert.equal(await A.page.getByText(`Kitap oku ${tag} (20 dk)`, { exact: true }).count(), 0);
  assert.equal(P.later.routines.find((r) => r.id === R).title, `Kitap oku ${tag} (30 dk)`);
  const laterStrip = A.page.getByTestId(`c02-strip-count-${later}`);
  if (await laterStrip.count()) assert.equal((await laterStrip.innerText()).replace(/\s/g, ''), `${P.later.timetable.day_lessons.length}·${P.later.routines.length}`);
  await A.page.goto(`${web}/parent/calendar?childId=${ece.id}&date=${today}`);
  await A.page.getByText(`Kitap oku ${tag} (20 dk)`, { exact: true }).waitFor();
  assert.equal(await A.page.getByText(`Kitap oku ${tag} (30 dk)`, { exact: true }).count(), 0, 'a later-dated change does not show today');
  const todayStrip = A.page.getByTestId(`c02-strip-count-${today}`);
  assert.equal((await todayStrip.innerText()).replace(/\s/g, ''), `${P.today.timetable.day_lessons.length}·${P.today.routines.length}`, 'week strip today = plan_for_day');
  pass('calendar_past_today_later_follow_plan_for_day', { past: P.past.timetable.status, today_lessons: P.today.timetable.day_lessons.length, later_routine: P.later.routines.find((r) => r.id === R).title });

  stage = 'tasks';
  await A.page.goto(`${web}/parent/tasks?childId=${ece.id}`);
  await A.page.getByText(`Kitap oku ${tag} (20 dk)`, { exact: true }).waitFor();
  await A.page.getByTestId(`c02-next-${R}`).waitFor();
  assert.match(await A.page.getByTestId(`c02-next-${R}`).innerText(), new RegExp(`tarihinden itibaren: Kitap oku ${tag} \\(30 dk\\)`));
  await shot(A.page, 'tasks-today-and-pending-phone');
  pass('task_list_shows_today_version_and_pending_change');
  stage = 'routine_picker';
  await A.page.getByRole('button', { name: `Kitap oku ${tag} (30 dk): ayrıntı ve düzenleme`, exact: true }).click().catch(async () => {
    await A.page.getByRole('button', { name: new RegExp(`Kitap oku ${tag}.*ayrıntı ve düzenleme`) }).first().click();
  });
  await A.page.getByText('Geçerlilik tarihi', { exact: false }).first().waitFor();
  await shot(A.page, 'routine-future-picker-phone');
  pass('routine_editor_offers_later_effective_day');

  stage = 'home';
  const H1 = await newContext({ width: 1280, height: 800 });
  await loginOn(H1.page);
  await H1.page.getByTestId('home-tasks').waitFor();
  await H1.page.getByText(`Kitap oku ${tag} (20 dk)`, { exact: true }).first().waitFor();
  assert.equal(await H1.page.getByText(`Kitap oku ${tag} (30 dk)`, { exact: true }).count(), 0, 'home today does not show the later-dated change');
  await H1.page.getByTestId('home-plan').getByText('Matematik', { exact: true }).first().waitFor();
  await shot(H1.page, 'home-today-desktop');
  pass('home_today_tasks_and_lessons_from_dated_plan');
  await H1.page.goto(`${web}/parent/calendar?childId=${ece.id}&date=${today}`);
  await H1.page.getByText('Matematik', { exact: true }).first().waitFor();
  await shot(H1.page, 'calendar-week-desktop');

  // ---- Planned education change (cancel) and the 14-day undo.
  stage = 'education';
  const tt = async () => (await api(`school_timetables?child_id=eq.${ece.id}&select=revision,lessons`))[0];
  const startOld = istanbulDay(-60), ayOld = Number(startOld.slice(0, 4)) - 1;
  await rpc('change_child_education', { p_request_id: randomUUID(), p_child_id: ece.id, p_revision: 0, p_action: 'initial', p_academic_year: ayOld, p_grade: 5, p_school: 'Deneme Okulu', p_starts_on: startOld, p_timetable_revision: (await tt()).revision, p_keep_timetable: true });
  const state = () => rpc('education_change_state', { p_child_id: ece.id });
  await rpc('schedule_child_education_change', { p_request_id: randomUUID(), p_child_id: ece.id, p_revision: (await state()).revision, p_action: 'new_year', p_academic_year: Number(later.slice(0, 4)), p_grade: 6, p_school: 'Deneme Okulu', p_starts_on: later, p_keep_timetable: false });
  assert.equal((await plan(later)).timetable.day_lessons.length, 0, 'planned day starts with an empty program');
  assert.equal((await plan(today)).timetable.day_lessons.length, 2, 'today keeps the program');
  await A.page.goto(`${web}/parent/calendar?childId=${ece.id}&date=${later}`);
  await A.page.getByText(`Kitap oku ${tag} (30 dk)`, { exact: true }).waitFor();
  assert.equal(await A.page.getByText('Belgede: MAT', { exact: true }).count(), 0, 'calendar shows the planned empty program on that day');
  await A.page.goto(`${web}/parent/education?childId=${ece.id}`);
  await A.page.getByTestId('c02-scheduled').waitFor();
  await shot(A.page, 'education-scheduled-phone');
  await A.page.getByRole('button', { name: 'Planı iptal et', exact: true }).click();
  await A.page.getByText('Planlı geçiş iptal edildi. Hiçbir kayıt değişmedi.', { exact: true }).waitFor();
  assert.equal((await state()).scheduled, null);
  assert.equal((await plan(later)).timetable.day_lessons.length, 2, 'after cancel the later day has the program again');
  pass('planned_education_change_visible_and_cancelled');
  await rpc('change_child_education', { p_request_id: randomUUID(), p_child_id: ece.id, p_revision: (await state()).revision, p_action: 'new_year', p_academic_year: Number(today.slice(0, 4)), p_grade: 6, p_school: 'Deneme Okulu', p_starts_on: today, p_timetable_revision: (await tt()).revision, p_keep_timetable: false });
  assert.equal((await tt()).lessons.length, 0);
  await A.page.goto(`${web}/parent/education?childId=${ece.id}`);
  await A.page.getByTestId('c02-undo').waitFor();
  await shot(A.page, 'education-undo-offer-phone');
  await A.page.getByRole('button', { name: 'Geçişi geri al', exact: true }).click();
  await A.page.getByRole('button', { name: 'Evet, geri al', exact: true }).click();
  await A.page.getByText('Geçiş geri alındı; önceki ders programı da geri geldi.', { exact: true }).waitFor();
  const restored = await tt();
  assert.equal(restored.lessons.length, 14, 'program restored');
  assert.ok(restored.lessons.every((l) => l.subject_id === (l.title === 'MAT' ? 'subject-math' : 'subject-turkish')), 'restored lessons keep subject ids');
  assert.equal((await api(`children?id=eq.${ece.id}&select=grade`))[0].grade, 5, 'grade restored');
  assert.equal((await state()).undo, null, 'nothing left to undo');
  await shot(A.page, 'education-undone-phone');
  pass('education_change_undone_within_14_days', { lessons_restored: restored.lessons.length });

  // ---- Bulk re-spread of hand-added homework.
  stage = 'respread';
  await A.page.goto(`${web}/parent/calendar?childId=${ece.id}&date=${today}`);
  await A.page.getByTestId('c02-respread').waitFor();
  await A.page.getByRole('button', { name: 'Günlere dağıt', exact: true }).click();
  for (const d of [6, 7]) { const b = A.page.getByRole('button', { name: ['Cumartesi', 'Pazar'][d - 6], exact: true }); if (await b.count()) await b.first().click(); }
  await shot(A.page, 'respread-preview-phone');
  await A.page.getByRole('button', { name: 'Tarihleri uygula', exact: true }).click();
  await A.page.getByText(/kaydın günü değişti ve kaydedildi/).waitFor();
  const items = await api(`rpc/get_learning_plan`, { p_child_id: ece.id, p_from: istanbulDay(-7), p_to: istanbulDay(14) });
  const mine = items.items.filter((r) => H.includes(r.id));
  const days = mine.map((r) => r.content.planned_on);
  assert.equal(new Set(days).size, 3, 'three hand-added items spread over three days: ' + days.join(','));
  assert.ok(mine.every((r) => r.content.planned_on >= today && r.content.planned_on <= r.content.due_on), 'no item before today or past its due day');
  await shot(A.page, 'respread-saved-phone');
  pass('hand_added_homework_respread_and_saved', { planned_on: days.sort() });
  await A.page.getByRole('button', { name: 'Dağıtımı geri al', exact: true }).click();
  let back = [];
  for (let i = 0; i < 40; i++) {
    back = (await api(`rpc/get_learning_plan`, { p_child_id: ece.id, p_from: istanbulDay(-7), p_to: istanbulDay(14) })).items.filter((r) => H.includes(r.id)).map((r) => r.content.planned_on);
    if (back.every((d) => d === today)) break;
    await A.page.waitForTimeout(500);
  }
  assert.deepEqual(back, [today, today, today], 'undo puts every item back on its earlier day (including ones moved to next week)');
  pass('respread_undo_restores_days');

  for (const ctx of [A, B, H1]) assert.deepEqual(ctx.errors, [], 'no page errors');
  pass('layouts_390_768_1280_no_overflow_no_raw_keys');
  fs.writeFileSync(process.cwd() + '/docs/release/c02-2026-11-06/ui-checks.json', JSON.stringify({ environment: 'disposable-local-auth-postgrest + expo web export (Chrome, tr-TR, Europe/Istanbul)', today, checks: results }, null, 2));
} catch (error) {
  console.error('FAIL at ' + stage + ': ' + (error && error.message ? error.message.split('\n').slice(0, 6).join('\n') : error));
  results.push({ check: stage, passed: false });
  fs.mkdirSync(process.cwd() + '/docs/release/c02-2026-11-06', { recursive: true });
  fs.writeFileSync(process.cwd() + '/docs/release/c02-2026-11-06/ui-checks-failed.json', JSON.stringify({ checks: results }, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) server.close();
}
})();
