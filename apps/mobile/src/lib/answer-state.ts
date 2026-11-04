import type { NotebookDocument } from "@gina/core";

interface AnswerValue {
  key?: string;
  text?: string;
  document?: NotebookDocument;
}

export type SavedAnswer = AnswerValue & { revision?: number };
export type SavedAnswers = Record<string, SavedAnswer>;

export function sameAnswer(a: SavedAnswer | undefined, b: SavedAnswer | undefined) {
  return a?.key === b?.key && a?.text === b?.text &&
    JSON.stringify(a?.document) === JSON.stringify(b?.document);
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
