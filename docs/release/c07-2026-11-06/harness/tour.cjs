// C07 backoffice tour against the disposable gina_c07_* services. Synthetic data only; nothing is sent.
// Usage: C07_WORK=<scratch> SHOT_DIR=<dir> GINA_QA_PLAYWRIGHT_PATH=<playwright> node tour.cjs
const fs = require('node:fs'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.C07_WORK + '/fixture.json'));
assert.match(f.db, /^gina_c07_[0-9a-f]+_audit$/); assert.equal(new URL(f.url).hostname, '127.0.0.1');
const outDir = process.env.SHOT_DIR; fs.mkdirSync(outDir, { recursive: true });
const GROUP = 'b3450000-0000-4000-8000-000000000001', T1 = 'b3420000-0000-4000-8000-000000000001', T2 = 'b3420000-0000-4000-8000-000000000002';
const sql = (q) => execFileSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', f.db, '-v', 'ON_ERROR_STOP=1'], { input: q }).toString().trim();
const results = [];
let browser;
const DENIED = /yetkisi gerekiyor|yönetici yetkisi yok|Yetkiniz kaldırıldı/;

async function session(who, width = 1280, height = 800) {
  const c = await browser.newContext({ viewport: { width, height }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage(); p.setDefaultTimeout(20000);
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  p.rpcs = []; p.on('request', r => { const m = r.url().match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/); if (m) p.rpcs.push(m[1]); });
  await p.goto(f.app + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.creds[who].email);
  await p.getByLabel('Şifre', { exact: true }).fill(f.creds[who].password);
  await p.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await p.waitForURL(u => !u.pathname.startsWith('/sign-in'));
  return p;
}
async function shot(p, name, full = false) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${outDir}/${name}.png`, fullPage: full });
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow on ' + name);
}
async function both(p, name) {
  await p.setViewportSize({ width: 1280, height: 800 }); await shot(p, name + '-1280');
  await p.setViewportSize({ width: 768, height: 1024 }); await shot(p, name + '-768');
  await p.setViewportSize({ width: 1280, height: 800 });
}
async function check(name, fn) {
  try { const detail = await fn(); results.push({ check: name, passed: true, ...(detail ? { detail } : {}) }); console.log('PASS', name, JSON.stringify(detail ?? '')); }
  catch (e) { results.push({ check: name, passed: false, error: String(e.message || e).slice(0, 500) }); console.log('FAIL', name, String(e.message || e).slice(0, 500)); }
}
// Same browser session token as the UI: proves the server gate, not only the hidden button.
async function rpc(p, fn, args = {}) {
  return await p.evaluate(async ({ url, anon, fn, args }) => {
    const key = Object.keys(localStorage).find(k => k.endsWith('-auth-token'));
    const token = JSON.parse(localStorage.getItem(key)).access_token;
    const r = await fetch(url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: anon, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(args) });
    const text = await r.text();
    return { status: r.status, forbidden: r.status === 401 || r.status === 403 || /"forbidden"|42501/.test(text), text: text.slice(0, 300) };
  }, { url: f.url, anon: f.anon, fn, args });
}
async function pageState(p, path) {
  await p.goto(f.app + path);
  await p.waitForTimeout(1500);
  const text = await p.locator('main').innerText();
  return DENIED.test(text) ? 'denied' : 'allowed';
}
const parentThread = (user, family, ticket) => sql(`begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated","gina":{"family_id":"${family}","role":"parent"}}',true); select public.get_help_ticket('${ticket}')::text; commit;`).split('\n').filter(l => l.startsWith('{')).join('');

const PAGES = ['/dashboard', '/families', '/billing', '/support', '/support-replies', '/library', '/groups', '/cohort-review', '/announcements', '/notifications', '/overrides', '/help-articles', '/education-calendars'];
const ALLOWED = {
  admin: PAGES,
  support: ['/dashboard', '/support', '/support-replies', '/ideas'],
  content: ['/dashboard', '/library', '/groups', '/cohort-review', '/help-articles', '/education-calendars'],
  finance: ['/dashboard', '/billing'],
  release: ['/dashboard', '/library', '/announcements', '/notifications'],
};
const RPCS = [
  ['admin_dashboard', {}, ['admin']],
  ['admin_families_search', { p_query: null, p_cursor: null, p_limit: 5 }, ['admin', 'support', 'finance']],
  ['finance_workspace', { p_query: '', p_family_id: null }, ['admin', 'finance']],
  ['support_canned_replies', {}, ['admin', 'support']],
  ['admin_support_queue', { p_kind: 'support', p_status: 'open', p_category: null, p_assignee: 'any', p_query: null, p_waiting: false, p_before_time: null, p_before_id: null }, ['admin', 'support']],
  ['admin_library_content_page', { p_limit: 5 }, ['admin', 'content', 'release']],
  ['admin_list_library_draft_packages', {}, ['admin', 'content']],
  ['admin_cohort_review_queue', { p_group: GROUP }, ['admin', 'content']],
  ['admin_group_exams', {}, ['admin', 'content']],
  ['admin_announcements', {}, ['admin', 'release']],
  ['admin_list_overrides', {}, ['admin']],
  ['admin_group_policy', { p_enabled: true, p_limits: { free: -1 } }, ['admin']],
];

(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const pages = {};
  for (const who of ['admin', 'support', 'content', 'finance', 'release']) pages[who] = await session(who);

  await check('role_matrix_ui_and_rpc', async () => {
    const detail = {};
    for (const who of Object.keys(ALLOWED)) {
      const p = pages[who];
      const ui = {}, bad = [];
      for (const path of PAGES) {
        ui[path] = await pageState(p, path);
        const expected = ALLOWED[who].includes(path) ? 'allowed' : 'denied';
        if (ui[path] !== expected) bad.push(`${path}: ${ui[path]} (expected ${expected})`);
      }
      // Operatörün yönetim menüsünde yasak bölüm bağlantısı yok.
      await p.goto(f.app + '/dashboard'); await p.waitForTimeout(1200);
      const nav = await p.locator('nav[aria-label="Yönetim bölümleri"] a').evaluateAll(a => a.map(x => new URL(x.href).pathname));
      // Yönetici NAV'ı ek yönetici sayfalarını da içerir; yasak bağlantı kontrolü operatörler içindir.
      if (who !== 'admin') for (const href of nav) if (!ALLOWED[who].includes(href)) bad.push('nav link ' + href);
      const rpcBad = [];
      for (const [fn, args, roles] of RPCS) {
        const r = await rpc(p, fn, args);
        const expected = roles.includes(who) ? 'allowed' : 'forbidden';
        const got = r.forbidden ? 'forbidden' : 'allowed';
        if (got !== expected) rpcBad.push(`${fn}: ${got} (${r.status} ${r.text})`);
      }
      assert.deepEqual([...bad, ...rpcBad], [], who);
      detail[who] = { pages_allowed: Object.entries(ui).filter(([, v]) => v === 'allowed').map(([k]) => k), nav, rpc_checked: RPCS.length };
    }
    return detail;
  });

  await check('operator_dashboard_scoped_workqueue', async () => {
    const out = {}, heads = {};
    const roleName = { support: 'Destek', content: 'İçerik', finance: 'Finans', release: 'Yayın' };
    for (const who of ['support', 'content', 'finance', 'release']) {
      const p = pages[who];
      p.rpcs.length = 0; // önceki kontrolde RPC matrisi admin_dashboard'u doğrudan denedi
      await p.goto(f.app + '/dashboard');
      const wq = p.getByTestId('workqueue'); await wq.locator('h3').filter({ hasText: roleName[who] + ' · ' }).waitFor();
      const keys = await p.locator('[data-queue]').evaluateAll(l => l.map(x => x.getAttribute('data-queue')));
      const roleHeads = (await wq.locator('h3').allInnerTexts()).filter(t => / · \d+$/.test(t));
      heads[who] = roleHeads;
      assert.deepEqual(roleHeads.map(t => t.split(' · ')[0]), [roleName[who]], who + ' sees other role queues');
      out[who] = keys;
      assert.ok(!p.rpcs.includes('admin_dashboard'), who + ' requested admin_dashboard');
      await both(p, `01-dashboard-${who}`);
    }
    assert.ok(out.support.includes('tickets_unassigned') && !out.support.some(k => /store|ai_|library/.test(k)));
    assert.ok(out.finance.every(k => /store|reconcile|subscriptions|overrides/.test(k)));
    assert.ok(out.content.every(k => /library|contributions|prereview|scenario|education/.test(k)));
    assert.ok(out.release.every(k => /push|announcements/.test(k)));
    // İçerik operatörü yönetici ekranlarına (senaryo kaynakları) bağlantı görmez.
    const adminOnly = await pages.content.getByTestId('admin-only-link').count();
    return { active_rows: out, role_headings: heads, content_admin_only_links_replaced: adminOnly };
  });

  await check('support_unassigned_is_assignee_based', async () => {
    const p = pages.support;
    await p.goto(f.app + '/dashboard');
    const row = p.locator('[data-queue="tickets_unassigned"]'); await row.waitFor();
    const text = await row.innerText();
    const dbCount = sql("select count(*) from public.help_tickets where kind='support' and status in('open','in_progress') and assignee_id is null");
    assert.match(text, /Sorumlusu atanmamış/); assert.match(text, new RegExp('\\b' + dbCount + '\\b'));
    assert.match(text, /Henüz bir ekip üyesine atanmadı/);
    await row.getByRole('link', { name: 'Aç' }).click();
    await p.waitForURL(u => u.pathname === '/support' && u.search.includes('assignee=none'));
    await p.getByTestId('support-assignee-filter').waitFor();
    assert.equal(await p.getByTestId('support-assignee-filter').inputValue(), 'none');
    await p.getByRole('button', { name: /Plus paketim görünmüyor/ }).first().waitFor();
    assert.equal(await p.getByRole('button', { name: /Tablet eşleştirme kodu/ }).count(), 0);
    await both(p, '02-support-unassigned-filter');
    return { db_unassigned: +dbCount, row: text.replace(/\s+/g, ' ').slice(0, 160) };
  });

  await check('canned_replies_managed_tr_en_idempotent', async () => {
    const p = pages.support;
    await p.goto(f.app + '/support-replies'); await p.getByTestId('canned-admin').waitFor();
    await p.getByTestId('canned-row').first().waitFor();
    assert.equal(await p.getByTestId('canned-row').count(), 5);
    await p.getByRole('button', { name: 'Yeni hazır yanıt' }).click();
    await p.getByLabel(/^Başlık/).fill('C07 şifre yardımı');
    await p.getByLabel('Metin').fill('Merhaba, giriş ekranındaki "Şifremi unuttum" bağlantısını kullanabilirsiniz.');
    await p.getByRole('checkbox', { name: 'Hesap' }).check();
    const save = p.getByRole('button', { name: 'Kaydet', exact: true });
    await save.dblclick();
    await p.getByText('Hazır yanıt kaydedildi.').waitFor();
    assert.equal(sql("select count(*) from gina.support_canned_replies where title='C07 şifre yardımı'"), '1');
    assert.equal(sql("select count(*) from public.audit_log where action='support.canned_reply'"), '1');
    const row = p.getByTestId('canned-row').filter({ hasText: 'C07 şifre yardımı' });
    await row.getByRole('button', { name: 'Arşivle' }).click();
    await p.getByText(/Yanıt arşivlendi/).waitFor();
    assert.equal(sql("select archived_at is not null from gina.support_canned_replies where title='C07 şifre yardımı'"), 't');
    await p.getByRole('tab', { name: 'English' }).click();
    await p.getByTestId('canned-row').filter({ hasText: 'We are on it' }).waitFor();
    await both(p, '03-canned-replies-manage');
    // Stale edit: another operator changed it meanwhile.
    await p.getByTestId('canned-row').filter({ hasText: 'We are on it' }).getByRole('button', { name: 'Düzenle' }).click();
    sql("update gina.support_canned_replies set revision=revision+1 where title='We are on it'");
    await p.getByLabel('Metin').fill('Hello, we received your message and are on it.');
    await p.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await p.getByText(/başka bir ekip üyesince değiştirildi/).waitFor();
    // In a conversation: family locale (en) chosen by default; archived TR reply not offered; nothing is sent.
    const before = sql(`select count(*) from public.help_messages where ticket_id='${T1}'`);
    await p.goto(f.app + '/support');
    await p.getByRole('button', { name: /Plus paketim görünmüyor/ }).first().click();
    await p.getByText('Hazır yanıt ekle').click();
    const list = p.getByTestId('canned-list'); await list.getByRole('button').first().waitFor();
    assert.equal(await list.getAttribute('data-locale'), 'en');
    await list.getByRole('button', { name: 'We are on it' }).waitFor();
    await p.getByRole('button', { name: 'Türkçe', exact: true }).click();
    await p.locator('[data-testid="canned-list"][data-locale="tr"]').getByRole('button', { name: 'Aldık, bakıyoruz' }).waitFor();
    assert.equal(await p.getByTestId('canned-list').getByRole('button', { name: 'C07 şifre yardımı' }).count(), 0);
    await p.getByTestId('canned-list').getByRole('button', { name: 'Aldık, bakıyoruz' }).click();
    await both(p, '04-canned-in-conversation');
    assert.equal(sql(`select count(*) from public.help_messages where ticket_id='${T1}'`), before);
    return { default_locale: 'en', archived_hidden: true, double_click_rows: 1, stale_edit_rejected: true };
  });

  await check('team_note_not_leaked', async () => {
    const parent = parentThread(f.users.p2, 'b3400000-0000-4000-8000-000000000002', T2);
    assert.ok(parent.length > 10 && !parent.includes('C07-GIZLI') && !parent.includes('assignee'));
    await pages.content.goto(f.app + '/library'); await pages.content.getByTestId('content-count').waitFor();
    assert.ok(!(await pages.content.locator('body').innerText()).includes('C07-GIZLI'));
    const canned = await rpc(pages.support, 'support_canned_replies', { p_ticket: T2 });
    assert.ok(!canned.text.includes('C07-GIZLI'));
    return { parent_view_clean: true, content_view_clean: true };
  });

  await check('billing_keyset_beyond_50_and_filter_reset', async () => {
    const p = pages.finance;
    await p.goto(f.app + '/billing');
    const count = p.getByTestId('billing-family-count');
    await p.getByText(/50 aile gösteriliyor · devamı var/).waitFor();
    const total = +sql('select count(*) from public.families');
    let clicks = 0;
    while (await p.getByTestId('billing-more').count()) { await p.getByTestId('billing-more').click(); clicks++; await p.waitForTimeout(700); if (clicks > 6) break; }
    await p.getByText(new RegExp(`${total} aile gösteriliyor · liste tamam`)).waitFor();
    const names = await p.getByTestId('billing-family').evaluateAll(b => b.map(x => x.querySelector('strong').textContent));
    assert.equal(names.length, total); assert.equal(new Set(await p.getByTestId('billing-family').evaluateAll(b => b.map(x => x.outerHTML))).size, total);
    await both(p, '05-billing-all-families');
    const searchCalls = p.rpcs.filter(r => r === 'admin_families_search').length;
    await p.getByLabel('Aile adı veya kimliği').fill('Sentetik aile 01');
    await p.getByRole('button', { name: 'Ara', exact: true }).click();
    await p.getByText(/10 aile gösteriliyor · liste tamam/).waitFor();
    const filtered = await p.getByTestId('billing-family').evaluateAll(b => b.map(x => x.querySelector('strong').textContent));
    assert.ok(filtered.every(n => n.startsWith('Sentetik aile 01')));
    await p.getByTestId('billing-family').first().click();
    await p.getByText('Şu anda kullanılan paket').waitFor();
    await both(p, '06-billing-search-detail');
    return { total, load_more_clicks: clicks, search_rows: filtered.length, search_rpc_calls: p.rpcs.filter(r => r === 'admin_families_search').length - searchCalls, text: await count.innerText() };
  });

  await check('content_keyset_beyond_200_candidate_badge_filter_reset', async () => {
    const p = pages.content;
    await p.goto(f.app + '/library');
    await p.getByText(/50 kayıt gösteriliyor · devamı var/).waitFor();
    const tabs = await p.getByRole('navigation', { name: 'Kütüphane işlemleri' }).getByRole('button').allInnerTexts();
    assert.ok(!tabs.some(t => /Koleksiyonlar|Haklar ve ödüller|Senaryo kaynakları/.test(t)), tabs.join('|'));
    const expected = +sql("select (select count(*) from gina.library_content_items)+(select count(*) from gina.curriculum_candidates)");
    let clicks = 0;
    while (await p.getByTestId('content-more').count()) { await p.getByTestId('content-more').click(); clicks++; await p.waitForTimeout(800); if (clicks > 8) break; }
    await p.getByText(new RegExp(`${expected} kayıt gösteriliyor · liste tamam`)).waitFor();
    const keys = await p.getByTestId('content-item').evaluateAll(r => r.map(x => x.getAttribute('data-kind') + (x.textContent || '').slice(0, 60)));
    assert.equal(keys.length, expected);
    await p.getByLabel('Tür').selectOption('curriculum_candidate');
    await p.getByText(/1 kayıt gösteriliyor · liste tamam/).waitFor();
    const cell = p.getByTestId('ai-cell').first();
    assert.equal(await cell.getAttribute('data-ai'), 'needs_admin');
    assert.match(await cell.innerText(), /AI/);
    assert.match(await p.getByTestId('content-item').first().innerText(), /Senaryo kararı yönetici ekranında/);
    await both(p, '07-content-candidate-ai-badge');
    await p.getByLabel('Tür').selectOption('');
    await p.getByText(/50 kayıt gösteriliyor · devamı var/).waitFor();
    await p.locator('label:has-text("AI ön inceleme") select').selectOption('needs_admin');
    await p.getByText(/kayıt gösteriliyor · liste tamam/).waitFor();
    const aiRows = await p.getByTestId('content-item').count();
    assert.equal(aiRows, +sql("select count(*) from gina.content_prereviews where prereview_status='needs_admin'"));
    await p.locator('label:has-text("AI ön inceleme") select').selectOption('');
    await p.getByText(/50 kayıt gösteriliyor/).waitFor();
    await both(p, '08-content-list');
    return { expected_rows: expected, load_more_clicks: clicks, tabs, ai_filter_rows: aiRows };
  });

  await check('release_library_view_and_publication_role', async () => {
    const pkg = sql("select id from gina.library_import_packages order by created_at limit 1");
    const r = pages.release, c = pages.content;
    await r.goto(f.app + '/library'); await r.getByText(/kayıt gösteriliyor/).waitFor();
    const tabs = await r.getByRole('navigation', { name: 'Kütüphane işlemleri' }).getByRole('button').allInnerTexts();
    assert.deepEqual(tabs.map(t => t.trim()), ['Tüm içerik · AI ön inceleme']);
    assert.equal(await r.getByRole('checkbox').count(), 0);
    await c.goto(f.app + '/library-publication?packageId=' + pkg);
    await c.getByTestId('publication-preview-only').waitFor();
    await both(c, '09-publication-content-preview-only');
    await r.goto(f.app + '/library-publication?packageId=' + pkg);
    await r.waitForTimeout(2500);
    assert.equal(await r.getByTestId('publication-preview-only').count(), 0);
    assert.ok(!DENIED.test(await r.locator('main').innerText()));
    await both(r, '10-publication-release');
    const content = await rpc(c, 'admin_set_library_publication', { p_request_id: crypto.randomUUID(), p_package_id: pkg, p_expected_version: 99, p_review_fingerprint: 'x', p_title: 'x', p_description: null, p_plans: ['free'], p_curriculum_label: null, p_confirmed: true, p_status: 'published', p_reason: null });
    const release = await rpc(r, 'admin_set_library_publication', { p_request_id: crypto.randomUUID(), p_package_id: pkg, p_expected_version: 99, p_review_fingerprint: 'x', p_title: 'x', p_description: null, p_plans: ['free'], p_curriculum_label: null, p_confirmed: true, p_status: 'published', p_reason: null });
    assert.ok(content.forbidden, 'content publish must be forbidden'); assert.ok(!release.forbidden, 'release reaches publication rules: ' + release.text);
    return { content_publish: content.status, release_publish_rule_error: release.text.slice(0, 120) };
  });

  await check('content_group_create_preview_distribute_once', async () => {
    const p = pages.content;
    const before = +sql('select count(*) from public.group_exams');
    await p.goto(f.app + '/groups');
    await p.getByTestId('group-policy-admin-only').waitFor();
    await p.getByLabel('Başlık').fill('C07 içerik ekibi provası');
    const pkg = sql("select id from gina.library_import_packages order by created_at limit 1");
    await p.getByLabel('Kaynak').selectOption('package:' + pkg);
    await p.waitForTimeout(1200);
    const start = new Date(Date.now() + 3600e3), end = new Date(Date.now() + 2 * 86400e3);
    const local = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    await p.getByLabel('Katılım başlangıcı').fill(local(start));
    await p.getByLabel('Katılım bitişi').fill(local(end));
    const boxes = p.locator('fieldset label:has(input[type=checkbox]:not([disabled])) input[type=checkbox]').filter({ hasNot: p.locator('[disabled]') });
    const card = p.locator('section.admin-card', { hasText: 'Yeni ortak prova' });
    const unitBoxes = card.locator('label.border-b input[type=checkbox]:not([disabled])');
    const n = await unitBoxes.count();
    for (let i = 0; i < n; i++) await unitBoxes.nth(i).check();
    void boxes;
    const preview = p.getByTestId('group-preview'); await preview.waitFor();
    assert.match(await preview.innerText(), /1 · Kapsam/);
    await p.getByRole('checkbox', { name: /Kaynağı, soruları, süreyi ve katılım penceresini kontrol ettim/ }).check();
    await both(p, '11-groups-preview-content');
    await p.getByRole('button', { name: 'Sürümü sabitle ve yayımla' }).dblclick();
    await p.waitForTimeout(3000);
    const after = +sql('select count(*) from public.group_exams');
    assert.equal(after, before + 1);
    assert.equal(sql("select created_by from public.group_exams where title='C07 içerik ekibi provası'"), f.users.content);
    return { units_checked: n, created: after - before };
  });

  await check('content_cohort_review_queue', async () => {
    const p = pages.content;
    await p.goto(f.app + '/cohort-review?group=' + GROUP);
    await p.getByTestId('cohort-next-unreviewed').waitFor();
    await both(p, '12-cohort-review-content');
    return { ok: true };
  });

  await check('announcement_push_audience_real_counts', async () => {
    const p = pages.release;
    await p.goto(f.app + '/announcements');
    await p.getByRole('button', { name: 'Düzenle / önizle' }).first().click();
    await p.getByRole('button', { name: '2. Alıcıları önizle' }).click();
    const card = p.getByTestId('announcement-push-audience'); await card.waitFor();
    const text = await card.innerText();
    assert.match(text, /Ulaşılabilir: 1 veli · 2 cihaz/);
    assert.match(text, /Duyuru bildirimlerini kapatmış: 1/);
    assert.match(text, /Bildirim izni verilmiş cihazı yok: 2/);
    await both(p, '13-announcement-push-audience');
    assert.equal(sql("select status from gina.parent_announcements where id='b3440000-0000-4000-8000-000000000001'"), 'draft');
    assert.equal(sql("select count(*) from public.push_outbox where kind='parent_announcement' and status='pending'"), '0');
    return { card: text.replace(/\s+/g, ' ') };
  });

  await check('role_revocation_in_open_tab', async () => {
    const out = {};
    for (const [who, path, role, marker] of [['content', '/library', 'content', 'content-count'], ['finance', '/billing', 'finance', 'billing-family-count'], ['support', '/support-replies', 'support', 'canned-admin']]) {
      const p = pages[who];
      await p.goto(f.app + path); await p.getByTestId(marker).waitFor();
      sql(`update public.operations_members set revoked_at=now() where user_id='${f.users[who]}' and role='${role}'`);
      await p.evaluate(() => window.dispatchEvent(new Event('focus')));
      await p.getByTestId('role-revoked').waitFor();
      assert.equal(await p.getByTestId(marker).count(), 0, who + ' data still mounted');
      const r = await rpc(p, who === 'content' ? 'admin_library_content_page' : who === 'finance' ? 'finance_workspace' : 'support_canned_replies', who === 'finance' ? { p_query: '', p_family_id: null } : {});
      assert.ok(r.forbidden, who + ' rpc after revocation: ' + r.status);
      await both(p, `14-revoked-${who}`);
      sql(`update public.operations_members set revoked_at=null where user_id='${f.users[who]}' and role='${role}'`);
      out[who] = { ui: 'Yetkiniz kaldırıldı', rpc_status: r.status };
    }
    return out;
  });

  await check('no_page_errors', async () => {
    const errs = Object.fromEntries(Object.entries(pages).map(([k, p]) => [k, p.errors]));
    assert.deepEqual(Object.values(errs).flat(), []);
    return null;
  });

  fs.writeFileSync(outDir + '/../ui-checks.json', JSON.stringify({ db: 'gina_c07_<random>_audit', viewport: ['1280x800', '768x1024'], results }, null, 2));
  await browser.close();
  process.exit(results.every(r => r.passed) ? 0 : 1);
})().catch(async e => { console.error(e); try { await browser?.close(); } catch {} process.exit(2); });
