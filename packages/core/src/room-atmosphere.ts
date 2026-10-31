/** Atmospheric animation inputs contain no child identity or precise device location. */
export type WeatherKind =
  | "clear"
  | "cloudy"
  | "rain"
  | "snow"
  | "sleet"
  | "fog"
  | "thunder";
export type SolarPhase = "night" | "dawn" | "day" | "sunset";
export interface WeatherHour {
  time: string;
  temperature: number;
  cloud: number;
  precipitation: number;
  windSpeed: number;
  windFrom: number;
  kind: WeatherKind;
}
export interface RoomForecast {
  cityId: string;
  updatedAt: string;
  fetchedAt: string;
  expiresAt: string;
  hours: WeatherHour[];
}
export interface WeatherCity {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
export interface RoomSettings {
  city_id: string | null;
  sound_enabled: boolean;
  motion_enabled: boolean;
}
const rad = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** NOAA fractional-year approximation, UTC input; no device timezone or network needed. */
export function solarPosition(date: Date, latitude: number, longitude: number) {
  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new Error("Invalid solar input");
  const year = date.getUTCFullYear();
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const day =
    Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const hour =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  const gamma = ((2 * Math.PI) / days) * (day - 1 + (hour - 12) / 24);
  const equation =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const solarMinutes =
    (((hour * 60 + equation + 4 * longitude) % 1440) + 1440) % 1440;
  const hourAngle = (solarMinutes / 4 - 180) * rad;
  const lat = latitude * rad;
  const elevation =
    Math.asin(
      clamp(
        Math.sin(lat) * Math.sin(decl) +
          Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle),
        -1,
        1,
      ),
    ) / rad;
  const rising = solarMinutes < 720;
  const azimuth =
    (Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat),
    ) /
      rad +
      180 +
      360) %
    360;
  const phase: SolarPhase =
    elevation < -6
      ? "night"
      : elevation < 8
        ? rising
          ? "dawn"
          : "sunset"
        : "day";
  return {
    elevation,
    azimuth,
    rising,
    phase,
    daylight: smoothstep(-8, 12, elevation),
    golden: Math.max(0, 1 - Math.abs(elevation - 1) / 10),
  };
}
export function smoothstep(lo: number, hi: number, value: number) {
  const x = clamp((value - lo) / (hi - lo), 0, 1);
  return x * x * (3 - 2 * x);
}
export function weatherKind(symbol: string): WeatherKind {
  if (symbol.includes("thunder")) return "thunder";
  if (symbol.includes("sleet")) return "sleet";
  if (symbol.includes("snow")) return "snow";
  if (symbol.includes("rain")) return "rain";
  if (symbol.includes("fog")) return "fog";
  if (symbol.includes("cloud")) return "cloudy";
  return "clear";
}
/** Network/offline JSON is untrusted even when TypeScript callers use RoomForecast. */
export function isRoomForecast(value: unknown): value is RoomForecast {
  if (!value || typeof value !== "object") return false;
  const f = value as RoomForecast;
  if (
    typeof f.cityId !== "string" ||
    !f.cityId ||
    ![f.fetchedAt, f.updatedAt, f.expiresAt].every(
      (v) => typeof v === "string" && Number.isFinite(Date.parse(v)),
    ) ||
    !Array.isArray(f.hours) ||
    !f.hours.length ||
    f.hours.length > 100
  )
    return false;
  const kinds: WeatherKind[] = [
    "clear",
    "cloudy",
    "rain",
    "snow",
    "sleet",
    "fog",
    "thunder",
  ];
  return f.hours.every(
    (h, i) =>
      h &&
      typeof h.time === "string" &&
      Number.isFinite(Date.parse(h.time)) &&
      (i === 0 || Date.parse(f.hours[i - 1]!.time) < Date.parse(h.time)) &&
      [h.temperature, h.cloud, h.precipitation, h.windSpeed, h.windFrom].every(
        (v) => typeof v === "number" && Number.isFinite(v),
      ) &&
      h.temperature >= -100 &&
      h.temperature <= 65 &&
      h.cloud >= 0 &&
      h.cloud <= 1 &&
      h.precipitation >= 0 &&
      h.precipitation <= 1000 &&
      h.windSpeed >= 0 &&
      h.windSpeed <= 130 &&
      h.windFrom >= 0 &&
      h.windFrom <= 360 &&
      kinds.includes(h.kind),
  );
}
/** Missing/expired forecasts never silently become today's weather. */
export function currentWeather(
  forecast: RoomForecast | null | undefined,
  now: number,
) {
  if (!isRoomForecast(forecast) || !Number.isFinite(now))
    return { status: "unavailable" as const, hour: null };
  const fetched = Date.parse(forecast.fetchedAt),
    updated = Date.parse(forecast.updatedAt);
  if (
    !Number.isFinite(fetched) ||
    !Number.isFinite(updated) ||
    now - fetched > 24 * 3600000 ||
    now - updated > 30 * 3600000 ||
    fetched > now + 300000 ||
    updated > now + 300000
  )
    return { status: "unavailable" as const, hour: null };
  const hour = forecast.hours.find(
    (item, i) =>
      Date.parse(item.time) <= now &&
      (i === forecast.hours.length - 1
        ? Date.parse(item.time) + 3600000
        : Date.parse(forecast.hours[i + 1]!.time)) > now,
  );
  if (!hour || now - Date.parse(hour.time) > 6 * 3600000)
    return { status: "unavailable" as const, hour: null };
  const stale =
    now > Date.parse(forecast.expiresAt) || now - fetched > 6 * 3600000;
  return { status: stale ? ("stale" as const) : ("fresh" as const), hour };
}
