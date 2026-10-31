import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import type { RoomAtmosphere } from "@/lib/use-room-atmosphere";

export function AtmosphereStatus({
  atmosphere,
}: {
  atmosphere: RoomAtmosphere;
}) {
  const { t, i18n } = useTranslation();
  const { city, weather, forecast } = atmosphere;
  const hour = weather.hour;
  const label = !city
    ? t("atmosphere.example")
    : !hour
      ? t("atmosphere.waiting", { city: city.name })
      : t("atmosphere.forecast", {
          city: city.name,
          temperature: Math.round(hour.temperature),
          kind: t(`atmosphere.${hour.kind}`),
        });
  const date = forecast.data && new Date(forecast.data.updatedAt);
  const time =
    date && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(i18n.language, {
          timeZone: city?.timezone ?? "Europe/Istanbul",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date)
      : null;
  return (
    <View style={{ flexShrink: 1, gap: 1 }}>
      <Text
        style={{
          fontFamily: "Nunito_700Bold",
          fontSize: 13,
          lineHeight: 18,
          color: "#284E4B",
        }}
      >
        {label}
      </Text>
      {hour && time ? (
        <Text
          style={{
            fontFamily: "Nunito_600SemiBold",
            fontSize: 11,
            lineHeight: 15,
            color: "#52685D",
          }}
        >
          {t(
            weather.status === "stale"
              ? "atmosphere.stale"
              : "atmosphere.updated",
            { time },
          )}
        </Text>
      ) : null}
    </View>
  );
}
