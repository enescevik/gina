// C12 — kabul edilmiş okul tatili gösterimi (takvim, veli ana ekranı, çocuk Bugün).
// Gerçek izole Auth/REST + Playwright; YALNIZ `plan_for_day(s)` yanıtı tarayıcıda değiştirilir (bugüne kabul edilmiş
// tatil + duraklatılmış ders eklenir). Bu, C11 sunucu sözleşmesinin (holiday + paused) taklididir; tatil verisini
// sunucuda üretmez ve C11 pgTAP'inin yerine geçmez. Ortam: test-c12-tour.cjs ile aynı (GINA_QA_*, GINA_C12_OUT).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
const web = process.env.GINA_QA_WEB, backend = process.env.GINA_QA_WEB_BACKEND, ph = process.env.GINA_QA_WEB_ANON;
const out = path.resolve(process.env.GINA_C12_OUT); fs.mkdirSync(out, { recursive: true });
const sizes = { phone: { width: 390, height: 844 }, tabletLand: { width: 1280, height: 800 } };
const results = [];
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

function withHoliday(plan) {
  if (!plan || plan.day !== today || plan.child_id !== f.childId) return plan;
  const lesson = { id: 'c12-holiday-lesson', day: plan.weekday, title: 'C12 duraklatılan ders', start: '09:00', end: '09:40', paused: true };
  return { ...plan, holiday: { key: 'c12-mock', kind: 'break', title: 'Ara tatil', starts_on: today, ends_on: today, decision: 'accepted' },
    timetable: { ...plan.timetable, day_lessons: [...plan.timetable.day_lessons.map(l => ({ ...l, paused: true })), lesson] } };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const c = await browser.newContext({ viewport: sizes.phone, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  await c.route(backend + '/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const headers = { ...req.headers() };
    if (headers.apikey === ph) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + ph) headers.authorization = 'Bearer ' + f.anon;
    const res = await route.fetch({ url: f.url + req.url().slice(backend.length), headers });
    if (/rpc\/plan_for_days?$/.test(new URL(req.url()).pathname) && res.ok()) {
      const body = await res.json();
      const patched = Array.isArray(body) ? body.map(withHoliday) : withHoliday(body);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(patched), headers: { 'access-control-allow-origin': '*' } });
    }
    await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
  });
  const p = await c.newPage(); p.setDefaultTimeout(25000);
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(web + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.email); await p.getByLabel('Şifre', { exact: true }).fill(f.password);
  await p.getByLabel('Şifre', { exact: true }).press('Enter'); await p.waitForURL('**/parent');
  const check = async (route, name, expect, absent) => {
    await p.goto(web + route); await p.waitForTimeout(3000);
    const text = await p.locator('body').innerText();
    results.push({ check: name, passed: expect.test(text) && !(absent && absent.test(text)), detail: text.match(expect)?.[0] ?? text.slice(0, 200) });
    for (const [size, vp] of Object.entries(sizes)) { await p.setViewportSize(vp); await p.waitForTimeout(700); await p.screenshot({ path: path.join(out, `holiday-${name}-${size}.png`) }); }
    await p.setViewportSize(sizes.phone);
  };
  await check('/parent', 'parent_home', /okul tatili — ders programı duraklatıldı/, /C12 duraklatılan ders/);
  await check(`/parent/calendar?childId=${f.childId}`, 'calendar_day', /Okul tatili — program duraklatıldı/, /C12 duraklatılan ders/);
  await p.goto(web + '/parent/child-mode'); await p.waitForTimeout(1500);
  const pick = p.getByRole('button', { name: /^Synthetic child/ }).first(); if (await pick.count()) await pick.click();
  const pin = p.getByLabel('Çocuk PIN’i', { exact: true }); if (await pin.count()) await pin.fill('1234'); else await p.keyboard.type('1234');
  const enter = p.getByRole('button', { name: 'Dünyama gir', exact: true }); if (await enter.count()) await enter.click();
  await p.waitForURL('**/parent/child-mode/today');
  await check('/parent/child-mode/today', 'child_today', /Bugün okul tatili/);
  results.push({ check: 'no_page_errors', passed: errors.length === 0, detail: errors.slice(0, 3) });
  fs.writeFileSync(path.join(out, 'holiday-checks.json'), JSON.stringify(results, null, 1));
  console.log(JSON.stringify(results.map(r => [r.check, r.passed])));
  await browser.close();
})().catch(e => { console.error('FATAL', e.stack); process.exit(1); });
