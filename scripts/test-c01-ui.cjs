// C01 UI follow-up checks against a disposable local stack.
// Creates its own `gina_c01ui_<hex>_audit` DB from the empty `gina_completion_audit` template, starts temporary
// GoTrue + PostgREST containers on ephemeral ports, exports the Expo web build and the static backoffice against a
// loopback proxy, drives both with Playwright (390x844 and 1280x800) and removes every container/DB it created.
// Synthetic @example.invalid accounts only; no secrets written to the repo.
// Usage: GINA_QA_PLAYWRIGHT_PATH=<playwright module> GINA_C01UI_WORK=<scratch dir> node scripts/test-c01-ui.cjs --run-local
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
if (!process.argv.includes('--run-local')) throw Error('Explicit --run-local required');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const work = process.env.GINA_C01UI_WORK; assert.ok(work && path.isAbsolute(work), 'GINA_C01UI_WORK required');
const out = root + '/docs/release/c01-2026-11-06/ui'; fs.mkdirSync(out + '/screenshots', { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const t = (key, vars = {}) => {
  let s = tr[key];
  if (s === undefined) s = key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tr);
  assert.ok(typeof s === 'string', 'missing key ' + key);
  for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v));
  return s;
};
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const DB = 'gina_c01ui_' + randomBytes(8).toString('hex') + '_audit';
const containers = []; let created = false, proxy, serve, statics, browser, stage = 'setup', builtBackoffice = false;
const results = []; const pass = (check, extra = {}) => { results.push({ check, passed: true, ...extra }); console.log('ok', check); };
const cleanup = {};

// ---------- local Postgres (the shared supabase_db_gina server, only our own database) ----------
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
const claimsSql = (claims, body) => sql(`begin; set local role authenticated; select set_config('request.jwt.claims',${lit(JSON.stringify(claims))},true);\n${body}\ncommit;`);
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
  assert.ok(versions.length && versions.every((v) => /^\d{1,14}$/.test(v)));
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

// ---------- synthetic accounts and data ----------
let S;
async function api(method, p, body, token, key = S.anon) {
  const res = await fetch(S.url + p, { method, headers: { apikey: key, authorization: 'Bearer ' + (token || key), 'content-type': 'application/json', prefer: 'return=representation' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}
async function user() {
  const email = `gina-c01ui-${randomBytes(6).toString('hex')}@example.invalid`, password = randomBytes(18).toString('base64url') + 'aA1!';
  const r = await api('POST', '/auth/v1/admin/users', { email, password, email_confirm: true }, S.service, S.service); assert.ok(r.ok, 'create user ' + r.status);
  return { id: r.data.id, email, password };
}
async function login(u) { const r = await api('POST', '/auth/v1/token?grant_type=password', { email: u.email, password: u.password }); assert.ok(r.ok, 'login ' + r.status); return r.data.access_token; }
const rpc = async (token, name, args) => api('POST', '/rest/v1/rpc/' + name, args, token);

const BUNDLE = {
  schema: 'gina.curriculum-review.v1', candidates: [{
    key: 'tr-2026-2027-t1-c01ui-g5', academic_year: '2026-2027', term: 1, exam: 1, grade: 5, subject: 'Türkçe',
    source_url: 'https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx', source_sha256: '6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee',
    sheet: '5. Sınıf', header_cell: 'C6', question_count: 3,
    blocks: [{ count: 2, count_cell: 'C12', outcomes: [{ cell: 'B12', text: 'T.O.5.6. Metnin yüzey anlamını belirleyebilme', code: 'T.O.5.6' }] },
      { count: 1, count_cell: 'C13', outcomes: [{ cell: 'B13', text: 'T.O.5.7. Görselle iletilen anlamı belirleyebilme', code: 'T.O.5.7' }] }],
    label: 'Senaryo 1', review_reasons: ['programme_and_school_scope_required', 'source_review_required'],
  }],
};
const REVIEW = { programme: 'Sentetik program sürümü', school_scope: 'Yalnız test için sentetik kapsam', programme_url: 'https://tymm.meb.gov.tr/ogretim-programlari', source_checked: true, counts_checked: true, applicability_checked: true, issues_resolution: 'Sentetik kanıt yalnız test için incelendi.', note: 'Test incelemesi; gerçek katalog onayı değil.' };

async function fixture() {
  const admin = await user(), A = await user();
  const r = await rpc(await login(A), 'create_family', { p_name: 'Sentetik aile C01', p_display_name: 'Sentetik veli' }); assert.ok(r.ok, 'create_family ' + JSON.stringify(r.data).slice(0, 200)); A.family = r.data;
  const ece = randomUUID(), arda = randomUUID();
  const adminClaims = { sub: admin.id, role: 'authenticated', gina: { admin: true } };
  sql(`insert into public.admins(user_id) values('${admin.id}');
    insert into public.children(id,family_id,name,grade,sort_order) values('${ece}','${A.family}','Ece',5,0),('${arda}','${A.family}','Arda',5,1);
    insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('${A.family}','plus','C01 UI synthetic',now()+interval '1 day');
    update public.app_settings set value='true' where key='curriculum_catalog.enabled';`);
  // Catalogue: the real admin import → review → publish chain (108 recipe).
  claimsSql(adminClaims, `select public.admin_import_curriculum_candidates(gen_random_uuid(),${lit(JSON.stringify(BUNDLE))}::jsonb);`);
  const cat = sql(`select id from gina.curriculum_candidates where external_key='tr-2026-2027-t1-c01ui-g5';`);
  assert.match(cat, /^[0-9a-f-]{36}$/);
  claimsSql(adminClaims, `select public.admin_change_curriculum_candidate(gen_random_uuid(),'${cat}',0,'review',${lit(JSON.stringify(REVIEW))}::jsonb,'Test review',true);
    select public.admin_change_curriculum_candidate(gen_random_uuid(),'${cat}',1,'publish',null,'Test publication',true);`);
  assert.equal(sql(`select status||':'||revision from gina.curriculum_candidates where id='${cat}';`), 'published:2');
  // Legacy auto-zero attempts (108 recipe): L1 drawing-only blank → stored 33; L2 parent 80 + blank → stored 60;
  // L3 fully parent graded (not a candidate); L4 Arda (archived later → blocked).
  const q = { mc: randomUUID(), o1: randomUUID(), o2: randomUUID() }, ex = { l1: randomUUID(), l2: randomUUID(), l3: randomUUID(), l4: randomUUID() }, at = { l1: randomUUID(), l2: randomUUID(), l3: randomUUID(), l4: randomUUID() };
  const doc = JSON.stringify({ version: 1, width: 1000, height: 1400, elements: [{ id: randomUUID(), type: 'stroke', color: '#201951', size: 4, points: [[100, 100], [200, 220], [300, 260]] }] });
  sql(`insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer) values
     ('${q.mc}','${A.family}',5,'Fen','Işık','multiple_choice','Işık kaynağı hangisi?','[{"key":"A","text":"Güneş"},{"key":"B","text":"Ay"}]','A',null),
     ('${q.o1}','${A.family}',5,'Fen','Güneş','open_ended','Güneş neden ışık kaynağıdır?',null,null,'Kendi ışığını üretir.'),
     ('${q.o2}','${A.family}',5,'Fen','Ay','open_ended','Ay neden ışık kaynağı değildir?',null,null,'Işığı yansıtır.');
    insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values
     ('${ex.l1}','${A.family}','${ece}','Işık denemesi 1','Fen',5,array['${q.mc}','${q.o1}','${q.o2}']::uuid[],'completed'),
     ('${ex.l2}','${A.family}','${ece}','Işık denemesi 2','Fen',5,array['${q.mc}','${q.o1}','${q.o2}']::uuid[],'completed'),
     ('${ex.l3}','${A.family}','${ece}','Güneş tekrarı','Fen',5,array['${q.o1}']::uuid[],'completed'),
     ('${ex.l4}','${A.family}','${arda}','Ay denemesi','Fen',5,array['${q.o2}']::uuid[],'completed');
    insert into public.exam_attempts(id,family_id,exam_id,child_id,status,started_at,finished_at,graded_at,mc_total,mc_correct,open_total,open_graded,score_pct,provisional) values
     ('${at.l1}','${A.family}','${ex.l1}','${ece}','in_progress',now()-interval '9 days',now()-interval '9 days',now()-interval '9 days',1,1,2,2,33,null),
     ('${at.l2}','${A.family}','${ex.l2}','${ece}','in_progress',now()-interval '8 days',now()-interval '8 days',now()-interval '8 days',1,1,2,2,60,null),
     ('${at.l3}','${A.family}','${ex.l3}','${ece}','in_progress',now()-interval '7 days',now()-interval '7 days',now()-interval '7 days',0,0,1,1,70,null),
     ('${at.l4}','${A.family}','${ex.l4}','${arda}','in_progress',now()-interval '5 days',now()-interval '5 days',now()-interval '5 days',0,0,1,1,0,null);
    insert into public.exam_answers(attempt_id,question_id,answer_key,is_correct,answer_text,answer_document,score,graded_by,graded_at) values
     ('${at.l1}','${q.mc}','A',true,null,null,null,null,null),
     ('${at.l1}','${q.o1}',null,null,'',${lit(doc)}::jsonb,null,null,null),
     ('${at.l2}','${q.mc}','A',true,null,null,null,null,null),
     ('${at.l2}','${q.o1}',null,null,'Kendi ışığını üretir',null,80,'parent',now()-interval '8 days'),
     ('${at.l2}','${q.o2}',null,null,'',null,null,null,null),
     ('${at.l3}','${q.o1}',null,null,'Cevap',null,70,'parent',now()-interval '7 days'),
     ('${at.l4}','${q.o2}',null,null,'',null,null,null,null);
    update public.exam_attempts set status='graded' where id in('${at.l1}','${at.l2}','${at.l3}','${at.l4}');`);
  claimsSql({ sub: A.id, role: 'authenticated', gina: { family_id: A.family, role: 'parent' } }, `select public.set_child_archived('${randomUUID()}','${arda}',0,true);`);
  assert.equal(sql(`select count(*) from public.exam_attempts where family_id='${A.family}' and status='graded' and provisional is null;`), '4');
  return { admin, A, ece, arda, cat, at, adminClaims };
}

// ---------- browser helpers ----------
const pages = [];
async function newPage(size) {
  const context = await browser.newContext({ viewport: sizes[size], locale: 'tr-TR', hasTouch: size === 'phone', isMobile: size === 'phone', timezoneId: 'Europe/Istanbul' });
  const page = await context.newPage(); page.setDefaultTimeout(25000); page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message)); pages.push(page); return page;
}
const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
async function shot(page, name, { focus, ids = false, codes = false } = {}) {
  if (focus) await page.getByTestId(focus).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/screenshots/${name}.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': horizontal overflow');
  const text = await page.locator('body').innerText();
  assert.ok(!/c01ui\.|provaP02\.|catalogFlow\./.test(text), name + ': raw i18n key visible');
  if (!ids) assert.ok(!uuidRe.test(text), name + ': raw id visible');
  // Operator panels may name the server code on purpose; parent screens never do.
  if (!codes) assert.ok(!/P0001|42501|PGRST|event_archived|blueprint_provenance_locked/.test(text), name + ': raw server error visible');
}
async function signIn(page, u, WEB) {
  await page.goto(WEB); await page.getByLabel('E-posta', { exact: true }).fill(u.email); await page.getByLabel('Şifre', { exact: true }).fill(u.password);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await page.waitForURL('**/parent', { timeout: 40000 });
}
const button = (page, name) => page.getByRole('button', { name, exact: true });
const next = (page) => button(page, t('betaUx.continue')).last();
const provenanceOf = (id) => sql(`select school_scenario||'|'||distribution_kind||'|'||school_confirmed||'|'||official_source_verified||'|'||coalesce(personalization->>'basis','-') from public.exam_blueprints where id='${id}';`);
async function catalogScope(page, WEB) {
  await page.goto(WEB + '/parent/prova/catalog');
  await page.getByText('Türkçe', { exact: true }).first().click();
  await next(page).click();
}
const savedLabel = async (page) => (await page.getByTestId('blueprint-provenance-label').last().innerText()).trim();

(async () => {
  stage = 'stack'; S = await setupStack();
  stage = 'fixture'; const F = await fixture();
  const tokenA = await login(F.A);

  stage = 'export';
  const dist = path.join(work, 'web-' + DB.slice(11, 27));
  run('pnpm', ['exec', 'expo', 'export', '-p', 'web', '--output-dir', dist, '--clear'], { cwd: root + '/apps/mobile', env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: S.url, EXPO_PUBLIC_SUPABASE_ANON_KEY: S.anon, CI: '1' } });
  const webPort = await freePort();
  serve = spawn('node', [root + '/scripts/u02/serve-spa.mjs', dist, String(webPort)], { stdio: 'ignore' });
  const WEB = `http://127.0.0.1:${webPort}`; await healthy(webPort, '/');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const phone = await newPage('phone'); await signIn(phone, F.A, WEB);

  // 1) Okulun senaryosu: catalogue + "biliyorum" + explicit school confirmation.
  stage = 'path_school';
  await catalogScope(phone, WEB);
  await phone.getByText(t('provaP02.catalog.known'), { exact: true }).click();
  await phone.getByText('Senaryo 1', { exact: true }).first().click();
  await next(phone).click();
  await phone.getByRole('switch', { name: t('catalogFlow.confirm') }).click();
  await button(phone, t('catalogFlow.save')).last().click();
  await phone.getByTestId('blueprint-provenance').waitFor();
  assert.equal(await savedLabel(phone), t('c01ui.provenance.school_confirmed'));
  await phone.getByText(t('c01ui.provenance.officialNo'), { exact: true }).waitFor();
  const schoolBp = sql(`select id from public.exam_blueprints where family_id='${F.A.family}' and distribution_kind='school_catalogue';`);
  assert.equal(provenanceOf(schoolBp), 'known|school_catalogue|true|false|-');
  await shot(phone, 'p1-school-confirmed-saved-phone', { focus: 'blueprint-provenance' });
  pass('path_school_catalogue_label_from_server', { server: provenanceOf(schoolBp), label: t('c01ui.provenance.school_confirmed') });

  // 2) Henüz bilmiyorum → çalışma senaryosu (no school confirmation).
  stage = 'path_study';
  await catalogScope(phone, WEB);
  await phone.getByText(t('provaP02.catalog.unknown'), { exact: true }).click();
  await phone.getByText(`${t('provaP02.catalog.studyTag')} · Senaryo 1`, { exact: true }).click();
  await next(phone).click();
  await button(phone, t('provaP02.catalog.useAsStudy')).last().click();
  await phone.waitForURL('**/parent/prova/blueprint**');
  await next(phone).click();
  await phone.getByRole('switch', { name: t('provaP02.catalog.studyConfirm') }).click();
  await button(phone, t('common.save')).last().click();
  await phone.getByTestId('blueprint-provenance').waitFor();
  assert.equal(await savedLabel(phone), t('c01ui.provenance.study'));
  const studyBp = sql(`select id from public.exam_blueprints where family_id='${F.A.family}' and school_scenario='unknown';`);
  assert.equal(provenanceOf(studyBp), 'unknown|parent_study|false|false|-');
  await shot(phone, 'p2-study-no-school-confirmation-phone', { focus: 'blueprint-provenance' });
  pass('path_unknown_study_label_from_server', { server: provenanceOf(studyBp), label: t('c01ui.provenance.study') });

  // 3) Biliyorum ama dağılımı değiştir → kişiselleştirilmiş.
  stage = 'path_personalized';
  await catalogScope(phone, WEB);
  await phone.getByText(t('provaP02.catalog.known'), { exact: true }).click();
  // The saved catalogue copy of path 1 is shown under the scenario with its server origin.
  await phone.getByText(t('c01ui.provenance.savedCopy'), { exact: true }).waitFor();
  await shot(phone, 'p3a-catalog-saved-copy-not-official-phone', { focus: 'blueprint-provenance' });
  await phone.getByText('Senaryo 1', { exact: true }).first().click();
  await next(phone).click();
  await button(phone, t('provaP02.catalog.customize')).click();
  await phone.waitForURL('**/parent/prova/blueprint**');
  await button(phone, t('blueprintFlow.less', { count: 1 })).click();
  await phone.getByText(t('provaP02.catalog.personalizedTag'), { exact: true }).first().waitFor();
  await next(phone).click();
  await phone.getByRole('switch', { name: t('provaP02.catalog.studyConfirm') }).click();
  await button(phone, t('common.save')).last().click();
  await phone.getByTestId('blueprint-provenance').waitFor();
  assert.equal(await savedLabel(phone), t('c01ui.provenance.personalized'));
  await phone.getByText(t('c01ui.provenance.personalizedFrom', { label: 'Senaryo 1', total: 3 }), { exact: true }).waitFor();
  const persBp = sql(`select id from public.exam_blueprints where family_id='${F.A.family}' and distribution_kind='personalized';`);
  assert.equal(provenanceOf(persBp), 'known|personalized|false|false|catalogue_seed');
  await shot(phone, 'p3-personalized-saved-phone', { focus: 'blueprint-provenance' });
  pass('path_personalized_label_from_server', { server: provenanceOf(persBp), label: t('c01ui.provenance.personalized') });

  // 3b) Elle girilen dağılım (katalog yok, beyan sorulmadı) → veli dağılımı.
  stage = 'path_parent_manual';
  await phone.goto(WEB + '/parent/prova/blueprint');
  await phone.getByLabel(t('grades.subject'), { exact: true }).fill('Matematik');
  await next(phone).click();
  await phone.getByLabel(t('prova.blueprintName'), { exact: true }).fill('Kesir çalışması');
  await phone.getByLabel(t('blueprintFlow.topic', { count: 1 }), { exact: true }).fill('Kesirlerle toplama');
  await next(phone).click();
  await phone.getByRole('switch', { name: t('blueprintFlow.confirm') }).click();
  await button(phone, t('common.save')).last().click();
  await phone.getByTestId('blueprint-provenance').waitFor();
  assert.equal(await savedLabel(phone), t('c01ui.provenance.parent'));
  const manualBp = sql(`select id from public.exam_blueprints where family_id='${F.A.family}' and name='Kesir çalışması';`);
  assert.equal(provenanceOf(manualBp), 'unstated|parent_study|false|false|-');
  await shot(phone, 'p3b-parent-distribution-saved-phone', { focus: 'blueprint-provenance' });
  pass('path_manual_parent_distribution_label_from_server', { server: provenanceOf(manualBp), label: t('c01ui.provenance.parent') });

  // 4) Backoffice: read-only official verification panel; the documented command is executed verbatim.
  stage = 'backoffice_build';
  const boOut = root + '/apps/backoffice/out';
  const bo = spawnSync('pnpm', ['build'], { cwd: root + '/apps/backoffice', env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: S.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: S.anon } });
  assert.equal(bo.status, 0, 'backoffice build failed: ' + String(bo.stderr).slice(-400)); builtBackoffice = true;
  statics = http.createServer((req, res) => {
    let u = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (u.endsWith('/')) u += 'index';
    const file = [boOut + u, boOut + u + '.html'].find((c) => c.startsWith(boOut) && fs.existsSync(c) && fs.statSync(c).isFile());
    if (!file) { res.writeHead(404); res.end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain' };
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => statics.listen(0, '127.0.0.1', r));
  const BO = `http://127.0.0.1:${statics.address().port}`;
  stage = 'backoffice_panel';
  const deskBo = await newPage('desktop');
  await deskBo.goto(BO + '/sign-in');
  await deskBo.getByLabel('E-posta', { exact: true }).fill(F.admin.email); await deskBo.getByLabel('Şifre', { exact: true }).fill(F.admin.password);
  await deskBo.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await deskBo.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 40000 });
  await deskBo.goto(BO + '/library?tab=curriculum');
  await deskBo.getByText('Senaryo 1 · 3 soru', { exact: true }).first().click();
  const panel = deskBo.getByTestId('official-verification-ops');
  await panel.locator('summary').click();
  const pre = panel.getByLabel('İşletim komutu');
  await pre.waitFor();
  const command = await pre.innerText();
  assert.ok(command.includes(`'${F.cat}'`) && command.includes("source_context->>'revision' = '2'"), 'command filled with selected catalogue revision');
  assert.ok(command.includes('set local role service_role'));
  await shot(deskBo, 'b1-official-verification-ops-desktop', { focus: 'official-verification-ops', ids: true, codes: true });
  // The panel never writes: an admin JWT cannot mark verification (row invisible → 0 rows; RLS) and there is no RPC.
  const adminTry = await api('PATCH', `/rest/v1/exam_blueprints?id=eq.${schoolBp}`, { official_source_verified: true, official_verified_at: new Date().toISOString() }, await login(F.admin));
  assert.ok(!adminTry.ok || (Array.isArray(adminTry.data) && adminTry.data.length === 0), 'admin JWT must not mark verification');
  const parentTry = await api('PATCH', `/rest/v1/exam_blueprints?id=eq.${schoolBp}`, { official_source_verified: true, official_verified_at: new Date().toISOString() }, tokenA);
  assert.equal(parentTry.ok, false); assert.equal(parentTry.data.message, 'blueprint_provenance_locked');
  // Operator step: the exact text shown on the page (preview count, then update as service_role).
  const preview = sql(command.split('-- 2)')[0]);
  assert.equal(preview, '1', 'preview counts the single unverified copy');
  sql(command);
  assert.equal(provenanceOf(schoolBp), 'known|school_catalogue|true|true|-');
  assert.equal(provenanceOf(studyBp), 'unknown|parent_study|false|false|-');
  assert.equal(provenanceOf(persBp), 'known|personalized|false|false|catalogue_seed');
  assert.equal(sql(command.split('-- 2)')[0]), '0', 'second preview: nothing left');
  pass('backoffice_read_only_panel_and_documented_service_role_command', { admin_patch_rows: Array.isArray(adminTry.data) ? adminTry.data.length : adminTry.status, parent_patch: parentTry.data.message, preview_before: 1, preview_after: 0 });

  stage = 'official_visible';
  await catalogScope(phone, WEB);
  await phone.getByText(t('provaP02.catalog.known'), { exact: true }).click();
  await phone.getByText(t('c01ui.provenance.savedCopy'), { exact: true }).waitFor();
  const officialText = await phone.getByTestId('blueprint-provenance-official').first().innerText();
  assert.ok(officialText.startsWith(t('c01ui.provenance.officialYes', { date: '' }).replace(/\s*$/, '')), officialText);
  assert.equal((await phone.getByTestId('blueprint-provenance-label').first().innerText()).trim(), t('c01ui.provenance.school_confirmed'));
  await shot(phone, 'p4-catalog-copy-officially-verified-phone', { focus: 'blueprint-provenance' });
  const desk = await newPage('desktop'); await signIn(desk, F.A, WEB);
  await catalogScope(desk, WEB);
  await desk.getByText(t('provaP02.catalog.known'), { exact: true }).click();
  await desk.getByTestId('blueprint-provenance-official').first().waitFor();
  await shot(desk, 'p4-catalog-copy-officially-verified-desktop');
  pass('official_verification_shown_separately_from_school_confirmation', { text: officialText });

  // 5) Legacy auto-zero correction: preview → select → apply (lost response) → same request again → audit.
  stage = 'legacy_preview';
  const answersHash = () => sql(`select md5(string_agg(attempt_id::text||question_id::text||coalesce(score::text,'-')||coalesce(graded_by::text,'-')||coalesce(answer_text,'-'),',' order by attempt_id,question_id)) from public.exam_answers;`);
  const hashBefore = answersHash();
  await phone.goto(WEB + '/parent/prova/progress');
  await phone.getByText(t('c01ui.legacy.entry', { count: 3 }), { exact: true }).click();
  await phone.getByTestId('legacy-zero-sheet').waitFor();
  await phone.getByText(t('c01ui.legacy.keeps'), { exact: true }).waitFor();
  await phone.getByText(t('c01ui.legacy.attempt', { child: 'Ece', exam: 'Işık denemesi 1' }), { exact: true }).waitFor();
  await phone.getByText(t('c01ui.legacy.score', { before: '%33', after: '%100' }), { exact: true }).waitFor();
  await phone.getByText(t('c01ui.legacy.score', { before: '%60', after: '%90' }), { exact: true }).waitFor();
  await phone.getByText(t('c01ui.legacy.kept', { count: 1 }), { exact: true }).first().waitFor();
  await phone.getByText(t('c01ui.legacy.blocked'), { exact: true }).waitFor();
  assert.equal(await phone.getByText(t('c01ui.legacy.attempt', { child: 'Ece', exam: 'Güneş tekrarı' }), { exact: true }).count(), 0, 'fully parent-graded attempt is not listed');
  assert.equal(await phone.getByTestId('legacy-zero-attempt').count(), 3);
  await phone.getByText(t('c01ui.legacy.auditEmpty'), { exact: true }).waitFor();
  await shot(phone, 'l1-legacy-preview-phone', { focus: 'legacy-zero-sheet' });
  pass('legacy_preview_lists_affected_attempts_keeps_given_scores_blocks_archived');

  stage = 'legacy_apply';
  await phone.getByRole('switch', { name: t('c01ui.legacy.select', { exam: 'Işık denemesi 1' }) }).click();
  await phone.getByRole('switch', { name: t('c01ui.legacy.select', { exam: 'Işık denemesi 2' }) }).click();
  await phone.getByRole('switch', { name: t('c01ui.legacy.confirm') }).click();
  // Lose the first response after the server committed it.
  let lost = 0;
  await phone.route('**/rest/v1/rpc/apply_legacy_open_zero_corrections', async (r) => {
    if (lost++ === 0) { await r.fetch(); await r.abort('failed'); } else await r.continue();
  });
  await button(phone, t('c01ui.legacy.apply', { count: 2 })).click();
  await phone.getByTestId('legacy-zero-error').waitFor();
  await phone.getByText(t('c01ui.legacy.errors.unknown'), { exact: true }).waitFor();
  assert.equal(sql(`select count(*) from gina.attempt_score_corrections where family_id='${F.A.family}';`), '2', 'server committed before the response was lost');
  await shot(phone, 'l2-legacy-lost-response-retry-phone', { focus: 'legacy-zero-error' });
  await button(phone, t('c01ui.legacy.retry')).click();
  await phone.getByTestId('legacy-zero-result').waitFor();
  await phone.getByText(t('c01ui.legacy.done', { count: 2 }), { exact: true }).waitFor();
  const corrections = sql(`select count(*)||'|'||count(distinct request_id) from gina.attempt_score_corrections where family_id='${F.A.family}';`);
  assert.equal(corrections, '2|1', 'retry used the same request id; corrections written once');
  const requestId = sql(`select distinct request_id from gina.attempt_score_corrections where family_id='${F.A.family}';`);
  assert.equal(sql(`select count(*) from public.mutation_receipts where request_id='${requestId}';`), '1');
  assert.equal(answersHash(), hashBefore, 'exam_answers (given scores, answers) unchanged');
  const totals = sql(`select string_agg(score_pct::text||':'||status||':'||provisional,',' order by finished_at) from public.exam_attempts where id in('${F.at.l1}','${F.at.l2}');`);
  // Same request again (API): identical receipt; a new request: already_corrected; nothing new written.
  const ids = [F.at.l1, F.at.l2];
  const replay = await rpc(tokenA, 'apply_legacy_open_zero_corrections', { p_request_id: requestId, p_attempt_ids: [...ids].reverse() });
  const stored = JSON.parse(sql(`select result::text from public.mutation_receipts where request_id='${requestId}';`));
  assert.deepEqual(replay.data, stored, 'same request id returns the same result');
  assert.equal(replay.data.corrected, 2);
  const fresh = await rpc(tokenA, 'apply_legacy_open_zero_corrections', { p_request_id: randomUUID(), p_attempt_ids: ids });
  assert.deepEqual(fresh.data.results.map((x) => x.result), ['already_corrected', 'already_corrected']);
  assert.equal(fresh.data.corrected, 0);
  assert.equal(sql(`select count(*) from gina.attempt_score_corrections where family_id='${F.A.family}';`), '2');
  await shot(phone, 'l3-legacy-applied-phone', { focus: 'legacy-zero-result' });
  pass('legacy_apply_lost_response_retry_same_request_idempotent', { db_corrections: corrections, totals_after: totals, replay_equal_receipt: true, new_request: 'already_corrected x2', answers_hash_unchanged: true });

  stage = 'legacy_audit';
  await phone.reload();
  await phone.getByText(t('c01ui.legacy.entry', { count: 1 }), { exact: true }).click();
  await phone.getByTestId('legacy-zero-audit').waitFor();
  await phone.getByText(t('c01ui.legacy.attempt', { child: 'Ece', exam: 'Işık denemesi 1' }), { exact: true }).waitFor();
  const auditText = await phone.getByTestId('legacy-zero-audit').innerText();
  assert.ok(auditText.includes(`${t('c01ui.legacy.role.parent')} · %33 → %100`), auditText);
  assert.ok(auditText.includes(`${t('c01ui.legacy.role.parent')} · %60 → %90`), auditText);
  assert.equal(await phone.getByTestId('legacy-zero-attempt').count(), 1, 'only the blocked (archived profile) attempt remains');
  await shot(phone, 'l4-legacy-audit-phone', { focus: 'legacy-zero-audit' });
  await desk.goto(WEB + '/parent/prova/progress');
  await desk.getByText(t('c01ui.legacy.entry', { count: 1 }), { exact: true }).click();
  await desk.getByTestId('legacy-zero-audit').waitFor();
  await shot(desk, 'l4-legacy-audit-desktop');
  pass('legacy_audit_trail_visible_after_reload', { audit_rows: 2 });

  // 6) Archived calendar event: clear message + restore guidance; after restore the edit works.
  stage = 'calendar_archived';
  const evId = randomUUID(), today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const created = await rpc(tokenA, 'save_calendar_event', { p_request_id: randomUUID(), p_event_id: evId, p_revision: 0, p_values: { title: 'Yüzme dersi', type: 'activity', child_id: F.ece, starts_at: `${today}T15:00:00+03:00`, ends_at: `${today}T16:00:00+03:00`, all_day: false, location: null, rrule: null } });
  assert.ok(created.ok, 'event ' + JSON.stringify(created.data).slice(0, 300));
  await phone.goto(`${WEB}/parent/calendar?date=${today}`);
  await phone.getByText('Yüzme dersi', { exact: false }).first().click();
  await button(phone, t('common.save')).last().waitFor();
  const rev = Number(sql(`select edit_revision from public.events where id='${evId}';`));
  const arch = await rpc(tokenA, 'bulk_archive_apply', { p_items: [{ type: 'event', id: evId, revision: rev }], p_idempotency_key: randomUUID() });
  assert.ok(arch.ok && arch.data.summary.ok === 1, 'archive ' + JSON.stringify(arch.data).slice(0, 300));
  await button(phone, t('common.save')).last().click();
  await phone.getByText(t('c01ui.calendar.eventArchived'), { exact: true }).waitFor();
  assert.equal(sql(`select title||'|'||(archived_at is not null) from public.events where id='${evId}';`), 'Yüzme dersi|true');
  await phone.getByText(t('c01ui.calendar.eventArchived'), { exact: true }).scrollIntoViewIfNeeded();
  await shot(phone, 'c1-archived-event-message-phone');
  const restore = await rpc(tokenA, 'bulk_restore_apply', { p_items: [{ type: 'event', id: evId }], p_idempotency_key: randomUUID() });
  assert.ok(restore.ok && restore.data.summary.ok === 1, 'restore ' + JSON.stringify(restore.data).slice(0, 300));
  await phone.goto(`${WEB}/parent/calendar?date=${today}`);
  await phone.getByText('Yüzme dersi', { exact: false }).first().click();
  const titleField = phone.getByLabel(t('calendar.title'), { exact: true });
  await titleField.fill('Yüzme dersi (geri alındı)');
  await button(phone, t('common.save')).last().click();
  await phone.getByText('Yüzme dersi (geri alındı)', { exact: false }).first().waitFor();
  assert.equal(sql(`select title||'|'||(archived_at is null) from public.events where id='${evId}';`), 'Yüzme dersi (geri alındı)|true');
  // Desktop: the same message on a wide screen.
  const ev2 = randomUUID();
  await rpc(tokenA, 'save_calendar_event', { p_request_id: randomUUID(), p_event_id: ev2, p_revision: 0, p_values: { title: 'Kütüphane', type: 'activity', child_id: F.ece, starts_at: `${today}T17:00:00+03:00`, ends_at: `${today}T18:00:00+03:00`, all_day: false, location: null, rrule: null } });
  await desk.goto(`${WEB}/parent/calendar?date=${today}`);
  await desk.getByText('Kütüphane', { exact: false }).first().click();
  await button(desk, t('common.save')).last().waitFor();
  await rpc(tokenA, 'bulk_archive_apply', { p_items: [{ type: 'event', id: ev2, revision: Number(sql(`select edit_revision from public.events where id='${ev2}';`)) }], p_idempotency_key: randomUUID() });
  await button(desk, t('common.save')).last().click();
  await desk.getByText(t('c01ui.calendar.eventArchived'), { exact: true }).waitFor();
  await desk.getByText(t('c01ui.calendar.eventArchived'), { exact: true }).scrollIntoViewIfNeeded();
  await shot(desk, 'c1-archived-event-message-desktop');
  pass('archived_event_message_and_restore_then_edit', { archived_save: 'event_archived → message', after_restore: 'edit saved' });

  for (const page of pages) assert.deepEqual(page.errors, []);
  pass('no_runtime_errors_overflow_raw_ids_or_keys');
})().then(() => finish(0), (e) => finish(1, e));

function spawnSync(cmd, args, opts) { return require('node:child_process').spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 900000, ...opts }); }

async function finish(code, error) {
  if (error) {
    console.log('CHECK_FAILED ' + stage + ' ' + String(error.message).slice(0, 900));
    for (const [i, page] of pages.entries()) {
      await page.screenshot({ path: path.join(work, `failed-${i}.png`), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(work, `failed-${i}.txt`), (await page.locator('body').innerText().catch(() => '')) + '\nERRORS ' + JSON.stringify(page.errors));
    }
  }
  if (browser) await browser.close().catch(() => {});
  if (serve) serve.kill('SIGTERM');
  if (statics) await new Promise((r) => statics.close(r));
  if (proxy) await new Promise((r) => proxy.close(r));
  if (builtBackoffice) { fs.rmSync(root + '/apps/backoffice/out', { recursive: true, force: true }); cleanup.backoffice_out = 'removed'; }
  for (const name of containers.reverse()) { try { run('docker', ['rm', '-f', name]); cleanup[name.replace(DB, 'db')] = 'removed'; } catch { cleanup[name.replace(DB, 'db')] = 'FAILED'; } }
  if (created) { try { psql('postgres', `drop database ${DB} with (force);`); cleanup.database = 'dropped'; } catch { cleanup.database = 'FAILED'; } }
  cleanup.containers_left = run('docker', ['ps', '-a', '--filter', 'name=' + DB, '--format', '{{.Names}}']).trim() || 'none';
  cleanup.database_left = psql('postgres', `select count(*) from pg_database where datname='${DB}';`);
  const report = { environment: 'disposable-local-gotrue-postgrest (own clone of gina_completion_audit)', database_pattern: 'gina_c01ui_<hex>_audit', viewports: sizes, passed: code === 0, failed_stage: code ? stage : undefined, results, cleanup };
  if (code === 0) fs.writeFileSync(out + '/ui-checks.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, code, cleanup }));
  process.exit(code || (cleanup.containers_left !== 'none' || cleanup.database_left !== '0' ? 1 : 0));
}
