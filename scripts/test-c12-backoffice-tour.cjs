// C12 — yönetim (backoffice) sayfa turu: 1280×800 masaüstü ve 768×1024 tablet, sentetik yönetici (fixture `admins` satırı).
// Statik `next build` çıktısı yer tutucu NEXT_PUBLIC_SUPABASE_URL ile derlenir; istekler Playwright yönlendirmesiyle izole
// servise gider. Ortam: GINA_QA_UI_FIXTURE, GINA_BO_WEB, GINA_BO_BACKEND, GINA_BO_ANON, GINA_QA_PLAYWRIGHT_PATH, GINA_C12_OUT.
// Ayrıca Q00-A3-5 (geçici rol hatası ≠ yetkisiz) için `my_operation_roles` ve admin claim okuması 503 ile kesilir.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
const web = process.env.GINA_BO_WEB, backend = process.env.GINA_BO_BACKEND, placeholderAnon = process.env.GINA_BO_ANON;
assert.equal(new URL(web).hostname, '127.0.0.1'); assert.equal(new URL(backend).hostname, '127.0.0.1');
const out = path.resolve(process.env.GINA_C12_OUT); fs.mkdirSync(out, { recursive: true });
const pages = ['dashboard', 'families', 'billing', 'overrides', 'ai', 'operations', 'input-catalog', 'questions', 'library', 'library?tab=drafts',
  'library?tab=policy', 'library?tab=review', 'library?tab=curriculum', 'library-publication', 'groups', 'cohort-review', 'support', 'support-replies',
  'ideas', 'help-articles', 'notifications', 'announcements', 'education-calendars'];
const sizes = { desktop: { width: 1280, height: 800 }, tablet: { width: 768, height: 1024 } };
const metrics = [], results = [];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const c = await browser.newContext({ viewport: sizes.desktop, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
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
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(web + '/sign-in.html');
  await p.fill('#email', f.email); await p.fill('#password', f.password);
  await p.locator('button[type=submit]').click();
  await p.waitForURL('**/dashboard**', { timeout: 30000 });
  for (const route of pages) {
    const [name, q] = route.split('?');
    const row = { route, sizes: {} };
    try {
      for (const [size, vp] of Object.entries(sizes)) {
        await p.setViewportSize(vp);
        await p.goto(`${web}/${name}.html${q ? '?' + q : ''}`); await p.waitForTimeout(2200);
        row.sizes[size] = await p.evaluate(() => {
          const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
          const acts = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea')].filter(vis);
          const small = acts.filter(a => { const r = a.getBoundingClientRect(); return a.type !== 'checkbox' && a.type !== 'radio' && (r.height < 40); })
            .map(a => `${(a.getAttribute('aria-label') || a.innerText || a.name || a.id || a.tagName).trim().slice(0, 30)} ${Math.round(a.getBoundingClientRect().height)}`);
          const unlabeled = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea')].filter(vis)
            .filter(i => !i.getAttribute('aria-label') && !(i.id && document.querySelector(`label[for="${i.id}"]`)) && !i.closest('label')).length;
          return { overflow: document.documentElement.scrollWidth - innerWidth, small: small.slice(0, 5), smallCount: small.length, unlabeled,
            rawError: /Cannot coerce|JWT|PGRST|violates|duplicate key/.test(document.body.innerText) };
        });
        await p.screenshot({ path: path.join(out, `bo-${route.replace(/[?=]/g, '-')}-${size}.png`) });
      }
    } catch (e) { row.error = e.message.split('\n')[0]; }
    metrics.push(row); console.error('visited ' + route);
  }
  // B02: global soru düzenleyicisi şıkları alan alan gösterir (JSON yalnız bilinmeyen biçimde).
  {
    const { createClient: cc } = require(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'));
    const admin = cc(f.url, f.anon, { auth: { persistSession: false } });
    await admin.auth.signInWithPassword({ email: f.email, password: f.password });
    const ins = await admin.from('question_bank').insert({ family_id: null, grade: 5, subject: 'Matematik', topic: 'Kesirler', kind: 'multiple_choice', difficulty: 'orta',
      stem: 'C12 global soru: 1/2 hangisine eşittir?', choices: [{ key: 'A', text: '2/4' }, { key: 'B', text: '1/3' }, { key: 'C', text: '3/4' }, { key: 'D', text: '2/3' }], correct_key: 'A' }).select('id').single();
    if (ins.error) results.push({ check: 'questions_structured_choice_editor', passed: false, detail: 'GÖRÜLEMEDİ: global soru eklenemedi: ' + ins.error.message });
    else {
      await p.setViewportSize(sizes.desktop); await p.goto(web + '/questions.html'); await p.waitForTimeout(2500);
      await p.getByRole('button', { name: /Düzenle/ }).first().click(); await p.waitForTimeout(800);
      const radios = await p.locator('input[type=radio][name=q-correct]').count(), json = await p.locator('#q-choices').count();
      const checked = await p.locator('input[type=radio][name=q-correct]:checked').getAttribute('aria-label').catch(() => null);
      await p.screenshot({ path: path.join(out, 'bo-questions-editor-desktop.png'), fullPage: true });
      results.push({ check: 'questions_structured_choice_editor', passed: radios === 4 && json === 0 && /A$/.test(checked || ''), detail: { radios, json, checked } });
    }
  }

  // Q00-A3-5: rolsüz yeni sentetik hesap. Rol RPC'si 503 → "kontrol edilemedi"; RPC çalışınca → "yetkisi yok".
  const { createClient } = require(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'));
  const email = `c12-bo-${Date.now().toString(36)}@example.invalid`, password = require('node:crypto').randomBytes(12).toString('hex') + 'A1!';
  const up = await createClient(f.url, f.anon, { auth: { persistSession: false } }).auth.signUp({ email, password });
  if (up.error) results.push({ check: 'bo_norole_signup', passed: false, detail: up.error.message });
  else for (const [down, expect, deny] of [[true, /kontrol edilemedi/, /yönetici yetkisi yok/], [false, /yönetici yetkisi yok/, /kontrol edilemedi/]]) {
    const c2 = await browser.newContext({ viewport: sizes.desktop, locale: 'tr-TR' });
    await c2.route(backend + '/**', async route => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (down && /my_operation_roles/.test(req.url())) return route.fulfill({ status: 503, body: 'down', headers: { 'access-control-allow-origin': '*' } });
      const headers = { ...req.headers() };
      if (headers.apikey === placeholderAnon) headers.apikey = f.anon;
      if (headers.authorization === 'Bearer ' + placeholderAnon) headers.authorization = 'Bearer ' + f.anon;
      const res = await route.fetch({ url: f.url + req.url().slice(backend.length), headers });
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
    });
    const q = await c2.newPage();
    await q.goto(web + '/sign-in.html'); await q.fill('#email', email); await q.fill('#password', password);
    await q.locator('button[type=submit]').click(); await q.waitForTimeout(4000);
    const text = await q.locator('body').innerText();
    results.push({ check: down ? 'sign_in_role_error_not_reported_as_no_access' : 'sign_in_no_role_reported', passed: expect.test(text) && !deny.test(text), detail: text.slice(0, 260) });
    await q.screenshot({ path: path.join(out, `bo-sign-in-${down ? 'role-error' : 'no-role'}-desktop.png`) });
    await c2.close();
  }
  results.push({ check: 'no_page_errors', passed: errors.length === 0, detail: errors.slice(0, 5) });
  fs.writeFileSync(path.join(out, 'bo-metrics.json'), JSON.stringify(metrics, null, 1));
  fs.writeFileSync(path.join(out, 'bo-checks.json'), JSON.stringify(results, null, 1));
  console.log(JSON.stringify({ pages: metrics.length, errors: metrics.filter(m => m.error).map(m => m.route), checks: results.map(r => [r.check, r.passed]) }));
  await browser.close();
})().catch(e => { console.error('FATAL', e.stack); fs.writeFileSync(path.join(out, 'bo-metrics.json'), JSON.stringify(metrics, null, 1)); process.exit(1); });
