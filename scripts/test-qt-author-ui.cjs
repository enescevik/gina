// QT10–QT13, QT20–QT21 parent authoring / assignment / booklet UI checks against a disposable local stack.
// Creates its own `gina_qtau_<hex>_audit` DB from the empty `gina_completion_audit` template, applies every
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
// Usage: GINA_QA_PLAYWRIGHT_PATH=<playwright module> GINA_QTAU_WORK=<scratch dir> node scripts/test-qt-author-ui.cjs --run-local
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
if (!process.argv.includes('--run-local')) throw Error('Explicit --run-local required');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const work = process.env.GINA_QTAU_WORK; assert.ok(work && path.isAbsolute(work), 'GINA_QTAU_WORK required');
const out = root + '/docs/release/qt-2026-11-07/screens/author'; fs.mkdirSync(out, { recursive: true });
const tr = JSON.parse(fs.readFileSync(root + '/packages/core/src/i18n/tr.json'));
const t = (key, vars = {}) => { let s = tr[key]; assert.ok(typeof s === 'string', 'missing key ' + key); for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v)); return s; };
const sizes = { phone: { width: 390, height: 844 }, narrow: { width: 360, height: 740 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const DB = 'gina_qtau_' + randomBytes(8).toString('hex') + '_audit';
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
  assert.equal(sql("select count(*) from public.interaction_types where family='structured' and enabled;"), '6', 'structured types not migrated');
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
const AUTHORED = {};
async function openQuestion(page, WEB, type, stem) {
  await page.goto(`${WEB}/parent/prova/question?subject=Matematik&grade=5`);
  await field(page, t('prova.topic')).fill('Karma tekrar');
  await field(page, t('prova.stem')).fill(stem);
  await page.getByTestId('qt-type-picker').getByRole('button', { name: t('prova.qt.author.type.' + type), exact: true }).click();
  await page.getByTestId('qt-type-help').waitFor();
  await button(page, t('provaP02.editor.next')).click();
  await page.getByTestId('qt-editor-' + type).waitFor();
}
async function toPreviewAndSave(page, type, shotName) {
  await page.getByTestId('qt-author-valid').waitFor();
  if (shotName) await shot(page, shotName + '-editor', 'qt-editor-' + type);
  await button(page, t('provaP02.editor.next')).click();
  await page.getByTestId('qt-preview').waitFor();
  if (shotName) await shot(page, shotName + '-preview', 'qt-preview');
  await page.getByRole('switch', { name: t('prova.qt.author.preview.showKey') }).click();
  if (shotName) await shot(page, shotName + '-preview-key', 'qt-preview');
  const before = Number(sql(`select count(*) from public.question_bank where interaction_type=${lit(type)};`));
  await button(page, t('common.save')).click();
  for (let i = 0; i < 60 && Number(sql(`select count(*) from public.question_bank where interaction_type=${lit(type)};`)) === before; i++) await page.waitForTimeout(250);
  const id = sql(`select id from public.question_bank where interaction_type=${lit(type)} order by created_at desc limit 1;`);
  assert.ok(id, type + ' not saved');
  const row = JSON.parse(sql(`select json_build_object('kind',q.kind,'schema',q.schema_version,'payload',q.payload,'key',k.key,'points',k.points) from public.question_bank q join public.question_answer_keys k on k.question_id=q.id where q.id='${id}';`));
  assert.equal(row.kind, 'structured'); assert.equal(row.schema, 1);
  assert.ok(!JSON.stringify(row.payload).includes('"answers"') && !JSON.stringify(row.payload).includes('"pairs"'), type + ': key leaked into payload');
  return { id, ...row };
}

async function authorAll(page, WEB) {
  // true/false (3 statements; one reordered after typing → ids stay)
  await openQuestion(page, WEB, 'true_false', 'Aşağıdaki ifadeleri değerlendir.');
  await field(page, t('prova.qt.author.tf.statement', { n: 1 })).fill('Güneş bir yıldızdır.');
  await field(page, t('prova.qt.author.tf.statement', { n: 2 })).fill('Ay kendi ışığını üretir.');
  await field(page, t('prova.qt.author.tf.statement', { n: 3 })).fill('Dünya Güneş’in çevresinde döner.');
  await button(page.getByTestId('qt-row-s1'), t('prova.qt.author.tf.true')).click();
  await button(page.getByTestId('qt-row-s2'), t('prova.qt.author.tf.false')).click();
  await button(page.getByTestId('qt-row-s3'), t('prova.qt.author.tf.true')).click();
  await page.getByRole('button', { name: t('prova.qt.author.moveDown', { label: t('prova.qt.author.tf.statement', { n: 1 }) }) }).click();
  AUTHORED.true_false = await toPreviewAndSave(page, 'true_false', 'tf');
  assert.deepEqual(AUTHORED.true_false.payload.statements.map((s) => s.id), ['s2', 's1', 's3']);
  assert.deepEqual(AUTHORED.true_false.key.answers, { s1: true, s2: false, s3: true });
  pass('author_true_false_ids_stable_after_reorder', { ids: AUTHORED.true_false.payload.statements.map((s) => s.id) });

  // fill blank, word bank + distractor
  await openQuestion(page, WEB, 'fill_blank', 'Boşlukları uygun kelimelerle doldur.');
  await field(page, t('prova.qt.author.fill.text')).fill('Su sıfır derecede donunca [[katı]] hâle geçer, ısıtılınca [[buhar]] olur.');
  await button(page, '+ ' + t('prova.qt.author.fill.addDistractor')).click();
  await field(page, t('prova.qt.author.fill.distractor', { n: 1 })).fill('sıvı');
  AUTHORED.fill_blank = await toPreviewAndSave(page, 'fill_blank', 'fill-bank');
  assert.equal(AUTHORED.fill_blank.payload.input, 'bank'); assert.equal(AUTHORED.fill_blank.payload.bank.length, 3);
  assert.deepEqual(Object.keys(AUTHORED.fill_blank.key.blanks).sort(), ['b1', 'b2']);
  pass('author_fill_blank_bank', { bank: AUTHORED.fill_blank.payload.bank.map((w) => w.text) });

  // fill blank, typing (keyboard) with alternatives
  await openQuestion(page, WEB, 'fill_blank', 'Türkiye’nin başkentini yaz.');
  await field(page, t('prova.qt.author.fill.text')).fill('Türkiye’nin başkenti [[Ankara|ANKARA]] şehridir.');
  await button(page, t('prova.qt.author.fill.input_keyboard')).click();
  await page.getByTestId('qt-author-guidance').waitFor(); // 1 blank by typing → bank suggestion (advisory only)
  const keyboard = await toPreviewAndSave(page, 'fill_blank');
  assert.equal(keyboard.payload.input, 'keyboard'); assert.deepEqual(keyboard.key.blanks.b1.accepted, ['Ankara', 'ANKARA']);
  AUTHORED.fill_keyboard = keyboard;
  pass('author_fill_blank_keyboard_guidance_not_blocking');

  // matching one_to_one with a distractor
  await openQuestion(page, WEB, 'matching', 'Organları görevleriyle eşleştir.');
  for (const [label, v] of [[t('prova.qt.author.match.rightItem', { letter: 'A' }), 'Kanı pompalar'], [t('prova.qt.author.match.rightItem', { letter: 'B' }), 'Solunumu sağlar'], [t('prova.qt.author.match.rightItem', { letter: 'C' }), 'Görmeyi sağlar']]) await field(page, label).fill(v);
  await button(page, '+ ' + t('prova.qt.author.match.addRight')).click();
  await field(page, t('prova.qt.author.match.rightItem', { letter: 'D' })).fill('Sindirime yardım eder');
  for (const [label, v] of [[t('prova.qt.author.match.leftItem', { n: 1 }), 'Kalp'], [t('prova.qt.author.match.leftItem', { n: 2 }), 'Akciğer'], [t('prova.qt.author.match.leftItem', { n: 3 }), 'Göz']]) await field(page, label).fill(v);
  await page.getByTestId('qt-row-l1').getByRole('button', { name: /^A · / }).click();
  await page.getByTestId('qt-row-l2').getByRole('button', { name: /^B · / }).click();
  await page.getByTestId('qt-row-l3').getByRole('button', { name: /^C · / }).click();
  AUTHORED.matching = await toPreviewAndSave(page, 'matching', 'matching');
  assert.deepEqual(AUTHORED.matching.key.pairs, { l1: 'r1', l2: 'r2', l3: 'r3' }); assert.equal(AUTHORED.matching.payload.right.length, 4);
  pass('author_matching_with_distractor');

  // numeric with units, conversion, tolerance, unit weight, process required, work area; points 2
  await openQuestion(page, WEB, 'numeric', 'Bir kumaşın uzunluğu kaç santimetredir?');
  await field(page, t('prova.qt.author.num.value')).fill('150');
  await page.getByRole('switch', { name: t('prova.qt.author.num.unitRequired') }).click();
  await field(page, t('prova.qt.author.num.unit', { n: 1 })).fill('cm');
  await button(page.getByTestId('qt-row-u1'), t('prova.qt.author.num.isKeyUnit')).click();
  await button(page, '+ ' + t('prova.qt.author.num.addUnit')).click();
  await field(page, t('prova.qt.author.num.unit', { n: 2 })).fill('m');
  await field(page, t('prova.qt.author.num.factor', { unit: 'm', base: 'cm' })).fill('100');
  await field(page, t('prova.qt.author.num.unitWeight')).fill('25');
  await field(page, t('prova.qt.author.num.absTolerance')).fill('0,5');
  await page.getByRole('switch', { name: t('prova.qt.author.num.workArea') }).click();
  await page.getByRole('switch', { name: t('prova.qt.author.num.processRequired') }).click();
  await field(page, t('prova.qt.author.points')).fill('2');
  AUTHORED.numeric = await toPreviewAndSave(page, 'numeric', 'numeric');
  assert.deepEqual(AUTHORED.numeric.key, { value: '150', unit: 'u1', unit_factors: { u1: 1, u2: 100 }, abs_tolerance: 0.5, unit_weight: 0.25, process_required: true });
  assert.equal(Number(AUTHORED.numeric.points), 2); assert.equal(AUTHORED.numeric.payload.work_area, true);
  pass('author_numeric_units_conversion_tolerance_points', { key: AUTHORED.numeric.key });

  // ordering (sentence) with a second accepted order
  await openQuestion(page, WEB, 'ordering', 'Kelimelerle anlamlı bir cümle kur.');
  await button(page, t('prova.qt.author.order.mode_sentence')).click();
  for (const [n, v] of [[1, 'Ali'], [2, 'okula'], [3, 'gitti']]) await field(page, t('prova.qt.author.order.item', { n })).fill(v);
  await button(page, '+ ' + t('prova.qt.author.order.addAlt')).click();
  await page.getByTestId('qt-alt-0').getByRole('button', { name: t('prova.qt.author.moveDown', { label: 'Ali' }) }).click();
  AUTHORED.ordering = await toPreviewAndSave(page, 'ordering', 'ordering');
  assert.deepEqual(AUTHORED.ordering.key.orders, [['o1', 'o2', 'o3'], ['o2', 'o1', 'o3']]);
  pass('author_ordering_two_accepted_orders');

  // classification with capacity
  await openQuestion(page, WEB, 'classification', 'Canlıları gruplarına ayır.');
  await field(page, t('prova.qt.author.class.category', { n: 1 })).fill('Hayvan');
  await field(page, t('prova.qt.author.class.category', { n: 2 })).fill('Bitki');
  await page.getByTestId('qt-row-c1').getByLabel(t('prova.qt.author.class.capacity'), { exact: true }).fill('2');
  await field(page, t('prova.qt.author.class.item', { n: 1 })).fill('Kedi');
  await field(page, t('prova.qt.author.class.item', { n: 2 })).fill('Papatya');
  await button(page, '+ ' + t('prova.qt.author.class.addItem')).click();
  await field(page, t('prova.qt.author.class.item', { n: 3 })).fill('Kartal');
  for (const [id, cat] of [['i1', 'Hayvan'], ['i2', 'Bitki'], ['i5', 'Hayvan']]) await button(page.getByTestId('qt-row-' + id), cat).click();
  AUTHORED.classification = await toPreviewAndSave(page, 'classification', 'classification');
  assert.deepEqual(AUTHORED.classification.key.membership, { i1: 'c1', i2: 'c2', i5: 'c1' });
  pass('author_classification_capacity');
}

(async () => {
  stage = 'stack'; S = await setupStack();
  stage = 'fixture';
  const A = await user();
  const tokenA = await login(A);
  const fam = await rpc(tokenA, 'create_family', { p_name: 'Sentetik QT ailesi', p_display_name: 'Sentetik veli' }); assert.ok(fam.ok, 'create_family ' + JSON.stringify(fam.data).slice(0, 200)); A.family = fam.data;
  A.child = randomUUID();
  sql(`update public.plans set prova_monthly_exams=null where code='free'; insert into public.children(id,family_id,name,grade) values('${A.child}','${A.family}','Ece',5);`);
  const token = await login(A); // refreshed claims (family)

  stage = 'export';
  const dist = path.join(work, 'web-' + DB.slice(10, 26));
  run('pnpm', ['exec', 'expo', 'export', '-p', 'web', '--output-dir', dist, '--clear'], { cwd: root + '/apps/mobile', env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: S.url, EXPO_PUBLIC_SUPABASE_ANON_KEY: S.anon, CI: '1' } });
  const webPort = await freePort();
  serve = spawn('node', [root + '/scripts/u02/serve-spa.mjs', dist, String(webPort)], { stdio: 'ignore' });
  const WEB = `http://127.0.0.1:${webPort}`; await healthy(webPort, '/');
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  // 1) Type picker on every plan (Free family) + one question of each type through the UI.
  stage = 'author';
  const phone = await newPage('phone'); await signIn(phone, A, WEB);
  await phone.goto(`${WEB}/parent/prova/question?subject=Matematik&grade=5`);
  await phone.getByTestId('qt-type-picker').waitFor();
  const picker = await targets48(phone, 'qt-type-picker');
  assert.equal(picker, 8, 'two legacy + six structured type buttons');
  await shot(phone, 'type-picker', 'qt-type-picker');
  await authorAll(phone, WEB);

  // 2) Broken question: inline codes in the form, same codes from the server for the same payload.
  stage = 'validation';
  await openQuestion(phone, WEB, 'true_false', 'Bozuk soru: cevap seçilmedi.');
  await field(phone, t('prova.qt.author.tf.statement', { n: 1 })).fill('Kediler memelidir ve uçar.');
  await button(phone, t('provaP02.editor.next')).click();
  await phone.getByTestId('qt-author-errors').waitFor();
  const shown = await phone.getByTestId('qt-author-errors').innerText();
  assert.ok(shown.includes(t('prova.qt.author.err.row_empty')), 'row_empty message');
  assert.ok(shown.includes(t('prova.qt.author.err.statements_invalid')), 'statements_invalid message');
  await phone.getByTestId('qt-author-guidance').waitFor();
  await shot(phone, 'validation-errors', 'qt-author-errors');
  for (const n of [2, 3]) await phone.getByRole('button', { name: t('prova.qt.author.remove', { label: t('prova.qt.author.tf.statement', { n: 2 }) }) }).click().catch(() => {});
  await phone.getByTestId('qt-author-errors').getByText(t('prova.qt.author.err.true_false.key_missing_id'), { exact: false }).waitFor();
  await shot(phone, 'validation-key-missing', 'qt-author-errors');
  assert.equal(await phone.getByTestId('qt-preview').count(), 0, 'must not reach preview while invalid');
  const broken = await rpc(token, 'save_question_with_sources', { p_request_id: randomUUID(), p_images: [], p_question: { grade: 5, subject: 'Matematik', topic: 'Karma', difficulty: 'orta', stem: 'Bozuk soru', interaction_type: 'true_false', schema_version: 1, payload: { statements: [{ id: 's1', text: 'Kediler memelidir.' }] }, answer_key: { answers: {} } } });
  assert.equal(broken.ok, false); assert.equal(broken.data.message, 'question_structure_invalid'); assert.equal(broken.data.details, 'key_missing_id');
  assert.ok(tr['prova.qt.author.err.true_false.key_missing_id'] && tr['prova.qt.author.err.key_missing_id']);
  pass('broken_question_inline_errors_and_server_detail_codes_match', { server: broken.data.details, inline: ['key_missing_id'] });

  // 3) Builder: MEB Common Written track blocks practice-only types (UI + server); free track assigns with a device warning.
  stage = 'builder';
  const ids = [AUTHORED.true_false, AUTHORED.fill_blank, AUTHORED.fill_keyboard, AUTHORED.matching, AUTHORED.numeric, AUTHORED.ordering, AUTHORED.classification].map((q) => q.id);
  const draftId = randomUUID();
  const content = (track) => ({ childId: A.child, grade: 5, title: 'Etkileşimli tekrar', purpose: 'practice', format: 'practice', subjects: ['Matematik'], topics: [], target: ids.length, minutes: null, difficulty: 'orta', kind: 'mixed', note: '', step: 3, blocks: ids.map((id) => ({ kind: 'question', id, source: 'manual' })),
    context: { scope: 'subject', track, term: null, program: null, academicYear: null, periodId: null, school: null, schoolDeclared: false } });
  const saved = await rpc(token, 'save_prova_draft', { p_request_id: randomUUID(), p_id: draftId, p_version: 0, p_content: content('meb_common') });
  assert.ok(saved.ok, 'draft ' + JSON.stringify(saved.data).slice(0, 300));
  // A device that reports only the legacy types (old app) → warning, not a block.
  A.device = (await user()).id;
  sql(`insert into public.devices(family_id,auth_user_id,name,active_child_id,question_types,question_types_at) values('${A.family}','${A.device}','Eski tablet','${A.child}',array['multiple_choice','open_ended'],now());`);
  await phone.goto(`${WEB}/parent/prova/builder?draftId=${draftId}`);
  await phone.getByTestId('qt-track-blocked').waitFor();
  const blockedText = await phone.getByTestId('qt-track-blocked').innerText();
  for (const ty of ['true_false', 'fill_blank', 'matching', 'ordering', 'classification']) assert.ok(blockedText.includes(t('prova.qt.author.type.' + ty)), 'blocked list ' + ty);
  assert.ok(!blockedText.includes(t('prova.qt.author.type.numeric')), 'numeric is not practice-only');
  await phone.getByRole('switch', { name: t('provaBuilder.reviewCheck') }).click();
  assert.equal(await phone.getByRole('button', { name: t('provaBuilder.send'), exact: true }).isDisabled(), true, 'send must be disabled on meb_common with practice types');
  await shot(phone, 'builder-meb-common-blocked', 'qt-track-blocked');
  const meb = await rpc(token, 'submit_prova_draft', { p_request_id: randomUUID(), p_id: draftId, p_version: saved.data.version });
  assert.equal(meb.ok, false); assert.equal(meb.data.message, 'interaction_type_not_allowed_for_track');
  assert.equal(sql(`select count(*) from public.exams where id='${draftId}';`), '0');
  pass('meb_common_blocks_practice_types_ui_and_server', { server: meb.data.message });

  const freeDraft = await rpc(token, 'save_prova_draft', { p_request_id: randomUUID(), p_id: draftId, p_version: saved.data.version, p_content: content('free') });
  assert.ok(freeDraft.ok, 'free draft ' + JSON.stringify(freeDraft.data).slice(0, 300));
  await phone.goto(`${WEB}/parent/prova/builder?draftId=${draftId}`);
  await phone.getByTestId('qt-device-support').waitFor();
  assert.equal(await phone.getByTestId('qt-track-blocked').count(), 0);
  const warn = await phone.getByTestId('qt-device-support').innerText();
  assert.ok(warn.includes(t('prova.qt.author.type.numeric')) && warn.includes(t('prova.qt.author.device.update')));
  await shot(phone, 'builder-device-warning', 'qt-device-support');
  // Answer preview of a structured question inside the builder (private key via parent RPC).
  await phone.getByRole('switch', { name: t('provaBuilder.answerShow') }).click();
  await phone.getByTestId('builder-qt-preview').waitFor();
  await shot(phone, 'builder-preview-key', 'builder-qt-preview');
  await phone.getByRole('switch', { name: t('provaBuilder.reviewCheck') }).click();
  await button(phone, t('provaBuilder.send')).click();
  await phone.waitForURL('**/parent/prova', { timeout: 30000 });
  const exam = JSON.parse(sql(`select json_build_object('status',status,'track',assessment_track,'n',cardinality(question_ids),'bound',(select count(*) from gina.exam_item_bindings b where b.exam_id=e.id),'order',question_ids) from public.exams e where id='${draftId}';`));
  assert.equal(exam.status, 'assigned'); assert.equal(exam.track, 'free'); assert.equal(exam.n, 7); assert.equal(exam.bound, 7);
  assert.deepEqual(exam.order, ids);
  pass('assign_mixed_structured_prova_with_device_warning', { exam_status: exam.status, bound_items: exam.bound });

  // 4) Booklet: student copy and private answer key, separately.
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
  await phone.getByText('Etkileşimli tekrar', { exact: true }).click();
  await phone.getByTestId('qt-booklet-paper-note').waitFor();
  await shot(phone, 'booklet-paper-note', 'qt-booklet-paper-note');
  await button(phone, t('provaP02.booklet.student')).click();
  await phone.waitForFunction(() => window.__booklets.length === 1, null, { timeout: 30000 });
  await button(phone, t('provaP02.booklet.key')).click();
  await phone.waitForFunction(() => window.__booklets.length === 2, null, { timeout: 30000 });
  const [studentHtml, keyHtml] = await phone.evaluate(() => window.__booklets);
  fs.writeFileSync(out + '/booklet-student.html', studentHtml); fs.writeFileSync(out + '/booklet-answer-key.html', keyHtml);
  assert.ok(!studentHtml.includes('class="key"'), 'student copy contains key section');
  for (const secret of ['ANKARA', 'Kabul edilen sıra', 'İşlem gerekli', '1 m = 100 cm']) assert.ok(!studentHtml.includes(secret), 'student copy leaks ' + secret);
  for (const need of ['class="sq"', 'class="blank"', 'class="bank"', 'class="slot"', 'class="ansbox"', 'class="unitline"', '<th>Hayvan']) assert.ok(studentHtml.includes(need), 'student copy misses ' + need);
  const stems = ['Aşağıdaki ifadeleri', 'Boşlukları uygun', 'başkentini yaz', 'Organları görevleriyle', 'Bir kumaşın', 'Kelimelerle anlamlı', 'Canlıları gruplarına'];
  const pos = stems.map((s) => studentHtml.indexOf(s)); assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), 'question order ' + pos);
  for (const need of ['Ankara / ANKARA', '1 m = 100 cm', 'İşlem gerekli', 'Kabul edilen sıra 2', 'Hayvan: <b>']) assert.ok(keyHtml.includes(need), 'answer key misses ' + need);
  assert.ok(!keyHtml.includes('class="cover"'), 'key copy has the student cover');
  // Render real PDFs with the app fonts (same @font-face embedding as native) and read the text layer.
  const fontCss = [['Nunito', 400, 'nunito/400Regular/Nunito_400Regular.ttf'], ['Nunito', 700, 'nunito/700Bold/Nunito_700Bold.ttf'], ['Baloo 2', 700, 'baloo-2/700Bold/Baloo2_700Bold.ttf']]
    .map(([f, w, file]) => `@font-face { font-family: "${f}"; font-style: normal; font-weight: ${w}; src: url(data:font/ttf;base64,${fs.readFileSync(root + '/node_modules/@expo-google-fonts/' + file).toString('base64')}) format("truetype"); }`).join('\n');
  const pdfPage = await (await browser.newContext()).newPage();
  const pdfInfo = {};
  for (const [name, html] of [['booklet-student', studentHtml], ['booklet-answer-key', keyHtml]]) {
    await pdfPage.setContent(html.replace('</head>', `<style>${fontCss}</style></head>`), { waitUntil: 'load' });
    await pdfPage.evaluate(() => document.fonts.ready);
    await pdfPage.pdf({ path: `${out}/${name}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const text = run('pdftotext', ['-layout', `${out}/${name}.pdf`, '-']);
    const fonts = run('pdffonts', [`${out}/${name}.pdf`]);
    assert.ok(/Nunito/.test(fonts), name + ': Nunito not embedded');
    assert.ok(text.includes('ı') && text.includes('ş') && text.includes('ğ') && text.includes('İ'), name + ': Turkish letters missing in text layer');
    const pages = Number(/Pages:\s+(\d+)/.exec(run('pdfinfo', [`${out}/${name}.pdf`]))[1]);
    pdfInfo[name] = { pages, nunito: true };
    if (name === 'booklet-student') assert.ok(!text.includes('ANKARA') && !text.includes('Kabul edilen'), 'student PDF leaks key');
    else assert.ok(text.includes('ANKARA') && text.includes('Kabul edilen sıra'), 'key PDF incomplete');
  }
  // No content wider than the A4 print area.
  const overflow = await pdfPage.evaluate(() => [...document.querySelectorAll('.q, .key, table')].filter((el) => el.scrollWidth > el.clientWidth + 1).length);
  assert.equal(overflow, 0);
  pass('booklet_student_and_private_key_separate_pdf_turkish_fonts', pdfInfo);

  // 5) Same key screens at every viewport.
  stage = 'viewports';
  for (const size of ['narrow', 'tablet', 'desktop']) {
    const page = await newPage(size); await signIn(page, A, WEB);
    await page.goto(`${WEB}/parent/prova/question?subject=Matematik&grade=5`); await page.getByTestId('qt-type-picker').waitFor();
    await targets48(page, 'qt-type-picker');
    await shot(page, 'type-picker');
    await openQuestion(page, WEB, 'matching', 'Organları görevleriyle eşleştir.');
    await field(page, t('prova.qt.author.match.leftItem', { n: 1 })).fill('Kalp');
    await button(page, t('provaP02.editor.next')).click(); await page.getByTestId('qt-author-errors').waitFor();
    await shot(page, 'matching-editor-errors', 'qt-editor-matching');
    await page.goto(`${WEB}/parent/prova/builder?draftId=${draftId}`); await page.getByRole('button', { name: t('provaBuilder.send'), exact: true }).waitFor();
    await page.waitForTimeout(800);
    await shot(page, 'builder-assigned');
    await page.goto(`${WEB}/parent/prova/booklet`); await button(page, t('prova.booklet.source.exam')).click();
    await page.getByText('Etkileşimli tekrar', { exact: true }).click(); await page.getByTestId('qt-booklet-paper-note').waitFor();
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
  const report = { environment: 'disposable-local-gotrue-postgrest (own clone of gina_completion_audit)', database_pattern: 'gina_qtau_<hex>_audit', viewports: sizes, passed: code === 0, failed_stage: code ? stage : undefined, results, screenshots: shots, cleanup };
  if (code === 0) fs.writeFileSync(out + '/ui-checks.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, code, cleanup }));
  process.exit(code || (cleanup.containers_left !== 'none' || cleanup.database_left !== '0' ? 1 : 0));
}
