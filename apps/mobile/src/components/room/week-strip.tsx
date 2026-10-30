import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

/** Local presentation selection; the already-fetched week and server data never change. */
export function WeekStrip({ week, selected, onSelect }: { week: string[]; selected: string; onSelect: (date: string) => void }) {
  const { i18n } = useTranslation();
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: "short", timeZone: "UTC" });
  const dateLabel = new Intl.DateTimeFormat(i18n.language, { dateStyle: "full", timeZone: "UTC" });
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 4, paddingVertical: 8, alignItems: "flex-start" }}>
    {week.map(date => <Pressable key={date} accessibilityRole="button" accessibilityLabel={dateLabel.format(new Date(`${date}T12:00:00Z`))}
      accessibilityState={{ selected: date === selected }} aria-pressed={date === selected} onPress={() => onSelect(date)}
      style={{ minWidth: 48, minHeight: 64, padding: 6, borderWidth: 1, borderColor: "#D8C7AE", borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: date === selected ? "#0B7F7F" : "#FFFCF5" }}>
      <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13, color: date === selected ? "white" : "#284E4B" }}>{weekday.format(new Date(`${date}T12:00:00Z`))}</Text>
      <Text style={{ fontFamily: "Baloo2_700Bold", fontSize: 23, color: date === selected ? "white" : "#284E4B" }}>{Number(date.slice(-2))}</Text>
    </Pressable>)}
    <View style={{ width: 1 }} />
  </ScrollView>;
}
