// Stable IDs; labels live in i18n. All templates are editable, never assigned by gender.
export const TASK_STARTERS = [
  { id: "teeth", icon: "brush-teeth", stars: 1, days: [1, 2, 3, 4, 5, 6, 7] },
  { id: "reading", icon: "read-book", stars: 2, days: [1, 2, 3, 4, 5] },
  { id: "bag", icon: "pack-school-bag", stars: 1, days: [1, 2, 3, 4, 5] },
  { id: "plants", icon: "water-plants", stars: 1, days: [6] },
] as const;
export const REWARD_STARTERS = [
  { id: "movie", icon: "reward-movie-night", cost: 20 },
  { id: "picnic", icon: "reward-park", cost: 15 },
  { id: "book", icon: "reward-book", cost: 30 },
] as const;
