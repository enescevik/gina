export const interests = [
  "reading",
  "science",
  "art",
  "music",
  "sports",
  "nature",
];
export const taskIcons = [
  "brush-teeth",
  "read-book",
  "tidy-room",
  "pack-school-bag",
  "water-plants",
  "task-custom",
];
export const rewardIcons = [
  "reward-movie-night",
  "reward-book",
  "reward-park",
  "reward-game-with-parent",
  "reward-mystery-box",
];
/** Explicit allowlist: never forward names, birthdays, gender, school names or arbitrary prompts. */
export function setupInput(raw: Record<string, unknown>) {
  if (!["task", "reward"].includes(String(raw.kind)))
    throw Error("invalid_input");
  const grade =
    raw.grade === null || raw.grade === undefined ? null : raw.grade;
  if (
    grade !== null &&
    (!Number.isInteger(grade) || Number(grade) < 0 || Number(grade) > 12)
  )
    throw Error("invalid_input");
  const ageBand = raw.age_band ?? null;
  if (
    ageBand !== null &&
    !["2-5", "6-9", "10-13", "14-18"].includes(String(ageBand))
  )
    throw Error("invalid_input");
  const selected = Array.isArray(raw.interests) ? raw.interests : [];
  if (
    selected.length > 6 ||
    selected.some((i) => !interests.includes(String(i)))
  )
    throw Error("invalid_input");
  return {
    kind: raw.kind as "task" | "reward",
    grade,
    age_band: ageBand,
    interests: selected,
    locale: raw.locale === "en" ? "en" : "tr",
  };
}
export function validateDrafts(raw: unknown, kind: "task" | "reward") {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 3)
    throw Error("invalid_output");
  return raw.map((item) => {
    if (
      !item ||
      typeof item.title !== "string" ||
      !item.title.trim() ||
      item.title.length > 80 ||
      typeof item.reason !== "string" ||
      item.reason.length > 220 ||
      !Number.isInteger(item.stars) ||
      item.stars < 1 ||
      item.stars > (kind === "task" ? 5 : 100) ||
      !(kind === "task" ? taskIcons : rewardIcons).includes(item.icon)
    )
      throw Error("invalid_output");
    return {
      title: item.title.trim(),
      reason: item.reason,
      stars: item.stars as number,
      icon: item.icon as string,
    };
  });
}
