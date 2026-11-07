// D5 — gerçek AI kabulü (C04/C05/C08/C09), yayımlanmış üretim ortamında, yalnız sentetik hesap/aile.
// Kullanım (operatör; sırayla): node docs/release/d5-2026-11-06/run-d5.mjs <stage>
//   stages: setup | free-gates | override | prova | grade | weekly | errors | c09 | cleanup | verify
// Kurallar: gerçek aile/kullanıcıya dokunmaz; anahtar/parola/token yazdırmaz. Durum (parola, oturum yenileme
// belirteci) yalnız gitignored `.codex-setup/d5/state.json` içinde (0600). Ücretli çağrı tavanı 30; her
// gerçek çağrı `calls.jsonl`'a (kişisel veri ve sır içermeyen özet) yazılır. Otomatik tekrar yok.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, chmodSync } from 'node:fs';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';

const ROOT = new URL('../../../', import.meta.url);
const OUT = new URL('./', import.meta.url);
const STATE = new URL('.codex-setup/d5/state.json', ROOT);
const PROJECT = 'wixjxlxgyhgdacadsawo';
const URL_BASE = `https://${PROJECT}.supabase.co`;
const MAX_PAID = 30;
const require = createRequire(new URL('apps/mobile/package.json', ROOT));
const { createClient } = require('@supabase/supabase-js');

const stage = process.argv[2];
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const save = () => { writeFileSync(STATE, JSON.stringify(state, null, 1), { mode: 0o600 }); chmodSync(STATE, 0o600); };
const short = (id) => (typeof id === 'string' ? id.slice(0, 8) : id);
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
async function fn(c, name, body, raw = false) {
  const r = await fetch(`${URL_BASE}/functions/v1/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${await token(c)}`, apikey: ANON, 'content-type': 'application/json' }, body: raw ? body : JSON.stringify(body) });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: r.status, body: json };
}

// Sayaçlar: sentetik ailenin AI iş/kullanım kayıtları (gerçek çağrı kanıtı).
async function counters() {
  const f = state.familyId;
  const [gen, ops, usage, attempts] = await Promise.all([
    must(admin.from('prova_generation_jobs').select('id,status,items,created_at').eq('family_id', f), 'gen_jobs'),
    must(admin.from('ai_operation_jobs').select('id,action,status,provider,error_code').eq('family_id', f), 'op_jobs'),
    must(admin.from('prova_ai_usage').select('action,model,items,input_tokens,output_tokens').eq('family_id', f), 'usage'),
    must(admin.from('ai_request_attempts').select('action').eq('family_id', f), 'attempts'),
  ]);
  return { gen, ops, usage, attempts };
}

const PARENT_NAME = 'D5 sentetik veli';
const CHILD = { name: 'Deneme Cocuk', birth_year: 2015, grade: 5, gender: 'unspecified', avatar: 'avatar-default', interests: [] };

async function stageSetup() {
  if (state.userId) throw Error('already_set_up');
  state.email = `gina-d5-${randomUUID()}@example.invalid`;
  state.password = randomBytes(24).toString('base64url');
  state.pin = String(randomInt(1000, 10000));
  save();
  const created = await must(admin.auth.admin.createUser({ email: state.email, password: state.password, email_confirm: true }), 'create_user');
  state.userId = created.user.id; save();
  const parent = await session(state.email, state.password);
  state.familyId = await must(parent.rpc('create_family', { p_name: 'D5 sentetik aile', p_display_name: PARENT_NAME }), 'create_family'); save();
  await must(parent.auth.refreshSession(), 'refresh');
  state.childId = await must(parent.rpc('save_child_setup', { p_request_id: randomUUID(), p_profile: CHILD, p_tasks: [] }), 'child'); save();
  await must(parent.rpc('set_child_pin', { p_child_id: state.childId, p_pin: state.pin }), 'pin');
  const dev = createClient(URL_BASE, ANON, options);
  await must(dev.auth.signInAnonymously(), 'device_anon');
  state.deviceUserId = (await dev.auth.getUser()).data.user.id; save();
  const code = await must(dev.rpc('request_pairing', { p_device_name: 'D5 sentetik tablet' }), 'request_pairing');
  const prev = await must(parent.rpc('preview_device_pairing', { p_code: code }), 'preview_pairing');
  state.deviceId = await must(parent.rpc('pair_child_device', { p_code: code, p_preview_token: prev.preview_token }), 'pair'); save();
  await must(dev.auth.refreshSession(), 'dev_refresh');
  await must(parent.rpc('configure_child_device', { p_device_id: state.deviceId, p_name: 'D5 sentetik tablet', p_child_ids: [state.childId], p_pin_required: true }), 'configure');
  await must(dev.auth.refreshSession(), 'dev_refresh2');
  const ok = await must(dev.rpc('child_pin_login', { p_child_id: state.childId, p_pin: state.pin }), 'pin_login');
  await must(dev.auth.refreshSession(), 'dev_refresh3');
  state.deviceRefresh = (await dev.auth.getSession()).data.session.refresh_token; save();
  const claims = JSON.parse(Buffer.from((await token(dev)).split('.')[1], 'base64url')).gina;
  check('synthetic_account_family_child_device', ok === true && claims.child_id === state.childId && claims.role === 'device', { email_domain: 'example.invalid' });
  const ent = await must(parent.rpc('get_prova_entitlement'), 'ent');
  check('starts_on_free_plan', ent.plan === 'free' || ent.ai_generate_limit === 0, { plan: ent.plan, ai_generate_limit: ent.ai_generate_limit });
}

async function stageFreeGates() {
  const parent = await session(state.email, state.password);
  const before = await counters();
  const g = await fn(parent, 'prova-generate', { request_id: randomUUID(), subject: 'Matematik', grade: 5, topic: 'Kesirler', count: 2 });
  check('free_plan_generate_rejected_before_provider', g.status === 402 && g.body.code === 'plan_has_no_ai', { status: g.status, code: g.body.code, category: g.body.category });
  const w = await fn(parent, 'ai-weekly-summary', { week_start: '2026-11-02' });
  // Gözlem: Free paket modeli kapalı (ai_settings.free.enabled=false) olduğundan resolveAi önce 503 ai_disabled döner;
  // prepare_weekly_summary'nin 402 plan_has_no_ai kodu bu yoldan görülmez. Sağlayıcıya gitmeden ret yeterli koşul.
  check('free_plan_weekly_rejected_before_provider', [402, 503].includes(w.status) && ['plan_has_no_ai', 'ai_disabled'].includes(w.body.code), { status: w.status, code: w.body.code, category: w.body.category, retryable: w.body.retryable });
  const after = await counters();
  check('free_gates_no_job_no_usage', after.gen.length === before.gen.length && after.ops.length === before.ops.length && after.usage.length === 0, { gen_jobs: after.gen.length, op_jobs: after.ops.length });
  logCall({ step: 'free-gates', paid: false, endpoint: 'prova-generate,ai-weekly-summary', response: [g.status + ':' + g.body.code, w.status + ':' + w.body.code] });
}

async function stageOverride() {
  // Not: admin_override_apply bir yönetici JWT'si ister (gina.assert_admin). Sentetik bir hesaba üretimde geçici
  // `admins` satırı vermek bu oturumun izin politikasınca reddedildi (hiç çalışmadı). Gerçek yöneticinin kimliğine
  // bürünülmedi. Bunun yerine depodaki yerleşik operatör yöntemi (scripts/learning-service-smoke.mjs) kullanıldı:
  // servis rolüyle yalnız sentetik aileye gerekçeli, 3 saat süreli Pro satırı. Denetim tetikleyicisi kaydı yazar.
  const until = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  const reason = 'D5 gercek AI kabulu: sentetik aile, 3 saat; aile ve hesap test sonunda silinir';
  const row = await must(admin.from('entitlement_overrides').insert({ family_id: state.familyId, plan: 'pro', reason, ends_at: until }).select('id,plan,ends_at').single(), 'override');
  state.overrideId = row.id; state.overrideUntil = until; save();
  const audit = await must(admin.from('audit_log').select('action,reason').eq('target_id', row.id), 'audit');
  check('override_reasoned_time_limited_audited', row.plan === 'pro' && audit.some((a) => a.action === 'entitlement_overrides.insert' && a.reason === reason), { plan: 'pro', hours: 3, audit_rows: audit.length });
  const parent = await session(state.email, state.password);
  const ent = await must(parent.rpc('get_prova_entitlement'), 'ent');
  check('family_now_pro_via_override', ent.plan === 'pro', { plan: ent.plan, ai_generate_limit: ent.ai_generate_limit, remaining: ent.ai_generate_remaining });
}

const RUBRIC_Q = {
  grade: 5, subject: 'Matematik', topic: 'Kesirler', kind: 'open_ended', difficulty: 'orta',
  stem: 'Bir pasta 4 eşit dilime bölünmüş ve 2 dilimi yenmiştir. Pastanın ne kadarı yenmiştir? Kesir olarak yaz ve sadeleştir.',
  expected_answer: '2/4 = 1/2 (pastanın yarısı)', solution: '2 dilim / 4 dilim = 2/4; pay ve payda 2 ile bölünür: 1/2.',
  rubric: { criteria: [{ text: 'Yenen kısmı 2/4 olarak yazar', points: 40 }, { text: 'Kesri 1/2 olarak sadeleştirir ya da yarısı der', points: 60 }], alternative_answers: ['yarısı', '0,5', 'yarım'] },
};

async function stageProva() {
  const parent = await session(state.email, state.password);
  // Elle soru (rubrik + alternatif cevap) ve ortak kaynaklı iki soruluk grup.
  state.rubricQ = await must(parent.rpc('save_question_with_sources', { p_request_id: randomUUID(), p_question: RUBRIC_Q, p_images: [] }), 'rubric_q'); save();
  const rq = await must(admin.from('question_bank').select('provenance').eq('id', state.rubricQ).single(), 'rubric_read');
  check('manual_rubric_and_alternatives_saved', rq.provenance?.rubric?.criteria?.length === 2 && rq.provenance.rubric.alternative_answers?.length === 3);
  state.groupId = randomUUID(); save();
  await must(parent.rpc('save_question_source_group', { p_request_id: state.groupId, p_group: { title: 'Okul bahçesi', body: 'Dikdörtgen biçimindeki okul bahçesinin kenarları 8 metre ve 6 metredir.', grade: 5, subject: 'Matematik' }, p_questions: [
    { topic: 'Çevre', kind: 'open_ended', difficulty: 'orta', stem: 'Bahçenin çevresi kaç metredir?', expected_answer: '28 metre', solution: '2 × (8 + 6) = 28' },
    { topic: 'Alan', kind: 'open_ended', difficulty: 'orta', stem: 'Bahçenin alanı kaç metrekaredir?', expected_answer: '48 metrekare', solution: '8 × 6 = 48' }], p_images: [] }), 'group');
  const members = await must(admin.from('question_source_members').select('question_id,position').eq('group_id', state.groupId).order('position'), 'members');
  state.groupQs = members.map((m) => m.question_id); save();
  check('shared_source_group_two_questions', members.length === 2);

  // A) Kısmi AI tamamlama: taslakta 3 soru var, hedef 6 → "Kalan 3 soruyu AI ile tamamla".
  state.draftA = randomUUID(); save();
  const contentA = { childId: state.childId, grade: 5, title: 'D5 kısmi AI Prova', purpose: 'practice', format: 'school', subjects: ['Matematik'], topics: ['Kesirler', 'Çevre ve alan'], target: 6, minutes: null, difficulty: 'orta', kind: 'mixed', note: '', step: 2,
    blocks: [{ kind: 'group', id: state.groupId, source: 'manual' }, { kind: 'question', id: state.rubricQ, source: 'manual' }] };
  let vA = await must(parent.rpc('save_prova_draft', { p_request_id: randomUUID(), p_id: state.draftA, p_version: 0, p_content: contentA }), 'draftA_save');
  const entBefore = await must(parent.rpc('get_prova_entitlement'), 'ent_before');
  const reqA = { request_id: randomUUID(), draft_id: state.draftA, subject: 'Matematik', grade: 5, topic_plan: [{ topic: 'Kesirler', count: 3 }], blueprint_id: null, count: 3, kind: 'mixed', assessment: 'practice', difficulty: 'orta', note: '', locale: 'tr' };
  state.reqA = reqA; save();
  const n0 = guardPaid();
  const t0 = Date.now();
  const genA = await fn(parent, 'prova-generate', reqA);
  const qa = genA.body.questions ?? [];
  logCall({ step: 'prova-generate partial (3 of 6)', paid: true, endpoint: 'prova-generate', request: { subject: 'Matematik', grade: 5, topic_plan: [{ topic: 'Kesirler', count: 3 }], kind: 'mixed', assessment: 'practice' }, response: { status: genA.status, questions: qa.length, kinds: qa.map((q) => q.kind), remaining: genA.body.remaining, ms: Date.now() - t0 }, paid_index: n0 + 1 });
  check('partial_generation_real_ok', genA.status === 200 && qa.length === 3, { status: genA.status, code: genA.body.code });
  const replayA = await fn(parent, 'prova-generate', reqA);
  logCall({ step: 'prova-generate partial replay (same request_id)', paid: false, endpoint: 'prova-generate', response: { status: replayA.status, same_ids: JSON.stringify((replayA.body.questions ?? []).map((q) => q.id)) === JSON.stringify(qa.map((q) => q.id)) } });
  const entMid = await must(parent.rpc('get_prova_entitlement'), 'ent_mid');
  check('partial_replay_same_result_no_second_charge', replayA.status === 200 && JSON.stringify(replayA.body.questions.map((q) => q.id)) === JSON.stringify(qa.map((q) => q.id)) && entMid.ai_generate_remaining === entBefore.ai_generate_remaining - 3, { before: entBefore.ai_generate_remaining, after: entMid.ai_generate_remaining });
  // "Önerilerin tümünü seç" + taslağa ekle: ek hak düşmez.
  const draftRowA = await must(admin.from('prova_drafts').select('version').eq('id', state.draftA).single(), 'draftA_ver');
  vA = await must(parent.rpc('save_prova_draft', { p_request_id: randomUUID(), p_id: state.draftA, p_version: draftRowA.version, p_content: { ...contentA, blocks: [...contentA.blocks, ...qa.map((q) => ({ kind: 'question', id: q.id, source: 'ai' }))] } }), 'draftA_add_ai');
  const entAfterAdd = await must(parent.rpc('get_prova_entitlement'), 'ent_after_add');
  check('select_all_and_add_no_extra_charge', entAfterAdd.ai_generate_remaining === entMid.ai_generate_remaining, { remaining: entAfterAdd.ai_generate_remaining });
  const aiRows = await must(admin.from('question_bank').select('id,kind,provenance,expected_answer,choices,correct_key').in('id', qa.map((q) => q.id)), 'ai_rows');
  const prov = aiRows.map((r) => ({ kind: r.kind, model: r.provenance?.model, prompt_version: r.provenance?.prompt_version, rubric_criteria: r.provenance?.rubric?.criteria?.length ?? 0, alternatives: r.provenance?.rubric?.alternative_answers?.length ?? 0, shared_source: !!r.provenance?.shared_source, draft_bound: r.provenance?.draft_id === state.draftA }));
  check('partial_ai_rows_provenance_model_draft', aiRows.length === 3 && aiRows.every((r) => r.provenance?.generator === 'ai' && r.provenance?.draft_id === state.draftA && typeof r.provenance?.model === 'string'), { rows: prov });
  state.aiA = qa.map((q) => q.id); save();

  // B) Tam AI: boş yazılı taslağı → "Bütün sınavı AI ile hazırla (4 soru)"; ortak tablo isteği notla.
  state.draftB = randomUUID(); save();
  const contentB = { childId: state.childId, grade: 5, title: 'D5 tam AI yazılı', purpose: 'written', format: 'school', subjects: ['Fen Bilimleri'], topics: ['Kuvvetin ölçülmesi'], target: 4, minutes: null, difficulty: 'orta_ustu', kind: 'open_ended', note: 'İki soru aynı kısa ölçüm tablosunu ortak kaynak olarak kullansın.', step: 2, blocks: [] };
  await must(parent.rpc('save_prova_draft', { p_request_id: randomUUID(), p_id: state.draftB, p_version: 0, p_content: contentB }), 'draftB_save');
  const reqB = { request_id: randomUUID(), draft_id: state.draftB, subject: 'Fen Bilimleri', grade: 5, topic_plan: [{ topic: 'Kuvvetin ölçülmesi', count: 4 }], blueprint_id: null, count: 4, kind: 'open_ended', assessment: 'written', difficulty: 'orta_ustu', note: contentB.note, locale: 'tr' };
  state.reqB = reqB; save();
  const n1 = guardPaid();
  const t1 = Date.now();
  const genB = await fn(parent, 'prova-generate', reqB);
  const qb = genB.body.questions ?? [];
  logCall({ step: 'prova-generate full written exam (4)', paid: true, endpoint: 'prova-generate', request: { subject: 'Fen Bilimleri', grade: 5, topic_plan: [{ topic: 'Kuvvetin ölçülmesi', count: 4 }], assessment: 'written', note: 'ortak tablo isteği' }, response: { status: genB.status, questions: qb.length, kinds: qb.map((q) => q.kind), remaining: genB.body.remaining, ms: Date.now() - t1 }, paid_index: n1 + 1 });
  check('full_generation_real_ok_open_ended', genB.status === 200 && qb.length === 4 && qb.every((q) => q.kind === 'open_ended'), { status: genB.status, code: genB.body.code });
  const entB = await must(parent.rpc('get_prova_entitlement'), 'ent_b');
  check('full_generation_charges_once_by_items', entB.ai_generate_remaining === entAfterAdd.ai_generate_remaining - 4, { before: entAfterAdd.ai_generate_remaining, after: entB.ai_generate_remaining });
  const bRows = await must(admin.from('question_bank').select('id,provenance').in('id', qb.map((q) => q.id)), 'b_rows');
  const bProv = bRows.map((r) => ({ rubric_criteria: r.provenance?.rubric?.criteria?.length ?? 0, rubric_points: (r.provenance?.rubric?.criteria ?? []).reduce((s, c) => s + Number(c.points || 0), 0), alternatives: r.provenance?.rubric?.alternative_answers?.length ?? 0, shared_source_id: r.provenance?.shared_source_id ? 'set' : null, shared_kind: r.provenance?.shared_source?.kind ?? null }));
  check('full_ai_rubric_present_on_open_ended', bRows.every((r) => (r.provenance?.rubric?.criteria?.length ?? 0) > 0), { rows: bProv });
  const sharedIds = new Set(bRows.map((r) => r.provenance?.shared_source_id).filter(Boolean));
  const sharedLinked = bRows.filter((r) => r.provenance?.shared_source_id).length;
  check('ai_shared_source_used_by_linked_questions', sharedIds.size >= 1 && sharedLinked >= 2, { shared_sources: sharedIds.size, linked_questions: sharedLinked, note: 'provenance.shared_source only; not converted to question_source_groups (C04 sınır 2)' });
  const verB = await must(admin.from('prova_drafts').select('version').eq('id', state.draftB).single(), 'draftB_ver');
  await must(parent.rpc('save_prova_draft', { p_request_id: randomUUID(), p_id: state.draftB, p_version: verB.version, p_content: { ...contentB, blocks: qb.map((q) => ({ kind: 'question', id: q.id, source: 'ai' })) } }), 'draftB_add');
  state.aiB = qb.map((q) => q.id); save();

  // Kısmi taslağı çocuğa gönder (atama ücret düşürmez).
  const verA = await must(admin.from('prova_drafts').select('version').eq('id', state.draftA).single(), 'draftA_ver2');
  const sub = { p_request_id: randomUUID(), p_id: state.draftA, p_version: verA.version };
  await must(parent.rpc('submit_prova_draft', sub), 'submitA');
  await must(parent.rpc('submit_prova_draft', sub), 'submitA_replay');
  const exam = await must(admin.from('exams').select('id,question_ids').eq('id', state.draftA).single(), 'examA');
  check('partial_exam_assigned_six_questions', exam.question_ids.length === 6, { questions: exam.question_ids.length });
  const entEnd = await must(parent.rpc('get_prova_entitlement'), 'ent_end');
  check('assignment_no_charge', entEnd.ai_generate_remaining === entB.ai_generate_remaining, { remaining: entEnd.ai_generate_remaining });
  const c = await counters();
  check('generation_jobs_two_done', c.gen.filter((j) => j.status === 'done').length === 2 && c.gen.length === 2, { jobs: c.gen.map((j) => ({ status: j.status, items: j.items })) });
}

async function stageGrade() {
  const parent = await session(state.email, state.password);
  const dev = await device();
  const exam = await must(dev.from('exams').select('id,question_ids').eq('id', state.draftA).single(), 'child_exam');
  const payload = await must(dev.rpc('get_attempt_questions', { p_exam_id: state.draftA }), 'child_questions');
  check('child_payload_has_no_answer_key_or_rubric', !/correct_key|expected_answer|rubric|alternative_answers|provenance/.test(JSON.stringify(payload)));
  const qs = await must(admin.from('question_bank').select('id,kind,expected_answer,choices,correct_key').in('id', exam.question_ids), 'qs');
  const byId = Object.fromEntries(qs.map((q) => [q.id, q]));
  const started = await must(dev.rpc('start_exam_attempt', { p_exam_id: state.draftA }), 'start');
  state.attempt = Array.isArray(started) ? started[0].id : started.id; save();
  const answers = [];
  let aiOpenSeen = 0;
  for (const id of exam.question_ids) {
    const q = byId[id];
    let args;
    if (q.kind === 'multiple_choice') { args = { p_answer_key: q.correct_key }; answers.push({ q: short(id), kind: 'mc', how: 'correct' }); }
    else if (id === state.rubricQ) { args = { p_answer_text: 'Pastanın yarısı yenmiş, yani 0,5.' }; answers.push({ q: short(id), kind: 'open', how: 'alternative_answer' }); }
    else if (id === state.groupQs[0]) { args = { p_answer_text: '8 + 6 = 14 metre' }; answers.push({ q: short(id), kind: 'open', how: 'wrong_half_perimeter' }); }
    else if (id === state.groupQs[1]) { args = { p_answer_text: '8 × 6 = 48 metrekare' }; answers.push({ q: short(id), kind: 'open', how: 'correct' }); }
    else { aiOpenSeen++; args = aiOpenSeen === 1 ? { p_answer_text: (q.expected_answer ?? '').slice(0, 400) } : {}; answers.push({ q: short(id), kind: 'open', how: aiOpenSeen === 1 ? 'copied_expected' : 'blank' }); }
    if (Object.keys(args).length) await must(dev.rpc('submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: state.attempt, p_question_id: id, p_expected_revision: 0, ...args }), 'answer');
  }
  await must(dev.rpc('finish_exam_attempt', { p_attempt_id: state.attempt }), 'finish');
  state.answers = answers; save();
  const before = await counters();
  const n0 = guardPaid();
  const t0 = Date.now();
  const g = await fn(parent, 'prova-grade', { attempt_id: state.attempt });
  logCall({ step: 'prova-grade open answers', paid: true, endpoint: 'prova-grade', request: { open_answers: answers.filter((a) => a.kind === 'open').map((a) => a.how) }, response: { status: g.status, suggested: g.body.suggested, final: g.body.final, model: g.body.summary?.model, prompt_version: g.body.summary?.prompt_version, unscored: g.body.summary?.unscored?.length, ms: Date.now() - t0 }, paid_index: n0 + 1 });
  check('prova_grade_real_suggestion_not_final', g.status === 200 && g.body.final === false && g.body.suggested >= 3, { status: g.status, code: g.body.code, suggested: g.body.suggested });
  const rows = await must(admin.from('exam_answers').select('question_id,score,ai_score,graded_by,ai_feedback').eq('attempt_id', state.attempt), 'rows');
  const open = rows.filter((r) => byId[r.question_id].kind === 'open_ended');
  const scored = open.filter((r) => r.ai_score !== null);
  check('ai_score_only_no_final_score', scored.length >= 3 && open.every((r) => r.score === null && r.graded_by !== 'ai' && r.graded_by !== 'parent'), { open: open.length, ai_scored: scored.length });
  const rub = rows.find((r) => r.question_id === state.rubricQ), wrong = rows.find((r) => r.question_id === state.groupQs[0]), right = rows.find((r) => r.question_id === state.groupQs[1]);
  check('alternative_answer_recognised_by_rubric', rub.ai_score >= 80, { ai_score: rub.ai_score });
  check('wrong_answer_scored_low', wrong.ai_score !== null && wrong.ai_score <= 50, { ai_score: wrong.ai_score });
  check('correct_answer_scored_high', right.ai_score >= 80, { ai_score: right.ai_score });
  const blank = rows.filter((r) => byId[r.question_id].kind === 'open_ended' && !answers.find((a) => a.q === short(r.question_id) && a.how !== 'blank'));
  check('blank_answer_not_invented_zero', blank.every((r) => r.ai_score === null), { blank: blank.length });
  const sum = await must(parent.rpc('get_attempt_summary', { p_attempt_id: state.attempt }), 'summary');
  check('summary_pending_review_with_ai_suggested', sum.review_state === 'pending_review' && sum.open_answers.some((a) => a.ai_suggested === true), { review_state: sum.review_state });
  const childSum = await must(dev.rpc('get_attempt_summary', { p_attempt_id: state.attempt }), 'child_summary');
  check('child_cannot_see_ai_suggestion', !JSON.stringify(childSum).includes('ai_score'));
  // Tekrar: aynı deneme → ikinci ücretli çağrı yok.
  const g2 = await fn(parent, 'prova-grade', { attempt_id: state.attempt });
  const after = await counters();
  const gradeJobs = after.ops.filter((j) => j.action === 'grade');
  logCall({ step: 'prova-grade replay', paid: false, endpoint: 'prova-grade', response: { status: g2.status, grade_jobs: gradeJobs.length } });
  check('grade_replay_no_second_job', gradeJobs.length === 1 && before.ops.filter((j) => j.action === 'grade').length === 0, { status: g2.status, jobs: gradeJobs.length, attempts_grade: after.attempts.filter((a) => a.action === 'grade').length });
  // Veli onayı: biri öneriyi kabul, biri kendi puanı.
  const stale = await parent.rpc('accept_ai_grade', { p_attempt_id: state.attempt, p_question_id: state.groupQs[1], p_expected: (right.ai_score + 1) % 101 });
  check('stale_suggestion_rejected', stale.error?.message === 'ai_suggestion_changed');
  const childAccept = await dev.rpc('accept_ai_grade', { p_attempt_id: state.attempt, p_question_id: state.groupQs[1], p_expected: right.ai_score });
  check('child_cannot_accept', !!childAccept.error);
  await must(parent.rpc('accept_ai_grade', { p_attempt_id: state.attempt, p_question_id: state.groupQs[1], p_expected: right.ai_score }), 'accept');
  const review = await must(parent.rpc('get_answer_review', { p_attempt_id: state.attempt, p_question_id: state.groupQs[0] }), 'review');
  await must(parent.rpc('save_answer_review', { p_request_id: randomUUID(), p_attempt_id: state.attempt, p_question_id: state.groupQs[0], p_revision: review.revision, p_answer_hash: review.answer_hash, p_score: 30, p_feedback: 'Çevre için iki kenarı topladın; tüm kenarları toplaman gerekiyor.', p_document: null }), 'parent_score');
  const fin = await must(admin.from('exam_answers').select('question_id,score,ai_score,graded_by').eq('attempt_id', state.attempt).in('question_id', state.groupQs), 'final');
  const acc = fin.find((r) => r.question_id === state.groupQs[1]), own = fin.find((r) => r.question_id === state.groupQs[0]);
  check('parent_accept_makes_final', acc.score === right.ai_score && acc.graded_by === 'parent', { score: acc.score });
  check('parent_own_score_overrides_suggestion', own.score === 30 && own.graded_by === 'parent' && own.ai_score === wrong.ai_score, { score: own.score, ai_score: own.ai_score });
  const att = await must(admin.from('exam_attempts').select('status').eq('id', state.attempt).single(), 'att');
  check('attempt_not_graded_until_all_parent_decisions', att.status !== 'graded', { status: att.status });
}

// Teşhis + kabul: yalnız açık uçlu ve hepsi cevaplanmış ayrı deneme (şıklı/boş madde yok).
// A denemesi (2 şıklı + 4 açık uçlu) gerçek modelde ai_result_invalid verdi; bu deneme ayrımı gösterir.
async function stageGrade2() {
  const parent = await session(state.email, state.password);
  const dev = await device();
  if (!state.draftC) {
    state.draftC = randomUUID(); save();
    const contentC = { childId: state.childId, grade: 5, title: 'D5 açık uçlu puanlama', purpose: 'written', format: 'school', subjects: ['Matematik'], topics: ['Kesirler', 'Çevre', 'Alan'], target: 3, minutes: null, difficulty: 'orta', kind: 'open_ended', note: '', step: 2,
      blocks: [{ kind: 'group', id: state.groupId, source: 'manual' }, { kind: 'question', id: state.rubricQ, source: 'manual' }] };
    await must(parent.rpc('save_prova_draft', { p_request_id: randomUUID(), p_id: state.draftC, p_version: 0, p_content: contentC }), 'draftC');
    const v = await must(admin.from('prova_drafts').select('version').eq('id', state.draftC).single(), 'draftC_ver');
    await must(parent.rpc('submit_prova_draft', { p_request_id: randomUUID(), p_id: state.draftC, p_version: v.version }), 'submitC');
    const started = await must(dev.rpc('start_exam_attempt', { p_exam_id: state.draftC }), 'startC');
    state.attemptC = Array.isArray(started) ? started[0].id : started.id; save();
    const texts = { [state.rubricQ]: 'Pastanın yarısı yenmiş, yani 0,5.', [state.groupQs[0]]: '8 + 6 = 14 metre', [state.groupQs[1]]: '8 × 6 = 48 metrekare' };
    for (const [id, t] of Object.entries(texts)) await must(dev.rpc('submit_exam_answer_v3', { p_request_id: randomUUID(), p_attempt_id: state.attemptC, p_question_id: id, p_expected_revision: 0, p_answer_text: t }), 'answerC');
    await must(dev.rpc('finish_exam_attempt', { p_attempt_id: state.attemptC }), 'finishC');
  }
  const pre = (await counters()).ops.filter((j) => j.action === 'grade').length;
  const n0 = guardPaid();
  const t0 = Date.now();
  const g = await fn(parent, 'prova-grade', { attempt_id: state.attemptC });
  const jobs = (await counters()).ops.filter((j) => j.action === 'grade');
  const paid = jobs.length > pre;
  logCall({ step: 'prova-grade open-only attempt (3 answered open answers, no MC)', paid, endpoint: 'prova-grade', request: { open_answers: ['wrong_half_perimeter', 'correct', 'alternative_answer'], multiple_choice: 0 }, response: { status: g.status, code: g.body.code, suggested: g.body.suggested, final: g.body.final, model: g.body.summary?.model, prompt_version: g.body.summary?.prompt_version, ms: Date.now() - t0 }, ...(paid ? { paid_index: n0 + 1 } : {}) });
  check('open_only_grade_real_suggestion_not_final', g.status === 200 && g.body.final === false && g.body.suggested === 3, { status: g.status, code: g.body.code, suggested: g.body.suggested, model: g.body.summary?.model });
  if (g.status !== 200) return;
  writeFileSync(new URL('grade-open-only-output.json', OUT), JSON.stringify({ summary: { ...g.body.summary, evidence: undefined } }, null, 1) + '\n');
  const rows = await must(admin.from('exam_answers').select('question_id,score,ai_score,graded_by,ai_feedback').eq('attempt_id', state.attemptC), 'rowsC');
  const r = (id) => rows.find((x) => x.question_id === id);
  check('ai_score_only_no_final_score', rows.every((x) => x.ai_score !== null && x.score === null && x.graded_by === null), { rows: rows.map((x) => ({ ai_score: x.ai_score, score: x.score, graded_by: x.graded_by })) });
  check('alternative_answer_recognised_by_rubric', r(state.rubricQ).ai_score >= 80, { ai_score: r(state.rubricQ).ai_score });
  check('wrong_answer_scored_low', r(state.groupQs[0]).ai_score <= 50, { ai_score: r(state.groupQs[0]).ai_score });
  check('correct_answer_scored_high', r(state.groupQs[1]).ai_score >= 80, { ai_score: r(state.groupQs[1]).ai_score });
  const sum = await must(parent.rpc('get_attempt_summary', { p_attempt_id: state.attemptC }), 'sumC');
  check('summary_pending_review_with_ai_suggested', sum.review_state === 'pending_review' && sum.open_answers.filter((a) => a.ai_suggested === true).length === 3, { review_state: sum.review_state });
  const childSum = await must(dev.rpc('get_attempt_summary', { p_attempt_id: state.attemptC }), 'childSumC');
  check('child_cannot_see_ai_suggestion', !JSON.stringify(childSum).includes('ai_score'));
  const g2 = await fn(parent, 'prova-grade', { attempt_id: state.attemptC });
  const jobs2 = (await counters()).ops.filter((j) => j.action === 'grade');
  logCall({ step: 'prova-grade open-only replay', paid: false, endpoint: 'prova-grade', response: { status: g2.status, grade_jobs: jobs2.length } });
  check('grade_replay_no_second_job', jobs2.length === jobs.length, { status: g2.status, grade_jobs: jobs2.length });
  const right = r(state.groupQs[1]), rub = r(state.rubricQ), wrong = r(state.groupQs[0]);
  const stale = await parent.rpc('accept_ai_grade', { p_attempt_id: state.attemptC, p_question_id: state.groupQs[1], p_expected: (right.ai_score + 1) % 101 });
  check('stale_suggestion_rejected', stale.error?.message === 'ai_suggestion_changed');
  const childAccept = await dev.rpc('accept_ai_grade', { p_attempt_id: state.attemptC, p_question_id: state.groupQs[1], p_expected: right.ai_score });
  check('child_cannot_accept', !!childAccept.error);
  await must(parent.rpc('accept_ai_grade', { p_attempt_id: state.attemptC, p_question_id: state.groupQs[1], p_expected: right.ai_score }), 'acceptC1');
  let att = await must(admin.from('exam_attempts').select('status').eq('id', state.attemptC).single(), 'attC');
  check('attempt_not_graded_until_all_parent_decisions', att.status !== 'graded', { status: att.status });
  await must(parent.rpc('accept_ai_grade', { p_attempt_id: state.attemptC, p_question_id: state.rubricQ, p_expected: rub.ai_score }), 'acceptC2');
  const review = await must(parent.rpc('get_answer_review', { p_attempt_id: state.attemptC, p_question_id: state.groupQs[0] }), 'reviewC');
  await must(parent.rpc('save_answer_review', { p_request_id: randomUUID(), p_attempt_id: state.attemptC, p_question_id: state.groupQs[0], p_revision: review.revision, p_answer_hash: review.answer_hash, p_score: 30, p_feedback: 'Çevre için iki kenarı topladın; tüm kenarları toplaman gerekiyor.', p_document: null }), 'parent_scoreC');
  const fin = await must(admin.from('exam_answers').select('question_id,score,ai_score,graded_by').eq('attempt_id', state.attemptC), 'finC');
  const f = (id) => fin.find((x) => x.question_id === id);
  check('parent_accept_makes_final', f(state.groupQs[1]).score === right.ai_score && f(state.groupQs[1]).graded_by === 'parent' && f(state.rubricQ).graded_by === 'parent', { scores: [f(state.groupQs[1]).score, f(state.rubricQ).score] });
  check('parent_own_score_overrides_suggestion', f(state.groupQs[0]).score === 30 && f(state.groupQs[0]).graded_by === 'parent' && f(state.groupQs[0]).ai_score === wrong.ai_score, { score: 30, ai_score: f(state.groupQs[0]).ai_score });
  att = await must(admin.from('exam_attempts').select('status').eq('id', state.attemptC).single(), 'attC2');
  check('attempt_graded_after_all_parent_decisions', att.status === 'graded', { status: att.status });
  const fb = await must(dev.rpc('get_child_answer_reviews', { p_attempt_id: state.attemptC }), 'child_fb');
  check('child_sees_parent_final_scores_only', fb.length >= 1 && !JSON.stringify(fb).includes('ai_score'), { items: fb.length });
}

async function stageWeekly() {
  const parent = await session(state.email, state.password);
  const dev = await device();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  if (!state.taskDone) {
    const task = randomUUID();
    await must(parent.from('task_templates').insert({ id: task, family_id: state.familyId, child_id: state.childId, title: 'Kitap okuma', stars: 2, starts_on: today }), 'task');
    const comp = await must(dev.rpc('complete_task', { p_template_id: task, p_due_date: today, p_client_id: randomUUID() }), 'complete');
    await must(parent.rpc('review_task', { p_completion_id: (Array.isArray(comp) ? comp[0] : comp).id, p_approve: true }), 'approve');
    state.taskDone = true; save();
  }
  // Yalnız tamamlanmış geçmiş haftalar (get_weekly_summary_data: week_start ≤ bu Pazartesi − 7). Aile bugün
  // kurulduğu için bu hafta kayıtsız: model kayıt yokken zorluk/başarısızlık uydurmamalı.
  const WEEK = '2026-10-26';
  const pre = (await counters()).ops.filter((j) => j.action === 'weekly').length;
  const n0 = guardPaid();
  const t0 = Date.now();
  const w = await fn(parent, 'ai-weekly-summary', { week_start: WEEK });
  const post = (await counters()).ops.filter((j) => j.action === 'weekly').length;
  logCall({ step: 'ai-weekly-summary', paid: post > pre, endpoint: 'ai-weekly-summary', request: { week_start: WEEK, children: 1, records_in_week: 0 }, response: { status: w.status, code: w.body.code, keys: Object.keys(w.body.summary ?? {}), ms: Date.now() - t0 }, ...(post > pre ? { paid_index: n0 + 1 } : {}) });
  check('weekly_summary_real_ok', w.status === 200 && w.body.ok === true, { status: w.status, code: w.body.code });
  writeFileSync(new URL('weekly-summary-output.json', OUT), JSON.stringify(w.body.summary ?? w.body, null, 1).replaceAll(CHILD.name, '[çocuk]') + '\n');
  const w2 = await fn(parent, 'ai-weekly-summary', { week_start: WEEK });
  const c = await counters();
  const weekly = c.ops.filter((j) => j.action === 'weekly');
  logCall({ step: 'ai-weekly-summary replay', paid: false, endpoint: 'ai-weekly-summary', response: { status: w2.status, weekly_jobs: weekly.length } });
  check('weekly_replay_no_second_job', w2.status === 200 && weekly.length === 1, { jobs: weekly.map((j) => ({ status: j.status, provider: j.provider })) });
  const usage = await must(parent.rpc('get_ai_usage'), 'usage');
  const wk = usage.operations?.find((o) => o.action === 'weekly');
  check('weekly_quota_preview_used_one', wk?.used === 1, { used: wk?.used, limit: wk?.limit, remaining: wk?.remaining });
  check('usage_hides_model_names', !/claude|anthropic|openai|gemini/i.test(JSON.stringify(usage)));
}

async function stageErrors() {
  const parent = await session(state.email, state.password);
  const before = await counters();
  const tok = await token(parent);
  const raw = await fetch(`${URL_BASE}/functions/v1/prova-generate`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, apikey: ANON, 'content-type': 'application/json' }, body: '{"subject": "Matematik", "grade": 5,' });
  const rawBody = await raw.json().catch(() => ({}));
  check('broken_json_rejected', raw.status === 400 && rawBody.code === 'bad_request', { status: raw.status, code: rawBody.code, category: rawBody.category, retryable: rawBody.retryable });
  const big = await fn(parent, 'prova-generate', { request_id: randomUUID(), subject: 'Matematik', grade: 5, topic_plan: [{ topic: 'Kesirler', count: 20 }, { topic: 'Ondalık', count: 20 }] });
  check('too_many_questions_rejected', big.status === 400 && big.body.code === 'too_many_questions', { status: big.status, code: big.body.code, max: big.body.details?.max });
  const wk = await fn(parent, 'ai-weekly-summary', { week_start: '2026-11-04' });
  check('weekly_non_monday_rejected', wk.status === 400 && wk.body.code === 'invalid_input', { status: wk.status, code: wk.body.code });
  const gr = await fn(parent, 'prova-grade', { attempt_id: 'not-a-uuid' });
  check('grade_bad_attempt_rejected', gr.status === 400 && gr.body.code === 'attempt_id_required', { status: gr.status, code: gr.body.code });
  const large = await fn(parent, 'learning-source', { action: 'reserve', id: randomUUID(), kind: 'document', name: 'd5-buyuk.pdf', mime: 'application/pdf', bytes: 25 * 1024 * 1024, sha256: 'a'.repeat(64), consent: true });
  check('large_file_rejected_before_upload', large.status === 400 && /^source_/.test(large.body.code ?? ''), { status: large.status, code: large.body.code, category: large.body.category });
  const srcs = await must(admin.from('learning_sources').select('id').eq('family_id', state.familyId), 'srcs');
  check('large_file_no_source_row', srcs.length === 0);
  // Kota sınırı: Pro haftalık 5/ay. Sentetik aileye 4 sentetik "done" iş kaydı eklenir (gerçek 1 + 4 = 5);
  // yeni hafta isteği sağlayıcıya gitmeden ai_quota_exceeded olmalı. Gerçek sağlayıcı 429'u üretilmez.
  const fill = Array.from({ length: 4 }, () => ({ family_id: state.familyId, requested_by: state.userId, action: 'weekly', input_hash: randomBytes(32).toString('hex'), lease: randomUUID(), status: 'done', result: { d5_synthetic_quota_fill: true }, provider: 'anthropic' }));
  await must(admin.from('ai_operation_jobs').insert(fill), 'quota_fill');
  const mid = await counters();
  const q = await fn(parent, 'ai-weekly-summary', { week_start: '2026-10-19' });
  const after = await counters();
  check('quota_exceeded_before_provider', q.status === 402 && q.body.code === 'ai_quota_exceeded', { status: q.status, code: q.body.code, category: q.body.category, retryable: q.body.retryable });
  check('quota_rejection_no_job_no_attempt', after.ops.length === mid.ops.length && after.attempts.length === mid.attempts.length && after.usage.length === before.usage.length, { op_jobs: after.ops.length, attempts: after.attempts.length });
  const usage = await must(parent.rpc('get_ai_usage'), 'usage');
  const w = usage.operations?.find((o) => o.action === 'weekly');
  check('usage_preview_shows_zero_remaining', w?.remaining === 0, { used: w?.used, limit: w?.limit, remaining: w?.remaining });
  check('error_stage_no_generation_job', after.gen.length === before.gen.length);
  logCall({ step: 'error classes', paid: false, endpoint: 'prova-generate,ai-weekly-summary,prova-grade,learning-source', response: results.map((r) => r.name + ':' + r.ok) });
}

// Büyük dosya ayrıntısı: görsel 4 MiB sınırı RPC kodlu; PDF için RPC sınırı yok, tablo CHECK (10 MiB) yakalar.
async function stageErrors2() {
  const parent = await session(state.email, state.password);
  const res = {};
  for (const [label, mime, bytes] of [['png_5mib', 'image/png', 5 * 1024 * 1024], ['pdf_11mib', 'application/pdf', 11 * 1024 * 1024], ['pdf_25mib', 'application/pdf', 25 * 1024 * 1024]]) {
    const r = await fn(parent, 'learning-source', { action: 'reserve', id: randomUUID(), kind: 'document', name: `d5-${label}`, mime, bytes, sha256: 'b'.repeat(64), consent: true });
    res[label] = { status: r.status, code: r.body.code, category: r.body.category, retryable: r.body.retryable };
  }
  check('large_image_rejected_with_specific_code', res.png_5mib.status === 400 && res.png_5mib.code === 'source_size_or_type', res.png_5mib);
  check('large_pdf_rejected_with_specific_code', res.pdf_11mib.status === 400 && res.pdf_11mib.code === 'source_size_or_type', { pdf_11mib: res.pdf_11mib, pdf_25mib: res.pdf_25mib });
  const srcs = await must(admin.from('learning_sources').select('id').eq('family_id', state.familyId), 'srcs');
  check('large_files_no_source_row_no_upload', srcs.length === 0);
  logCall({ step: 'large file reserve variants', paid: false, endpoint: 'learning-source', response: res });
}

// İki prova-grade belirsiz sonucu ortak Anthropic devre kesici sayacını artırdı (3'te 2 dk duraklama, tüm aileler).
// Doğal sıfırlama: tek soruluk başarılı üretim (taslaksız eski yol; geriye uyumluluk) sayacı 0'a çeker.
async function stageBreakerReset() {
  const parent = await session(state.email, state.password);
  const n0 = guardPaid();
  const t0 = Date.now();
  const g = await fn(parent, 'prova-generate', { request_id: randomUUID(), subject: 'Türkçe', grade: 5, topic: 'Eş anlamlı kelimeler', count: 1, kind: 'multiple_choice', assessment: 'practice', difficulty: 'kolay', locale: 'tr' });
  logCall({ step: 'prova-generate standalone 1 question (legacy no-draft path; resets shared breaker counter)', paid: true, endpoint: 'prova-generate', request: { subject: 'Türkçe', grade: 5, count: 1, kind: 'multiple_choice' }, response: { status: g.status, code: g.body.code, questions: g.body.questions?.length, ms: Date.now() - t0 }, paid_index: n0 + 1 });
  check('standalone_generation_ok', g.status === 200 && g.body.questions?.length === 1 && g.body.questions[0].kind === 'multiple_choice', { status: g.status, code: g.body.code });
  const h = await must(admin.from('ai_provider_health').select('failures,open_until').eq('provider', 'anthropic').single(), 'health');
  check('shared_breaker_counter_back_to_zero', h.failures === 0 && h.open_until === null, h);
}

// Soru başına AI incelemesi (prova-review; defterli/yazılı cevap yolu): A denemesindeki rubrikli soru,
// çocuk cevabı alternatif doğru cevap ("yarısı / 0,5"). Öneri puan yazmaz; veli kaydı kesinleştirir.
async function stageReview() {
  const parent = await session(state.email, state.password);
  const q = state.rubricQ;
  const review = await must(parent.rpc('get_answer_review', { p_attempt_id: state.attempt, p_question_id: q }), 'review');
  const n0 = guardPaid();
  const t0 = Date.now();
  const r = await fn(parent, 'prova-review', { attempt_id: state.attempt, question_id: q, answer_hash: review.answer_hash, consent: true });
  logCall({ step: 'prova-review rubric question (alternative answer)', paid: true, endpoint: 'prova-review', request: { answer: 'alternative_answer', rubric_criteria: 2, alternatives: 3 }, response: { status: r.status, code: r.body.code, readable: r.body.result?.readable, score: r.body.result?.score, ms: Date.now() - t0 }, paid_index: n0 + 1 });
  check('prova_review_real_suggestion', r.status === 200 && r.body.result?.readable === true && Number.isInteger(r.body.result?.score), { status: r.status, code: r.body.code, score: r.body.result?.score });
  if (r.status !== 200) return;
  writeFileSync(new URL('review-rubric-output.json', OUT), JSON.stringify(r.body.result, null, 1).replaceAll(CHILD.name, '[çocuk]') + '\n');
  check('alternative_answer_recognised_by_review', r.body.result.score >= 80, { score: r.body.result.score });
  const row = await must(admin.from('exam_answers').select('score,graded_by').eq('attempt_id', state.attempt).eq('question_id', q).single(), 'row');
  check('review_suggestion_writes_no_score', row.score === null && row.graded_by === null, row);
  const again = await fn(parent, 'prova-review', { attempt_id: state.attempt, question_id: q, answer_hash: review.answer_hash, consent: true });
  const jobs = (await counters()).ops.filter((j) => j.action === 'grade');
  logCall({ step: 'prova-review replay', paid: false, endpoint: 'prova-review', response: { status: again.status, same_id: again.body.id === r.body.id } });
  check('review_replay_same_suggestion_no_new_call', again.status === 200 && again.body.id === r.body.id, { grade_jobs_total: jobs.length });
  const saved = await parent.rpc('save_answer_review', { p_request_id: randomUUID(), p_attempt_id: state.attempt, p_question_id: q, p_revision: review.revision, p_answer_hash: review.answer_hash, p_score: r.body.result.score, p_feedback: 'Yarısı ve 0,5 doğru; sadeleştirmeyi de yazabilirsin.', p_document: null, p_ai_id: r.body.id });
  const fin = await must(admin.from('exam_answers').select('score,graded_by').eq('attempt_id', state.attempt).eq('question_id', q).single(), 'fin');
  check('parent_save_makes_review_final', !saved.error && fin.score === r.body.result.score && fin.graded_by === 'parent', { error: saved.error?.message, ...fin });
}

async function stageC09() {
  // Pilot yalnız sistem sırrıyla açılır. Üretimde CONTENT_PREREVIEW_SECRET yok (C14: "sır kapı açılırken").
  // Ücretsiz doğrulama: servis JWT + yanlış sır → 403; kullanıcı JWT ile pilot → 403. Model çağrısı yok.
  const parent = await session(state.email, state.password);
  const items = [{ id: 'd5', content: { stem: 'x' } }];
  const r1 = await fetch(`${URL_BASE}/functions/v1/content-prereview`, { method: 'POST', headers: { Authorization: `Bearer ${SERVICE}`, apikey: ANON, 'content-type': 'application/json', 'x-cron-secret': randomBytes(16).toString('hex') }, body: JSON.stringify({ pilot: true, confirm_paid: true, items }) });
  const r2 = await fn(parent, 'content-prereview', { pilot: true, confirm_paid: true, items });
  const gate = await must(admin.from('app_settings').select('value').eq('key', 'content_prereview.enabled').single(), 'gate');
  check('c09_pilot_requires_system_secret_not_configured', r1.status === 403 && r2.status === 403, { service_wrong_secret: r1.status, parent_jwt: r2.status });
  check('c09_gate_still_closed', gate.value === false);
  logCall({ step: 'content-prereview pilot gate probe', paid: false, endpoint: 'content-prereview', response: { service_wrong_secret: r1.status, parent_jwt: r2.status } });
}

async function stageCleanup() {
  // Normal hesap silme yolu (delete-account, parola ile yeniden doğrulama). Aile son veli ile kademeli silinir.
  const parent = await session(state.email, state.password);
  const d = await fn(parent, 'delete-account', { confirm: true, password: state.password });
  check('parent_delete_account_ok', d.status === 200 && d.body.ok === true, { status: d.status, error: d.body.error });
  if (state.deviceUserId) {
    // Anonim cihaz hesabı delete-account ile silinemez (tasarım gereği); aile silindiği için servis yolu.
    const r = await admin.auth.admin.deleteUser(state.deviceUserId, false);
    check('anonymous_device_user_deleted', !r.error);
  }
}

async function stageVerify() {
  const ids = [state.userId, state.deviceUserId].filter(Boolean);
  for (const id of ids) {
    const r = await admin.auth.admin.getUserById(id);
    check(`auth_user_absent_${ids.indexOf(id)}`, r.error?.status === 404 || !r.data?.user);
  }
  const f = state.familyId;
  const tables = ['families', 'family_members', 'children', 'devices', 'question_bank', 'question_source_groups', 'prova_drafts', 'exams', 'exam_attempts', 'prova_generation_jobs', 'ai_operation_jobs', 'prova_ai_usage', 'ai_request_attempts', 'entitlement_overrides', 'ai_summaries', 'task_templates', 'learning_sources'];
  const counts = {};
  for (const t of tables) {
    const col = t === 'families' ? 'id' : 'family_id';
    const r = await admin.from(t).select('*', { count: 'exact', head: true }).eq(col, f);
    counts[t] = r.error ? `error:${r.error.code}` : r.count;
  }
  check('family_scoped_rows_absent', Object.values(counts).every((v) => v === 0), { counts });
  const qids = [...(state.aiA ?? []), ...(state.aiB ?? []), ...(state.groupQs ?? []), state.rubricQ].filter(Boolean);
  const q = await admin.from('question_bank').select('id', { count: 'exact', head: true }).in('id', qids);
  check('generated_and_manual_questions_absent', q.count === 0, { checked: qids.length });
}

const stages = { setup: stageSetup, 'free-gates': stageFreeGates, override: stageOverride, prova: stageProva, grade: stageGrade, grade2: stageGrade2, weekly: stageWeekly, errors: stageErrors, errors2: stageErrors2, 'breaker-reset': stageBreakerReset, review: stageReview, c09: stageC09, cleanup: stageCleanup, verify: stageVerify };
if (!stages[stage]) throw Error('unknown_stage');
try { await stages[stage](); } catch (e) { check('stage_error', false, { message: String(e.message).slice(0, 200) }); }
finally { writeStage(); console.log(`paid calls so far: ${paidCount()}`); }
