// OTOMATİK ÜRETİLDİ: node scripts/generate-illustrated.mjs — elle düzenleme.
// Kaynak: packages/assets/icons/subjects/illustrated-v3/manifest.json (19 slug, 256px WebP).

export const ILLUSTRATED_SUBJECTS = {
  "turkish": require("../../../../../packages/assets/generated/illustrated-v3/subjects/turkish.webp"),
  "math": require("../../../../../packages/assets/generated/illustrated-v3/subjects/math.webp"),
  "life-science": require("../../../../../packages/assets/generated/illustrated-v3/subjects/life-science.webp"),
  "science": require("../../../../../packages/assets/generated/illustrated-v3/subjects/science.webp"),
  "social-studies": require("../../../../../packages/assets/generated/illustrated-v3/subjects/social-studies.webp"),
  "citizenship": require("../../../../../packages/assets/generated/illustrated-v3/subjects/citizenship.webp"),
  "english": require("../../../../../packages/assets/generated/illustrated-v3/subjects/english.webp"),
  "religion-ethics": require("../../../../../packages/assets/generated/illustrated-v3/subjects/religion-ethics.webp"),
  "physical-education": require("../../../../../packages/assets/generated/illustrated-v3/subjects/physical-education.webp"),
  "play-physical": require("../../../../../packages/assets/generated/illustrated-v3/subjects/play-physical.webp"),
  "music": require("../../../../../packages/assets/generated/illustrated-v3/subjects/music.webp"),
  "visual-arts": require("../../../../../packages/assets/generated/illustrated-v3/subjects/visual-arts.webp"),
  "ict": require("../../../../../packages/assets/generated/illustrated-v3/subjects/ict.webp"),
  "technology-design": require("../../../../../packages/assets/generated/illustrated-v3/subjects/technology-design.webp"),
  "traffic-safety": require("../../../../../packages/assets/generated/illustrated-v3/subjects/traffic-safety.webp"),
  "free-activity": require("../../../../../packages/assets/generated/illustrated-v3/subjects/free-activity.webp"),
  "guidance": require("../../../../../packages/assets/generated/illustrated-v3/subjects/guidance.webp"),
  "study-hall": require("../../../../../packages/assets/generated/illustrated-v3/subjects/study-hall.webp"),
  "elective": require("../../../../../packages/assets/generated/illustrated-v3/subjects/elective.webp"),
} as const;

export type IllustratedSubjectsSlug = keyof typeof ILLUSTRATED_SUBJECTS;

export const ILLUSTRATED_SUBJECTS_SLUGS = Object.keys(ILLUSTRATED_SUBJECTS) as IllustratedSubjectsSlug[];

export function isIllustratedSubjectsSlug(slug: string | null | undefined): slug is IllustratedSubjectsSlug {
  return !!slug && Object.prototype.hasOwnProperty.call(ILLUSTRATED_SUBJECTS, slug);
}
