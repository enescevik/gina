// C10 UI + channel chain against a disposable local Auth/REST/Edge fixture (synthetic data only).
// Usage: GINA_QA_UI_FIXTURE=<fixture.json> GINA_QA_WEB=http://127.0.0.1:<port> GINA_QA_WEB_BACKEND=<placeholder url baked into export>
//        GINA_QA_WEB_ANON=<placeholder anon> GINA_QA_PLAYWRIGHT_PATH=<playwright> node scripts/test-c10-channels-ui.cjs
// Email goes through the real worker pieces into a loopback STARTTLS fake (scripts/c10-channel-drain.ts); nothing leaves 127.0.0.1.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
const WEB = process.env.GINA_QA_WEB; assert.equal(new URL(WEB).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const root = path.resolve(__dirname, '..');
const out = root + '/docs/release/c10-2026-11-06/ui'; fs.mkdirSync(out + '/screenshots', { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const t = (key, vars = {}) => { let s = tr[key]; assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const results = []; const pass = (check, detail) => { results.push({ check, passed: true, ...(detail === undefined ? {} : { detail }) }); console.error('ok ' + check); };
let browser, stage = 'setup';

const psqlAs = (user, db, text) => execFileSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8' }).trim();
const candidates = psqlAs('postgres', 'postgres', "select datname from pg_database where datname ~ '^gina_http_[0-9a-f]+_audit$';").split('\n').filter(Boolean);
const db = candidates.find((name) => psqlAs('postgres', name, `select count(*) from auth.users where id='${f.userId}';`) === '1');
assert.ok(db, 'fixture database not found');
const sql = (text) => psqlAs('postgres', db, text);
const ONE_CLICK = f.url + '/functions/v1/channel-unsubscribe';
const PAGE = WEB + '/unsubscribe', CONFIRM = WEB + '/verify-contact';
function drain() {
  const raw = execFileSync(process.env.GINA_QA_DENO_PATH || 'deno', ['run', '--cached-only', '--config', 'supabase/functions/deno.json', '--allow-net=127.0.0.1', '--allow-run=docker,openssl', '--allow-read', '--allow-write', '--allow-env',
    'scripts/c10-channel-drain.ts', db, CONFIRM, ONE_CLICK, PAGE], { cwd: root, encoding: 'utf8', timeout: 120000 });
  return JSON.parse(raw.trim().split('\n').pop());
}
async function rpc(name, args, token) {
  const res = await fetch(f.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: f.anon, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function publish(token, title) {
  const id = crypto.randomUUID();
  const value = { title, body: 'Sentetik okul duyurusu: veli toplantısı takvimi güncellendi.', push: true, expires_on: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), channels: ['email'] };
  const saved = await rpc('admin_save_announcement', { p_request: crypto.randomUUID(), p_id: id, p_revision: 0, p_value: value }, token);
  assert.equal(saved.status, 200, 'save ' + JSON.stringify(saved.body));
  const preview = await rpc('admin_preview_announcement', { p_id: id, p_revision: 1 }, token);
  const published = await rpc('admin_publish_announcement', { p_request: crypto.randomUUID(), p_id: id, p_revision: 1, p_fingerprint: preview.body.fingerprint, p_confirmed: true }, token);
  assert.equal(published.status, 200, 'publish ' + JSON.stringify(published.body));
  return published.body;
}

(async () => {
  // Email channel configured for this disposable DB only (provider/domain/from); SMS stays NOT ready on purpose.
  sql(`update public.app_settings set value='"smtp"' where key='channels.email.provider';
       update public.app_settings set value='"noreply@example.invalid"' where key='channels.email.from_address';
       update public.app_settings set value='true' where key='channels.email.sender_domain_verified';
       insert into gina.channel_provider_status(channel,provider,configured,missing) values('email','smtp',true,'{}') on conflict(channel) do update set configured=true,missing='{}',reported_at=now();`);
  const login = await fetch(f.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, password: f.password }) });
  const token = (await login.json()).access_token; assert.ok(token);

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function page(size = 'phone') {
    const c = await browser.newContext({ viewport: sizes[size], locale: 'tr-TR', hasTouch: size === 'phone' });
    await c.route(backend + '/**', async route => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const headers = { ...req.headers() };
      if (headers.apikey === placeholderAnon) headers.apikey = f.anon;
      if (headers.authorization === 'Bearer ' + placeholderAnon) headers.authorization = 'Bearer ' + f.anon;
      try { const res = await route.fetch({ url: f.url + req.url().slice(backend.length), headers }); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } }); }
      catch { await route.fulfill({ status: 503, body: 'fixture unavailable' }); }
    });
    const p = await c.newPage(); p.setDefaultTimeout(25000); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); return p;
  }
  async function shot(p, name) {
    await p.waitForTimeout(500);
    const size = p.viewportSize().width < 500 ? 'phone' : 'desktop';
    await p.screenshot({ path: `${out}/screenshots/${name}-${size}.png`, fullPage: true });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': horizontal overflow');
    const body = await p.locator('body').innerText();
    assert.ok(!/\bchannels\.[a-zA-Z]/.test(body), name + ': raw i18n key visible');
    assert.ok(!body.includes(f.email), name + ': account email shown');
    assert.deepEqual(p.errors, [], name + ': page errors');
  }
  async function signIn(p) {
    await p.goto(WEB); await p.getByLabel('E-posta', { exact: true }).fill(f.email); await p.getByLabel('Şifre', { exact: true }).fill(f.password);
    await p.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await p.waitForURL('**/parent');
  }
  const btn = (p, name) => p.getByRole('button', { name, exact: true });

  // 1) Preferences screen: push kept, email form, SMS not ready, unverified rows locked, marketing closed.
  stage = 'initial';
  const phone = await page('phone'); await signIn(phone);
  await phone.goto(WEB + '/parent/notifications');
  await phone.getByTestId('contact-email').waitFor();
  await phone.getByRole('switch', { name: t('push.pref.announcements'), exact: true }).waitFor();
  await phone.getByTestId('contact-sms-not-ready').waitFor();
  const lockedEmail = await phone.getByTestId('pref-email-announcement').innerText();
  assert.ok(lockedEmail.includes(t('channels.locked.address_unverified')));
  assert.ok((await phone.getByTestId('pref-email-marketing').innerText()).includes(t('channels.locked.marketing_legal_review_pending')));
  assert.equal(await phone.getByTestId('pref-email-announcement').getByRole('switch').count(), 0, 'no switch for an unverified address');
  await shot(phone, '01-preferences-initial');
  pass('preferences_initial_push_kept_email_form_sms_not_ready_locked_rows');

  // 2) Unverified address block, server side: opt-in refused, nothing queued.
  stage = 'unverified-block';
  const refused = await rpc('set_notification_preference', { p_channel: 'email', p_purpose: 'announcement', p_enabled: true }, token);
  assert.equal(refused.body?.message, 'address_unverified');
  const smsRefused = await rpc('request_contact_verification', { p_kind: 'sms', p_value: '+905551112233' }, token);
  assert.equal(smsRefused.body?.message, 'channel_not_ready');
  const pre = await publish(token, 'C10 adres doğrulanmadan duyuru');
  assert.ok(pre.channels.email.address_unverified >= 1 && !pre.channels.email.queued, JSON.stringify(pre.channels));
  assert.equal(sql("select count(*) from gina.channel_outbox where kind='parent_announcement';"), '0');
  pass('unverified_address_blocked', { publish_email: pre.channels.email, sms_request: 'channel_not_ready' });

  // 3) Request code in the UI → real worker pieces → STARTTLS fake SMTP.
  stage = 'request-code';
  const address = `c10-${crypto.randomUUID().slice(0, 8)}@example.invalid`;
  await phone.getByLabel(t('channels.contact.input.email'), { exact: true }).fill(address);
  await btn(phone, t('channels.verify.send')).click();
  await phone.getByTestId('contact-email-pending').waitFor();
  await phone.getByText(t('channels.verify.requestsLeft', { count: 2 }), { exact: true }).waitFor().catch(() => undefined);
  await shot(phone, '02-code-requested');
  const first = drain();
  assert.equal(first.counts.accepted, 1, JSON.stringify(first.counts));
  assert.deepEqual(first.clearText, ['EHLO gina.local', 'STARTTLS'], 'only EHLO/STARTTLS in clear');
  const mail = first.mails[0]; assert.equal(mail.to, address);
  const code = mail.text.match(/: ([A-Z0-9]{8})\b/)[1];
  const link = mail.text.match(/https?:\/\/\S+verify-contact\?\S+/)[0];
  assert.ok(!/List-Unsubscribe/.test(mail.headers), 'verification mail has no unsubscribe header');
  assert.equal(sql("select count(*) from gina.channel_outbox where kind='contact_verification' and payload ? 'secret' and status='accepted';"), '0', 'secret scrubbed after acceptance');
  pass('code_sent_via_starttls_fake', { accepted: 1, clear: first.clearText });

  // 4) Wrong code → attempts left; deep link → code prefilled, explicit tap verifies.
  stage = 'verify';
  await phone.getByLabel(t('channels.verify.codeLabel.email'), { exact: true }).fill('ZZZZ9999');
  await btn(phone, t('channels.verify.confirm')).click();
  await phone.getByText(t('channels.verify.wrong', { count: 4 }), { exact: true }).waitFor();
  await shot(phone, '03-wrong-code');
  await phone.goto(link.replace(/^https?:\/\/[^/]+/, WEB));
  await phone.waitForURL('**/parent/notifications**');
  await phone.getByText(t('channels.verify.linkFilled'), { exact: true }).waitFor();
  assert.equal(await phone.getByLabel(t('channels.verify.codeLabel.email'), { exact: true }).inputValue(), code);
  assert.equal(sql("select count(*) from gina.contact_channels where revoked_at is null;"), '0', 'opening the link verified nothing');
  await shot(phone, '04-deep-link-prefilled');
  await btn(phone, t('channels.verify.confirm')).click();
  await phone.getByTestId('contact-email-verified').waitFor();
  assert.equal(sql("select count(*) from gina.contact_channels where revoked_at is null and kind='email';"), '1');
  await shot(phone, '05-verified');
  pass('wrong_code_then_deep_link_verifies_on_tap');

  // 5) Opt in from the matrix; consent history shows it.
  stage = 'opt-in';
  await phone.getByTestId('pref-email-announcement').getByRole('switch').click();
  await phone.getByTestId('channel-pref-saved').waitFor();
  await phone.getByText(t('channels.history.on', { channel: t('channels.channel.email'), purpose: t('channels.purpose.announcement') }), { exact: true }).first().waitFor();
  assert.equal(sql("select count(*) from gina.notification_consent_log where source='user' and policy_version='channels-2026-11-06' and channel='email' and purpose='announcement' and enabled;"), '1');
  await shot(phone, '06-opted-in');
  pass('opt_in_logged_with_consent_version');

  // 6) Announcement mail: one-click header + page link; RFC 8058 POST once, replay no-op; GET has no effect.
  stage = 'one-click';
  const pub = await publish(token, 'C10 tek tık duyuru');
  assert.equal(pub.channels.email.queued, 1, JSON.stringify(pub.channels));
  const second = drain(); assert.equal(second.counts.accepted, 1, JSON.stringify(second.counts));
  const ann = second.mails[0];
  const header = ann.headers.match(/List-Unsubscribe: <([^>]+)>/)[1];
  assert.ok(header.startsWith(ONE_CLICK + '?token='), 'header points to the one-click endpoint');
  assert.match(ann.headers, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
  assert.ok(ann.text.includes(PAGE + '?token='), 'visible link is the web page');
  assert.ok(!ann.text.includes(f.email) && !/Child|Çocuk/.test(ann.text), 'no personal data in the mail');
  const getRes = await fetch(header, { redirect: 'manual' });
  assert.equal(getRes.status, 200); assert.ok((await getRes.text()).includes('method="post"'));
  assert.equal(sql("select coalesce(bool_and(enabled),true) from gina.notification_preferences where channel='email' and purpose='announcement';"), 't', 'GET changed nothing');
  const post = () => fetch(header, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
  const p1 = await post(); assert.deepEqual([p1.status, await p1.text()], [200, 'unsubscribed']);
  const p2 = await post(); assert.deepEqual([p2.status, await p2.text()], [200, 'already_unsubscribed']);
  const bad = await fetch(header.slice(0, -1) + (header.endsWith('0') ? '1' : '0'), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
  assert.equal(bad.status, 400);
  assert.equal(sql("select enabled::text||':'||source from gina.notification_preferences where channel='email' and purpose='announcement';"), 'false:unsubscribe_link');
  assert.equal(sql("select count(*) from public.audit_log where action='notification.unsubscribe';"), '1', 'replay audited once');
  pass('rfc8058_one_click_once_replay_noop_tamper_rejected', { get: 200, post: [200, 200], tampered: 400 });

  // 7) Desktop: preferences reflect the link unsubscribe; parent opts back in.
  stage = 'desktop';
  const desk = await page('desktop'); await signIn(desk);
  await desk.goto(WEB + '/parent/notifications');
  await desk.getByText(t('channels.history.source.unsubscribe_link'), { exact: false }).first().waitFor();
  await shot(desk, '07-after-one-click');
  await desk.getByTestId('pref-email-announcement').getByRole('switch').click();
  await desk.getByTestId('channel-pref-saved').waitFor();
  await shot(desk, '08-opted-back-in');
  pass('desktop_history_and_reopt_in');

  // 8) Web unsubscribe page: opening changes nothing, button applies, second press says already done.
  stage = 'page';
  const pub2 = await publish(token, 'C10 sayfa bağlantısı duyurusu');
  assert.equal(pub2.channels.email.queued, 1);
  const third = drain(); const pageLink = third.mails[0].text.match(/https?:\/\/\S+\/unsubscribe\?token=\S+/)[0];
  const anon = await page('phone');
  await anon.goto(pageLink.replace(/^https?:\/\/[^/]+/, WEB));
  await anon.getByTestId('unsubscribe-ready').waitFor();
  assert.equal(sql("select enabled::text from gina.notification_preferences where channel='email' and purpose='announcement';"), 'true', 'opening the page changed nothing');
  await shot(anon, '09-unsubscribe-page');
  await btn(anon, t('channels.unsubscribe.action')).click();
  await anon.getByTestId('unsubscribe-done').waitFor();
  assert.equal(sql("select enabled::text||':'||source from gina.notification_preferences where channel='email' and purpose='announcement';"), 'false:unsubscribe_link');
  await shot(anon, '10-unsubscribe-done');
  await anon.reload(); await anon.getByTestId('unsubscribe-ready').waitFor();
  await btn(anon, t('channels.unsubscribe.action')).click();
  await anon.getByText(t('channels.unsubscribe.already', { subject: t('channels.unsubscribe.subject.email.announcement') }), { exact: true }).waitFor();
  await anon.goto(WEB + '/unsubscribe?token=bozuk'); await anon.getByTestId('unsubscribe-invalid').waitFor();
  await shot(anon, '11-unsubscribe-invalid');
  const deskPage = await page('desktop'); await deskPage.goto(pageLink.replace(/^https?:\/\/[^/]+/, WEB)); await deskPage.getByTestId('unsubscribe-ready').waitFor();
  await shot(deskPage, '12-unsubscribe-page');
  pass('web_unsubscribe_page_button_once_then_already', { invalid_link: 'shown' });

  // 9) After unsubscribe, a new announcement queues nothing for email; remove address.
  stage = 'after';
  const pub3 = await publish(token, 'C10 vazgeçme sonrası duyuru');
  assert.ok(pub3.channels.email.preference_off === 1 && !pub3.channels.email.queued, JSON.stringify(pub3.channels));
  await phone.goto(WEB + '/parent/notifications'); await phone.getByTestId('contact-email-verified').waitFor();
  await btn(phone, t('channels.contact.remove')).click();
  await phone.getByTestId('contact-email').getByRole('button', { name: t('channels.contact.remove'), exact: true }).click();
  await phone.getByTestId('contact-email-notice').waitFor();
  assert.equal(sql("select count(*) from gina.contact_channels where revoked_at is null;"), '0');
  await shot(phone, '13-address-removed');
  assert.equal(sql("select count(*) from public.audit_log where details::text like '%example.invalid%' and action like 'contact.%';"), '0', 'audit never stores the address');
  pass('after_unsubscribe_no_email_queued_and_address_removed');

  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ ok: true, count: results.length, results }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, count: results.length }));
})().catch((error) => {
  fs.writeFileSync(out + '/ui-checks.json', JSON.stringify({ ok: false, stage, error: String(error && error.message || error).slice(0, 400), results }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: false, stage, error: String(error && error.message || error).slice(0, 400) }));
  process.exitCode = 1;
}).finally(() => browser?.close());
