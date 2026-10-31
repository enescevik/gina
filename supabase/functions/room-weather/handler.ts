import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import { expiry, parseForecast } from "./forecast.ts";

/** Live Auth + membership/device state, not unverified JWT family ids or caller coordinates. */
export async function weatherFamily(
  req: Request,
  db: SupabaseClient,
): Promise<string | null> {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return null;
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user) return null;
  let claim;
  try {
    claim = JSON.parse(
      atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    );
  } catch {
    return null;
  }
  if (claim.sub !== user.id || typeof claim.gina?.family_id !== "string")
    return null;
  const family = claim.gina.family_id;
  if (!user.is_anonymous && claim.gina.role === "parent") {
    const { data, error } = await db
      .from("family_members")
      .select("family_id")
      .eq("user_id", user.id)
      .eq("family_id", family)
      .maybeSingle();
    return !error && data ? family : null;
  }
  if (
    user.is_anonymous &&
    claim.gina.role === "device" &&
    claim.gina.child_id
  ) {
    const { data, error } = await db
      .from("devices")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("family_id", family)
      .eq("active_child_id", claim.gina.child_id)
      .is("revoked_at", null)
      .maybeSingle();
    return !error && data ? family : null;
  }
  return null;
}
export async function roomWeather(
  req: Request,
  dependencies?: { db: SupabaseClient; fetch: typeof fetch; now: () => number },
) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const db = dependencies?.db ?? serviceClient();
    const family = await weatherFamily(req, db);
    if (!family) return json({ error: "forbidden" }, 403);
    const { data: settings, error: settingError } = await db
      .from("family_room_settings")
      .select("city_id")
      .eq("family_id", family)
      .maybeSingle();
    if (settingError) return json({ error: "settings_unavailable" }, 503);
    if (!settings?.city_id)
      return json({ forecast: null, status: "not_configured" });
    const { data: city, error: cityError } = await db
      .from("weather_cities")
      .select("id, latitude, longitude")
      .eq("id", settings.city_id)
      .single();
    if (cityError || !city) return json({ error: "city_unavailable" }, 503);
    const now = dependencies?.now() ?? Date.now();
    const { data: cached, error: cacheError } = await db
      .from("room_weather_cache")
      .select("forecast,expires_at,last_modified")
      .eq("city_id", city.id)
      .maybeSingle();
    if (cacheError) return json({ error: "cache_unavailable" }, 503);
    if (cached?.forecast && Date.parse(cached.expires_at) > now)
      return json({ forecast: cached.forecast });
    const { data: claimed, error: claimError } = await db.rpc(
      "claim_room_weather_refresh",
      { p_city_id: city.id },
    );
    if (claimError) return json({ error: "cache_unavailable" }, 503);
    if (!claimed)
      return json({
        forecast: cached?.forecast ?? null,
        status: cached?.forecast ? "stale" : "refreshing",
      });
    try {
      const headers: Record<string, string> = {
        "User-Agent": "GinaAile/0.1 github.com/enescevik/gina",
        Accept: "application/json",
      };
      if (cached?.last_modified)
        headers["If-Modified-Since"] = cached.last_modified;
      const response = await (dependencies?.fetch ?? fetch)(
        `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${Number(city.latitude).toFixed(4)}&lon=${Number(city.longitude).toFixed(4)}`,
        { headers, signal: AbortSignal.timeout(8000) },
      );
      const expiresAt = expiry(response.headers, now);
      if (!response.ok && response.status !== 304)
        throw new Error("provider_unavailable");
      const forecast =
        response.status === 304 && cached?.forecast
          ? {
              ...cached.forecast,
              fetchedAt: new Date(now).toISOString(),
              expiresAt,
            }
          : parseForecast(await response.json(), city.id, now, expiresAt);
      const { error: saveError } = await db
        .from("room_weather_cache")
        .update({
          forecast,
          expires_at: expiresAt,
          last_modified:
            response.headers.get("last-modified") ??
            cached?.last_modified ??
            null,
        })
        .eq("city_id", city.id);
      if (saveError) throw new Error("cache_write_failed");
      return json({ forecast });
    } catch {
      return json({
        forecast: cached?.forecast ?? null,
        status: cached?.forecast ? "stale" : "unavailable",
      });
    }
  } catch {
    return json({ error: "weather_unavailable" }, 503);
  }
}
