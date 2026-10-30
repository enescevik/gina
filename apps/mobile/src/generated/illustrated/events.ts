// OTOMATİK ÜRETİLDİ: node scripts/generate-illustrated.mjs — elle düzenleme.
// Kaynak: packages/assets/icons/events/illustrated-v3/manifest.json (20 slug, 256px WebP).

export const ILLUSTRATED_EVENTS = {
  "school": require("../../../../../packages/assets/generated/illustrated-v3/events/school.webp"),
  "class-schedule": require("../../../../../packages/assets/generated/illustrated-v3/events/class-schedule.webp"),
  "online-lesson": require("../../../../../packages/assets/generated/illustrated-v3/events/online-lesson.webp"),
  "activity": require("../../../../../packages/assets/generated/illustrated-v3/events/activity.webp"),
  "club": require("../../../../../packages/assets/generated/illustrated-v3/events/club.webp"),
  "sports-event": require("../../../../../packages/assets/generated/illustrated-v3/events/sports-event.webp"),
  "holiday": require("../../../../../packages/assets/generated/illustrated-v3/events/holiday.webp"),
  "school-break": require("../../../../../packages/assets/generated/illustrated-v3/events/school-break.webp"),
  "public-holiday": require("../../../../../packages/assets/generated/illustrated-v3/events/public-holiday.webp"),
  "exam": require("../../../../../packages/assets/generated/illustrated-v3/events/exam.webp"),
  "homework-due": require("../../../../../packages/assets/generated/illustrated-v3/events/homework-due.webp"),
  "family": require("../../../../../packages/assets/generated/illustrated-v3/events/family.webp"),
  "birthday": require("../../../../../packages/assets/generated/illustrated-v3/events/birthday.webp"),
  "visit": require("../../../../../packages/assets/generated/illustrated-v3/events/visit.webp"),
  "doctor": require("../../../../../packages/assets/generated/illustrated-v3/events/doctor.webp"),
  "parent-meeting": require("../../../../../packages/assets/generated/illustrated-v3/events/parent-meeting.webp"),
  "trip": require("../../../../../packages/assets/generated/illustrated-v3/events/trip.webp"),
  "reminder": require("../../../../../packages/assets/generated/illustrated-v3/events/reminder.webp"),
  "shopping": require("../../../../../packages/assets/generated/illustrated-v3/events/shopping.webp"),
  "other": require("../../../../../packages/assets/generated/illustrated-v3/events/other.webp"),
} as const;

export type IllustratedEventsSlug = keyof typeof ILLUSTRATED_EVENTS;

export const ILLUSTRATED_EVENTS_SLUGS = Object.keys(ILLUSTRATED_EVENTS) as IllustratedEventsSlug[];

export function isIllustratedEventsSlug(slug: string | null | undefined): slug is IllustratedEventsSlug {
  return !!slug && Object.prototype.hasOwnProperty.call(ILLUSTRATED_EVENTS, slug);
}
