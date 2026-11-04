import { isCalendarDate } from "./form-validation";
export type WeekRecord = {
  id: string;
  child_id: string;
  due_date: string;
  status: string;
};
/** Counts observed records only: missing entries never mean missed tasks. */
export function recordedWeek(
  records: readonly WeekRecord[],
  children: readonly string[],
  from: string,
  to: string,
) {
  const result = { approved: 0, pending: 0, returned: 0 };
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) return result;
  const allowed = new Set(children), seen = new Set<string>();
  for (const row of records) {
    if (
      !allowed.has(row.child_id) || seen.has(row.id) ||
      !isCalendarDate(row.due_date) || row.due_date < from || row.due_date > to
    ) continue;
    seen.add(row.id);
    if (row.status === "approved") result.approved++;
    else if (row.status === "done") result.pending++;
    else if (row.status === "returned") result.returned++;
  }
  return result;
}
