import {
  weatherKind,
  type RoomForecast,
  type WeatherHour,
} from "../../../packages/core/src/room-atmosphere.ts";
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
/** Validate and shrink provider data before persisting or returning it to children. */
export function parseForecast(
  input: unknown,
  cityId: string,
  now: number,
  expires: string,
): RoomForecast {
  const properties = (
    input as {
      properties?: { meta?: { updated_at?: unknown }; timeseries?: unknown };
    }
  )?.properties;
  if (
    typeof properties?.meta?.updated_at !== "string" ||
    !Number.isFinite(Date.parse(properties.meta.updated_at)) ||
    !Array.isArray(properties.timeseries)
  )
    throw new Error("invalid_forecast");
  if (
    Date.parse(properties.meta.updated_at) > now + 300000 ||
    now - Date.parse(properties.meta.updated_at) > 30 * 3600000
  )
    throw new Error("outdated_forecast");
  const hours: WeatherHour[] = [];
  for (const row of properties.timeseries.slice(0, 150)) {
    const time = Date.parse(row?.time);
    const d = row?.data?.instant?.details;
    const next = row?.data?.next_1_hours ?? row?.data?.next_6_hours;
    if (
      !Number.isFinite(time) ||
      time < now - 6 * 3600000 ||
      time > now + 72 * 3600000 ||
      !d ||
      !next
    )
      continue;
    if (
      ![
        d.air_temperature,
        d.cloud_area_fraction,
        d.wind_speed,
        d.wind_from_direction,
      ].every(finite)
    )
      continue;
    if (
      d.air_temperature < -100 ||
      d.air_temperature > 65 ||
      d.cloud_area_fraction < 0 ||
      d.cloud_area_fraction > 100 ||
      d.wind_speed < 0 ||
      d.wind_speed > 130 ||
      d.wind_from_direction < 0 ||
      d.wind_from_direction > 360
    )
      continue;
    const precipitation = next.details?.precipitation_amount;
    if (
      !finite(precipitation) ||
      precipitation < 0 ||
      precipitation > 1000 ||
      typeof next.summary?.symbol_code !== "string"
    )
      continue;
    hours.push({
      time: new Date(time).toISOString(),
      temperature: d.air_temperature,
      cloud: d.cloud_area_fraction / 100,
      windSpeed: d.wind_speed,
      windFrom: d.wind_from_direction,
      precipitation,
      kind: weatherKind(next.summary.symbol_code),
    });
  }
  hours.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  if (hours.some((h, i) => i > 0 && h.time === hours[i - 1]!.time))
    throw new Error("duplicate_forecast_time");
  if (!hours.length) throw new Error("empty_forecast");
  return {
    cityId,
    updatedAt: properties.meta.updated_at,
    fetchedAt: new Date(now).toISOString(),
    expiresAt: expires,
    hours,
  };
}
export function expiry(headers: Headers, now: number) {
  const value = Date.parse(headers.get("expires") ?? "");
  return new Date(
    Number.isFinite(value) && value > now ? value : now + 15 * 60000,
  ).toISOString();
}
