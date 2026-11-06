// QT41/QT42 (Faz 2B) child answering + parent review, against a disposable local stack (same harness as
// scripts/test-qt-child-ui.cjs). In its own `gina_qtc2b_<hex>_audit` DB it enables ONLY the 2B interaction types
// (`update public.interaction_types set enabled=true where phase='2B'`) before authoring, and exports the web build
// with EXPO_PUBLIC_QT_PHASE2B=1 (QA override of PHASE2B_CHILD_ENABLED).
// Image regions: the source image is served through the `learning-source` Edge function + Storage, which this
// GoTrue+PostgREST stack does not run; the image question therefore exercises the labelled toggle list (the
// accessible / image-failed path), not the overlay on a loaded image. Not physical-device acceptance.
// Usage: GINA_QA_PLAYWRIGHT_PATH=<playwright module> GINA_QTC_WORK=<scratch dir> node scripts/test-qt-child-2b-ui.cjs --run-local
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
if (!process.argv.includes('--run-local')) throw Error('Explicit --run-local required');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const work = process.env.GINA_QTC_WORK; assert.ok(work && path.isAbsolute(work), 'GINA_QTC_WORK required');
const out = root + '/docs/release/qt-2026-11-07/screens/child-2b'; fs.mkdirSync(out, { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const lookup = (key) => (key in tr ? tr[key] : key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tr));
const t = (key, vars = {}) => { let s = lookup(key); assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const sizes = { phone: { width: 390, height: 844 }, narrow: { width: 360, height: 740 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const DB = 'gina_qtc2b_' + randomBytes(8).toString('hex') + '_audit';
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



const R = (id, text, box) => (box ? { id, text, box } : { id, text });
const chart = { kind: 'bar_chart', caption: 'Sınıfın sevdiği meyveler', alt: 'Çubuk grafik: elma 8, armut 3, muz 5 öğrenci.', x_label: 'Meyve', y_label: 'Öğrenci', unit: 'kişi', bars: [{ label: 'Elma', value: 8 }, { label: 'Armut', value: 3 }, { label: 'Muz', value: 5 }] };
const table = { kind: 'table', caption: 'Kitap okuma', alt: 'Tablo: Ali 4 kitap, Ece 6 kitap, Can 2 kitap okudu.', columns: ['Ad', 'Kitap'], rows: [['Ali', 4], ['Ece', 6], ['Can', 2]] };
const Q = {
  grid: { interaction_type: 'region_select', stem: 'Grafikte en az sevilen meyvenin öğrenci sayısı kadar kareyi boya.',
    payload: { figure: { kind: 'grid', rows: 2, cols: 3 }, regions: ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => R(id, `${Math.floor(i / 3) + 1}. satır ${i % 3 + 1}. kare`)), stimulus: chart },
    answer_key: { count: 3 } },
  sect: { interaction_type: 'region_select', stem: 'Pastanın 2/4’ünü boya: üstteki iki dilimi seç.',
    payload: { figure: { kind: 'sectors' }, regions: [R('s1', 'Sağ üst dilim'), R('s2', 'Sağ alt dilim'), R('s3', 'Sol alt dilim'), R('s4', 'Sol üst dilim')], max_select: 2 },
    answer_key: { targets: ['s1', 's4'] } },
  img: { interaction_type: 'region_select', stem: 'Resimde güneşi ve ağacı bul.',
    payload: { figure: { kind: 'image', source: 'question_media' }, regions: [R('sun', 'Güneş', [0.7, 0.05, 0.25, 0.25]), R('tree', 'Ağaç', [0.05, 0.4, 0.3, 0.5]), R('car', 'Araba', [0.45, 0.65, 0.3, 0.25])] },
    answer_key: { targets: ['sun', 'tree'] } },
  read: { interaction_type: 'clock', stem: 'Saat kaçı gösteriyor?', payload: { mode: 'read', display: 'analog', step_minutes: 5, shown_time: '03:30' }, answer_key: { time: '03:30' } },
  set: { interaction_type: 'clock', stem: 'Saati 07:45’e kur.', payload: { mode: 'set', display: 'analog', step_minutes: 15 }, answer_key: { time: '07:45' } },
  tf: { interaction_type: 'true_false', stem: 'Tabloya bak.', payload: { statements: [{ id: 's1', text: 'Ece en çok kitap okudu.' }, { id: 's2', text: 'Can 4 kitap okudu.' }], stimulus: table },
    answer_key: { answers: { s1: true, s2: false } } },
};
const ORDER = ['grid', 'sect', 'img', 'read', 'set', 'tf'];

async function fixture() {
  const parent = await user(), device = await user();
  let tok = (await session(parent)).access_token;
  const fam = await rpc(tok, 'create_family', { p_name: 'Sentetik QT 2B ailesi', p_display_name: 'Sentetik veli' }); assert.ok(fam.ok, 'create_family ' + JSON.stringify(fam.data).slice(0, 200));
  parent.family = fam.data; tok = (await session(parent)).access_token; parent.token = tok;
  const child = randomUUID();
  const base = { grade: 3, subject: 'Matematik', topic: 'Kesirler ve zaman', difficulty: 'kolay', schema_version: 1 };
  const refused = await rpc(tok, 'save_question_with_sources', { p_request_id: randomUUID(), p_question: { ...base, ...Q.read } });
  assert.equal(refused.ok, false); assert.match(JSON.stringify(refused.data), /interaction_type_unavailable/);
  sql(`update public.plans set prova_monthly_exams=null where code='free';
    update public.interaction_types set enabled=true where phase='2B';
    insert into public.children(id,family_id,name,grade) values('${child}','${parent.family}','Ece',3);
    insert into public.devices(family_id,auth_user_id,active_child_id,name,paired_at) values('${parent.family}','${device.id}','${child}','QT tableti',now()-interval '1 hour');`);
  assert.equal(sql(`select string_agg(type,',' order by type) from public.interaction_types where enabled and phase in ('2A','3');`), '', 'only 2B enabled');
  const ids = {};
  for (const name of ORDER) {
    const r = await rpc(tok, 'save_question_with_sources', { p_request_id: randomUUID(), p_question: { ...base, ...Q[name] } });
    assert.ok(r.ok, `save ${name}: ` + JSON.stringify(r.data).slice(0, 300)); ids[name] = r.data;
  }
  const exam = randomUUID();
  claimsSql({ sub: parent.id, role: 'authenticated', gina: { family_id: parent.family, role: 'parent' } },
    `insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('${exam}','${parent.family}','${child}','Boya, saat, tablo','Matematik',3,array[${ORDER.map((n) => `'${ids[n]}'`).join(',')}]::uuid[],'assigned');`);
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
  const without = await rpc(F.dev.access_token, 'get_attempt_questions_v2', { p_exam_id: F.exam, p_supported: ['multiple_choice', 'open_ended', 'true_false', 'fill_blank', 'matching', 'numeric', 'ordering', 'classification'] });
  assert.equal(without.data.message, 'client_update_required');
  const proj = await rpc(F.dev.access_token, 'get_attempt_questions_v2', { p_exam_id: F.exam, p_supported: ['multiple_choice', 'open_ended', 'true_false', 'region_select', 'clock'] });
  assert.ok(proj.ok, JSON.stringify(proj.data).slice(0, 200));
  const projText = JSON.stringify(proj.data);
  assert.ok(!/"targets"|"count"|"accept_12h"/.test(projText), 'projection leaks key fields');
  assert.ok(!/"shown_time"/.test(JSON.stringify(proj.data.find((q) => q.id === F.ids.set).payload)), 'set-mode payload carries no time');
  assert.ok(proj.data.find((q) => q.id === F.ids.tf).payload.stimulus.kind === 'table', 'stimulus reaches 1A question');
  pass('2b_refused_while_disabled_then_projection_without_keys');

  stage = 'export';
  const dist = path.join(work, 'web-' + DB.slice(11, 27));
  run('pnpm', ['exec', 'expo', 'export', '-p', 'web', '--output-dir', dist, '--clear'], { cwd: root + '/apps/mobile', env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: S.url, EXPO_PUBLIC_SUPABASE_ANON_KEY: S.anon, EXPO_PUBLIC_QT_PHASE2B: '1', CI: '1' } });
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
  assert.ok(reported.includes('region_select') && reported.includes('clock') && !reported.includes('mark_text'), 'QA build reports 2B (not 2A)');
  pass('child_build_reports_2b_only', { reported: reported.split(',') });

  // Bar chart stimulus + grid colouring (count key; child never learns which/how many are "right").
  stage = 'grid_chart';
  await tid(kid, 'qt-stimulus-chart').waitFor();
  assert.equal(await tid(kid, 'qt-stimulus-chart').getAttribute('aria-label'), 'Sınıfın sevdiği meyveler. ' + chart.alt);
  for (const v of ['8 kişi', '3 kişi', '5 kişi', 'Meyve · Öğrenci (kişi)']) await kid.getByText(v, { exact: true }).first().waitFor();
  for (const id of ['a', 'b', 'e']) await tid(kid, `qt-region-${id}`).click();
  await tid(kid, 'qt-region-e').click(); await tid(kid, 'qt-region-f').click();
  await untilSaved(attempt, F.ids.grid, (a) => [...a.selected].sort(), ['a', 'b', 'f']);
  assert.equal(await tid(kid, 'qt-region-f').getAttribute('aria-checked'), 'true');
  await targets(kid, 'qt-region_select');
  await shot(kid, '2b-grid-chart', { child: true });
  pass('grid_colouring_toggle_with_bar_chart_alt_and_values');

  stage = 'sectors';
  await goQuestion(kid, 2);
  await tid(kid, 'qt-region-sectors').waitFor();
  await tid(kid, 'qt-region-s1').click(); await tid(kid, 'qt-region-s2').click(); await tid(kid, 'qt-region-s4').click();
  await kid.getByText(t('prova.qt.child.region.full_other', { count: 2 }), { exact: true }).waitFor();
  await tid(kid, 'qt-region-s2').click(); await tid(kid, 'qt-region-s4').click();
  await untilSaved(attempt, F.ids.sect, (a) => [...a.selected].sort(), ['s1', 's4']);
  await shot(kid, '2b-sectors', { child: true });
  await kid.setViewportSize({ width: 844, height: 390 }); await kid.waitForTimeout(400);
  await kid.screenshot({ path: `${out}/2b-sectors-landscape-844x390.png`, fullPage: true }); shots.push('2b-sectors-landscape-844x390.png');
  assert.ok(await kid.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'landscape overflow');
  assert.equal(await tid(kid, 'qt-region-s4').getAttribute('aria-checked'), 'true');
  await kid.setViewportSize(sizes.phone);
  pass('sectors_toggle_limit_landscape');

  stage = 'image_regions';
  await goQuestion(kid, 3);
  await kid.getByText(t('prova.qt.child.region.imageFailed'), { exact: true }).waitFor({ timeout: 30000 });
  await tid(kid, 'qt-region-sun').click(); await tid(kid, 'qt-region-tree').click();
  await untilSaved(attempt, F.ids.img, (a) => [...a.selected].sort(), ['sun', 'tree']);
  await shot(kid, '2b-image-regions-no-image', { child: true });
  pass('image_regions_labelled_list_works_without_loaded_image', { note: 'no Storage/Edge in stack; overlay on a loaded image not exercised' });

  stage = 'clock_read';
  await goQuestion(kid, 4);
  await tid(kid, 'qt-clock-shown').waitFor();
  assert.equal(await tid(kid, 'qt-clock-shown').getAttribute('aria-label'), t('prova.qt.child.clock.analogFace'), 'shown face does not speak the time');
  assert.equal(await kid.locator('input').count(), 0, 'no free-text time field');
  for (let i = 0; i < 9; i++) await tid(kid, 'qt-clock-hour-minus').click();
  for (let i = 0; i < 6; i++) await tid(kid, 'qt-clock-minute-plus').click();
  await untilSaved(attempt, F.ids.read, (a) => a.time, '03:30');
  await targets(kid, 'qt-clock');
  await shot(kid, '2b-clock-read', { child: true });
  pass('clock_read_steppers_on_step_no_text_input');

  stage = 'clock_set';
  await goQuestion(kid, 5);
  await kid.getByText(t('prova.qt.child.clock.notSet'), { exact: true }).first().waitFor();
  for (let i = 0; i < 5; i++) await tid(kid, 'qt-clock-hour-minus').click();
  for (let i = 0; i < 3; i++) await tid(kid, 'qt-clock-minute-plus').click();
  await untilSaved(attempt, F.ids.set, (a) => a.time, '07:45');
  assert.equal(await tid(kid, 'qt-clock-set').getAttribute('aria-label'), t('prova.qt.child.clock.yourTime', { time: '07:45' }));
  await shot(kid, '2b-clock-set', { child: true });
  await kid.setViewportSize({ width: 844, height: 390 }); await kid.waitForTimeout(400);
  await kid.screenshot({ path: `${out}/2b-clock-set-landscape-844x390.png`, fullPage: true }); shots.push('2b-clock-set-landscape-844x390.png');
  await kid.setViewportSize(sizes.phone);
  pass('clock_set_hands_with_buttons_on_15_minute_step');

  stage = 'table_stimulus';
  await goQuestion(kid, 6);
  await tid(kid, 'qt-stimulus-table').waitFor();
  assert.equal(await tid(kid, 'qt-stimulus-table').getAttribute('aria-label'), 'Kitap okuma. ' + table.alt);
  await tid(kid, 'qt-tf-s1-true').click(); await tid(kid, 'qt-tf-s2-false').click();
  await untilSaved(attempt, F.ids.tf, (a) => a.items, { s1: true, s2: false });
  await shot(kid, '2b-table-tf', { child: true });
  pass('table_stimulus_above_1a_question');

  stage = 'reload_finish';
  await kid.reload();
  await kid.getByText(t('prova.questionOf', { n: 1, total: ORDER.length }), { exact: true }).first().waitFor({ timeout: 45000 });
  assert.deepEqual(await Promise.all([1, 2, 3, 4, 5, 6].map((n) => navState(kid, n))), ['complete', 'complete', 'complete', 'complete', 'complete', 'complete']);
  await goQuestion(kid, 6);
  await kid.getByRole('button', { name: t('prova.finish'), exact: true }).click();
  await kid.getByText(t('experience.finishTitle'), { exact: true }).first().waitFor();
  await kid.getByRole('button', { name: t('experience.submitAnswers'), exact: true }).click();
  await kid.getByText(t('prova.finished'), { exact: true }).first().waitFor({ timeout: 30000 });
  await shot(kid, '2b-child-result', { child: true });
  const outcomes = Object.fromEntries(ORDER.map((n) => [n, sql(`select coalesce(score_details->>'outcome','none')||'|'||coalesce(round(score_exact)::text,'') from public.exam_answers where attempt_id='${attempt}' and question_id='${F.ids[n]}';`)]));
  assert.deepEqual(outcomes, { grid: 'scored|100', sect: 'scored|100', img: 'scored|100', read: 'scored|100', set: 'scored|100', tf: 'scored|100' });
  pass('reload_keeps_2b_answers_finish_scores', { outcomes });

  stage = 'parent';
  const par = await newPage('phone');
  await par.goto(WEB); await par.getByLabel(t('auth.email'), { exact: true }).fill(F.parent.email); await par.getByLabel(t('auth.password'), { exact: true }).fill(F.parent.password);
  await par.getByRole('button', { name: t('auth.signIn'), exact: true }).click(); await par.waitForURL('**/parent', { timeout: 40000 });
  await par.goto(WEB + '/parent/prova/attempt/' + attempt);
  await tid(par, 'qt-attempt-section').waitFor({ timeout: 30000 });
  await tid(par, 'qt-attempt-row-1').getByText(t('prova.qt.review.status.auto_scored', { score: 100 }), { exact: true }).waitFor();
  await shot(par, '2b-parent-attempt');
  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.grid}`);
  await tid(par, 'qt-review-region-count').getByText(t('prova.qt.review.p2.summary.count', { selected: 3, required: 3 }), { exact: true }).waitFor({ timeout: 30000 });
  await tid(par, 'qt-stimulus-chart').waitFor();
  await shot(par, '2b-parent-review-grid');
  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.sect}`);
  await tid(par, 'qt-review-row-s4').getByText(t('prova.qt.review.mark.correct'), { exact: true }).waitFor({ timeout: 30000 });
  await shot(par, '2b-parent-review-sectors');
  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.read}`);
  await tid(par, 'qt-review-row-time').getByText(t('prova.qt.review.correctAnswer', { text: '03:30' }), { exact: true }).waitFor({ timeout: 30000 });
  await shot(par, '2b-parent-review-clock');
  await tid(par, 'qt-score-input').fill('80');
  await tid(par, 'qt-score-save').click();
  await par.getByText(t('prova.qt.review.errors.score_reason_required'), { exact: true }).waitFor();
  await tid(par, 'qt-reason-input').fill('Öğleden sonra 15:30 dedi, sözlü anlattı.');
  await tid(par, 'qt-score-save').click(); await tid(par, 'qt-score-saved').waitFor();
  pass('parent_reviews_2b_rows_count_summary_and_overrides');

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
  const report = { environment: 'disposable-local-gotrue-postgrest (own clone of gina_completion_audit)', database_pattern: 'gina_qtc2b_<hex>_audit', phase2b: 'only 2B interaction_types enabled in the disposable DB; web build with EXPO_PUBLIC_QT_PHASE2B=1; image regions without a loaded image (no Storage/Edge in this stack)', child_session: 'device role (devices.auth_user_id → custom_access_token_hook)', viewports: sizes, passed: code === 0, failed_stage: code ? stage : undefined, results, screenshots: shots, cleanup, note: 'Web build in headless Chrome. Not physical-device acceptance (Pencil/finger, VoiceOver/TalkBack, rotation on hardware remain open).' };
  if (code === 0) fs.writeFileSync(out + '/ui-checks.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, code, cleanup }));
  process.exit(code || (cleanup.containers_left !== 'none' || cleanup.database_left !== '0' ? 1 : 0));
}


