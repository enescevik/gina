// H03: review-package acceptance on the disposable isolated stack (real Auth + PostgREST + Storage, empty cloned DB).
// Invoked only by `python3 scripts/test-isolated-services.py --run-local --review-package`.
// Synthetic family (@example.invalid) → real private-bucket PNG + learning_sources row → scenario-bound rows exactly as
// the generator stores them: a finalized 3-question shared-source group (2 open-ended + 1 multiple choice) carrying the
// image, plus one standalone question → collectReviewPackage (service role) → write package → delete family, user,
// object → prove rows/object are gone → re-open the package offline (no DB, no session) and verify it is complete.
// Prints only {"checks": {...}} on stdout. No paid call, no network outside loopback.
import http from 'node:http';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { collectReviewPackage, scenarioFrom, writeReviewPackage, openReviewPackage, SOURCE_BUCKET } from './question-review-package.mjs';
import { fixtureQuestions, fixtureScenarioCandidate, syntheticPng, SHARED, CATALOGUE_ID, SOURCE_SHA } from './fixtures/question-review-fixture.mjs';

const authPort = Number(process.env.GINA_QA_AUTH_PORT), restPort = Number(process.env.GINA_QA_REST_PORT), storagePort = Number(process.env.GINA_QA_STORAGE_PORT || 0);
if (![authPort, restPort, storagePort].every((v) => Number.isInteger(v) && v > 1024 && v < 65536) || !process.env.GINA_QA_SERVICE) throw Error('isolated_runner_required');
const ROOT = new URL('../', import.meta.url);
const EVIDENCE = new URL('docs/release/h03-2026-11-06/fixture-package/', ROOT).pathname;
const require = createRequire(new URL('apps/mobile/package.json', ROOT));
const { createClient } = require('@supabase/supabase-js');

const proxy = http.createServer((req, res) => {
  const routes = [['/auth/v1', authPort], ['/rest/v1', restPort], ['/storage/v1', storagePort]];
  const route = routes.find(([prefix]) => req.url === prefix || req.url.startsWith(prefix + '/'));
  if (!route) { res.writeHead(404); res.end(); return; }
  const [prefix, port] = route;
  const upstream = http.request({ hostname: '127.0.0.1', port, path: req.url.slice(prefix.length) || '/', method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  upstream.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(upstream);
});
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${proxy.address().port}`;
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(base, process.env.GINA_QA_SERVICE, options);
const checks = {};
const check = (name, ok) => { checks[name] = !!ok; return !!ok; };
const must = async (p, label) => { const r = await p; if (r.error) throw Error(`${label}: ${r.error.message ?? r.error.code}`); return r.data; };
const dir = mkdtempSync(join(tmpdir(), 'gina-h03-package-'));
let userId, familyId, objectPath;
try {
  // 1. Synthetic parent + family through the real Auth/RPC path.
  const email = `gina-h03-${randomUUID()}@example.invalid`, password = randomBytes(24).toString('base64url');
  userId = (await must(admin.auth.admin.createUser({ email, password, email_confirm: true }), 'create_user')).user.id;
  const parent = createClient(base, process.env.GINA_QA_ANON, options);
  await must(parent.auth.signInWithPassword({ email, password }), 'sign_in');
  familyId = await must(parent.rpc('create_family', { p_name: 'H03 sentetik aile', p_display_name: 'H03 sentetik veli' }), 'create_family');
  await must(parent.auth.refreshSession(), 'refresh');

  // 2. Real private object + verified question_image source (what the upload/finalize flow leaves behind).
  const png = syntheticPng(), sourceId = randomUUID(), pngSha = createHash('sha256').update(png.bytes).digest('hex');
  objectPath = `${familyId}/${sourceId}`;
  await must(admin.storage.from(SOURCE_BUCKET).upload(objectPath, png.bytes, { contentType: 'image/png', upsert: false }), 'upload');
  await must(admin.from('learning_sources').insert({ id: sourceId, family_id: familyId, uploaded_by: userId, kind: 'question_image', name: 'h03-pano.png', mime: 'image/png', bytes: png.bytes.length, sha256: pngSha, object_path: objectPath, status: 'ready', width: png.width, height: png.height, storage_consent: 'private-storage-v1', verified_at: new Date().toISOString() }), 'source');

  // 3. Scenario-bound rows exactly as prova-generate + link_ai_shared_sources store them.
  const items = fixtureQuestions({ versionTag: 'h03fixture' });
  const ids = items.map(() => randomUUID());
  await must(admin.from('question_bank').insert(items.map(({ prompt, ...q }, i) => ({ id: ids[i], family_id: familyId, created_by: userId, grade: 5, subject: 'Türkçe', topic: 'Sentetik bahçe', difficulty: 'orta', ...q, provenance: { ...q.provenance, requested_by: userId, draft_id: randomUUID() } }))), 'questions');
  await must(admin.from('learning_source_links').insert(ids.slice(0, 3).map((qid) => ({ source_id: sourceId, question_id: qid, alt: SHARED.alt }))), 'links');
  const groupId = randomUUID();
  await must(admin.from('question_source_groups').insert({ id: groupId, family_id: familyId, series_id: groupId, version: 1, title: SHARED.title, body: SHARED.body, grade: 5, subject: 'Türkçe' }), 'group');
  await must(admin.from('question_source_members').insert(items.slice(0, 3).map((q, i) => ({ group_id: groupId, question_id: ids[i], position: i + 1, prompt: q.prompt }))), 'members');
  await must(admin.from('question_source_groups').update({ finalized_at: new Date().toISOString() }).eq('id', groupId), 'finalize');
  const ctx = await must(parent.rpc('get_question_context', { p_question_ids: ids }), 'context');
  check('fixture.parent_sees_one_shared_source_for_three_questions', ctx.length === 3 && new Set(ctx.map((c) => c.group_id)).size === 1);
  const media = await must(parent.rpc('get_question_media', { p_question_ids: ids }), 'media');
  check('fixture.image_linked_to_each_group_member', media.length === 3 && media.every((m) => m.source_id === sourceId));

  // 4. Export BEFORE cleanup.
  const scenario = scenarioFrom({ candidate: fixtureScenarioCandidate(), catalogue_id: CATALOGUE_ID, revision: 2, source_sha256: SOURCE_SHA });
  const pkg = await collectReviewPackage(admin, { questionIds: ids, scenario, origin: { kind: 'fixture', target: 'local-isolated', note: 'H03 synthetic fixture' } });
  const written = writeReviewPackage(dir, pkg);
  check('export.package_complete_before_cleanup', written.ok);
  if (!written.ok) process.stderr.write(`problems: ${JSON.stringify(written.problems)}\n`);

  // 5. Cleanup: family (cascade), user, private object; prove nothing remains to fall back on.
  const privateValues = [email, familyId, userId, sourceId, objectPath, 'h03-pano', 'requested_by', 'draft_id', ...ids];
  await must(admin.from('families').delete().eq('id', familyId), 'delete_family');
  await must(admin.auth.admin.deleteUser(userId, false), 'delete_user');
  await must(admin.storage.from(SOURCE_BUCKET).remove([objectPath]), 'remove_object');
  await admin.from('source_deletion_queue').delete().eq('object_path', objectPath);
  const left = async (t, col, vals) => (await admin.from(t).select('*', { count: 'exact', head: true }).in(col, vals)).count;
  check('cleanup.questions_gone', (await left('question_bank', 'id', ids)) === 0);
  check('cleanup.group_gone', (await left('question_source_groups', 'id', [groupId])) === 0);
  check('cleanup.source_row_gone', (await left('learning_sources', 'id', [sourceId])) === 0);
  check('cleanup.object_gone', !!(await admin.storage.from(SOURCE_BUCKET).download(objectPath)).error);
  check('cleanup.auth_user_gone', !!(await admin.auth.admin.getUserById(userId)).error);
  userId = null; familyId = null;

  // 6. Offline re-open: only the two files on disk.
  const opened = openReviewPackage(dir);
  check('offline.package_opens_complete_without_db_or_session', opened.ok);
  if (!opened.ok) process.stderr.write(`offline problems: ${JSON.stringify(opened.problems)}\n`);
  const p = opened.pkg;
  const s = p.shared_sources[0];
  check('offline.one_shared_source_three_linked_questions', p.shared_sources.length === 1 && s.question_ids.length === 3 && s.body === SHARED.body && s.title === SHARED.title);
  check('offline.image_embedded_and_byte_identical', p.images.length === 1 && p.images[0].sha256 === pngSha && Buffer.from(p.images[0].data_uri.split(',')[1], 'base64').equals(png.bytes) && s.images[0]?.alt === SHARED.alt);
  check('offline.multiple_choice_choices_and_key', p.questions[1].kind === 'multiple_choice' && p.questions[1].choices.length === 4 && p.questions[1].correct_key === 'C');
  check('offline.full_stem_prompt_answer_rubric_outcome_source', p.questions.every((q) => q.stem.length > 20 && q.outcomes.every((o) => o.text) && q.source.scenario_version && q.source.source_sha256 === SOURCE_SHA) && p.questions.filter((q) => q.kind === 'open_ended').every((q) => q.expected_answer && q.rubric?.assesses && q.rubric.criteria.length));
  const html = readFileSync(join(dir, 'review-package.html'), 'utf8'), json = readFileSync(join(dir, 'review-package.json'), 'utf8');
  check('offline.no_personal_or_storage_data', privateValues.every((x) => !html.includes(x) && !json.includes(x)));
  check('offline.no_url_resource_in_html', !/<(img|script|link|iframe)[^>]+(src|href)="https?:/i.test(html));
  check('offline.review_stays_pending_not_accepted', p.review.status === 'pending_human_review' && p.review.accepted === false);
  mkdirSync(EVIDENCE, { recursive: true });
  cpSync(dir, EVIDENCE, { recursive: true });
} catch (e) {
  check('harness.' + String(e.message).slice(0, 80), false);
} finally {
  if (familyId) await admin.from('families').delete().eq('id', familyId);
  if (userId) await admin.auth.admin.deleteUser(userId, false);
  if (objectPath) await admin.storage.from(SOURCE_BUCKET).remove([objectPath]);
  proxy.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log(JSON.stringify({ checks }));
process.exitCode = Object.values(checks).length && Object.values(checks).every(Boolean) ? 0 : 1;
