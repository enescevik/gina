export function canonicalSubject(value: unknown) {
  return value === "İlköğretim Matematik"
    ? "Matematik"
    : value === "Fen"
    ? "Fen Bilimleri"
    : value;
}
/** Parent input is a distribution, never evidence that an official source was verified. */
export function blueprintPlan(
  raw: {
    id?: string;
    name: unknown;
    grade: unknown;
    subject: unknown;
    rows: unknown;
    source_context?: unknown;
  },
  grade: number,
  subject: string,
) {
  if (
    raw.grade !== grade ||
    canonicalSubject(raw.subject) !== canonicalSubject(subject)
  ) {
    throw Error("blueprint_mismatch");
  }
  if (
    typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 100 ||
    !Array.isArray(raw.rows) || raw.rows.length < 1 || raw.rows.length > 30
  ) throw Error("blueprint_invalid");
  const topics = raw.rows.map((r: unknown) => {
    if (
      !r || typeof r !== "object" || !("topic" in r) ||
      typeof r.topic !== "string" || !r.topic.trim() || r.topic.length > 200 ||
      !("count" in r) || !Number.isInteger(r.count) || Number(r.count) < 1 ||
      Number(r.count) > 30
    ) throw Error("blueprint_invalid");
    return { topic: r.topic.trim(), count: Number(r.count) };
  });
  if (
    new Set(topics.map((t) => t.topic)).size !== topics.length ||
    topics.reduce((s, t) => s + t.count, 0) > 30
  ) throw Error("blueprint_invalid");
  const rawContext =
    raw.source_context && typeof raw.source_context === "object"
      ? raw.source_context as Record<string, unknown>
      : {};
  const year = rawContext.academic_year;
  const context = {
    origin: "parent_entered",
    officially_verified: false,
    ...(typeof year === "string" && /^20\d{2}-20\d{2}$/.test(year) &&
        Number(year.slice(5)) === Number(year.slice(0, 4)) + 1
      ? { academic_year: year }
      : {}),
    ...([1, 2].includes(Number(rawContext.term))
      ? { term: Number(rawContext.term) }
      : {}),
    ...([1, 2].includes(Number(rawContext.exam))
      ? { exam: Number(rawContext.exam) }
      : {}),
  };
  return { topics, name: raw.name.trim(), context };
}
