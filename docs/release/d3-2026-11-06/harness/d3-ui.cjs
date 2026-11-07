const readPreviewFile = require('../../../../scripts/read-preview-file.cjs');
// D3 UI checks against a disposable local stack (own `gina_d3_<hex>_audit` clone of the empty
// `gina_completion_audit` template + temporary GoTrue/PostgREST containers on loopback ports).
// Backoffice static export (1280×800, 768×1024) and Expo web export (390×844) are driven with Playwright.
// Synthetic @example.invalid accounts only; passwords and JWTs live only in memory. Every container and
// the database are removed at the end (also on failure).
// Usage: GINA_QA_PLAYWRIGHT_PATH=<playwright module> D3_WORK=<scratch dir> node docs/release/d3-2026-11-06/harness/d3-ui.cjs --run-local
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
if (!process.argv.includes('--run-local')) throw Error('Explicit --run-local required');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../../../..');
const work = process.env.D3_WORK; assert.ok(work && path.isAbsolute(work), 'D3_WORK required');
const out = path.resolve(__dirname, '../ui'); fs.mkdirSync(out + '/screenshots', { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const t = (key, vars = {}) => { let s = tr[key]; assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const DB = 'gina_d3_' + randomBytes(8).toString('hex') + '_audit';
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
  const email = `gina-d3-${tag}-${randomBytes(4).toString('hex')}@example.invalid`, password = randomBytes(18).toString('base64url') + 'aA1!';
  const r = await api('POST', '/auth/v1/admin/users', { email, password, email_confirm: true }, S.service, S.service); assert.ok(r.ok, 'create user ' + r.status);
  return { id: r.data.id, email, password };
}
async function login(u) { const r = await api('POST', '/auth/v1/token?grant_type=password', { email: u.email, password: u.password }); assert.ok(r.ok, 'login ' + r.status); return r.data.access_token; }
const rpc = async (token, name, args) => api('POST', '/rest/v1/rpc/' + name, args, token);

const P = { regionA: 'ec000000-0000-4000-8000-0000000d3001', schoolA: 'ec000000-0000-4000-8000-0000000d3002', regionB: 'ec000000-0000-4000-8000-0000000d3003' };
async function fixture() {
  const F = { admin: await user('admin'), rel1: await user('release'), rel2: await user('release2'), content: await user('content'), parent: await user('parent') };
  const fam = await rpc(await login(F.parent), 'create_family', { p_name: 'Sentetik D3 ailesi', p_display_name: 'Sentetik veli' });
  assert.ok(fam.ok, 'create_family ' + JSON.stringify(fam.data).slice(0, 200)); F.family = fam.data;
  F.ann = randomUUID(); F.groupSet = randomUUID(); F.soloSet = randomUUID(); F.q1 = randomUUID(); F.q2 = randomUUID(); F.q3 = randomUUID(); F.group = randomUUID();
  F.global = randomUUID();
  sql(`insert into public.admins(user_id) values('${F.admin.id}');
    insert into public.operations_members(user_id,role,expires_at) values('${F.rel1.id}','release',now()+interval '30 days'),('${F.rel2.id}','release',now()+interval '30 days'),('${F.content.id}','content',now()+interval '30 days');
    insert into gina.education_places(id,kind,parent_id,name) values('${P.regionA}','region','ec000000-0000-4000-8000-000000000001','Marmara (D3)'),('${P.schoolA}','school','${P.regionA}','Deniz İlkokulu (D3)'),('${P.regionB}','region','ec000000-0000-4000-8000-000000000001','Ege (D3)');
    insert into gina.operations_member_scopes(user_id,role,place_id) values('${F.rel2.id}','release','${P.regionB}');
    update public.app_settings set value='"smtp"' where key='channels.email.provider';
    update public.app_settings set value='"noreply@example.invalid"' where key='channels.email.from_address';
    update public.app_settings set value='true' where key='channels.email.sender_domain_verified';
    insert into gina.channel_provider_status(channel,provider,configured,missing) values('email','smtp',true,'{}') on conflict(channel) do update set configured=true,missing='{}',reported_at=now();
    insert into gina.parent_announcements(id,title,body,expires_on,status,published_at) values('${F.ann}','Veli toplantısı hatırlatması','Bu hafta perşembe veli toplantısı var.',current_date+7,'published',now());
    insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key,status,skip_reason,attempts,last_error,created_at)
     select '${F.parent.id}','${F.family}','email','announcement','parent_announcement',jsonb_build_object('announcement_id','${F.ann}'),'d3ui-fail-'||g,'failed',null,5,'retry_limit',now()-g*interval '1 minute' from generate_series(1,30) g;
    insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key,status,skip_reason,created_at)
     select '${F.parent.id}','${F.family}','sms','announcement','parent_announcement',jsonb_build_object('announcement_id','${F.ann}'),'d3ui-sms-'||g,'skipped','provider_unconfigured',now()-g*interval '90 seconds' from generate_series(1,4) g;
    insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key,status,skip_reason,created_at)
     select '${F.parent.id}','${F.family}','email','announcement','parent_announcement',jsonb_build_object('announcement_id','${F.ann}'),'d3ui-dup-'||g,'skipped','duplicate_recipient',now()-g*interval '100 seconds' from generate_series(1,2) g;
    update gina.channel_outbox set requeue_count=3 where dedupe_key='d3ui-fail-2';
    update public.app_settings set value='true' where key in('sources.enabled','question_groups.enabled','contribution_sets.enabled');
    insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution) values
     ('${F.q1}','${F.family}',5,'Matematik','Kesirler','open_ended','orta',E'Pasta\\nSekiz dilimli bir pasta var.\\n\\nİki dilim pastanın kaçta kaçıdır?','2/8','İki bölü sekiz.'),
     ('${F.q2}','${F.family}',5,'Matematik','Kesirler','open_ended','orta',E'Pasta\\nSekiz dilimli bir pasta var.\\n\\nPastanın yarısı kaç dilimdir?','5','Sekizin yarısı.'),
     ('${F.q3}','${F.family}',5,'Matematik','Çevre','open_ended','orta','Kenarı 3 cm olan karenin çevresi kaç cm?','12','Dört kenar toplanır.');
    insert into public.question_source_groups(id,family_id,series_id,version,title,body,grade,subject) values('${F.group}','${F.family}','${F.group}',1,'Pasta','Sekiz dilimli bir pasta var.',5,'Matematik');
    insert into public.question_source_members(group_id,question_id,position,prompt) values('${F.group}','${F.q1}',1,'İki dilim pastanın kaçta kaçıdır?'),('${F.group}','${F.q2}',2,'Pastanın yarısı kaç dilimdir?');
    update public.question_source_groups set finalized_at=now() where id='${F.group}';
    insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution) values('${F.global}',null,5,'Matematik','Silinecek','open_ended','kolay','D3 silme onayı deneme sorusu','1','Bir.');`);
  const pc = { sub: F.parent.id, role: 'authenticated', gina: { family_id: F.family, role: 'parent' } };
  claimsSql(pc, `select public.begin_question_contribution('${F.groupSet}','${F.q1}',true,true)::text;`);
  claimsSql(pc, `select public.begin_question_contribution('${F.soloSet}','${F.q3}',true,true)::text;`);
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

  // 1) Kapsam ekranı yalnız tam yönetici
  stage = 'scopes_admin_only';
  const rel = await newPage(1280, 800); await boSignIn(rel, F.rel1);
  const relNav = await rel.locator('nav[aria-label="Yönetim bölümleri"]').innerText();
  assert.ok(!/Operatör kapsamları/.test(relNav), 'operator menu must not offer the scope screen');
  await rel.goto(S.bo + '/operator-scopes'); await rel.waitForTimeout(1500);
  assert.ok(!(await rel.getByTestId('operator-scopes').count()), 'scope screen rendered for a release operator');
  const forbidden = await pageRpc(rel, 'admin_operator_scopes');
  assert.ok(forbidden.status >= 400 && /forbidden|42501/.test(forbidden.text), 'server must refuse ' + forbidden.text);
  await shot(rel, 'scopes-release-denied-1280');
  pass('operator_scope_screen_admin_only', { release_rpc_status: forbidden.status });

  // 2) Yönetici kapsam ekler (çift tıklama tek satır + tek denetim)
  stage = 'scope_grant';
  const adm = await newPage(1280, 800); await boSignIn(adm, F.admin);
  await adm.goto(S.bo + '/operator-scopes'); await adm.getByTestId('operator-scopes').waitFor();
  await adm.getByTestId('operator-card').nth(1).waitFor();
  const card1 = adm.getByTestId('operator-card').filter({ hasText: F.rel1.email });
  const card2 = adm.getByTestId('operator-card').filter({ hasText: F.rel2.email });
  assert.match(await card1.getByTestId('scope-effective').innerText(), /bütün bölgeler/);
  assert.match(await card2.innerText(), /Ege \(D3\)/);
  await both(adm, 'scopes-before');
  await card1.getByLabel('Eklenecek bölge veya okul').selectOption(P.regionA);
  await card1.getByLabel('Gerekçe (denetim kaydına yazılır)').fill('Marmara duyuruları için');
  await card1.getByRole('button', { name: 'Kapsam ekle' }).dblclick();
  await adm.getByText('Kapsam eklendi.').waitFor();
  await card1.getByText('Marmara (D3)').first().waitFor();
  assert.equal(sql(`select count(*) from gina.operations_member_scopes where user_id='${F.rel1.id}';`), '1');
  assert.equal(sql(`select count(*) from public.audit_log where action='operations.scope.granted' and target_id='${F.rel1.id}';`), '1');
  assert.match(await card1.getByTestId('scope-effective').innerText(), /1 yer/);
  await both(adm, 'scopes-granted');
  pass('scope_grant_double_click_one_row_one_audit');

  // 3) Son kapsamı kaldırmak açık onay ister (uygulama içi onay)
  stage = 'scope_last_remove';
  await card1.getByRole('button', { name: 'Marmara (D3) kapsamını kaldır' }).click();
  const dlg = adm.getByTestId('confirm-dialog');
  await dlg.getByText('Bu, operatörün son kapsamı.').waitFor();
  await shot(adm, 'scopes-last-remove-confirm-1280');
  await dlg.getByRole('button', { name: 'Vazgeç' }).click();
  assert.equal(sql(`select count(*) from gina.operations_member_scopes where user_id='${F.rel1.id}';`), '1', 'cancel must keep the scope');
  await card1.getByRole('button', { name: 'Marmara (D3) kapsamını kaldır' }).click();
  await dlg.getByRole('button', { name: 'Kaldır ve bütün bölgelere aç' }).click();
  await adm.getByText(/Kapsam kaldırıldı\..*bütün bölgelere/).waitFor();
  assert.equal(sql(`select count(*) from gina.operations_member_scopes where user_id='${F.rel1.id}';`), '0');
  assert.equal(sql(`select count(*) from public.audit_log where action like 'operations.scope.%' and target_id='${F.rel1.id}';`), '2');
  assert.equal(adm.nativeDialogs, 0, 'no browser confirm');
  pass('scope_last_removal_needs_in_app_confirmation', { audit_rows: 2 });

  // 4) Başarısız teslimler: süzgeç, sayfalama, en çok 3 yeniden sıraya alma
  stage = 'channel_failures';
  await rel.goto(S.bo + '/notifications'); await rel.getByTestId('channel-failures').waitFor();
  await rel.getByTestId('failure-range').waitFor();
  assert.equal(await rel.getByTestId('failure-range').innerText(), '1–25 / 36 kayıt');
  await both(rel, 'notifications-failures');
  await rel.getByTestId('channel-failures').getByRole('button', { name: 'Sonraki sayfa' }).click();
  await rel.getByText('26–36 / 36 kayıt').waitFor();
  const page2 = await rel.getByTestId('failure-row').count(); assert.equal(page2, 11);
  await rel.getByTestId('channel-failures').getByRole('button', { name: 'Önceki sayfa' }).click();
  await rel.getByText('1–25 / 36 kayıt').waitFor();
  await rel.getByTestId('failure-channel').selectOption('sms');
  await rel.getByText('1–4 / 4 kayıt').waitFor();
  await rel.getByTestId('failure-channel').selectOption('');
  await rel.getByTestId('failure-reason').selectOption('requeueable');
  await rel.getByText('1–25 / 33 kayıt').waitFor();
  await shot(rel, 'notifications-failures-requeueable-1280');
  await rel.getByTestId('failure-reason').selectOption('failed');
  await rel.getByText('1–25 / 30 kayıt').waitFor();
  const limited = rel.getByTestId('failure-row').filter({ hasText: '3/3 yeniden sıraya alma' });
  await limited.getByText('Sınır doldu').waitFor();
  assert.equal(await limited.getByRole('button').count(), 0, 'no requeue button after 3 requeues');
  await rel.getByTestId('channel-failures').getByRole('button', { name: 'Sonraki sayfa' }).click();
  await rel.getByText('26–30 / 30 kayıt').waitFor();
  await rel.getByTestId('channel-failures').getByRole('button', { name: 'Önceki sayfa' }).click();
  await rel.getByText('1–25 / 30 kayıt').waitFor();
  const first = rel.getByTestId('failure-row').first();
  await first.getByRole('button', { name: 'Yeniden sıraya al' }).click();
  await rel.getByText(/Yeniden sıraya alındı/).waitFor();
  assert.equal(sql(`select status||':'||requeue_count from gina.channel_outbox where dedupe_key='d3ui-fail-1';`), 'pending:1');
  assert.equal(sql(`select count(*) from public.audit_log where action='channel.requeue';`), '1');
  const limitRpc = await pageRpc(rel, 'release_requeue_channel', { p_id: Number(sql(`select id from gina.channel_outbox where dedupe_key='d3ui-fail-2';`)) });
  assert.match(limitRpc.text, /channel_requeue_limit/);
  await shot(rel, 'notifications-failures-requeued-1280');
  assert.ok(!/@example\.invalid/.test(await rel.getByTestId('channel-failures').innerText()), 'address leaked');
  pass('channel_failures_filters_paging_requeue_limit', { total: 36, sms: 4, requeueable: 33, failed: 30, limit_rpc: 'channel_requeue_limit' });

  // 5) İçerik operatörü soru bazlı ret notu yazar
  stage = 'question_notes_review';
  const con = await newPage(1280, 800); await boSignIn(con, F.content);
  await con.goto(S.bo + '/library?tab=review'); await con.getByRole('button', { name: /Pasta/ }).first().click();
  await con.getByRole('button', { name: /^2\. soru/ }).click();
  await con.getByTestId('question-note').fill('Pastanın yarısı 4 dilimdir; cevap 5 yazılmış.');
  await con.getByRole('button', { name: /2\. soru.*not/ }).waitFor();
  await con.getByLabel('Veliye görünecek genel gerekçe').fill('Grubun bir sorusu düzeltilmeli.');
  await con.getByLabel(/Paylaşım hakkı ve kişisel bilgi/).check();
  await con.getByTestId('question-note-summary').waitFor();
  assert.ok(await con.getByRole('button', { name: 'Kabul et ve taslak oluştur' }).isDisabled(), 'acceptance must be blocked while question notes exist');
  await con.getByTestId('question-note-summary').scrollIntoViewIfNeeded();
  await both(con, 'review-question-notes');
  await con.getByRole('button', { name: 'Gerekçeyle geri gönder' }).click();
  await con.getByText(/1 soru notuyla kaydedildi/).waitFor();
  assert.equal(sql(`select status||'|'||(question_notes->>'q2') from gina.contribution_sets where id='${F.groupSet}';`), 'rejected|Pastanın yarısı 4 dilimdir; cevap 5 yazılmış.');
  assert.equal(sql(`select count(*) from public.audit_log where action='contribution_set.question_notes' and target_id='${F.groupSet}';`), '1');
  await con.getByRole('button', { name: /^2\. soru/ }).click();
  await con.getByTestId('question-note-readonly').waitFor();
  await shot(con, 'review-question-notes-readonly-1280');
  pass('content_operator_rejects_with_question_note', { stored: 'q2', audit: 1 });

  // 6) /ai ve /questions: tarayıcı confirm yerine uygulama içi onay
  stage = 'in_app_confirm';
  await adm.goto(S.bo + '/ai'); await button(adm, "AI'ı kapat (kill switch)").click();
  await adm.getByTestId('confirm-dialog').getByText('Tüm AI özellikleri hemen kapatılsın mı?').waitFor();
  await shot(adm, 'ai-confirm-1280');
  await adm.getByTestId('confirm-dialog').getByRole('button', { name: 'Vazgeç' }).click();
  assert.equal(sql(`select coalesce((select value::text from public.app_settings where key='ai.enabled'),'absent');`).replace(/"/g, '') === 'false', false, 'cancel must keep AI on');
  await adm.goto(S.bo + '/questions');
  await adm.getByText('D3 silme onayı deneme sorusu').first().waitFor();
  await adm.locator('tr').filter({ hasText: 'D3 silme onayı deneme sorusu' }).getByRole('button', { name: 'Düzenle' }).click();
  await button(adm, 'Sil').click();
  await adm.getByTestId('confirm-dialog').getByRole('heading', { name: 'Global soruyu sil' }).waitFor();
  await adm.getByTestId('confirm-dialog').getByText(/geri alınamaz/).waitFor();
  await shot(adm, 'questions-confirm-1280');
  await adm.keyboard.press('Escape');
  await adm.waitForTimeout(300);
  assert.equal(sql(`select count(*) from public.question_bank where id='${F.global}';`), '1', 'Esc must cancel deletion');
  assert.equal(adm.nativeDialogs, 0, 'no native browser dialog');
  pass('ai_and_questions_use_in_app_confirmation', { native_dialogs: 0 });

  // 7) Kenar menü: görünmeyen bölüm ipucu (Q00-A3-4)
  stage = 'nav_hint';
  await adm.setViewportSize({ width: 1280, height: 640 });
  await adm.goto(S.bo + '/dashboard'); await adm.waitForTimeout(1200);
  const hint = adm.getByTestId('nav-more'); await hint.waitFor();
  const hintText = await hint.innerText(); assert.match(hintText, /Aşağıda \d+ bölüm daha/);
  await shot(adm, 'nav-more-hint-1280x640');
  await hint.click(); await adm.waitForTimeout(800);
  const scrolled = await adm.locator('nav[aria-label="Yönetim bölümleri"]').evaluate((n) => n.scrollTop);
  assert.ok(scrolled > 0, 'hint scrolls the menu');
  await adm.setViewportSize({ width: 1280, height: 800 });
  pass('sidebar_hidden_sections_hint', { hint: hintText, scrolled });

  // 8) Yönetici yetkisi açık oturumda kalkar: tek bildirim (Q00-A3-7)
  stage = 'admin_revocation';
  await adm.goto(S.bo + '/families'); await adm.waitForTimeout(1500);
  sql(`delete from public.admins where user_id='${F.admin.id}';`);
  await adm.evaluate(() => window.dispatchEvent(new Event('focus')));
  await adm.getByTestId('admin-revoked').waitFor();
  assert.equal(await adm.getByText('Yönetici yetkiniz kaldırıldı.').count(), 1);
  const navAfter = await adm.locator('nav[aria-label="Yönetim bölümleri"]').innerText().catch(() => '');
  assert.ok(!/Aileler|Operatör kapsamları/.test(navAfter), 'admin sections must leave the menu');
  await both(adm, 'admin-revoked');
  const after = await pageRpc(adm, 'admin_operator_scopes');
  assert.ok(after.status >= 400, 'server refuses with the same token');
  sql(`insert into public.admins(user_id) values('${F.admin.id}');`);
  pass('admin_revocation_single_notice', { rpc_status: after.status });

  // 9) Mobil: veli soru bazlı notu görür (390×844)
  stage = 'mobile_export';
  const dist = path.join(work, 'web-' + DB.slice(8, 24));
  run('pnpm', ['exec', 'expo', 'export', '-p', 'web', '--output-dir', dist, '--clear'], { cwd: root + '/apps/mobile', env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: S.url, EXPO_PUBLIC_SUPABASE_ANON_KEY: S.anon, CI: '1' } });
  const webPort = await freePort();
  serve = spawn('node', [root + '/scripts/u02/serve-spa.mjs', dist, String(webPort)], { stdio: 'ignore' });
  const WEB = `http://127.0.0.1:${webPort}`; await healthy(webPort, '/');
  stage = 'mobile_notes';
  const phone = await newPage(390, 844, true);
  await phone.goto(WEB); await phone.getByLabel('E-posta', { exact: true }).fill(F.parent.email); await phone.getByLabel('Şifre', { exact: true }).fill(F.parent.password);
  await button(phone, 'Giriş yap').click(); await phone.waitForURL('**/parent', { timeout: 40000 });
  await phone.goto(WEB + '/parent/prova/share'); await phone.getByTestId('contribution-chains').waitFor();
  const notes = phone.getByTestId('question-notes').first(); await notes.waitFor();
  await notes.getByText(t('contributionTrail.questionNotes'), { exact: true }).waitFor();
  await notes.getByText('Pastanın yarısı 4 dilimdir; cevap 5 yazılmış.', { exact: true }).waitFor();
  await notes.getByText(t('contributionTrail.questionLabel', { position: 2, excerpt: 'Pastanın yarısı kaç dilimdir?' }), { exact: true }).waitFor();
  await notes.getByText(t('contributionTrail.questionsOk_one', { count: 1 }), { exact: true }).waitFor();
  await notes.scrollIntoViewIfNeeded();
  const trailText = await shot(phone, 'mobile-trail-question-notes-390', { full: true });
  assert.ok(!uuidRe.test(trailText), 'raw id visible on trail');
  await phone.goto(`${WEB}/parent/prova/share?questionId=${F.q1}&supersedes=${F.groupSet}`);
  const fix = phone.getByTestId('contribution-fix'); await fix.waitFor();
  await fix.getByTestId('question-notes').getByText('Pastanın yarısı 4 dilimdir; cevap 5 yazılmış.', { exact: true }).waitFor();
  await fix.getByText(t('contributionTrail.atomic'), { exact: true }).waitFor();
  await fix.scrollIntoViewIfNeeded();
  await shot(phone, 'mobile-fix-question-notes-390', { full: true });
  // Başka aile notu göremez (sunucu)
  pass('parent_sees_question_notes_on_trail_and_fix_screen');

  for (const p of pages) assert.deepEqual(p.errors, [], 'page errors');
  pass('no_page_errors_no_overflow_no_raw_keys');
})().then(() => finish(0), (e) => finish(1, e));

async function finish(code, error) {
  if (error) {
    console.log('CHECK_FAILED ' + stage + ' ' + String(error.message).slice(0, 900));
    for (const [i, page] of pages.entries()) {
      await page.screenshot({ path: path.join(work, `d3-failed-${i}.png`), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(work, `d3-failed-${i}.txt`), (await page.locator('body').innerText().catch(() => '')) + '\nERRORS ' + JSON.stringify(page.errors));
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
  const report = { environment: 'disposable-local-gotrue-postgrest (own clone of gina_completion_audit)', database_pattern: 'gina_d3_<hex>_audit',
    viewports: { backoffice: ['1280x800', '768x1024', '1280x640 (menu hint)'], mobile: ['390x844'] }, passed: code === 0, failed_stage: code ? stage : undefined, results, cleanup };
  fs.writeFileSync(out + (code === 0 ? '/ui-checks.json' : '/ui-checks-failed.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, code, cleanup }));
  process.exit(code || (cleanup.containers_left !== 'none' || cleanup.database_left !== '0' ? 1 : 0));
}
