// C07/P05 mobile library / share / groups UI checks against a disposable local stack.
// Creates its own `gina_c07m_<hex>_audit` DB from the empty `gina_completion_audit` template,
// starts temporary GoTrue + PostgREST containers on ephemeral ports, exports the Expo web
// build against a loopback proxy, drives it with Playwright (390x844 and 1280x800) and removes
// every container/DB it created. Synthetic @example.invalid accounts only; no secrets written.
// Usage: GINA_QA_PLAYWRIGHT_PATH=<playwright module> GINA_C07M_WORK=<scratch dir> \
//        node scripts/test-c07-mobile-ui.cjs --run-local
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
if (!process.argv.includes('--run-local')) throw Error('Explicit --run-local required');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const work = process.env.GINA_C07M_WORK; assert.ok(work && path.isAbsolute(work), 'GINA_C07M_WORK required');
const out = root + '/docs/release/c07-2026-11-06/mobile'; fs.mkdirSync(out + '/screenshots', { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const t = (key, vars = {}) => { let s = tr[key]; assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const DB = 'gina_c07m_' + randomBytes(8).toString('hex') + '_audit';
const containers = []; let created = false, proxy, serve, browser, stage = 'setup';
const results = []; const pass = (check, extra = {}) => { results.push({ check, passed: true, ...extra }); console.log('ok', check); };
const cleanup = {};

// ---------- local Postgres (the shared supabase_db_gina server, only our own database) ----------
function run(cmd, args, opts = {}) { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 600000, stdio: ['pipe', 'pipe', 'pipe'], ...opts }); }
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
    const up = http.request({ hostname: '127.0.0.1', port: route[1], path: req.url.slice(route[0].length) || '/', method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res); });
    up.on('error', () => { res.writeHead(502, cors); res.end(); }); req.pipe(up);
  });
  proxy.on('upgrade', (_req, socket) => socket.destroy());
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${proxy.address().port}`, anon: jwt('anon', secret), service: jwt('service_role', secret) };
}

// ---------- synthetic accounts and data ----------
let S;
async function api(method, p, body, token, key = S.anon) {
  const res = await fetch(S.url + p, { method, headers: { apikey: key, authorization: 'Bearer ' + (token || key), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}
async function user() {
  const email = `gina-${randomUUID()}@example.invalid`, password = randomBytes(18).toString('base64url') + 'aA1!';
  const r = await api('POST', '/auth/v1/admin/users', { email, password, email_confirm: true }, S.service, S.service); assert.ok(r.ok, 'create user ' + r.status);
  return { id: r.data.id, email, password };
}
async function login(u) { const r = await api('POST', '/auth/v1/token?grant_type=password', { email: u.email, password: u.password }); assert.ok(r.ok, 'login ' + r.status); return r.data.access_token; }
const rpc = async (token, name, args) => api('POST', '/rest/v1/rpc/' + name, args, token);
const parentClaims = (u, family) => ({ sub: u.id, role: 'authenticated', gina: { family_id: family, role: 'parent' } });

async function fixture() {
  const admin = await user(), A = await user(), B = await user();
  for (const [u, name] of [[A, 'Sentetik aile A'], [B, 'Sentetik aile B']]) {
    const r = await rpc(await login(u), 'create_family', { p_name: name, p_display_name: 'Sentetik veli' }); assert.ok(r.ok, 'create_family ' + JSON.stringify(r.data).slice(0, 200)); u.family = r.data;
  }
  const childA = randomUUID(), childB = randomUUID();
  const adminClaims = { sub: admin.id, role: 'authenticated', gina: { admin: true } };
  sql(`update public.plans set library_monthly=3,cohort_monthly=5,prova_monthly_exams=null where code='free';
    update public.app_settings set value='true' where key in('library_packages.enabled','sources.enabled','question_groups.enabled','cohorts.enabled','contribution_sets.enabled');
    update public.contribution_rewards set enabled=false;
    insert into public.contribution_rewards(title,threshold,kind,amount,valid_days,enabled) values('Her 5 kabulde 3 hak',5,'library',3,30,true),('Her 10 kabulde 20 AI sorusu',10,'ai_questions',20,30,true);
    insert into public.admins(user_id) values('${admin.id}');
    insert into public.children(id,family_id,name,grade) values('${childA}','${A.family}','Ece',5),('${childB}','${B.family}','Can',5);
    insert into public.library_collections(id,title,grade,subject,status,plans) values('${S.collection = randomUUID()}','Kesirler tekrar',5,'Matematik','published',array['free']::public.plan_code[]);
    insert into public.library_items(id,collection_id,content,content_hash,status) values('${S.item = randomUUID()}','${S.collection}','{"grade":5,"subject":"Matematik","topic":"Kesirler","kind":"open_ended","difficulty":"orta","stem":"Bir pastanın 3/8 i yendi. Kalan kısım kaçta kaçtır?","expected_answer":"5/8","solution":"8/8 - 3/8 = 5/8"}','c07m-${randomUUID()}','draft');
    update public.library_items set status='published' where id='${S.item}';`);
  // Contribution chains: A and B each have one copy returned with a reason.
  for (const [u, note, stem] of [[A, 'Çözüm eksik: kenar uzunlukları yazılmamış.', 'Kısa kenarı 4 m, uzun kenarı 10 m olan dikdörtgenin çevresi kaç metredir?'], [B, 'B ailesine özel inceleme notu.', 'Bir karenin bir kenarı 6 cm ise çevresi kaç cm dir?']]) {
    u.question = randomUUID(); u.set = randomUUID();
    sql(`insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution) values('${u.question}','${u.family}',5,'Matematik','Çevre','open_ended','orta',${lit(stem)},'28','Kenarlar toplanır.');`);
    claimsSql(parentClaims(u, u.family), `select public.begin_question_contribution('${u.set}','${u.question}',true,true);`);
    claimsSql(adminClaims, `select public.admin_decide_contribution_set(gen_random_uuid(),'${u.set}',false,${lit(note)},'{}'::jsonb,true);`);
  }
  // Published package + automatic group exam (098 recipe), open for an hour.
  const t098 = fs.readFileSync(root + '/supabase/tests/098_library_credit_safety.test.sql', 'utf8').split('\n');
  const defs = t098.filter((l) => l.startsWith('create function pg_temp.base_bundle()') || l.startsWith('create function pg_temp.bundle()'));
  assert.equal(defs.length, 2, '098 bundle recipe not found');
  S.group = randomUUID();
  const ac = lit(JSON.stringify(adminClaims));
  sql(`begin;\n${defs.join('\n')}
    create temp table st(name text primary key,id uuid); grant all on st to authenticated,service_role;
    set local role authenticated; select set_config('request.jwt.claims',${ac},true);
    insert into st select 'rev1',(public.admin_import_library_bundle(gen_random_uuid(),pg_temp.bundle())->>'id')::uuid;
    select public.admin_review_library_question(gen_random_uuid(),(select id from st),'question-'||i,1,0,'suitable','ok') from generate_series(1,4) i;
    reset role; select set_config('request.jwt.claims','{"role":"service_role"}',true);
    select public.prepare_library_delivery_media('${admin.id}',(select id from st),jsonb_build_array(jsonb_build_object('source_hash',pg_temp.bundle()#>>'{assets,0,sha256}','base64',pg_temp.bundle()#>>'{assets,0,base64}')));
    set local role authenticated; select set_config('request.jwt.claims',${ac},true);
    select public.admin_set_library_publication(gen_random_uuid(),(select id from st),0,public.admin_library_publication((select id from st))#>>'{checks,review_fingerprint}','Ortak prova paketi','Test',array['free']::public.plan_code[],'Test programı',true,'published');
    select public.admin_create_package_group_exam('${S.group}',(select id from st),1,'Geometri ortak provası',array['source:segments'],now()-interval '1 hour',now()+interval '1 hour',20,array['free']::public.plan_code[]);
    commit;`);
  return { admin, A, B, childA, childB, adminClaims };
}

// ---------- browser helpers ----------
const pages = [];
async function newPage(size) {
  const context = await browser.newContext({ viewport: sizes[size], locale: 'tr-TR', hasTouch: size === 'phone', timezoneId: 'Europe/Istanbul' });
  const page = await context.newPage(); page.setDefaultTimeout(25000); page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message)); pages.push(page); return page;
}
const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
async function shot(page, name, focus) {
  if (focus) await page.getByTestId(focus).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/screenshots/${name}.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': horizontal overflow');
  const text = await page.locator('body').innerText();
  assert.ok(!/libraryCredits\.|contributionTrail\.|groupPhases\./.test(text), name + ': raw i18n key visible');
  assert.ok(!uuidRe.test(text), name + ': raw id visible');
  assert.ok(!/"[a-z_]+":|P0001|42501|PGRST/.test(text), name + ': raw server error/JSON visible');
}
async function signIn(page, u, WEB) {
  await page.goto(WEB); await page.getByLabel('E-posta', { exact: true }).fill(u.email); await page.getByLabel('Şifre', { exact: true }).fill(u.password);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await page.waitForURL('**/parent', { timeout: 40000 });
}
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function small48(page, testId) {
  // Every interactive control inside the block has at least a 48dp target.
  const sizesFound = await page.getByTestId(testId).first().evaluate((el) => [...el.querySelectorAll('[role=button],[role=switch],[role=checkbox]')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  for (const [w, h] of sizesFound) assert.ok(w >= 44 && h >= 44, `${testId}: target ${w}x${h}`);
  return sizesFound.length;
}

(async () => {
  stage = 'stack'; S = await setupStack();
  stage = 'fixture'; const F = await fixture();
  const tokenA = await login(F.A);
  // Draft (grade 5, Matematik) so an owned library item can be added to a Prova again.
  S.draft = randomUUID();
  const draft = await rpc(tokenA, 'save_prova_draft', { p_request_id: randomUUID(), p_id: S.draft, p_version: 0, p_content: { childId: null, grade: 5, title: 'Kesir tekrarı', purpose: 'practice', format: 'practice', subjects: ['Matematik'], topics: [], target: 10, minutes: null, difficulty: 'orta', kind: 'open_ended', note: '', step: 0, blocks: [] } });
  assert.ok(draft.ok, 'draft ' + JSON.stringify(draft.data).slice(0, 300));

  stage = 'export';
  const dist = path.join(work, 'web-' + DB.slice(10, 26));
  run('pnpm', ['exec', 'expo', 'export', '-p', 'web', '--output-dir', dist, '--clear'], { cwd: root + '/apps/mobile', env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: S.url, EXPO_PUBLIC_SUPABASE_ANON_KEY: S.anon, CI: '1' } });
  const webPort = await freePort();
  serve = spawn('node', [root + '/scripts/u02/serve-spa.mjs', dist, String(webPort)], { stdio: 'ignore' });
  const WEB = `http://127.0.0.1:${webPort}`; await healthy(webPort, '/');
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  // 1) Library: credit summary + policy preview from the server.
  stage = 'library_credits';
  const phone = await newPage('phone'); await signIn(phone, F.A, WEB);
  await phone.goto(WEB + '/parent/prova/library'); await phone.getByTestId('library-credits').waitFor();
  await phone.getByText(t('libraryCredits.monthly', { used: 0, limit: 3, remaining: 3 }), { exact: true }).waitFor();
  await phone.getByText(t('libraryCredits.total', { count: 3 }), { exact: true }).waitFor();
  await phone.getByText(t('libraryCredits.next', { remaining: 5, reward: t('libraryCredits.reward.library', { amount: 3 }) }), { exact: true }).waitFor();
  await phone.getByTestId('library-policy-preview').waitFor();
  await phone.getByText(t('libraryCredits.policyCount', { count: 5 }), { exact: true }).waitFor();
  await phone.getByText(t('libraryCredits.policyTotals', { library: 3, ai: 0, days: 0 }), { exact: true }).waitFor();
  for (let i = 0; i < 5; i++) { await phone.getByRole('button', { name: t('libraryCredits.increase'), exact: true }).click(); await phone.waitForTimeout(150); }
  await phone.getByText(t('libraryCredits.policyCount', { count: 10 }), { exact: true }).waitFor();
  await phone.getByText(t('libraryCredits.policyTotals', { library: 6, ai: 20, days: 0 }), { exact: true }).waitFor();
  const expected = JSON.parse(sql(`begin; set local role authenticated; select set_config('request.jwt.claims',${lit(JSON.stringify(parentClaims(F.A, F.A.family)))},true); select public.library_policy_preview(10)::text; commit;`).split('\n').filter((l) => l.startsWith('{')).pop());
  assert.deepEqual(expected.totals, { library: 6, ai_questions: 20, plan_days: 0 });
  const targets = await small48(phone, 'library-policy-preview');
  await shot(phone, 'library-credits-phone', 'library-credits');
  await shot(phone, 'library-policy-preview-phone', 'library-policy-preview');
  pass('library_credit_summary_and_policy_preview_visible', { policy_at_10: expected.totals, stepper_targets: targets });

  // 2) Same unit twice: first import charges 1, importing the owned item again charges 0.
  stage = 'same_unit_twice';
  await phone.getByText('Kesirler tekrar', { exact: true }).click();
  await button(phone, t('library.add')).click();
  await phone.getByTestId('library-credit-delta').waitFor();
  await phone.getByText(t('libraryCredits.charged_one', { count: 1, remaining: 2 }), { exact: true }).waitFor();
  await phone.getByText(t('libraryCredits.monthly', { used: 1, limit: 3, remaining: 2 }), { exact: true }).waitFor();
  await shot(phone, 'library-first-import-charged-phone', 'library-credits');
  await phone.goto(WEB + '/parent/prova/library?draftId=' + S.draft); await phone.getByTestId('library-credits').waitFor();
  await phone.getByText('Kesirler tekrar', { exact: true }).click();
  await button(phone, t('provaBuilder.addToPractice')).click();
  await phone.getByText(t('libraryCredits.sameUnit'), { exact: true }).waitFor();
  await phone.getByText(t('libraryCredits.monthly', { used: 1, limit: 3, remaining: 2 }), { exact: true }).waitFor();
  await shot(phone, 'library-same-unit-no-charge-phone', 'library-credits');
  const redemptions = sql(`select count(*) from public.library_redemptions where family_id='${F.A.family}';`);
  const usedDb = JSON.parse(sql(`begin; set local role authenticated; select set_config('request.jwt.claims',${lit(JSON.stringify(parentClaims(F.A, F.A.family)))},true); select public.family_library_credits()::text; commit;`).split('\n').filter((l) => l.startsWith('{')).pop()).monthly.used;
  assert.equal(redemptions, '1'); assert.equal(usedDb, 1);
  const inDraft = sql(`select jsonb_array_length(content->'blocks') from public.prova_drafts where id='${S.draft}';`);
  assert.equal(inDraft, '1');
  pass('same_acquisition_twice_charges_once_ui_and_db', { redemptions: Number(redemptions), monthly_used: usedDb, draft_blocks: Number(inDraft) });
  const desk = await newPage('desktop'); await signIn(desk, F.A, WEB);
  await desk.goto(WEB + '/parent/prova/library'); await desk.getByTestId('library-credits').waitFor(); await desk.getByTestId('library-policy-preview').waitFor();
  await shot(desk, 'library-credits-desktop');

  // 3) Rejection chain: family sees its own chain and reason, not another family's.
  stage = 'trail';
  await phone.goto(WEB + '/parent/prova/share'); await phone.getByTestId('contribution-chain').first().waitFor();
  await phone.getByText(t('contributionTrail.note', { note: 'Çözüm eksik: kenar uzunlukları yazılmamış.' }), { exact: true }).waitFor();
  assert.equal(await phone.getByText('B ailesine özel inceleme notu.', { exact: false }).count(), 0);
  assert.equal(await phone.getByTestId('contribution-chain').count(), 1);
  const foreign = await rpc(tokenA, 'contribution_review_trail', { p_id: F.B.set });
  assert.equal(foreign.ok, false); assert.equal(foreign.data.message, 'contribution_not_found');
  await shot(phone, 'share-trail-rejected-phone', 'contribution-chains');
  pass('rejection_chain_visible_to_family_other_family_hidden', { foreign_trail: foreign.data.message });

  // 4) Correct and resend: unchanged content is refused calmly; corrected copy links via p_supersedes.
  stage = 'fix_unchanged';
  await button(phone, t('contributionTrail.fix')).click();
  await phone.getByTestId('contribution-fix').waitFor();
  await phone.getByRole('switch', { name: t('contribution.rights') }).click();
  await phone.getByRole('switch', { name: t('library.noPersonal') }).click();
  await button(phone, t('contributionTrail.fix')).click();
  await phone.getByText(t('contributionTrail.errors.contribution_unchanged'), { exact: true }).waitFor();
  await shot(phone, 'share-fix-unchanged-phone', 'contribution-error');
  assert.equal(sql(`select count(*) from gina.contribution_sets where family_id='${F.A.family}';`), '1');
  pass('unchanged_resubmission_refused_with_calm_text');
  stage = 'fix_corrected';
  const corrected = randomUUID();
  sql(`insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution) values('${corrected}','${F.A.family}',5,'Matematik','Çevre (düzeltildi)','open_ended','orta','Kısa kenarı 4 m, uzun kenarı 10 m olan dikdörtgenin çevresi kaç metredir?','28','Kenarlar: 10 m ve 4 m. Çevre = 2 × (10 + 4) = 28 m.');`);
  await phone.reload(); await phone.getByTestId('contribution-fix').waitFor();
  await phone.getByRole('button', { name: 'Çevre (düzeltildi)', exact: true }).click();
  await phone.getByText('Kenarlar: 10 m ve 4 m. Çevre = 2 × (10 + 4) = 28 m.', { exact: true }).waitFor();
  await phone.getByRole('switch', { name: t('contribution.rights') }).click();
  await phone.getByRole('switch', { name: t('library.noPersonal') }).click();
  await shot(phone, 'share-fix-picked-phone', 'contribution-fix');
  const send = button(phone, t('contributionTrail.fix'));
  await send.dblclick();
  await phone.getByTestId('contribution-done').waitFor();
  await phone.getByText(t('contributionTrail.fixSent'), { exact: true }).waitFor();
  const link = sql(`select count(*)||'|'||bool_and(supersedes_id='${F.A.set}' and chain_id='${F.A.set}' and question_id='${corrected}') from gina.contribution_sets where family_id='${F.A.family}' and id<>'${F.A.set}';`);
  assert.equal(link, '1|true');
  await shot(phone, 'share-fix-sent-phone');
  await button(phone, t('contributionTrail.viewHistory')).click();
  await phone.getByText(t('contributionTrail.corrects'), { exact: true }).waitFor();
  assert.equal(await phone.getByTestId('contribution-step').count(), 2);
  await phone.getByText(t('contributionTrail.fixTaken'), { exact: true }).waitFor();
  await shot(phone, 'share-trail-corrected-phone', 'contribution-chains');
  await desk.goto(WEB + '/parent/prova/share'); await desk.getByTestId('contribution-chain').first().waitFor();
  await desk.getByText(t('contributionTrail.corrects'), { exact: true }).waitFor();
  await shot(desk, 'share-trail-corrected-desktop');
  // Taken: a second correction for the same rejected copy is refused by the server.
  const again = await rpc(tokenA, 'begin_question_contribution', { p_id: randomUUID(), p_question_id: F.A.question, p_rights: true, p_no_personal_data: true, p_supersedes: F.A.set });
  assert.equal(again.data.message, 'contribution_supersede_taken');
  pass('corrected_copy_linked_with_supersedes_and_double_tap_single_row', { new_rows: 1, second_correction: again.data.message });

  // 5) Groups: phases visible; double tap / retry of enrolment = one entry, one exam.
  stage = 'group_enroll';
  await phone.goto(WEB + '/parent/prova/groups'); await phone.getByTestId('group-phases').first().waitFor();
  await phone.getByText(t('groupPhases.childTime', { minutes: 20 }), { exact: true }).waitFor();
  await phone.getByText(t('groupPhases.review.automatic'), { exact: true }).waitFor();
  await shot(phone, 'groups-phases-open-phone', 'group-phases');
  await button(phone, t('group.join')).click();
  await phone.getByRole('checkbox', { name: t('group.participation') }).click();
  await phone.getByRole('checkbox', { name: t('group.rankingConsent') }).click();
  await button(phone, t('group.enroll')).dblclick();
  await phone.getByText(t('group.enrolled', { name: 'Ece' }), { exact: true }).waitFor();
  const retry = await rpc(tokenA, 'enroll_reviewed_group_exam', { p_group: S.group, p_child: F.childA, p_ranking: true, p_consent: true, p_review_consent: false });
  const entries = sql(`select count(*) from public.group_exam_entries where group_id='${S.group}' and child_id='${F.childA}';`);
  const exams = sql(`select count(distinct exam_id) from public.group_exam_entries where child_id='${F.childA}';`);
  assert.equal(entries, '1'); assert.equal(exams, '1');
  pass('group_double_tap_and_retry_single_entry', { entries: 1, exams: 1, retry_response: retry.ok ? 'same_exam_returned' : retry.data.message });

  // 6) Unfinished entry is not on the definitive board and the reason is shown.
  stage = 'group_result';
  const exam = sql(`select exam_id from public.group_exam_entries where group_id='${S.group}' and child_id='${F.childA}';`);
  claimsSql(parentClaims(F.A, F.A.family), `select (public.start_exam_attempt('${exam}')).id; select public.submit_exam_answer((select id from public.exam_attempts where exam_id='${exam}'),(select question_ids[1] from public.exams where id='${exam}'),'A');`);
  const examB = (await rpc(await login(F.B), 'enroll_group_exam', { p_group: S.group, p_child: F.childB, p_ranking: true, p_consent: true })).data;
  claimsSql(parentClaims(F.B, F.B.family), `select (public.start_exam_attempt('${examB}')).id; select public.submit_exam_answer((select id from public.exam_attempts where exam_id='${examB}'),q,'A') from unnest((select question_ids from public.exams where id='${examB}')) q; select public.finish_exam_attempt((select id from public.exam_attempts where exam_id='${examB}'));`);
  sql(`update public.group_exams set ends_at=now()-interval '1 minute' where id='${S.group}';`);
  await phone.reload(); await phone.getByTestId('group-phases').first().waitFor();
  await phone.getByText(t('groupPhases.participation.closed'), { exact: true }).waitFor();
  await phone.getByText(t('groupPhases.mineReason', { name: 'Ece', reason: t('groupPhases.rankingReason.unfinished') }), { exact: true }).waitFor();
  await shot(phone, 'groups-phases-closed-phone', 'group-phases');
  await button(phone, t('group.result')).click();
  await phone.getByTestId('group-ranking-notice').waitFor();
  await phone.getByText(t('groupPhases.notRanked'), { exact: true }).waitFor();
  await phone.getByText(t('groupPhases.rankingReason.unfinished'), { exact: true }).waitFor();
  await phone.getByText(t('groupPhases.interimHelp'), { exact: true }).waitFor();
  const board = await phone.getByText(t('group.you'), { exact: false }).count();
  assert.equal(board, 0, 'own unfinished entry must not be on the board');
  const result = await rpc(tokenA, 'get_group_result', { p_group: S.group, p_child: F.childA });
  assert.equal(result.data.ranked, false); assert.equal(result.data.ranking_reason, 'unfinished'); assert.equal(result.data.interim, true);
  assert.ok(!result.data.ranking.some((r) => r.mine));
  await shot(phone, 'groups-result-unfinished-phone', 'group-ranking-notice');
  await desk.goto(WEB + '/parent/prova/groups'); await desk.getByTestId('group-phases').first().waitFor();
  await button(desk, t('group.result')).click(); await desk.getByTestId('group-ranking-notice').waitFor();
  await shot(desk, 'groups-result-unfinished-desktop');
  pass('unfinished_result_not_ranked_reason_and_interim_visible', { ranked: false, reason: 'unfinished', interim: true, board_size: result.data.ranking.length });

  for (const page of pages) assert.deepEqual(page.errors, []);
  pass('no_runtime_errors_overflow_raw_ids_or_keys');
})().then(() => finish(0), (e) => finish(1, e));

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
  if (proxy) await new Promise((r) => proxy.close(r));
  for (const name of containers.reverse()) { try { run('docker', ['rm', '-f', name]); cleanup[name.replace(DB, 'db')] = 'removed'; } catch { cleanup[name.replace(DB, 'db')] = 'FAILED'; } }
  if (created) { try { psql('postgres', `drop database ${DB} with (force);`); cleanup.database = 'dropped'; } catch { cleanup.database = 'FAILED'; } }
  cleanup.containers_left = run('docker', ['ps', '-a', '--filter', 'name=' + DB, '--format', '{{.Names}}']).trim() || 'none';
  cleanup.database_left = psql('postgres', `select count(*) from pg_database where datname='${DB}';`);
  const report = { environment: 'disposable-local-gotrue-postgrest (own clone of gina_completion_audit)', database_pattern: 'gina_c07m_<hex>_audit', viewports: sizes, passed: code === 0, failed_stage: code ? stage : undefined, results, cleanup };
  if (code === 0) fs.writeFileSync(out + '/ui-checks.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, code, cleanup }));
  process.exit(code || (cleanup.containers_left !== 'none' || cleanup.database_left !== '0' ? 1 : 0));
}
