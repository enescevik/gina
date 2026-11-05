export interface StarEventLike {
  delta: number;
}

/** Append-only yıldız defterinden bakiye: istemci ve sunucu aynı toplamı hesaplar. */
export function starBalance(events: readonly StarEventLike[]): number {
  return events.reduce((sum, e) => sum + e.delta, 0);
}

/** Q02-3: `child_star_balance` RPC çıktısı. Bozuk/eksik alan 0 sayılır (eski boş defter görünümü). */
export interface ChildStarBalance {
  balance: number;
  todayDelta: number;
}

const whole = (value: unknown): number => (typeof value === "number" && Number.isInteger(value) ? value : 0);

export function readChildStarBalance(raw: unknown): ChildStarBalance {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { balance: whole(r.balance), todayDelta: whole(r.today_delta) };
}

/** Q02-3: `family_star_balances` satırları → çocuk başına bakiye. Satırı olmayan çocuk 0 okunur. */
export function starTotalsByChild(
  rows: readonly { child_id: string; balance: number }[] | null | undefined,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows ?? []) totals.set(row.child_id, (totals.get(row.child_id) ?? 0) + whole(row.balance));
  return totals;
}
