// D13 — amaç duyarlı puanlama (prova-grade/v7-purpose-aware) canlı kontrolü. YAZILDI, ÇALIŞTIRILMADI.
// Koordinatör çalıştırır; önce bu dalın prova-grade (ve prova-review, prova-generate) fonksiyonları dağıtılmış olmalı.
// Kullanım (sırayla): node docs/release/d13-2026-11-06/run-d13.mjs <stage>
//   stages: setup | override | prova | grade | cleanup | verify
// Kurallar (C14b ile aynı): gerçek aile/kullanıcıya dokunmaz; anahtar/parola/token yazdırmaz. Durum yalnız gitignored
// `.codex-setup/d13/ai-state.json` içinde (0600). Ücretli çağrı tavanı 2 (beklenen: 1 prova-grade); her gerçek çağrı
// `calls.jsonl`'a (kişisel veri ve sır içermeyen özet) yazılır. Otomatik tekrar yok.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, chmodSync, mkdirSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';

const ROOT = new URL('../../../', import.meta.url);
const OUT = new URL('./', import.meta.url);
const STATE_DIR = new URL('.codex-setup/d13/', ROOT);
const STATE = new URL('ai-state.json', STATE_DIR);
const PROJECT = 'wixjxlxgyhgdacadsawo';
const URL_BASE = `https://${PROJECT}.supabase.co`;
const MAX_PAID = 2;
const EXPECTED_PROMPT = 'prova-grade/v7-purpose-aware';
const require = createRequire(new URL('apps/mobile/package.json', ROOT));
const { createClient } = require('@supabase/supabase-js');

const stage = process.argv[2];
mkdirSync(STATE_DIR, { recursive: true });
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const save = () => { writeFileSync(STATE, JSON.stringify(state, null, 1)); chmodSync(STATE, 0o600); };
const now = () => new Date().toISOString();

const cli = spawnSync('pnpm', ['exec', 'supabase', 'projects', 'api-keys', '--project-ref', PROJECT, '--output', 'json'], { encoding: 'utf8', cwd: ROOT.pathname });
if (cli.status !== 0) throw Error('credential_lookup_failed');
const keys = JSON.parse(cli.stdout);
const SERVICE = keys.find((k) => k.name === 'service_role')?.api_key;
const ANON = keys.find((k) => k.name === 'anon')?.api_key;
if (!SERVICE || !ANON) throw Error('credentials_unavailable');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL_BASE, SERVICE, options);
const must = async (p, label) => { const r = await p; if (r.error) throw Error(`${label}: ${r.error.message ?? r.error.code ?? 'error'}`); return r.data; };

const results = [];
const check = (name, ok, detail = {}) => { results.push({ name, ok: !!ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, Object.keys(detail).length ? JSON.stringify(detail) : ''); };
const writeStage = () => writeFileSync(new URL(`stage-${stage}.json`, OUT), JSON.stringify({ stage, at: now(), checks: results }, null, 1) + '\n');
function paidCount() {
  const f = new URL('calls.jsonl', OUT);
  if (!existsSync(f)) return 0;
  return readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((c) => c.paid).length;
}
function logCall(entry) { appendFileSync(new URL('calls.jsonl', OUT), JSON.stringify({ at: now(), ...entry }) + '\n'); }
function guardPaid() { const n = paidCount(); if (n >= MAX_PAID) throw Error('paid_call_cap_reached'); return n; }

async function session(email, password) {
  const c = createClient(URL_BASE, ANON, options);
  await must(c.auth.signInWithPassword({ email, password }), 'sign_in');
  return c;
}
async function device() {
  const c = createClient(URL_BASE, ANON, options);
  await must(c.auth.refreshSession({ refresh_token: state.deviceRefresh }), 'device_refresh');
  state.deviceRefresh = (await c.auth.getSession()).data.session.refresh_token; save();
  return c;
}
const token = async (c) => (await c.auth.getSession()).data.session.access_token;
async function fn(c, name, body) {
  const r = await fetch(`${URL_BASE}/functions/v1/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${await token(c)}`, apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: r.status, body: json };
}
const gradeJobs = async () => (await must(admin.from('ai_operation_jobs').select('id').eq('family_id', state.familyId).eq('action', 'grade'), 'jobs')).length;

const CHILD = { name: 'Deneme Cocuk', birth_year: 2015, grade: 5, gender: 'unspecified', avatar: 'avatar-default', interests: [] };
// C14b canlı vakası: aynı rubrik + alternatifler; aynı çocuk cevabı. Yalnız soru metni ve amaç değişir.
const RUBRIC = { criteria: [{ text: 'Yenen kısmı 2/4 olarak yazar', points: 40 }, { text: 'Kesri 1/2 olarak sadeleştirir ya da yarısı der', points: 60 }], alternative_answers: ['yarısı', '0,5', 'yarım'] };
const BASE = { grade: 5, subject: 'Matematik', topic: 'Kesirler', kind: 'open_ended', difficulty: 'orta', expected_answer: '2/4 = 1/2 (pastanın yarısı)', solution: '2 dilim / 4 dilim = 2/4; pay ve payda 2 ile bölünür: 1/2.', rubric: RUBRIC };
const CASES = {
  // D13-1: yalnız sonuç → beklenen ≥ 90.
  result: { ...BASE, stem: 'Bir pasta 4 eşit dilime bölünmüş ve 2 dilimi yenmiştir. Pastanın ne kadarı yenmiştir?', assesses: 'result' },
  // D13-2: süreç (kesirle yaz + sadeleştir + işlemi göster) → beklenen ölçüte göre kısmi (2/4 yok → ~60, < 90).
  process: { ...BASE, stem: 'Bir pasta 4 eşit dilime bölünmüş ve 2 dilimi yenmiştir. Yenen kısmı önce kesir olarak yaz, sonra sadeleştir; işlemini göster.', assesses: 'process' },
  // D13-3 (bilgi amaçlı, geçme koşulu değil): alan yok (veli rubriği) → sorudan_cikar; C14b'nin özgün metni.
  inferred: { ...BASE, stem: 'Bir pasta 4 eşit dilime bölünmüş ve 2 dilimi yenmiştir. Pastanın ne kadarı yenmiştir? Kesir olarak yaz ve sadeleştir.', assesses: null },
};
const ANSWER = 'Pastanın yarısı yenmiş, yani 0,5.';

async function stageSetup() {
  if (state.userId) throw Error('already_set_up');
  state.email = `gina-d13-${randomUUID()}@example.invalid`;
  state.password = randomBytes(24).toString('base64url');
  state.pin = String(1000 + (randomBytes(2).readUInt16BE() % 9000));
  save();
  const created = await must(admin.auth.admin.createUser({ email: state.email, password: state.password, email_confirm: true }), 'create_user');
  state.userId = created.user.id; save();
  const parent = await session(state.email, state.password);
  state.familyId = await must(parent.rpc('create_family', { p_name: 'D13 sentetik aile', p_display_name: 'D13 sentetik veli' }), 'create_family'); save();
  await must(parent.auth.refreshSession(), 'refresh');
  state.childId = await must(parent.rpc('save_child_setup', { p_request_id: randomUUID(), p_profile: CHILD, p_tasks: [] }), 'child'); save();
  await must(parent.rpc('set_child_pin', { p_child_id: state.childId, p_pin: state.pin }), 'pin');
  const dev = createClient(URL_BASE, ANON, options);
  await must(dev.auth.signInAnonymously(), 'device_anon');
  state.deviceUserId = (await dev.auth.getUser()).data.user.id; save();
  const code = await must(dev.rpc('request_pairing', { p_device_name: 'D13 sentetik tablet' }), 'request_pairing');
  const prev = await must(parent.rpc('preview_device_pairing', { p_code: code }), 'preview_pairing');
  state.deviceId = await must(parent.rpc('pair_child_device', { p_code: code, p_preview_token: prev.preview_token }), 'pair'); save();
  await must(dev.auth.refreshSession(), 'dev_refresh');
  await must(parent.rpc('configure_child_device', { p_device_id: state.deviceId, p_name: 'D13 sentetik tablet', p_child_ids: [state.childId], p_pin_required: true }), 'configure');
  await must(dev.auth.refreshSession(), 'dev_refresh2');
  const ok = await must(dev.rpc('child_pin_login', { p_child_id: state.childId, p_pin: state.pin }), 'pin_login');
  await must(dev.auth.refreshSession(), 'dev_refresh3');
  state.deviceRefresh = (await dev.auth.getSession()).data.session.refresh_token; save();
  check('synthetic_account_family_child_device', ok === true, { email_domain: 'example.invalid' });
}

async function stageOverride() {
  // C14b ile aynı operatör yöntemi: servis rolüyle yalnız sentetik aileye gerekçeli, 2 saat süreli Pro satırı.
  const until = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const reason = 'D13 amac duyarli puanlama kontrolu: sentetik aile, 2 saat; aile ve hesap test sonunda silinir';
  const row = await must(admin.from('entitlement_overrides').insert({ family_id: state.familyId, plan: 'pro', reason, ends_at: until }).select('id,plan').single(), 'override');
  state.overrideId = row.id; save();
  const parent = await session(state.email, state.password);
  const ent = await must(parent.rpc('get_prova_entitlement'), 'ent');
  check('family_now_pro_via_override', ent.plan === 'pro', { plan: ent.plan });
}

async function stageProva() {
  const parent = await session(state.email, state.password);
  state.q = {};
  for (const [key, c] of Object.entries(CASES)) {
    const { assesses, ...question } = c;
    // Veli kaydı yalnız {criteria, alternative_answers} kabul eder (gina.valid_question_rubric); amaç alanı yok.
    state.q[key] = await must(parent.rpc('save_question_with_sources', { p_request_id: randomUUID(), p_question: question, p_images: [] }), `q_${key}`); save();
    if (assesses) {
      // Sentetik satıra amaç alanı servis rolüyle eklenir (AI üretiminin v8'de yazdığı biçim: provenance.rubric.assesses).
      // Veli düzenleyicisi bu alanı henüz yazamıyor (README «Sınırlar»). Yalnız bu sentetik ailenin satırı.
      const row = await must(admin.from('question_bank').select('provenance,family_id').eq('id', state.q[key]).single(), `read_${key}`);
      if (row.family_id !== state.familyId) throw Error('not_synthetic_row');
      await must(admin.from('question_bank').update({ provenance: { ...row.provenance, rubric: { ...row.provenance.rubric, assesses } } }).eq('id', state.q[key]).eq('family_id', state.familyId), `assesses_${key}`);
    }
  }
  const rows = await must(admin.from('question_bank').select('id,provenance').in('id', Object.values(state.q)), 'rows');
  const by = Object.fromEntries(rows.map((r) => [r.id, r.provenance?.rubric?.assesses ?? null]));
  check('purpose_field_on_synthetic_rows', by[state.q.result] === 'result' && by[state.q.process] === 'process' && by[state.q.inferred] === null, { assesses: [by[state.q.result], by[state.q.process], by[state.q.inferred]] });
  state.draft = randomUUID(); save();
  const content = { childId: state.childId, grade: 5, title: 'D13 amaç duyarlı puanlama', purpose: 'written', format: 'school', subjects: ['Matematik'], topics: ['Kesirler'], target: 3, minutes: null, difficulty: 'orta', kind: 'open_ended', note: '', step: 2,
    blocks: Object.values(state.q).map((id) => ({ kind: 'question', id, source: 'manual' })) };
  await must(parent.rpc('save_prova_draft', { p_request_id: randomUUID(), p_id: state.draft, p_version: 0, p_content: content }), 'draft');
  const v = await must(admin.from('prova_drafts').select('version').eq('id', state.draft).single(), 'draft_ver');
  await must(parent.rpc('submit_prova_draft', { p_request_id: randomUUID(), p_id: state.draft, p_version: v.version }), 'submit');
  const dev = await device();
  const started = await must(dev.rpc('start_exam_attempt', { p_exam_id: state.draft }), 'start');
  state.attempt = Array.isArray(started) ? started[0].id : started.id; save();
  for (const id of Object.values(state.q)) await must(dev.rpc('submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: state.attempt, p_question_id: id, p_expected_revision: 0, p_answer_text: ANSWER }), 'answer');
  await must(dev.rpc('finish_exam_attempt', { p_attempt_id: state.attempt }), 'finish');
  check('attempt_finished_three_open_answers', true);
}

async function stageGrade() {
  const parent = await session(state.email, state.password);
  const pre = await gradeJobs();
  const n0 = guardPaid();
  const t0 = Date.now();
  const g = await fn(parent, 'prova-grade', { attempt_id: state.attempt });
  const paid = (await gradeJobs()) > pre;
  logCall({ step: 'prova-grade D13 (same answer; result / process / inferred)', paid, endpoint: 'prova-grade', response: { status: g.status, code: g.body.code, suggested: g.body.suggested, prompt_version: g.body.summary?.prompt_version, ms: Date.now() - t0 }, ...(paid ? { paid_index: n0 + 1 } : {}) });
  check('grade_ok', g.status === 200 && g.body.suggested === 3, { status: g.status, code: g.body.code, suggested: g.body.suggested });
  check('prompt_version_v7', g.body.summary?.prompt_version === EXPECTED_PROMPT, { prompt_version: g.body.summary?.prompt_version });
  if (g.status !== 200) return;
  const rows = await must(admin.from('exam_answers').select('question_id,ai_score,ai_feedback').eq('attempt_id', state.attempt), 'rows');
  const r = (k) => rows.find((x) => x.question_id === state.q[k]);
  const out = Object.fromEntries(Object.keys(CASES).map((k) => [k, { ai_score: r(k)?.ai_score ?? null, feedback: r(k)?.ai_feedback ?? null }]));
  writeFileSync(new URL('grade-output.json', OUT), JSON.stringify(out, null, 1).replaceAll(CHILD.name, '[çocuk]') + '\n');
  check('d13_1_result_only_equivalent_answer_full_marks', r('result').ai_score >= 90, { ai_score: r('result').ai_score });
  check('d13_2_process_question_criteria_based_partial', r('process').ai_score >= 40 && r('process').ai_score <= 75, { ai_score: r('process').ai_score, expected: '≈60 (yarısı ölçütü), 2/4 ölçütü eksik' });
  check('d13_2_process_scored_below_result', r('process').ai_score < r('result').ai_score, { result: r('result').ai_score, process: r('process').ai_score });
  // Bilgi: alan yok → model sorudan çıkarır ("Kesir olarak yaz ve sadeleştir" → büyük olasılıkla süreç). Geçme koşulu değil.
  console.log('INFO d13_3_inferred_purpose', JSON.stringify({ ai_score: r('inferred').ai_score }));
  const g2 = await fn(parent, 'prova-grade', { attempt_id: state.attempt });
  logCall({ step: 'prova-grade D13 replay', paid: false, endpoint: 'prova-grade', response: { status: g2.status } });
  check('grade_replay_no_second_job', (await gradeJobs()) === pre + 1, { status: g2.status });
}

async function stageCleanup() {
  const parent = await session(state.email, state.password);
  const d = await fn(parent, 'delete-account', { confirm: true, password: state.password });
  check('parent_delete_account_ok', d.status === 200 && d.body.ok === true, { status: d.status, error: d.body.error });
  if (state.deviceUserId) {
    const r = await admin.auth.admin.deleteUser(state.deviceUserId, false);
    check('anonymous_device_user_deleted', !r.error);
  }
}

async function stageVerify() {
  for (const [i, id] of [state.userId, state.deviceUserId].filter(Boolean).entries()) {
    const r = await admin.auth.admin.getUserById(id);
    check(`auth_user_absent_${i}`, r.error?.status === 404 || !r.data?.user);
  }
  const counts = {};
  for (const t of ['families', 'family_members', 'children', 'devices', 'question_bank', 'prova_drafts', 'exams', 'exam_attempts', 'ai_operation_jobs', 'prova_ai_usage', 'ai_request_attempts', 'entitlement_overrides']) {
    const r = await admin.from(t).select('*', { count: 'exact', head: true }).eq(t === 'families' ? 'id' : 'family_id', state.familyId);
    counts[t] = r.error ? `error:${r.error.code}` : r.count;
  }
  check('family_scoped_rows_absent', Object.values(counts).every((v) => v === 0), { counts });
}

const stages = { setup: stageSetup, override: stageOverride, prova: stageProva, grade: stageGrade, cleanup: stageCleanup, verify: stageVerify };
if (!stages[stage]) throw Error('unknown_stage');
try { await stages[stage](); } catch (e) { check('stage_error', false, { message: String(e.message).slice(0, 200) }); }
finally { writeStage(); console.log(`paid calls so far: ${paidCount()}`); }
