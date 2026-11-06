// C13 performance runner. Invoked only by scripts/security/c13-perf.py against ephemeral loopback Auth/REST
// services in a disposable DB clone (prefix gina_c13p_). Measures what the apps really issue today:
//   child "Bugün" (apps/mobile/src/lib/use-child-today.ts), calendar week + 42-day window (plan_for_days via
//   components/planner/week-plans.ts), tasks screen (tasks-screen.tsx), Prova review (review/[attemptId].tsx +
//   get_saved_exam_answers_v3 with drawn documents), backoffice content list (admin_library_content_page as a
//   `content` operator) and large lists (500 learning_sources, notes, help tickets/attachments).
// Each read: p50/p95 over real PostgREST with real GoTrue tokens, and EXPLAIN (ANALYZE, BUFFERS) inside the same
// disposable DB with the same JWT claims plus per-statement function call counts (track_functions) so per-row
// helper evaluation is visible. Before/after: GINA_C13_CANDIDATE=<sql file> is applied in the disposable DB after
// the "before" pass and everything is re-measured on the same seed ("after"); GINA_C13_ROLLBACK=<sql file>
// (optional) restores the original and measures a third pass ("before2") to bracket Docker drift.
// No production data, no hosted project, no secret values written.
import http from 'node:http';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
const require = createRequire(new URL('../../apps/mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const authPort = Number(process.env.GINA_QA_AUTH_PORT), restPort = Number(process.env.GINA_QA_REST_PORT), DB = process.env.GINA_QA_DB;
if (![authPort, restPort].every(v => Number.isInteger(v) && v > 1024 && v < 65536) || !process.env.GINA_QA_SERVICE || !/^gina_c13p_[0-9a-f]+_audit$/.test(DB || '')) throw Error('isolated_runner_required');
const ROOT = new URL('../../', import.meta.url);
const OUT = new URL('docs/release/c13-2026-11-06/perf/', ROOT);
const REPS = Number(process.env.GINA_C13_REPS || 15);
const candidatePath = process.env.GINA_C13_CANDIDATE || '';
const rollbackPath = process.env.GINA_C13_ROLLBACK || '';

const checks = {}, failures = [];
const check = (label, pass, detail) => { checks[label] = !!pass; if (!pass) failures.push({ label, detail: String(detail ?? '').slice(0, 400) }); return !!pass; };
const must = async (operation, label) => { const r = await operation; if (r.error) { check(label, false, r.error.message); throw Error(label); } return r.data; };
// After DDL PostgREST reloads its schema cache and may drop in-flight connections: settle before measuring.
const settle = async () => { await new Promise(r => setTimeout(r, 4000)); for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 500)); const r = await admin.from('families').select('id').limit(1); if (!r.error) return; } };
const proxy = http.createServer((req, res) => {
  const route = [['/auth/v1', authPort], ['/rest/v1', restPort]].find(([p]) => req.url === p || req.url.startsWith(p + '/'));
  if (!route) { res.writeHead(404); res.end(); return; }
  const up = http.request({ hostname: '127.0.0.1', port: route[1], path: req.url.slice(route[0].length) || '/', method: req.method, headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(up);
});
await new Promise(r => proxy.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${proxy.address().port}`;
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const clients = [];
const client = () => { const c = createClient(base, process.env.GINA_QA_ANON, options); clients.push(c); return c; };
const admin = createClient(base, process.env.GINA_QA_SERVICE, options);
const rpc = (c, name, args, label = name) => must(c.rpc(name, args), label);
const refresh = async c => (await must(c.auth.refreshSession(), 'refresh_session')).session;
const claims = s => JSON.parse(Buffer.from(s.access_token.split('.')[1], 'base64url').toString());
const TZ = 'Europe/Istanbul';
const iso = d => d.toLocaleDateString('en-CA', { timeZone: TZ });
const today = iso(new Date());
const dayOffset = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// weekDatesOf(today): Monday-first week, as @gina/core does
const weekStart = (() => { const d = new Date(today + 'T12:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; return addDays(today, -dow); })();
const weekEnd = addDays(weekStart, 6);
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const quote = s => "'" + String(s).replace(/'/g, "''") + "'";
const psqlAs = (user, text) => spawnSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', user, '-d', DB, '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const psql = text => psqlAs('postgres', text);

const results = { before: { measurements: [], explains: [] }, after: { measurements: [], explains: [] }, before2: { measurements: [], explains: [] } };
let phase = 'before';
async function measure(label, fn, reps = REPS) {
  const samples = []; let rows = null, bytes = null;
  await fn(); // warm connection / plan cache once; not counted
  for (let i = 0; i < reps; i++) {
    const t = performance.now(); const data = await fn(); samples.push(performance.now() - t);
    const text = JSON.stringify(data ?? null); bytes = Buffer.byteLength(text);
    rows = Array.isArray(data) ? data.length : (data && typeof data === 'object' && Array.isArray(data.rows) ? data.rows.length : (data && typeof data === 'object' && Array.isArray(data.routines) ? data.routines.length : 1));
  }
  samples.sort((a, b) => a - b);
  const entry = { label, reps, p50_ms: +pct(samples, 0.5).toFixed(1), p95_ms: +pct(samples, 0.95).toFixed(1), min_ms: +samples[0].toFixed(1), max_ms: +samples[samples.length - 1].toFixed(1), rows, bytes };
  results[phase].measurements.push(entry); return entry;
}
// EXPLAIN as `authenticated` with the PostgREST claims; supabase_admin only to enable track_functions in this
// disposable DB's transaction (rolled back). Function call counts expose helpers evaluated once per row.
function explain(label, jwtClaims, sqlText) {
  const script = `begin; set local track_functions='all'; set local role authenticated; select set_config('request.jwt.claims',${quote(JSON.stringify(jwtClaims))},true) \\g /dev/null
explain (analyze, buffers, format json) ${sqlText};
\\echo ===FN===
reset role;
select coalesce(json_agg(json_build_object('fn',schemaname||'.'||funcname,'calls',calls,'total_ms',round(total_time::numeric,2),'self_ms',round(self_time::numeric,2)) order by calls desc),'[]') from pg_stat_xact_user_functions;
rollback;`;
  const r = psqlAs('supabase_admin', script);
  if (r.status !== 0) { results[phase].explains.push({ label, error: r.stderr.trim().slice(0, 400) }); return; }
  const [planText, fnText] = r.stdout.split('===FN===');
  const plan = JSON.parse(planText.trim())[0];
  const seq = [], idx = [], subplans = [];
  (function walk(node) {
    if (node['Node Type'] === 'Seq Scan') seq.push({ relation: node['Relation Name'], actual_rows: node['Actual Rows'], removed_by_filter: node['Rows Removed by Filter'] ?? 0, filter: node.Filter ?? null, loops: node['Actual Loops'] });
    if (/Index/.test(node['Node Type'])) idx.push({ index: node['Index Name'], relation: node['Relation Name'], actual_rows: node['Actual Rows'], loops: node['Actual Loops'] });
    if (node['Subplan Name']) subplans.push({ name: node['Subplan Name'], loops: node['Actual Loops'] });
    for (const child of node.Plans ?? []) walk(child);
  })(plan.Plan);
  const fns = JSON.parse((fnText || '[]').trim() || '[]') || [];
  results[phase].explains.push({ label, planning_ms: +plan['Planning Time'].toFixed(2), execution_ms: +plan['Execution Time'].toFixed(2), shared_hit_blocks: plan.Plan['Shared Hit Blocks'], shared_read_blocks: plan.Plan['Shared Read Blocks'], top_rows: plan.Plan['Actual Rows'], seq_scans: seq, index_scans: idx, subplans, function_calls: fns.slice(0, 25) });
}

const seed = { notes: [] };
let ctx;
try {
  // ---------------------------------------------------------------- family (pro), two children, paired tablet, child PIN session
  const p = client(), password = randomBytes(24).toString('base64url'), email = `gina-${randomUUID()}@example.invalid`;
  await must(admin.auth.admin.createUser({ email, password, email_confirm: true }), 'create_user');
  await must(p.auth.signInWithPassword({ email, password }), 'sign_in');
  const family = await rpc(p, 'create_family', { p_name: 'Synthetic C13 perf family', p_display_name: 'Synthetic parent' });
  await refresh(p);
  await must(admin.from('entitlement_overrides').insert({ family_id: family, plan: 'pro', reason: 'C13 perf', ends_at: new Date(Date.now() + 3 * 3600000).toISOString() }), 'entitlement');
  const child = await rpc(p, 'save_child_setup', { p_request_id: randomUUID(), p_profile: { name: 'Synthetic perf child', birth_year: 2015, grade: 5, gender: 'unspecified', avatar: 'avatar-default', interests: [] }, p_tasks: [] });
  const child2 = await rpc(p, 'save_child_setup', { p_request_id: randomUUID(), p_profile: { name: 'Synthetic sibling', birth_year: 2017, grade: 3, gender: 'unspecified', avatar: 'avatar-default', interests: [] }, p_tasks: [] });
  await rpc(p, 'set_child_pin', { p_child_id: child, p_pin: '1234' });
  const dev = client(); await must(dev.auth.signInAnonymously(), 'device_sign_in');
  const code = await rpc(dev, 'request_pairing', { p_device_name: 'Synthetic perf tablet' });
  const deviceId = await rpc(p, 'pair_child_device', { p_code: code }); await refresh(dev);
  await rpc(p, 'configure_child_device', { p_device_id: deviceId, p_name: 'Synthetic perf tablet', p_child_ids: [child], p_pin_required: true });
  await refresh(dev); await rpc(dev, 'child_pin_login', { p_child_id: child, p_pin: '1234' }); const deviceSession = await refresh(dev);
  const parentSession = await refresh(p);
  const parentClaims = claims(parentSession), deviceClaims = claims(deviceSession);

  // ---------------------------------------------------------------- seed volume (service role / postgres in the disposable DB; synthetic only)
  const tasks = [];
  for (let i = 0; i < 220; i++) tasks.push({ id: randomUUID(), family_id: family, child_id: child, title: `Synthetic task ${i}`, stars: 1 + (i % 5), sort_order: i % 100, starts_on: dayOffset(120), active: i % 10 !== 0, days_of_week: [1 + (i % 7)].concat(i % 3 ? [1 + ((i + 2) % 7)] : []) });
  for (let i = 0; i < 30; i++) tasks.push({ id: randomUUID(), family_id: family, child_id: child2, title: `Sibling task ${i}`, stars: 1, sort_order: i, starts_on: dayOffset(120), active: true, days_of_week: [1, 2, 3, 4, 5, 6, 7] });
  for (let i = 0; i < tasks.length; i += 100) {
    const r = await admin.from('task_templates').insert(tasks.slice(i, i + 100));
    if (r.error) { // days_of_week shape is validated; fall back to the column default
      await must(admin.from('task_templates').insert(tasks.slice(i, i + 100).map(({ days_of_week, ...t }) => t)), 'seed_tasks'); seed.notes.push('days_of_week default used: ' + r.error.message.slice(0, 120));
    }
  }
  seed.task_templates = tasks.length;
  // routine history: two edits on 60 templates (titles/stars) so task_routine_versions has >1 version per routine
  for (const t of tasks.slice(0, 60)) { await must(admin.from('task_templates').update({ title: t.title + ' v2', stars: 2 }).eq('id', t.id), 'seed_task_edit'); await must(admin.from('task_templates').update({ title: t.title + ' v3' }).eq('id', t.id), 'seed_task_edit2'); }
  const completions = []; const seen = new Set();
  for (let i = 0; i < 600; i++) { const t = tasks[i % 220]; const due = dayOffset(i % 90); const k = t.id + due; if (seen.has(k)) continue; seen.add(k); completions.push({ family_id: family, child_id: child, template_id: t.id, due_date: due, status: i % 7 === 0 ? 'done' : 'approved', client_id: randomUUID(), completed_at: new Date(Date.now() - i * 3600000).toISOString() }); }
  for (let i = 0; i < completions.length; i += 100) await must(admin.from('task_completions').insert(completions.slice(i, i + 100)), 'seed_completions');
  seed.task_completions = completions.length;
  const stars = [];
  for (let i = 0; i < 1000; i++) stars.push({ family_id: family, child_id: i % 4 === 0 ? child2 : child, delta: i % 9 === 0 ? -3 : 1 + (i % 3), reason: i % 9 === 0 ? 'adjust' : 'bonus', created_at: new Date(Date.now() - i * 1800000).toISOString() });
  for (let i = 0; i < stars.length; i += 200) await must(admin.from('star_events').insert(stars.slice(i, i + 200)), 'seed_stars');
  seed.star_events = stars.length;
  // timetable (35 lessons) + education location so plan_for_day's holiday/timetable branches do real work
  const lessons = []; const subj = ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Sosyal Bilgiler', 'İngilizce', 'Beden Eğitimi', 'Müzik'];
  for (let d = 1; d <= 5; d++) for (let k = 0; k < 7; k++) lessons.push({ id: randomUUID(), day: d, start: `${String(9 + k).padStart(2, '0')}:00`, end: `${String(9 + k).padStart(2, '0')}:40`, subject: subj[(d + k) % 7] });
  const tt = await admin.from('school_timetables').insert({ child_id: child, family_id: family, lessons });
  seed.timetable = tt.error ? 'failed: ' + tt.error.message.slice(0, 160) : `${lessons.length} lessons`;
  const loc = psql(`insert into gina.child_education_locations(child_id,place_id,stage) select ${quote(child)},id,'middle' from gina.education_places where active order by (kind='school') desc limit 1 returning place_id;`);
  seed.education_location = loc.status === 0 && loc.stdout.trim() ? 'set' : 'not set: ' + (loc.stderr || 'no active place').trim().slice(0, 160);
  // 500 ready learning sources (large list / many files)
  const consent = (await admin.rpc('get_learning_source_policy', {})).data?.consent_version;
  const sources = [];
  for (let i = 0; i < 500; i++) { const id = randomUUID(); sources.push({ id, family_id: family, uploaded_by: parentClaims.sub, kind: i % 5 ? 'document' : 'question_image', name: `Synthetic source ${i}.${i % 5 ? 'pdf' : 'png'}`, mime: i % 5 ? 'application/pdf' : 'image/png', bytes: 1024 + i, sha256: createHash('sha256').update('c13-' + i).digest('hex'), object_path: `${family}/${id}.${i % 5 ? 'pdf' : 'png'}`, status: 'ready', pages: 1, storage_consent: String(consent ?? 'accepted'), verified_at: new Date().toISOString(), created_at: new Date(Date.now() - i * 60000).toISOString() }); }
  let srcOk = 0;
  for (let i = 0; i < sources.length; i += 100) { const r = await admin.from('learning_sources').insert(sources.slice(i, i + 100)); if (r.error) { seed.notes.push('learning_sources insert stopped at ' + srcOk + ': ' + r.error.message.slice(0, 160)); break; } srcOk += 100; }
  seed.learning_sources = srcOk;
  // 500 notes (parent-authored, 20% archived)
  const notes = [];
  for (let i = 0; i < 500; i++) notes.push({ family_id: family, child_id: i % 3 ? child : null, author_user_id: parentClaims.sub, subject: subj[i % 7], title: `Synthetic note ${i}`, body: 'Synthetic body '.repeat(20), archived_at: i % 5 === 0 ? new Date().toISOString() : null, updated_at: new Date(Date.now() - i * 120000).toISOString() });
  let notesOk = 0;
  for (let i = 0; i < notes.length; i += 100) { const r = await admin.from('notes').insert(notes.slice(i, i + 100)); if (r.error) { seed.notes.push('notes insert stopped at ' + notesOk + ': ' + r.error.message.slice(0, 160)); break; } notesOk += 100; }
  seed.notes_rows = notesOk;
  // 120 help tickets, 3 attachments (~40 KB each) on the first 30
  const tickets = Array.from({ length: 120 }, (_, i) => ({ id: randomUUID(), family_id: family, created_by: parentClaims.sub, kind: i % 4 ? 'support' : 'idea', category: ['account', 'device', 'learning', 'billing', 'other'][i % 5], subject: `Synthetic ticket ${i}`, updated_at: new Date(Date.now() - i * 600000).toISOString() }));
  const tk = await admin.from('help_tickets').insert(tickets);
  seed.help_tickets = tk.error ? 'failed: ' + tk.error.message.slice(0, 160) : tickets.length;
  let att = 0;
  if (!tk.error) {
    const blob = '\\x' + randomBytes(40000).toString('hex');
    for (const t of tickets.slice(0, 30)) for (let k = 0; k < 3; k++) { const r = await admin.from('help_attachments').insert({ id: randomUUID(), ticket_id: t.id, family_id: family, created_by: parentClaims.sub, mime: 'image/png', bytes: 40000, sha256: createHash('sha256').update(t.id + k).digest('hex'), width: 800, height: 600, redaction: { boxes: [] }, data: blob }); if (r.error) { seed.notes.push('help_attachments: ' + r.error.message.slice(0, 160)); break; } att++; }
  }
  seed.help_attachments = att;
  // Prova: 20-question drawn exam, 20 drawn answers (30 strokes x 40 points each)
  const questionIds = Array.from({ length: 20 }, () => randomUUID());
  await must(p.from('question_bank').insert(questionIds.map((id, i) => ({ id, family_id: family, grade: 5, subject: 'Matematik', topic: 'Çevre', kind: 'open_ended', difficulty: 'orta', stem: `Soru ${i}: dikdörtgenin çevresi?`, expected_answer: '28', solution: '2×(8+6)' }))), 'seed_questions');
  const content = (title, ids) => ({ childId: child, grade: 5, title, purpose: 'written', format: 'school', subjects: ['Matematik'], topics: ['Çevre'], target: ids.length, minutes: null, difficulty: 'orta', kind: 'open_ended', note: '', step: 2, blocks: ids.map(id => ({ kind: 'question', id, source: 'manual' })) });
  const examId = randomUUID();
  await rpc(p, 'save_prova_draft', { p_request_id: randomUUID(), p_id: examId, p_version: 0, p_content: content('Synthetic drawn Prova', questionIds) });
  await rpc(p, 'submit_prova_draft', { p_request_id: randomUUID(), p_id: examId, p_version: 1 });
  const started = await rpc(dev, 'start_exam_attempt', { p_exam_id: examId }); const attempt = Array.isArray(started) ? started[0].id : started.id;
  const strokes = n => Array.from({ length: n }, () => ({ id: randomUUID(), type: 'stroke', color: '#201951', size: 4, points: Array.from({ length: 40 }, (_, k) => [10 + k * 5 + Math.random() * 3, 20 + (k % 7) * 9 + Math.random() * 3]) }));
  for (const q of questionIds) await rpc(dev, 'submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: attempt, p_question_id: q, p_expected_revision: 0, p_answer_text: '28', p_answer_document: { version: 1, width: 1000, height: 1400, elements: strokes(30) } });
  await rpc(dev, 'finish_exam_attempt', { p_attempt_id: attempt });
  seed.drawn_answers = 20; seed.drawn_answer_bytes_each = JSON.stringify({ version: 1, width: 1000, height: 1400, elements: strokes(30) }).length;
  // backoffice: a `content` operator and synthetic library rows (legacy collections/items, draft packages, curriculum candidates)
  const opEmail = `gina-${randomUUID()}@example.invalid`, opPassword = randomBytes(24).toString('base64url');
  const { user: opUser } = await must(admin.auth.admin.createUser({ email: opEmail, password: opPassword, email_confirm: true }), 'op_create');
  await must(admin.from('operations_members').insert({ user_id: opUser.id, role: 'content', expires_at: new Date(Date.now() + 3 * 3600000).toISOString() }), 'op_grant');
  const op = client(); await must(op.auth.signInWithPassword({ email: opEmail, password: opPassword }), 'op_login');
  const opClaims = claims((await op.auth.getSession()).data.session);
  const lib = psql(`
insert into public.library_collections(title,grade,subject,status) select 'Synthetic collection '||g,1+g%12,'Matematik',case when g%3=0 then 'published' else 'draft' end from generate_series(1,100) g;
insert into public.library_items(collection_id,content,content_hash,status) select c.id,jsonb_build_object('topic','Synthetic topic '||g,'grade',c.grade,'subject',c.subject),md5(c.id::text||g),'draft' from public.library_collections c,generate_series(1,4) g where c.title like 'Synthetic collection %';
insert into gina.library_import_packages(id,package_key,revision,content_hash,title,grade,subject,provenance,created_by) select gen_random_uuid(),'synthetic-pkg-'||g,1,md5('p'||g),'Synthetic package '||g,1+g%12,'Türkçe','{}'::jsonb,${quote(opUser.id)} from generate_series(1,100) g;
insert into gina.curriculum_candidates(external_key,source_sha256,candidate,content_hash,status,created_by) select 'synthetic-'||g,md5('s'||g)||md5('t'||g),jsonb_build_object('label','Synthetic candidate '||g,'grade',(1+g%12)::text,'subject','Fen'),md5('c'||g),'draft',${quote(opUser.id)} from generate_series(1,300) g;
select json_build_object('collections',(select count(*) from public.library_collections),'items',(select count(*) from public.library_items),'packages',(select count(*) from gina.library_import_packages),'candidates',(select count(*) from gina.curriculum_candidates),'view_rows',(select count(*) from gina.library_content_items));`);
  seed.library = lib.status === 0 ? JSON.parse(lib.stdout.trim().split('\n').pop()) : 'failed: ' + lib.stderr.trim().slice(0, 300);
  psql('analyze;');
  seed.note = 'tasks/completions/stars/sources/notes/tickets inserted with the service role, library rows with postgres, all in the disposable DB; Prova/answers through real RPCs';
  ctx = { p, dev, op, family, child, child2, attempt, examId, questionIds, parentClaims, deviceClaims, opClaims, tickets };

  // ---------------------------------------------------------------- RLS audit: helpers called bare in policies (evaluated per row)
  const policies = JSON.parse(psql(`select coalesce(json_agg(json_build_object('schema',schemaname,'table',tablename,'name',policyname,'cmd',cmd,'permissive',permissive,'qual',qual,'with_check',with_check)),'[]') from pg_policies where schemaname in ('public','gina','storage')`).stdout.trim());
  const helper = /(?:gina\.[a-z_]+|auth\.(?:uid|jwt|role))\((?:\s*'[^']*'(?:::[a-z_\[\]]+)?\s*(?:,\s*)?)*\)/g;
  const migrations = readdirSync(new URL('supabase/migrations/', ROOT)).filter(f => f.endsWith('.sql')).sort();
  const migText = Object.fromEntries(migrations.map(f => [f, readFileSync(new URL('supabase/migrations/' + f, ROOT), 'utf8')]));
  const bare = [];
  for (const pol of policies) {
    const hits = [];
    for (const field of ['qual', 'with_check']) {
      const text = pol[field] || '';
      for (const m of text.matchAll(helper)) { const before = text.slice(Math.max(0, m.index - 7), m.index); if (before !== 'SELECT ') hits.push(field + ':' + m[0]); }
    }
    if (hits.length) {
      const re = new RegExp(`(create|alter)\\s+policy\\s+"?${pol.name}"?\\s+on\\s+(${pol.schema}\\.)?"?${pol.table}\\b`, 'i');
      const files = migrations.filter(f => re.test(migText[f]));
      bare.push({ ...pol, bare_calls: hits, defined_in: files.slice(-2), qual: undefined, with_check: undefined });
    }
  }
  seed.policy_audit = { policies_total: policies.length, bare_helper_policies: bare.length, in_window_20261106180000_320000: bare.filter(b => b.defined_in.some(f => f >= '20261106180000' && f <= '20261106320000_zzz')).length, bare };

  await runPass('before');
  if (candidatePath) {
    const sql = readFileSync(candidatePath, 'utf8');
    // Equivalence fixture for gina.plan_version_on: 4000 random version arrays/days resolved by the ORIGINAL body.
    const fuzz = psql(`create schema c13_scratch;
create table c13_scratch.fuzz as select g id,dd.d,vv.v from generate_series(1,4000) g
 cross join lateral (select current_date+(random()*80-40)::int+g*0 d) dd
 cross join lateral (select coalesce(jsonb_agg(jsonb_build_object('revision',case when g%97=0 and r=1 then null else r end,'value',jsonb_build_object('n',r),
  'effective_from',case when random()<0.35 then null else (current_date+(random()*80-40)::int)::text end,
  'known_since',case when random()<0.35 then null else (current_date+(random()*80-40)::int)::text end) order by random()),'[]'::jsonb) v
  from generate_series(1,(random()*5)::int+g*0) r) vv;
alter table c13_scratch.fuzz add column old jsonb; update c13_scratch.fuzz set old=gina.plan_version_on(v,d);
select count(*) from c13_scratch.fuzz;`);
    const applied = psql(sql + '\nanalyze;');
    seed.candidate = { file: candidatePath.replace(/^.*\/docs\//, 'docs/'), applied: applied.status === 0, error: applied.status ? applied.stderr.trim().slice(0, 600) : null };
    if (check('candidate_applied', applied.status === 0, applied.stderr)) {
      if (fuzz.status === 0) {
        const diff = psql(`select json_build_object('cases',count(*),'with_versions',count(*) filter(where jsonb_array_length(v)>0),'mismatches',count(*) filter(where gina.plan_version_on(v,d) is distinct from old)) from c13_scratch.fuzz;`);
        seed.plan_version_on_equivalence = diff.status === 0 ? JSON.parse(diff.stdout.trim()) : { error: diff.stderr.trim().slice(0, 300) };
        check('plan_version_on_equivalent', seed.plan_version_on_equivalence.mismatches === 0, JSON.stringify(seed.plan_version_on_equivalence));
      } else seed.plan_version_on_equivalence = { error: fuzz.stderr.trim().slice(0, 300) };
      await settle(); await runPass('after');
      const outEq = {};
      for (const [k, h] of Object.entries(results.before.outputs)) outEq[k] = h === results.after.outputs[k];
      seed.output_equivalence_before_after = outEq;
      check('candidate_outputs_identical', Object.values(outEq).every(Boolean), JSON.stringify(outEq));
      if (rollbackPath) {
        const rb = psql(readFileSync(rollbackPath, 'utf8') + '\nanalyze;');
        seed.rollback = { applied: rb.status === 0, error: rb.status ? rb.stderr.trim().slice(0, 600) : null };
        if (rb.status === 0) { await settle(); await runPass('before2'); }
      }
    }
  }
  const sizes = psql(`select json_agg(json_build_object('table',schemaname||'.'||relname,'rows',n_live_tup) order by relname) from pg_stat_user_tables where (schemaname,relname) in (('public','task_templates'),('public','task_completions'),('public','star_events'),('public','learning_sources'),('public','notes'),('public','help_tickets'),('public','help_attachments'),('public','exam_answers'),('gina','task_routine_changes'),('public','library_items'),('gina','curriculum_candidates'))`);
  seed.table_rows = sizes.status === 0 ? JSON.parse(sizes.stdout.trim() || '[]') : null;
  check('perf_measurements_recorded', results.before.measurements.length >= 25, results.before.measurements.length);
  check('perf_explains_recorded', results.before.explains.filter(e => !e.error).length >= 15, JSON.stringify(results.before.explains.filter(e => e.error)).slice(0, 400));
  mkdirSync(OUT, { recursive: true });
  const envNote = 'disposable local GoTrue+PostgREST on loopback, Docker Desktop on this Mac shared with other agents; absolute numbers are NOT production latencies; compare phases inside one run only';
  const meta = { environment: envNote, measured_at: new Date().toISOString(), db_prefix: 'gina_c13p_', reps: REPS, week: [weekStart, weekEnd], seed };
  const tag = process.env.GINA_C13_TAG ? '-' + process.env.GINA_C13_TAG.replace(/[^a-z0-9-]/gi, '') : '';
  writeFileSync(new URL(`perf-before${tag}.json`, OUT), JSON.stringify({ ...meta, phase: 'before', ...results.before }, null, 2) + '\n');
  if (results.after.measurements.length) writeFileSync(new URL(`perf-after${tag}.json`, OUT), JSON.stringify({ ...meta, phase: 'after', ...results.after }, null, 2) + '\n');
  if (results.before2.measurements.length) writeFileSync(new URL(`perf-before2${tag}.json`, OUT), JSON.stringify({ ...meta, phase: 'before2 (candidate rolled back)', ...results.before2 }, null, 2) + '\n');
} catch (error) {
  const label = error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'perf_aborted';
  if (!(label in checks)) check(label, false, error.message);
  console.error(error.stack);
} finally {
  await Promise.all(clients.map(c => c.removeAllChannels()));
  await new Promise(r => proxy.close(r));
  if (failures.length) { process.exitCode = 1; console.error(JSON.stringify(failures)); }
  console.log(JSON.stringify({ checks, failures }));
}

async function runPass(name) {
  phase = name;
  const { p, dev, op, child, child2, attempt, questionIds, parentClaims, deviceClaims, opClaims, tickets } = ctx;
  // response fingerprints of the functions a candidate may touch (compared before vs after; same seed, same day)
  const h = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
  results[name].outputs = {
    plan_for_days_42d_parent: h(await rpc(p, 'plan_for_days', { p_child_id: child, p_from: addDays(weekStart, -7), p_to: addDays(weekStart, 34) })),
    plan_for_days_7d_device: h(await rpc(dev, 'plan_for_days', { p_child_id: child, p_from: weekStart, p_to: weekEnd })),
    routines_for_day_parent_today: h(await rpc(p, 'routines_for_day', { p_child_id: child, p_day: today })),
    routines_for_day_parent_past60: h(await rpc(p, 'routines_for_day', { p_child_id: child, p_day: addDays(today, -60) })),
    routines_for_day_parent_future200: h(await rpc(p, 'routines_for_day', { p_child_id: child, p_day: addDays(today, 200) })),
    plan_for_day_parent_past150: h(await rpc(p, 'plan_for_day', { p_child_id: child, p_day: addDays(today, -150) })),
  };
  const c = quote(child), a = quote(attempt), w0 = quote(weekStart), w6 = quote(weekEnd), m0 = quote(addDays(weekStart, -7)), m41 = quote(addDays(weekStart, 34)), t = quote(today);
  // --- child "Bugün" (device JWT): plan_for_days(week) + task_templates + task_completions(week) + child_star_balance
  await measure('child_today_plan_for_days_7d_device', () => rpc(dev, 'plan_for_days', { p_child_id: child, p_from: weekStart, p_to: weekEnd }));
  await measure('child_today_task_templates_device', () => must(dev.from('task_templates').select('id, title, icon, stars, days_of_week, starts_on, ends_on, active, sort_order').eq('child_id', child).order('sort_order'), 'ct_templates'));
  await measure('child_today_completions_week_device', () => must(dev.from('task_completions').select('id, template_id, due_date, status, task_snapshot, return_reason, return_note').eq('child_id', child).gte('due_date', weekStart).lte('due_date', weekEnd), 'ct_completions'));
  await measure('child_today_star_balance_device', () => rpc(dev, 'child_star_balance', { p_child_id: child, p_day: today }));
  await measure('child_today_all4_parallel_device', () => Promise.all([
    rpc(dev, 'plan_for_days', { p_child_id: child, p_from: weekStart, p_to: weekEnd }),
    must(dev.from('task_templates').select('id, title, icon, stars, days_of_week, starts_on, ends_on, active, sort_order').eq('child_id', child).order('sort_order'), 'ct_t'),
    must(dev.from('task_completions').select('id, template_id, due_date, status, task_snapshot, return_reason, return_note').eq('child_id', child).gte('due_date', weekStart).lte('due_date', weekEnd), 'ct_c'),
    rpc(dev, 'child_star_balance', { p_child_id: child, p_day: today })]));
  await measure('child_today_plan_for_days_7d_parent', () => rpc(p, 'plan_for_days', { p_child_id: child, p_from: weekStart, p_to: weekEnd }));
  // --- calendar (parent): one plan_for_days per child; week and the 42-day maximum
  await measure('calendar_plan_for_days_7d_parent_2children', () => Promise.all([child, child2].map(id => rpc(p, 'plan_for_days', { p_child_id: id, p_from: weekStart, p_to: weekEnd }))));
  await measure('calendar_plan_for_days_42d_parent', () => rpc(p, 'plan_for_days', { p_child_id: child, p_from: addDays(weekStart, -7), p_to: addDays(weekStart, 34) }), Math.max(5, Math.floor(REPS / 2)));
  await measure('calendar_plan_for_days_42d_device', () => rpc(dev, 'plan_for_days', { p_child_id: child, p_from: addDays(weekStart, -7), p_to: addDays(weekStart, 34) }), Math.max(5, Math.floor(REPS / 2)));
  // --- tasks screen (parent)
  await measure('tasks_children_list_parent', () => must(p.from('children').select('id,name,grade,avatar').is('archived_at', null).order('sort_order'), 'tasks_children'));
  await measure('tasks_templates_select_star_parent', () => must(p.from('task_templates').select('*').eq('child_id', child).order('sort_order'), 'tasks_templates'));
  await measure('tasks_routines_for_day_parent', () => rpc(p, 'routines_for_day', { p_child_id: child, p_day: today }));
  // --- Prova review (parent) + drawn answers
  await measure('review_attempt_with_embeds_parent', () => must(p.from('exam_attempts').select('id,status,children(name),exams(question_ids)').eq('id', attempt).single(), 'review_attempt'));
  await measure('review_questions_in_ids_parent', () => must(p.from('question_bank').select('id,stem,kind,choices,correct_key,expected_answer,solution,explanation,provenance').in('id', questionIds), 'review_questions'));
  await measure('review_exam_answers_drawn_parent', () => must(p.from('exam_answers').select('question_id,answer_document,answer_text,answer_key,is_correct,score,graded_by,ai_score').eq('attempt_id', attempt), 'review_answers'));
  await measure('review_get_answer_review_parent', () => rpc(p, 'get_answer_review', { p_attempt_id: attempt, p_question_id: questionIds[0] }));
  await measure('review_get_review_ai_policy_parent', () => rpc(p, 'get_review_ai_policy', {}));
  await measure('saved_exam_answers_v3_drawn_device', () => rpc(dev, 'get_saved_exam_answers_v3', { p_attempt_id: attempt }));
  await measure('saved_exam_answers_v3_drawn_parent', () => rpc(p, 'get_saved_exam_answers_v3', { p_attempt_id: attempt }));
  // --- backoffice content list (content operator)
  let cursor = null;
  await measure('bo_admin_library_content_page_p1_operator', async () => { const r = await rpc(op, 'admin_library_content_page', { p_kind: null, p_status: null, p_prereview: null, p_cursor: null, p_limit: 50 }); cursor = r.next_cursor; return r; });
  if (cursor) await measure('bo_admin_library_content_page_p2_operator', () => rpc(op, 'admin_library_content_page', { p_kind: null, p_status: null, p_prereview: null, p_cursor: cursor, p_limit: 50 }));
  await measure('bo_admin_library_content_page_draft_operator', () => rpc(op, 'admin_library_content_page', { p_kind: null, p_status: 'draft', p_prereview: null, p_cursor: null, p_limit: 50 }));
  // --- large lists / many files
  await measure('sources_page0_parent', () => must(p.from('learning_sources').select('id,name,mime').eq('kind', 'document').eq('status', 'ready').order('created_at', { ascending: false }).order('id', { ascending: false }).range(0, 30), 'sources_p0'));
  await measure('sources_page10_parent', () => must(p.from('learning_sources').select('id,name,mime').eq('kind', 'document').eq('status', 'ready').order('created_at', { ascending: false }).order('id', { ascending: false }).range(300, 330), 'sources_p10'));
  await measure('notes_list_active_parent', () => must(p.from('notes').select('*').is('archived_at', null).order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(21), 'notes_active'));
  await measure('notes_list_child_parent', () => must(p.from('notes').select('*').is('archived_at', null).eq('child_id', child).order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(21), 'notes_child'));
  await measure('notes_list_archive_parent', () => must(p.from('notes').select('*').not('archived_at', 'is', null).order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(21), 'notes_archive'));
  await measure('help_list_tickets_parent', () => rpc(p, 'list_help_tickets', { p_operator: false, p_offset: 0 }));
  if (tickets?.length) await measure('help_list_attachments_parent', () => rpc(p, 'list_help_attachments', { p_ticket_id: tickets[0].id }));

  // --- EXPLAIN (ANALYZE, BUFFERS) + function call counts, same claims
  explain('child_today_plan_for_days_7d_device', deviceClaims, `select public.plan_for_days(${c},${w0},${w6})`);
  explain('child_today_task_templates_device', deviceClaims, `select id,title,icon,stars,days_of_week,starts_on,ends_on,active,sort_order from public.task_templates where child_id=${c} order by sort_order`);
  explain('child_today_completions_week_device', deviceClaims, `select id,template_id,due_date,status,task_snapshot,return_reason,return_note from public.task_completions where child_id=${c} and due_date>=${w0} and due_date<=${w6}`);
  explain('child_today_star_balance_device', deviceClaims, `select public.child_star_balance(${c},${t})`);
  explain('calendar_plan_for_days_7d_parent', parentClaims, `select public.plan_for_days(${c},${w0},${w6})`);
  explain('calendar_plan_for_days_42d_parent', parentClaims, `select public.plan_for_days(${c},${m0},${m41})`);
  explain('plan_for_day_single_parent', parentClaims, `select public.plan_for_day(${c},${t})`);
  explain('tasks_templates_select_star_parent', parentClaims, `select * from public.task_templates where child_id=${c} order by sort_order`);
  explain('tasks_routines_for_day_parent', parentClaims, `select public.routines_for_day(${c},${t})`);
  explain('review_attempt_parent', parentClaims, `select id,status,child_id,exam_id from public.exam_attempts where id=${a}`);
  explain('review_questions_in_ids_parent', parentClaims, `select id,stem,kind,choices,correct_key,expected_answer,solution,explanation,provenance from public.question_bank where id = any(array[${questionIds.map(quote).join(',')}]::uuid[])`);
  explain('review_exam_answers_drawn_parent', parentClaims, `select question_id,answer_document,answer_text,answer_key,is_correct,score,graded_by,ai_score from public.exam_answers where attempt_id=${a}`);
  explain('review_get_answer_review_parent', parentClaims, `select public.get_answer_review(${a},${quote(questionIds[0])})`);
  explain('saved_exam_answers_v3_drawn_device', deviceClaims, `select * from public.get_saved_exam_answers_v3(${a})`);
  explain('saved_exam_answers_v3_drawn_parent', parentClaims, `select * from public.get_saved_exam_answers_v3(${a})`);
  explain('bo_admin_library_content_page_p1_operator', opClaims, `select public.admin_library_content_page(null,null,null,null,50)`);
  explain('sources_page0_parent', parentClaims, `select id,name,mime from public.learning_sources where kind='document' and status='ready' order by created_at desc,id desc limit 31`);
  explain('sources_page10_parent', parentClaims, `select id,name,mime from public.learning_sources where kind='document' and status='ready' order by created_at desc,id desc offset 300 limit 31`);
  explain('notes_list_active_parent', parentClaims, `select * from public.notes where archived_at is null order by updated_at desc,id desc limit 21`);
  explain('notes_list_child_parent', parentClaims, `select * from public.notes where archived_at is null and child_id=${c} order by updated_at desc,id desc limit 21`);
  explain('help_list_tickets_parent', parentClaims, `select public.list_help_tickets(false,null,null,0)`);
  if (tickets?.length) explain('help_list_attachments_parent', parentClaims, `select public.list_help_attachments(${quote(tickets[0].id)})`);
  // the view body itself (security definer context = owner), to see where admin_library_content_page spends time
  const view = psql(`explain (analyze, buffers, format json) select * from gina.library_content_items order by updated_at desc,kind desc,id desc limit 51;`);
  if (view.status === 0) { const pl = JSON.parse(view.stdout.trim())[0]; results[phase].explains.push({ label: 'bo_library_content_items_view_owner', planning_ms: +pl['Planning Time'].toFixed(2), execution_ms: +pl['Execution Time'].toFixed(2), shared_hit_blocks: pl.Plan['Shared Hit Blocks'], top_rows: pl.Plan['Actual Rows'] }); }
}
