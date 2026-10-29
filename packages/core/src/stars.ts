export interface StarEventLike {
  delta: number;
}

/** Append-only yıldız defterinden bakiye: istemci ve sunucu aynı toplamı hesaplar. */
export function starBalance(events: readonly StarEventLike[]): number {
  return events.reduce((sum, e) => sum + e.delta, 0);
}
