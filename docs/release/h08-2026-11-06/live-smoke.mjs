// H08 canlı sentetik smoke (yalnız sentetik hesap; sır/parola yazdırılmaz).
// 1) Şifreli hesapla delete-account (H01 regresyonu): yeni istemci gibi request_id ile → 200, Apple işi yok, kullanıcı silinir.
// 2) Web auth-callback süresi dolmuş bağlantı ekranı (H04) üretimde doğru metni gösterir.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';

const ROOT = new URL('../../../', import.meta.url);
const PROJECT = 'wixjxlxgyhgdacadsawo';
const URL_BASE = `https://${PROJECT}.supabase.co`;
const require = createRequire(new URL('apps/mobile/package.json', ROOT));
const { createClient } = require('@supabase/supabase-js');
const cli = spawnSync('pnpm', ['exec', 'supabase', 'projects', 'api-keys', '--project-ref', PROJECT, '--output', 'json'], { encoding: 'utf8', cwd: ROOT.pathname });
if (cli.status !== 0) throw Error('credential_lookup_failed');
const keys = JSON.parse(cli.stdout);
const SERVICE = keys.find((k) => k.name === 'service_role')?.api_key;
const ANON = keys.find((k) => k.name === 'anon')?.api_key;
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL_BASE, SERVICE, opts);
const checks = [];
const check = (name, ok, detail = {}) => { checks.push({ name, ok: !!ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, JSON.stringify(detail)); };

const WEB_ONLY = process.argv.includes('--web-only');
if (!WEB_ONLY) {
const email = `gina-h08-${randomUUID()}@example.invalid`;
const password = randomBytes(24).toString('base64url');
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
const userId = created.data?.user?.id;
check('synthetic_user_created', !!userId, { domain: 'example.invalid' });
try {
  const c = createClient(URL_BASE, ANON, opts);
  const s = await c.auth.signInWithPassword({ email, password });
  const fam = await c.rpc('create_family', { p_name: 'H08 sentetik aile', p_display_name: 'H08 sentetik veli' });
  check('synthetic_family_created', !fam.error && !s.error);
  const token = s.data.session.access_token;
  const call = (body) => fetch(`${URL_BASE}/functions/v1/delete-account`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const wrong = await call({ confirm: true, password: 'wrong-password', request_id: randomUUID() });
  check('wrong_password_refused', wrong.status === 403, { status: wrong.status });
  const r = await call({ confirm: true, password, request_id: randomUUID() });
  const body = await r.json().catch(() => ({}));
  check('password_account_deleted', r.status === 200 && body.ok === true && body.apple_revocation === undefined, { status: r.status, keys: Object.keys(body) });
  const gone = await admin.auth.admin.getUserById(userId);
  check('auth_user_absent', gone.error?.status === 404 || !gone.data?.user);
  const fams = await admin.from('family_members').select('family_id', { count: 'exact', head: true }).eq('user_id', userId);
  check('family_membership_absent', fams.count === 0, { count: fams.count });
} finally {
  const still = await admin.auth.admin.getUserById(userId);
  if (still.data?.user) { await admin.auth.admin.deleteUser(userId); console.log('cleanup: synthetic user removed by service role'); }
}

}
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('https://ginafamily.com/auth-callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const text = await page.locator('body').innerText();
  const resend = await page.getByRole('button').count();
  check('web_expired_link_screen', !/iptal/i.test(text.split('\n').slice(0, 6).join(' ')) && /süresi|expired/i.test(text), { buttons: resend, sample: text.slice(0, 160).replace(/\s+/g, ' ') });
} finally { await browser.close(); }

writeFileSync(new URL(WEB_ONLY ? 'live-smoke-web.json' : 'live-smoke.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), checks }, null, 1) + '\n');
