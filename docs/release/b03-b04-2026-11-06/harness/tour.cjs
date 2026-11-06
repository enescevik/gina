// B03/B04 UI tour against the disposable gina_b34_* services. Synthetic data only; nothing is sent.
const fs = require('node:fs'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.B34_WORK + '/fixture.json'));
assert.match(f.db, /^gina_b34_[0-9a-f]+_audit$/); assert.equal(new URL(f.url).hostname, '127.0.0.1');
const outDir = process.env.SHOT_DIR; fs.mkdirSync(outDir, { recursive: true });
const GROUP = 'b3450000-0000-4000-8000-000000000001', T1 = 'b3420000-0000-4000-8000-000000000001';
const sql = (q) => execFileSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', f.db, '-v', 'ON_ERROR_STOP=1'], { input: q }).toString().trim();
const results = [];
let browser;
async function session(who) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage(); p.setDefaultTimeout(20000);
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
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
  try { const detail = await fn(); results.push({ check: name, passed: true, ...(detail ? { detail } : {}) }); console.log('PASS', name, detail ?? ''); }
  catch (e) { results.push({ check: name, passed: false, error: String(e.message || e).slice(0, 400) }); console.log('FAIL', name, String(e.message || e).slice(0, 400)); }
}
const parentThread = (user, family) => sql(`begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated","gina":{"family_id":"${family}","role":"parent"}}',true); select public.get_help_ticket('${T1}')::text; commit;`).split('\n').filter(l => l.startsWith('{')).join('');

(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const admin = await session('admin');

  await check('cohort_queue_filled_next_unreviewed_and_appeal', async () => {
    await admin.goto(f.app + '/cohort-review?group=' + GROUP);
    const next = admin.getByTestId('cohort-next-unreviewed'); await next.waitFor();
    await admin.getByText('Prova aşamaları', { exact: false }).first().waitFor().catch(() => {});
    await both(admin, '01-cohort-queue');
    await next.click(); await admin.waitForTimeout(800);
    const body1 = await admin.locator('main').innerText();
    await shot(admin, '02-cohort-next-unreviewed-1280');
    await admin.getByTestId('cohort-next-appeal').click(); await admin.waitForTimeout(800);
    const body2 = await admin.locator('main').innerText();
    assert.match(body2, /İtiraz açık/);
    await both(admin, '03-cohort-next-appeal');
    return { unreviewedView: /İnceleme bekliyor|Okunamadı/.test(body1), appealVisible: true };
  });
  await check('cohort_unreadable_not_zero_and_not_ranked', async () => {
    let seen = false;
    for (let i = 0; i < 4 && !seen; i++) {
      await admin.getByTestId('cohort-next-unreviewed').click(); await admin.waitForTimeout(700);
      seen = /Okunamadı — puan verilmedi/.test(await admin.locator('main').innerText());
    }
    assert.ok(seen, 'unreadable label not reached via next-unreviewed queue');
    const text = await admin.locator('main').innerText();
    assert.match(text, /boş veya sıfır sayılmaz/);
    assert.match(text, /Sıralama · isteğe bağlı/);
    await both(admin, '04-cohort-unreadable');
    return 'unreadable labelled, still in review queue; ranking card optional';
  });
  await check('cohort_search', async () => {
    const s = admin.getByTestId('cohort-search');
    await s.fill('zzzz-yok'); await admin.waitForTimeout(400);
    const t = await admin.locator('main').innerText();
    assert.match(t, /0 \/ 4 kayıt/);
    await s.fill(''); return '0 / 4 for a non-matching alias';
  });
  await check('groups_preview_and_phases', async () => {
    await admin.goto(f.app + '/groups');
    await admin.getByText('Birlikte Prova · 5. sınıf geometri').first().waitFor();
    const phases = admin.getByText('Aşamalar ve sıralama').first();
    if (await phases.count()) { await phases.click(); await admin.waitForTimeout(800); }
    const t = await admin.locator('main').innerText();
    assert.match(t, /Katılım penceresi/); assert.match(t, /Çocuğun süresi/);
    assert.ok(!/\b(free|plus|pro)\b/.test(t.replace(/Plus|Pro/g, '')), 'raw plan code visible');
    await both(admin, '05-groups-phases');
    return 'phases separate; plan labels readable';
  });

  await check('help_article_draft_vs_live_and_device_preview', async () => {
    await admin.goto(f.app + '/help-articles');
    await admin.getByRole('button', { name: /Paketim görünmüyor/ }).first().click();
    await admin.getByRole('tab', { name: 'Önizleme' }).click();
    const live = admin.getByTestId('help-article-live'), draft = admin.getByTestId('help-article-draft');
    await live.waitFor(); await draft.waitFor();
    const lt = await live.innerText(), dt = await draft.innerText();
    assert.match(lt, /Satın alımı yapan hesapla/); assert.ok(!/TASLAK/.test(lt), 'draft text leaked into live');
    assert.match(dt, /TASLAK/);
    await admin.getByTestId('help-device-preview').waitFor();
    await both(admin, '06-help-article-draft-live');
    return 'live v1 unchanged while draft v2 differs';
  });
  await check('announcement_channel_readiness_and_preview', async () => {
    await admin.goto(f.app + '/announcements');
    const ready = admin.getByTestId('channel-readiness'); await ready.waitFor();
    await ready.getByText('SMS', { exact: true }).first().waitFor();
    const rt = await ready.innerText();
    assert.match(rt, /E-posta/); assert.match(rt, /SMS/);
    await shot(admin, '07-announcements-readiness-1280');
    await admin.getByRole('button', { name: 'Düzenle / önizle' }).first().click();
    await admin.getByRole('button', { name: '2. Alıcıları önizle' }).click();
    const pv = admin.getByTestId('announcement-channel-preview'); await pv.waitFor();
    const pt = await pv.innerText();
    assert.match(pt, /Uygun: \d+ veli · Engelli: \d+ veli/); assert.match(pt, /Kanal hazır değil/);
    assert.match(await admin.locator('main').innerText(), /kabulü teslim veya okundu/);
    await both(admin, '08-announcement-channel-preview');
    assert.equal(sql("select count(*) from gina.channel_outbox"), '0'); assert.equal(sql("select status from gina.parent_announcements where id='b3440000-0000-4000-8000-000000000001'"), 'draft');
    return { readiness: rt.replace(/\s+/g, ' ').slice(0, 300), preview: pt.replace(/\s+/g, ' ').slice(0, 300) };
  });
  await check('notifications_event_first_receipt_second', async () => {
    await admin.goto(f.app + '/notifications');
    const ev = admin.getByTestId('push-event').first(); await ev.waitFor();
    const summary = admin.locator('summary', { hasText: 'Teknik makbuz' }).first();
    assert.equal(await summary.count(), 1);
    assert.equal(await summary.evaluate(s => s.parentElement.open), false);
    await both(admin, '09-notifications');
    return 'event + fix shown, receipt collapsed';
  });

  const sup = await session('support');
  await check('support_queue_waiting_and_unassigned', async () => {
    await sup.goto(f.app + '/support');
    const row = sup.getByRole('button', { name: /Plus paketim görünmüyor/ });
    await row.waitFor();
    const t = await row.innerText();
    assert.match(t, /Veli 26 sa bekliyor/); assert.match(t, /Sorumlusuz/);
    await both(sup, '10-support-queue');
    return t.replace(/\s+/g, ' ');
  });
  await check('support_assign_to_me_keeps_draft', async () => {
    await sup.getByRole('button', { name: /Plus paketim görünmüyor/ }).click();
    await sup.getByTestId('support-ops').waitFor();
    await sup.locator('#support-body').fill('Taslak yanıt B34');
    await sup.getByTestId('support-assign-me').click();
    await sup.getByText('Görüşme size atandı.').waitFor();
    assert.equal(await sup.locator('#support-body').inputValue(), 'Taslak yanıt B34');
    assert.equal(await sup.getByText('Bu taslağı yazarken görüşme değişti').count(), 0);
    await sup.getByRole('button', { name: /Plus paketim görünmüyor/ }).getByText('Sorumlu: siz').waitFor();
    await both(sup, '11-support-assigned');
    assert.equal(sql(`select gina.operator_label(assignee_id) from public.help_tickets where id='${T1}'`), 'Selin (destek)');
    return 'assigned, draft intact and not stale';
  });
  await check('support_canned_and_related_article_use_live_text', async () => {
    await sup.locator('#support-body').fill('');
    await sup.getByText('Hazır yanıt ekle').click();
    await sup.getByRole('button', { name: 'Aldık, bakıyoruz' }).click();
    await sup.getByText(/İlgili yardım yazısı/).click();
    await sup.getByTestId('support-helpers').getByRole('button', { name: 'Paketim görünmüyor' }).click();
    const v = await sup.locator('#support-body').inputValue();
    assert.match(v, /mesajınızı aldık/); assert.match(v, /Satın alımı yapan hesapla/); assert.ok(!/TASLAK/.test(v));
    await shot(sup, '12-support-canned-related-1280', true);
    return 'canned + live article inserted into this draft only';
  });
  await check('support_draft_not_carried_to_other_conversation', async () => {
    await sup.getByRole('button', { name: 'Tümü', exact: true }).click();
    await sup.getByRole('button', { name: /Tablet eşleştirme kodu/ }).click();
    await sup.getByText('Yazdığınız metin henüz gönderilmedi.').waitFor();
    await shot(sup, '13-support-leave-guard-1280');
    await sup.getByRole('button', { name: 'Taslağı bırak ve ayrıl' }).click();
    await sup.getByRole('heading', { name: /Tablet eşleştirme kodu/ }).waitFor();
    assert.equal(await sup.locator('#support-body').inputValue(), '');
    return 'other conversation opens with an empty draft';
  });
  await check('support_team_note_hidden_from_family', async () => {
    await sup.getByRole('button', { name: /Plus paketim görünmüyor/ }).click();
    await sup.getByRole('tab', { name: 'Ekip notu' }).click();
    await sup.locator('#support-body').fill('Gizli ekip notu B34: makbuz finans kontrolünde');
    await sup.getByRole('button', { name: 'Ekip notunu kaydet' }).click();
    await sup.getByText('Kaydedildi.').waitFor();
    await sup.getByText('Gizli ekip notu B34').first().waitFor();
    const family = parentThread(f.users.p1, 'b3400000-0000-4000-8000-000000000001');
    assert.ok(family.includes('Hâlâ görünmüyor'), 'family thread not read');
    assert.ok(!family.includes('Gizli ekip notu') && !family.includes('Mağaza makbuzu eksik') && !family.includes('assignee'), 'team note or assignee reached family');
    await both(sup, '14-support-team-note');
    return 'operator sees note; parent RPC output has no internal note/assignee';
  });
  await check('support_search_reaches_team_notes', async () => {
    await sup.getByTestId('support-search').fill('finans kontrolünde');
    await sup.getByText('Mesajda eşleşti').first().waitFor();
    const n = await sup.locator('.support-ticket').count();
    assert.equal(n, 1);
    await shot(sup, '15-support-search-1280');
    await sup.getByTestId('support-search').fill('');
    return 'one ticket matched by internal note text';
  });
  await check('ideas_stage_and_similar_link', async () => {
    await sup.goto(f.app + '/ideas');
    await sup.getByRole('button', { name: /Matematik oyunu eklenebilir mi/ }).click();
    await sup.getByTestId('idea-controls').waitFor();
    await sup.getByTestId('idea-similar').getByRole('button', { name: 'Bununla bağla' }).first().click();
    await sup.getByText('Benzer fikir olarak bağlandı.').waitFor();
    await sup.getByTestId('idea-stage').selectOption('planned');
    await sup.getByText('Fikir durumu kaydedildi.').waitFor();
    assert.equal(sql("select idea_stage||':'||(similar_to is not null) from public.help_tickets where id='b3420000-0000-4000-8000-000000000004'"), 'planned:true');
    assert.equal(sql("select count(*) from public.help_tickets where kind='idea'"), '3');
    await both(sup, '16-ideas-stage-similar');
    return 'planned + linked; support tickets untouched';
  });

  const errors = [...admin.errors, ...sup.errors];
  results.push({ check: 'no_page_errors', passed: errors.length === 0, ...(errors.length ? { error: errors.slice(0, 5) } : {}) });
  await browser.close();
  fs.writeFileSync(process.env.SHOT_DIR + '/ui-checks.json', JSON.stringify({ db_prefix: 'gina_b34_', viewport: ['1280x800', '768x1024'], results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.filter(r => r.passed).length, total: results.length }));
})().catch(async e => { console.error('FATAL', e.message); try { await browser?.close(); } catch {} process.exit(1); });
