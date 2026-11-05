/** A school calendar is not a child's education history or an automatic promotion. */
export const EDUCATION_STAGES = [
  "preschool",
  "primary",
  "middle",
  "high",
  "university",
] as const;
export type EducationStage = (typeof EDUCATION_STAGES)[number];
export const DEFAULT_EDUCATION_PLACE = "ec000000-0000-4000-8000-000000000001";
export type EducationPlace = {
  id: string;
  kind: "country" | "region" | "school";
  parent_id: string | null;
  name: string;
  revision: number;
  active: boolean;
};
export type SchoolCalendarValue = {
  title: string;
  source_url: string;
  verified_on: string;
  starts_on: string;
  ends_on: string;
  terms: { title: string; starts_on: string; ends_on: string }[];
};
export type SchoolCalendar = {
  id: string;
  place_id: string;
  stage: EducationStage;
  academic_year: number;
  draft: SchoolCalendarValue;
  published: SchoolCalendarValue | null;
  revision: number;
  published_revision: number | null;
};
export type EducationCalendarMatch = {
  id: string;
  revision: number;
  place_id: string;
  place_name: string;
  stage: EducationStage;
  academic_year: number;
  value: SchoolCalendarValue;
};
export type EducationCalendarPreview = {
  calendar: EducationCalendarMatch | null;
  warning:
    | "calendar_missing"
    | "outside_year"
    | "outside_transition"
    | "outside_term"
    | null;
};
export type EducationCatalog = {
  places: EducationPlace[];
  location: { place_id: string; stage: EducationStage } | null;
};
export function stageForGrade(grade: number | null): EducationStage | null {
  if (grade === null) return null;
  if (grade === 0) return "preschool";
  return grade <= 4 ? "primary" : grade <= 8 ? "middle" : "high";
}
export function educationPlaceLabel(
  place: EducationPlace,
  places: EducationPlace[],
): string {
  const names = [place.name];
  let parent = place.parent_id;
  const seen = new Set([place.id]);
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const p = places.find((x) => x.id === parent);
    if (!p) break;
    names.unshift(p.name);
    parent = p.parent_id;
  }
  return names.join(" / ");
}
