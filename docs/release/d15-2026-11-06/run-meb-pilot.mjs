// D15 — MEB gerçek kabul zinciri pilotu (OYSS 2026–27 / 1. dönem / 1. yazılı / 5. sınıf Türkçe, tek senaryo).
// Zincir: resmî ÖDSGM dizini → sunucuda indirme (curriculum-source-fetch) → revizyon/hash → çıkarım (işletim adımı)
// → aday → kaynak onayı + aday incelemesi + ayrı yayın → (D15) sentetik ailenin pilot kapsamı → aile seçimi
// (dondurulmuş kopya) → yazılı taslağı → prova-generate (senaryo blokları/çıktıları) → provenance
// (scenario_version/block_id/outcome_ids/source_sha256) → deterministik adet/tür denetimi → çocuğa atama.
//
// Kullanım (sırayla, her aşama ayrı çağrılır; otomatik tekrar yok):
//   node docs/release/d15-2026-11-06/run-meb-pilot.mjs <stage> [flags]
//   stages: preflight | setup | override | admin-setup | source | extract | review | scope | select | generate |
//           assign | cleanup | verify
//   Üretim: her çağrıda `--prod` zorunlu (yanlışlıkla canlıya gitmeyi önler).
//   Yerel:  GINA_MEB_PILOT_TARGET=local (yalnız `python3 scripts/test-isolated-services.py --run-local --meb-pilot`).
//   Bayraklar: --allow-temp-admin (admin-setup: geçici sentetik yönetici; ÜRETİMDE Enes onayı şart)
//              --reviewed-by-enes (review: kaynak onayı/aday incelemesi/yayın betikten yapılır; ÜRETİMDE Enes'in
//                                  hücreleri resmî dosyayla gerçekten karşılaştırdığını beyanı. Yoksa aşama yalnız
//                                  backoffice'te yapılmış kararı doğrular)
//              --withdraw (cleanup: pilot için yayımlanan adayı geri çek; üretimde Enes kararı)
//              --allow-cleanup-without-review-package (cleanup: H03 inceleme paketi tam değilse bile temizle; yalnız
//                                  bilinçli operatör kararı, sonuç raporda `review_package_gate_overridden` olarak görünür)
// H03: `generate` üretilen soruları temizlikten ÖNCE taşınabilir inceleme paketine yazar (`review-package/`:
// tam kök, tür/şıklar, ortak kaynak, gömülü görseller, cevap, rubrik, kazanım, kaynak izi). `cleanup` paket
// çevrimdışı tam açılmadıkça hiçbir şeyi silmez (paket eksikse ve sorular hâlâ duruyorsa önce yeniden dışa aktarır).
// Kurallar: gerçek aile/kullanıcıya dokunmaz; sentetik hesaplar `@example.invalid`. Anahtar/parola/token yazdırmaz;
// durum yalnız gitignored `.codex-setup/d15/meb-pilot-state.json` (0600) içinde. Ücretli çağrı tavanı 3
// (`calls.jsonl`, kişisel veri/sır yok). Global `curriculum_catalog.enabled` anahtarı DEĞİŞTİRİLMEZ.
import { readPilotState, savePilotState } from '../../../scripts/pilot-state.mjs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomInt, randomUUID, createHash } from 'node:crypto';

const ROOT = new URL('../../../', import.meta.url);
const LOCAL = process.env.GINA_MEB_PILOT_TARGET === 'local';
const argv = process.argv.slice(2);
const stage = argv[0];
const flag = (name) => argv.includes(name);
if (!LOCAL && !flag('--prod')) throw Error('explicit_--prod_required (or GINA_MEB_PILOT_TARGET=local from the isolated runner)');
// H03: a later live run can write to its own repo-relative directory (GINA_MEB_PILOT_LIVE_OUT) instead of D15's `live/`.
const OUT = LOCAL ? new URL(`file://${process.env.GINA_MEB_PILOT_OUT}/`) : process.env.GINA_MEB_PILOT_LIVE_OUT ? new URL(`${process.env.GINA_MEB_PILOT_LIVE_OUT.replace(/\/?$/, '/')}`, ROOT) : new URL('./live/', import.meta.url);
const STATE = LOCAL ? new URL(`file://${process.env.GINA_MEB_PILOT_STATE}`) : new URL('.codex-setup/d15/meb-pilot-state.json', ROOT);
mkdirSync(OUT, { recursive: true });
mkdirSync(new URL('./', STATE), { recursive: true });
const MAX_PAID = 3;
const PROJECT = 'wixjxlxgyhgdacadsawo';
const require = createRequire(new URL('apps/mobile/package.json', ROOT));
const { createClient } = require('@supabase/supabase-js');
const { collectReviewPackage, scenarioFrom, writeReviewPackage, openReviewPackage } = await import(new URL('scripts/question-review-package.mjs', ROOT));
const REVIEW_DIR = new URL('review-package/', OUT).pathname;

let URL_BASE, SERVICE, ANON;
if (LOCAL) {
  URL_BASE = process.env.GINA_MEB_PILOT_URL; SERVICE = process.env.GINA_QA_SERVICE; ANON = process.env.GINA_QA_ANON;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(URL_BASE ?? '') || !SERVICE || !ANON) throw Error('isolated_runner_required');
} else {
  URL_BASE = `https://${PROJECT}.supabase.co`;
  const cli = spawnSync('pnpm', ['exec', 'supabase', 'projects', 'api-keys', '--project-ref', PROJECT, '--output', 'json'], { encoding: 'utf8', cwd: ROOT.pathname });
  if (cli.status !== 0) throw Error('credential_lookup_failed');
  const keys = JSON.parse(cli.stdout);
  SERVICE = keys.find((k) => k.name === 'service_role')?.api_key;
  ANON = keys.find((k) => k.name === 'anon')?.api_key;
  if (!SERVICE || !ANON) throw Error('credentials_unavailable');
}
const state = readPilotState(STATE);
const save = () => savePilotState(STATE, state);
const short = (id) => (typeof id === 'string' ? id.slice(0, 8) : id);
const now = () => new Date().toISOString();
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL_BASE, SERVICE, options);
const must = async (p, label) => { const r = await p; if (r.error) throw Error(`${label}: ${r.error.message ?? r.error.code ?? 'error'}`); return r.data; };

// Hedef: tam yıl/dönem/yazılı/sınıf/ders. Başka yıl/dönem asla ikame edilmez.
const SCOPE = { exam_family: 'oyss', school_year: '2026-2027', term: 1, subject: 'Türkçe', grade: 5 };
const EXAM_NO = 1;
const CANDIDATE_KEY = process.env.GINA_MEB_PILOT_CANDIDATE || 'tr-2026-2027-t1-turkce2-g5-c6';
const MANIFEST = JSON.parse(readFileSync(new URL('docs/learning/catalog/2026-2027-term1/sources/manifest.json', ROOT), 'utf8'));
const OFFICIAL = MANIFEST.find((e) => e.file === 'turkce2.xlsx');
const PARENT_NAME = 'D15 sentetik veli';
const CHILD = { name: 'Deneme Cocuk', birth_year: 2015, grade: 5, gender: 'unspecified', avatar: 'avatar-default', interests: [] };

const results = [];
const check = (name, ok, detail = {}) => { results.push({ name, ok: !!ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, Object.keys(detail).length ? JSON.stringify(detail) : ''); return !!ok; };
const require_ = (name, ok, detail = {}) => { if (!check(name, ok, detail)) throw Error('stop:' + name); };
const writeStage = () => writeFileSync(new URL(`stage-${stage}.json`, OUT), JSON.stringify({ stage, target: LOCAL ? 'local-isolated' : 'production', at: now(), checks: results }, null, 1) + '\n');

function calls() {
  const f = new URL('calls.jsonl', OUT);
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}
const paidCount = () => calls().filter((c) => c.paid).length;
const logCall = (entry) => appendFileSync(new URL('calls.jsonl', OUT), JSON.stringify({ at: now(), provider: LOCAL ? 'deterministic-local' : 'production', ...entry }) + '\n');
function guardPaid() { const n = paidCount(); if (n >= MAX_PAID) throw Error('paid_call_cap_reached'); return n; }

async function session(email, password) {
  const c = createClient(URL_BASE, ANON, options);
  await must(c.auth.signInWithPassword({ email, password }), 'sign_in');
  return c;
}
const token = async (c) => (await c.auth.getSession()).data.session.access_token;
async function device() {
  const c = createClient(URL_BASE, ANON, options);
  await must(c.auth.refreshSession({ refresh_token: state.deviceRefresh }), 'device_refresh');
  state.deviceRefresh = (await c.auth.getSession()).data.session.refresh_token; save();
  return c;
}
async function adminSession() {
  if (state.adminEmail) return session(state.adminEmail, state.adminPassword);
  const t = process.env.GINA_ADMIN_ACCESS_TOKEN;
  if (!t) throw Error('admin_session_required: run admin-setup --allow-temp-admin (approved) or export GINA_ADMIN_ACCESS_TOKEN');
  const c = createClient(URL_BASE, ANON, { ...options, global: { headers: { Authorization: `Bearer ${t}` } } });
  c.__token = t;
  return c;
}
const bearer = async (c) => c.__token ?? token(c);
async function fn(c, name, body) {
  const r = await fetch(`${URL_BASE}/functions/v1/${name}`, { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${await bearer(c)}`, apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: r.status, body: json };
}
const rpc = (c, name, args = {}) => must(c.rpc(name, args), name);
const qaStats = async () => (LOCAL ? (await fetch(process.env.GINA_MEB_PILOT_QA_STATS)).json() : null);

// ---- 0. Salt okunur ön kontrol (ücretsiz). ----
async function stagePreflight() {
  const probe = await admin.rpc('get_curriculum_pilot_family', { p_family_id: randomUUID() });
  require_('pilot_scope_migration_deployed', !probe.error, { error: probe.error?.code });
  check('global_catalog_switch_off', probe.data.catalog_enabled === false, { catalog_enabled: probe.data.catalog_enabled });
  const plan = await must(admin.from('plans').select('code,prova_scenarios,prova_ai_generate_monthly').eq('code', 'pro').single(), 'plan');
  check('pro_plan_has_scenarios_and_ai', plan.prova_scenarios === true && plan.prova_ai_generate_monthly > 0, plan);
  const health = await admin.from('ai_provider_health').select('provider,failures,open_until');
  check('provider_breakers_closed', !health.error && (health.data ?? []).every((h) => !h.open_until), { providers: (health.data ?? []).map((h) => ({ p: h.provider, f: h.failures, open: !!h.open_until })) });
  check('official_manifest_entry_present', !!OFFICIAL?.sha256, { file: 'turkce2.xlsx', sha256: OFFICIAL?.sha256?.slice(0, 12), bytes: OFFICIAL?.bytes });
  check('paid_calls_so_far_within_cap', paidCount() < MAX_PAID, { paid: paidCount(), cap: MAX_PAID });
}

// ---- 1. Sentetik veli/aile/çocuk/tablet (c14b yöntemi). ----
async function stageSetup() {
  if (state.userId) throw Error('already_set_up');
  state.email = `gina-d15-${randomUUID()}@example.invalid`;
  state.password = randomBytes(24).toString('base64url');
  state.pin = String(randomInt(1000, 10000));
  save();
  const created = await must(admin.auth.admin.createUser({ email: state.email, password: state.password, email_confirm: true }), 'create_user');
  state.userId = created.user.id; save();
  const parent = await session(state.email, state.password);
  state.familyId = await rpc(parent, 'create_family', { p_name: 'D15 sentetik aile', p_display_name: PARENT_NAME }); save();
  await must(parent.auth.refreshSession(), 'refresh');
  state.childId = await rpc(parent, 'save_child_setup', { p_request_id: randomUUID(), p_profile: CHILD, p_tasks: [] }); save();
  await rpc(parent, 'set_child_pin', { p_child_id: state.childId, p_pin: state.pin });
  const dev = createClient(URL_BASE, ANON, options);
  await must(dev.auth.signInAnonymously(), 'device_anon');
  state.deviceUserId = (await dev.auth.getUser()).data.user.id; save();
  const code = await rpc(dev, 'request_pairing', { p_device_name: 'D15 sentetik tablet' });
  const prev = await rpc(parent, 'preview_device_pairing', { p_code: code });
  state.deviceId = await rpc(parent, 'pair_child_device', { p_code: code, p_preview_token: prev.preview_token }); save();
  await must(dev.auth.refreshSession(), 'dev_refresh');
  await rpc(parent, 'configure_child_device', { p_device_id: state.deviceId, p_name: 'D15 sentetik tablet', p_child_ids: [state.childId], p_pin_required: true });
  await must(dev.auth.refreshSession(), 'dev_refresh2');
  const ok = await rpc(dev, 'child_pin_login', { p_child_id: state.childId, p_pin: state.pin });
  await must(dev.auth.refreshSession(), 'dev_refresh3');
  state.deviceRefresh = (await dev.auth.getSession()).data.session.refresh_token; save();
  const claims = JSON.parse(Buffer.from((await token(dev)).split('.')[1], 'base64url')).gina;
  check('synthetic_account_family_child_device', ok === true && claims.child_id === state.childId && claims.role === 'device', { email_domain: 'example.invalid', grade: CHILD.grade });
}

// ---- 2. Pro hakkı: yalnız sentetik aileye, gerekçeli, 3 saat (D5/C14b yöntemi). ----
async function stageOverride() {
  const until = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  const reason = 'D15 MEB pilot: sentetik aile, 3 saat; aile ve hesap test sonunda silinir';
  const row = await must(admin.from('entitlement_overrides').insert({ family_id: state.familyId, plan: 'pro', reason, ends_at: until }).select('id,plan').single(), 'override');
  state.overrideId = row.id; save();
  const parent = await session(state.email, state.password);
  const ent = await rpc(parent, 'get_prova_entitlement');
  check('family_pro_via_reasoned_override', ent.plan === 'pro' && ent.scenarios !== false, { plan: ent.plan, remaining: ent.ai_generate_remaining });
}

// ---- 3. Yönetici oturumu. Varsayılan: GINA_ADMIN_ACCESS_TOKEN (Enes'in oturumu). Geçici sentetik yönetici yalnız bayrakla. ----
async function stageAdminSetup() {
  if (flag('--allow-temp-admin')) {
    if (state.adminUserId) throw Error('temp_admin_exists');
    state.adminEmail = `gina-d15-admin-${randomUUID()}@example.invalid`;
    state.adminPassword = randomBytes(24).toString('base64url'); save();
    const u = await must(admin.auth.admin.createUser({ email: state.adminEmail, password: state.adminPassword, email_confirm: true }), 'create_admin_user');
    state.adminUserId = u.user.id; save();
    await must(admin.from('admins').insert({ user_id: state.adminUserId }), 'grant_temp_admin');
  }
  const a = await adminSession();
  const claims = JSON.parse(Buffer.from((await bearer(a)).split('.')[1], 'base64url'));
  const list = await a.rpc('admin_list_curriculum_sources');
  check('admin_session_valid', claims.gina?.admin === true && !list.error, { temp_admin: !!state.adminUserId, error: list.error?.code });
}

// ---- 4. Resmî kaynağın sunucuda indirilmesi (Edge, gerçek ÖDSGM/EBA ağı). ----
async function stageSource() {
  const parent = await session(state.email, state.password);
  const a = await adminSession();
  const denied = await fn(parent, 'curriculum-source-fetch', { request_id: randomUUID(), target: SCOPE });
  check('parent_cannot_fetch_sources', denied.status === 403, { status: denied.status });
  const first = await fn(a, 'curriculum-source-fetch', { request_id: randomUUID(), target: SCOPE });
  logCall({ step: 'curriculum-source-fetch', paid: false, endpoint: 'curriculum-source-fetch', response: { status: first.status, outcome: first.body.outcome, status_: first.body.status, extraction: first.body.extraction_status, stored: first.body.stored } });
  require_('official_download_recorded', first.status === 200 && ['new_revision', 'unchanged'].includes(first.body.outcome), { status: first.status, outcome: first.body.outcome, error: first.body.error, index: first.body.index });
  check('downloaded_hash_equals_repository_manifest', first.body.sha256 === OFFICIAL.sha256, { sha256: String(first.body.sha256).slice(0, 12) });
  check('not_claimed_official_endorsement', first.body.officially_verified === false);
  check('original_file_stored', first.body.stored === true, { stored: first.body.stored });
  state.revisionId = first.body.revision_id; state.sha = first.body.sha256; save();
  const again = await fn(a, 'curriculum-source-fetch', { request_id: randomUUID(), target: SCOPE });
  check('same_hash_no_new_revision', again.status === 200 && again.body.outcome === 'unchanged' && again.body.revision_id === state.revisionId, { outcome: again.body.outcome });
  const sources = await rpc(a, 'admin_list_curriculum_sources');
  const src = sources.find((s) => s.school_year === SCOPE.school_year && s.term === SCOPE.term && (s.revisions ?? []).some((r) => r.id === state.revisionId));
  const rev = src?.revisions.find((r) => r.id === state.revisionId);
  check('revision_chain_mime_size_recorded', !!rev && rev.redirect_chain?.[0]?.url?.startsWith('https://meb.ai/') && rev.resolved_url?.startsWith('https://cdn.eba.gov.tr/') && rev.bytes === OFFICIAL.bytes,
    { chain: rev?.redirect_chain?.map((h) => `${new URL(h.url).hostname}:${h.status}`), bytes: rev?.bytes, mime: rev?.mime, index_published_on: src?.index_published_on, index_updated_on: src?.index_updated_on });
  state.sourceId = src?.id; save();
  const t2 = await fn(a, 'curriculum-source-fetch', { request_id: randomUUID(), target: { ...SCOPE, term: 2 } });
  check('other_term_not_substituted', t2.status === 200 && ['unpublished', 'unverified'].includes(t2.body.outcome) && t2.body.revision_id === undefined, { outcome: t2.body.outcome });
}

// ---- 5. İşletim adımı: queued → done, idempotent aday içe alma (Python çıkarıcı, aynı politika). ----
async function stageExtract() {
  const a = await adminSession();
  const pipeline = await rpc(a, 'admin_curriculum_pipeline');
  const queued = pipeline.queue.find((q) => q.revision_id === state.revisionId);
  const unrelated = pipeline.queue.filter((q) => q.revision_id !== state.revisionId).length;
  if (!LOCAL && unrelated) throw Error(`stop: ${unrelated} unrelated queued revisions; process them deliberately first`);
  const adminToken = await bearer(a);
  const run = (out) => spawnSync('python3', ['-I', new URL('scripts/fetch-curriculum-sources.py', ROOT).pathname, '--process-queue', '--api-url', URL_BASE, ...(out ? ['--out', out] : [])],
    { encoding: 'utf8', timeout: 300000, env: { PATH: process.env.PATH, GINA_SUPABASE_ANON_KEY: ANON, GINA_ADMIN_ACCESS_TOKEN: adminToken } });
  if (queued) {
    const dir = mkdtempSync(join(tmpdir(), 'gina-d15-bundle-'));
    try {
      const r = run(dir);
      const report = r.status === 0 && r.stdout.trim().startsWith('[') ? JSON.parse(r.stdout) : null;
      const mine = report?.find((x) => x.revision_id === state.revisionId);
      require_('operator_step_extracts_revision', mine?.outcome === 'done', { exit: r.status, outcome: mine?.outcome, scenarios: mine?.scenarios, created: mine?.created, error: mine?.error ?? (report ? null : r.stderr.slice(-300)) });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  } else {
    const sources = await rpc(a, 'admin_list_curriculum_sources');
    const rev = sources.flatMap((s) => s.revisions ?? []).find((r) => r.id === state.revisionId);
    require_('revision_already_extracted', rev?.extraction_status === 'done', { extraction_status: rev?.extraction_status });
  }
  const rerun = run(null);
  check('operator_rerun_no_duplicate_work', rerun.status === 0 && !JSON.parse(rerun.stdout || '[]').some((x) => x.revision_id === state.revisionId), { exit: rerun.status });
  const cands = await rpc(a, 'admin_list_curriculum_candidates');
  const pick = cands.find((c) => c.key === CANDIDATE_KEY);
  const detail = pick ? await rpc(a, 'admin_get_curriculum_candidate', { p_id: pick.id }) : null;
  require_('pilot_candidate_imported_from_this_revision', !!pick && detail.candidate.source_sha256 === state.sha && detail.candidate.grade === SCOPE.grade && detail.candidate.term === SCOPE.term && detail.candidate.exam === EXAM_NO && detail.candidate.academic_year === SCOPE.school_year,
    { key: CANDIDATE_KEY, status: pick?.status, question_count: pick?.question_count, from_revision: cands.filter((c) => c.key.includes('turkce2')).length });
  state.candidateId = pick.id; save();
}

const REVIEW = {
  programme: 'Türkçe Dersi Öğretim Programı (2024)',
  school_scope: 'D15 pilot: OYSS 2026-2027/1, 1. ortak yazılı, 5. sınıf; okul doğrulaması yapılmadı',
  programme_url: 'https://tymm.meb.gov.tr/ogretim-programlari',
  source_checked: true, counts_checked: true, applicability_checked: true,
  issues_resolution: 'Blok adetleri ve çıktı hücreleri resmî turkce2.xlsx ile karşılaştırıldı (D15 pilot incelemesi).',
  note: 'D15 kabul pilotu; özgün hazırlık içindir, MEB onayı değildir.',
};

// ---- 6. Kaynak onayı + aday incelemesi + ayrı yayın (yönetici). ----
async function stageReview() {
  const a = await adminSession();
  const act = LOCAL || flag('--reviewed-by-enes');
  let detail = await rpc(a, 'admin_get_curriculum_candidate', { p_id: state.candidateId });
  let status = detail.status ?? detail.candidate_status ?? (await rpc(a, 'admin_list_curriculum_candidates')).find((c) => c.id === state.candidateId).status;
  const revStatus = async () => (await rpc(a, 'admin_list_curriculum_sources')).flatMap((s) => s.revisions ?? []).find((r) => r.id === state.revisionId)?.status;
  const listed = async () => (await rpc(a, 'admin_list_curriculum_candidates')).find((c) => c.id === state.candidateId);
  if (status !== 'published' && !act) throw Error('stop: review/publish not done; Enes reviews in backoffice (or re-run with --reviewed-by-enes)');
  let c = await listed();
  if (c.status === 'draft') {
    const r = await rpc(a, 'admin_change_curriculum_candidate', { p_request_id: randomUUID(), p_id: c.id, p_revision: c.revision, p_action: 'review', p_review: REVIEW, p_note: 'D15 pilot incelemesi', p_confirmed: true });
    check('candidate_reviewed', r.status === 'reviewed', { status: r.status });
    c = await listed();
  }
  if ((await revStatus()) !== 'approved' && c.status === 'reviewed') {
    const blocked = await a.rpc('admin_change_curriculum_candidate', { p_request_id: randomUUID(), p_id: c.id, p_revision: c.revision, p_action: 'publish', p_review: null, p_note: 'D15 pilot yayını', p_confirmed: true });
    check('publish_blocked_until_source_approved', !!blocked.error && /curriculum_source_not_approved/.test(blocked.error.message), { error: blocked.error?.message });
    const ap = await rpc(a, 'admin_review_curriculum_source_revision', { p_request_id: randomUUID(), p_revision_id: state.revisionId, p_action: 'approve', p_note: 'D15: hash manifest ile aynı; hücreler resmî dosyayla karşılaştırıldı.', p_confirmed: true });
    check('source_revision_approved', ap.status === 'approved', { status: ap.status });
  }
  if (c.status === 'reviewed') {
    const pub = await rpc(a, 'admin_change_curriculum_candidate', { p_request_id: randomUUID(), p_id: c.id, p_revision: c.revision, p_action: 'publish', p_review: null, p_note: 'D15 pilot yayını', p_confirmed: true });
    check('candidate_published_separately', pub.status === 'published', { status: pub.status });
    c = await listed();
  }
  require_('candidate_published_source_approved', c.status === 'published' && (await revStatus()) === 'approved', { status: c.status, revision: c.revision });
  detail = await rpc(a, 'admin_get_curriculum_candidate', { p_id: c.id });
  state.candidateRevision = c.revision; state.questionCount = detail.candidate.question_count;
  state.blocks = detail.candidate.blocks.map((b, i) => ({ block_id: `B${i + 1}`, count: b.count, outcome_ids: b.outcomes.map((o) => (o.code && o.code.trim()) || `cell:${o.cell}`) }));
  // H03: genel müfredat verisi (kazanım metni, kaynak URL'si); inceleme paketi için. Aile verisi değil.
  state.scenarioCandidate = detail.candidate;
  save();
}

// ---- 7. D15 pilot kapsamı: yalnız bu sentetik aile, ≤ 6 saat, global anahtar kapalı kalır. ----
async function stageScope() {
  const parent = await session(state.email, state.password);
  const pre = await rpc(admin, 'get_curriculum_pilot_family', { p_family_id: state.familyId });
  const before = await rpc(parent, 'get_curriculum_scenarios', { p_child_id: state.childId, p_year: SCOPE.school_year, p_term: SCOPE.term, p_exam: EXAM_NO, p_subject: SCOPE.subject });
  if (pre.catalog_enabled === false) check('switch_off_scenario_invisible_before_scope', Array.isArray(before) && before.length === 0, { visible: before.length });
  const set = await rpc(admin, 'set_curriculum_pilot_family', { p_family_id: state.familyId, p_reason: 'D15 MEB kabul pilotu: tek sentetik aile, 3 saat', p_hours: 3 });
  const after = await rpc(admin, 'get_curriculum_pilot_family', { p_family_id: state.familyId });
  check('pilot_scope_set_time_limited', after.open === true && after.scope?.active === true && after.catalog_enabled === false, { ends_at: set.ends_at, catalog_enabled: after.catalog_enabled });
  const audit = await must(admin.from('audit_log').select('action').eq('family_id', state.familyId).eq('action', 'curriculum.pilot_scope_set'), 'audit');
  check('pilot_scope_audited', audit.length >= 1);
  const other = await rpc(admin, 'get_curriculum_pilot_family', { p_family_id: randomUUID() });
  check('other_families_stay_closed', other.open === false);
}

// ---- 8. Aile seçimi: tam hedef, okul onayı beyanı, dondurulmuş kopya, yazılı taslağı. ----
async function stageSelect() {
  const parent = await session(state.email, state.password);
  const status = await rpc(parent, 'get_curriculum_source_status', { p_year: SCOPE.school_year, p_term: SCOPE.term, p_subject: SCOPE.subject });
  check('parent_sees_verified_source_not_endorsement', status.status === 'verified' && status.officially_verified === false && status.substituted === false && status.requested?.term === SCOPE.term,
    { status: status.status, stale: status.stale, last_approved: String(status.last_approved_sha256 ?? '').slice(0, 12) });
  const scenarios = await rpc(parent, 'get_curriculum_scenarios', { p_child_id: state.childId, p_year: SCOPE.school_year, p_term: SCOPE.term, p_exam: EXAM_NO, p_subject: SCOPE.subject });
  const mine = scenarios.find((s) => s.id === state.candidateId);
  require_('family_sees_published_pilot_scenario', !!mine && mine.revision === state.candidateRevision, { visible: scenarios.length });
  check('scenario_summary_counts_visible', mine.candidate.question_count === state.questionCount && mine.candidate.blocks.length === state.blocks.length, { total: mine.candidate.question_count, blocks: mine.candidate.blocks.map((b) => b.count) });
  const t2 = await rpc(parent, 'get_curriculum_scenarios', { p_child_id: state.childId, p_year: SCOPE.school_year, p_term: 2, p_exam: EXAM_NO, p_subject: SCOPE.subject });
  const y2 = await rpc(parent, 'get_curriculum_scenarios', { p_child_id: state.childId, p_year: '2027-2028', p_term: 1, p_exam: EXAM_NO, p_subject: SCOPE.subject });
  check('other_term_or_year_not_substituted', t2.length === 0 && y2.length === 0);
  const input = { child_id: state.childId, catalogue_id: state.candidateId, revision: state.candidateRevision, subject: SCOPE.subject, confirmed: true };
  const unconfirmed = await parent.rpc('save_catalog_blueprint', { p_request_id: randomUUID(), p_input: { ...input, confirmed: false } });
  check('school_confirmation_required', unconfirmed.error?.message === 'curriculum_school_confirmation_required');
  const forged = await parent.rpc('save_catalog_blueprint', { p_request_id: randomUUID(), p_input: { ...input, officially_verified: true } });
  check('client_cannot_supply_review_provenance', !!forged.error);
  const req = randomUUID();
  state.blueprintId = await rpc(parent, 'save_catalog_blueprint', { p_request_id: req, p_input: input }); save();
  const replay = await rpc(parent, 'save_catalog_blueprint', { p_request_id: req, p_input: input });
  check('blueprint_selection_replay_same_copy', replay === state.blueprintId);
  const bp = await must(admin.from('exam_blueprints').select('rows,school_confirmed,distribution_kind,official_source_verified,source_context').eq('id', state.blueprintId).single(), 'bp');
  check('frozen_copy_school_catalogue_not_official', bp.school_confirmed === true && bp.distribution_kind === 'school_catalogue' && bp.official_source_verified === false && bp.rows.length === state.blocks.length,
    { rows: bp.rows.map((r) => `${r.topic}:${r.count}`), distribution_kind: bp.distribution_kind });
  const tamper = await parent.from('exam_blueprints').update({ source_context: { origin: 'reviewed_catalogue', officially_verified: true } }).eq('id', state.blueprintId).select('id');
  check('frozen_copy_cannot_be_rewritten_by_client', !!tamper.error || (tamper.data ?? []).length === 0, { error: tamper.error?.message });
  const draft = (id, title) => ({ id, content: { childId: state.childId, grade: SCOPE.grade, title, purpose: 'written', format: 'school', subjects: [SCOPE.subject], topics: [], target: state.questionCount, minutes: null, difficulty: 'orta', kind: 'open_ended', note: '', step: 2, blocks: [] } });
  const d = draft(randomUUID(), 'D15 OYSS Türkçe 5 · 1. yazılı (pilot)');
  await rpc(parent, 'save_prova_draft', { p_request_id: randomUUID(), p_id: d.id, p_version: 0, p_content: d.content });
  state.draftId = d.id; state.draftContent = d.content; save();
  if (LOCAL) {
    const bad = draft(randomUUID(), 'D15 yanlış adet (yerel)');
    await rpc(parent, 'save_prova_draft', { p_request_id: randomUUID(), p_id: bad.id, p_version: 0, p_content: bad.content });
    state.badDraftId = bad.id; save();
  }
  check('written_draft_saved', true, { target: state.questionCount });
}

const genBody = (draftId, note = '') => ({ request_id: randomUUID(), draft_id: draftId, subject: SCOPE.subject, grade: SCOPE.grade, assessment: 'written', difficulty: 'orta', blueprint_id: state.blueprintId, note, locale: 'tr' });
async function familyQuestions() {
  return must(admin.from('question_bank').select('id,kind,topic,grade,subject,provenance,expected_answer').eq('family_id', state.familyId).order('created_at'), 'questions');
}

// Deterministik zincir denetimi: senaryo → blok → soru. Model çıktısının biçimi değil, sunucuda kaydedilen iz.
function chainCheck(rows) {
  const byBlock = Object.fromEntries(state.blocks.map((b) => [b.block_id, b]));
  const counts = {};
  for (const q of rows) counts[q.provenance?.block_id] = (counts[q.provenance?.block_id] ?? 0) + 1;
  const expected = Object.fromEntries(state.blocks.map((b) => [b.block_id, b.count]));
  const problems = rows.flatMap((q) => {
    const p = q.provenance ?? {}, b = byBlock[p.block_id], out = [];
    if (p.generator !== 'ai') out.push('generator');
    if (p.catalogue_id !== state.candidateId || p.catalogue_revision !== state.candidateRevision) out.push('catalogue');
    if (!String(p.scenario_version ?? '').startsWith(`${state.candidateId}@${state.candidateRevision}:`)) out.push('scenario_version');
    if (p.source_sha256 !== state.sha) out.push('source_sha256');
    if (!b) out.push('block_id');
    if (!Array.isArray(p.outcome_ids) || !p.outcome_ids.length || (b && !p.outcome_ids.every((o) => b.outcome_ids.includes(o)))) out.push('outcome_ids');
    if (!p.source_cells?.outcome_cells?.length) out.push('source_cells');
    if (q.kind !== 'open_ended') out.push('kind');
    if (!(p.rubric?.criteria?.length > 0) || !q.expected_answer) out.push('rubric_or_answer');
    if (p.content_fit !== 'pending_human_review') out.push('content_fit');
    if (p.draft_id !== state.draftId) out.push('draft');
    if (q.grade !== SCOPE.grade || q.subject !== SCOPE.subject) out.push('scope');
    return out.length ? [{ q: short(q.id), problems: out }] : [];
  });
  return { total_ok: rows.length === state.questionCount, per_block_ok: JSON.stringify(counts) === JSON.stringify(expected), counts, expected, problems };
}

// ---- 9. Senaryo bağlı üretim (TEK ücretli çağrı; tekrar ücretsiz). ----
async function stageGenerate() {
  const parent = await session(state.email, state.password);
  if (LOCAL) {
    // Deterministik adet reddi: sağlayıcı bir soru eksik döndürür → 502, satır yok.
    const n = guardPaid();
    const bad = await fn(parent, 'prova-generate', genBody(state.badDraftId, 'QA:wrong-count'));
    logCall({ step: 'prova-generate wrong count (local fault)', paid: true, paid_index: n + 1, endpoint: 'prova-generate', response: { status: bad.status, code: bad.body.code ?? bad.body.error } });
    check('wrong_count_rejected_no_rows', bad.status >= 400 && (await familyQuestions()).length === 0, { status: bad.status, code: bad.body.code ?? bad.body.error });
  }
  const ent0 = await rpc(parent, 'get_prova_entitlement');
  const body = genBody(state.draftId);
  state.genRequest = body; save();
  const n = guardPaid();
  const t0 = Date.now();
  const g = await fn(parent, 'prova-generate', body);
  const qs = g.body.questions ?? [];
  logCall({ step: 'prova-generate scenario-bound written exam', paid: true, paid_index: n + 1, endpoint: 'prova-generate', request: { scenario: CANDIDATE_KEY, total: state.questionCount, blocks: state.blocks.map((b) => b.count), assessment: 'written' }, response: { status: g.status, code: g.body.code ?? g.body.error, questions: qs.length, groups: [...new Set(qs.map((q) => q.group_id).filter(Boolean))].length, remaining: g.body.remaining, ms: Date.now() - t0 } });
  require_('scenario_generation_ok', g.status === 200 && qs.length === state.questionCount, { status: g.status, code: g.body.code ?? g.body.error, questions: qs.length });
  state.genQuestions = qs.map((q) => ({ id: q.id, group_id: q.group_id ?? null })); save();
  if (LOCAL) {
    const s = await qaStats();
    const sent = s.received.at(-1);
    check('provider_received_full_outcome_text_not_url', sent.blocks.length === state.blocks.length && sent.blocks.every((b, i) => b.has_text && b.count === state.blocks[i].count && JSON.stringify(b.outcome_ids) === JSON.stringify(state.blocks[i].outcome_ids)) && sent.total === state.questionCount,
      { blocks: sent.blocks.map((b) => `${b.block_id}:${b.count}`) });
  }
  const rows = await familyQuestions();
  const mineRows = rows.filter((r) => qs.some((q) => q.id === r.id));
  const chain = chainCheck(mineRows);
  check('question_count_equals_scenario_total', chain.total_ok, { questions: mineRows.length, scenario_total: state.questionCount });
  check('per_block_counts_match_scenario', chain.per_block_ok, { got: chain.counts, expected: chain.expected });
  check('every_question_traces_scenario_block_outcomes_source', chain.problems.length === 0, { problems: chain.problems });
  const groups = [...new Set(qs.map((q) => q.group_id).filter(Boolean))];
  if (groups.length) {
    const members = await must(admin.from('question_source_members').select('group_id').in('group_id', groups), 'members');
    check('shared_source_one_identity_linked_questions_counted_separately', members.length === qs.filter((q) => q.group_id).length, { groups: groups.length, members: members.length });
  }
  const ent1 = await rpc(parent, 'get_prova_entitlement');
  check('charged_once_by_items', ent1.ai_generate_remaining === ent0.ai_generate_remaining - state.questionCount, { before: ent0.ai_generate_remaining, after: ent1.ai_generate_remaining });
  const replay = await fn(parent, 'prova-generate', body);
  const ent2 = await rpc(parent, 'get_prova_entitlement');
  logCall({ step: 'prova-generate replay (same request_id)', paid: false, endpoint: 'prova-generate', response: { status: replay.status } });
  check('replay_same_result_no_second_charge', replay.status === 200 && JSON.stringify((replay.body.questions ?? []).map((q) => q.id)) === JSON.stringify(qs.map((q) => q.id)) && ent2.ai_generate_remaining === ent1.ai_generate_remaining);
  const jobs = await must(admin.from('prova_generation_jobs').select('status').eq('family_id', state.familyId), 'jobs');
  check('one_done_generation_job_for_pilot', jobs.filter((j) => j.status === 'done').length === 1, { jobs: jobs.map((j) => j.status) });
  const fit = await rpc(parent, 'get_scenario_question_fit', { p_question_ids: qs.map((q) => q.id) });
  check('content_fit_pending_human_review_not_success', fit.summary.pending_human_review === qs.length && fit.summary.accepted === false, fit.summary);
  writeFileSync(new URL('chain-trace.json', OUT), JSON.stringify({
    scenario: { key: CANDIDATE_KEY, catalogue_id: short(state.candidateId), revision: state.candidateRevision, source_sha256: state.sha, total: state.questionCount, blocks: state.blocks },
    questions: mineRows.map((q) => ({ id: short(q.id), block_id: q.provenance.block_id, outcome_ids: q.provenance.outcome_ids, source_cells: q.provenance.source_cells, kind: q.kind, scenario_version: q.provenance.scenario_version, model: q.provenance.model, prompt_version: q.provenance.prompt_version, group: !!qs.find((x) => x.id === q.id)?.group_id, content_fit: q.provenance.content_fit })),
    check: chain,
  }, null, 1) + '\n');
  // İnsan alan/dil incelemesi için (AI kontrol önerisinden ayrı): soru, beklenen cevap, rubrik. Kişisel veri yok.
  writeFileSync(new URL('questions-for-human-review.json', OUT), JSON.stringify(mineRows.map((q) => ({ id: short(q.id), block_id: q.provenance.block_id, outcome_ids: q.provenance.outcome_ids, expected_answer: q.expected_answer, rubric: q.provenance.rubric })), null, 1) + '\n');
  // H03: tam inceleme paketi — temizlikten önce, sunucudaki satırlardan.
  const pkg = await exportReviewPackage(parent);
  require_('review_package_complete_before_cleanup', pkg.ok, { problems: pkg.problems, questions: pkg.questions, shared_sources: pkg.shared_sources, images: pkg.images, sha256: String(pkg.sha256 ?? '').slice(0, 12) });
}

async function reviewScenario(parent) {
  let candidate = state.scenarioCandidate;
  if (!candidate) {
    const list = await rpc(parent, 'get_curriculum_scenarios', { p_child_id: state.childId, p_year: SCOPE.school_year, p_term: SCOPE.term, p_exam: EXAM_NO, p_subject: SCOPE.subject });
    candidate = list.find((s) => s.id === state.candidateId)?.candidate;
  }
  if (!candidate) throw Error('review_package_scenario_unavailable');
  return scenarioFrom({ candidate, catalogue_id: state.candidateId, revision: state.candidateRevision, source_sha256: state.sha });
}

// H03: soruları sınav sırasıyla oku, paketi yaz, diskte çevrimdışı yeniden aç. Kişisel veri/sır yok.
async function exportReviewPackage(parent) {
  const ids = (state.genQuestions ?? []).map((q) => q.id);
  const pkg = await collectReviewPackage(admin, { questionIds: ids, scenario: await reviewScenario(parent), origin: { kind: 'meb_pilot', target: LOCAL ? 'local-isolated' : 'production', note: `${CANDIDATE_KEY}; ${LOCAL ? 'deterministic provider' : 'real provider'}` } });
  writeReviewPackage(REVIEW_DIR, pkg);
  const opened = openReviewPackage(REVIEW_DIR);
  const complete = opened.ok && opened.pkg.questions.length === ids.length;
  state.reviewPackageSha = pkg.content_sha256; save();
  return { ok: complete, problems: opened.problems, questions: opened.pkg?.questions.length, shared_sources: opened.pkg?.shared_sources.length, images: opened.pkg?.images.length, sha256: pkg.content_sha256 };
}

// ---- 10. Çocuğa atama: grup bloğu, adet, cevap anahtarı/rubrik/provenance çocuğa gitmez; atama ücret düşürmez. ----
async function stageAssign() {
  const parent = await session(state.email, state.password);
  const ent0 = await rpc(parent, 'get_prova_entitlement');
  const seen = new Set(), blocks = [];
  for (const q of state.genQuestions) {
    if (q.group_id) { if (!seen.has(q.group_id)) { seen.add(q.group_id); blocks.push({ kind: 'group', id: q.group_id, source: 'ai' }); } }
    else blocks.push({ kind: 'question', id: q.id, source: 'ai' });
  }
  const row = await must(admin.from('prova_drafts').select('version').eq('id', state.draftId).single(), 'draft_ver');
  await rpc(parent, 'save_prova_draft', { p_request_id: randomUUID(), p_id: state.draftId, p_version: row.version, p_content: { ...state.draftContent, blocks } });
  const ver = await must(admin.from('prova_drafts').select('version').eq('id', state.draftId).single(), 'draft_ver2');
  const sub = { p_request_id: randomUUID(), p_id: state.draftId, p_version: ver.version };
  const examId = await rpc(parent, 'submit_prova_draft', sub);
  const again = await rpc(parent, 'submit_prova_draft', sub);
  check('assignment_replay_same_exam', examId === again);
  state.examId = examId; save();
  const exam = await must(admin.from('exams').select('id,question_ids,status,grade,subject,child_id').eq('id', examId).single(), 'exam');
  const ids = state.genQuestions.map((q) => q.id);
  check('assigned_exam_has_exactly_scenario_questions', exam.question_ids.length === state.questionCount && exam.question_ids.every((id) => ids.includes(id)) && exam.status === 'assigned' && exam.child_id === state.childId,
    { questions: exam.question_ids.length, status: exam.status, grade: exam.grade, subject: exam.subject });
  const dev = await device();
  const childExam = await must(dev.from('exams').select('id,question_ids').eq('id', examId).single(), 'child_exam');
  const payload = await rpc(dev, 'get_attempt_questions', { p_exam_id: examId });
  const text = JSON.stringify(payload);
  check('child_sees_assigned_exam', childExam.question_ids.length === state.questionCount);
  check('child_payload_has_no_key_rubric_or_provenance', !/correct_key|expected_answer|rubric|alternative_answers|provenance|outcome_ids|block_id|source_sha256/.test(text), { items: Array.isArray(payload) ? payload.length : null });
  const ent1 = await rpc(parent, 'get_prova_entitlement');
  check('assignment_no_charge', ent1.ai_generate_remaining === ent0.ai_generate_remaining);
}

async function snapshotHash() {
  const exam = await must(admin.from('exams').select('id,question_ids,title,status').eq('id', state.examId).single(), 'exam');
  const qs = await must(admin.from('question_bank').select('id,stem,expected_answer,provenance').in('id', exam.question_ids).order('id'), 'qs');
  const bp = await must(admin.from('exam_blueprints').select('rows,source_context').eq('id', state.blueprintId).single(), 'bp');
  return createHash('sha256').update(JSON.stringify({ exam, qs, bp })).digest('hex');
}

// ---- 11. Temizlik: (isteğe bağlı) geri çekme → atanmış sınav değişmez; pilot kapsamı kalkar; hesaplar silinir. ----
async function stageCleanup() {
  const parent = await session(state.email, state.password);
  // H03 kapısı: inceleme paketi çevrimdışı tam açılmadan hiçbir şey silinmez.
  if (state.genQuestions?.length) {
    let opened = openReviewPackage(REVIEW_DIR);
    let ok = opened.ok && opened.pkg.questions.length === state.genQuestions.length && opened.pkg.content_sha256 === state.reviewPackageSha;
    if (!ok) { try { const r = await exportReviewPackage(parent); ok = r.ok; opened = { problems: r.problems }; } catch (e) { opened = { problems: [String(e.message).slice(0, 120)] }; } }
    if (!ok && flag('--allow-cleanup-without-review-package')) check('review_package_gate_overridden', true, { problems: opened.problems });
    else require_('review_package_opens_offline_before_cleanup', ok, { problems: opened.problems, sha256: String(state.reviewPackageSha ?? '').slice(0, 12) });
  }
  if (state.examId && state.blueprintId) {
    const before = await snapshotHash();
    if (flag('--withdraw') || LOCAL) {
      const a = await adminSession();
      const c = (await rpc(a, 'admin_list_curriculum_candidates')).find((x) => x.id === state.candidateId);
      if (c?.status === 'published') {
        const w = await rpc(a, 'admin_change_curriculum_candidate', { p_request_id: randomUUID(), p_id: c.id, p_revision: c.revision, p_action: 'withdraw', p_review: null, p_note: 'D15 pilot sonu: pilot yayını geri çekildi', p_confirmed: true });
        check('pilot_candidate_withdrawn', w.status === 'withdrawn', { status: w.status });
      }
      const vis = await rpc(parent, 'get_curriculum_scenarios', { p_child_id: state.childId, p_year: SCOPE.school_year, p_term: SCOPE.term, p_exam: EXAM_NO, p_subject: SCOPE.subject });
      check('withdrawn_scenario_not_offered', !vis.some((s) => s.id === state.candidateId));
      // Yeni taslakla yeni üretim: sağlayıcıya gitmeden reddedilir (ücretsiz).
      const d = { ...state.draftContent, title: 'D15 geri çekme sonrası' }, id = randomUUID();
      await rpc(parent, 'save_prova_draft', { p_request_id: randomUUID(), p_id: id, p_version: 0, p_content: d });
      const stats0 = await qaStats();
      const g = await fn(parent, 'prova-generate', genBody(id));
      const stats1 = await qaStats();
      logCall({ step: 'prova-generate after withdrawal (must stop before provider)', paid: false, endpoint: 'prova-generate', response: { status: g.status, code: g.body.code ?? g.body.error } });
      check('withdrawn_source_stops_new_generation_before_provider', g.status >= 400 && /curriculum_unavailable/.test(JSON.stringify(g.body)) && (!LOCAL || stats1.messages === stats0.messages), { status: g.status, code: g.body.code ?? g.body.error });
    }
    const after = await snapshotHash();
    check('assigned_exam_questions_and_frozen_copy_unchanged', before === after, { sha256: after.slice(0, 12) });
  }
  const cleared = await rpc(admin, 'clear_curriculum_pilot_family', { p_family_id: state.familyId });
  check('pilot_scope_cleared', cleared.removed === true || cleared.removed === false, cleared);
  const d = await fn(parent, 'delete-account', { confirm: true, password: state.password });
  check('parent_delete_account_ok', d.status === 200 && d.body.ok === true, { status: d.status, error: d.body.error });
  if (state.deviceUserId) { const r = await admin.auth.admin.deleteUser(state.deviceUserId, false); check('anonymous_device_user_deleted_or_gone', !r.error || r.error.status === 404); }
  if (state.adminUserId) {
    await admin.from('admins').delete().eq('user_id', state.adminUserId);
    const r = await admin.auth.admin.deleteUser(state.adminUserId, false);
    check('temp_admin_removed', !r.error, { error: r.error?.message });
  }
}

async function stageVerify() {
  const ids = [state.userId, state.deviceUserId, state.adminUserId].filter(Boolean);
  for (const [i, id] of ids.entries()) {
    const r = await admin.auth.admin.getUserById(id);
    check(`auth_user_absent_${i}`, r.error?.status === 404 || !r.data?.user);
  }
  if (state.adminUserId) {
    const a = await admin.from('admins').select('user_id', { count: 'exact', head: true }).eq('user_id', state.adminUserId);
    check('temp_admin_row_absent', a.count === 0);
  }
  const f = state.familyId;
  const tables = ['families', 'family_members', 'children', 'devices', 'question_bank', 'question_source_groups', 'prova_drafts', 'exams', 'exam_attempts', 'exam_blueprints', 'prova_generation_jobs', 'prova_ai_usage', 'ai_request_attempts', 'entitlement_overrides'];
  const counts = {};
  for (const t of tables) {
    const r = await admin.from(t).select('*', { count: 'exact', head: true }).eq(t === 'families' ? 'id' : 'family_id', f);
    counts[t] = r.error ? `error:${r.error.code}` : r.count;
  }
  check('family_scoped_rows_absent', Object.values(counts).every((v) => v === 0), { counts });
  const scope = await rpc(admin, 'get_curriculum_pilot_family', { p_family_id: f });
  check('pilot_scope_absent_switch_unchanged', scope.scope === null && scope.open === false && scope.catalog_enabled === false, { catalog_enabled: scope.catalog_enabled });
  const qids = (state.genQuestions ?? []).map((q) => q.id);
  if (qids.length) { const q = await admin.from('question_bank').select('id', { count: 'exact', head: true }).in('id', qids); check('generated_questions_absent', q.count === 0, { checked: qids.length }); }
  if (!LOCAL && existsSync(STATE)) { rmSync(STATE); check('local_state_file_removed', !existsSync(STATE)); }
}

const stages = { preflight: stagePreflight, setup: stageSetup, override: stageOverride, 'admin-setup': stageAdminSetup, source: stageSource, extract: stageExtract, review: stageReview, scope: stageScope, select: stageSelect, generate: stageGenerate, assign: stageAssign, cleanup: stageCleanup, verify: stageVerify };
if (!stages[stage]) throw Error('unknown_stage');
let failed = false;
try { await stages[stage](); } catch (e) { failed = true; check('stage_error', false, { message: String(e.message).slice(0, 300) }); }
finally {
  writeStage();
  console.log(`paid calls so far: ${paidCount()} / ${MAX_PAID}`);
  if (failed || results.some((r) => !r.ok)) process.exitCode = 1;
}
