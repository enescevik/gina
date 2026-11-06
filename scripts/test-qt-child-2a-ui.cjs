// QT30–QT33 (Faz 2A) child answering + parent review, against a disposable local stack (same harness as
// scripts/test-qt-child-ui.cjs). In its own `gina_qtc2a_<hex>_audit` DB it enables the 2A interaction types
// (`update public.interaction_types set enabled=true where phase='2A'`, server ships them disabled) BEFORE authoring,
// and exports the web build with EXPO_PUBLIC_QT_PHASE2A=1 (the QA override of PHASE2A_CHILD_ENABLED).
// Child = device-role session; parent = parent session. Web screenshots are NOT physical-device acceptance.
// Usage: GINA_QA_PLAYWRIGHT_PATH=<playwright module> GINA_QTC_WORK=<scratch dir> node scripts/test-qt-child-2a-ui.cjs --run-local
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
if (!process.argv.includes('--run-local')) throw Error('Explicit --run-local required');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const work = process.env.GINA_QTC_WORK; assert.ok(work && path.isAbsolute(work), 'GINA_QTC_WORK required');
const out = root + '/docs/release/qt-2026-11-07/screens/child-2a'; fs.mkdirSync(out, { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const lookup = (key) => (key in tr ? tr[key] : key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tr));
const t = (key, vars = {}) => { let s = lookup(key); assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const sizes = { phone: { width: 390, height: 844 }, narrow: { width: 360, height: 740 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const DB = 'gina_qtc2a_' + randomBytes(8).toString('hex') + '_audit';
const containers = []; let created = false, proxy, serve, browser, stage = 'setup';
const results = []; const pass = (check, extra = {}) => { results.push({ check, passed: true, ...extra }); console.log('ok', check); };
const cleanup = {}; const shots = [];

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
async function session(u) { const r = await api('POST', '/auth/v1/token?grant_type=password', { email: u.email, password: u.password }); assert.ok(r.ok, 'login ' + r.status); return r.data; }
const rpc = async (token, name, args) => api('POST', '/rest/v1/rpc/' + name, args, token);
const claimsOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).gina ?? {};


const W = (id, text) => ({ id, text }), T = (text) => ({ text });
const Q = {
  mark: { interaction_type: 'mark_text', stem: 'Cümledeki iş bildiren kelimeleri (fiilleri) seç.',
    payload: { unit: 'word', max_select: 3, segments: [W('w1', 'Sabah'), T(' '), W('w2', 'erkenden'), T(' '), W('w3', 'kalktım'), T(' '), W('w4', 've'), T(' '), W('w5', 'kahvaltı'), T(' '), W('w6', 'yaptım'), T(' 🍞.')] },
    answer_key: { targets: ['w3', 'w6'] } },
  fix: { interaction_type: 'error_fix', stem: 'Yanlış yazılmış kelimeleri bul ve düzelt.',
    payload: { unit: 'word', segments: [W('e1', 'Ali'), T(' '), W('e2', 'okula'), T(' '), W('e3', 'gitdi'), T('. '), W('e4', 'Çantasını'), T(' '), W('e5', 'unutu'), T('.')] },
    answer_key: { errors: { e3: { accepted: ['gitti'] }, e5: { accepted: ['unuttu'] } } } },
  multi: { interaction_type: 'multi_choice', stem: 'Hangileri hayvandır? İkisini seç.',
    payload: { options: [W('a', 'Kedi'), W('b', 'Gül'), W('c', 'Köpek'), W('d', 'Papatya')], select_count: 2 },
    answer_key: { correct: ['a', 'c'] } },
  ts: { interaction_type: 'two_stage', stem: 'Buz ve su',
    payload: { stage1: { prompt: 'Buz suda yüzer mi?', options: [W('y', 'Evet, yüzer'), W('n', 'Hayır, batar')] },
      stage2: { prompt: 'Neden?', mode: 'choice', options: [W('r1', 'Buz sudan hafiftir'), W('r2', 'Buz sudan ağırdır'), W('r3', 'Buz sıcaktır')] } },
    answer_key: { stage1: 'y', stage2: 'r1' } },
  tst: { interaction_type: 'two_stage', stem: 'Bitkiler',
    payload: { stage1: { prompt: 'Bitkiler güneş ışığı olmadan uzun süre yaşar mı?', options: [W('y', 'Evet'), W('n', 'Hayır')] },
      stage2: { prompt: 'Nedenini kendi cümlenle yaz.', mode: 'text' } },
    answer_key: { stage1: 'n' } },
};
const ORDER = ['mark', 'fix', 'multi', 'ts', 'tst', 'mc'];

async function fixture() {
  const parent = await user(), device = await user();
  let tok = (await session(parent)).access_token;
  const fam = await rpc(tok, 'create_family', { p_name: 'Sentetik QT 2A ailesi', p_display_name: 'Sentetik veli' }); assert.ok(fam.ok, 'create_family ' + JSON.stringify(fam.data).slice(0, 200));
  parent.family = fam.data; tok = (await session(parent)).access_token; parent.token = tok;
  const child = randomUUID();
  // Server ships 2A disabled: authoring must refuse it until enabled (in this disposable DB only).
  const refused = await rpc(tok, 'save_question_with_sources', { p_request_id: randomUUID(), p_question: { grade: 3, subject: 'Türkçe', topic: 'Fiil', difficulty: 'kolay', schema_version: 1, ...Q.mark } });
  assert.equal(refused.ok, false); assert.match(JSON.stringify(refused.data), /interaction_type_unavailable/);
  sql(`update public.plans set prova_monthly_exams=null where code='free';
    update public.interaction_types set enabled=true where phase='2A';
    insert into public.children(id,family_id,name,grade) values('${child}','${parent.family}','Ece',3);
    insert into public.devices(family_id,auth_user_id,active_child_id,name,paired_at) values('${parent.family}','${device.id}','${child}','QT tableti',now()-interval '1 hour');`);
  const ids = {};
  for (const name of ORDER) {
    const body = name === 'mc'
      ? { grade: 3, subject: 'Türkçe', topic: 'Fiil', kind: 'multiple_choice', difficulty: 'kolay', stem: 'Hangisi bir fiildir?', choices: [{ key: 'A', text: 'koşmak' }, { key: 'B', text: 'masa' }, { key: 'C', text: 'mavi' }, { key: 'D', text: 'hızlı' }], correct_key: 'A' }
      : { grade: 3, subject: 'Türkçe', topic: 'Fiil', difficulty: 'kolay', schema_version: 1, ...Q[name] };
    const r = await rpc(tok, 'save_question_with_sources', { p_request_id: randomUUID(), p_question: body });
    assert.ok(r.ok, `save ${name}: ` + JSON.stringify(r.data).slice(0, 300)); ids[name] = r.data;
  }
  const exam = randomUUID();
  claimsSql({ sub: parent.id, role: 'authenticated', gina: { family_id: parent.family, role: 'parent' } },
    `insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('${exam}','${parent.family}','${child}','Fiiller ve nedenler','Türkçe',3,array[${ORDER.map((n) => `'${ids[n]}'`).join(',')}]::uuid[],'assigned');`);
  const dev = await session(device);
  assert.equal(claimsOf(dev.access_token).role, 'device');
  return { parent, device, dev, child, ids, exam };
}

// ---------- browser helpers ----------
const pages = [];
async function newPage(size, sessionValue) {
  const context = await browser.newContext({ viewport: sizes[size], locale: 'tr-TR', hasTouch: size !== 'desktop', timezoneId: 'Europe/Istanbul', reducedMotion: 'reduce' });
  if (sessionValue) {
    const value = JSON.stringify({ ...sessionValue, expires_at: Math.floor(Date.now() / 1000) + sessionValue.expires_in });
    await context.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, ['sb-127-auth-token', value]);
  }
  const page = await context.newPage(); page.setDefaultTimeout(25000); page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message)); pages.push(page); return page;
}
const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
async function shot(page, name, { child = false, all = true } = {}) {
  const original = page.viewportSize(); const metrics = {};
  for (const [size, vp] of Object.entries(sizes)) {
    if (!all && size !== 'phone') continue;
    await page.setViewportSize(vp); await page.waitForTimeout(450);
    const file = `${name}-${size}-${vp.width}x${vp.height}.png`;
    await page.screenshot({ path: `${out}/${file}`, fullPage: true }); shots.push(file);
    const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, text: document.body.innerText }));
    assert.ok(m.overflow <= 1, `${name}@${size}: horizontal overflow ${m.overflow}`);
    assert.ok(!/\bprova\.qt\.[a-zA-Z]/.test(m.text), `${name}@${size}: raw i18n key visible`);
    assert.ok(!uuidRe.test(m.text), `${name}@${size}: raw id visible`);
    assert.ok(!/"[a-z_]+":|P0001|42501|PGRST|client_update_required/.test(m.text), `${name}@${size}: raw server error/JSON visible`);
    if (child) {
      // The child never sees correctness or the key while answering or after finishing.
      assert.equal(await page.getByTestId('qt-review').count(), 0, `${name}: review rows visible to child`);
      assert.ok(!m.text.includes(t('prova.qt.review.correctAnswer', { text: '' }).trim()), `${name}: correct answer text visible to child`);
    }
    metrics[size] = { overflow: m.overflow };
  }
  await page.setViewportSize(original);
  return metrics;
}
async function targets(page, testId) {
  const found = await page.getByTestId(testId).first().evaluate((el) => [...el.querySelectorAll('[role=button],[role=radio],input')]
    .filter((b) => b.offsetParent !== null).map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), b.getAttribute('aria-label') || b.textContent]; }));
  for (const [w, h, label] of found) assert.ok(w >= 44 && h >= 44, `${testId}: target ${w}x${h} (${label})`);
  return found.length;
}
const tid = (page, id) => page.getByTestId(id).first();
const nav = (page, n) => page.locator(`[data-testid^="qt-nav-${n}-"]`).first();
async function navState(page, n) { return (await nav(page, n).getAttribute('data-testid')).split('-').pop(); }
async function goQuestion(page, n) { await nav(page, n).click(); await page.getByText(t('prova.questionOf', { n, total: ORDER.length }), { exact: true }).first().waitFor(); }
async function settled(page) { await page.getByText(t('provaV5.answerSaved'), { exact: true }).first().waitFor({ timeout: 20000 }); }
const savedRow = (attempt, q) => sql(`select coalesce(answer::text,'')||'|'||edit_revision from public.exam_answers where attempt_id='${attempt}' and question_id='${q}';`);
const savedAnswer = (attempt, q) => { const raw = savedRow(attempt, q).split('|')[0]; return raw ? JSON.parse(raw) : null; };
/** Polls the disposable DB until the saved answer (or a field of it) equals the expectation. */
async function untilSaved(attempt, q, pick, expected) {
  let last;
  for (let i = 0; i < 60; i++) {
    const a = savedAnswer(attempt, q); last = a && pick(a);
    try { assert.deepEqual(last, expected); return last; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.deepEqual(last, expected);
}


(async () => {
  stage = 'stack'; S = await setupStack();
  stage = 'fixture'; const F = await fixture();
  stage = 'api_guards';
  const without2a = await rpc(F.dev.access_token, 'get_attempt_questions_v2', { p_exam_id: F.exam, p_supported: ['multiple_choice', 'open_ended', 'true_false', 'fill_blank', 'matching', 'numeric', 'ordering', 'classification'] });
  assert.equal(without2a.data.message, 'client_update_required', 'a 1A/1B-only client is told to update');
  const proj = await rpc(F.dev.access_token, 'get_attempt_questions_v2', { p_exam_id: F.exam, p_supported: ['multiple_choice', 'open_ended', 'mark_text', 'error_fix', 'multi_choice', 'two_stage'] });
  assert.ok(proj.ok, JSON.stringify(proj.data).slice(0, 200));
  assert.ok(!JSON.stringify(proj.data).match(/"targets"|"errors"|"accepted"|"correct"|"stage1":"[yn]"/), 'student projection leaks key fields');
  const keys = await rpc(F.dev.access_token, 'get_question_answer_keys', { p_question_ids: Object.values(F.ids) });
  assert.deepEqual(keys.data, []);
  pass('2a_refused_while_disabled_then_projection_without_keys', { client_without_2a: without2a.data.message });

  stage = 'export';
  const dist = path.join(work, 'web-' + DB.slice(11, 27));
  run('pnpm', ['exec', 'expo', 'export', '-p', 'web', '--output-dir', dist, '--clear'], { cwd: root + '/apps/mobile', env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: S.url, EXPO_PUBLIC_SUPABASE_ANON_KEY: S.anon, EXPO_PUBLIC_QT_PHASE2A: '1', CI: '1' } });
  const webPort = await freePort();
  serve = spawn('node', [root + '/scripts/u02/serve-spa.mjs', dist, String(webPort)], { stdio: 'ignore' });
  const WEB = `http://127.0.0.1:${webPort}`; await healthy(webPort, '/');
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  stage = 'child_open';
  const kid = await newPage('phone', F.dev);
  await kid.goto(WEB + '/child/prova/' + F.exam);
  await kid.getByText(t('prova.questionOf', { n: 1, total: ORDER.length }), { exact: true }).first().waitFor({ timeout: 45000 });
  const attempt = sql(`select id from public.exam_attempts where exam_id='${F.exam}';`);
  const reported = sql(`select array_to_string(question_types,',') from public.devices where auth_user_id='${F.device.id}';`);
  assert.ok(['mark_text', 'error_fix', 'multi_choice', 'two_stage'].every((x) => reported.includes(x)), 'QA build reports 2A support');
  await tid(kid, 'qt-mark_text').waitFor();
  await shot(kid, '2a-mark-empty', { child: true });
  pass('child_build_with_switch_reports_2a_and_renders', { reported: reported.split(',') });

  // QT30 mark_text: toggle, limit, unselect; count text, no correctness, emoji kept.
  stage = 'mark_text';
  assert.ok((await tid(kid, 'qt-mark-passage').innerText()).includes('🍞'), 'emoji text kept intact');
  for (const id of ['w3', 'w6', 'w1']) await tid(kid, `qt-mark-seg-${id}`).click();
  await tid(kid, 'qt-mark-seg-w2').click();
  await kid.getByText(t('prova.qt.child.mark.full_other', { count: 3 }), { exact: true }).waitFor();
  assert.equal((await tid(kid, 'qt-mark-count').innerText()).trim(), t('prova.qt.child.sel.countOf', { count: 3, max: 3 }));
  await tid(kid, 'qt-mark-seg-w1').click();
  await untilSaved(attempt, F.ids.mark, (a) => [...a.selected].sort(), ['w3', 'w6']);
  assert.equal(await tid(kid, 'qt-mark-seg-w3').getAttribute('aria-checked'), 'true');
  assert.equal(await kid.getByRole('button', { name: /hepsini seç|select all/i }).count(), 0);
  await targets(kid, 'qt-mark_text');
  await kid.setViewportSize({ width: 360, height: 740 });
  assert.equal(await tid(kid, 'qt-mark-seg-w3').getAttribute('aria-checked'), 'true', 'selection stays on the same id after narrow reflow');
  await kid.setViewportSize(sizes.phone);
  await shot(kid, '2a-mark-selected', { child: true });
  pass('mark_text_toggle_limit_unselect_saved_by_id');

  // QT31 error_fix: mark → partial (needs fix), type fix, mark+unmark another, unmatched fix.
  stage = 'error_fix';
  await goQuestion(kid, 2);
  await tid(kid, 'qt-fix-seg-e3').click();
  await tid(kid, 'qt-fix-input-e3').waitFor();
  await kid.getByText(t('prova.qt.child.fix.needsFix'), { exact: true }).waitFor();
  await untilSaved(attempt, F.ids.fix, (a) => a.marks, { e3: {} });
  assert.equal(await navState(kid, 2), 'partial');
  await tid(kid, 'qt-fix-input-e3').fill('gitti');
  await tid(kid, 'qt-fix-seg-e1').click(); await tid(kid, 'qt-fix-unmark-e1').click();
  await tid(kid, 'qt-fix-seg-e5').click(); await tid(kid, 'qt-fix-input-e5').fill('unutt');
  await untilSaved(attempt, F.ids.fix, (a) => a.marks, { e3: { text: 'gitti' }, e5: { text: 'unutt' } });
  await settled(kid);
  assert.equal(await navState(kid, 2), 'complete');
  await targets(kid, 'qt-error_fix');
  await shot(kid, '2a-fix', { child: true });
  pass('error_fix_mark_fix_unmark_partial_then_complete');

  // QT32 multi_choice: "2 seçenek seç", limit, swap.
  stage = 'multi_choice';
  await goQuestion(kid, 3);
  await kid.getByText(t('prova.qt.child.multi.exactly_other', { count: 2 }), { exact: true }).waitFor();
  await tid(kid, 'qt-multi-a').click(); await tid(kid, 'qt-multi-b').click(); await tid(kid, 'qt-multi-c').click();
  await kid.getByText(t('prova.qt.child.multi.full_other', { count: 2 }), { exact: true }).waitFor();
  await tid(kid, 'qt-multi-b').click(); await tid(kid, 'qt-multi-c').click();
  await untilSaved(attempt, F.ids.multi, (a) => [...a.selected].sort(), ['a', 'c']);
  assert.equal(await kid.getByRole('checkbox').count(), 4);
  await targets(kid, 'qt-multi_choice');
  await shot(kid, '2a-multi', { child: true });
  pass('multi_choice_checkbox_select_count_limit');

  // QT33 two_stage (choice): stage 2 locked until stage 1; nothing about stage 1 correctness shown.
  stage = 'two_stage';
  await goQuestion(kid, 4);
  await tid(kid, 'qt-stage2-locked').waitFor();
  await shot(kid, '2a-two-stage-locked', { child: true, all: false });
  await tid(kid, 'qt-stage1-y').click();
  await tid(kid, 'qt-stage2').waitFor();
  const stageText = await tid(kid, 'qt-stage2').innerText();
  assert.ok(!/doğru|yanlış|correct|wrong/i.test(stageText), 'stage 2 says nothing about stage 1');
  await untilSaved(attempt, F.ids.ts, (a) => a, { type: 'two_stage', v: 1, stage1: 'y' });
  assert.equal(await navState(kid, 4), 'partial');
  await tid(kid, 'qt-stage2-r1').click();
  await untilSaved(attempt, F.ids.ts, (a) => a, { type: 'two_stage', v: 1, stage1: 'y', stage2: 'r1' });
  await targets(kid, 'qt-two_stage');
  await shot(kid, '2a-two-stage-choice', { child: true });
  stage = 'two_stage_text';
  await goQuestion(kid, 5);
  await tid(kid, 'qt-stage1-n').click();
  await tid(kid, 'qt-stage2-text').fill('Çünkü bitkiler besinini güneş ışığıyla yapar.');
  await untilSaved(attempt, F.ids.tst, (a) => a.stage2, { text: 'Çünkü bitkiler besinini güneş ışığıyla yapar.' });
  await settled(kid);
  await shot(kid, '2a-two-stage-text', { child: true });
  pass('two_stage_locked_then_choice_and_text_reason_saved');

  stage = 'reload';
  await kid.reload();
  await kid.getByText(t('prova.questionOf', { n: 1, total: ORDER.length }), { exact: true }).first().waitFor({ timeout: 45000 });
  assert.deepEqual([await navState(kid, 1), await navState(kid, 2), await navState(kid, 3), await navState(kid, 4), await navState(kid, 5), await navState(kid, 6)], ['complete', 'complete', 'complete', 'complete', 'complete', 'unanswered']);
  assert.equal(await tid(kid, 'qt-mark-seg-w6').getAttribute('aria-checked'), 'true');
  pass('reload_keeps_2a_answers');

  stage = 'legacy_and_finish';
  await goQuestion(kid, 6);
  await kid.getByRole('radio', { name: 'A, koşmak', exact: true }).click();
  for (let i = 0; i < 60 && !sql(`select count(*) from public.exam_answers where attempt_id='${attempt}' and question_id='${F.ids.mc}';`).startsWith('1'); i++) await kid.waitForTimeout(250);
  await settled(kid);
  await kid.getByRole('button', { name: t('prova.finish'), exact: true }).click();
  await kid.getByText(t('experience.finishTitle'), { exact: true }).first().waitFor();
  await kid.getByRole('button', { name: t('experience.submitAnswers'), exact: true }).click();
  await kid.getByText(t('prova.finished'), { exact: true }).first().waitFor({ timeout: 30000 });
  await shot(kid, '2a-child-result', { child: true });
  const outcomes = Object.fromEntries(ORDER.filter((n) => n !== 'mc').map((n) => [n, sql(`select coalesce(score_details->>'outcome','none')||'|'||coalesce(round(score_exact)::text,'')||'|'||coalesce(round((score_details->'items'->>'auto_result_score')::numeric)::text,'') from public.exam_answers where attempt_id='${attempt}' and question_id='${F.ids[n]}';`)]));
  assert.equal(outcomes.mark, 'scored|100|'); assert.equal(outcomes.multi, 'scored|100|'); assert.equal(outcomes.ts, 'scored|100|');
  assert.equal(outcomes.fix.split('|')[0], 'pending_human'); assert.equal(outcomes.tst.split('|')[0], 'pending_human');
  pass('finish_server_scores_2a_unmatched_fix_and_text_reason_wait_for_parent', { outcomes });

  stage = 'parent';
  const par = await newPage('phone');
  await par.goto(WEB); await par.getByLabel(t('auth.email'), { exact: true }).fill(F.parent.email); await par.getByLabel(t('auth.password'), { exact: true }).fill(F.parent.password);
  await par.getByRole('button', { name: t('auth.signIn'), exact: true }).click(); await par.waitForURL('**/parent', { timeout: 40000 });
  await par.goto(WEB + '/parent/prova/attempt/' + attempt);
  await tid(par, 'qt-attempt-section').waitFor({ timeout: 30000 });
  await tid(par, 'qt-attempt-row-2').getByText(t('prova.qt.review.status.pending_parent'), { exact: true }).waitFor();
  await tid(par, 'qt-attempt-row-5').getByText(t('prova.qt.review.status.pending_parent'), { exact: true }).waitFor();
  await tid(par, 'qt-attempt-row-1').getByText(t('prova.qt.review.status.auto_scored', { score: 100 }), { exact: true }).waitFor();
  await shot(par, '2a-parent-attempt');

  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.fix}`);
  await tid(par, 'qt-review-status-pending_parent').waitFor({ timeout: 30000 });
  await tid(par, 'qt-review-p2-summary').waitFor();
  await tid(par, 'qt-review-row-e5').getByText(t('prova.qt.review.mark.review'), { exact: true }).waitFor();
  await tid(par, 'qt-review-row-e3').getByText(t('prova.qt.review.mark.correct'), { exact: true }).waitFor();
  await par.getByText(t('prova.qt.review.autoHint', { score: 75 }), { exact: true }).first().waitFor();
  await shot(par, '2a-parent-review-fix');
  await tid(par, 'qt-score-input').fill('90'); await tid(par, 'qt-score-save').click(); await tid(par, 'qt-score-saved').waitFor();

  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.tst}`);
  await tid(par, 'qt-review-row-stage2').getByText(t('prova.qt.review.mark.review'), { exact: true }).waitFor({ timeout: 30000 });
  await shot(par, '2a-parent-review-two-stage-text');
  await tid(par, 'qt-score-input').fill('100'); await tid(par, 'qt-score-save').click(); await tid(par, 'qt-score-saved').waitFor();

  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.mark}`);
  await tid(par, 'qt-review-row-w3').getByText(t('prova.qt.review.mark.correct'), { exact: true }).waitFor({ timeout: 30000 });
  await tid(par, 'qt-review-p2-summary').getByText(t('prova.qt.review.p2.summary.selection', { tp: 2, targets: 2, fp: 0 }), { exact: true }).waitFor();
  await shot(par, '2a-parent-review-mark');
  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.multi}`);
  await tid(par, 'qt-review-row-c').getByText(t('prova.qt.review.mark.correct'), { exact: true }).waitFor({ timeout: 30000 });
  await shot(par, '2a-parent-review-multi');
  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.ts}`);
  await tid(par, 'qt-review-row-stage2').getByText(t('prova.qt.review.mark.correct'), { exact: true }).waitFor({ timeout: 30000 });
  await shot(par, '2a-parent-review-two-stage-choice');
  const after = sql(`select items_pending||'|'||provisional||'|'||coalesce(score_pct::text,'') from public.exam_attempts where id='${attempt}';`);
  const overrides = sql(`select string_agg(round(coalesce(auto_score,-1))||'→'||parent_score, ',' order by created_at) from gina.answer_score_overrides where attempt_id='${attempt}';`);
  pass('parent_reviews_2a_rows_and_scores_pending_items', { attempt_after: after, overrides });

  for (const page of pages) assert.deepEqual(page.errors, []);
  pass('no_runtime_errors_overflow_raw_ids_or_keys', { screenshots: shots.length });
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
  const report = { environment: 'disposable-local-gotrue-postgrest (own clone of gina_completion_audit)', database_pattern: 'gina_qtc2a_<hex>_audit', phase2a: 'interaction_types enabled in the disposable DB only; web build with EXPO_PUBLIC_QT_PHASE2A=1', child_session: 'device role (devices.auth_user_id → custom_access_token_hook)', viewports: sizes, passed: code === 0, failed_stage: code ? stage : undefined, results, screenshots: shots, cleanup, note: 'Web build in headless Chrome. Not physical-device acceptance (Pencil/finger, VoiceOver/TalkBack, rotation on hardware remain open).' };
  if (code === 0) fs.writeFileSync(out + '/ui-checks.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, code, cleanup }));
  process.exit(code || (cleanup.containers_left !== 'none' || cleanup.database_left !== '0' ? 1 : 0));
}

