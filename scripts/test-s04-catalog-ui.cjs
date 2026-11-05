// S04 yönetim ekranları: hazır ders seçenekleri/eşanlamlılar ve kaynaklı takvim taslağı içe aktarma.
// Yalnız test-isolated-services.py --run-local --ui-hold geçici fixture'ıyla ve yerel backoffice export'uyla çalışır.
// Fixture: GINA_QA_UI_FIXTURE; backoffice: GINA_QA_BACKOFFICE (varsayılan http://127.0.0.1:3194).
// Playwright: GINA_QA_PLAYWRIGHT_PATH. Çıktı: docs/release/s04-catalog-2026-11-06/ui/.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE || '/tmp/gina-experience-ui-private.json'));
assert.equal(new URL(f.url).hostname, '127.0.0.1');
assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const web = process.env.GINA_QA_BACKOFFICE || 'http://127.0.0.1:3194';
assert.equal(new URL(web).hostname, '127.0.0.1');
const out = process.cwd() + '/docs/release/s04-catalog-2026-11-06/ui';
fs.mkdirSync(out, { recursive: true });
const results = [];
let browser, p, stage = 'setup';
(async () => {
  const login = await fetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
  assert.equal(login.status, 200);
  const session = await login.json();
  async function api(path, body) {
    const r = await fetch(f.url + '/rest/v1/' + path, { method: body ? 'POST' : 'GET', headers: { apikey: f.anon, authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.ok(r.ok, 'local_api_failed ' + path + ' ' + (r.ok ? '' : await r.text()));
    return r.status === 204 ? null : r.json();
  }
  const before = await api('rpc/admin_education_calendars', {});
  assert.equal(before.calendars.length, 0, 'disposable DB starts without calendars');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'tr-TR' });
  await c.route(f.url + '/**', async r => {
    try {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const x = await r.fetch();
      await r.fulfill({ response: x, headers: { ...x.headers(), 'access-control-allow-origin': '*' } });
    } catch { await r.fulfill({ status: 503, body: 'Local service unavailable' }); }
  });
  p = await c.newPage();
  p.setDefaultTimeout(20000);
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  async function shot(name, full = false) {
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/${name}.png`, fullPage: full });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow: ' + name);
  }
  const body = () => p.locator('body').innerText();

  stage = 'login';
  await p.goto(web + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.email);
  await p.getByLabel('Şifre', { exact: true }).fill(f.password);
  await p.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await p.waitForURL('**/dashboard');

  stage = 'input_catalog';
  await p.goto(web + '/input-catalog');
  await p.getByRole('combobox', { name: 'Tür' }).selectOption('subject');
  await p.getByRole('heading', { name: 'Almanca', exact: true }).waitFor();
  await p.getByText('Eşanlamlılar (', { exact: false }).first().waitFor();
  const subjectCards = await p.getByRole('button', { name: /seçeneğini düzenle$/ }).count();
  assert.equal(subjectCards, 32, '32 subject ids listed');
  for (const label of ['Din Kültürü ve Ahlak Bilgisi', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Seçmeli ders (diğer)', 'Matematik'])
    await p.getByRole('heading', { name: label, exact: true }).waitFor();
  results.push({ check: 'input_catalog_lists_32_subjects_with_synonyms', passed: true });
  await shot('input-catalog-subjects-1280x800');
  await shot('input-catalog-subjects-full', true);

  stage = 'subject_tester';
  await p.getByLabel('Yazılan ders adı', { exact: true }).fill('Fen');
  await p.getByRole('combobox', { name: /Çocuğun sınıfı/ }).selectOption('10');
  await p.getByRole('button', { name: 'Önerileri göster', exact: true }).click();
  await p.getByText('3 aday — veliye seçtirilir.', { exact: true }).waitFor();
  for (const label of ['Fizik', 'Kimya', 'Biyoloji']) assert.ok((await body()).includes(label));
  await p.getByRole('region', { name: 'Ders eşleştirme denemesi' }).scrollIntoViewIfNeeded();
  await shot('input-catalog-match-fen-grade10-1280x800');
  await p.getByLabel('Yazılan ders adı', { exact: true }).fill('MAT');
  await p.getByRole('combobox', { name: /Çocuğun sınıfı/ }).selectOption('6');
  await p.getByRole('button', { name: 'Önerileri göster', exact: true }).click();
  await p.getByText('Tek aday — veliye öneri olarak gösterilir, onayı beklenir.', { exact: true }).waitFor();
  results.push({ check: 'match_tester_ambiguous_and_single_both_need_confirmation', passed: true });

  stage = 'calendar_preview';
  await p.goto(web + '/education-calendars');
  await p.getByRole('button', { name: 'Taslak içe aktar (kaynaklı)', exact: true }).click();
  await p.getByRole('button', { name: 'Önizle', exact: true }).click();
  await p.getByText('Oluşturulacak taslak', { exact: true }).waitFor();
  const preview = await body();
  assert.ok(preview.includes('atlandı — Kaynak güveni düşük; il MEM teyidi bekliyor'), 'Düzce skip shown');
  assert.ok(preview.includes('Düzce'));
  assert.ok(preview.includes('Kaynaklar (14)'));
  assert.equal((await api('rpc/admin_education_calendars', {})).calendars.length, 0, 'preview wrote nothing');
  results.push({ check: 'preview_shows_counts_skips_and_sources_without_writing', passed: true });
  await shot('education-calendars-import-preview-1280x800');
  await shot('education-calendars-import-preview-full', true);

  stage = 'calendar_execute';
  const create = p.getByRole('button', { name: '20 taslağı oluştur (yayımlamaz)', exact: true });
  assert.equal(await create.isDisabled(), true, 'confirmation required');
  await p.getByRole('checkbox', { name: /Kaynakları kontrol ettim/ }).check();
  await create.click();
  await p.getByText(/20 taslak oluşturuldu, hiçbiri yayımlanmadı\./).waitFor();
  const after = await api('rpc/admin_education_calendars', {});
  assert.equal(after.calendars.length, 20);
  assert.equal(after.calendars.filter(x => x.published !== null).length, 0, 'nothing published');
  assert.equal(after.places.filter(x => x.kind === 'region' && x.active).length, 0, 'new regions hidden');
  assert.ok(after.calendars.every(x => /^https:\/\//.test(x.draft.source_url) && x.draft.verified_on === '2026-11-05' && x.draft.terms.length === 4));
  results.push({ check: 'confirmed_import_creates_20_unpublished_drafts_with_sources', passed: true });
  await shot('education-calendars-import-done-1280x800');

  stage = 'calendar_list';
  await p.getByRole('button', { name: 'Takvimler', exact: true }).click();
  await p.getByRole('heading', { name: 'Doğrulanmış eğitim takvimleri' }).waitFor();
  assert.ok(!(await body()).includes('Yayında'), 'no calendar shown as live');
  await shot('education-calendars-drafts-1280x800');

  stage = 'calendar_rerun';
  await p.getByRole('button', { name: 'Taslak içe aktar (kaynaklı)', exact: true }).click();
  await p.getByRole('button', { name: 'Önizle', exact: true }).click();
  await p.getByText('Oluşturulacak yeni taslak yok. Var olan kayıtlar değiştirilmez.', { exact: true }).waitFor();
  results.push({ check: 'second_preview_is_idempotent', passed: true });

  assert.deepEqual(errors, []);
  results.push({ check: 'no_page_exceptions_or_horizontal_overflow', passed: true });
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-real-services', viewport: '1280x800', results }, null, 2) + '\n');
  console.log(JSON.stringify(results));
  await browser.close();
})().catch(async e => {
  console.log('CHECK_FAILED ' + stage + ' ' + String(e.message).slice(0, 600));
  if (p) await p.screenshot({ path: out + '/../ui-failure.png' }).catch(() => {});
  if (browser) await browser.close();
  process.exitCode = 1;
});
