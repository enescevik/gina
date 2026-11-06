// D11 — yönetim P2 kapanışları için Playwright kontrolleri (1280×800 ve 768×1024, tr-TR, Chrome headless).
// Ortam: `python3 scripts/test-isolated-services.py --run-local --ui-hold` (GINA_QA_UI_SERVICE=1, benzersiz GINA_QA_UI_FIXTURE)
// tek kullanımlık `gina_http_<hex>_audit` klonunu ve geçici GoTrue/PostgREST'i açar; fixture sentetik yönetici hesabını verir.
// Backoffice statik çıktısı yer tutucu NEXT_PUBLIC_SUPABASE_URL ile derlenir; istekler Playwright yönlendirmesiyle fixture'a gider.
// Ortam değişkenleri: GINA_QA_UI_FIXTURE, GINA_BO_WEB, GINA_BO_BACKEND, GINA_BO_ANON, GINA_QA_PLAYWRIGHT_PATH, GINA_D11_OUT.
// Gizli değer (şifre, JWT, servis anahtarı) dosyaya veya çıktıya yazılmaz; yalnız @example.invalid hesaplar.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/); assert.ok(f.service, 'GINA_QA_UI_SERVICE=1 required');
const web = process.env.GINA_BO_WEB, backend = process.env.GINA_BO_BACKEND, placeholderAnon = process.env.GINA_BO_ANON;
assert.equal(new URL(web).hostname, '127.0.0.1'); assert.equal(new URL(backend).hostname, '127.0.0.1');
const out = path.resolve(process.env.GINA_D11_OUT); fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true });
const sizes = { d1280: { width: 1280, height: 800 }, t768: { width: 768, height: 1024 } }; // sıra: masaüstü, sonra tablet
const results = [];
const pass = (check, detail = {}) => { results.push({ check, passed: true, detail }); console.error('ok', check, JSON.stringify(detail)); };
const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function rest(method, p, body, token = f.service, extra = {}) {
  const res = await fetch(f.url + p, { method, headers: { apikey: token === f.service ? f.service : f.anon, authorization: 'Bearer ' + token, 'content-type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw Error(`${method} ${p.split('?')[0]} ${res.status} ${String(text).slice(0, 200)}`);
  return data;
}
const svc = (method, p, body) => rest(method, '/rest/v1' + p, body, f.service, { prefer: 'return=representation' });

(async () => {
  // Kullanıcı oturumu (RPC'ler yönetici kimliğiyle; servis anahtarı yalnız tohum ve DB okuması için).
  const login = await rest('POST', '/auth/v1/token?grant_type=password', { email: f.email, password: f.password }, f.anon);
  const userToken = login.access_token;
  const asAdmin = (name, args) => rest('POST', '/rest/v1/rpc/' + name, args, userToken);

  // ---- Tohum ----
  // Başka bir yönetici (yalnız denetim kaydının "yapan"ı olarak) ve 45 sentetik geçici hak denetim kaydı.
  const other = await rest('POST', '/auth/v1/admin/users', { email: `d11-other-${randomBytes(4).toString('hex')}@example.invalid`, password: randomBytes(18).toString('base64url') + 'aA1!', email_confirm: true });
  await svc('POST', '/admins', { user_id: other.id });
  const seeded = [], tag = 'D11-' + randomBytes(3).toString('hex');
  for (let i = 0; i < 45; i++) {
    const actor = i % 3 === 0 ? null : i % 3 === 1 ? f.userId : other.id;
    seeded.push({ actor_id: actor, action: i % 2 ? 'entitlement_overrides.insert' : 'entitlement_overrides.expire', target_table: 'entitlement_overrides', target_id: randomUUID(), family_id: f.familyId, reason: `${tag} sentetik kayıt ${String(i + 1).padStart(2, '0')}` });
  }
  await svc('POST', '/audit_log', seeded);
  const auditTotal = (await svc('GET', '/audit_log?select=id&target_table=eq.entitlement_overrides')).length;
  // Kütüphane: yayında bir koleksiyon (Plus, Pro) ve içinde bir taslak soru.
  const collectionId = randomUUID(), collectionTitle = 'D11 Kesirler ' + randomBytes(2).toString('hex');
  await asAdmin('admin_save_library_collection', { p_id: collectionId, p_title: collectionTitle, p_description: 'Sentetik', p_grade: 5, p_subject: 'Matematik', p_curriculum: 'MEB 2024', p_plans: ['plus', 'pro'], p_status: 'published' });
  const itemId = await asAdmin('admin_add_library_item', { p_collection_id: collectionId, p_content: { grade: 5, subject: 'Matematik', topic: 'D11 kesir sorusu', kind: 'open_ended', difficulty: 'orta', stem: `Bir pastanın yarısı kaç çeyrektir? (${tag})`, expected_answer: '2', solution: '1/2 = 2/4', choices: null, correct_key: null } });
  const itemStatus = async () => (await svc('GET', `/library_items?select=status&id=eq.${itemId}`))[0].status;
  // Global soru (silme onayı için).
  const gq = (await svc('POST', '/question_bank', { family_id: null, grade: 5, subject: 'Matematik', topic: 'Kesirler', kind: 'open_ended', difficulty: 'orta', stem: `D11 silme onayı deneme sorusu ${tag}`, expected_answer: '1', solution: '-' }))[0];
  const aiEnabled = async () => { const r = await svc('GET', "/app_settings?select=value&key=eq.ai.enabled"); return r.length ? r[0].value !== false : true; };

  // ---- Tarayıcı ----
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: sizes.d1280, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  await ctx.route(backend + '/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const headers = { ...req.headers() };
    if (headers.apikey === placeholderAnon) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + placeholderAnon) headers.authorization = 'Bearer ' + f.anon;
    try {
      const res = await route.fetch({ url: f.url + req.url().slice(backend.length), headers });
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*', 'access-control-expose-headers': '*' } });
    } catch { await route.fulfill({ status: 503, body: 'fixture unavailable' }); }
  });
  const p = await ctx.newPage(); p.setDefaultTimeout(25000);
  const pageErrors = []; let nativeDialogs = 0;
  p.on('pageerror', (e) => pageErrors.push(e.message));
  p.on('dialog', async (d) => { nativeDialogs++; await d.dismiss(); });
  const shot = async (name) => { await p.screenshot({ path: path.join(out, 'screenshots', name + '.png') }); };
  const go = async (route) => { await p.goto(`${web}/${route.replace(/^([^?]+)/, '$1.html')}`); await p.waitForTimeout(1800); };
  const dialog = () => p.getByTestId('confirm-dialog');
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

  await p.goto(web + '/sign-in.html');
  await p.fill('#email', f.email); await p.fill('#password', f.password);
  await p.locator('button[type=submit]').click();
  await p.waitForURL('**/dashboard**', { timeout: 30000 });

  // 1) Q00-C12-T2 — /ai: uygulama içi onay; Esc ve Vazgeç "hayır"; odak diyalogda; ad bağlı.
  for (const [size, vp] of Object.entries(sizes)) {
    await p.setViewportSize(vp); await go('ai');
    assert.equal(await aiEnabled(), true);
    await p.getByRole('button', { name: "AI'ı kapat (kill switch)" }).click();
    await dialog().getByText('Tüm AI özellikleri hemen kapatılsın mı?').waitFor();
    const a11y = await p.evaluate(() => {
      const d = document.querySelector('[data-testid=confirm-dialog]');
      const label = d.getAttribute('aria-labelledby');
      return { modal: d.matches(':modal'), labelled: !!label && !!document.getElementById(label)?.textContent, focusInside: d.contains(document.activeElement), focused: document.activeElement?.textContent };
    });
    assert.ok(a11y.modal && a11y.labelled && a11y.focusInside, 'dialog modal/labelled/focus ' + JSON.stringify(a11y));
    assert.equal(a11y.focused, 'Vazgeç', 'safe default focus');
    // Odak tuzağı: arka plan inert; Tab dizisi diyalog dışındaki bir sayfa öğesine geçmez.
    const escaped = [];
    for (let i = 0; i < 6; i++) {
      await p.keyboard.press('Tab');
      escaped.push(await p.evaluate(() => { const d = document.querySelector('[data-testid=confirm-dialog]'); const a = document.activeElement; return !a || a === document.body || d.contains(a) ? null : (a.textContent || a.tagName).slice(0, 30); }));
    }
    assert.deepEqual(escaped.filter(Boolean), [], 'focus left the dialog');
    await shot(`ai-confirm-${size}`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    assert.equal(await dialog().isVisible(), false); assert.equal(await aiEnabled(), true, 'Esc must keep AI on');
    await p.getByRole('button', { name: "AI'ı kapat (kill switch)" }).click();
    await dialog().getByRole('button', { name: 'Vazgeç' }).click(); await p.waitForTimeout(300);
    assert.equal(await aiEnabled(), true, 'cancel must keep AI on');
    assert.ok((await overflow()) <= 0, 'overflow on /ai ' + size);
  }
  await p.setViewportSize(sizes.d1280); await go('ai');
  await p.getByRole('button', { name: "AI'ı kapat (kill switch)" }).click();
  await dialog().getByRole('button', { name: "AI'ı kapat (kill switch)" }).click();
  await p.getByRole('button', { name: "AI'ı aç" }).waitFor();
  assert.equal(await aiEnabled(), false, 'confirm turns AI off');
  await p.getByRole('button', { name: "AI'ı aç" }).click(); await p.waitForTimeout(1200);
  assert.equal(await aiEnabled(), true, 'turn on again');
  pass('c12_t2_ai_in_app_confirm', { sizes: Object.keys(sizes), esc_cancels: true, cancel_cancels: true, confirm_applies: true, focus_trapped: true });

  // /questions: global soru silme onayı (Esc iptal, onay siler).
  for (const [size, vp] of Object.entries(sizes)) {
    await p.setViewportSize(vp); await go('questions');
    await p.locator('tr').filter({ hasText: `D11 silme onayı deneme sorusu ${tag}` }).getByRole('button', { name: 'Düzenle' }).click();
    await p.getByRole('button', { name: 'Sil', exact: true }).click();
    await dialog().getByRole('heading', { name: 'Global soruyu sil' }).waitFor();
    await shot(`questions-confirm-${size}`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    assert.equal((await svc('GET', `/question_bank?select=id&id=eq.${gq.id}`)).length, 1, 'Esc must cancel deletion');
  }
  await p.getByRole('button', { name: 'Sil', exact: true }).click();
  await dialog().getByRole('button', { name: 'Sil', exact: true }).click(); await p.waitForTimeout(1500);
  assert.equal((await svc('GET', `/question_bank?select=id&id=eq.${gq.id}`)).length, 0, 'confirm deletes');
  pass('c12_t2_questions_in_app_confirm', { esc_cancels: true, confirm_deletes: true });

  // 2) A3 P2 (B01) — /overrides denetim geçmişi: "Yapan" adı ve sayfalama.
  for (const [size, vp] of Object.entries(sizes)) {
    await p.setViewportSize(vp); await go('overrides');
    const table = p.getByTestId('override-audit'); await table.waitFor();
    await p.getByTestId('override-audit-status').getByText('Son 30 kayıt gösteriliyor.', { exact: false }).waitFor();
    const actors = await p.getByTestId('override-audit-actor').allInnerTexts();
    assert.equal(actors.length, 30);
    assert.ok(actors.every((a) => !uuidRe.test(a)), 'raw UUID in actor column');
    const kinds = new Set(actors.map((a) => a.split('\n')[0].trim()));
    for (const k of ['Siz', 'Başka yönetici', 'Sistem (otomatik)']) assert.ok(kinds.has(k), 'missing actor label ' + k);
    await table.scrollIntoViewIfNeeded(); await shot(`overrides-audit-${size}`);
    assert.ok((await overflow()) <= 0, 'overflow on /overrides ' + size);
  }
  let clicks = 0;
  while (await p.getByRole('button', { name: 'Daha eski kayıtları göster' }).isVisible()) {
    const before = await p.getByTestId('override-audit').locator('tbody tr').count();
    await p.getByRole('button', { name: 'Daha eski kayıtları göster' }).click(); clicks++;
    await p.waitForFunction((n) => document.querySelectorAll('[data-testid=override-audit] tbody tr').length > n, before);
    assert.ok(clicks < 10, 'paging loop');
  }
  await p.getByText('Daha eski kayıt yok.').waitFor();
  await p.waitForTimeout(300); const ids = await p.getByTestId('override-audit').locator('tbody tr').count();
  assert.equal(ids, auditTotal, 'all audit rows after paging');
  const reasons = await p.getByTestId('override-audit').locator('tbody tr td:nth-child(3)').allInnerTexts();
  const mine = reasons.filter((r) => r.startsWith(tag)); assert.equal(mine.length, 45, 'missing rows'); assert.equal(new Set(mine).size, 45, 'duplicate rows');
  // Kimlik yalnız açılınca görünür.
  const other1 = p.getByTestId('override-audit-actor').filter({ hasText: 'Başka yönetici' }).first();
  await other1.locator('summary').click();
  assert.match(await other1.innerText(), new RegExp(other.id));
  await shot('overrides-audit-paged-768');
  pass('b01_override_audit_actor_and_paging', { first_page: 30, total: auditTotal, more_clicks: clicks, seeded: 45, labels: ['Siz', 'Başka yönetici', 'Sistem (otomatik)'] });

  // 3) A3 P2 (B02) — kütüphane: paket adları ve soru yayımlama onayı.
  for (const [size, vp] of Object.entries(sizes)) {
    await p.setViewportSize(vp); await go('library');
    const item = p.getByRole('button', { name: collectionTitle });
    await item.click();
    await p.getByText(`Bir pastanın yarısı kaç çeyrektir? (${tag})`).waitFor();
    assert.equal(await itemStatus(), 'draft');
    await p.getByTestId('library-item-status').getByText('Taslak', { exact: true }).waitFor();
    await p.getByRole('button', { name: 'İnceledim, yayımla' }).click();
    await dialog().getByRole('heading', { name: 'Bu soru yayımlansın mı?' }).waitFor();
    await dialog().getByText(new RegExp(`«${collectionTitle}» koleksiyonu yayında\\. Soru yayımlanınca Plus, Pro paketlerindeki aileler`)).waitFor();
    await shot(`library-publish-confirm-${size}`);
    await dialog().getByRole('button', { name: 'Vazgeç' }).click(); await p.waitForTimeout(400);
    assert.equal(await itemStatus(), 'draft', 'cancel keeps draft');
    // Koleksiyon düzenleyicide paket adları (ham kod değil).
    await p.getByRole('button', { name: 'Düzenle', exact: true }).first().click();
    const legend = p.locator('fieldset').filter({ has: p.locator('legend', { hasText: 'Dahil olan paketler' }) });
    const planText = (await legend.innerText()).replace(/\s+/g, ' ');
    assert.match(planText, /Başlangıç.*Plus.*Pro/); assert.ok(!/\bfree\b|\bplus\b|\bpro\b/.test(planText), 'raw plan code ' + planText);
    await legend.scrollIntoViewIfNeeded(); await shot(`library-collection-plans-${size}`);
    await p.getByRole('button', { name: 'Vazgeç', exact: true }).first().click(); await p.waitForTimeout(300);
    assert.ok((await overflow()) <= 0, 'overflow on /library ' + size);
  }
  await p.getByRole('button', { name: 'İnceledim, yayımla' }).click();
  await dialog().getByRole('button', { name: 'İnceledim, yayımla' }).click(); await p.waitForTimeout(1500);
  assert.equal(await itemStatus(), 'published', 'confirm publishes');
  await p.getByTestId('library-item-status').getByText('Yayında', { exact: true }).waitFor();
  await p.getByRole('button', { name: 'Yayından kaldır' }).click();
  await dialog().getByRole('heading', { name: 'Soru yayından kaldırılsın mı?' }).waitFor();
  await shot('library-unpublish-confirm-768');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  assert.equal(await itemStatus(), 'published', 'Esc keeps published');
  await p.getByRole('button', { name: 'Yayından kaldır' }).click();
  await dialog().getByRole('button', { name: 'Yayından kaldır' }).click(); await p.waitForTimeout(1500);
  assert.equal(await itemStatus(), 'archived', 'confirm archives');
  pass('b02_library_plan_labels_and_publish_confirm', { cancel_keeps: 'draft', publish: 'published', unpublish: 'archived' });

  // 4) Q00-A3-4 — kenar menü: görünmeyen bölüm ipucu (D3) yeniden doğrulama, 1280×800.
  await p.setViewportSize(sizes.d1280); await go('dashboard');
  const hint = p.getByTestId('nav-more'); await hint.waitFor();
  const hintText = await hint.innerText(); assert.match(hintText, /Aşağıda \d+ bölüm daha/);
  await shot('nav-more-hint-1280');
  await hint.click(); await p.waitForTimeout(800);
  const scrolled = await p.locator('nav[aria-label="Yönetim bölümleri"]').evaluate((n) => n.scrollTop);
  assert.ok(scrolled > 0, 'hint scrolls the menu');
  pass('a3_4_sidebar_hidden_sections_hint', { hint: hintText, scrollTop: scrolled });

  // 5) Q00-A3-7 (yönetici kısmı) — açık oturumda `admins` satırı silinir: tek bildirim, menü daralır, sunucu reddeder.
  await go('families');
  await svc('DELETE', `/admins?user_id=eq.${f.userId}`);
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  await p.getByTestId('admin-revoked').waitFor();
  assert.equal(await p.getByText('Yönetici yetkiniz kaldırıldı.').count(), 1);
  const navAfter = await p.locator('nav[aria-label="Yönetim bölümleri"]').innerText().catch(() => '');
  assert.ok(!/Aileler|Erişim hakları/.test(navAfter), 'admin sections must leave the menu');
  await shot('admin-revoked-1280');
  await p.setViewportSize(sizes.t768); await p.waitForTimeout(500); await shot('admin-revoked-768');
  let refused = false; try { await asAdmin('admin_list_overrides', { p_include_inactive: true }); } catch (e) { refused = /40[13]/.test(e.message); }
  assert.ok(refused, 'server refuses with the same token');
  await svc('POST', '/admins', { user_id: f.userId });
  pass('a3_7_admin_revocation_single_notice', { notices: 1, rpc_refused: true });

  assert.equal(nativeDialogs, 0, 'native browser dialogs'); assert.deepEqual(pageErrors, [], 'page errors');
  pass('no_native_dialogs_no_page_errors', { native_dialogs: nativeDialogs, page_errors: 0 });
  await browser.close();
})().then(() => { fs.writeFileSync(path.join(out, 'ui-checks.json'), JSON.stringify({ passed: true, results }, null, 2)); console.log(JSON.stringify({ passed: true, count: results.length })); },
  (e) => { results.push({ check: 'failure', passed: false, detail: String(e.message).split('\n')[0].slice(0, 400) }); fs.writeFileSync(path.join(out, 'ui-checks.json'), JSON.stringify({ passed: false, results }, null, 2)); console.error(e); process.exit(1); });
