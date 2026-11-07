const readPreviewFile = require('../../../../scripts/read-preview-file.cjs');
// D7 UI checks against a disposable local stack (own `gina_d7_<hex>_audit` clone of the empty
// `gina_completion_audit` template + temporary GoTrue/PostgREST containers on loopback ports).
// Backoffice static export is driven with Playwright at 1280×800 and 768×1024.
// Synthetic @example.invalid accounts only; passwords and JWTs live only in memory. Every container and
// the database are removed at the end (also on failure). Harness base: D3 (docs/release/d3-2026-11-06/harness).
// Usage: GINA_QA_PLAYWRIGHT_PATH=<playwright module> D7_WORK=<scratch dir> node docs/release/d7-2026-11-06/harness/d7-ui.cjs --run-local
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
if (!process.argv.includes('--run-local')) throw Error('Explicit --run-local required');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../../../..');
const work = process.env.D7_WORK; assert.ok(work && path.isAbsolute(work), 'D7_WORK required');
const out = path.resolve(__dirname, '../ui'); fs.mkdirSync(out + '/screenshots', { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const t = (key, vars = {}) => { let s = tr[key]; assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const DB = 'gina_d7_' + randomBytes(8).toString('hex') + '_audit';
const containers = []; let created = false, proxy, statics, serve, browser, stage = 'setup';
const results = []; const pass = (check, extra = {}) => { results.push({ check, passed: true, ...extra }); console.log('ok', check, JSON.stringify(extra)); };
const cleanup = {};

function run(cmd, args, opts = {}) { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 900000, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 << 20, ...opts }); }
function psql(db, body, owner = false) {
  if (owner && db !== DB) throw Error('ownership_changes_require_disposable_database');
  const read = (db === 'gina_completion_audit' || db === 'postgres') && /^\s*select /i.test(body);
  if (db !== DB && db !== 'postgres' && !read) throw Error('refusing_foreign_database');
  try {
    return run('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', owner || read ? 'supabase_admin' : 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'],
      { input: read ? 'begin read only;\n' + body + '\ncommit;' : body }).trim();
  } catch (e) { throw Error('psql_failed: ' + String(e.stderr || '').split('\n').filter((l) => l.startsWith('ERROR')).join(' ').slice(0, 400)); }
}
const sql = (body) => psql(DB, body);
const lit = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const claimsSql = (claims, body) => sql(`begin; set local role authenticated; select set_config('request.jwt.claims',${lit(JSON.stringify(claims))},true);\n${body}\ncommit;`).split('\n').filter((l) => l && !l.startsWith('{"sub"')).pop();
const inspect = (name) => { const d = JSON.parse(run('docker', ['inspect', name]))[0]; return { image: d.Config.Image, env: Object.fromEntries(d.Config.Env.map((v) => [v.slice(0, v.indexOf('=')), v.slice(v.indexOf('=') + 1)])) }; };
const dbUrl = (orig) => { const u = new URL(orig); assert.equal(u.hostname, 'supabase_db_gina'); u.pathname = '/' + DB; return u.toString(); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role, secret) => { const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ role, iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7200 }); return body + '.' + createHmac('sha256', secret).update(body).digest('base64url'); };
function startContainer(name, image, env, port) {
  const envFile = path.join(work, 'env-' + randomBytes(6).toString('hex'));
  fs.writeFileSync(envFile, Object.entries(env).map(([k, v]) => k + '=' + v).join('\n') + '\n', { mode: 0o600 });
  containers.push(name);
  try { run('docker', ['run', '-d', '--name', name, '--network', 'supabase_network_gina', '-p', `127.0.0.1::${port}`, '--env-file', envFile, image]); }
  finally { fs.rmSync(envFile, { force: true }); }
  return Number(JSON.parse(run('docker', ['inspect', name]))[0].NetworkSettings.Ports[`${port}/tcp`][0].HostPort);
}
async function healthy(port, p) { for (let i = 0; i < 80; i++) { try { const r = await fetch(`http://127.0.0.1:${port}${p}`); if (r.ok) return; } catch {} await new Promise((r) => setTimeout(r, 500)); } throw Error('service_not_ready_' + port); }
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });

async function setupStack() {
  assert.equal(psql('gina_completion_audit', 'select count(*) from public.families; select count(*) from auth.users;'), '0\n0', 'audit template is not empty');
  psql('postgres', `create database ${DB} template gina_completion_audit;`); created = true;
  const authCols = "select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='auth' order by table_name,ordinal_position;";
  assert.equal(psql('postgres', authCols), psql(DB, authCols, true), 'auth template schema mismatch');
  const versions = psql('postgres', 'select version from auth.schema_migrations order by version;').split('\n').filter(Boolean);
  sql('insert into auth.schema_migrations(version) values ' + versions.map((v) => `('${v}')`).join(',') + ' on conflict do nothing;');
  psql(DB, `alter schema auth owner to supabase_auth_admin;
    do $$ declare r record; begin
      for r in select tablename from pg_tables where schemaname='auth' loop execute format('alter table auth.%I owner to supabase_auth_admin', r.tablename); end loop;
      for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relkind='S' loop execute format('alter sequence auth.%I owner to supabase_auth_admin', r.relname); end loop;
      for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' loop execute format('alter function %s owner to supabase_auth_admin', r.signature); end loop;
    end $$;
    grant references on auth.users to postgres;
    create publication supabase_realtime;`, true);
  for (const file of fs.readdirSync(root + '/supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
    const text = fs.readFileSync(root + '/supabase/migrations/' + file, 'utf8');
    if (file < '20261103093000') { for (const line of text.split('\n')) if (line.toLowerCase().startsWith('alter publication supabase_realtime add table ')) sql(line); }
    else sql(text);
  }
  const auth = inspect('supabase_auth_gina'), rest = inspect('supabase_rest_gina');
  const secret = randomBytes(36).toString('base64url');
  const authPort = startContainer(DB + '_auth', auth.image, {
    GOTRUE_API_HOST: '0.0.0.0', GOTRUE_API_PORT: '9999', API_EXTERNAL_URL: 'http://127.0.0.1', GOTRUE_SITE_URL: 'http://127.0.0.1',
    GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: dbUrl(auth.env.GOTRUE_DB_DATABASE_URL), GOTRUE_DB_MIGRATIONS_PATH: '/usr/local/etc/auth/migrations',
    GOTRUE_JWT_SECRET: secret, GOTRUE_JWT_EXP: '3600', GOTRUE_JWT_AUD: 'authenticated', GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
    GOTRUE_DISABLE_SIGNUP: 'false', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true',
    GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED: 'true', GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI: 'pg-functions://postgres/public/custom_access_token_hook',
  }, 9999);
  const restPort = startContainer(DB + '_rest', rest.image, {
    PGRST_DB_URI: dbUrl(rest.env.PGRST_DB_URI), PGRST_DB_SCHEMAS: 'public', PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: secret,
  }, 3000);
  await healthy(authPort, '/health'); await healthy(restPort, '/');
  proxy = http.createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const route = [['/auth/v1', authPort], ['/rest/v1', restPort]].find(([p]) => req.url === p || req.url.startsWith(p + '/'));
    if (!route) { res.writeHead(404, cors); res.end(); return; }
    const up = http.request({ hostname: '127.0.0.1', port: route[1], path: req.url.slice(route[0].length) || '/', method: req.method, headers: { ...req.headers, host: '127.0.0.1' } }, (r) => {
      const h = { ...r.headers }; for (const k of Object.keys(h)) if (k.startsWith('access-control-')) delete h[k];
      res.writeHead(r.statusCode, { ...h, ...cors }); r.pipe(res);
    });
    up.on('error', () => { res.writeHead(502, cors); res.end(); }); req.pipe(up);
  });
  proxy.on('upgrade', (_req, socket) => socket.destroy());
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${proxy.address().port}`, anon: jwt('anon', secret), service: jwt('service_role', secret) };
}

let S;
async function api(method, p, body, token, key = S.anon) {
  const res = await fetch(S.url + p, { method, headers: { apikey: key, authorization: 'Bearer ' + (token || key), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}
async function user(tag) {
  const email = `gina-d7-${tag}-${randomBytes(4).toString('hex')}@example.invalid`, password = randomBytes(18).toString('base64url') + 'aA1!';
  const r = await api('POST', '/auth/v1/admin/users', { email, password, email_confirm: true }, S.service, S.service); assert.ok(r.ok, 'create user ' + r.status);
  return { id: r.data.id, email, password };
}
async function login(u) { const r = await api('POST', '/auth/v1/token?grant_type=password', { email: u.email, password: u.password }); assert.ok(r.ok, 'login ' + r.status); return r.data.access_token; }
const rpc = async (token, name, args) => api('POST', '/rest/v1/rpc/' + name, args, token);

async function fixture() {
  const F = { admin: await user('admin'), content: await user('content'), release: await user('release'), cand: await user('candidate'), parent: await user('parent') };
  const fam = await rpc(await login(F.parent), 'create_family', { p_name: 'Sentetik D7 ailesi', p_display_name: 'Sentetik veli' });
  assert.ok(fam.ok, 'create_family ' + JSON.stringify(fam.data).slice(0, 200)); F.family = fam.data;
  F.groupSet = randomUUID(); F.q1 = randomUUID(); F.q2 = randomUUID(); F.group = randomUUID();
  sql(`insert into public.admins(user_id) values('${F.admin.id}');
    insert into public.operations_members(user_id,role,expires_at) values('${F.content.id}','content',now()+interval '30 days'),('${F.release.id}','release',now()+interval '30 days');
    update public.app_settings set value='true' where key in('sources.enabled','question_groups.enabled','contribution_sets.enabled');
    insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution) values
     ('${F.q1}','${F.family}',5,'Matematik','Kesirler','open_ended','orta',E'Pasta\\nSekiz dilimli bir pasta var.\\n\\nİki dilim pastanın kaçta kaçıdır?','2/8','İki bölü sekiz.'),
     ('${F.q2}','${F.family}',5,'Matematik','Kesirler','open_ended','orta',E'Pasta\\nSekiz dilimli bir pasta var.\\n\\nPastanın yarısı kaç dilimdir?','4','Sekizin yarısı.');
    insert into public.question_source_groups(id,family_id,series_id,version,title,body,grade,subject) values('${F.group}','${F.family}','${F.group}',1,'Pasta','Sekiz dilimli bir pasta var.',5,'Matematik');
    insert into public.question_source_members(group_id,question_id,position,prompt) values('${F.group}','${F.q1}',1,'İki dilim pastanın kaçta kaçıdır?'),('${F.group}','${F.q2}',2,'Pastanın yarısı kaç dilimdir?');
    update public.question_source_groups set finalized_at=now() where id='${F.group}';`);
  const pc = { sub: F.parent.id, role: 'authenticated', gina: { family_id: F.family, role: 'parent' } };
  claimsSql(pc, `select public.begin_question_contribution('${F.groupSet}','${F.q1}',true,true)::text;`);
  return F;
}
// ---------- browser helpers ----------
const pages = [];
const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
async function newPage(width, height, mobile = false) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'tr-TR', hasTouch: mobile, timezoneId: 'Europe/Istanbul' });
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  page.nativeDialogs = 0; page.on('dialog', (d) => { page.nativeDialogs++; void d.dismiss(); });
  pages.push(page); return page;
}
async function shot(page, name, { full = false, keys = /contributionTrail\./ } = {}) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/screenshots/${name}.png`, fullPage: full });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': horizontal overflow');
  const text = await page.locator('body').innerText();
  assert.ok(!keys.test(text), name + ': raw i18n key visible');
  assert.ok(!/"[a-z_]+":|P0001|42501|PGRST/.test(text), name + ': raw server error/JSON visible');
  return text;
}
async function both(page, name) {
  await page.setViewportSize({ width: 1280, height: 800 }); await shot(page, name + '-1280');
  await page.setViewportSize({ width: 768, height: 1024 }); await shot(page, name + '-768');
  await page.setViewportSize({ width: 1280, height: 800 });
}
async function boSignIn(page, u) {
  await page.goto(S.bo + '/sign-in');
  await page.getByLabel('E-posta', { exact: true }).fill(u.email);
  await page.getByLabel('Şifre', { exact: true }).fill(u.password);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.waitForURL((x) => !x.pathname.startsWith('/sign-in'));
}
async function pageRpc(page, fn, args = {}) {
  return await page.evaluate(async ({ url, anon, fn, args }) => {
    const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'));
    const token = JSON.parse(localStorage.getItem(key)).access_token;
    const r = await fetch(url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: anon, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(args) });
    return { status: r.status, text: (await r.text()).slice(0, 300) };
  }, { url: S.url, anon: S.anon, fn, args });
}
const button = (page, name) => page.getByRole('button', { name, exact: true });

const navText = (page) => page.locator('nav[aria-label="Yönetim bölümleri"]').innerText().catch(() => '');

(async () => {
  stage = 'stack'; S = await setupStack();
  stage = 'fixture'; const F = await fixture();

  stage = 'build_backoffice';
  run('pnpm', ['build'], { cwd: root + '/apps/backoffice', env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: S.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: S.anon } });
  const boDir = root + '/apps/backoffice/out';
  statics = http.createServer((req, res) => {
    const p = path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    for (const c of [p, p + '.html', path.join(p, 'index.html')]) {
      try { const body = readPreviewFile(boDir, c); if (body) { res.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(c)] ?? 'application/octet-stream' }); res.end(body); return; } } catch {}
    }
    res.writeHead(404); res.end('not found');
  });
  await new Promise((r) => statics.listen(0, '127.0.0.1', r));
  S.bo = `http://127.0.0.1:${statics.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  // 1) Rol ekranı yalnız tam yönetici
  stage = 'operators_admin_only';
  const con = await newPage(1280, 800); await boSignIn(con, F.content);
  assert.ok(!/Operatör rolleri/.test(await navText(con)), 'operator menu must not offer the role screen');
  await con.goto(S.bo + '/operators'); await con.waitForTimeout(1500);
  assert.ok(!(await con.getByTestId('operators').count()), 'role screen rendered for a content operator');
  const denied = await pageRpc(con, 'admin_operation_members');
  assert.ok(denied.status >= 400 && /forbidden|42501/.test(denied.text), 'server must refuse ' + denied.text);
  const deniedSet = await pageRpc(con, 'admin_set_operation_member', { p_request_id: randomUUID(), p_user_id: F.content.id, p_role: 'finance', p_expires_at: new Date(Date.now() + 864e5).toISOString(), p_revoke: false, p_reason: 'Kendime rol' });
  assert.ok(deniedSet.status >= 400 && /forbidden|42501/.test(deniedSet.text), 'server must refuse self grant ' + deniedSet.text);
  await shot(con, 'operators-content-denied-1280');
  pass('operators_screen_admin_only', { list_status: denied.status, grant_status: deniedSet.status });

  // 2) İçerik operatörü ortak kaynaklı grubu kabul eder: yalnız taslak, yayın yok
  stage = 'content_accept';
  await con.goto(S.bo + '/library?tab=review'); await con.getByRole('button', { name: /Pasta/ }).first().click();
  for (const n of [1, 2]) {
    await con.getByRole('button', { name: new RegExp('^' + n + '\\. soru') }).click();
    await con.getByLabel('Çocuğa açıklama', { exact: true }).fill(n === 1 ? 'Sekiz dilimden ikisi alınır.' : 'Sekizin yarısı dörttür.');
    await con.getByLabel('Olası yanılgı veya henüz belirlenmediği bilgisi', { exact: true }).fill('Henüz belirlenmedi.');
    await con.getByLabel('Sonraki küçük öğrenme adımı', { exact: true }).fill('Benzer bir kesir sorusu.');
    await con.getByLabel('1. ölçüt', { exact: true }).fill('Sonuç doğru.');
    await con.getByLabel(/Soruyu, görselini, cevabını ve düzeyini/).check();
  }
  await con.getByLabel('Veliye görünecek genel gerekçe').fill('Grup doğru ve özgün; teşekkürler.');
  await con.getByLabel(/Paylaşım hakkı ve kişisel bilgi/).check();
  const accept = con.getByRole('button', { name: 'Kabul et ve taslak oluştur' });
  assert.ok(await accept.isEnabled(), 'acceptance must be possible for the content operator');
  await con.getByText(/yayın kararı yayın ekibindedir/).first().scrollIntoViewIfNeeded();
  await both(con, 'review-content-accept-ready');
  await accept.click();
  await con.getByText(/Katkı kabul edildi ve ayrı kütüphane taslağı oluşturuldu/).waitFor();
  const row = sql(`select c.status||'|'||p.status||'|'||(p.created_by='${F.content.id}')::text||'|'||(select count(*) from gina.library_import_questions q where q.package_id=p.id)||'|'||(select count(distinct source_key) from gina.library_import_questions q where q.package_id=p.id)||'|'||(select count(*) from gina.library_publications x where x.package_id=p.id)
    from gina.contribution_sets c join gina.library_import_packages p on p.id=c.package_id where c.id='${F.groupSet}';`);
  assert.equal(row, 'approved|draft|true|2|1|0', 'approved group → one draft package with both questions on one source, no publication');
  assert.equal(sql(`select count(*)||':'||max(details->>'decided_as') from public.audit_log where action='contribution_set.approved' and target_id='${F.groupSet}';`), '1:content');
  F.pkg = sql(`select package_id from gina.contribution_sets where id='${F.groupSet}';`);
  await shot(con, 'review-content-accepted-1280');
  const publish = await pageRpc(con, 'admin_set_library_publication', { p_request_id: randomUUID(), p_package_id: F.pkg, p_expected_version: 0, p_review_fingerprint: 'x', p_title: 'Pasta grubu', p_description: '', p_plans: ['free'], p_curriculum_label: '5. sınıf kesirler', p_confirmed: true, p_status: 'published' });
  assert.ok(publish.status >= 400 && /forbidden|42501/.test(publish.text), 'content operator must not publish ' + publish.text);
  const general = await pageRpc(con, 'admin_import_library_bundle', { p_request_id: randomUUID(), p_bundle: { schema: 'gina.library-import.v1' } });
  assert.ok(general.status >= 400 && /forbidden|42501/.test(general.text), 'general import stays admin-only ' + general.text);
  pass('content_operator_accepts_group_creates_draft_only', { contribution: 'approved', package: 'draft', questions: 2, shared_sources: 1, publications: 0, publish_rpc: publish.status, general_import_rpc: general.status });

  // 3) Yönetici rol verir ve süresini günceller (çift tıklama tek kayıt)
  stage = 'role_grant';
  const adm = await newPage(1280, 800); await boSignIn(adm, F.admin);
  assert.match(await navText(adm), /Operatör rolleri/);
  await adm.goto(S.bo + '/operators'); await adm.getByTestId('operators').waitFor();
  await adm.getByTestId('member-card').filter({ hasText: F.content.email }).waitFor();
  await both(adm, 'operators-list');
  const grant = adm.getByTestId('grant-card');
  await grant.getByLabel('E-posta', { exact: true }).fill('nobody-d7@example.invalid');
  await grant.getByRole('button', { name: 'Hesabı bul' }).click();
  await grant.getByTestId('grant-not-found').waitFor();
  await grant.getByLabel('E-posta', { exact: true }).fill(F.admin.email);
  await grant.getByRole('button', { name: 'Hesabı bul' }).click();
  await grant.getByTestId('grant-ineligible').waitFor();
  await grant.getByLabel('E-posta', { exact: true }).fill(F.cand.email.toUpperCase());
  await grant.getByRole('button', { name: 'Hesabı bul' }).click();
  await grant.getByTestId('grant-form').waitFor();
  await grant.locator('#grant-role').selectOption('content');
  await grant.locator('#grant-days').selectOption('30');
  await grant.getByLabel('Gerekçe (denetim kaydına yazılır)').fill('İçerik ekibine katıldı');
  await shot(adm, 'operators-grant-form-1280');
  await grant.getByRole('button', { name: 'Rolü ver' }).dblclick();
  await adm.getByTestId('operators-message').getByText(/^Rol verildi\./).waitFor();
  const candCard = adm.getByTestId('member-card').filter({ hasText: F.cand.email });
  await candCard.locator('[data-role="content"][data-state="active"]').waitFor();
  assert.equal(sql(`select count(*) from public.operations_members where user_id='${F.cand.id}' and role='content' and revoked_at is null and expires_at between now()+interval '29 days' and now()+interval '31 days';`), '1');
  assert.equal(sql(`select count(*) from public.audit_log where action='operations.member' and target_id='${F.cand.id}';`), '1', 'double click → one audit');
  // Rol hemen geçerli: aday giriş yapınca içerik bölümünü görür.
  const cand = await newPage(1280, 800); await boSignIn(cand, F.cand);
  await cand.goto(S.bo + '/library?tab=review'); await cand.getByRole('heading', { name: 'Metin ve görsel katkıları' }).waitFor();
  assert.match(await navText(cand), /GINA kütüphanesi/);
  // Süre güncelleme.
  await candCard.getByLabel('Gerekçe (denetim kaydına yazılır)').fill('Dönem boyunca uzatıldı');
  await candCard.locator('select[id$="-days"]').selectOption('180');
  await candCard.getByRole('button', { name: 'Süreyi güncelle' }).click();
  await adm.getByTestId('operators-message').getByText('Rolün süresi güncellendi.').waitFor();
  assert.equal(sql(`select (expires_at>now()+interval '179 days')::text from public.operations_members where user_id='${F.cand.id}' and role='content';`), 'true');
  assert.equal(sql(`select count(*) from public.audit_log where action='operations.member' and target_id='${F.cand.id}';`), '2');
  await candCard.getByTestId('member-history').locator('summary').click();
  await candCard.getByTestId('member-history').getByText(/Dönem boyunca uzatıldı/).waitFor();
  await candCard.scrollIntoViewIfNeeded();
  await both(adm, 'operators-granted-history');
  pass('admin_grants_and_updates_role', { audit_rows: 2, candidate_sees_content: true });

  // 4) Açık sekmede iptal: içerik operatörünün inceleme sekmesi açıkken rol kaldırılır
  stage = 'open_tab_revocation';
  await con.goto(S.bo + '/library?tab=review'); await con.getByRole('heading', { name: 'Metin ve görsel katkıları' }).waitFor();
  const conCard = adm.getByTestId('member-card').filter({ hasText: F.content.email });
  assert.match(await conCard.getByTestId('member-sessions').innerText(), /[1-9]\d* açık oturum/);
  await conCard.getByLabel('Gerekçe (denetim kaydına yazılır)').fill('Ekipten ayrıldı');
  await conCard.getByRole('button', { name: 'Rolü kaldır' }).click();
  const dlg = adm.getByTestId('confirm-dialog');
  await dlg.getByText(/açık oturum var\./).waitFor();
  await shot(adm, 'operators-revoke-confirm-1280');
  await dlg.getByRole('button', { name: 'Vazgeç' }).click();
  assert.equal(sql(`select (revoked_at is null)::text from public.operations_members where user_id='${F.content.id}' and role='content';`), 'true', 'cancel must keep the role');
  await conCard.getByRole('button', { name: 'Rolü kaldır' }).click();
  await dlg.getByRole('button', { name: 'Rolü kaldır' }).click();
  await adm.getByTestId('operators-message').getByText(/^Rol kaldırıldı\..*açık oturum var: bir sonraki istekleri hemen reddedilir/).waitFor();
  await conCard.locator('[data-role="content"][data-state="revoked"]').waitFor();
  assert.equal(sql(`select (revoked_at is not null)::text from public.operations_members where user_id='${F.content.id}' and role='content';`), 'true');
  assert.equal(sql(`select count(*) from public.audit_log where action='operations.member' and target_id='${F.content.id}' and (details->>'revoked')::boolean;`), '1');
  await both(adm, 'operators-revoked');
  // Aynı token: sunucu hemen reddeder; sekme odağa dönünce tek "Yetkiniz kaldırıldı" bildirimi.
  const after = await pageRpc(con, 'admin_list_contribution_sets');
  assert.ok(after.status >= 400 && /forbidden|42501/.test(after.text), 'same JWT refused ' + after.text);
  await con.evaluate(() => window.dispatchEvent(new Event('focus')));
  await con.getByTestId('role-revoked').waitFor();
  assert.equal(await con.getByText('Yetkiniz kaldırıldı.').count(), 1);
  assert.ok(!(await con.getByRole('heading', { name: 'Metin ve görsel katkıları' }).count()), 'review content must be hidden');
  assert.ok(!/GINA kütüphanesi/.test(await navText(con)), 'content sections must leave the menu');
  await both(con, 'content-open-tab-revoked');
  assert.equal(adm.nativeDialogs + con.nativeDialogs, 0, 'no browser confirm');
  pass('open_tab_revocation_takes_effect', { rpc_status: after.status, notice: 'role-revoked' });

  for (const p of pages) assert.deepEqual(p.errors, [], 'page errors');
  pass('no_page_errors_no_overflow_no_raw_keys');
})().then(() => finish(0), (e) => finish(1, e));
async function finish(code, error) {
  if (error) {
    console.log('CHECK_FAILED ' + stage + ' ' + String(error.message).slice(0, 900));
    for (const [i, page] of pages.entries()) {
      await page.screenshot({ path: path.join(work, `d7-failed-${i}.png`), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(work, `d7-failed-${i}.txt`), (await page.locator('body').innerText().catch(() => '')) + '\nERRORS ' + JSON.stringify(page.errors));
    }
  }
  if (browser) await browser.close().catch(() => {});
  if (serve) serve.kill('SIGTERM');
  if (statics) await new Promise((r) => statics.close(r));
  if (proxy) await new Promise((r) => proxy.close(r));
  for (const name of containers.reverse()) { try { run('docker', ['rm', '-f', name]); cleanup[name.replace(DB, 'db')] = 'removed'; } catch { cleanup[name.replace(DB, 'db')] = 'FAILED'; } }
  if (created) { try { psql('postgres', `drop database ${DB} with (force);`); cleanup.database = 'dropped'; } catch { cleanup.database = 'FAILED'; } }
  cleanup.containers_left = run('docker', ['ps', '-a', '--filter', 'name=' + DB, '--format', '{{.Names}}']).trim() || 'none';
  cleanup.database_left = psql('postgres', `select count(*) from pg_database where datname='${DB}';`);
  const report = { environment: 'disposable-local-gotrue-postgrest (own clone of gina_completion_audit)', database_pattern: 'gina_d7_<hex>_audit',
    viewports: { backoffice: ['1280x800', '768x1024'] }, passed: code === 0, failed_stage: code ? stage : undefined, results, cleanup };
  fs.writeFileSync(out + (code === 0 ? '/ui-checks.json' : '/ui-checks-failed.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, code, cleanup }));
  process.exit(code || (cleanup.containers_left !== 'none' || cleanup.database_left !== '0' ? 1 : 0));
}
