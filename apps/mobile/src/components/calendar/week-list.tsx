import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { DEFAULT_TIMEZONE, type EventType, type Occurrence } from "@gina/core";

export interface WeekEvent {
  id: string;
  title: string;
  type: EventType;
  child_id: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  rrule: string | null;
  location: string | null;
  childName?: string | null;
}

const TYPE_TONE: Record<EventType, string> = {
  school: "bg-blue-light",
  activity: "bg-green-light",
  holiday: "bg-orange-light",
  exam: "bg-coral-light",
  family: "bg-purple-light",
  doctor: "bg-sky-light",
  birthday: "bg-purple-light",
  other: "bg-mist",
};

export interface WeekListProps {
  week: string[];
  occurrences: Occurrence<WeekEvent>[];
  today: string;
  timeZone?: string;
  /** Çocuk görünümünde çocuk adı gösterilmez. */
  showChild?: boolean;
}

/** Haftanın günleri ve o güne düşen etkinlikler; ders programı ve tek seferlik etkinlikler aynı listede. */
export function WeekList({ week, occurrences, today, timeZone = DEFAULT_TIMEZONE, showChild = true }: WeekListProps) {
  const { t, i18n } = useTranslation();
  const dayFormat = new Intl.DateTimeFormat(i18n.language, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const timeFormat = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit", timeZone });

  return (
    <View className="gap-3">
      {week.map((date) => {
        const items = occurrences.filter((o) => o.date === date);
        const isToday = date === today;
        return (
          <View key={date} className={`gap-2 rounded-parent p-3 ${isToday ? "bg-teal-light" : "bg-white dark:bg-night-surface"}`}>
            <Text className={`text-base font-semibold ${isToday ? "text-teal-dark" : "text-ink dark:text-night-text"}`}>
              {dayFormat.format(new Date(`${date}T00:00:00Z`))}
              {isToday ? ` · ${t("calendar.today")}` : ""}
            </Text>
            {items.length === 0 ? <Text className="text-sm text-gray-500">{t("calendar.noEvents")}</Text> : null}
            {items.map((o) => (
              <View key={`${o.event.id}:${o.date}`} className={`flex-row items-center gap-3 rounded-parent p-2 ${TYPE_TONE[o.event.type]}`}>
                <Text className="w-24 text-sm font-medium text-ink">
                  {o.event.all_day ? t("calendar.allDay") : `${timeFormat.format(o.startsAt)}${o.endsAt ? `–${timeFormat.format(o.endsAt)}` : ""}`}
                </Text>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-ink">{o.event.title}</Text>
                  <Text className="text-xs text-gray-600">
                    {t(`event.type.${o.event.type}`)}
                    {showChild ? ` · ${o.event.childName ?? t("calendar.allFamily")}` : ""}
                    {o.event.location ? ` · ${o.event.location}` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
