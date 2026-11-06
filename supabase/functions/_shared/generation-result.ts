import { fail } from "../_shared/error-contract.ts";
import { json, serviceClient } from "./supabase.ts";
import {
  type AiConfig,
  type AiResult,
  DIFFICULTIES,
  type Difficulty,
  officialUrls,
} from "./prova.ts";
import type { ScenarioProvenance } from "./catalogue-plan.ts";
export const QUESTION_TYPES = [
  "coktan_secmeli",
  "acik_uclu",
  "kisa_cevap",
  "dogru_yanlis",
  "bosluk_doldurma",
  "eslestirme",
] as const;
export const COGNITIVE_DEMANDS = [
  "hatirlama",
  "anlama",
  "uygulama",
  "analiz",
  "degerlendirme",
  "yaratma",
] as const;
/** D9/B3: üretim istemindeki rubrik ölçeği cümlesi. Veli rubriği ve açık uçlu puan 0–100'dür; kaynakta aynı ölçek.
 * Eski (v6 ve öncesi) küçük puanlı AI rubrikleri okuma tarafında (core `scaleRubricTo100`) 100'e oranlanmaya devam eder. */
export const RUBRIC_SCALE_RULE =
  "Ölçüt puanları 100 üzerindendir: bir sorunun tüm criteria puanlarının toplamı tam 100 olsun (ör. 40 + 40 + 20), her puan pozitif tam sayı. Şıklı soruda criteria tek ölçüt olabilir (100 puan).";
export interface QuestionRubric {
  criteria: { text: string; points: number }[];
  alternative_answers?: string[];
}
export interface SharedSource {
  id: string;
  kind: "text" | "table" | "visual_description";
  content: string;
}
export interface GeneratedQuestion {
  topic: string;
  kind: "multiple_choice" | "open_ended";
  difficulty: Difficulty;
  stem: string;
  choices: { key: string; text: string }[];
  correct_key: string;
  distractor_notes: { key: string; why: string }[];
  expected_answer: string;
  solution: string;
  explanation: string;
  source_urls: string[];
  /** Scenario provenance (optional, backward compatible; required when the job is catalogue-bound). */
  block_id?: string | null;
  outcome_ids?: string[] | null;
  question_type?: string | null;
  cognitive_demand?: string | null;
  intended_difficulty?: string | null;
  rubric?: QuestionRubric | null;
  shared_source_id?: string | null;
}
export interface GeneratedOutput {
  questions: GeneratedQuestion[];
  /** One entry per shared passage/table/visual; linked questions reference it and are counted separately. */
  shared_sources?: SharedSource[] | null;
}

/** Localized heading of a shared source; becomes the group title (question_source_groups.title). */
export function sharedSourceTitle(kind: SharedSource["kind"], locale: "tr" | "en") {
  const tr = { text: "Ortak metin", table: "Ortak tablo", visual_description: "Ortak görsel açıklaması" };
  const en = { text: "Shared passage", table: "Shared table", visual_description: "Shared visual description" };
  return (locale === "en" ? en : tr)[kind];
}
/**
 * D1: a linked question's stem is written self-contained, in the same shape the manual/library group contract
 * materializes (`title\npassage\n\nprompt`). The server turns the linked rows into one shared-source group
 * when it can; otherwise every question still carries the passage, so the child never sees a dangling reference.
 */
export function materializeSharedStem(
  shared: SharedSource,
  prompt: string,
  locale: "tr" | "en",
) {
  return `${sharedSourceTitle(shared.kind, locale)}\n${shared.content.trim()}\n\n${prompt.trim()}`;
}
export type GenerationContext = {
  schema: "gina.generation-context.v1";
  subject: string;
  grade: number;
  total: number;
  topics: { topic: string; count: number }[];
  kind: "mixed" | "multiple_choice" | "open_ended";
  difficulty: Difficulty;
  locale: "tr" | "en";
  scenarioCode: string | null;
  blueprintSource: string | null;
  blueprintSnapshot: Record<string, unknown> | null;
  draftScope: { id: string; version: number; purpose: unknown } | null;
  document: { id: string; sha256: string } | null;
  ai: AiConfig;
  promptVersion: string;
  promptHash: string;
  systemPrompt: string;
  userPrompt: string;
  catalogueBound: boolean;
  /** Present only for catalogue-bound jobs; comes from the private server binding via cataloguePlan. */
  scenario?: ScenarioProvenance | null;
};
const blank = (v: unknown) =>
  v === undefined || v === null || v === "" ||
  (Array.isArray(v) && v.length === 0);
const isStringList = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length <= max &&
  v.every((s) => typeof s === "string" && s.trim() && s.length <= 200);
function rubricValid(r: unknown): r is QuestionRubric {
  if (!r || typeof r !== "object") return false;
  const v = r as QuestionRubric;
  return Array.isArray(v.criteria) && v.criteria.length >= 1 &&
    v.criteria.length <= 20 &&
    v.criteria.every((c) =>
      c && typeof c.text === "string" && c.text.trim() && c.text.length <= 1000 &&
      typeof c.points === "number" && Number.isFinite(c.points) && c.points > 0 &&
      c.points <= 100
    ) &&
    (blank(v.alternative_answers) || isStringList(v.alternative_answers, 10));
}
/** Per-question scenario trace: block membership, outcome subset, type/demand vocab, rubric and shared source. */
export function validateQuestionProvenance(
  q: GeneratedQuestion,
  context: GenerationContext,
  sharedIds: Set<string>,
) {
  const scenario = context.scenario ?? null;
  const block = scenario?.blocks.find((b) => b.topic === q.topic) ?? null;
  if (scenario && !block) return false;
  if (!blank(q.block_id) && typeof q.block_id !== "string") return false;
  if (block && q.block_id !== block.block_id) return false;
  if (!blank(q.outcome_ids)) {
    if (!isStringList(q.outcome_ids, 20)) return false;
    if (new Set(q.outcome_ids!).size !== q.outcome_ids!.length) return false;
    if (block && !q.outcome_ids!.every((id) => block.outcome_ids.includes(id))) {
      return false;
    }
  } else if (block) return false;
  if (!blank(q.question_type)) {
    if (!QUESTION_TYPES.includes(q.question_type as never)) return false;
    if ((q.question_type === "coktan_secmeli") !== (q.kind === "multiple_choice")) {
      return false;
    }
  }
  if (
    !blank(q.cognitive_demand) &&
    !COGNITIVE_DEMANDS.includes(q.cognitive_demand as never)
  ) return false;
  if (
    !blank(q.intended_difficulty) &&
    !DIFFICULTIES.includes(q.intended_difficulty as Difficulty)
  ) return false;
  // A rubric object with no criteria (schema placeholder) counts as absent.
  const rubricBlank = blank(q.rubric) ||
    (typeof q.rubric === "object" && Array.isArray(q.rubric!.criteria) &&
      q.rubric!.criteria.length === 0);
  if (!rubricBlank && !rubricValid(q.rubric)) return false;
  if (block && q.kind === "open_ended" && rubricBlank) return false;
  if (!blank(q.shared_source_id)) {
    if (typeof q.shared_source_id !== "string" || !sharedIds.has(q.shared_source_id)) {
      return false;
    }
  }
  return true;
}
/** The self-contained stem of a linked question must still fit question_bank's stem limit. */
function sharedStemsFit(
  questions: GeneratedQuestion[],
  shared: SharedSource[] | null | undefined,
  locale: "tr" | "en",
) {
  const byId = new Map((shared ?? []).map((s) => [s.id, s] as const));
  return questions.every((q) => {
    const s = q.shared_source_id ? byId.get(q.shared_source_id) : null;
    return !s || materializeSharedStem(s, q.stem, locale).length <= 10000;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// D9/B6: kişi adı denetimi. Ret değil, uyarıdır: ücretli çıktı reddedilmez; bulunan soru provenance'ında
// `content_review` (needs_review) etiketi taşır ve veli incelemesine düşer. Düşük yanlış pozitif için:
// - Kesin liste: yaygın Türkçe (ve birkaç İngilizce) ad, büyük harfle tam sözcük ya da kesme işaretli ek (Ali'nin).
// - Belirsiz liste: aynı zamanda sözcük olan adlar (Deniz, Umut, Bahar…) yalnız cümle ortasında büyük harfle ya da
//   kesme işaretli ekle; cümle başındaki "Deniz suyu…" işaretlenmez.
// - Bitişik büyük harfli sözcük (Mustafa Kemal, Yunus Emre, Murat Nehri, Hz. Ömer) tam ad/tarihî kişi/yer sayılır, atlanır.
// - Yer/gök cismiyle çakışan adlar (Ege, Güneş, Ay, Tuna, Fırat…) listede yok.
// - Desen: "<Büyük harfli> adlı/isimli/adında (bir) öğrenci/çocuk/…" ve "named/called <Büyük harfli>" (listede olmasa da).
const STRICT_NAMES = new Set(
  ("Ali Ahmet Mehmet Mustafa Hasan Hüseyin İbrahim İsmail Murat Emre Burak Mert Kerem Arda Efe Emir Yusuf Ömer Eren " +
    "Berk Kaan Alp Cem Kemal Selim Serkan Oğuz Onur Tolga Volkan Uğur Furkan Enes Batuhan Berat Baran Eymen Miraç " +
    "Halil Recep Osman Yasin Yunus Hakan Taha Hamza Yiğit Emirhan Alperen Kadir Erkan Gökhan Serdar " +
    "Sinan Tarık Orhan Okan Cengiz Levent Mesut Selçuk Berkay Çağan Doruk Aybars " +
    "Ayşe Fatma Zeynep Elif Emine Hatice Merve Esra Büşra Ebru Ela Ecrin Azra Asel Zehra Meryem Hira Selin Sena " +
    "Buse İrem Gizem Melis Melike Sude Beren Ceren Dilara Sibel Seda Gamze Özge Aslı Tuğba Kübra Esma Rabia Sevda " +
    "Gülsüm Leyla Nisa Ece Eda Esin Hande Nazlı Şule Tuba Feyza Aylin Ayla Burcu Canan Gökçe Hazal Sinem Songül " +
    "Tülay Zeliha Elçin Berna Nermin Serap Yeliz Zübeyde Halime Şeyma Betül Cansu Didem Elvan Funda Gülay Hülya " +
    "Miray Pelin Yaren Zümra Elanur Eslem Mira " +
    "John Mary Tom Emma Anna Jack Lucy Sarah David Emily Oliver Sophie James Peter Paul Kate Mike Alex").split(" "),
);
const AMBIGUOUS_NAMES = new Set(
  ("Deniz Umut Bahar Yağmur Barış Irmak Toprak Doğa Kaya Çınar Defne Ceylan Derya Can Su Nur Ada Derin Damla Pınar " +
    "Sevgi Gül Lale Öykü Yasemin Hilal Dilek Ezgi İpek Kader Melek Duru Eylül Poyraz Ayaz Metin Ümit Cihan Engin " +
    "Nehir Ozan Ufuk Zafer Erdem " +
    "Ben Lily Max").split(" "),
);
const HONORIFICS = new Set(["Hz", "Hazreti", "Hazret", "Sultan", "Şeyh", "Mimar", "Peygamber", "Halife", "Kanuni", "Fatih", "Yavuz"]);
const ROLE_NOUNS =
  "öğrenci|öğrencisi|çocuk|kız|oğlan|erkek|arkadaş|arkadaşı|kişi|öğretmen|çiftçi|satıcı|esnaf|doktor|kardeş|anne|baba|dede|nine|teyze|amca|komşu|adam|kadın|genç|bebek|usta|işçi|sporcu";
const NAMED_TR = new RegExp(
  `(?<![\\p{L}])(\\p{Lu}\\p{Ll}+)\\s+(?:adlı|isimli|adında|adındaki)\\s+(?:bir\\s+)?(?:${ROLE_NOUNS})(?![\\p{L}])`,
  "gu",
);
const NAMED_EN = /(?<![\p{L}])(?:named|called)\s+(\p{Lu}\p{Ll}+)(?![\p{L}])/gu;
const WORD = /\p{L}+(?:['’]\p{L}+)?/gu;
const capitalized = (w: string) => /^\p{Lu}\p{Ll}*$/u.test(w);
/** Metindeki olası kişi adlarını döndürür (tekrarsız, ilk görünüş sırasıyla). Saf ve deterministik. */
export function detectPersonNames(text: string): string[] {
  if (typeof text !== "string" || !text) return [];
  const found: string[] = [];
  const add = (n: string) => {
    if (!found.includes(n)) found.push(n);
  };
  const tokens = [...text.matchAll(WORD)].map((m) => {
    const [base, suffix] = m[0].split(/['’]/);
    return { base, suffix: suffix !== undefined, start: m.index!, end: m.index! + m[0].length };
  });
  const sentenceInitial = (start: number) => {
    let i = start - 1;
    while (i >= 0 && /[\s"“”'‘’«»(\[\-–—*•]/u.test(text[i])) i--;
    return i < 0 || /[.!?:;…\n\d)]/u.test(text[i]) || /\n/.test(text.slice(i, start));
  };
  // Yalnız tek boşlukla ayrılan (noktalama yok) komşu sözcük "bitişik" sayılır.
  const joined = (a: { end: number }, b: { start: number }) => /^ $/.test(text.slice(a.end, b.start));
  tokens.forEach((t, i) => {
    const strict = STRICT_NAMES.has(t.base), ambiguous = AMBIGUOUS_NAMES.has(t.base);
    if (!strict && !ambiguous) return;
    const prev = tokens[i - 1], next = tokens[i + 1];
    const prevJoined = prev && text.slice(prev.end, t.start).trim() === "" && !/\n/.test(text.slice(prev.end, t.start));
    if (prev && HONORIFICS.has(prev.base) && /^\.?\s+$/.test(text.slice(prev.end, t.start))) return;
    if (
      prev && prevJoined && capitalized(prev.base) && !prev.suffix &&
      (STRICT_NAMES.has(prev.base) || AMBIGUOUS_NAMES.has(prev.base) || t.suffix || !sentenceInitial(prev.start))
    ) return;
    if (next && !t.suffix && joined(t, next) && capitalized(next.base)) return;
    if (strict || t.suffix || !sentenceInitial(t.start)) add(t.base);
  });
  for (const re of [NAMED_TR, NAMED_EN]) {
    for (const m of text.matchAll(re)) add(m[1]);
  }
  return found;
}
export interface ContentReviewFlag {
  status: "needs_review";
  detector: "person-name/v1";
  flags: { code: "person_name"; names: string[]; fields: string[]; suggestion: string }[];
}
/** Çocuğun gördüğü alanlar (gövde, şıklar, ortak kaynak) taranır; bulunursa uyarı etiketi, yoksa null. */
export function personNameReview(
  q: Pick<GeneratedQuestion, "stem" | "choices">,
  shared: SharedSource | null,
  locale: "tr" | "en",
): ContentReviewFlag | null {
  const names: string[] = [], fields: string[] = [];
  const scan = (field: string, text: unknown) => {
    const hit = detectPersonNames(typeof text === "string" ? text : "");
    if (!hit.length) return;
    fields.push(field);
    for (const n of hit) if (!names.includes(n)) names.push(n);
  };
  scan("stem", q.stem);
  (Array.isArray(q.choices) ? q.choices : []).forEach((c) => scan(`choice_${c?.key ?? "?"}`, c?.text));
  if (shared) scan("shared_source", shared.content);
  if (!names.length) return null;
  const list = names.join(", ");
  const suggestion = locale === "en"
    ? `Replace the person name(s) (${list}) with a role such as "a student", "a friend" or "the teacher".`
    : `Kişi adı (${list}) yerine "bir öğrenci", "arkadaşı", "öğretmeni" gibi bir rol ifadesi kullanın.`;
  return {
    status: "needs_review",
    detector: "person-name/v1",
    flags: [{ code: "person_name", names, fields: [...new Set(fields)], suggestion }],
  };
}
export function validateGenerationResult(
  result: AiResult<GeneratedOutput>,
  context: GenerationContext,
) {
  const { total, topics, kind } = context;
  const questions = result?.output?.questions;
  const shared = result?.output?.shared_sources;
  const sharedIds = new Set<string>();
  if (!blank(shared)) {
    if (
      !Array.isArray(shared) || shared.length > 30 || shared.some((s) =>
        !s || typeof s.id !== "string" || !s.id.trim() || s.id.length > 60 ||
        !["text", "table", "visual_description"].includes(s.kind) ||
        typeof s.content !== "string" || !s.content.trim() ||
        s.content.length > 4000
      )
    ) throw new Error("ai_result_invalid");
    for (const s of shared!) sharedIds.add(s.id);
    if (sharedIds.size !== shared!.length) throw new Error("ai_result_invalid");
  }
  if (
    !Array.isArray(questions) || questions.length !== total ||
    questions.some((q) =>
      !q || typeof q.stem !== "string" || !q.stem.trim() ||
      q.stem.length > 10000 ||
      typeof q.expected_answer !== "string" || !q.expected_answer.trim() ||
      typeof q.solution !== "string" || !q.solution.trim() ||
      typeof q.topic !== "string" || !topics.some((t) => t.topic === q.topic) ||
      !["multiple_choice", "open_ended"].includes(q.kind) ||
      (kind !== "mixed" && q.kind !== kind) ||
      (q.kind === "multiple_choice" &&
        (!Array.isArray(q.choices) || q.choices.length !== 4 ||
          new Set(q.choices.map((c) => c?.key)).size !== 4 ||
          q.choices.some((c) =>
            !c || !["A", "B", "C", "D"].includes(c.key) ||
            typeof c.text !== "string" || !c.text.trim()
          ) ||
          !q.choices.some((c) => c.key === q.correct_key))) ||
      (q.explanation !== undefined && typeof q.explanation !== "string") ||
      (q.distractor_notes !== undefined &&
        (!Array.isArray(q.distractor_notes) ||
          q.distractor_notes.some((n) =>
            !n || typeof n.key !== "string" || typeof n.why !== "string"
          ))) ||
      !validateQuestionProvenance(q, context, sharedIds)
    ) ||
    topics.some((t) =>
      questions.filter((q) => q.topic === t.topic).length !== t.count
    ) ||
    // Every shared passage must be used; a shared source is one identity, linked questions count separately.
    [...sharedIds].some((id) =>
      !questions.some((q) => q.shared_source_id === id)
    ) ||
    !sharedStemsFit(questions, shared, context.locale)
  ) throw new Error("ai_result_invalid");
}
export async function finishGeneration(
  db: ReturnType<typeof serviceClient>,
  parent: { familyId: string; userId: string },
  requestId: string,
  lease: string,
  context: GenerationContext,
  result: AiResult<GeneratedOutput>,
) {
  if (context.schema !== "gina.generation-context.v1") {
    return fail("generation_context_unsupported", 409);
  }
  try {
    validateGenerationResult(result, context);
  } catch {
    return fail("ai_result_invalid", 502);
  }
  const {
    total,
    kind,
    topics,
    grade,
    subject,
    scenarioCode,
    difficulty,
    locale,
    blueprintSource,
    blueprintSnapshot,
    draftScope,
    document,
    ai,
    promptHash,
    userPrompt,
  } = context;
  const scenario = context.scenario ?? null;
  const sharedById = new Map(
    (result.output.shared_sources ?? []).map((s) => [s.id, s] as const),
  );
  const createdAt = new Date().toISOString();
  const rows = (result.output.questions ?? [])
    .slice(0, total)
    .filter((q) => q.stem?.trim())
    .filter((q) => kind === "mixed" || q.kind === kind)
    .map((q) => {
      const isMc = q.kind === "multiple_choice";
      const choices = isMc ? (q.choices ?? []).slice(0, 4) : null;
      const validMc = isMc && choices?.length === 4 &&
        new Set(choices.map((c) => c.key)).size === 4 && choices.every((c) =>
          ["A", "B", "C", "D"].includes(c.key) && c.text?.trim()
        ) && choices.some((c) =>
          c.key === q.correct_key
        );
      const notes = isMc && q.distractor_notes?.length
        ? `\n\n${locale === "tr" ? "Çeldiriciler" : "Distractors"}: ${
          q.distractor_notes.map((d) => `${d.key}) ${d.why}`).join(" ")
        }`
        : "";
      const sources = officialUrls(blueprintSource ? [blueprintSource] : []);
      const block = scenario?.blocks.find((b) => b.topic === q.topic) ?? null;
      const shared = q.shared_source_id
        ? sharedById.get(q.shared_source_id) ?? null
        : null;
      const review = personNameReview(q, shared, locale);
      const trace = {
        ...(scenario
          ? {
            scenario_version: scenario.scenario_version,
            catalogue_id: scenario.catalogue_id,
            catalogue_revision: scenario.revision,
            source_sha256: scenario.source.sha256,
            source_sheet: scenario.source.sheet,
          }
          : {}),
        ...(block || q.block_id
          ? { block_id: block?.block_id ?? q.block_id ?? null }
          : {}),
        ...(block ? { source_cells: block.source_cells } : {}),
        ...(Array.isArray(q.outcome_ids) && q.outcome_ids.length
          ? { outcome_ids: q.outcome_ids }
          : {}),
        ...(q.question_type ? { question_type: q.question_type } : {}),
        ...(q.cognitive_demand
          ? { cognitive_demand: q.cognitive_demand }
          : {}),
        ...(q.intended_difficulty
          ? { intended_difficulty: q.intended_difficulty }
          : {}),
        ...(q.rubric && q.rubric.criteria?.length ? { rubric: q.rubric } : {}),
        // One shared passage keeps one identity; linked questions stay separate rows. D1: the server groups
        // rows that share it (complete_prova_generation_v2 → question_source_groups) using shared_prompt.
        ...(shared
          ? {
            shared_source_id: shared.id,
            shared_source: shared,
            shared_source_title: sharedSourceTitle(shared.kind, locale),
            shared_prompt: q.stem.trim(),
          }
          : {}),
        ...(scenario ? { content_fit: "pending_human_review" } : {}),
        // D9/B6: kişi adı bulunursa soru reddedilmez; veli incelemesi için uyarı etiketi.
        ...(review ? { content_review: review } : {}),
      };
      return {
        valid: !!q.expected_answer?.trim() && !!q.solution?.trim() &&
          (isMc ? validMc : q.kind === "open_ended"),
        row: {
          family_id: parent.familyId,
          grade,
          subject,
          topic: q.topic?.trim() || topics[0].topic,
          scenario_code: scenarioCode,
          kind: q.kind,
          difficulty: DIFFICULTIES.includes(q.difficulty)
            ? q.difficulty
            : difficulty,
          stem: shared
            ? materializeSharedStem(shared, q.stem, locale)
            : q.stem.trim(),
          choices,
          correct_key: isMc ? q.correct_key : null,
          expected_answer: q.expected_answer?.trim() || null,
          solution: q.solution?.trim() || null,
          explanation: ((q.explanation?.trim() ?? "") + notes).trim() || null,
          source_urls: [...new Set(sources)],
          provenance: {
            generator: "ai",
            ...trace,
            ...(blueprintSnapshot ? { blueprint: blueprintSnapshot } : {}),
            ...(draftScope
              ? { draft_id: draftScope.id, draft_version: draftScope.version }
              : {}),
            ...(document
              ? {
                document_source_id: document.id,
                document_sha256: document.sha256,
              }
              : {}),
            model: ai.model,
            prompt_version: context.promptVersion,
            settings_prompt_version: ai.promptVersion,
            prompt_hash: promptHash,
            prompt: {
              system: context.systemPrompt,
              user: JSON.parse(userPrompt),
            },
            requested_by: parent.userId,
            created_at: createdAt,
          },
          created_by: parent.userId,
        },
      };
    })
    .filter((x) => x.valid)
    .map((x) => x.row);

  if (rows.length !== total) return fail("generation_empty", 502);
  const { data: completed, error: saveError } = await db.rpc(
    "complete_prova_generation_v2",
    {
      p_id: requestId,
      p_lease: lease,
      p_rows: rows,
      p_model: ai.model,
      p_prompt_version: context.promptVersion,
      p_input: result.inputTokens,
      p_output: result.outputTokens,
    },
  );
  // A transport failure may follow a successful commit: keep the job for a same-ID retry.
  if (saveError) return fail("save_failed", 500);
  return json(completed);
}
/** Resume persisted work before reading mutable plan/model/draft settings; never invokes a provider. */
export async function recoverGeneration(
  db: ReturnType<typeof serviceClient>,
  parent: { familyId: string; userId: string },
  requestId: string,
  intent: Record<string, unknown>,
  only = false,
) {
  const { data, error } = await db.rpc("resume_prova_generation", {
    p_id: requestId,
    p_family_id: parent.familyId,
    p_user_id: parent.userId,
    p_intent: intent,
  });
  if (error) {
    return fail(error.code === "42501" ? "forbidden" : "data_failed", error.code === "42501" ? 403 : 503);
  }
  if (!data) {
    return only ? fail("generation_not_started", 409) : null;
  }
  if (data.cached) return json(data.cached);
  // Rezervasyon kodu sözleşmeden geçer (bilinmeyen/ham metin `server_error`); durum eskisiyle aynı 409.
  if (data.error) return fail(String(data.error), 409);
  if (!data.lease || !data.context || !data.provider_result) {
    return fail("ai_result_uncertain", 503);
  }
  return finishGeneration(
    db,
    parent,
    requestId,
    data.lease,
    data.context,
    data.provider_result,
  );
}
