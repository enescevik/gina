// Q02 performance runner. Invoked only by scripts/test-q02-perf.py against ephemeral loopback
// Auth/REST services in a disposable DB clone. Measures the queries the mobile app really issues
// (apps/mobile/src/app/parent/index.tsx, tasks-screen, grades, learning-plan sources, prova list/review)
// and explains them inside the same disposable DB. No production data, no paid AI.
import http from 'node:http';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const authPort = Number(process.env.GINA_QA_AUTH_PORT), restPort = Number(process.env.GINA_QA_REST_PORT), DB = process.env.GINA_QA_DB;
if (![authPort, restPort].every(v => Number.isInteger(v) && v > 1024 && v < 65536) || !process.env.GINA_QA_SERVICE || !/^gina_q02p_[0-9a-f]+_audit$/.test(DB || '')) throw Error('isolated_runner_required');

const checks = {}, failures = [];
const check = (label, pass, detail) => { checks[label] = !!pass; if (!pass) failures.push({ label, detail: String(detail ?? '').slice(0, 400) }); return !!pass; };
const must = async (operation, label) => { const r = await operation; if (r.error) { check(label, false, r.error.message); throw Error(label); } return r.data; };
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
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
const dayOffset = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }); };
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const measurements = [];
async function measure(label, fn, reps = 15) {
  const samples = []; let rows = null, bytes = null;
  await fn(); // warm connection pool / plan cache once; not counted
  for (let i = 0; i < reps; i++) {
    const t = performance.now(); const data = await fn(); samples.push(performance.now() - t);
    const text = JSON.stringify(data ?? null); bytes = text.length; rows = Array.isArray(data) ? data.length : (data && typeof data === 'object' && Array.isArray(data.rows) ? data.rows.length : 1);
  }
  samples.sort((a, b) => a - b);
  const entry = { label, reps, p50_ms: +pct(samples, 0.5).toFixed(1), p95_ms: +pct(samples, 0.95).toFixed(1), min_ms: +samples[0].toFixed(1), max_ms: +samples[samples.length - 1].toFixed(1), rows, bytes };
  measurements.push(entry); return entry;
}
// EXPLAIN inside the disposable DB as the `authenticated` role with the same JWT claims PostgREST would set.
const explains = [];
function explain(label, jwtClaims, sqlText) {
  const script = `begin; set local role authenticated; do $q$ begin perform set_config('request.jwt.claims',${quote(JSON.stringify(jwtClaims))},true); end $q$; explain (analyze, buffers, format json) ${sqlText}; rollback;`;
  const r = spawnSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1'], { input: script, encoding: 'utf8' });
  if (r.status !== 0) { explains.push({ label, error: r.stderr.trim().slice(0, 300) }); return; }
  const plan = JSON.parse(r.stdout.trim())[0];
  const seq = [], idx = [];
  (function walk(node) {
    if (node['Node Type'] === 'Seq Scan') seq.push({ relation: node['Relation Name'], actual_rows: node['Actual Rows'], removed_by_filter: node['Rows Removed by Filter'] ?? 0, filter: node.Filter ?? null, loops: node['Actual Loops'] });
    if (/Index/.test(node['Node Type'])) idx.push({ index: node['Index Name'], relation: node['Relation Name'], actual_rows: node['Actual Rows'], loops: node['Actual Loops'] });
    for (const child of node.Plans ?? []) walk(child);
  })(plan.Plan);
  explains.push({ label, planning_ms: +plan['Planning Time'].toFixed(2), execution_ms: +plan['Execution Time'].toFixed(2), shared_hit_blocks: plan.Plan['Shared Hit Blocks'], shared_read_blocks: plan.Plan['Shared Read Blocks'], seq_scans: seq, index_scans: idx });
}
const quote = s => "'" + String(s).replace(/'/g, "''") + "'";
const seed = {};
try {
  // ---------------------------------------------------------------- family, pro plan, child, device
  const p = client(), password = randomBytes(24).toString('base64url'), email = `gina-${randomUUID()}@example.invalid`;
  await must(admin.auth.admin.createUser({ email, password, email_confirm: true }), 'create_user');
  await must(p.auth.signInWithPassword({ email, password }), 'sign_in');
  const family = await rpc(p, 'create_family', { p_name: 'Synthetic perf family', p_display_name: 'Synthetic parent' });
  let parentSession = await refresh(p);
  await must(admin.from('entitlement_overrides').insert({ family_id: family, plan: 'pro', reason: 'Q02 perf', ends_at: new Date(Date.now() + 3600000).toISOString() }), 'entitlement');
  const child = await rpc(p, 'save_child_setup', { p_request_id: randomUUID(), p_profile: { name: 'Synthetic perf child', birth_year: 2015, grade: 5, gender: 'unspecified', avatar: 'avatar-default', interests: [] }, p_tasks: [] });
  const child2 = await rpc(p, 'save_child_setup', { p_request_id: randomUUID(), p_profile: { name: 'Synthetic sibling', birth_year: 2017, grade: 3, gender: 'unspecified', avatar: 'avatar-default', interests: [] }, p_tasks: [] });
  await rpc(p, 'set_child_pin', { p_child_id: child, p_pin: '1234' });
  const dev = client(); await must(dev.auth.signInAnonymously(), 'device_sign_in');
  const code = await rpc(dev, 'request_pairing', { p_device_name: 'Synthetic perf tablet' });
  const { preview_token: previewToken } = await rpc(p, 'preview_device_pairing', { p_code: code });
  const deviceId = await rpc(p, 'pair_child_device', { p_code: code, p_preview_token: previewToken }); await refresh(dev);
  await rpc(p, 'configure_child_device', { p_device_id: deviceId, p_name: 'Synthetic perf tablet', p_child_ids: [child], p_pin_required: true });
  await refresh(dev); await rpc(dev, 'child_pin_login', { p_child_id: child, p_pin: '1234' }); const deviceSession = await refresh(dev);
  parentSession = await refresh(p);
  const parentClaims = claims(parentSession), deviceClaims = claims(deviceSession);

  // ---------------------------------------------------------------- seed volume (service role; synthetic only)
  const tasks = [];
  for (let i = 0; i < 220; i++) tasks.push({ id: randomUUID(), family_id: family, child_id: child, title: `Synthetic task ${i}`, stars: 1 + (i % 5), sort_order: i % 100, starts_on: dayOffset(90), active: i % 10 !== 0 });
  for (let i = 0; i < 30; i++) tasks.push({ id: randomUUID(), family_id: family, child_id: child2, title: `Sibling task ${i}`, stars: 1, sort_order: i, starts_on: dayOffset(90), active: true });
  for (let i = 0; i < tasks.length; i += 100) await must(admin.from('task_templates').insert(tasks.slice(i, i + 100)), 'seed_tasks');
  seed.task_templates = tasks.length;
  const completions = [];
  for (let i = 0; i < 300; i++) { const t = tasks[i % 220]; completions.push({ family_id: family, child_id: child, template_id: t.id, due_date: dayOffset(Math.floor(i / 220) * 60 + (i % 60)), status: i % 7 === 0 ? 'done' : 'approved', client_id: randomUUID(), completed_at: new Date(Date.now() - i * 3600000).toISOString() }); }
  // unique(template_id,due_date): spread due dates per template
  const seenKey = new Set(); const uniqueCompletions = completions.filter(c => { const k = c.template_id + c.due_date; if (seenKey.has(k)) return false; seenKey.add(k); return true; });
  for (let i = 0; i < uniqueCompletions.length; i += 100) await must(admin.from('task_completions').insert(uniqueCompletions.slice(i, i + 100)), 'seed_completions');
  seed.task_completions = uniqueCompletions.length;
  const stars = [];
  for (let i = 0; i < 400; i++) stars.push({ family_id: family, child_id: i % 4 === 0 ? child2 : child, delta: i % 9 === 0 ? -3 : 1 + (i % 3), reason: i % 9 === 0 ? 'adjust' : 'bonus', created_at: new Date(Date.now() - i * 1800000).toISOString() });
  for (let i = 0; i < stars.length; i += 100) await must(admin.from('star_events').insert(stars.slice(i, i + 100)), 'seed_stars');
  seed.star_events = stars.length;
  const subjects = ['Matematik', 'Fen', 'Türkçe', 'Sosyal', 'İngilizce'], kinds = ['exam', 'homework', 'project', 'oral', 'performance'];
  const grades = [];
  for (let i = 0; i < 220; i++) grades.push({ id: randomUUID(), family_id: family, child_id: child, subject: subjects[i % 5], kind: kinds[i % 5], score: 50 + (i % 50), max_score: 100, graded_on: dayOffset(i % 200), note: i % 3 ? null : 'Synthetic note' });
  for (let i = 0; i < grades.length; i += 100) await must(admin.from('grades').insert(grades.slice(i, i + 100)), 'seed_grades');
  seed.grades = grades.length;
  const sources = [];
  for (let i = 0; i < 50; i++) { const id = randomUUID(); sources.push({ id, family_id: family, uploaded_by: parentClaims.sub, kind: 'document', name: `Synthetic source ${i}.pdf`, mime: 'application/pdf', bytes: 1024 + i, sha256: createHash('sha256').update('synthetic-' + i).digest('hex'), object_path: `${family}/${id}.pdf`, status: 'ready', pages: 1, storage_consent: 'accepted', verified_at: new Date().toISOString(), created_at: new Date(Date.now() - i * 60000).toISOString() }); }
  const sourceInsert = await admin.from('learning_sources').insert(sources);
  if (sourceInsert.error) { // storage_consent format is validated by the Edge flow; retry with the value the migration expects
    const consent = (await admin.rpc('get_learning_source_policy', {})).data?.consent_version ?? 'v1';
    await must(admin.from('learning_sources').insert(sources.map(s => ({ ...s, storage_consent: String(consent) }))), 'seed_sources');
  }
  seed.learning_sources = sources.length;
  // Prova with 20 drawn answers + 25 further exams for the list
  const questionIds = [];
  for (let i = 0; i < 20; i++) { const id = randomUUID(); questionIds.push(id); }
  await must(p.from('question_bank').insert(questionIds.map((id, i) => ({ id, family_id: family, grade: 5, subject: 'Matematik', topic: 'Çevre', kind: 'open_ended', difficulty: 'orta', stem: `Soru ${i}: dikdörtgenin çevresi?`, expected_answer: '28', solution: '2×(8+6)' }))), 'seed_questions');
  const content = (title, ids) => ({ childId: child, grade: 5, title, purpose: 'written', format: 'school', subjects: ['Matematik'], topics: ['Çevre'], target: ids.length, minutes: null, difficulty: 'orta', kind: 'open_ended', note: '', step: 2, blocks: ids.map(id => ({ kind: 'question', id, source: 'manual' })) });
  const examId = randomUUID();
  await rpc(p, 'save_prova_draft', { p_request_id: randomUUID(), p_id: examId, p_version: 0, p_content: content('Synthetic drawn Prova', questionIds) });
  await measure('rpc_submit_prova_draft_20q', async () => { const id = randomUUID(); await rpc(p, 'save_prova_draft', { p_request_id: randomUUID(), p_id: id, p_version: 0, p_content: content('Synthetic list Prova', questionIds.slice(0, 5)) }); return rpc(p, 'submit_prova_draft', { p_request_id: randomUUID(), p_id: id, p_version: 1 }); }, 25);
  await rpc(p, 'submit_prova_draft', { p_request_id: randomUUID(), p_id: examId, p_version: 1 });
  seed.exams = 27;
  const started = await rpc(dev, 'start_exam_attempt', { p_exam_id: examId }); const attempt = Array.isArray(started) ? started[0].id : started.id;
  const strokes = n => Array.from({ length: n }, () => ({ id: randomUUID(), type: 'stroke', color: '#201951', size: 4, points: Array.from({ length: 40 }, (_, k) => [10 + k * 5 + Math.random() * 3, 20 + (k % 7) * 9 + Math.random() * 3]) }));
  let qi = 0; const revisions = {};
  const writes = await measure('rpc_submit_exam_answer_v3_drawn_10_strokes', async () => { const q = questionIds[qi++ % 20]; const r = await rpc(dev, 'submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: attempt, p_question_id: q, p_expected_revision: revisions[q] ?? 0, p_answer_text: '28', p_answer_document: { version: 1, width: 1000, height: 1400, elements: strokes(10) } }); revisions[q] = r; return r; }, 20);
  seed.drawn_answers = 20; seed.drawn_answer_bytes_each = JSON.stringify({ version: 1, width: 1000, height: 1400, elements: strokes(10) }).length;
  await rpc(dev, 'finish_exam_attempt', { p_attempt_id: attempt });
  // all 220 grades carry no education context: period reports fall to 'unknown'/'all'
  seed.note = 'grades/tasks/completions/stars/sources inserted with the service role in the disposable DB; Prova, answers and drafts through real RPCs';

  // ---------------------------------------------------------------- measurements (parent home, tasks, grades, sources, prova)
  const from = dayOffset(6), to = today;
  await measure('home_task_templates_by_family', () => must(p.from('task_templates').select('id, child_id, title, icon, stars, days_of_week, starts_on, ends_on, active, sort_order').eq('family_id', family), 'home_templates'));
  await measure('home_task_completions_week_by_family', () => must(p.from('task_completions').select('id, child_id, template_id, due_date, status, task_snapshot').eq('family_id', family).gte('due_date', from).lte('due_date', to), 'home_completions'));
  await measure('home_star_events_by_family', () => must(p.from('star_events').select('child_id, delta').eq('family_id', family), 'home_stars'));
  await measure('home_approvals_done_by_family', () => must(p.from('task_completions').select('id, completed_at, due_date, child_id, task_snapshot, task_templates(title, icon, stars), children!task_completions_child_id_fkey(name)').eq('family_id', family).eq('status', 'done').order('completed_at'), 'home_approvals'));
  await measure('tasks_screen_templates_by_child', () => must(p.from('task_templates').select('*').eq('child_id', child).order('sort_order'), 'tasks_screen'));
  await measure('child_today_templates_active', () => must(dev.from('task_templates').select('id, title, icon, stars, days_of_week, starts_on, ends_on, time_of_day, requires_approval').eq('child_id', child).eq('active', true), 'child_today'));
  await measure('child_star_events_by_child', () => must(dev.from('star_events').select('delta').eq('child_id', child), 'child_stars'));
  const page1 = await measure('rpc_school_grade_records_all_page1', () => rpc(p, 'school_grade_records', { p_child_id: child, p_period: 'all', p_withdrawn: false }));
  const first = await rpc(p, 'school_grade_records', { p_child_id: child, p_period: 'all', p_withdrawn: false });
  const rowsArr = Array.isArray(first) ? first : first.rows; const last = rowsArr[rowsArr.length - 1];
  seed.school_grade_page_size = rowsArr.length; seed.school_grade_has_more = first.has_more ?? null;
  if (last) await measure('rpc_school_grade_records_all_page2', () => rpc(p, 'school_grade_records', { p_child_id: child, p_period: 'all', p_withdrawn: false, p_before_date: last.graded_on, p_before_id: last.id }));
  await measure('rpc_learning_progress_education_all_30d', () => rpc(p, 'learning_progress_education', { p_child_id: child, p_days: 30, p_subject: null, p_grade: null, p_period: 'all' }));
  await measure('rpc_learning_progress_30d', () => rpc(p, 'learning_progress', { p_child_id: child, p_days: 30, p_subject: null, p_grade: null }));
  await measure('sources_ready_documents_limit30', () => must(p.from('learning_sources').select('id,name,mime').eq('kind', 'document').eq('status', 'ready').order('created_at', { ascending: false }).limit(30), 'sources'));
  await measure('sources_ready_documents_all', () => must(p.from('learning_sources').select('id,name,mime,bytes,pages,created_at').eq('kind', 'document').eq('status', 'ready').order('created_at', { ascending: false }), 'sources_all'));
  await measure('prova_list_exams_with_attempts_limit100', () => must(p.from('exams').select('id,child_id,title,kind,status,timed,duration_minutes,question_ids,children(name,avatar),exam_attempts(id,status,mc_total,mc_correct,finished_at,created_at)').order('created_at', { ascending: false }).limit(100), 'prova_list'));
  await measure('rpc_get_prova_drafts', () => rpc(p, 'get_prova_drafts', {}));
  await measure('review_exam_answers_with_documents_by_attempt', () => must(p.from('exam_answers').select('question_id,answer_document,answer_text,answer_key,is_correct,score').eq('attempt_id', attempt), 'review_answers'));
  await measure('rpc_get_saved_exam_answers_v3_device', () => rpc(dev, 'get_saved_exam_answers_v3', { p_attempt_id: attempt }));
  await measure('rpc_get_attempt_questions_device', () => rpc(dev, 'get_attempt_questions', { p_exam_id: examId }));
  await measure('rpc_get_answer_review_single', () => rpc(p, 'get_answer_review', { p_attempt_id: attempt, p_question_id: questionIds[0] }));
  await measure('child_exam_count', () => must(dev.from('exams').select('id', { count: 'exact', head: true }).eq('child_id', child).eq('status', 'assigned'), 'child_exam_count').then(() => []));
  await measure('rpc_reward_balance_path_request_reward_denied', async () => { const r = await dev.rpc('request_reward', { p_reward_id: randomUUID(), p_idempotency_key: randomUUID() }); return r.error ? { error: r.error.message } : r.data; });

  // ---------------------------------------------------------------- EXPLAIN inside the disposable DB
  const f = quote(family), c = quote(child), a = quote(attempt);
  explain('home_task_templates_by_family', parentClaims, `select id,child_id,title,icon,stars,days_of_week,starts_on,ends_on,active,sort_order from public.task_templates where family_id=${f}`);
  explain('home_task_completions_week_by_family', parentClaims, `select id,child_id,template_id,due_date,status,task_snapshot from public.task_completions where family_id=${f} and due_date>=${quote(from)} and due_date<=${quote(to)}`);
  explain('home_star_events_by_family', parentClaims, `select child_id,delta from public.star_events where family_id=${f}`);
  explain('home_approvals_done_by_family', parentClaims, `select id,completed_at,due_date,child_id,task_snapshot from public.task_completions where family_id=${f} and status='done' order by completed_at`);
  explain('tasks_screen_templates_by_child', parentClaims, `select * from public.task_templates where child_id=${c} order by sort_order`);
  explain('child_star_balance_sum', deviceClaims, `select coalesce(sum(delta),0) from public.star_events where child_id=${c}`);
  explain('sources_ready_documents_limit30', parentClaims, `select id,name,mime from public.learning_sources where kind='document' and status='ready' order by created_at desc limit 30`);
  explain('prova_list_exams_limit100', parentClaims, `select id,child_id,title,kind,status,question_ids from public.exams order by created_at desc limit 100`);
  explain('prova_list_attempts_for_exams', parentClaims, `select id,exam_id,status,finished_at from public.exam_attempts where exam_id in (select id from public.exams order by created_at desc limit 100)`);
  explain('review_exam_answers_by_attempt', parentClaims, `select question_id,answer_document,answer_text,answer_key,is_correct,score from public.exam_answers where attempt_id=${a}`);
  explain('rpc_school_grade_records_all_page1', parentClaims, `select public.school_grade_records(${c},'all')`);
  explain('rpc_learning_progress_30d', parentClaims, `select public.learning_progress(${c},30,null,null)`);
  explain('rpc_get_saved_exam_answers_v3_device', deviceClaims, `select public.get_saved_exam_answers_v3(${a})`);
  explain('grades_child_all_direct', parentClaims, `select id,subject,kind,score,max_score,graded_on from public.grades where child_id=${c} and withdrawn_at is null order by graded_on desc,id desc limit 51`);
  // ---------------------------------------------------------------- experiments (disposable DB only; dropped afterwards)
  // A. RLS: wrap gina.* helper calls in scalar subqueries so Postgres evaluates them once per statement (InitPlan)
  //    instead of once per row. Policies are read from pg_policies and rewritten textually; nothing is persisted.
  const psql = text => spawnSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8' });
  const policies = JSON.parse(psql(`select coalesce(json_agg(json_build_object('name',policyname,'table',tablename,'cmd',cmd,'qual',qual)),'[]') from pg_policies where schemaname='public' and tablename in ('star_events','task_templates','exams','exam_attempts','task_completions','learning_sources','grades') and qual is not null`).stdout.trim() || '[]');
  const rewrite = q => q.replace(/\bgina\.(is_parent|is_device|family_id|child_id|is_admin)\(\)/g, '(select gina.$1())');
  const before = Object.fromEntries(explains.map(e => [e.label, e.execution_ms]));
  const rewritten = policies.filter(pol => rewrite(pol.qual) !== pol.qual);
  const alterSql = rewritten.map(pol => `alter policy ${pol.name} on public.${pol.table} using (${rewrite(pol.qual)});`).join('\n');
  const altered = psql(alterSql);
  const experiment = { rls_initplan: { policies_rewritten: rewritten.map(pol => pol.table + '.' + pol.name), applied: altered.status === 0, error: altered.status === 0 ? null : altered.stderr.trim().slice(0, 300), queries: [] } };
  if (altered.status === 0) {
    const rerun = [
      ['home_task_templates_by_family', parentClaims, `select id,child_id,title,icon,stars,days_of_week,starts_on,ends_on,active,sort_order from public.task_templates where family_id=${f}`],
      ['home_star_events_by_family', parentClaims, `select child_id,delta from public.star_events where family_id=${f}`],
      ['tasks_screen_templates_by_child', parentClaims, `select * from public.task_templates where child_id=${c} order by sort_order`],
      ['child_star_balance_sum', deviceClaims, `select coalesce(sum(delta),0) from public.star_events where child_id=${c}`],
      ['prova_list_exams_limit100', parentClaims, `select id,child_id,title,kind,status,question_ids from public.exams order by created_at desc limit 100`],
      ['rpc_school_grade_records_all_page1', parentClaims, `select public.school_grade_records(${c},'all')`],
    ];
    const mark = explains.length;
    for (const [label, cl, q] of rerun) explain(label + '__rls_initplan', cl, q);
    for (const e of explains.slice(mark)) { const base = e.label.replace('__rls_initplan', ''); experiment.rls_initplan.queries.push({ query: base, before_ms: before[base], after_ms: e.execution_ms, seq_scans_after: e.seq_scans?.map(s => s.relation) ?? [] }); }
    // REST-level re-measurement of the two slowest device/parent reads with the rewritten policies
    const m1 = await measure('child_star_events_by_child__rls_initplan', () => must(dev.from('star_events').select('delta').eq('child_id', child), 'child_stars_exp'));
    const m2 = await measure('child_today_templates_active__rls_initplan', () => must(dev.from('task_templates').select('id, title, icon, stars, days_of_week, starts_on, ends_on, time_of_day, requires_approval').eq('child_id', child).eq('active', true), 'child_today_exp'));
    const m3 = await measure('home_task_templates_by_family__rls_initplan', () => must(p.from('task_templates').select('id, child_id, title, icon, stars, days_of_week, starts_on, ends_on, active, sort_order').eq('family_id', family), 'home_templates_exp'));
    experiment.rls_initplan.rest = [m1, m2, m3].map(m => ({ label: m.label, p50_ms: m.p50_ms, p95_ms: m.p95_ms, before_p50_ms: measurements.find(x => x.label === m.label.replace('__rls_initplan', ''))?.p50_ms }));
  }
  // B. Index candidates: create them in the disposable DB and record whether the planner picks them at this volume.
  const indexSql = `create index q02_star_events_family on public.star_events(family_id); create index q02_task_templates_family on public.task_templates(family_id); create index q02_task_templates_child_sort on public.task_templates(child_id,sort_order); create index q02_exams_family_created on public.exams(family_id,created_at desc); analyze public.star_events; analyze public.task_templates; analyze public.exams;`;
  const indexed = psql(indexSql);
  experiment.indexes = { applied: indexed.status === 0, error: indexed.status === 0 ? null : indexed.stderr.trim().slice(0, 300), queries: [] };
  if (indexed.status === 0) {
    const mark = explains.length;
    explain('home_task_templates_by_family__indexed', parentClaims, `select id,child_id,title,icon,stars,days_of_week,starts_on,ends_on,active,sort_order from public.task_templates where family_id=${f}`);
    explain('home_star_events_by_family__indexed', parentClaims, `select child_id,delta from public.star_events where family_id=${f}`);
    explain('tasks_screen_templates_by_child__indexed', parentClaims, `select * from public.task_templates where child_id=${c} order by sort_order`);
    explain('prova_list_exams_limit100__indexed', parentClaims, `select id,child_id,title,kind,status,question_ids from public.exams order by created_at desc limit 100`);
    for (const e of explains.slice(mark)) experiment.indexes.queries.push({ query: e.label.replace('__indexed', ''), execution_ms: e.execution_ms, index_scans: e.index_scans?.map(i => i.index) ?? [], seq_scans: e.seq_scans?.map(s => s.relation) ?? [], note: 'planner choice at ~250-400 rows per table; a seq scan here does not predict production' });
  }
  seed.experiment_note = 'policy rewrites and indexes were applied only in the disposable DB, which is dropped by the runner';
  // table sizes for context
  const sizes = spawnSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', DB, '-c', "select json_agg(json_build_object('table',relname,'rows',n_live_tup)) from pg_stat_user_tables where schemaname='public' and relname in ('task_templates','task_completions','star_events','grades','learning_sources','exams','exam_attempts','exam_answers','question_bank','help_receipts','mutation_receipts')"], { encoding: 'utf8' });
  seed.table_rows = sizes.status === 0 ? JSON.parse(sizes.stdout.trim() || '[]') : null;
  // index candidates: sequential scans that read many rows and discard most of them
  const candidates = [];
  for (const e of explains) for (const s of e.seq_scans ?? []) if ((s.actual_rows + s.removed_by_filter) * (s.loops || 1) >= 50 && s.filter) candidates.push({ query: e.label, relation: s.relation, scanned_rows: (s.actual_rows + s.removed_by_filter) * (s.loops || 1), kept_rows: s.actual_rows * (s.loops || 1), filter: s.filter, execution_ms: e.execution_ms });
  check('perf_measurements_recorded', measurements.length >= 20, measurements.length);
  check('perf_explains_recorded', explains.filter(e => !e.error).length >= 10, JSON.stringify(explains.filter(e => e.error)));
  check('drawn_answer_writes_measured', writes.reps === 20 && writes.p95_ms > 0);
  mkdirSync(new URL('../docs/release/q02-2026-11-06/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../docs/release/q02-2026-11-06/perf.json', import.meta.url), JSON.stringify({ environment: 'disposable-local-auth-postgrest (loopback, Docker Desktop on this Mac; absolute numbers are not production latencies)', measured_at: new Date().toISOString(), seed, measurements, explains, index_candidates: candidates, experiment }, null, 2) + '\n');
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
