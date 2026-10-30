import { View } from "react-native";

import { ILLUSTRATED_EVENTS, isIllustratedEventsSlug, type IllustratedEventsSlug } from "@/generated/illustrated/events";

import SvgActivity from "../../../../packages/assets/icons/events/color/activity.svg";
import SvgBirthday from "../../../../packages/assets/icons/events/color/birthday.svg";
import SvgClassSchedule from "../../../../packages/assets/icons/events/color/class-schedule.svg";
import SvgClub from "../../../../packages/assets/icons/events/color/club.svg";
import SvgDoctor from "../../../../packages/assets/icons/events/color/doctor.svg";
import SvgExam from "../../../../packages/assets/icons/events/color/exam.svg";
import SvgFamily from "../../../../packages/assets/icons/events/color/family.svg";
import SvgHoliday from "../../../../packages/assets/icons/events/color/holiday.svg";
import SvgHomeworkDue from "../../../../packages/assets/icons/events/color/homework-due.svg";
import SvgOnlineLesson from "../../../../packages/assets/icons/events/color/online-lesson.svg";
import SvgOther from "../../../../packages/assets/icons/events/color/other.svg";
import SvgParentMeeting from "../../../../packages/assets/icons/events/color/parent-meeting.svg";
import SvgPublicHoliday from "../../../../packages/assets/icons/events/color/public-holiday.svg";
import SvgReminder from "../../../../packages/assets/icons/events/color/reminder.svg";
import SvgSchoolBreak from "../../../../packages/assets/icons/events/color/school-break.svg";
import SvgSchool from "../../../../packages/assets/icons/events/color/school.svg";
import SvgShopping from "../../../../packages/assets/icons/events/color/shopping.svg";
import SvgSportsEvent from "../../../../packages/assets/icons/events/color/sports-event.svg";
import SvgTrip from "../../../../packages/assets/icons/events/color/trip.svg";
import SvgVisit from "../../../../packages/assets/icons/events/color/visit.svg";

import { IllustratedImage, shouldUseIllustrated, type IconVariant } from "./illustrated-image";

const EVENT_SVGS: Record<IllustratedEventsSlug, typeof SvgOther> = {
  "activity": SvgActivity,
  "birthday": SvgBirthday,
  "class-schedule": SvgClassSchedule,
  "club": SvgClub,
  "doctor": SvgDoctor,
  "exam": SvgExam,
  "family": SvgFamily,
  "holiday": SvgHoliday,
  "homework-due": SvgHomeworkDue,
  "online-lesson": SvgOnlineLesson,
  "other": SvgOther,
  "parent-meeting": SvgParentMeeting,
  "public-holiday": SvgPublicHoliday,
  "reminder": SvgReminder,
  "school-break": SvgSchoolBreak,
  "school": SvgSchool,
  "shopping": SvgShopping,
  "sports-event": SvgSportsEvent,
  "trip": SvgTrip,
  "visit": SvgVisit,
};

export interface EventIconProps {
  /** Etkinlik türü (events.type: school, activity, exam…) veya manifest slug'ı; bilinmeyen → "other". */
  type: string | null | undefined;
  size?: number;
  /** auto: ≥64 dp resimli WebP; svg: native; illustrated: ≥48 dp resim (altında SVG). */
  variant?: IconVariant;
  accessibilityLabel?: string;
}

/** Etkinlik ikonu (takvim). Mevcut 8 EventType değerinin tümü manifestte aynı slug ile var. */
export function EventIcon({ type, size = 40, variant = "auto", accessibilityLabel }: EventIconProps) {
  const slug: IllustratedEventsSlug = isIllustratedEventsSlug(type) ? type : "other";
  if (shouldUseIllustrated(variant, size, true)) {
    return <IllustratedImage source={ILLUSTRATED_EVENTS[slug]} size={size} accessibilityLabel={accessibilityLabel} />;
  }
  const Svg = EVENT_SVGS[slug];
  return (
    <View
      style={{ width: size, height: size }}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? "auto" : "no-hide-descendants"}
    >
      <Svg width={size} height={size} />
    </View>
  );
}
