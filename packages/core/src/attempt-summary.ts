/** Finish RPC totals can precede the AFTER trigger. Question snapshots provide
 * counts while the submitted response is still missing those totals. */
export function attemptSummary(
  result: {
    mc_total: number | null;
    mc_correct: number | null;
    open_total: number | null;
    open_graded: number | null;
  },
  questions: readonly { kind: string }[],
) {
  const mcTotal = result.mc_total ??
    questions.filter((q) => q.kind === "multiple_choice").length;
  const openTotal = result.open_total ??
    questions.filter((q) => q.kind === "open_ended").length;
  return {
    mcTotal,
    mcCorrect: result.mc_correct ?? 0,
    pendingReview: (result.open_graded ?? 0) < openTotal,
  };
}
