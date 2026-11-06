import type { NotebookDocument, Phase2aAnswer, StructuredAnswer } from "@gina/core";

interface AnswerValue {
  key?: string;
  text?: string;
  document?: NotebookDocument;
  /** QT: sürümlü yapılandırılmış cevap (submit_exam_answer_v4 p_answer). */
  answer?: StructuredAnswer | Phase2aAnswer;
}

export type SavedAnswer = AnswerValue & { revision?: number };
export type SavedAnswers = Record<string, SavedAnswer>;

// Journal validation and jsonb reads may change object key order. Compare
// notebook content, while preserving array order (layers and stroke points).
function sameContent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
      a.every((value, index) => sameContent(value, b[index]));
  }
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) =>
    Object.prototype.hasOwnProperty.call(right, key) && sameContent(left[key], right[key])
  );
}

export function sameAnswer(a: SavedAnswer | undefined, b: SavedAnswer | undefined) {
  return a?.key === b?.key && a?.text === b?.text &&
    sameContent(a?.document, b?.document) &&
    sameContent(a?.answer ?? null, b?.answer ?? null);
}

/** A read begun before an acknowledgement must not roll that answer back.
 * Attempt answers are revisioned and are never deleted individually. */
export function mergeAnswerSnapshot(previous: unknown, incoming: unknown): SavedAnswers {
  const old = (previous ?? {}) as SavedAnswers;
  const next = { ...(incoming as SavedAnswers) };
  for (const [id, answer] of Object.entries(old)) {
    if (!next[id] || (answer.revision ?? 0) > (next[id].revision ?? 0)) {
      next[id] = answer;
    }
  }
  return next;
}

/** Release only the acknowledged edit. A later local edit stays visible and
 * receives the new base revision while the journal sends its next receipt. */
export function acknowledgeAnswerDraft(
  drafts: SavedAnswers,
  id: string,
  answer: AnswerValue,
  revision: number,
): SavedAnswers {
  const draft = drafts[id];
  if (!draft || (draft.revision ?? 0) > revision) return drafts;
  if (!sameAnswer(draft, answer)) {
    return { ...drafts, [id]: { ...draft, revision } };
  }
  const next = { ...drafts };
  delete next[id];
  return next;
}

/** Editable review state is based on one server revision. Refresh when opening
 * it, never implicitly remount/rebase it on reconnect or app focus. The save RPC
 * still checks the revision and answer hash for changes from another parent. */
export const REVIEW_SNAPSHOT_OPTIONS = {
  staleTime: 0,
  refetchOnMount: "always" as const,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
};
