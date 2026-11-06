// H03 unit test (no DB, no network): node --test scripts/question-review-package.test.mjs
// Collector against an in-memory fake of the service-role client, offline validator, HTML renderer, negative cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { collectReviewPackage, scenarioFrom, validateReviewPackage, writeReviewPackage, openReviewPackage, contentHash } from './question-review-package.mjs';
import { fixtureQuestions, fixtureScenarioCandidate, syntheticPng, SHARED, CATALOGUE_ID, SOURCE_SHA } from './fixtures/question-review-fixture.mjs';

function fakeDb() {
  const familyId = randomUUID(), userId = randomUUID();
  const png = syntheticPng();
  const sourceId = randomUUID(), groupId = randomUUID(), objectPath = `${familyId}/${sourceId}.png`;
  const qs = fixtureQuestions({ versionTag: 'unit' }).map((q) => ({ id: randomUUID(), family_id: familyId, created_by: userId, grade: 5, subject: 'Türkçe', topic: 'Sentetik', difficulty: 'orta', choices: null, correct_key: null, expected_answer: null, solution: null, explanation: null, ...q, provenance: { ...q.provenance, requested_by: userId, draft_id: randomUUID() } }));
  const tables = {
    question_bank: qs.map(({ prompt, ...r }) => r),
    question_source_members: qs.slice(0, 3).map((q, i) => ({ group_id: groupId, question_id: q.id, position: i + 1, prompt: q.prompt })),
    question_source_groups: [{ id: groupId, family_id: familyId, version: 1, title: SHARED.title, body: SHARED.body, grade: 5, subject: 'Türkçe' }],
    learning_source_links: qs.slice(0, 3).map((q, i) => ({ question_id: q.id, source_id: sourceId, alt: SHARED.alt, created_at: `2026-11-06T00:00:0${i}Z` })),
    learning_sources: [{ id: sourceId, family_id: familyId, kind: 'question_image', mime: 'image/png', bytes: png.bytes.length, sha256: createHash('sha256').update(png.bytes).digest('hex'), object_path: objectPath, width: png.width, height: png.height, status: 'ready', name: 'veli-dosyasi.png' }],
  };
  const objects = new Map([[objectPath, png.bytes]]);
  const db = {
    from(t) {
      let rows = tables[t];
      const q = { select() { return q; }, in(col, vals) { rows = rows.filter((r) => vals.includes(r[col])); return q; }, order(col) { rows = [...rows].sort((a, b) => String(a[col]).localeCompare(String(b[col]))); return q; }, then(res, rej) { return Promise.resolve({ data: rows, error: null }).then(res, rej); } };
      return q;
    },
    storage: { from() { return { async download(p) { const b = objects.get(p); return b ? { data: new Blob([b]), error: null } : { data: null, error: { message: 'not_found' } }; } }; } },
  };
  return { db, qs, familyId, userId, objects, objectPath, tables };
}
const scenario = () => scenarioFrom({ candidate: fixtureScenarioCandidate(), catalogue_id: CATALOGUE_ID, revision: 2, source_sha256: SOURCE_SHA });

test('collects a complete, private, offline package for a 3-question shared source with an image', async () => {
  const f = fakeDb();
  const pkg = await collectReviewPackage(f.db, { questionIds: f.qs.map((q) => q.id), scenario: scenario(), origin: { kind: 'fixture', target: 'unit' } });
  const v = validateReviewPackage(pkg);
  assert.deepEqual(v.problems, []);
  assert.equal(pkg.shared_sources.length, 1);
  const s = pkg.shared_sources[0];
  assert.equal(s.body, SHARED.body);
  assert.equal(s.question_ids.length, 3);
  assert.equal(s.images.length, 1, 'image common to all members is carried once by the shared source');
  assert.equal(pkg.images.length, 1);
  assert.match(pkg.images[0].data_uri, /^data:image\/png;base64,/);
  const mc = pkg.questions[1];
  assert.equal(mc.kind, 'multiple_choice');
  assert.equal(mc.correct_key, 'C');
  assert.equal(mc.choices.length, 4);
  assert.equal(pkg.questions[0].rubric.assesses, 'result');
  assert.equal(pkg.questions[0].outcomes[0].text.startsWith('SYN.O.5.1.'), true);
  assert.ok(pkg.questions.every((q) => q.stem.length > 10));
  const text = JSON.stringify(pkg);
  for (const secret of [f.familyId, f.userId, f.objectPath, 'veli-dosyasi', 'requested_by', 'draft_id']) assert.ok(!text.includes(secret), `leaks ${secret}`);
  assert.ok(!text.includes(f.qs[0].id), 'only short question ids');
});

test('written package re-opens from the HTML alone after the source rows and objects are gone', async () => {
  const f = fakeDb();
  const pkg = await collectReviewPackage(f.db, { questionIds: f.qs.map((q) => q.id), scenario: scenario() });
  const dir = mkdtempSync(join(tmpdir(), 'h03-unit-'));
  try {
    assert.equal(writeReviewPackage(dir, pkg).ok, true);
    for (const t of Object.values(f.tables)) t.length = 0;
    f.objects.clear();
    const r = openReviewPackage(dir);
    assert.deepEqual(r.problems, []);
    const html = readFileSync(join(dir, 'review-package.html'), 'utf8');
    assert.equal(html.split('id="s-group-').length - 1, 1, 'shared source shown once');
    assert.ok(!/<img[^>]+src="https?:/.test(html));
    assert.ok(html.includes('Durum: insan incelemesi bekliyor.'));
    // Tampering is detected offline.
    writeFileSync(join(dir, 'review-package.html'), html.replace(SHARED.alt, 'x'));
    assert.equal(openReviewPackage(dir).ok, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('validator rejects incomplete or unsafe packages', async () => {
  const f = fakeDb();
  const good = await collectReviewPackage(f.db, { questionIds: f.qs.map((q) => q.id), scenario: scenario() });
  const mutate = (fn) => { const p = structuredClone(good); fn(p); p.content_sha256 = contentHash(p); return validateReviewPackage(p).problems; };
  assert.ok(mutate((p) => { p.questions[3].stem = ''; }).some((x) => x.startsWith('stem_missing')));
  assert.ok(mutate((p) => { p.shared_sources[0].body = ''; p.shared_sources[0].images = []; }).some((x) => x.startsWith('shared_content_missing')));
  assert.ok(mutate((p) => { p.images[0].data_uri = 'https://storage.example/x.png?token=abc'; }).some((x) => x.startsWith('image_not_embedded')));
  assert.ok(mutate((p) => { p.images[0].sha256 = '0'.repeat(64); }).some((x) => x.startsWith('image_integrity')));
  assert.ok(mutate((p) => { p.questions[0].rubric.assesses = 'both'; }).some((x) => x.startsWith('rubric_assesses')));
  const unspecified = structuredClone(good); unspecified.questions[0].rubric.assesses = null; unspecified.content_sha256 = contentHash(unspecified);
  const vu = validateReviewPackage(unspecified);
  assert.equal(vu.ok, true, 'assesses is optional in storage (grader infers it), so only a warning');
  assert.ok(vu.warnings.some((x) => x.startsWith('rubric_assesses_unspecified')));
  assert.ok(mutate((p) => { p.questions[1].correct_key = null; }).some((x) => x.startsWith('correct_key')));
  assert.ok(mutate((p) => { p.questions[0].outcomes[0].text = ''; }).some((x) => x.startsWith('outcome')));
  assert.ok(mutate((p) => { p.questions[0].source.source_sha256 = 'f'.repeat(64); }).some((x) => x.startsWith('source_link')));
  assert.ok(mutate((p) => { p.questions.pop(); }).some((x) => x.startsWith('block_count')));
  assert.ok(mutate((p) => { p.questions[0].family_id = 'x'; }).some((x) => x.startsWith('forbidden_key')));
  assert.ok(mutate((p) => { p.questions[0].solution = 'veli@example.com'; }).some((x) => x.startsWith('email_like')));
  assert.ok(mutate((p) => { p.review.accepted = true; }).includes('review_must_stay_pending'));
  const stale = structuredClone(good); stale.questions[0].expected_answer = 'değişti';
  assert.ok(validateReviewPackage(stale).problems.includes('content_sha256_mismatch'));
});

test('collector refuses a broken or missing image instead of dropping it', async () => {
  const f = fakeDb();
  f.objects.set(f.objectPath, Buffer.from('not a png at all, but long enough'));
  await assert.rejects(collectReviewPackage(f.db, { questionIds: f.qs.map((q) => q.id), scenario: scenario() }), /review_package_image_integrity/);
  f.objects.clear();
  await assert.rejects(collectReviewPackage(f.db, { questionIds: f.qs.map((q) => q.id), scenario: scenario() }), /review_image_download/);
  await assert.rejects(collectReviewPackage(f.db, { questionIds: [randomUUID()], scenario: scenario() }), /review_package_questions_missing/);
});
