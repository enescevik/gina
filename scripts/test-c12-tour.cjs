// C12 — bütün mobil/web rotalarının deneyim turu (Playwright, gerçek izole Auth/REST/Storage/Realtime).
// Yalnız `test-isolated-services.py --run-local --ui-hold` geçici sentetik fixture'ı kabul edilir (loopback, @example.invalid).
// Ortam: GINA_QA_UI_FIXTURE, GINA_QA_WEB (statik export), GINA_QA_WEB_BACKEND (export'a gömülü yer tutucu),
// GINA_QA_WEB_ANON (yer tutucu anon), GINA_QA_PLAYWRIGHT_PATH, GINA_C12_OUT (çıktı klasörü), GINA_C12_LABEL (before/after),
// GINA_C12_SHOTS=all|phone (görüntü yoğunluğu). Ölçüm sezgiseldir: taşma, çözülmemiş anahtar, isimsiz eylem,
// 44 px altı hedef, kesilen düğme metni, aynı adla tekrarlanan eylem, pageerror. Web taklidi cihaz kabulü değildir.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const { createClient } = require(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'));
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const label = process.env.GINA_C12_LABEL || 'run';
const out = path.resolve(process.env.GINA_C12_OUT || path.join(__dirname, '../docs/release/c12-2026-11-06/ui', label));
fs.mkdirSync(out, { recursive: true });
const allShots = (process.env.GINA_C12_SHOTS || 'all') === 'all';
const sizes = {
  phone: { width: 390, height: 844 }, narrow: { width: 360, height: 640 },
  tablet: { width: 768, height: 1024 }, tabletLand: { width: 1280, height: 800 }, phoneLand: { width: 844, height: 390 },
};
const results = [], metrics = [];
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail === undefined ? {} : { detail }) }); console.error('ok ' + check); };
const fail = (check, detail) => { results.push({ check, passed: false, detail }); console.error('FAIL ' + check + ' ' + JSON.stringify(detail)); };
let browser;

// Parent routes reachable with the fixture session. `id` placeholders are replaced from the fixture.
const parentRoutes = [
  ['/parent', 'parent-home'], ['/parent/menu', 'parent-menu'], ['/parent/calendar', 'parent-calendar'],
  ['/parent/tasks', 'parent-tasks'], ['/parent/rewards', 'parent-rewards'], ['/parent/grades', 'parent-grades'],
  ['/parent/notes', 'parent-notes'], ['/parent/notifications', 'parent-notifications'], ['/parent/inbox', 'parent-inbox'],
  ['/parent/subscription', 'parent-subscription'], ['/parent/help', 'parent-help'], ['/parent/share', 'parent-share'],
  ['/parent/weekly-review', 'parent-weekly-review'], ['/parent/education', 'parent-education'],
  ['/parent/profile-archive', 'parent-profile-archive'], ['/parent/families', 'parent-families'],
  ['/parent/device-access', 'parent-device-access'], ['/parent/pair-device', 'parent-pair-device'],
  ['/parent/room-credits', 'parent-room-credits'],
  ['/parent/prova', 'prova-hub'], ['/parent/prova?tab=sent', 'prova-hub-sent'], ['/parent/prova?tab=review', 'prova-hub-review'],
  ['/parent/prova/builder', 'prova-builder'], ['/parent/prova/question', 'prova-question'],
  ['/parent/prova/shared-source', 'prova-shared-source'], ['/parent/prova/library', 'prova-library'],
  ['/parent/prova/catalog', 'prova-catalog'], ['/parent/prova/blueprint', 'prova-blueprint'],
  ['/parent/prova/level', 'prova-level'], ['/parent/prova/booklet', 'prova-booklet'],
  ['/parent/prova/groups', 'prova-groups'], ['/parent/prova/share', 'prova-share'],
  ['/parent/prova/progress', 'prova-progress'], ['/parent/prova/attempt/:attemptId', 'prova-attempt'],
  ['/parent/prova/review/:attemptId', 'prova-review'], ['/parent/prova/repeat/:attemptId', 'prova-repeat'],
  ['/parent/prova/attempt/:c08AttemptId', 'prova-attempt-ai'],
  ['/verify-contact', 'verify-contact'], ['/unsubscribe', 'unsubscribe'],
];
const publicRoutes = [
  ['/sign-in', 'auth-sign-in'], ['/sign-in?mode=up', 'auth-sign-up'], ['/reset-password', 'auth-reset-password'],
  ['/auth-callback?error=access_denied', 'auth-callback-cancel'], ['/device/pair', 'device-pair'],
  ['/s/c12-invalid-token', 'share-invalid'], ['/unsubscribe?token=c12-invalid', 'unsubscribe-invalid'],
  ['/verify-contact?token=c12-invalid', 'verify-contact-invalid'], ['/child', 'child-anon'],
];
const childModeRoutes = [
  ['/parent/child-mode/today', 'cm-today'], ['/parent/child-mode/week', 'cm-week'], ['/parent/child-mode/calendar', 'cm-calendar'],
  ['/parent/child-mode/collection', 'cm-collection'], ['/parent/child-mode/goal', 'cm-goal'],
  ['/parent/child-mode/room-preview', 'cm-room-preview'], ['/parent/child-mode/prova', 'cm-prova'],
];

async function context(opts = {}) {
  const c = await browser.newContext({ viewport: sizes.phone, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', ...opts });
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

// One DOM audit per page/size. Heuristics only; reported, never "fixed" by the script.
async function audit(p) {
  return p.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight * 6; };
    const name = el => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    const actions = [...document.querySelectorAll('[role=button],button,a[href],[role=link],[role=switch],[role=tab],[role=radio],[role=checkbox]')].filter(vis);
    const unnamed = actions.filter(a => !name(a) && !a.querySelector('img[alt]:not([alt=""])')).map(a => a.outerHTML.slice(0, 120));
    const small = actions.filter(a => { const r = a.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(a => { const r = a.getBoundingClientRect(); return `${name(a).slice(0, 40)} ${Math.round(r.width)}x${Math.round(r.height)}`; });
    const clipped = [];
    for (const a of actions) for (const el of a.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if ((s.webkitLineClamp && s.webkitLineClamp !== 'none' || s.textOverflow === 'ellipsis' || s.overflow === 'hidden') && el.childElementCount === 0 && el.innerText &&
        (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) clipped.push(name(a).slice(0, 60));
    }
    const counts = {};
    for (const a of actions) { const n = name(a); if (n && n.length > 2) counts[n] = (counts[n] || 0) + 1; }
    const dupes = Object.entries(counts).filter(([, n]) => n > 1).map(([k, n]) => `${k.slice(0, 50)}×${n}`);
    const text = document.body.innerText;
    const keys = (text.match(/\b[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+){1,3}\b/g) || [])
      .filter(k => /[A-Z]/.test(k) || /^(c\d\d|u0\d|p0\d|prova|parent|child|notebook|planner|release|unified|auth|experience|guidedInput)\./.test(k))
      .filter(k => !/\.(com|app|invalid|org|net|tr|io)$/.test(k));
    const imgsNoAlt = [...document.querySelectorAll('img')].filter(vis).filter(i => !i.hasAttribute('alt') &&!i.closest('[aria-label]') && !i.closest('[aria-hidden=true]')).length;
    const headings = [...document.querySelectorAll('[role=heading],h1,h2,h3')].filter(vis).length;
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      unnamed: unnamed.slice(0, 6), unnamedCount: unnamed.length,
      small: small.slice(0, 8), smallCount: small.length, actionCount: actions.length,
      clipped: [...new Set(clipped)].slice(0, 6), dupes: dupes.slice(0, 8), keys: [...new Set(keys)].slice(0, 6),
      imgsNoAlt, headings, textLength: text.length,
    };
  });
}

async function visit(p, route, id, sizeList, opts = {}) {
  const url = web + route.replace(':attemptId', f.attemptId).replace(':c08AttemptId', f.c08AttemptId);
  const row = { id, route, sizes: {} };
  try {
    await p.setViewportSize(sizes[sizeList[0]]);
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(opts.wait ?? 2200);
    row.finalPath = new URL(p.url()).pathname + new URL(p.url()).search;
    for (const size of sizeList) {
      await p.setViewportSize(sizes[size]); await p.waitForTimeout(650);
      const m = await audit(p);
      row.sizes[size] = m;
      if (allShots || size === 'phone') await p.screenshot({ path: path.join(out, `${id}-${size}.png`), fullPage: true });
    }
    row.pageErrors = [...p.errors]; p.errors.length = 0;
  } catch (e) { row.error = e.message.split('\n')[0]; }
  metrics.push(row);
  console.error(`visited ${id} → ${row.finalPath || row.error}`);
  return row;
}

async function signIn(p) {
  await p.goto(web + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.email); await p.getByLabel('Şifre', { exact: true }).fill(f.password);
  await p.getByLabel('Şifre', { exact: true }).press('Enter');
  await p.waitForURL('**/parent', { timeout: 30000 });
}
const btn = (p, n) => p.getByRole('button', { name: n, exact: true });

async function enterChildMode(p) {
  await p.goto(web + '/parent/child-mode'); await p.waitForTimeout(1500);
  const childName = 'Synthetic child';
  const pick = p.getByRole('button', { name: new RegExp('^' + childName) }).first();
  if (await pick.count()) await pick.click();
  const pin = p.getByLabel('Çocuk PIN’i', { exact: true });
  if (await pin.count()) await pin.fill('1234');
  else await p.keyboard.type('1234');
  const enter = btn(p, 'Dünyama gir');
  if (await enter.count()) await enter.click();
  await p.waitForURL('**/parent/child-mode/today', { timeout: 20000 });
}

(async () => {
  const db = createClient(f.url, f.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await db.auth.signInWithPassword({ email: f.email, password: f.password });
  assert.ok(!login.error, 'login');
  // Notebook senaryosu için her koşuda yeni atanmış sınav (fixture'daki görselli açık uçlu soru).
  const imageExam = (await db.from('exams').select('question_ids,subject,grade').eq('title', 'Synthetic image Prova').single()).data;
  const mkExam = async title => (await db.from('exams').insert({ family_id: f.familyId, child_id: f.childId, title, subject: imageExam.subject, grade: imageExam.grade, question_ids: imageExam.question_ids, status: 'assigned' }).select('id').single()).data.id;

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const fullSizes = ['phone', 'narrow', 'tablet', 'tabletLand'];

  // 1) Oturumsuz rotalar
  const anon = await context();
  for (const [route, id] of publicRoutes) await visit(anon, route, id, fullSizes);

  // 2) Klavye: giriş formunda sekme sırası ve görünür odak
  await anon.setViewportSize(sizes.phone); await anon.goto(web + '/sign-in'); await anon.waitForTimeout(1500);
  const order = [];
  for (let i = 0; i < 12; i++) {
    await anon.keyboard.press('Tab');
    order.push(await anon.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); return { n: (a.getAttribute('aria-label') || a.innerText || a.getAttribute('placeholder') || a.tagName).trim().slice(0, 40), ring: s.outlineStyle !== 'none' || s.boxShadow !== 'none' }; }));
  }
  results.push({ check: 'keyboard_sign_in_order', passed: order.filter(o => o.n).length >= 6, detail: order });

  // 3) Veli rotaları
  const parent = await context(); await signIn(parent);
  for (const [route, id] of parentRoutes) await visit(parent, route, id, fullSizes);

  // 3b) İlk kullanım: yeni sentetik veli (0 çocuk), sonra tek çocuk (yerel Auth otomatik onaylı; @example.invalid).
  {
    const email = `c12-${crypto.randomUUID().slice(0, 8)}@example.invalid`, password = crypto.randomBytes(12).toString('hex') + 'A1!';
    const fresh = createClient(f.url, f.anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const up = await fresh.auth.signUp({ email, password });
    if (up.error || !up.data.session) fail('fresh_parent_signup', up.error?.message || 'no session');
    else {
      const fam = await fresh.rpc('create_family', { p_name: 'C12 Örnek Ailesi', p_display_name: 'C12 veli' });
      await fresh.auth.refreshSession();
      const p0 = await context();
      await p0.goto(web + '/sign-in');
      await p0.getByLabel('E-posta', { exact: true }).fill(email); await p0.getByLabel('Şifre', { exact: true }).fill(password);
      await p0.getByLabel('Şifre', { exact: true }).press('Enter'); await p0.waitForURL('**/parent', { timeout: 30000 }).catch(() => {});
      for (const [route, id] of [['/parent', 'zero-home'], ['/parent/calendar', 'zero-calendar'], ['/parent/tasks', 'zero-tasks'], ['/parent/prova', 'zero-prova'], ['/parent/grades', 'zero-grades'], ['/parent/notes', 'zero-notes']])
        await visit(p0, route, id, ['phone', 'narrow', 'tabletLand']);
      const setup = { p_request_id: crypto.randomUUID(), p_profile: { name: 'Tek Çocuk', birth_year: 2016, grade: 4, gender: 'unspecified', avatar: 'avatar-default', interests: [] }, p_tasks: [] };
      const one = await fresh.rpc('save_child_setup', setup);
      results.push({ check: 'fresh_family_and_one_child', passed: !fam.error && !one.error, detail: { family: fam.error?.message || 'ok', child: one.error?.message || 'ok' } });
      for (const [route, id] of [['/parent', 'one-home'], ['/parent/calendar', 'one-calendar'], ['/parent/tasks', 'one-tasks'], ['/parent/prova', 'one-prova'], ['/parent/grades', 'one-grades'], ['/parent/notes', 'one-notes'], ['/parent/share', 'one-share'], ['/parent/prova/progress', 'one-progress']])
        await visit(p0, route, id, ['phone', 'tabletLand']);
      await p0.context().close();
    }
  }

  // 4) Büyük yazı / yakınlaştırma yaklaşımı: 390 CSS px ekranda %135 tarayıcı ölçeği (289×625 @1.35).
  const zoom = await context({ viewport: { width: 289, height: 625 }, deviceScaleFactor: 1.35 });
  await signIn(zoom);
  sizes.zoom135 = { width: 289, height: 625 };
  for (const [route, id] of [['/parent', 'parent-home'], ['/parent/menu', 'parent-menu'], ['/parent/calendar', 'parent-calendar'], ['/parent/tasks', 'parent-tasks'], ['/parent/prova', 'prova-hub'], ['/parent/prova/builder', 'prova-builder'], ['/parent/notifications', 'parent-notifications']])
    await visit(zoom, route, id + '-zoom', ['zoom135']);

  // 5) Çocuk modu (veli telefonunda) + azaltılmış hareket
  const cm = await context({ reducedMotion: 'reduce' });
  await signIn(cm); await enterChildMode(cm);
  for (const [route, id] of childModeRoutes) await visit(cm, route, id, fullSizes);
  const anim = await cm.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  results.push({ check: 'reduced_motion_no_running_css_animations_child_week', passed: anim === 0, detail: { running: anim } });

  // 6) Defter: çizerken dış kaydırma, dikey boş defter, tam ekran, yön döngüsü, sorudan deftere al
  const examId = await mkExam('C12 defter ' + crypto.randomUUID().slice(0, 4));
  const nb = {};
  for (const size of ['phone', 'phoneLand', 'tablet', 'tabletLand']) {
    await cm.setViewportSize(sizes[size]);
    await cm.goto(web + `/parent/child-mode/prova/${examId}`); await cm.waitForTimeout(3000);
    const tab = cm.getByRole('tab', { name: 'Defter' });
    if (await tab.count() && await tab.first().isVisible()) { await tab.first().click(); await cm.waitForTimeout(700); }
    const page = cm.getByLabel('Çözüm defteri sayfası').first();
    const box = await page.boundingBox().catch(() => null);
    nb[size] = { paper: box ? { w: Math.round(box.width), h: Math.round(Math.min(box.height, sizes[size].height - Math.max(0, box.y))) } : null };
    await cm.screenshot({ path: path.join(out, `notebook-${size}.png`) });
    if (box) {
      const before = await cm.evaluate(() => [scrollY, ...[...document.querySelectorAll('*')].filter(e => e.scrollTop > 0).map(e => e.scrollTop)]);
      const x = box.x + Math.min(60, box.width / 4), y = box.y + Math.min(80, box.height / 3);
      await cm.mouse.move(x, y); await cm.mouse.down();
      for (let k = 1; k <= 20; k++) await cm.mouse.move(x + k * 6, y + k * 9);
      await cm.mouse.up(); await cm.waitForTimeout(400);
      const after = await cm.evaluate(() => [scrollY, ...[...document.querySelectorAll('*')].filter(e => e.scrollTop > 0).map(e => e.scrollTop)]);
      nb[size].scrollBefore = before; nb[size].scrollAfter = after;
      nb[size].outerScrollStable = JSON.stringify(before) === JSON.stringify(after);
      await cm.screenshot({ path: path.join(out, `notebook-${size}-drawn.png`) });
    }
    nb[size].hasExpand = await cm.getByRole('button', { name: 'Genişlet' }).count();
    nb[size].hasCopy = await cm.getByRole('button', { name: /Deftere al|Sorudan deftere al/ }).count();
  }
  // Yön döngüsü: tablet dikey → yatay → dikey; modal (Yazı) açık/kapalı sonrası düzen sabit kalmalı.
  const seq = [];
  for (const size of ['tablet', 'tabletLand', 'tablet', 'phone', 'tablet']) {
    await cm.setViewportSize(sizes[size]); await cm.waitForTimeout(900);
    const b = await cm.getByLabel('Çözüm defteri sayfası').first().boundingBox().catch(() => null);
    seq.push({ size, paperH: b ? Math.round(b.height) : 0, url: new URL(cm.url()).pathname });
  }
  const textBtn = cm.getByRole('button', { name: /^Yazı$|Yazı ekle veya düzenle/ }).first();
  if (await textBtn.count()) {
    await textBtn.click().catch(() => {}); await cm.waitForTimeout(700);
    await cm.screenshot({ path: path.join(out, 'notebook-text-modal-tablet.png') });
    await cm.setViewportSize(sizes.tabletLand); await cm.waitForTimeout(700);
    await cm.keyboard.press('Escape'); await cm.waitForTimeout(500);
    const close = cm.getByRole('button', { name: 'Kapat' }).last(); if (await close.count() && await close.isVisible()) await close.click().catch(() => {});
    await cm.setViewportSize(sizes.tablet); await cm.waitForTimeout(900);
    const b = await cm.getByLabel('Çözüm defteri sayfası').first().boundingBox().catch(() => null);
    seq.push({ size: 'tablet-after-modal-rotate', paperH: b ? Math.round(b.height) : 0, url: new URL(cm.url()).pathname });
    await cm.screenshot({ path: path.join(out, 'notebook-after-modal-rotate-tablet.png') });
  }
  nb.rotation = seq;
  // Sorudan deftere al (görsel kesme)
  const copy = cm.getByRole('button', { name: /Deftere al|Sorudan deftere al/ }).first();
  if (await copy.count()) {
    await copy.click().catch(() => {}); await cm.waitForTimeout(1200);
    await cm.screenshot({ path: path.join(out, 'notebook-copy-sheet-tablet.png') });
    nb.copySheet = await cm.evaluate(() => { const imgs = [...document.querySelectorAll('img')].filter(i => i.getBoundingClientRect().width > 40); return imgs.map(i => { const r = i.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), natural: i.naturalWidth + 'x' + i.naturalHeight, overflowRight: Math.round(r.right - innerWidth) }; }); });
    const place = cm.getByRole('button', { name: 'Seçili görseli deftere al' });
    if (await place.count()) {
      await place.click().catch(() => {}); await cm.waitForTimeout(1500);
      await cm.screenshot({ path: path.join(out, 'notebook-copy-placed-tablet.png') });
      const paper = await cm.getByLabel('Çözüm defteri sayfası').first().boundingBox().catch(() => null);
      nb.placedImages = await cm.evaluate(p => [...document.querySelectorAll('image, img')].map(i => i.getBoundingClientRect()).filter(r => r.width > 60 && p && r.top >= p.y - 2 && r.left >= p.x - 2)
        .map(r => ({ w: Math.round(r.width), h: Math.round(r.height), clippedRight: p ? Math.round(r.right - (p.x + p.width)) : null })), paper);
    } else await cm.keyboard.press('Escape').catch(() => {});
  }
  const expand = cm.getByRole('button', { name: 'Genişlet' }).first();
  if (await expand.count() && await expand.isVisible()) {
    await expand.click(); await cm.waitForTimeout(700);
    const b = await cm.getByLabel('Çözüm defteri sayfası').first().boundingBox().catch(() => null);
    nb.expanded = b ? { w: Math.round(b.width), h: Math.round(b.height) } : null;
    await cm.screenshot({ path: path.join(out, 'notebook-expanded-tablet.png') });
  }
  results.push({ check: 'notebook_probe', passed: Object.values(nb).every(v => !v || v.outerScrollStable !== false), detail: nb });

  fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 1));
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(results, null, 1));
  console.log(JSON.stringify({ label, routes: metrics.length, errors: metrics.filter(m => m.error).map(m => m.id), checks: results.map(r => [r.check, r.passed]) }));
  await browser.close();
})().catch(async e => {
  console.error('FATAL', e.stack);
  fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 1));
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify([...results, { check: 'fatal', passed: false, detail: e.message }], null, 1));
  if (browser) await browser.close();
  process.exit(1);
});
