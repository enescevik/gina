// QT10–QT21 child answering + parent structured review, against a disposable local stack.
// Creates its own `gina_qtc_<hex>_audit` DB from the empty `gina_completion_audit` template, starts temporary
// GoTrue + PostgREST containers on ephemeral ports, exports the Expo web build against a loopback proxy and
// drives it with Playwright. Removes every container/DB it created. Synthetic @example.invalid accounts only.
// The child runs as a real DEVICE session (GoTrue user bound to public.devices → custom_access_token_hook
// role=device); the parent runs as a parent session. Web screenshots are NOT physical-device acceptance.
// Usage: GINA_QA_PLAYWRIGHT_PATH=<playwright module> GINA_QTC_WORK=<scratch dir> node scripts/test-qt-child-ui.cjs --run-local
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
if (!process.argv.includes('--run-local')) throw Error('Explicit --run-local required');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const work = process.env.GINA_QTC_WORK; assert.ok(work && path.isAbsolute(work), 'GINA_QTC_WORK required');
const out = root + '/docs/release/qt-2026-11-07/screens/child'; fs.mkdirSync(out, { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const lookup = (key) => (key in tr ? tr[key] : key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tr));
const t = (key, vars = {}) => { let s = lookup(key); assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const sizes = { phone: { width: 390, height: 844 }, narrow: { width: 360, height: 740 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const DB = 'gina_qtc_' + randomBytes(8).toString('hex') + '_audit';
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

const Q = {
  tf: { interaction_type: 'true_false', stem: 'Cümleleri oku. Doğru mu, yanlış mı?',
    payload: { statements: [{ id: 's1', text: 'Kedi bir memelidir.' }, { id: 's2', text: 'Balıklar akciğerle solur.' }, { id: 's3', text: 'Bitkiler güneş ışığını kullanır.' }] },
    answer_key: { answers: { s1: true, s2: false, s3: true } } },
  fill: { interaction_type: 'fill_blank', stem: 'Boşlukları kelimelerle doldur.',
    payload: { segments: [{ type: 'text', text: 'Su donunca ' }, { type: 'blank', id: 'b1' }, { type: 'text', text: ' olur, ısınınca ' }, { type: 'blank', id: 'b2' }, { type: 'text', text: ' olur.' }],
      input: 'bank', bank: [{ id: 'w1', text: 'buz' }, { id: 'w2', text: 'buhar' }, { id: 'w3', text: 'taş' }], bank_reuse: false },
    answer_key: { blanks: { b1: { tokens: ['w1'] }, b2: { tokens: ['w2'] } } } },
  match: { interaction_type: 'matching', stem: 'Organları görevleriyle eşleştir.', points: 2,
    payload: { left: [{ id: 'l1', text: 'Kalp' }, { id: 'l2', text: 'Akciğer' }], right: [{ id: 'r1', text: 'Kanı pompalar' }, { id: 'r2', text: 'Nefes almamızı sağlar' }, { id: 'r3', text: 'Görmemizi sağlar' }], policy: 'one_to_one' },
    answer_key: { pairs: { l1: 'r1', l2: 'r2' } } },
  num: { interaction_type: 'numeric', stem: 'Ece’nin boyu 150 cm. Bu kaç metre ya da santimetredir? Birimi seç.',
    payload: { units: [{ id: 'cm', text: 'cm' }, { id: 'm', text: 'm' }], unit_required: true },
    answer_key: { value: '150', unit: 'cm', unit_factors: { cm: 1, m: 100 } } },
  work: { interaction_type: 'numeric', stem: '3 kutuda 4’er kalem var. Toplam kaç kalem vardır? İşlemini deftere yazabilirsin.',
    payload: { units: [], unit_required: false, work_area: true }, answer_key: { value: '12', process_required: true } },
  order: { interaction_type: 'ordering', stem: 'Kelimeleri sıraya koyarak cümleyi kur.',
    payload: { items: [{ id: 'a', text: 'Bugün' }, { id: 'b', text: 'hava' }, { id: 'c', text: 'çok' }, { id: 'd', text: 'çok' }, { id: 'e', text: 'güzel' }], mode: 'sentence' },
    answer_key: { orders: [['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'd', 'c', 'e']] } },
  cls: { interaction_type: 'classification', stem: 'Kartları doğru gruba koy.',
    payload: { items: [{ id: 'i1', text: 'Kedi' }, { id: 'i2', text: 'Gül' }, { id: 'i3', text: 'Köpek' }, { id: 'i4', text: 'Papatya' }],
      categories: [{ id: 'c1', text: 'Hayvan', capacity: 2 }, { id: 'c2', text: 'Bitki', capacity: 2 }] },
    answer_key: { membership: { i1: 'c1', i2: 'c2', i3: 'c1', i4: 'c2' } } },
  tf2: { interaction_type: 'true_false', stem: 'Bu soruyu boş bırakabilirsin: Ay bir gezegendir.',
    payload: { statements: [{ id: 's1', text: 'Ay bir gezegendir.' }] }, answer_key: { answers: { s1: false } } },
};
const ORDER = ['tf', 'fill', 'match', 'num', 'work', 'order', 'cls', 'tf2', 'mc'];

async function fixture() {
  const parent = await user(), device = await user();
  let tok = (await session(parent)).access_token;
  const fam = await rpc(tok, 'create_family', { p_name: 'Sentetik QT ailesi', p_display_name: 'Sentetik veli' }); assert.ok(fam.ok, 'create_family ' + JSON.stringify(fam.data).slice(0, 200));
  parent.family = fam.data; tok = (await session(parent)).access_token; parent.token = tok;
  assert.equal(claimsOf(tok).role, 'parent');
  const child = randomUUID();
  sql(`update public.plans set prova_monthly_exams=null where code='free';
    insert into public.children(id,family_id,name,grade) values('${child}','${parent.family}','Ece',3);
    insert into public.devices(family_id,auth_user_id,active_child_id,name,paired_at) values('${parent.family}','${device.id}','${child}','QT tableti',now()-interval '1 hour');`);
  const ids = {};
  for (const name of ORDER) {
    const base = { grade: 3, subject: 'Fen Bilimleri', topic: 'Canlılar', difficulty: 'kolay', schema_version: 1 };
    const body = name === 'mc'
      ? { grade: 3, subject: 'Fen Bilimleri', topic: 'Canlılar', kind: 'multiple_choice', difficulty: 'kolay', stem: 'Hangisi bir memelidir?', choices: [{ key: 'A', text: 'Kedi' }, { key: 'B', text: 'Balık' }, { key: 'C', text: 'Kurbağa' }, { key: 'D', text: 'Yılan' }], correct_key: 'A' }
      : { ...base, ...Q[name] };
    const r = await rpc(tok, 'save_question_with_sources', { p_request_id: randomUUID(), p_question: body });
    assert.ok(r.ok, `save ${name}: ` + JSON.stringify(r.data).slice(0, 300)); ids[name] = r.data;
  }
  const exam = randomUUID();
  claimsSql({ sub: parent.id, role: 'authenticated', gina: { family_id: parent.family, role: 'parent' } },
    `insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('${exam}','${parent.family}','${child}','Canlılar alıştırması','Fen Bilimleri',3,array[${ORDER.map((n) => `'${ids[n]}'`).join(',')}]::uuid[],'assigned');`);
  const dev = await session(device);
  assert.equal(claimsOf(dev.access_token).role, 'device'); assert.equal(claimsOf(dev.access_token).child_id, child);
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

  // API guard: a device never receives private keys; v1 question RPC refuses this exam; v4 rejects a malformed answer.
  stage = 'api_guards';
  const keysAsDevice = await rpc(F.dev.access_token, 'get_question_answer_keys', { p_question_ids: Object.values(F.ids) });
  assert.ok(keysAsDevice.ok); assert.deepEqual(keysAsDevice.data, []);
  const v1 = await rpc(F.dev.access_token, 'get_attempt_questions', { p_exam_id: F.exam });
  assert.equal(v1.data.message, 'client_update_required');
  const old = await rpc(F.dev.access_token, 'get_attempt_questions_v2', { p_exam_id: F.exam, p_supported: ['multiple_choice', 'open_ended'] });
  assert.equal(old.data.message, 'client_update_required');
  const proj = await rpc(F.dev.access_token, 'get_attempt_questions_v2', { p_exam_id: F.exam, p_supported: ['multiple_choice', 'open_ended', 'true_false', 'fill_blank', 'matching', 'numeric', 'ordering', 'classification'] });
  assert.ok(proj.ok, JSON.stringify(proj.data).slice(0, 200));
  assert.ok(!JSON.stringify(proj.data).match(/"answers"|"tokens"|"pairs"|"membership"|"orders"|"unit_factors"|"process_required"/), 'student projection leaks key fields');
  pass('device_gets_no_keys_old_client_gets_update_required_projection_has_no_key', { device_keys: 0, v1: v1.data.message, v2_legacy_only: old.data.message });

  stage = 'export';
  const dist = path.join(work, 'web-' + DB.slice(9, 25));
  run('pnpm', ['exec', 'expo', 'export', '-p', 'web', '--output-dir', dist, '--clear'], { cwd: root + '/apps/mobile', env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: S.url, EXPO_PUBLIC_SUPABASE_ANON_KEY: S.anon, CI: '1' } });
  const webPort = await freePort();
  serve = spawn('node', [root + '/scripts/u02/serve-spa.mjs', dist, String(webPort)], { stdio: 'ignore' });
  const WEB = `http://127.0.0.1:${webPort}`; await healthy(webPort, '/');
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  // 1) Device opens the exam: v2 questions render with explicit unanswered state for every item.
  stage = 'child_open';
  const kid = await newPage('phone', F.dev);
  await kid.goto(WEB + '/child/prova/' + F.exam);
  await kid.getByText(t('prova.questionOf', { n: 1, total: ORDER.length }), { exact: true }).first().waitFor({ timeout: 45000 });
  await tid(kid, 'qt-true_false').waitFor();
  const attempt = sql(`select id from public.exam_attempts where exam_id='${F.exam}';`);
  assert.match(attempt, uuidRe);
  for (let n = 1; n <= ORDER.length; n++) assert.equal(await navState(kid, n), 'unanswered');
  const devTypes = sql(`select array_to_string(question_types,',') from public.devices where auth_user_id='${F.device.id}';`);
  assert.ok(devTypes.includes('classification') && devTypes.includes('true_false'), 'device reported supported types');
  await shot(kid, 'tf-empty', { child: true });
  pass('device_renders_v2_questions_all_unanswered', { attempt_question_count: ORDER.length, device_question_types: devTypes.split(',') });

  // 2) True/false: explicit choice, clear and undo, partial state; immediate save (tap).
  stage = 'true_false';
  await tid(kid, 'qt-tf-s1-true').click();
  await tid(kid, 'qt-tf-s2-true').click();
  await tid(kid, 'qt-tf-s3-false').click();
  await tid(kid, 'qt-tf-s3-clear').click();
  assert.equal(await kid.getByText(t('prova.qt.child.tf.notChosen'), { exact: true }).count(), 1);
  await tid(kid, 'qt-undo').click(); // brings s3=false back
  await tid(kid, 'qt-tf-s3-clear').click(); // and clears it again: s1,s2 answered, s3 blank
  const tfRow = await untilSaved(attempt, F.ids.tf, (a) => a, { type: 'true_false', v: 1, items: { s1: true, s2: true } });
  await settled(kid);
  assert.equal(await navState(kid, 1), 'partial'); await tid(kid, 'qt-fill-partial').waitFor();
  const tfTargets = await targets(kid, 'qt-true_false');
  await shot(kid, 'tf-partial', { child: true });
  pass('true_false_choose_clear_undo_partial_saved', { saved: tfRow, targets_checked: tfTargets });

  // 3) Fill blank (bank): word → gap, move word, tap filled gap to return it, gap-first then word.
  stage = 'fill_blank';
  await goQuestion(kid, 2);
  await tid(kid, 'qt-word-w2').click(); await tid(kid, 'qt-blank-b1').click();     // b1=buhar
  await tid(kid, 'qt-word-w2').click(); await tid(kid, 'qt-blank-b2').click();     // moves buhar to b2 (no reuse)
  await tid(kid, 'qt-fill-note').waitFor();
  await tid(kid, 'qt-blank-b2').click();                                           // returns buhar
  await tid(kid, 'qt-blank-b1').click(); await tid(kid, 'qt-word-w1').click();     // gap first: b1=buz
  await tid(kid, 'qt-word-w2').click(); await tid(kid, 'qt-blank-b2').click();     // b2=buhar
  await untilSaved(attempt, F.ids.fill, (a) => a.blanks, { b1: { token: 'w1' }, b2: { token: 'w2' } });
  await settled(kid);
  assert.equal(await navState(kid, 2), 'complete');
  await targets(kid, 'qt-fill_blank');
  await shot(kid, 'fill-bank-complete', { child: true });
  pass('fill_blank_bank_tap_place_move_return_gap_first');

  // 4) Matching: tap left → right; re-tap same pair unpairs; one-to-one swap.
  stage = 'matching';
  await goQuestion(kid, 3);
  await tid(kid, 'qt-left-l1').click(); await tid(kid, 'qt-right-r2').click();     // l1→r2
  await tid(kid, 'qt-left-l2').click(); await tid(kid, 'qt-right-r2').click();     // l2→r2, l1 freed (swap)
  await untilSaved(attempt, F.ids.match, (a) => a.pairs, { l2: 'r2' });
  await tid(kid, 'qt-left-l2').click(); await tid(kid, 'qt-right-r2').click();     // same pair again → unpaired
  await tid(kid, 'qt-left-l1').click(); await tid(kid, 'qt-right-r1').click();
  await tid(kid, 'qt-left-l2').click(); await tid(kid, 'qt-right-r2').click();
  await untilSaved(attempt, F.ids.match, (a) => a.pairs, { l1: 'r1', l2: 'r2' });
  await settled(kid);
  await targets(kid, 'qt-matching');
  await shot(kid, 'matching-complete', { child: true });
  pass('matching_tap_tap_swap_unpair');

  // 5) Reload mid-exam: everything saved so far comes back (server + journal).
  stage = 'reload';
  await kid.reload();
  await kid.getByText(t('prova.questionOf', { n: 1, total: ORDER.length }), { exact: true }).first().waitFor({ timeout: 45000 });
  assert.deepEqual([await navState(kid, 1), await navState(kid, 2), await navState(kid, 3), await navState(kid, 4)], ['partial', 'complete', 'complete', 'unanswered']);
  assert.equal(await tid(kid, 'qt-tf-s1-true').getAttribute('aria-checked'), 'true');
  pass('reload_mid_exam_keeps_answers_and_states');

  // 6) Numeric with unit: gentle not-a-number hint (never "wrong"), comma decimal, unit picker; typed save debounced.
  stage = 'numeric';
  await goQuestion(kid, 4);
  await tid(kid, 'qt-numeric-value').fill('1,5,');
  await tid(kid, 'qt-numeric-hint').waitFor();
  await shot(kid, 'numeric-hint', { child: true, all: false });
  await tid(kid, 'qt-numeric-value').fill('1,5');
  assert.equal(await tid(kid, 'qt-numeric-hint').count(), 0);
  assert.equal(await navState(kid, 4), 'partial');
  await tid(kid, 'qt-unit-m').click();
  await untilSaved(attempt, F.ids.num, (a) => a, { type: 'numeric', v: 1, value: '1,5', unit: 'm' });
  await settled(kid);
  await targets(kid, 'qt-numeric');
  await shot(kid, 'numeric-unit', { child: true });
  pass('numeric_hint_comma_unit_saved', { saved: { value: '1,5', unit: 'm' } });

  // 7) Numeric with work area: fraction helper keys, open the notebook (answer_document), back to answer.
  stage = 'numeric_work';
  await goQuestion(kid, 5);
  assert.equal(await kid.locator('[data-testid^="qt-unit-"]').count(), 0, 'no unit field when unit not required');
  await tid(kid, 'qt-numeric-value').fill('24');
  await kid.getByRole('button', { name: t('prova.qt.child.num.keySlash'), exact: true }).click();
  await kid.getByText(t('prova.qt.child.num.hint'), { exact: true }).waitFor();  // "24/" is not yet a number
  await tid(kid, 'qt-numeric-value').fill('24/2');
  await untilSaved(attempt, F.ids.work, (a) => a, { type: 'numeric', v: 1, value: '24/2' });
  await tid(kid, 'qt-numeric-work').click();
  await kid.getByText(t('prova.qt.child.num.backToAnswer'), { exact: true }).first().waitFor();
  assert.equal(await kid.getByRole('button', { name: t('notebook.keyboardAnswer'), exact: true }).count(), 0, 'no free-text answer box in the work area');
  await shot(kid, 'numeric-work-area', { child: true });
  await kid.getByText(t('prova.qt.child.num.backToAnswer'), { exact: true }).first().click();
  await tid(kid, 'qt-numeric').waitFor();
  assert.deepEqual(JSON.parse(savedRow(attempt, F.ids.work).split('|')[0]), { type: 'numeric', v: 1, value: '24/2' });
  pass('numeric_work_area_opens_notebook_without_text_fallback');

  // 8) Ordering (sentence, two identical "çok" with distinct ids): tap-to-place + up/down, confirm.
  stage = 'ordering';
  await goQuestion(kid, 6);
  const shown = await kid.locator('[data-testid^="qt-order-row-"]').allInnerTexts();
  assert.equal(shown.length, 5);
  assert.equal(await navState(kid, 6), 'unanswered', 'shuffled order alone is not an answer');
  const proj6 = proj.data.find((q) => q.id === F.ids.order).payload.items.map((i) => i.id);
  // Build Bugün hava çok çok güzel using tap-to-place for the first and arrows for the rest.
  const target = ['a', 'b', 'c', 'd', 'e'];
  let current = [...proj6];
  for (let i = 0; i < target.length; i++) {
    const id = target[i]; const from = current.indexOf(id);
    if (from === i) continue;
    if (i === 0) { await tid(kid, `qt-order-${id}`).click(); await tid(kid, `qt-order-${current[0]}`).click(); }
    else for (let k = from; k > i; k--) await tid(kid, `qt-order-${id}-up`).click();
    current.splice(from, 1); current.splice(i, 0, id);
  }
  if (await tid(kid, 'qt-order-confirm').count()) await tid(kid, 'qt-order-confirm').click();
  const savedOrder = await untilSaved(attempt, F.ids.order, (a) => a.order, target);
  assert.equal((await tid(kid, 'qt-order-preview').innerText()).trim(), t('prova.qt.child.order.preview', { text: 'Bugün hava çok çok güzel' }));
  await targets(kid, 'qt-ordering');
  await shot(kid, 'ordering-sentence', { child: true });
  await kid.setViewportSize({ width: 844, height: 390 }); await kid.waitForTimeout(400);
  assert.equal((await kid.locator('[data-testid^="qt-order-row-"]').allInnerTexts()).length, 5, 'rows survive landscape');
  await kid.screenshot({ path: `${out}/ordering-landscape-844x390.png`, fullPage: true }); shots.push('ordering-landscape-844x390.png');
  await kid.setViewportSize(sizes.phone);
  pass('ordering_tap_place_arrows_duplicate_words_rotation', { saved: savedOrder });

  // 9) Classification: select item → category, capacity refusal, take back.
  stage = 'classification';
  await goQuestion(kid, 7);
  await tid(kid, 'qt-item-i1').click(); await tid(kid, 'qt-cat-c1').click();
  await tid(kid, 'qt-item-i2').click(); await tid(kid, 'qt-cat-c1').click();      // Gül → Hayvan (wrong, allowed)
  await tid(kid, 'qt-item-i3').click(); await tid(kid, 'qt-cat-c1').click();      // full → refused
  await kid.getByText(t('prova.qt.child.class.fullHint', { category: 'Hayvan' }), { exact: true }).waitFor();
  await shot(kid, 'classification-full', { child: true });
  await tid(kid, 'qt-item-i2-remove').click();                                      // take Gül back
  await tid(kid, 'qt-cat-c1').click();                                              // i3 still selected → Hayvan
  await tid(kid, 'qt-item-i2').click(); await tid(kid, 'qt-cat-c2').click();
  await untilSaved(attempt, F.ids.cls, (a) => a.placement, { i1: 'c1', i3: 'c1', i2: 'c2' });
  await settled(kid);
  assert.equal(await navState(kid, 7), 'partial');
  await targets(kid, 'qt-classification');
  await shot(kid, 'classification-partial', { child: true });
  pass('classification_select_place_capacity_takeback_partial');

  // 10) Legacy MC still saves through v4 with p_answer null; tf2 left untouched.
  stage = 'legacy_mc';
  await goQuestion(kid, 9);
  await kid.getByRole('radio', { name: 'A, Kedi', exact: true }).click();
  for (let i = 0; i < 60 && !sql(`select count(*) from public.exam_answers where attempt_id='${attempt}' and question_id='${F.ids.mc}';`).startsWith('1'); i++) await kid.waitForTimeout(250);
  await settled(kid);
  assert.equal(sql(`select answer_key||'|'||(answer is null)::text||'|'||edit_revision from public.exam_answers where attempt_id='${attempt}' and question_id='${F.ids.mc}';`), 'A|true|1');
  pass('legacy_multiple_choice_saved_via_v4_with_null_answer');

  // 11) Finish sheet: blank + partial counts, go-to button; then submit.
  stage = 'finish';
  await kid.getByRole('button', { name: t('prova.finish'), exact: true }).click();
  await kid.getByText(t('experience.finishTitle'), { exact: true }).first().waitFor();
  await kid.getByText(t('prova.unansweredConfirm_one', { count: 1 }), { exact: true }).first().waitFor();
  await tid(kid, 'qt-finish-partial').waitFor();
  assert.equal((await tid(kid, 'qt-finish-partial').innerText()).trim(), t('prova.qt.child.finishPartial_other', { count: 2 }));
  await shot(kid, 'finish-sheet', { child: true });
  await kid.getByRole('button', { name: t('experience.submitAnswers'), exact: true }).click();
  await kid.getByText(t('prova.finished'), { exact: true }).first().waitFor({ timeout: 30000 });
  await tid(kid, 'qt-result-note').waitFor();
  const resultText = await kid.locator('body').innerText();
  for (const word of [t('prova.qt.review.mark.correct'), t('prova.qt.review.mark.incorrect'), t('prova.qt.review.status.auto_scored', { score: '' }).split(':')[0]]) {
    assert.ok(!resultText.includes(word + ':') && !resultText.includes('Otomatik puan'), 'child result reveals per-item scoring');
  }
  await shot(kid, 'child-result', { child: true });
  const totals = sql(`select status||'|'||items_total||'|'||items_scored||'|'||items_pending||'|'||items_unanswered||'|'||items_partial||'|'||provisional from public.exam_attempts where id='${attempt}';`);
  const outcomes = Object.fromEntries(ORDER.filter((n) => n !== 'mc').map((n) => [n, sql(`select coalesce(score_details->>'outcome','none')||'|'||coalesce(score_exact::text,'') from public.exam_answers where attempt_id='${attempt}' and question_id='${F.ids[n]}';`) || 'no_row']));
  assert.equal(outcomes.tf.split('|')[0], 'scored'); assert.equal(outcomes.work.split('|')[0], 'pending_human'); assert.equal(outcomes.tf2, 'no_row');
  assert.equal(outcomes.num, 'scored|100.0000'); assert.equal(outcomes.order, 'scored|100.0000'); assert.equal(outcomes.fill, 'scored|100.0000');
  pass('finish_shows_blank_and_partial_then_server_scores_without_child_oracle', { attempt_totals: totals, outcomes });

  // 12) Parent: attempt screen separates scored / partial / waiting / unanswered.
  stage = 'parent_attempt';
  const par = await newPage('phone');
  await par.goto(WEB); await par.getByLabel(t('auth.email'), { exact: true }).fill(F.parent.email); await par.getByLabel(t('auth.password'), { exact: true }).fill(F.parent.password);
  await par.getByRole('button', { name: t('auth.signIn'), exact: true }).click(); await par.waitForURL('**/parent', { timeout: 40000 });
  await par.goto(WEB + '/parent/prova/attempt/' + attempt);
  await tid(par, 'qt-attempt-section').waitFor({ timeout: 30000 });
  await tid(par, 'qt-attempt-row-1').getByText(t('prova.qt.review.status.auto_scored_partial', { score: 33 }), { exact: true }).waitFor();
  await tid(par, 'qt-attempt-row-5').getByText(t('prova.qt.review.status.pending_parent'), { exact: true }).waitFor();
  await tid(par, 'qt-attempt-row-8').getByText(t('prova.qt.review.status.unanswered'), { exact: true }).waitFor();
  await tid(par, 'qt-attempt-row-4').getByText(t('prova.qt.review.status.auto_scored', { score: 100 }), { exact: true }).waitFor();
  await shot(par, 'parent-attempt');
  pass('parent_attempt_lists_scored_partial_pending_unanswered');

  // 13) Parent review: per-item marks + key; reason required when changing an auto score; history.
  stage = 'parent_review_tf';
  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.tf}`);
  await tid(par, 'qt-review-panel').waitFor({ timeout: 30000 });
  await tid(par, 'qt-review-row-s2').getByText(t('prova.qt.review.mark.incorrect'), { exact: true }).waitFor();
  await tid(par, 'qt-review-row-s3').getByText(t('prova.qt.review.mark.blank'), { exact: true }).waitFor();
  await tid(par, 'qt-review-row-s2').getByText(t('prova.qt.review.correctAnswer', { text: t('prova.qt.child.tf.false') }), { exact: true }).waitFor();
  await shot(par, 'parent-review-tf');
  await tid(par, 'qt-score-input').fill('90');
  await par.getByText(t('prova.qt.review.reasonRequired'), { exact: true }).waitFor();
  await tid(par, 'qt-score-save').click();
  await par.getByText(t('prova.qt.review.errors.score_reason_required'), { exact: true }).waitFor();
  assert.equal(sql(`select count(*) from gina.answer_score_overrides where attempt_id='${attempt}';`), '0', 'no write without reason');
  await tid(par, 'qt-reason-input').fill('Üçüncü cümleyi sözlü doğru açıkladı.');
  await tid(par, 'qt-score-save').click();
  await tid(par, 'qt-score-saved').waitFor();
  await tid(par, 'qt-score-history').waitFor();
  await tid(par, 'qt-review-status-parent_scored').waitFor();
  await shot(par, 'parent-review-tf-saved');
  assert.equal(sql(`select auto_score::int||'|'||previous_score||'|'||parent_score||'|'||reason from gina.answer_score_overrides where attempt_id='${attempt}' and question_id='${F.ids.tf}';`), '33|33|90|Üçüncü cümleyi sözlü doğru açıkladı.');
  pass('parent_changes_auto_score_only_with_reason_and_history_shows', { override: '33→90' });

  stage = 'parent_review_pending_unanswered';
  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.work}`);
  await tid(par, 'qt-review-status-pending_parent').waitFor({ timeout: 30000 });
  await par.getByText(t('prova.qt.review.autoHint', { score: 100 }), { exact: true }).first().waitFor();
  await tid(par, 'qt-score-input').fill('80'); await tid(par, 'qt-score-save').click(); await tid(par, 'qt-score-saved').waitFor();
  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.tf2}`);
  await tid(par, 'qt-review-status-unanswered').waitFor({ timeout: 30000 });
  await par.getByText(t('prova.qt.review.unansweredHelp'), { exact: true }).waitFor();
  await shot(par, 'parent-review-unanswered');
  await tid(par, 'qt-score-input').fill('0'); await tid(par, 'qt-score-save').click(); await tid(par, 'qt-score-saved').waitFor();
  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.order}`);
  await tid(par, 'qt-review-order-summary').waitFor({ timeout: 30000 });
  await shot(par, 'parent-review-ordering');
  await par.goto(WEB + `/parent/prova/review/${attempt}?questionId=${F.ids.cls}`);
  await tid(par, 'qt-review-row-i4').getByText(t('prova.qt.review.mark.blank'), { exact: true }).waitFor();
  await shot(par, 'parent-review-classification');
  const after = sql(`select items_pending||'|'||items_unanswered||'|'||provisional||'|'||coalesce(score_pct::text,'') from public.exam_attempts where id='${attempt}';`);
  pass('parent_scores_pending_and_unanswered_items', { attempt_after: after });

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
  const report = { environment: 'disposable-local-gotrue-postgrest (own clone of gina_completion_audit)', database_pattern: 'gina_qtc_<hex>_audit', child_session: 'device role (devices.auth_user_id → custom_access_token_hook)', viewports: sizes, passed: code === 0, failed_stage: code ? stage : undefined, results, screenshots: shots, cleanup, note: 'Web build in headless Chrome. Not physical-device acceptance (Pencil/finger, VoiceOver/TalkBack, rotation on hardware remain open).' };
  if (code === 0) fs.writeFileSync(out + '/ui-checks.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, code, cleanup }));
  process.exit(code || (cleanup.containers_left !== 'none' || cleanup.database_left !== '0' ? 1 : 0));
}
