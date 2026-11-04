import type { QueryClient } from "@tanstack/react-query";

// Parent and child screens use different projections of the same server records.
// Inactive queries must also become stale before switching role on the same phone.
const TASK_PROJECTIONS = [
  "approvals", "family_completions", "family_star_totals",
  "task_completions", "task_completions_week", "star_balance", "star_events", "child_badges", "child_goal",
];
export function invalidateTaskState(client: QueryClient) {
  return client.invalidateQueries({
    predicate: query => TASK_PROJECTIONS.includes(String(query.queryKey[0])),
  });
}
