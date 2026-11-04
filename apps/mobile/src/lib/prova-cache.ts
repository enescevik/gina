import type { QueryClient } from "@tanstack/react-query";

/** Refresh read-only summaries, including inactive parent/child routes.
 * Never refetch start_exam_attempt or overwrite an open answer/review draft. */
export function invalidateProvaLists(client: QueryClient) {
  return client.invalidateQueries({
    predicate: query => ["exams", "child_exams", "child_exam_count"].includes(String(query.queryKey[0])),
  });
}
