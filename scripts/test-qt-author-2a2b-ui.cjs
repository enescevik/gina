// QT30–QT33 (Faz 2A) + QT41/QT42 (Faz 2B) parent authoring / assignment / booklet UI checks (disposable stack).
// Same infrastructure as scripts/test-qt-author-ui.cjs. Phases are enabled ONLY in the disposable DB
// (`update public.interaction_types set enabled=true where phase in ('2A','2B')`) and in a QA web export built
// with EXPO_PUBLIC_QT_PHASE2A=1 / EXPO_PUBLIC_QT_PHASE2B=1. A second export with the switches OFF proves the
// release build shows nothing new. The image upload/view Edge function (learning-source) is mocked locally.
// Creates its own `gina_qt2_<hex>_audit` DB from the empty `gina_completion_audit` template, applies every
// migration (incl. 20261107*), starts temporary GoTrue + PostgREST containers on ephemeral ports, exports the
// Expo web build against a loopback proxy and drives it with Playwright:
//   * one question of each structured type through the real authoring screen (+ fill blank by typing),
//   * inline validation of a broken question and the server DETAIL codes for the same broken payload,
//   * builder: MEB Common Written track blocks practice-only types (UI + server), device-support warning,
//     assignment of a mixed Prova with every type,
//   * booklet: student copy and private answer key exported separately (HTML snapshot + PDF rendered with the
//     app's Nunito/Baloo 2 fonts), text checked with pdftotext.
// Screenshots: 390x844, 360x740, 768x1024, 1280x800 → docs/release/qt-2026-11-07/screens/author/.
// Synthetic @example.invalid accounts only; every container/DB it created is removed.
// Usage: GINA_QA_PLAYWRIGHT_PATH=<playwright module> GINA_QT2_WORK=<scratch dir> node scripts/test-qt-author-2a2b-ui.cjs --run-local
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
if (!process.argv.includes('--run-local')) throw Error('Explicit --run-local required');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const work = process.env.GINA_QT2_WORK; assert.ok(work && path.isAbsolute(work), 'GINA_QT2_WORK required');
const out = root + '/docs/release/qt-2026-11-07/screens/author-2a2b'; fs.mkdirSync(out, { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const t = (key, vars = {}) => { let s = tr[key]; assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const sizes = { phone: { width: 390, height: 844 }, narrow: { width: 360, height: 740 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const DB = 'gina_qt2_' + randomBytes(8).toString('hex') + '_audit';
const containers = []; let created = false, proxy, serve, browser, stage = 'setup';
const results = []; const pass = (check, extra = {}) => { results.push({ check, passed: true, ...extra }); console.log('ok', check); };
const cleanup = {};

// ---------- local Postgres (the shared supabase_db_gina server, only our own database) ----------
function run(cmd, args, opts = {}) { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 900000, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...opts }); }
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
  assert.equal(sql("select count(*) from public.interaction_types where family='structured' and enabled and phase in ('1A','1B');"), '6', 'structured types not migrated');
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
    // QT-AI: Edge Function yerine yerel sahte uç (gerçek AI sağlayıcısı ÇAĞRILMAZ).
    if (req.url.startsWith('/functions/v1/')) { mockFunction(req, res, cors); return; }
    const route = [['/auth/v1', authPort], ['/rest/v1', restPort]].find(([p]) => req.url === p || req.url.startsWith(p + '/'));
    if (!route) { res.writeHead(404, cors); res.end(); return; }
    const up = http.request({ hostname: '127.0.0.1', port: route[1], path: req.url.slice(route[0].length) || '/', method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res); });
    up.on('error', () => { res.writeHead(502, cors); res.end(); }); req.pipe(up);
  });
  proxy.on('upgrade', (_req, socket) => socket.destroy());
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${proxy.address().port}`, anon: jwt('anon', secret), service: jwt('service_role', secret) };
}

// ---------- mocked learning-source Edge function (image upload/view without storage) ----------
const SOURCES = new Map();
function mockFunction(req, res, cors) {
  let raw = ''; req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const reply = (status, body) => { res.writeHead(status, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    try {
      if (req.url.startsWith('/functions/v1/learning-source')) {
        const b = JSON.parse(raw);
        if (b.action === 'reserve') {
          SOURCES.set(b.id, b);
          sql(`insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,width,height,storage_consent,verified_at)
            values('${b.id}','${S.family}','${S.parent}',${lit(b.kind)},${lit(b.name.slice(0, 160))},${lit(b.mime)},${b.bytes},${lit(b.sha256)},${lit('mock/' + b.id)},'ready',800,600,'mock_consent',now()) on conflict do nothing;`);
          return reply(200, { id: b.id, ready: true, bucket: 'mock', path: 'mock/' + b.id, token: 'mock' });
        }
        if (b.action === 'finalize') return reply(200, { id: b.id, status: 'ready' });
        if (b.action === 'view') return reply(200, { url: 'data:image/png;base64,' + S.png.toString('base64'), mime: 'image/png' });
        return reply(400, { error: 'mock_unsupported' });
      }
      return reply(404, { error: 'mock_not_found' });
    } catch (e) { reply(500, { error: String(e.message).slice(0, 200) }); }
  });
}

// ---------- synthetic accounts ----------
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

// ---------- browser helpers ----------
const pages = [];
async function newPage(size) {
  const context = await browser.newContext({ viewport: sizes[size], locale: 'tr-TR', hasTouch: size === 'phone' || size === 'narrow', timezoneId: 'Europe/Istanbul' });
  const page = await context.newPage(); page.setDefaultTimeout(25000); page.errors = []; page.size = size;
  page.on('pageerror', (e) => page.errors.push(e.message)); pages.push(page); return page;
}
const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const shots = [];
async function shot(page, name, focus) {
  if (focus) await page.getByTestId(focus).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const file = `${name}-${page.size}-${sizes[page.size].width}x${sizes[page.size].height}.png`;
  await page.screenshot({ path: `${out}/${file}`, fullPage: true }); shots.push(file);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), file + ': horizontal overflow');
  const text = await page.locator('body').innerText();
  assert.ok(!/prova\.qt\.|provaBuilder\.|provaP0\d\./.test(text), file + ': raw i18n key visible');
  assert.ok(!uuidRe.test(text), file + ': raw id visible');
  assert.ok(!/"[a-z_]+":|P0001|42501|PGRST|question_structure_invalid|interaction_type_/.test(text), file + ': raw server error/JSON visible');
}
async function signIn(page, u, WEB) {
  await page.goto(WEB); await page.getByLabel('E-posta', { exact: true }).fill(u.email); await page.getByLabel('Şifre', { exact: true }).fill(u.password);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await page.waitForURL('**/parent', { timeout: 40000 });
}
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const field = (scope, label) => scope.getByLabel(label, { exact: true });
async function targets48(page, testId) {
  const found = await page.getByTestId(testId).first().evaluate((el) => [...el.querySelectorAll('[role=button],[role=switch],[role=radio]')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  for (const [w, h] of found) assert.ok(w >= 44 && h >= 44, `${testId}: target ${w}x${h}`);
  return found.length;
}

// ---------- authoring through the real screen ----------
async function openQuestion(page, WEB, type, stem, beforeNext, grade = 5) {
  await page.goto(`${WEB}/parent/prova/question?subject=Matematik&grade=${grade}`);
  await field(page, t('prova.topic')).fill('Faz 2 tekrar');
  await field(page, t('prova.stem')).fill(stem);
  await page.getByTestId('qt-type-picker').getByRole('button', { name: t('prova.qt.author.type.' + type), exact: true }).click();
  await page.getByTestId('qt-type-help').waitFor();
  if (beforeNext) await beforeNext();
  await button(page, t('provaP02.editor.next')).click();
  await page.getByTestId('qt-editor-' + type).waitFor();
}
async function toPreviewAndSave(page, type, shotName) {
  await page.getByTestId('qt-author-valid').waitFor();
  if (shotName) await shot(page, shotName + '-editor', 'qt-editor-' + type);
  await button(page, t('provaP02.editor.next')).click();
  await page.getByTestId('qt-preview').first().waitFor();
  await page.getByRole('switch', { name: t('prova.qt.author.preview.showKey') }).click();
  if (shotName) await shot(page, shotName + '-preview-key', 'qt-preview');
  const before = Number(sql(`select count(*) from public.question_bank where interaction_type=${lit(type)};`));
  await button(page, t('common.save')).click();
  for (let i = 0; i < 60 && Number(sql(`select count(*) from public.question_bank where interaction_type=${lit(type)};`)) === before; i++) await page.waitForTimeout(250);
  const id = sql(`select id from public.question_bank where interaction_type=${lit(type)} order by created_at desc limit 1;`);
  assert.ok(id, type + ' not saved');
  const row = JSON.parse(sql(`select json_build_object('kind',q.kind,'payload',q.payload,'key',k.key) from public.question_bank q join public.question_answer_keys k on k.question_id=q.id where q.id='${id}';`));
  assert.equal(row.kind, 'structured');
  for (const leak of ['"targets"', '"errors"', '"correct"', '"accepted"', '"time"']) assert.ok(!JSON.stringify(row.payload).includes(leak), type + ': key leaked into payload ' + leak);
  return { id, ...row };
}
const tok = (page, text) => page.getByTestId('qt-token-picker').getByRole('button', { name: text, exact: true });

(async () => {
  stage = 'stack'; S = await setupStack();
  stage = 'fixture';
  const A = await user();
  const tokenA = await login(A);
  const fam = await rpc(tokenA, 'create_family', { p_name: 'Sentetik QT2 ailesi', p_display_name: 'Sentetik veli' }); assert.ok(fam.ok, 'create_family'); A.family = fam.data;
  A.child = randomUUID();
  sql(`update public.plans set prova_monthly_exams=null where code='free';
    update public.app_settings set value='true' where key='sources.enabled';
    insert into public.children(id,family_id,name,grade) values('${A.child}','${A.family}','Ece',5);`);
  S.family = A.family; S.parent = A.id;
  const token = await login(A);
  // Phases are enabled in THIS disposable DB only.
  sql(`update public.interaction_types set enabled=true where phase in ('2A','2B');`);
  assert.equal(sql(`select count(*) from public.interaction_types where phase in ('2A','2B') and enabled;`), '6');

  stage = 'export';
  const exportWeb = async (on) => {
    const dist = path.join(work, (on ? 'web-on-' : 'web-off-') + DB.slice(9, 25));
    run('pnpm', ['exec', 'expo', 'export', '-p', 'web', '--output-dir', dist, '--clear'], { cwd: root + '/apps/mobile', env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: S.url, EXPO_PUBLIC_SUPABASE_ANON_KEY: S.anon, CI: '1',
      ...(on ? { EXPO_PUBLIC_QT_PHASE2A: '1', EXPO_PUBLIC_QT_PHASE2B: '1' } : { EXPO_PUBLIC_QT_PHASE2A: '', EXPO_PUBLIC_QT_PHASE2B: '' }) } });
    const port = await freePort();
    const child = spawn('node', [root + '/scripts/u02/serve-spa.mjs', dist, String(port)], { stdio: 'ignore' });
    await healthy(port, '/');
    return { url: `http://127.0.0.1:${port}`, child };
  };
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  // 0) Release build (switches OFF): nothing new is shown, even with the types enabled server-side.
  stage = 'switch_off';
  const off = await exportWeb(false);
  {
    const page = await newPage('phone'); await signIn(page, A, off.url);
    await page.goto(`${off.url}/parent/prova/question?subject=Matematik&grade=5`); await page.getByTestId('qt-type-picker').waitFor();
    assert.equal(await page.getByTestId('qt-type-picker').getByRole('button').count(), 8, 'switch off: only 2 legacy + 6 1A/1B types');
    for (const ty of ['mark_text', 'error_fix', 'multi_choice', 'two_stage', 'region_select', 'clock']) assert.equal(await page.getByText(t('prova.qt.author.type.' + ty), { exact: true }).count(), 0);
    await page.getByTestId('qt-type-picker').getByRole('button', { name: t('prova.qt.author.type.true_false'), exact: true }).click();
    await field(page, t('prova.topic')).fill('x'); await field(page, t('prova.stem')).fill('Kapalı anahtar kontrolü');
    await button(page, t('provaP02.editor.next')).click(); await page.getByTestId('qt-editor-true_false').waitFor();
    assert.equal(await page.getByTestId('qt-stimulus-editor').count(), 0, 'switch off: no stimulus editor');
    await shot(page, 'switch-off-type-picker');
    await page.context().close(); pages.pop();
  }
  off.child.kill('SIGTERM');
  pass('release_build_with_switches_off_shows_nothing_new');

  const on = await exportWeb(true); serve = on.child; const WEB = on.url;
  // Synthetic "map" image for the image-region question (PNG rendered locally).
  {
    const pg = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
    await pg.setContent('<body style="margin:0;background:#E8F4F0"><div style="position:absolute;left:80px;top:80px;width:160px;height:120px;border-radius:50%;background:#7DC4E4"></div><div style="position:absolute;left:480px;top:300px;width:0;height:0;border-left:120px solid transparent;border-right:120px solid transparent;border-bottom:200px solid #9C8A6E"></div></body>');
    S.png = await pg.screenshot({ type: 'png' }); fs.writeFileSync(path.join(work, 'map.png'), S.png); await pg.context().close();
  }

  // 1) One question of each 2A/2B type through the real UI (phone).
  stage = 'author';
  const phone = await newPage('phone'); await signIn(phone, A, WEB);
  await phone.goto(`${WEB}/parent/prova/question?subject=Matematik&grade=5`); await phone.getByTestId('qt-type-picker').waitFor();
  assert.equal(await phone.getByTestId('qt-type-picker').getByRole('button').count(), 14);
  await targets48(phone, 'qt-type-picker');
  await shot(phone, 'type-picker', 'qt-type-picker');
  const Q = {};

  await openQuestion(phone, WEB, 'mark_text', 'Metindeki fiillerin altını çiz.');
  await field(phone, t('prova.qt.author.p2.passage')).fill('Kedi hızlı koştu ve sonra uyudu.');
  await tok(phone, 'koştu').click(); await tok(phone, 'uyudu').click();
  Q.mark_text = await toPreviewAndSave(phone, 'mark_text', 'mark-text');
  assert.equal(Q.mark_text.key.targets.length, 2);
  assert.equal(Q.mark_text.payload.segments.filter((x) => x.id).length, 6);

  await openQuestion(phone, WEB, 'error_fix', 'Hatalı kelimeyi bul ve düzelt.');
  await field(phone, t('prova.qt.author.p2.passage')).fill('Ben dün okula gitdim ve derse girdim.');
  await tok(phone, 'gitdim').click();
  await field(phone, t('prova.qt.author.p2.fixFor', { word: 'gitdim' })).fill('gittim');
  Q.error_fix = await toPreviewAndSave(phone, 'error_fix', 'error-fix');
  assert.deepEqual(Object.values(Q.error_fix.key.errors), [{ accepted: ['gittim'] }]);

  await openQuestion(phone, WEB, 'multi_choice', 'Hangileri asal sayıdır?');
  for (const [l, v] of [['A', '2'], ['B', '4'], ['C', '6'], ['D', '7']]) await field(phone, t('prova.qt.author.p2.option', { letter: l })).fill(v);
  await button(phone.getByTestId('qt-row-o1'), t('prova.qt.author.p2.correct')).click();
  await button(phone.getByTestId('qt-row-o4'), t('prova.qt.author.p2.correct')).click();
  Q.multi_choice = await toPreviewAndSave(phone, 'multi_choice', 'multi-choice');
  assert.deepEqual(Q.multi_choice.key.correct, ['o1', 'o4']); assert.equal(Q.multi_choice.payload.select_count, 2);

  await openQuestion(phone, WEB, 'two_stage', 'Bitkiler ve ışık');
  await field(phone, t('prova.qt.author.p2.stage1')).fill('Bitki karanlıkta büyür mü?');
  await field(phone.getByTestId('qt-stage1-options'), t('prova.qt.author.p2.option', { letter: 'A' })).fill('Evet');
  await field(phone.getByTestId('qt-stage1-options'), t('prova.qt.author.p2.option', { letter: 'B' })).fill('Hayır');
  await button(phone.getByTestId('qt-row-a2'), t('prova.qt.author.p2.correct')).click();
  await field(phone, t('prova.qt.author.p2.stage2')).fill('Neden? Açıkla.');
  await button(phone, t('prova.qt.author.p2.mode2_text')).click();
  Q.two_stage = await toPreviewAndSave(phone, 'two_stage', 'two-stage');
  assert.deepEqual(Q.two_stage.key, { stage1: 'a2' }); assert.equal(Q.two_stage.payload.stage2.mode, 'text');

  await openQuestion(phone, WEB, 'region_select', 'Şeklin 3/8’ini boya.');
  await phone.getByTestId('qt-editor-region_select').waitFor();
  await field(phone, t('prova.qt.author.p2.maxSelect')).fill(''); // grid 2x4 default
  await button(phone, t('prova.qt.author.region.key_count')).click();
  await field(phone, t('prova.qt.author.region.count', { total: 8 })).fill('3');
  Q.region_grid = await toPreviewAndSave(phone, 'region_select', 'region-grid');
  assert.deepEqual(Q.region_grid.key, { count: 3 }); assert.deepEqual(Q.region_grid.payload.figure, { kind: 'grid', rows: 2, cols: 4 });

  await openQuestion(phone, WEB, 'region_select', 'Pastanın 1. ve 3. dilimini işaretle.');
  await button(phone, t('prova.qt.author.region.figure_sectors')).click();
  await button(phone.getByTestId('qt-editor-region_select'), '6').click();
  await button(phone.getByTestId('qt-region-targets'), '1').click(); await button(phone.getByTestId('qt-region-targets'), '3').click();
  Q.region_sectors = await toPreviewAndSave(phone, 'region_select');
  assert.deepEqual(Q.region_sectors.key, { targets: ['d1', 'd3'] });

  // Image regions: attach the question image first (mocked upload), then place boxes by tapping.
  await openQuestion(phone, WEB, 'region_select', 'Haritada gölü işaretle.', async () => {
    const chooser = phone.waitForEvent('filechooser');
    await button(phone, t('sources.photo')).click();
    await (await chooser).setFiles(path.join(work, 'map.png'));
    await field(phone, t('sources.alt')).fill('Göl ve dağ olan sentetik harita');
    await phone.getByRole('switch', { name: t('sources.storageConsent') }).click();
  });
  await button(phone, t('prova.qt.author.region.figure_image')).click();
  const placer = phone.getByTestId('qt-box-placer'); await placer.waitFor();
  const bb = await placer.boundingBox();
  await placer.click({ position: { x: bb.width * 0.25, y: bb.height * 0.25 } });
  await placer.click({ position: { x: bb.width * 0.75, y: bb.height * 0.7 } });
  await field(phone, t('prova.qt.author.region.boxLabel', { letter: 'A' })).fill('Göl');
  await field(phone, t('prova.qt.author.region.boxLabel', { letter: 'B' })).fill('Dağ');
  const boxA = phone.getByTestId(/qt-row-b\d+/).first();
  await button(boxA, t('prova.qt.author.p2.correct')).click();
  Q.region_image = await toPreviewAndSave(phone, 'region_select', 'region-image');
  assert.equal(Q.region_image.payload.figure.source, 'question_media');
  const boxes = Q.region_image.payload.regions.map((r) => r.box);
  assert.ok(Math.abs(boxes[0][0] + boxes[0][2] / 2 - 0.25) < 0.05 && Math.abs(boxes[0][1] + boxes[0][3] / 2 - 0.25) < 0.05, 'box A centred on the tap ' + JSON.stringify(boxes));
  assert.equal(sql(`select count(*) from public.learning_source_links where question_id='${Q.region_image.id}';`), '1');

  await openQuestion(phone, WEB, 'clock', 'Saat kaçı gösteriyor?');
  await field(phone, t('prova.qt.author.clock.timeRead')).fill('8:30');
  await phone.getByTestId('qt-clock-a11y-note').getByText(t('prova.qt.author.clock.a11yNote'), { exact: true }).waitFor();
  await phone.getByRole('switch', { name: t('prova.qt.author.clock.accept12h') }).waitFor(); // grade 5: parent may choose
  Q.clock = await toPreviewAndSave(phone, 'clock', 'clock');
  assert.deepEqual(Q.clock.key, { time: '08:30', accept_12h: true }); assert.equal(Q.clock.payload.shown_time, '08:30');
  // Grade 5, toggle off → key without accept_12h.
  await openQuestion(phone, WEB, 'clock', 'Saati kur (24 saat).');
  await button(phone, t('prova.qt.author.clock.mode_set')).click();
  assert.equal(await phone.getByTestId('qt-clock-a11y-note').count(), 0, 'a11y note only in read mode');
  await field(phone, t('prova.qt.author.clock.timeSet')).fill('20:30');
  await phone.getByRole('switch', { name: t('prova.qt.author.clock.accept12h') }).click();
  const clock24 = await toPreviewAndSave(phone, 'clock');
  assert.deepEqual(clock24.key, { time: '20:30' });
  // Grade 3: no toggle, short explanation, accept_12h always sent true.
  await openQuestion(phone, WEB, 'clock', 'Saat kaçı gösteriyor?', undefined, 3);
  await field(phone, t('prova.qt.author.clock.timeRead')).fill('9:15');
  await phone.getByTestId('qt-clock-12h-fixed').waitFor();
  assert.equal(await phone.getByRole('switch', { name: t('prova.qt.author.clock.accept12h') }).count(), 0, 'grade 3: no 12h toggle');
  await shot(phone, 'clock-grade3-12h-fixed', 'qt-editor-clock');
  const clock3 = await toPreviewAndSave(phone, 'clock');
  assert.deepEqual(clock3.key, { time: '09:15', accept_12h: true });
  assert.equal(sql(`select grade from public.question_bank where id='${clock3.id}';`), '3');
  const young = await rpc(token, 'save_question_with_sources', { p_request_id: randomUUID(), p_images: [], p_question: { grade: 3, subject: 'Matematik', topic: 'x', difficulty: 'orta', stem: 'Saati kur.', interaction_type: 'clock', schema_version: 1, payload: { mode: 'set', display: 'analog', step_minutes: 5 }, answer_key: { time: '09:15', accept_12h: false } } });
  assert.equal(young.data.message, 'question_structure_invalid'); assert.ok(String(young.data.details).includes('clock_12h_required'), 'server code ' + young.data.details);

  // Stimulus (bar chart with alt) on a 1A question.
  await openQuestion(phone, WEB, 'true_false', 'Grafiğe göre değerlendir.');
  await field(phone, t('prova.qt.author.tf.statement', { n: 1 })).fill('3-B sınıfı en çok kitabı okudu.');
  await field(phone, t('prova.qt.author.tf.statement', { n: 2 })).fill('3-A sınıfı 10 kitap okudu.');
  await field(phone, t('prova.qt.author.tf.statement', { n: 3 })).fill('3-C sınıfı hiç kitap okumadı.');
  await button(phone.getByTestId('qt-row-s1'), t('prova.qt.author.tf.true')).click();
  await button(phone.getByTestId('qt-row-s2'), t('prova.qt.author.tf.false')).click();
  await button(phone.getByTestId('qt-row-s3'), t('prova.qt.author.tf.false')).click();
  await button(phone.getByTestId('qt-stimulus-editor'), t('prova.qt.author.stim.kind_bar_chart')).click();
  await field(phone, t('prova.qt.author.stim.chartText')).fill('3-A: 12\n3-B: 15\n3-C: 4');
  await field(phone, t('prova.qt.author.stim.caption')).fill('Okunan kitaplar');
  await phone.getByText(t('prova.qt.author.err.stimulus_alt_invalid'), { exact: false }).first().waitFor();
  await shot(phone, 'stimulus-alt-required', 'qt-stimulus-editor');
  await field(phone, t('prova.qt.author.stim.alt')).fill('Üç sınıfın okuduğu kitap sayıları: 3-A, 3-B ve 3-C.');
  Q.stimulus = await toPreviewAndSave(phone, 'true_false', 'stimulus-chart');
  assert.equal(Q.stimulus.payload.stimulus.kind, 'bar_chart'); assert.equal(Q.stimulus.payload.stimulus.bars.length, 3);
  pass('author_each_2a2b_type_and_stimulus_through_ui', { types: Object.keys(Q) });

  // 2) Broken: mark_text with every word as target → server code message; clock off-step.
  stage = 'validation';
  await openQuestion(phone, WEB, 'clock', 'Bozuk saat');
  await field(phone, t('prova.qt.author.clock.timeRead')).fill('08:32');
  await button(phone, t('provaP02.editor.next')).click();
  await phone.getByTestId('qt-author-errors').getByText(t('prova.qt.author.err.key_not_on_step'), { exact: false }).waitFor();
  await shot(phone, 'validation-clock-step', 'qt-author-errors');
  const srv = await rpc(token, 'save_question_with_sources', { p_request_id: randomUUID(), p_images: [], p_question: { grade: 5, subject: 'Matematik', topic: 'x', difficulty: 'orta', stem: 'Bozuk saat', interaction_type: 'clock', schema_version: 1, payload: { mode: 'read', display: 'analog', step_minutes: 5, shown_time: '08:32' }, answer_key: { time: '08:32' } } });
  assert.equal(srv.data.message, 'question_structure_invalid'); assert.ok(String(srv.data.details).includes('key_not_on_step'));
  pass('inline_and_server_codes_match_for_2b', { server: srv.data.details });

  // 3) Builder: meb_common blocks all 2A/2B types; free track assigns.
  stage = 'builder';
  const ids = [Q.mark_text, Q.error_fix, Q.multi_choice, Q.two_stage, Q.region_grid, Q.region_sectors, Q.region_image, Q.clock, Q.stimulus].map((q) => q.id);
  const draftId = randomUUID();
  const content = (track) => ({ childId: A.child, grade: 5, title: 'Faz 2 tekrar', purpose: 'practice', format: 'practice', subjects: ['Matematik'], topics: [], target: ids.length, minutes: null, difficulty: 'orta', kind: 'mixed', note: '', step: 3, blocks: ids.map((id) => ({ kind: 'question', id, source: 'manual' })),
    context: { scope: 'subject', track, term: null, program: null, academicYear: null, periodId: null, school: null, schoolDeclared: false } });
  const saved = await rpc(token, 'save_prova_draft', { p_request_id: randomUUID(), p_id: draftId, p_version: 0, p_content: content('meb_common') }); assert.ok(saved.ok);
  await phone.goto(`${WEB}/parent/prova/builder?draftId=${draftId}`);
  await phone.getByTestId('qt-track-blocked').waitFor();
  const blocked = await phone.getByTestId('qt-track-blocked').innerText();
  for (const ty of ['mark_text', 'error_fix', 'multi_choice', 'two_stage', 'region_select', 'clock']) assert.ok(blocked.includes(t('prova.qt.author.type.' + ty)), 'blocked ' + ty);
  await shot(phone, 'builder-meb-common-blocked', 'qt-track-blocked');
  const meb = await rpc(token, 'submit_prova_draft', { p_request_id: randomUUID(), p_id: draftId, p_version: saved.data.version });
  assert.equal(meb.data.message, 'interaction_type_not_allowed_for_track');
  const free = await rpc(token, 'save_prova_draft', { p_request_id: randomUUID(), p_id: draftId, p_version: saved.data.version, p_content: content('free') }); assert.ok(free.ok);
  await phone.goto(`${WEB}/parent/prova/builder?draftId=${draftId}`);
  await phone.getByRole('switch', { name: t('provaBuilder.answerShow') }).click();
  await phone.getByTestId('builder-qt-preview').waitFor();
  await shot(phone, 'builder-preview-key', 'builder-qt-preview');
  await phone.getByRole('switch', { name: t('provaBuilder.reviewCheck') }).click();
  await button(phone, t('provaBuilder.send')).click();
  await phone.waitForURL('**/parent/prova', { timeout: 30000 });
  assert.equal(sql(`select count(*) from gina.exam_item_bindings where exam_id='${draftId}';`), String(ids.length));
  pass('meb_common_blocks_2a2b_and_free_track_assigns', { server: meb.data.message, bound: ids.length });

  // 4) AI picker shows 2A/2B entries only behind the switch (no generation: the Edge function does not produce them yet).
  stage = 'ai_picker';
  const aiDraft = randomUUID();
  assert.ok((await rpc(token, 'save_prova_draft', { p_request_id: randomUUID(), p_id: aiDraft, p_version: 0, p_content: { ...content('free'), title: 'AI', blocks: [], step: 2, target: 3 } })).ok);
  sql(`update public.plans set prova_ai_generate_monthly=20 where code='free';`);
  await phone.goto(`${WEB}/parent/prova/builder?draftId=${aiDraft}`);
  await button(phone, t('provaBuilder.addQuestions')).click(); await button(phone, t('provaBuilder.ai')).click();
  await phone.getByTestId('qt-ai-types').waitFor();
  for (const ty of ['mark_text', 'two_stage', 'region_select', 'clock']) await button(phone.getByTestId('qt-ai-types'), t('prova.qt.author.type.' + ty)).waitFor();
  await shot(phone, 'ai-types-2a2b', 'qt-ai-types');
  pass('ai_picker_lists_2a2b_behind_switch');

  // 5) Booklet: student copy (paper areas, no key) and private key, as HTML + PDF.
  stage = 'booklet';
  await phone.addInitScript(() => {
    window.__booklets = [];
    const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', { configurable: true, get() {
      const w = desc.get.call(this);
      if (w && !w.__qtPatched) { w.__qtPatched = true; w.print = () => window.__booklets.push('<!doctype html>' + w.document.documentElement.outerHTML); }
      return w;
    } });
  });
  await phone.goto(`${WEB}/parent/prova/booklet`);
  await button(phone, t('prova.booklet.source.exam')).click();
  await phone.getByText('Faz 2 tekrar', { exact: true }).click();
  await phone.getByTestId('qt-booklet-paper-note').waitFor();
  await shot(phone, 'booklet-paper-note', 'qt-booklet-paper-note');
  await button(phone, t('provaP02.booklet.student')).click();
  await phone.waitForFunction(() => window.__booklets.length === 1, null, { timeout: 30000 });
  await button(phone, t('provaP02.booklet.key')).click();
  await phone.waitForFunction(() => window.__booklets.length === 2, null, { timeout: 30000 });
  const [studentHtml, keyHtml] = await phone.evaluate(() => window.__booklets);
  fs.writeFileSync(out + '/booklet-student.html', studentHtml); fs.writeFileSync(out + '/booklet-answer-key.html', keyHtml);
  for (const secret of ['gittim', 'Uyaran açıklaması', 'bölge boyanmalı', '12 saatlik', 'veli değerlendirir', 'Üç sınıfın okuduğu']) assert.ok(!studentHtml.includes(secret), 'student copy leaks ' + secret);
  for (const need of ['altını çiz', 'class="passage"', '2 seçenek işaretle.', '1. aşama', '2. aşama', 'class="rcell"', 'svg class="sectors"', 'class="regimg"', 'class="rbox"', 'svg class="clock"', 'svg class="chart"']) assert.ok(studentHtml.includes(need), 'student copy misses ' + need);
  for (const need of ['gitdim → <b>gittim</b>', '3 bölge boyanmalı', '<b>08:30</b>', 'Uyaran açıklaması: Üç sınıfın', 'A (Göl)', 'Serbest cevap: veli değerlendirir.']) assert.ok(keyHtml.includes(need), 'key misses ' + need);
  const fontCss = [['Nunito', 400, 'nunito/400Regular/Nunito_400Regular.ttf'], ['Nunito', 700, 'nunito/700Bold/Nunito_700Bold.ttf'], ['Baloo 2', 700, 'baloo-2/700Bold/Baloo2_700Bold.ttf']]
    .map(([f, w, file]) => `@font-face { font-family: "${f}"; font-style: normal; font-weight: ${w}; src: url(data:font/ttf;base64,${fs.readFileSync(root + '/node_modules/@expo-google-fonts/' + file).toString('base64')}) format("truetype"); }`).join('\n');
  const pdfPage = await (await browser.newContext()).newPage();
  const pdfInfo = {};
  for (const [name, html] of [['booklet-student', studentHtml], ['booklet-answer-key', keyHtml]]) {
    await pdfPage.setContent(html.replace('</head>', `<style>${fontCss}</style></head>`), { waitUntil: 'load' });
    await pdfPage.evaluate(() => document.fonts.ready);
    const overflow = await pdfPage.evaluate(() => [...document.querySelectorAll('.q, .key, table, svg, .regimg')].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length);
    assert.equal(overflow, 0, name + ' overflow');
    await pdfPage.pdf({ path: `${out}/${name}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const text = run('pdftotext', ['-layout', `${out}/${name}.pdf`, '-']);
    assert.ok(/Nunito/.test(run('pdffonts', [`${out}/${name}.pdf`])), name + ': Nunito not embedded');
    assert.ok(text.includes('ı') && text.includes('ş') && text.includes('ğ'), name + ': Turkish letters');
    pdfInfo[name] = { pages: Number(/Pages:\s+(\d+)/.exec(run('pdfinfo', [`${out}/${name}.pdf`]))[1]) };
    if (name === 'booklet-student') assert.ok(!text.includes('gittim'), 'student PDF leaks key');
    else assert.ok(text.includes('gittim') && text.includes('08:30'), 'key PDF incomplete');
  }
  pass('booklet_2a2b_student_and_key_pdf', pdfInfo);

  // 6) Key screens at the other viewports.
  stage = 'viewports';
  for (const size of ['narrow', 'tablet', 'desktop']) {
    const page = await newPage(size); await signIn(page, A, WEB);
    await page.goto(`${WEB}/parent/prova/question?subject=Matematik&grade=5`); await page.getByTestId('qt-type-picker').waitFor();
    await targets48(page, 'qt-type-picker');
    await shot(page, 'type-picker');
    await openQuestion(page, WEB, 'mark_text', 'Metindeki fiillerin altını çiz.');
    await field(page, t('prova.qt.author.p2.passage')).fill('Kedi hızlı koştu ve sonra uyudu.');
    await tok(page, 'koştu').click();
    await shot(page, 'mark-text-editor', 'qt-editor-mark_text');
    await openQuestion(page, WEB, 'region_select', 'Şeklin 3/8’ini boya.');
    await button(page.getByTestId('qt-region-targets'), 'A1').click();
    await button(page.getByTestId('qt-stimulus-editor'), t('prova.qt.author.stim.kind_table')).click();
    await field(page, t('prova.qt.author.stim.tableText')).fill('Sınıf | Kitap\n3-A | 12\n3-B | 15');
    await shot(page, 'region-grid-stimulus-editor', 'qt-editor-region_select');
    await openQuestion(page, WEB, 'clock', 'Saat kaçı gösteriyor?');
    await shot(page, 'clock-editor', 'qt-editor-clock');
    await page.goto(`${WEB}/parent/prova/booklet`); await button(page, t('prova.booklet.source.exam')).click();
    await page.getByText('Faz 2 tekrar', { exact: true }).click(); await page.getByTestId('qt-booklet-paper-note').waitFor();
    await shot(page, 'booklet-paper-note');
  }
  pass('screens_at_390_360_768_1280', { count: shots.length });
  for (const page of pages) assert.deepEqual(page.errors, [], page.size + ' runtime errors');
  pass('no_runtime_errors_overflow_raw_ids_or_keys');
})().then(() => finish(0), (e) => finish(1, e));

async function finish(code, error) {
  if (error) {
    console.log('CHECK_FAILED ' + stage + ' ' + String(error.stack || error.message).slice(0, 1500));
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
  const report = { environment: 'disposable-local-gotrue-postgrest (own clone of gina_completion_audit)', database_pattern: 'gina_qt2_<hex>_audit', viewports: sizes, passed: code === 0, failed_stage: code ? stage : undefined, results, screenshots: shots, cleanup };
  if (code === 0) fs.writeFileSync(out + '/ui-checks.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, code, cleanup }));
  process.exit(code || (cleanup.containers_left !== 'none' || cleanup.database_left !== '0' ? 1 : 0));
}
