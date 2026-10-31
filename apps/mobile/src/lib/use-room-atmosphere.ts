import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  WEATHER_CITIES,
  isRoomForecast,
  currentWeather,
  solarPosition,
  type RoomForecast,
  type RoomSettings,
} from "@gina/core";
import { useSession } from "./session";
import { supabase } from "./supabase";
import { atmosphereCache } from "./atmosphere-cache";

export function useSceneActive() {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => sub.remove();
  }, []);
  return focused && foreground;
}
export function useRoomSettings() {
  const { claims } = useSession();
  const family = claims?.family_id;
  const active = useSceneActive();
  return useQuery({
    queryKey: ["room_settings", family],
    enabled: !!family && active,
    staleTime: 60000,
    refetchInterval: active ? 60000 : false,
    queryFn: async (): Promise<RoomSettings> => {
      const { data, error } = await supabase
        .from("family_room_settings")
        .select("city_id,sound_enabled,motion_enabled")
        .eq("family_id", family!)
        .maybeSingle();
      if (error) throw error;
      return (
        data ?? { city_id: null, sound_enabled: false, motion_enabled: true }
      );
    },
  });
}
/** Forecast-only offline cache shared by city. No user identity or selection is persisted here. */
export function useRoomAtmosphere() {
  const settings = useRoomSettings();
  const active = useSceneActive();
  const [now, setNow] = useState(() => Date.now());
  const city =
    WEATHER_CITIES.find((c) => c.id === settings.data?.city_id) ?? null;
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active]);
  const forecast = useQuery({
    queryKey: ["room_weather", city?.id],
    enabled: !!city && active,
    staleTime: 15 * 60000,
    retry: 0,
    refetchInterval: active ? 15 * 60000 : false,
    queryFn: async () => {
      const key = `gina-weather-v1:${city!.id}`;
      const { data, error } = await supabase.functions.invoke<{
        forecast: RoomForecast | null;
        status?: string;
      }>("room-weather", { body: {} });
      if (
        !error &&
        isRoomForecast(data?.forecast) &&
        data.forecast.cityId === city!.id
      ) {
        const checked =
          data.status === "stale"
            ? { ...data.forecast, expiresAt: new Date(0).toISOString() }
            : data.forecast;
        await atmosphereCache
          .setItem(key, JSON.stringify(checked))
          .catch(() => undefined);
        return checked;
      }
      // A previously saved forecast can be displayed as stale, never as a new observation.
      const saved = await atmosphereCache.getItem(key).catch(() => null);
      if (saved) {
        try {
          const value: unknown = JSON.parse(saved);
          if (isRoomForecast(value) && value.cityId === city!.id)
            return { ...value, expiresAt: new Date(0).toISOString() };
        } catch {
          /* discard malformed cache */
        }
      }
      if (error) throw error;
      return null;
    },
  });
  const weather = currentWeather(forecast.data, now);
  const sun = city
    ? solarPosition(new Date(now), city.latitude, city.longitude)
    : null;
  return { settings, city, forecast, weather, sun, now, active };
}
export type RoomAtmosphere = ReturnType<typeof useRoomAtmosphere>;
