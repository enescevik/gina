// H03 — portable human-review package for generated (scenario-bound) questions.
//
// collectReviewPackage(db, …) reads the stored rows with a service-role client BEFORE any cleanup and builds a
// self-contained package: full stem, kind/choices/correct key, shared source (id/version/title/body/kind), required
// images embedded as verified data URIs (never signed/expiring URLs), expected answer, rubric (with `assesses`),
// learning outcome text and the source link (scenario version, catalogue revision, block, outcomes, source sha256,
// official source URL). validateReviewPackage(pkg) is offline (no DB, no session, no network) and is the gate the
// pilot uses before it is allowed to clean up. renderReviewHtml(pkg) produces one HTML file with no external resource.
//
// Privacy: an allowlist decides what leaves the database. No family/user/child/device ids, no e-mail, no uploader,
// no storage path or file name, no request/draft ids, no parent note/prompt text. Content approval is NOT recorded
// here: every package says `pending_human_review`, `accepted: false`.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const FORMAT = 'gina.question-review-package/v1';
export const SOURCE_BUCKET = 'gina-private-sources';
const KINDS = new Set(['multiple_choice', 'open_ended']);
// Same values as supabase/functions/_shared/answer-key.ts RUBRIC_ASSESSES; null = not stated (grader infers from stem).
const ASSESSES = new Set(['result', 'process']);
const SHARED_KINDS = new Set(['text', 'table', 'visual_description', 'image']);
const IMAGE_MIME = new Set(['image/png', 'image/jpeg']);
const FORBIDDEN_KEYS = new Set(['family_id', 'created_by', 'requested_by', 'uploaded_by', 'user_id', 'child_id', 'device_id', 'email', 'object_path', 'token', 'password', 'draft_id', 'request_id', 'storage_consent', 'name_original']);
const ALLOWED_URL_PATHS = new Set(['scenario.source_url', 'scenario.index_url']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const short = (id) => str(id).slice(0, 8);
const must = async (p, label) => { const r = await p; if (r.error) throw Error(`${label}: ${r.error.message ?? r.error.code ?? 'error'}`); return r.data; };

/** Canonical JSON (sorted keys) so the content hash does not depend on key order. */
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export const contentHash = ({ content_sha256: _c, generated_at: _g, ...rest }) => sha256(canonical(rest));

function magicMime(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}

function rubricOf(p) {
  const r = p?.rubric;
  if (!r || typeof r !== 'object') return null;
  return {
    assesses: r.assesses ?? null,
    criteria: (Array.isArray(r.criteria) ? r.criteria : []).map((c) => ({ text: str(c?.text), points: Number(c?.points) })),
    alternative_answers: (Array.isArray(r.alternative_answers) ? r.alternative_answers : []).map(str),
  };
}

/**
 * Normalise a scenario as read before cleanup (admin_get_curriculum_candidate / get_curriculum_scenarios `candidate`).
 * Only public curriculum facts; no family data.
 */
export function scenarioFrom({ candidate, catalogue_id, revision, source_sha256, index_url = null }) {
  const c = candidate ?? {};
  return {
    key: str(c.key),
    label: str(c.label),
    catalogue_id: str(catalogue_id),
    revision: Number(revision),
    academic_year: str(c.academic_year),
    term: Number(c.term),
    exam: Number(c.exam),
    grade: Number(c.grade),
    subject: str(c.subject),
    sheet: str(c.sheet),
    header_cell: str(c.header_cell),
    total: Number(c.question_count),
    source_sha256: str(source_sha256 || c.source_sha256),
    source_url: str(c.source_url),
    index_url: index_url ? str(index_url) : null,
    blocks: (c.blocks ?? []).map((b, i) => ({
      block_id: `B${i + 1}`,
      count: Number(b.count),
      count_cell: str(b.count_cell),
      outcomes: (b.outcomes ?? []).map((o) => ({ code: (o.code && str(o.code).trim()) || `cell:${o.cell}`, text: str(o.text), cell: str(o.cell) })),
    })),
  };
}

/**
 * Read everything a reviewer needs for `questionIds` (in that order) with a service-role client and return the
 * package. Throws if a required image cannot be read or fails its stored sha256 (never silently dropped).
 */
export async function collectReviewPackage(db, { questionIds, scenario, origin = {} }) {
  if (!Array.isArray(questionIds) || !questionIds.length) throw Error('review_package_no_questions');
  const rows = await must(db.from('question_bank').select('id,kind,grade,subject,topic,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,provenance').in('id', questionIds), 'review_questions');
  const byId = new Map(rows.map((r) => [r.id, r]));
  const missing = questionIds.filter((id) => !byId.has(id));
  if (missing.length) throw Error(`review_package_questions_missing:${missing.length}`);
  const members = await must(db.from('question_source_members').select('group_id,question_id,position,prompt').in('question_id', questionIds), 'review_members');
  const groupIds = [...new Set(members.map((m) => m.group_id))];
  const groups = groupIds.length ? await must(db.from('question_source_groups').select('id,version,title,body,grade,subject').in('id', groupIds), 'review_groups') : [];
  const links = await must(db.from('learning_source_links').select('question_id,source_id,alt,created_at').in('question_id', questionIds).order('created_at'), 'review_links');
  const sourceIds = [...new Set(links.map((l) => l.source_id))];
  const sources = sourceIds.length ? await must(db.from('learning_sources').select('id,kind,mime,bytes,sha256,object_path,width,height,status').in('id', sourceIds), 'review_sources') : [];

  // Images: download the private original, verify bytes/sha256/magic, embed as data URI. No URL is kept.
  const images = [];
  const imageIdBySource = new Map();
  for (const s of sources) {
    if (s.kind !== 'question_image' || s.status !== 'ready' || !IMAGE_MIME.has(s.mime)) throw Error('review_package_image_not_ready');
    const blob = await must(db.storage.from(SOURCE_BUCKET).download(s.object_path), 'review_image_download');
    const buf = Buffer.from(await blob.arrayBuffer());
    if (buf.length !== s.bytes || sha256(buf) !== s.sha256 || magicMime(buf) !== s.mime || buf.length > MAX_IMAGE_BYTES) throw Error('review_package_image_integrity');
    const id = `img-${s.sha256.slice(0, 12)}`;
    imageIdBySource.set(s.id, id);
    if (!images.some((i) => i.id === id)) images.push({ id, mime: s.mime, bytes: s.bytes, sha256: s.sha256, width: s.width ?? null, height: s.height ?? null, data_uri: `data:${s.mime};base64,${buf.toString('base64')}` });
  }
  const imagesOf = (qid) => links.filter((l) => l.question_id === qid).map((l) => ({ image_id: imageIdBySource.get(l.source_id), alt: str(l.alt) }));

  // Shared sources: real question groups first; AI shared sources that did not become a group are kept from provenance.
  const shared = [];
  const sharedIdOfQuestion = new Map();
  for (const g of groups) {
    const ms = members.filter((m) => m.group_id === g.id).sort((a, b) => a.position - b.position);
    const first = byId.get(ms[0]?.question_id);
    const qImages = ms.map((m) => JSON.stringify(imagesOf(m.question_id)));
    const common = qImages.every((x) => x === qImages[0]) ? imagesOf(ms[0].question_id) : [];
    const id = `group-${short(g.id)}`;
    shared.push({ id, origin: 'question_group', version: g.version, title: str(g.title), body: str(g.body), kind: first?.provenance?.shared_source?.kind ?? (common.length ? 'image' : 'text'), images: common, question_ids: ms.map((m) => short(m.question_id)) });
    for (const m of ms) sharedIdOfQuestion.set(m.question_id, { id, position: m.position, prompt: str(m.prompt), common: common.length > 0 });
  }
  const aiShared = new Map();
  for (const qid of questionIds) {
    const p = byId.get(qid).provenance ?? {};
    if (sharedIdOfQuestion.has(qid) || !p.shared_source_id || !p.shared_source) continue;
    const key = `ai-${str(p.shared_source_id)}`;
    if (!aiShared.has(key)) aiShared.set(key, { id: key, origin: 'ai_shared_source_not_grouped', version: null, title: str(p.shared_source_title), body: str(p.shared_source.content), kind: str(p.shared_source.kind), images: [], question_ids: [] });
    const s = aiShared.get(key);
    s.question_ids.push(short(qid));
    sharedIdOfQuestion.set(qid, { id: key, position: s.question_ids.length, prompt: str(p.shared_prompt), common: false });
  }
  shared.push(...aiShared.values());

  const blockOf = new Map((scenario?.blocks ?? []).map((b) => [b.block_id, b]));
  const questions = questionIds.map((qid, i) => {
    const q = byId.get(qid), p = q.provenance ?? {};
    const link = sharedIdOfQuestion.get(qid);
    const block = blockOf.get(p.block_id);
    const outcomeIds = Array.isArray(p.outcome_ids) ? p.outcome_ids.map(str) : [];
    return {
      id: short(qid),
      position: i + 1,
      block_id: p.block_id ?? null,
      outcome_ids: outcomeIds,
      outcomes: outcomeIds.map((code) => ({ code, text: block?.outcomes.find((o) => o.code === code)?.text ?? '' })),
      kind: q.kind,
      grade: q.grade,
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      stem: str(q.stem),
      shared_source_id: link?.id ?? null,
      shared_position: link?.position ?? null,
      prompt: link ? link.prompt : null,
      choices: Array.isArray(q.choices) ? q.choices.map((c) => ({ key: str(c.key), text: str(c.text) })) : null,
      correct_key: q.correct_key ?? null,
      expected_answer: q.expected_answer ?? null,
      solution: q.solution ?? null,
      explanation: q.explanation ?? null,
      rubric: rubricOf(p),
      images: link?.common ? [] : imagesOf(qid),
      source: {
        scenario_version: p.scenario_version ?? null,
        catalogue_id: p.catalogue_id ? short(p.catalogue_id) : null,
        catalogue_revision: p.catalogue_revision ?? null,
        source_sha256: p.source_sha256 ?? null,
        source_cells: p.source_cells ?? null,
      },
      generation: { generator: p.generator ?? null, model: p.model ?? null, prompt_version: p.prompt_version ?? null },
      content_fit: p.content_fit ?? null,
    };
  });

  const pkg = {
    format: FORMAT,
    generated_at: new Date().toISOString(),
    origin: { kind: str(origin.kind || 'unspecified'), target: str(origin.target || 'unspecified'), note: str(origin.note || '') },
    review: { status: 'pending_human_review', accepted: false, note: 'İnsan içerik onayı bu paketle verilmiş sayılmaz; inceleme kararı ayrı kaydedilir.' },
    scenario: scenario ? { ...scenario, catalogue_id: short(scenario.catalogue_id) } : null,
    shared_sources: shared,
    images,
    questions,
  };
  pkg.content_sha256 = contentHash(pkg);
  return pkg;
}

/** Walk every value; report forbidden keys, e-mail addresses and URLs outside the allowlist. */
function privacyProblems(v, path = '', out = []) {
  if (Array.isArray(v)) v.forEach((x, i) => privacyProblems(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
    if (FORBIDDEN_KEYS.has(k)) out.push(`forbidden_key:${path ? path + '.' : ''}${k}`);
    privacyProblems(x, path ? `${path}.${k}` : k, out);
  } else if (typeof v === 'string') {
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(v)) out.push(`email_like:${path}`);
    if (/https?:\/\//i.test(v) && !ALLOWED_URL_PATHS.has(path)) out.push(`url_not_allowed:${path}`);
    if (/[?&](token|X-Amz-Signature|sig)=/i.test(v)) out.push(`signed_url:${path}`);
  }
  return out;
}

/** Offline completeness/privacy gate. Needs nothing but the package object. */
export function validateReviewPackage(pkg) {
  const problems = [], warnings = [];
  const p = (cond, msg) => { if (!cond) problems.push(msg); };
  p(pkg?.format === FORMAT, 'format');
  if (pkg?.format !== FORMAT) return { ok: false, problems, warnings };
  p(pkg.review?.status === 'pending_human_review' && pkg.review?.accepted === false, 'review_must_stay_pending');
  p(pkg.content_sha256 === contentHash(pkg), 'content_sha256_mismatch');
  const sc = pkg.scenario;
  p(!!sc, 'scenario_missing');
  if (sc) {
    p(!!sc.key && !!sc.catalogue_id && Number.isInteger(sc.revision), 'scenario_identity');
    p(/^[0-9a-f]{64}$/.test(sc.source_sha256 ?? ''), 'scenario_source_sha256');
    p(/^https:\/\//.test(sc.source_url ?? ''), 'scenario_source_url');
    p(Array.isArray(sc.blocks) && sc.blocks.length > 0, 'scenario_blocks');
    for (const b of sc.blocks ?? []) p(b.outcomes?.length > 0 && b.outcomes.every((o) => o.code && o.text.trim().length > 0), `scenario_outcome_text:${b.block_id}`);
  }
  const images = new Map((pkg.images ?? []).map((i) => [i.id, i]));
  for (const img of pkg.images ?? []) {
    const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(img.data_uri ?? '');
    if (!m) { problems.push(`image_not_embedded:${img.id}`); continue; }
    const buf = Buffer.from(m[2], 'base64');
    p(m[1] === img.mime && magicMime(buf) === img.mime, `image_mime:${img.id}`);
    p(buf.length === img.bytes && sha256(buf) === img.sha256, `image_integrity:${img.id}`);
  }
  const refOk = (refs, where) => { for (const r of refs ?? []) { p(images.has(r.image_id), `image_ref_unresolved:${where}`); p(str(r.alt).trim().length >= 3, `image_alt_missing:${where}`); } };
  const shared = new Map((pkg.shared_sources ?? []).map((s) => [s.id, s]));
  for (const s of pkg.shared_sources ?? []) {
    p(SHARED_KINDS.has(s.kind), `shared_kind:${s.id}`);
    p(s.title.trim().length > 0, `shared_title:${s.id}`);
    p(s.body.trim().length > 0 || s.images.length > 0, `shared_content_missing:${s.id}`);
    p(s.question_ids.length >= 2, `shared_members_lt_2:${s.id}`);
    refOk(s.images, s.id);
    p(s.question_ids.every((id) => pkg.questions.some((q) => q.id === id && q.shared_source_id === s.id)), `shared_members_mismatch:${s.id}`);
  }
  const blocks = new Map((sc?.blocks ?? []).map((b) => [b.block_id, b]));
  const counts = {};
  p(Array.isArray(pkg.questions) && pkg.questions.length > 0, 'questions_missing');
  for (const q of pkg.questions ?? []) {
    const w = q.id;
    counts[q.block_id] = (counts[q.block_id] ?? 0) + 1;
    p(KINDS.has(q.kind), `kind:${w}`);
    p(q.stem.trim().length >= 5, `stem_missing:${w}`);
    if (q.kind === 'multiple_choice') {
      p(Array.isArray(q.choices) && q.choices.length === 4 && ['A', 'B', 'C', 'D'].every((k) => q.choices.some((c) => c.key === k && c.text.trim())), `choices:${w}`);
      p(['A', 'B', 'C', 'D'].includes(q.correct_key), `correct_key:${w}`);
    } else {
      p(str(q.expected_answer).trim().length > 0, `expected_answer_missing:${w}`);
      p(q.rubric && q.rubric.criteria.length > 0 && q.rubric.criteria.every((c) => c.text.trim() && Number.isFinite(c.points) && c.points > 0), `rubric_missing:${w}`);
      if (q.rubric?.assesses == null) warnings.push(`rubric_assesses_unspecified:${w}`);
      else p(ASSESSES.has(q.rubric.assesses), `rubric_assesses:${w}`);
    }
    const b = blocks.get(q.block_id);
    p(!!b, `block_unknown:${w}`);
    p(q.outcome_ids.length > 0 && q.outcomes.every((o) => o.text.trim()) && (!b || q.outcome_ids.every((o) => b.outcomes.some((x) => x.code === o))), `outcome:${w}`);
    p(!!q.source.scenario_version && q.source.source_sha256 === sc?.source_sha256 && q.source.catalogue_id === sc?.catalogue_id && q.source.catalogue_revision === sc?.revision, `source_link:${w}`);
    p(q.source.source_cells?.outcome_cells?.length > 0, `source_cells:${w}`);
    if (q.shared_source_id) { p(shared.has(q.shared_source_id), `shared_unresolved:${w}`); p(str(q.prompt).trim().length >= 5, `shared_prompt_missing:${w}`); }
    refOk(q.images, w);
  }
  if (sc?.blocks) {
    for (const b of sc.blocks) p((counts[b.block_id] ?? 0) === b.count, `block_count:${b.block_id}`);
    if (Number.isFinite(sc.total)) p(pkg.questions.length === sc.total, 'total_count');
  }
  problems.push(...privacyProblems({ ...pkg, images: (pkg.images ?? []).map(({ data_uri, ...rest }) => rest) }));
  return { ok: problems.length === 0, problems, warnings };
}

// ---------------------------------------------------------------------------------------------------------------
// Self-contained HTML. No script runs (CSP default-src 'none'); the package JSON is embedded as inert data so the
// HTML alone is enough to re-validate. Images only as data: URIs.
// ---------------------------------------------------------------------------------------------------------------
const esc = (s) => str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const para = (s) => esc(s).split(/\n{2,}/).map((x) => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');
const KIND_TR = { multiple_choice: 'Çoktan seçmeli', open_ended: 'Açık uçlu' };
const ASSESS_TR = { result: 'Sonuç', process: 'Süreç' };
const SHARED_TR = { text: 'Metin', table: 'Tablo', visual_description: 'Görsel betimleme (dosya yok)', image: 'Görsel' };

function figure(pkg, refs) {
  return (refs ?? []).map((r) => {
    const img = pkg.images.find((i) => i.id === r.image_id);
    if (!img) return `<p class="warn">Görsel eksik: ${esc(r.image_id)}</p>`;
    return `<figure><img src="${img.data_uri}" alt="${esc(r.alt)}"${img.width ? ` width="${img.width}"` : ''}${img.height ? ` height="${img.height}"` : ''}><figcaption>${esc(r.alt)} · sha256 ${esc(img.sha256.slice(0, 12))}</figcaption></figure>`;
  }).join('');
}

function questionHtml(pkg, q) {
  const choices = q.kind === 'multiple_choice' && q.choices ? `<ol class="choices">${q.choices.map((c) => `<li><b>${esc(c.key)})</b> ${esc(c.text)}</li>`).join('')}</ol>` : '';
  const body = q.shared_source_id ? para(q.prompt) : para(q.stem);
  const full = q.shared_source_id ? `<details><summary>Kayıtlı tam soru metni (ortak kaynak dahil)</summary>${para(q.stem)}</details>` : '';
  const rubric = q.rubric ? `<table class="rubric"><thead><tr><th>Ölçüt</th><th>Puan</th></tr></thead><tbody>${q.rubric.criteria.map((c) => `<tr><td>${esc(c.text)}</td><td>${esc(c.points)}</td></tr>`).join('')}<tr class="sum"><td>Toplam</td><td>${q.rubric.criteria.reduce((a, c) => a + (Number(c.points) || 0), 0)}</td></tr></tbody></table><p class="meta">Rubrik neyi ölçüyor: <b>${esc(ASSESS_TR[q.rubric.assesses] ?? q.rubric.assesses ?? 'belirtilmemiş (puanlama soru metninden çıkarır)')}</b></p>${q.rubric.alternative_answers.length ? `<p class="meta">Kabul edilebilir diğer cevaplar:</p><ul>${q.rubric.alternative_answers.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}` : '<p class="meta">Rubrik yok.</p>';
  const answer = q.kind === 'multiple_choice' ? `<p><b>Doğru şık:</b> ${esc(q.correct_key)}</p>` : `<p><b>Beklenen cevap:</b></p>${para(q.expected_answer)}`;
  return `<article class="q" id="q-${esc(q.id)}">
<header><span class="num">${q.position}</span><span class="tag">${esc(KIND_TR[q.kind] ?? q.kind)}</span><span class="tag">${esc(q.block_id)}</span>${q.outcome_ids.map((o) => `<span class="tag out">${esc(o)}</span>`).join('')}<span class="id">#${esc(q.id)}</span></header>
<section class="stem">${body}${figure(pkg, q.images)}${choices}${full}</section>
<section class="key"><h4>Cevap anahtarı</h4>${answer}${q.solution ? `<p><b>Çözüm:</b></p>${para(q.solution)}` : ''}${q.explanation ? `<p><b>Açıklama:</b></p>${para(q.explanation)}` : ''}${rubric}</section>
<section class="trace"><h4>Kazanım ve kaynak ilişkisi</h4><ul>${q.outcomes.map((o) => `<li><b>${esc(o.code)}</b> — ${esc(o.text)}</li>`).join('')}</ul>
<p class="meta">Senaryo sürümü <code>${esc(q.source.scenario_version)}</code> · katalog ${esc(q.source.catalogue_id)} r${esc(q.source.catalogue_revision)} · kaynak sha256 <code>${esc(str(q.source.source_sha256).slice(0, 12))}</code> · hücreler ${esc([q.source.source_cells?.count_cell, ...(q.source.source_cells?.outcome_cells ?? [])].filter(Boolean).join(', '))}${q.source.source_cells?.sheet ? ` (${esc(q.source.source_cells.sheet)})` : ''}</p>
<p class="meta">Üretim: ${esc(q.generation.generator)} · ${esc(q.generation.model ?? '—')} · ${esc(q.generation.prompt_version ?? '—')} · uygunluk durumu <b>${esc(q.content_fit ?? '—')}</b></p></section>
<section class="check"><h4>İnceleyen</h4><ul class="boxes"><li>☐ Soru tek başına (ve ortak kaynakla) çözülebilir</li><li>☐ Dil/yaş düzeyi uygun</li><li>☐ Kazanımı ölçüyor</li><li>☐ Cevap anahtarı ve rubrik doğru</li><li>☐ Görsel gerekiyorsa var ve okunuyor</li></ul><p class="meta">Karar (uygun / düzeltilmeli / uygun değil) ve gerekçe: ________________________________</p></section>
</article>`;
}

export function renderReviewHtml(pkg) {
  const sc = pkg.scenario ?? {};
  const v = validateReviewPackage(pkg);
  const rendered = new Set();
  const items = pkg.questions.map((q) => {
    let pre = '';
    if (q.shared_source_id && !rendered.has(q.shared_source_id)) {
      rendered.add(q.shared_source_id);
      const s = pkg.shared_sources.find((x) => x.id === q.shared_source_id);
      if (s) pre = `<section class="shared" id="s-${esc(s.id)}"><h3>Ortak kaynak · ${esc(s.title)}</h3><p class="meta">${esc(SHARED_TR[s.kind] ?? s.kind)} · kimlik <code>${esc(s.id)}</code>${s.version ? ` · sürüm ${esc(s.version)}` : ''} · bağlı sorular: ${s.question_ids.map((id) => `#${esc(id)}`).join(', ')} (her biri ayrı sayılır)</p>${para(s.body)}${figure(pkg, s.images)}</section>`;
    }
    return pre + questionHtml(pkg, q);
  }).join('\n');
  const json = JSON.stringify(pkg).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>Soru inceleme paketi</title>
<style>
:root{--mint:#3fbf9f;--purple:#6b4fd8;--cream:#fff8ec;--ink:#2b2540;--muted:#6d6782;--line:#e7dfcf;--warn:#b5452b}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.55 Nunito,"Baloo 2",system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.6rem;margin:.2em 0}h3{margin:.2em 0 .4em}h4{margin:.8em 0 .3em;color:var(--purple)}
.banner{background:#fff;border:2px solid var(--purple);border-radius:14px;padding:12px 16px;margin:12px 0}.banner b{color:var(--purple)}
.warn{color:var(--warn);font-weight:700}.meta{color:var(--muted);font-size:.9rem}code{font-size:.85em;word-break:break-all}
.scenario,.shared,.q{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:14px 0}
.shared{border-left:6px solid var(--mint)}.q header{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.num{background:var(--purple);color:#fff;border-radius:999px;min-width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:800}
.tag{background:#efeafd;color:var(--purple);border-radius:999px;padding:2px 10px;font-size:.85rem}.tag.out{background:#e3f6f0;color:#1d7f67}.id{margin-left:auto;color:var(--muted);font-size:.8rem}
.key{border-top:1px dashed var(--line);margin-top:10px}.trace,.check{border-top:1px dashed var(--line)}
table{border-collapse:collapse;width:100%}td,th{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}.sum td{font-weight:800}
figure{margin:10px 0}img{max-width:100%;min-width:min(240px,100%);height:auto;border:1px solid var(--line);border-radius:8px;image-rendering:auto}figcaption{color:var(--muted);font-size:.85rem}
.choices{list-style:none;padding-left:0}.boxes{list-style:none;padding-left:0}
@media print{body{background:#fff}.q,.shared{break-inside:avoid}}
</style></head><body><main>
<h1>Soru inceleme paketi</h1>
<div class="banner"><b>Durum: insan incelemesi bekliyor.</b> Bu paket içerik onayı değildir; otomatik denetim ve AI önerisi insan kararı yerine geçmez. Veritabanı veya oturum gerekmez.</div>
${v.ok ? '<p class="meta">Paket bütünlüğü: tam (çevrimdışı doğrulandı).</p>' : `<p class="warn">Paket eksik: ${esc(v.problems.join(', '))}</p>`}
<section class="scenario"><h3>Senaryo</h3>
<p><b>${esc(sc.key)}</b> · ${esc(sc.label)} · ${esc(sc.academic_year)} · ${esc(sc.term)}. dönem · ${esc(sc.exam)}. yazılı · ${esc(sc.grade)}. sınıf · ${esc(sc.subject)} · toplam ${esc(sc.total)} soru</p>
<p class="meta">Katalog ${esc(sc.catalogue_id)} r${esc(sc.revision)} · kaynak sha256 <code>${esc(sc.source_sha256)}</code>${sc.sheet ? ` · sayfa ${esc(sc.sheet)}` : ''}</p>
<p class="meta">Resmî kaynak dosyası: <a href="${esc(sc.source_url)}">${esc(sc.source_url)}</a> (bilgi amaçlı bağlantı; paket bu bağlantıya ihtiyaç duymaz)</p>
<table><thead><tr><th>Blok</th><th>Adet</th><th>Kazanım</th></tr></thead><tbody>${(sc.blocks ?? []).map((b) => `<tr><td>${esc(b.block_id)}${b.count_cell ? ` <span class="meta">(${esc(b.count_cell)})</span>` : ''}</td><td>${esc(b.count)}</td><td>${b.outcomes.map((o) => `${esc(o.text)}${o.cell ? ` <span class="meta">(${esc(o.cell)})</span>` : ''}`).join('<br>')}</td></tr>`).join('')}</tbody></table></section>
${items}
<p class="meta">Paket ${esc(pkg.format)} · içerik sha256 <code>${esc(pkg.content_sha256)}</code> · oluşturma ${esc(pkg.generated_at)} · kaynak: ${esc(pkg.origin.kind)} / ${esc(pkg.origin.target)}</p>
</main>
<script type="application/json" id="review-package">${json}</script>
</body></html>
`;
}

/** Read the package back from the HTML alone (used by the offline check). */
export function packageFromHtml(html) {
  const m = /<script type="application\/json" id="review-package">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw Error('review_package_json_missing_in_html');
  return JSON.parse(m[1]);
}

/** HTML-level checks: no external resource, images only as data URIs, every stem/shared body visible. */
export function checkReviewHtml(html, pkg) {
  const problems = [];
  if (!/Content-Security-Policy" content="default-src 'none'; img-src data:/.test(html)) problems.push('csp_missing');
  if (/<(img|script|link|iframe|object|embed)[^>]+(src|href)="(?!data:)[^"]+/i.test(html.replace(/<a [^>]*>/g, ''))) problems.push('external_resource');
  if (/<script(?![^>]*type="application\/json")/i.test(html)) problems.push('executable_script');
  const imgs = [...html.matchAll(/<img src="(data:[^"]+)"/g)].map((m) => m[1]);
  for (const i of pkg.images) if (!imgs.includes(i.data_uri)) problems.push(`image_not_rendered:${i.id}`);
  const visible = html.replace(/<script type="application\/json"[\s\S]*?<\/script>/, '');
  for (const q of pkg.questions) if (!visible.includes(esc(q.stem.split('\n').at(-1)).slice(0, 40))) problems.push(`stem_not_visible:${q.id}`);
  for (const s of pkg.shared_sources) {
    const n = visible.split(`id="s-${esc(s.id)}"`).length - 1;
    if (n !== 1) problems.push(`shared_not_shown_once:${s.id}`);
  }
  return { ok: problems.length === 0, problems };
}

/** Write review-package.json + review-package.html into `dir`. Returns the validation result. */
export function writeReviewPackage(dir, pkg) {
  mkdirSync(dir, { recursive: true });
  const v = validateReviewPackage(pkg);
  writeFileSync(join(dir, 'review-package.json'), JSON.stringify(pkg, null, 1) + '\n');
  writeFileSync(join(dir, 'review-package.html'), renderReviewHtml(pkg));
  return { ...v, sha256: pkg.content_sha256 };
}

/** Offline re-open of a written package (JSON and HTML must agree). */
export function openReviewPackage(dir) {
  const jf = join(dir, 'review-package.json'), hf = join(dir, 'review-package.html');
  if (!existsSync(jf) || !existsSync(hf)) return { ok: false, problems: ['review_package_files_missing'] };
  const pkg = JSON.parse(readFileSync(jf, 'utf8'));
  const html = readFileSync(hf, 'utf8');
  const fromHtml = packageFromHtml(html);
  const v = validateReviewPackage(fromHtml);
  const h = checkReviewHtml(html, fromHtml);
  const same = canonical(fromHtml) === canonical(pkg);
  // The visible page must be exactly what the renderer makes from the embedded data (detects edited HTML).
  const faithful = renderReviewHtml(fromHtml) === html;
  const problems = [...v.problems, ...h.problems, ...(same ? [] : ['json_html_differ']), ...(faithful ? [] : ['html_not_rendered_from_package'])];
  return { ok: problems.length === 0, problems, pkg: fromHtml };
}
