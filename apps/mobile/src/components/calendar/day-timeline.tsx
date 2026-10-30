import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import type { Occurrence } from "@gina/core";

import type { WeekEvent } from "@/components/calendar/week-list";
import { EventIcon } from "@/components/event-icon";

export interface DayTimelineProps {
  occurrences: Occurrence<WeekEvent>[];
  timeZone: string;
  /** Etkinliğin kime ait olduğu satırı (ör. «Ece ve Can», «Tüm aile»). */
  whoOf: (event: WeekEvent) => string;
  /** Şu an: geçmiş/şimdiki etkinlik dolu nokta, gelecek olanlar boş nokta. */
  now?: Date;
}

const DOT = 14;
const ROW_MIN = 52;

/**
 * Veli ana sayfası «Bugünün planı»: dikey zaman çizelgesi (saat · ikon · başlık · kişiler).
 * Noktalar ve bağlantı çizgisi şimdilik native.
 * TODO(BRIEF 13 / E.4): Codex `timeline-dot-filled`, `timeline-dot-empty`, `timeline-line` kaplamalarını teslim edince
 * skins.ts'e ekle; aşağıdaki nokta View'ını <SkinIcon skin=…/>, çizgiyi <NineSlice skin="timeline-line"/> ile değiştir.
 */
export function DayTimeline({ occurrences, timeZone, whoOf, now = new Date() }: DayTimelineProps) {
  const { t, i18n } = useTranslation();
  const timeFormat = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone });
  // İlk gelecek (ya da süren) etkinlik vurgulanır; hepsi geçtiyse sonuncusu.
  const upcomingIndex = Math.max(
    0,
    occurrences.findIndex((o) => o.event.all_day || (o.endsAt ?? o.startsAt).getTime() >= now.getTime()),
  );

  return (
    <View>
      {occurrences.map((o, i) => {
        const last = i === occurrences.length - 1;
        const filled = i <= upcomingIndex;
        const time = o.event.all_day ? t("calendar.allDay") : timeFormat.format(o.startsAt);
        const who = whoOf(o.event);
        return (
          <View
            key={`${o.event.id}:${o.date}`}
            accessible
            accessibilityLabel={`${time}, ${o.event.title}, ${who}`}
            className="flex-row"
            style={{ minHeight: ROW_MIN }}
          >
            {/* Zaman çizelgesi sütunu: nokta + sonraki satıra uzanan çizgi */}
            <View className="items-center" style={{ width: DOT + 8 }} importantForAccessibility="no-hide-descendants">
              <View
                className={filled ? "bg-teal" : "border-2 border-teal/60 bg-teal-light"}
                style={{ width: DOT, height: DOT, borderRadius: DOT / 2, marginTop: 13 }}
              />
              {last ? null : <View className="flex-1 bg-teal/40" style={{ width: 2, marginTop: 2 }} />}
            </View>
            <Text className="font-body-bold text-base text-ink" style={{ width: 64, marginLeft: 8, marginTop: 8 }}>
              {time}
            </Text>
            <View style={{ marginTop: 2 }}>
              <EventIcon type={o.event.type} size={36} />
            </View>
            <View className="flex-1" style={{ marginLeft: 10, marginTop: 6, paddingBottom: last ? 0 : 12 }}>
              <Text className="font-body-bold text-base text-ink">{o.event.title}</Text>
              <Text className="font-body text-sm text-gray-600">{who}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
