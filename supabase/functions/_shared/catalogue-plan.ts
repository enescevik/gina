import { canonicalSubject } from "./blueprint-plan.ts";
export interface CatalogueOutcome {
  text: string;
  code: string | null;
  cell: string;
}
export interface CatalogueBlock {
  topic: string;
  block_id: string;
  count: number;
  outcomes: CatalogueOutcome[];
  /** Stable per-outcome ids: the official code when present, otherwise the source cell. */
  outcome_ids: string[];
  source_cells: { sheet: string; count_cell: string; outcome_cells: string[] };
  /** Full normalized outcome wording that goes to the provider; never only a URL. */
  normalized_text: string;
}
export interface ScenarioProvenance {
  scenario_version: string;
  catalogue_id: string | null;
  revision: number | null;
  content_hash: string | null;
  source: {
    url: string | null;
    sha256: string | null;
    sheet: string | null;
    header_cell: string | null;
  };
  blocks: {
    block_id: string;
    topic: string;
    count: number;
    outcome_ids: string[];
    source_cells: { sheet: string; count_cell: string; outcome_cells: string[] };
  }[];
}
export const outcomeId = (o: CatalogueOutcome) =>
  o.code && o.code.trim() ? o.code.trim() : `cell:${o.cell}`;
export const normalizeOutcomeText = (text: string) =>
  text.replace(/\s+/g, " ").trim();
const str = (v: unknown) => typeof v === "string" && v ? v : null;
/** This argument comes only from the private server binding, never from caller JSON. */
export function cataloguePlan(
  raw: unknown,
  grade: number,
  subject: string,
  topics: { topic: string; count: number }[],
) {
  if (!raw || typeof raw !== "object") throw Error("curriculum_scope_mismatch");
  const v = raw as Record<string, unknown>,
    candidate = v.candidate as Record<string, unknown>;
  if (
    v.origin !== "reviewed_catalogue" || !candidate ||
    candidate.grade !== grade ||
    canonicalSubject(candidate.subject) !== canonicalSubject(subject) ||
    !Array.isArray(candidate.blocks) ||
    candidate.blocks.length !== topics.length
  ) throw Error("curriculum_scope_mismatch");
  const sheet = str(candidate.sheet) ?? "";
  const blocks: CatalogueBlock[] = candidate.blocks.map((raw, index) => {
    const block = raw as {
      count: number;
      count_cell?: string;
      outcomes: CatalogueOutcome[];
    };
    if (
      topics[index].topic !== `Blok ${index + 1}` ||
      topics[index].count !== block.count || !Array.isArray(block.outcomes) ||
      !block.outcomes.length || block.outcomes.some((o) =>
        !o || typeof o.text !== "string" || !o.text ||
        typeof o.cell !== "string" || !o.cell
      )
    ) throw Error("curriculum_scope_mismatch");
    const outcomes = block.outcomes.map((o) => ({
      text: o.text,
      code: o.code ?? null,
      cell: o.cell,
    }));
    const ids = outcomes.map(outcomeId);
    if (new Set(ids).size !== ids.length) throw Error("curriculum_scope_mismatch");
    return {
      topic: topics[index].topic,
      block_id: `B${index + 1}`,
      count: block.count,
      outcomes,
      outcome_ids: ids,
      source_cells: {
        sheet,
        count_cell: str(block.count_cell) ?? "",
        outcome_cells: outcomes.map((o) => o.cell),
      },
      normalized_text: outcomes.map((o) =>
        `${outcomeId(o)}: ${normalizeOutcomeText(o.text)}`
      ).join("\n"),
    };
  });
  if (blocks.reduce((n, b) => n + b.count, 0) !== candidate.question_count) {
    throw Error("curriculum_scope_mismatch");
  }
  const catalogueId = str(v.catalogue_id), contentHash = str(v.content_hash);
  const revision = Number.isInteger(v.revision) ? Number(v.revision) : null;
  const scenario: ScenarioProvenance = {
    scenario_version: `${catalogueId ?? "catalogue"}@${revision ?? 0}:${
      (contentHash ?? "").slice(0, 12)
    }`,
    catalogue_id: catalogueId,
    revision,
    content_hash: contentHash,
    source: {
      url: str(candidate.source_url),
      sha256: str(candidate.source_sha256),
      sheet: str(candidate.sheet),
      header_cell: str(candidate.header_cell),
    },
    blocks: blocks.map((b) => ({
      block_id: b.block_id,
      topic: b.topic,
      count: b.count,
      outcome_ids: b.outcome_ids,
      source_cells: b.source_cells,
    })),
  };
  return {
    ...v,
    candidate,
    officially_verified: false,
    scenario,
    learning_blocks: blocks,
    generation_guidance:
      "Her bloğun tam öğrenme çıktılarını ve soru sayısını koru; topic alanında blok anahtarını aynen kullan. Her soru için block_id ve ölçtüğü outcome_ids değerlerini bu listeden ver; bir soru birden çok çıktıyı ölçebilir ama blok sayısı çıktı sayısıyla çarpılmaz. Ortak metin/görsel kullanan sorular aynı shared_source_id'yi taşır; ortak kaynak tek kez yazılır. Bunlar MEB onaylı sınav soruları değil, özgün çalışma taslaklarıdır.",
  };
}

export interface PoolQuestion {
  id: string;
  outcome_ids: string[];
  kind?: string;
}
/**
 * Picks library questions for a scenario's blocks without inventing filler: a question is used once, must share
 * at least one outcome id with the block, and every shortfall is reported per block instead of being hidden.
 * Pool size (e.g. 20 per grade/subject) is unrelated to the exam size (e.g. 7); a combined block counts once.
 */
export function planPoolSelection(
  blocks: { block_id: string; count: number; outcome_ids: string[]; kind?: string }[],
  pool: PoolQuestion[],
) {
  const used = new Set<string>();
  const picks = blocks.map((block) => {
    const chosen: string[] = [];
    for (const q of pool) {
      if (chosen.length >= block.count) break;
      if (used.has(q.id)) continue;
      if (block.kind && q.kind && block.kind !== q.kind) continue;
      if (!q.outcome_ids.some((id) => block.outcome_ids.includes(id))) continue;
      used.add(q.id);
      chosen.push(q.id);
    }
    return {
      block_id: block.block_id,
      required: block.count,
      question_ids: chosen,
      missing: block.count - chosen.length,
      missing_outcome_ids: block.outcome_ids.filter((id) =>
        !pool.some((q) => chosen.includes(q.id) && q.outcome_ids.includes(id))
      ),
    };
  });
  const total = blocks.reduce((n, b) => n + b.count, 0);
  return {
    total,
    selected: picks.reduce((n, p) => n + p.question_ids.length, 0),
    complete: picks.every((p) => p.missing === 0),
    scenario_fit: picks.every((p) => p.missing === 0)
      ? "full_scenario"
      : "incomplete_show_gaps",
    blocks: picks,
  };
}
