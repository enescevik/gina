// H03 — CLI for the portable question review package (library: scripts/question-review-package.mjs).
//
//   node scripts/build-question-review-package.mjs --open <dir>
//        Offline re-open: reads review-package.html (+ .json), validates completeness/privacy/image integrity.
//        Needs no DB, no session, no network. Exit 1 if incomplete.
//   node scripts/build-question-review-package.mjs --render <review-package.json> --out <dir>
//        Re-render the HTML from a package JSON (e.g. after a renderer fix). Content is never changed.
//   node scripts/build-question-review-package.mjs --d15-recovery [--out <file>]
//        Recoverability assessment for the D15 live pilot (6 Nov 2026): builds the best package the committed safe
//        artefacts allow (live/*.json, chain-trace.json, calls.jsonl) WITHOUT inventing content, and lists exactly
//        which fields are missing. Never writes a review HTML for an incomplete package.
//
// Collection from the database happens inside the pilot (run-meb-pilot.mjs `generate`, before `cleanup`) or the
// isolated fixture test, through collectReviewPackage().
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { FORMAT, contentHash, openReviewPackage, scenarioFrom, validateReviewPackage, writeReviewPackage } from './question-review-package.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };

function d15Recovery() {
  const live = join(ROOT, 'docs/release/d15-2026-11-06/live');
  const read = (f) => JSON.parse(readFileSync(join(live, f), 'utf8'));
  const review = read('questions-for-human-review.json');
  const trace = read('chain-trace.json');
  const cand = read('candidate-for-review.json');
  const calls = readFileSync(join(live, 'calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const scenario = scenarioFrom({ candidate: cand.candidate, catalogue_id: trace.scenario.catalogue_id, revision: trace.scenario.revision, source_sha256: trace.scenario.source_sha256 });
  const groupMembers = trace.questions.filter((q) => q.group).map((q) => q.id);
  const questions = trace.questions.map((t, i) => {
    const r = review.find((x) => x.id === t.id) ?? {};
    const block = scenario.blocks.find((b) => b.block_id === t.block_id);
    return {
      id: t.id, position: i + 1, block_id: t.block_id, outcome_ids: t.outcome_ids,
      outcomes: t.outcome_ids.map((code) => ({ code, text: block?.outcomes.find((o) => o.code === code)?.text ?? '' })),
      kind: t.kind, grade: scenario.grade, subject: scenario.subject, topic: '', difficulty: 'orta',
      stem: '', // NOT RECOVERABLE: never written to a committed artefact; the row was deleted in cleanup/verify.
      shared_source_id: t.group ? 'd15-group-unrecoverable' : null, shared_position: t.group ? groupMembers.indexOf(t.id) + 1 : null,
      prompt: t.group ? '' : null, // NOT RECOVERABLE
      choices: null, correct_key: null, expected_answer: r.expected_answer ?? null, solution: null, explanation: null,
      rubric: r.rubric ?? null, images: [],
      source: { scenario_version: t.scenario_version, catalogue_id: trace.scenario.catalogue_id, catalogue_revision: trace.scenario.revision, source_sha256: trace.scenario.source_sha256, source_cells: t.source_cells },
      generation: { generator: 'ai', model: t.model, prompt_version: t.prompt_version }, content_fit: t.content_fit,
    };
  });
  const pkg = {
    format: FORMAT, generated_at: new Date().toISOString(),
    origin: { kind: 'd15_live_pilot_recovery', target: 'production (artefacts only; no DB access)', note: 'Rebuilt only from committed D15 live artefacts; nothing inferred.' },
    review: { status: 'pending_human_review', accepted: false, note: 'İnsan içerik onayı bu paketle verilmiş sayılmaz; inceleme kararı ayrı kaydedilir.' },
    scenario: { ...scenario, catalogue_id: trace.scenario.catalogue_id },
    shared_sources: groupMembers.length ? [{ id: 'd15-group-unrecoverable', origin: 'question_group', version: null, title: '', body: '', kind: 'text', images: [], question_ids: groupMembers }] : [],
    images: [], questions,
  };
  pkg.content_sha256 = contentHash(pkg);
  const v = validateReviewPackage(pkg);
  const field = (name, have) => ({ field: name, recoverable: have });
  const out = {
    assessed_at: pkg.generated_at,
    inputs: ['live/questions-for-human-review.json', 'live/chain-trace.json', 'live/candidate-for-review.json', 'live/calls.jsonl', 'live/stage-generate.json', 'live/stage-cleanup.json', 'live/stage-verify.json'],
    paid_generation_calls: calls.filter((c) => c.paid).length,
    per_question: questions.map((q) => ({
      id: q.id, block_id: q.block_id, grouped: !!q.shared_source_id,
      fields: [
        field('stem', false), field('kind', !!q.kind), field('choices', q.kind === 'open_ended' ? 'not_applicable' : false),
        field('shared_source_text_and_id', q.shared_source_id ? false : 'not_applicable'), field('shared_member_prompt', q.shared_source_id ? false : 'not_applicable'),
        field('images', 'none_expected_ai_path_has_no_image_files'), field('expected_answer', !!q.expected_answer),
        field('rubric_with_assesses', !!q.rubric?.assesses), field('outcome_text', q.outcomes.every((o) => o.text)),
        field('source_link', !!q.source.scenario_version && !!q.source.source_cells),
      ],
    })),
    validation_of_best_effort_package: v,
    conclusion: 'Soru kökleri, ortak kaynak başlığı/metni (grup B1×2 + B3×1) ve B2 afiş betimlemesi hiçbir güvenli artefakta yazılmamış; üretim satırları cleanup/verify ile silinmiş (generated_questions_absent). Cevap, rubrik (assesses dahil), kazanım metni ve kaynak ilişkisi kurtarılabilir. Tam inceleme için yeni pilot gerekir.',
  };
  const file = arg('--out') ?? join(ROOT, 'docs/release/h03-2026-11-06/d15-recovery.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ file: file.replace(ROOT, ''), package_ok: v.ok, missing: v.problems }, null, 1));
  return v.ok ? 0 : 2;
}

let code = 0;
if (argv.includes('--open')) {
  const r = openReviewPackage(arg('--open'));
  console.log(JSON.stringify({ ok: r.ok, problems: r.problems, questions: r.pkg?.questions.length, shared_sources: r.pkg?.shared_sources.length, images: r.pkg?.images.length }, null, 1));
  code = r.ok ? 0 : 1;
} else if (argv.includes('--render')) {
  const pkg = JSON.parse(readFileSync(arg('--render'), 'utf8'));
  const out = arg('--out');
  if (!out) throw Error('--out required');
  const r = writeReviewPackage(out, pkg);
  console.log(JSON.stringify({ ok: r.ok, problems: r.problems, sha256: r.sha256 }, null, 1));
  code = r.ok ? 0 : 1;
} else if (argv.includes('--d15-recovery')) {
  code = d15Recovery();
} else {
  console.error('usage: --open <dir> | --render <json> --out <dir> | --d15-recovery [--out <file>]');
  code = 64;
}
process.exitCode = code;
