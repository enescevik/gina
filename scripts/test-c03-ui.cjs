const loopbackFixtureFetch = require('./loopback-fixture-fetch.cjs');
// C03 UI acceptance: return reason chosen by parent A (double tap → one request), lost-reply approval retried
// with the same request id (one result, stars once), the reason on the co-parent's home and in the child's
// next step, calendar/Prova-draft bulk selection on the preview/apply/undo/history contract, and help reply
// tracking. Only against the disposable fixture from
// `GINA_QA_UI_FIXTURE=… python3 scripts/test-isolated-services.py --run-local --with-storage --ui-hold`
// and a web export built against it (GINA_QA_DIST). Never point this at demo/production.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const dist = path.resolve(process.env.GINA_QA_DIST);
const outDir = process.cwd() + '/docs/release/c03-2026-11-06'; const out = outDir + '/screenshots'; fs.mkdirSync(out, { recursive: true });
const results = []; let stage = 'setup', browser, server;
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail ? { detail } : {}) }); console.log('PASS ' + check); };
const istanbulDay = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * 86400000));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webp': 'image/webp' };
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
  const sessionOf = async (email, password) => {
    const r = await loopbackFixtureFetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.ok(r.ok, 'login'); return r.json();
  };
  let session = await sessionOf(f.email, f.password);
  const apiAs = (token) => async (p, body, prefer, method) => {
    const res = await loopbackFixtureFetch(f.url + '/rest/v1/' + p, { method: method ?? (body ? 'POST' : 'GET'), headers: { apikey: f.anon, authorization: 'Bearer ' + token(), 'content-type': 'application/json', ...(prefer ? { prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); assert.ok(res.ok, p + ' ' + text.slice(0, 300)); return text ? JSON.parse(text) : null;
  };
  const api = apiAs(() => session.access_token);
  const rpc = (fn, args) => api('rpc/' + fn, args);
  await api(`families?id=eq.${f.familyId}`, { timezone: 'Europe/Istanbul' }, null, 'PATCH');
  const today = istanbulDay(0), tag = randomUUID().slice(0, 4);
  // The fixture's second child (no tasks yet) keeps plan limits for the first child out of the way.
  const sib = (await api(`children?id=neq.${f.childId}&archived_at=is.null&select=id,name`))[0];
  assert.ok(sib, 'fixture sibling');
  const kidId = sib.id, childName = sib.name;
  await rpc('set_child_pin', { p_child_id: kidId, p_pin: '1234' });
  const child = { name: childName };
  // Two submitted tasks for today (parent acting for the child, same RPC the child uses).
  // Earlier synthetic submissions in this disposable fixture are settled first, so the card shows only this run's work.
  for (const old of await api(`task_completions?family_id=eq.${f.familyId}&status=eq.done&select=id`)) await rpc('review_task', { p_completion_id: old.id, p_approve: true });
  // Routines from earlier runs of this script are archived (plan limit counts open routines).
  for (const old of await api(`task_templates?child_id=eq.${kidId}&archived_at=is.null&select=id,revision,title`)) if (/^(Odanı topla|Kitap oku) [0-9a-f]{4}$/.test(old.title)) await rpc('change_task_routine', { p_request_id: randomUUID(), p_id: old.id, p_revision: old.revision, p_action: 'archive' });
  const T = [randomUUID(), randomUUID()];
  await api('task_templates', [
    { id: T[0], family_id: f.familyId, child_id: kidId, title: `Odanı topla ${tag}`, stars: 2, starts_on: today },
    { id: T[1], family_id: f.familyId, child_id: kidId, title: `Kitap oku ${tag}`, stars: 3, starts_on: today },
  ]);
  for (const id of T) await rpc('complete_task', { p_template_id: id, p_due_date: today, p_client_id: randomUUID(), p_acting_child_id: kidId });
  const completion = async (id) => (await api(`task_completions?template_id=eq.${id}&due_date=eq.${today}&select=id,status,return_reason,return_note`))[0];
  // Co-parent signs up and joins with the family invite code.
  const coEmail = `gina-${randomUUID()}@example.invalid`, coPassword = randomBytes(18).toString('base64url');
  const signup = await loopbackFixtureFetch(f.url + '/auth/v1/signup', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: coEmail, password: coPassword }) });
  assert.ok(signup.ok, 'co-parent signup');
  let coSession = await sessionOf(coEmail, coPassword);
  const invite = (await api(`families?id=eq.${f.familyId}&select=invite_code`))[0].invite_code;
  await apiAs(() => coSession.access_token)('rpc/join_family', { p_invite_code: invite, p_display_name: 'Synthetic co-parent' });
  // Calendar entries for the bulk sheet.
  const E = [randomUUID(), randomUUID()];
  const at = (h) => new Date(`${istanbulDay(1)}T${String(h).padStart(2, '0')}:00:00+03:00`).toISOString();
  await api('events', [
    { id: E[0], family_id: f.familyId, child_id: kidId, type: 'activity', title: `Yüzme ${tag}`, starts_at: at(15), rrule: null },
    { id: E[1], family_id: f.familyId, child_id: kidId, type: 'activity', title: `Satranç ${tag}`, starts_at: at(17), rrule: 'FREQ=WEEKLY' },
  ]);

  server = await serve(); const web = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const newContext = async (viewport) => {
    const c = await browser.newContext({ viewport, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
    await c.route(f.url + '/**', async (route) => { try { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); const res = await route.fetch({ maxRedirects: 0 }); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } }); } catch { await route.fulfill({ status: 503, body: 'Local fixture unavailable' }); } });
    const page = await c.newPage(); page.setDefaultTimeout(25000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    return { c, page, errors };
  };
  async function loginOn(page, email, password) {
    await page.goto(web);
    await page.getByLabel('E-posta', { exact: true }).fill(email);
    await page.getByLabel('Şifre', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
    await page.waitForURL('**/parent');
  }
  async function shot(page, name) {
    await page.waitForFunction(() => !document.querySelector('[role=progressbar]')).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow: ' + name);
    const body = await page.locator('body').innerText();
    assert.ok(!/\bc03\.|bulkArchive\.|childMint\.|parentHome\./.test(body), 'translations resolved: ' + name);
  }

  // ---- Parent A (phone): return with a reason; double tap sends one request.
  stage = 'return_reason_phone';
  const A = await newContext({ width: 390, height: 844 });
  const reviewBodies = [];
  A.page.on('request', (r) => { if (r.url().includes('/rpc/review_task_once') && r.method() === 'POST') reviewBodies.push(JSON.parse(r.postData() || '{}')); });
  await loginOn(A.page, f.email, f.password);
  const card = A.page.getByTestId('home-approvals');
  await card.getByText(`Odanı topla ${tag}`, { exact: true }).waitFor();
  const item = card.locator('div').filter({ hasText: `Odanı topla ${tag}` }).filter({ has: A.page.getByRole('button', { name: 'Geri gönder', exact: true }) }).last();
  await item.getByRole('button', { name: 'Geri gönder', exact: true }).click();
  const sheet = A.page.getByTestId('return-reason-sheet');
  await sheet.waitFor();
  await A.page.getByTestId('return-reason-other').click();
  await shot(A.page, 'return-sheet-phone');
  const send = A.page.getByRole('button', { name: 'Geri gönder', exact: true }).last();
  await send.click();
  await A.page.getByText('“Başka bir neden” için kısa bir not yaz.', { exact: true }).waitFor();
  pass('other_reason_requires_note');
  await A.page.getByTestId('return-reason-missing_part').click();
  await A.page.getByTestId('return-reason-note').fill('Yatağı da topla');
  await send.dblclick();
  for (let i = 0; i < 40 && (await completion(T[0])).status !== 'returned'; i++) await A.page.waitForTimeout(250);
  const returned = await completion(T[0]);
  assert.equal(returned.status, 'returned'); assert.equal(returned.return_reason, 'missing_part'); assert.equal(returned.return_note, 'Yatağı da topla');
  await A.page.waitForTimeout(800);
  assert.equal(reviewBodies.length, 1, 'double tap → one review request');
  assert.equal(reviewBodies[0].p_return_reason, 'missing_part');
  await sheet.waitFor({ state: 'hidden' });
  await card.getByText(`Odanı topla ${tag}`, { exact: true }).waitFor({ state: 'hidden' });
  pass('return_reason_saved_once_card_leaves_pending', { requests: reviewBodies.length });
  await A.page.getByTestId('home-task-return-reason').first().waitFor();
  assert.match(await A.page.getByTestId('home-task-return-reason').first().innerText(), /Bir parçası eksik · “Yatağı da topla”/);
  await shot(A.page, 'home-returned-reason-phone');
  pass('parent_home_shows_reason');

  // ---- Lost reply on approve: server applies, client sees 503; retry reuses the request id → one result.
  stage = 'lost_reply_approve';
  let dropped = false;
  await A.page.route('**/rest/v1/rpc/review_task_once', async (route) => {
    if (dropped) return route.fallback();
    dropped = true; const res = await route.fetch({ maxRedirects: 0 }); assert.ok(res.ok, 'server applied the first request');
    await route.fulfill({ status: 503, body: 'synthetic lost reply', headers: { 'access-control-allow-origin': '*' } });
  });
  const second = card.locator('div').filter({ hasText: `Kitap oku ${tag}` }).filter({ has: A.page.getByRole('button', { name: 'Onayla', exact: true }) }).last();
  await second.getByRole('button', { name: 'Onayla', exact: true }).click();
  // The reply is lost, but the settled refetch reconciles with the server: the approved task leaves "waiting"
  // without a second request, and the server holds exactly one approval and one star entry.
  await card.getByText(`Kitap oku ${tag}`, { exact: true }).waitFor({ state: 'hidden' });
  await shot(A.page, 'approve-lost-reply-reconciled-phone');
  const approvals = reviewBodies.filter((b) => b.p_approve === true);
  assert.equal(approvals.length, 1, 'no blind second submission');
  const c2 = await completion(T[1]);
  const stars = await api(`star_events?completion_id=eq.${c2.id}&select=delta`);
  assert.equal(c2.status, 'approved'); assert.equal(stars.length, 1);
  // A replay of the same request id (what a manual retry sends) returns the stored receipt, not a second approval.
  const replay = await rpc('review_task_once', approvals[0]).catch((e) => String(e));
  assert.ok(typeof replay === 'string' ? /request_conflict|forbidden/.test(replay) : replay.status === 'approved');
  assert.equal((await api(`star_events?completion_id=eq.${c2.id}&select=delta`)).length, 1);
  pass('lost_reply_retry_single_approval_and_stars', { stars: stars[0].delta });
  await A.page.unroute('**/rest/v1/rpc/review_task_once');

  // ---- Co-parent (tablet): same reason, no private note from elsewhere.
  stage = 'co_parent_tablet';
  const B = await newContext({ width: 768, height: 1024 });
  await loginOn(B.page, coEmail, coPassword);
  await B.page.getByTestId('home-task-return-reason').first().waitFor();
  assert.match(await B.page.getByTestId('home-task-return-reason').first().innerText(), /Bir parçası eksik · “Yatağı da topla”/);
  await shot(B.page, 'coparent-home-reason-tablet');
  pass('co_parent_sees_same_reason');

  // ---- Child (parent phone in child mode; same components as the paired tablet): calm next step.
  stage = 'child_next_step';
  const C = await newContext({ width: 1280, height: 800 });
  await loginOn(C.page, f.email, f.password);
  await C.page.goto(`${web}/parent/child-mode`);
  await C.page.getByRole('button', { name: child.name, exact: true }).click();
  await C.page.getByLabel('Çocuk PIN’i', { exact: true }).fill('1234');
  await C.page.getByRole('button', { name: 'Dünyama gir', exact: true }).click();
  await C.page.waitForURL('**/parent/child-mode/today');
  await C.page.getByTestId('child-return-next').first().waitFor();
  const childText = await C.page.getByTestId('child-return-next').first().innerText();
  assert.match(childText, /Eksik kalan parçayı tamamla, sonra yeniden gönder\./); assert.match(childText, /Velinin notu: “Yatağı da topla”/);
  await shot(C.page, 'child-return-next-desktop');
  await C.page.setViewportSize({ width: 390, height: 844 });
  await shot(C.page, 'child-return-next-phone');
  pass('child_sees_reason_as_next_step');
  await C.page.goto(`${web}/parent/child-mode/week`);
  await C.page.getByTestId('week-return-next').first().waitFor();
  await shot(C.page, 'child-week-return-next-phone');
  pass('child_week_shows_next_step');

  // ---- Calendar bulk (desktop): pick listed → archive → undo; counts and history match the server.
  stage = 'calendar_bulk';
  const D = await newContext({ width: 1280, height: 800 });
  await loginOn(D.page, f.email, f.password);
  await D.page.goto(`${web}/parent/calendar?childId=${kidId}&date=${today}`);
  const panel = D.page.getByTestId('planner-bulk-actions');
  await panel.waitFor();
  await panel.getByRole('button', { name: 'Toplu arşivle', exact: true }).first().click();
  const bulk = D.page.getByTestId('bulk-scope-event');
  await bulk.getByText(`Yüzme ${tag}`, { exact: true }).waitFor();
  const listed = await bulk.getByRole('checkbox').count();
  await D.page.getByRole('button', { name: new RegExp(`^Listelenen ${listed} kaydı seç$`) }).click();
  await shot(D.page, 'calendar-bulk-preview-desktop');
  await D.page.getByRole('button', { name: 'Seçilenleri arşivle', exact: true }).dblclick();
  await bulk.getByTestId('bulk-scope-result').waitFor();
  assert.match(await bulk.getByTestId('bulk-scope-result').innerText(), new RegExp(`${listed} kayıt arşivlendi`));
  const archivedNow = await apiAs(() => coSession.access_token)(`events?id=in.(${E.join(',')})&select=id`);
  assert.equal(archivedNow.length, 0, 'archived events hidden for the co-parent');
  await shot(D.page, 'calendar-bulk-result-desktop');
  await D.page.getByRole('button', { name: 'Bu işlemi geri al', exact: true }).click();
  await bulk.getByTestId('bulk-scope-undone').waitFor();
  const back = await api(`events?id=in.(${E.join(',')})&select=id`);
  assert.equal(back.length, 2, 'undo restores both');
  const history = await rpc('bulk_archive_history', {});
  const last2 = history.slice(0, 2).map((h) => `${h.operation}:${h.summary.ok}`);
  assert.deepEqual(last2.sort(), [`archive:${listed}`, `restore:${listed}`].sort());
  assert.equal(history.filter((h) => h.operation === 'archive' && h.created_at >= history[1].created_at).length, 1, 'double click → one archive run');
  await bulk.getByTestId('bulk-scope-history').getByText(/Geri alma · \d+ başarılı/).first().waitFor();
  await shot(D.page, 'calendar-bulk-undone-desktop');
  pass('calendar_bulk_archive_undo_counts_history', { listed, history: last2 });
  await D.page.getByRole('button', { name: 'Tamam', exact: true }).click();
  await D.page.setViewportSize({ width: 390, height: 844 });
  await shot(D.page, 'calendar-bulk-entry-phone');

  // ---- Prova drafts: the assigned draft is listed as protected and cannot be selected.
  stage = 'prova_draft_bulk';
  await D.page.setViewportSize({ width: 768, height: 1024 });
  await D.page.goto(`${web}/parent/prova`);
  await D.page.getByTestId('prova-draft-bulk').getByRole('button', { name: 'Toplu arşivle', exact: true }).click();
  const pbulk = D.page.getByTestId('bulk-scope-prova_draft');
  await pbulk.waitFor();
  await D.page.waitForTimeout(1500);
  const ptext = await pbulk.innerText();
  if (ptext.includes('Sınav olarak atanmış')) {
    const box = pbulk.getByRole('checkbox', { name: /Sınav olarak atanmış/ }).first();
    assert.equal(await box.getAttribute('aria-disabled'), 'true');
  }
  await shot(D.page, 'prova-draft-bulk-tablet');
  pass('prova_draft_bulk_assigned_protected', { assignedListed: ptext.includes('Sınav olarak atanmış') });
  await D.page.getByRole('button', { name: 'Vazgeç', exact: true }).last().click().catch(() => {});

  // ---- Help: a family reply shows as new until opened; team notes never count.
  stage = 'help_reply_tracking';
  const ticket = await rpc('create_help_ticket', { p_request_id: randomUUID(), p_kind: 'support', p_category: 'device', p_subject: `Tablet ${tag}`, p_body: 'Sentetik test talebi.' });
  // The fixture parent also holds the synthetic admin role (operator path); the reply is family-visible.
  await rpc('reply_help_ticket', { p_request_id: randomUUID(), p_ticket_id: ticket.id, p_revision: 1, p_body: 'Ekip içi not', p_internal: true });
  await rpc('reply_help_ticket', { p_request_id: randomUUID(), p_ticket_id: ticket.id, p_revision: 2, p_body: 'Uygulamayı güncelleyip yeniden dener misiniz?', p_internal: false, p_status: 'waiting_parent' });
  const H = await newContext({ width: 390, height: 844 });
  await loginOn(H.page, coEmail, coPassword);
  await H.page.goto(`${web}/parent/help`);
  await H.page.getByText('Taleplerim', { exact: true }).first().click();
  await H.page.getByTestId('help-new-reply-' + ticket.id).waitFor();
  await shot(H.page, 'help-new-reply-phone');
  await H.page.getByText(`Tablet ${tag}`, { exact: true }).click();
  await H.page.getByText('Uygulamayı güncelleyip yeniden dener misiniz?', { exact: true }).waitFor();
  assert.ok(!(await H.page.locator('body').innerText()).includes('Ekip içi not'), 'team note never shown');
  await H.page.getByTestId('help-new-reply-' + ticket.id).waitFor({ state: 'hidden', timeout: 15000 });
  await shot(H.page, 'help-thread-read-phone');
  pass('help_reply_marked_read_team_note_hidden');

  for (const ctx of [A, B, C, D, H]) assert.deepEqual(ctx.errors, [], 'no page errors');
  pass('layouts_390_768_1280_no_overflow_no_raw_keys');
  fs.writeFileSync(outDir + '/ui-checks.json', JSON.stringify({ environment: 'disposable-local-auth-postgrest-storage-edge + expo web export (Chrome, tr-TR, Europe/Istanbul)', today, checks: results }, null, 2) + '\n');
} catch (error) {
  console.error('FAIL at ' + stage + ': ' + (error && error.message ? error.message.split('\n').slice(0, 6).join('\n') : error));
  results.push({ check: stage, passed: false });
  try { let i = 0; for (const c of browser?.contexts() ?? []) for (const pg of c.pages()) { await pg.screenshot({ path: `/private/tmp/claude-501/-Users-enes-Documents-projs-gina/a5b0ecd0-69be-468e-8313-1746143753e5/scratchpad/c03/fail-${i}.png` }); fs.writeFileSync(`/private/tmp/claude-501/-Users-enes-Documents-projs-gina/a5b0ecd0-69be-468e-8313-1746143753e5/scratchpad/c03/fail-${i++}.txt`, await pg.locator('body').innerText()); } } catch {}
  fs.writeFileSync(outDir + '/ui-checks-failed.json', JSON.stringify({ checks: results }, null, 2) + '\n');
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) server.close();
}
})();
