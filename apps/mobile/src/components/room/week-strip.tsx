import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

/** Local presentation selection; the already-fetched week and server data never change. */
export function WeekStrip({ week, selected, onSelect }: { week: string[]; selected: string; onSelect: (date: string) => void }) {
  const { i18n } = useTranslation();
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: "short", timeZone: "UTC" });
  const dateLabel = new Intl.DateTimeFormat(i18n.language, { dateStyle: "full", timeZone: "UTC" });
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 4, paddingVertical: 8, alignItems: "flex-start" }}>
    {week.map(date => <Pressable key={date} accessibilityRole="button" accessibilityLabel={dateLabel.format(new Date(`${date}T12:00:00Z`))}
      accessibilityState={{ selected: date === selected }} aria-pressed={date === selected} onPress={() => onSelect(date)}
      style={{ minWidth: 48, minHeight: 64, padding: 6, borderWidth: 1, borderColor: date === selected ? "#78C7AE" : "#EAE5EE", borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: date === selected ? "#DDF5EB" : "#FFFFFF" }}>
      <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13, color: "#201951" }}>{weekday.format(new Date(`${date}T12:00:00Z`))}</Text>
      <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 23, color: "#201951" }}>{Number(date.slice(-2))}</Text>
    </Pressable>)}
    <View style={{ width: 1 }} />
  </ScrollView>;
}
