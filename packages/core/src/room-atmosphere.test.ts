import { describe, expect, it } from "vitest";
import { currentWeather, isRoomForecast, solarPosition, weatherKind, type RoomForecast } from "./room-atmosphere";
const now = Date.parse("2026-10-31T09:30:00Z");
const forecast = (): RoomForecast => ({ cityId: "city", updatedAt: "2026-10-31T08:00:00Z", fetchedAt: "2026-10-31T09:00:00Z", expiresAt: "2026-10-31T10:00:00Z", hours: [9,10,11].map(h=>({time:`2026-10-31T${h.toString().padStart(2,"0")}:00:00Z`,temperature:12,cloud:.7,windFrom:60,windSpeed:4,precipitation:.3,kind:"rain"})) });
describe("solar time follows coordinates, not device timezone",()=>{
 it("places equinox noon above the equator, midnight below it",()=>{
   expect(solarPosition(new Date("2026-03-20T12:00:00Z"),0,0).elevation).toBeGreaterThan(87);
   expect(solarPosition(new Date("2026-03-20T00:00:00Z"),0,0).phase).toBe("night");
 });
 it("distinguishes sunrise and sunset in Istanbul",()=>{
   expect(solarPosition(new Date("2026-03-20T04:15:00Z"),41,29).phase).toBe("dawn");
   expect(solarPosition(new Date("2026-03-20T15:50:00Z"),41,29).phase).toBe("sunset");
 });
 it("supports polar day/night and rejects invalid coordinates",()=>{
   expect(solarPosition(new Date("2026-06-21T00:00:00Z"),85,0).phase).toBe("day");
   expect(solarPosition(new Date("2026-12-21T12:00:00Z"),85,0).phase).toBe("night");
   expect(()=>solarPosition(new Date(),91,0)).toThrow();
 });
});
describe("forecasts never fabricate current conditions",()=>{
 it("selects the current interval including its lower boundary",()=>{
  expect(currentWeather(forecast(),now).status).toBe("fresh");
  expect(currentWeather(forecast(),Date.parse("2026-10-31T10:00:00Z")).hour?.time).toBe("2026-10-31T10:00:00Z");
 });
 it("labels cache expiry stale and discards data outside coverage",()=>{
  expect(currentWeather({...forecast(),expiresAt:"2026-10-31T09:01:00Z"},now).status).toBe("stale");
  expect(currentWeather(forecast(),now+3*3600000).status).toBe("unavailable");
  expect(currentWeather(forecast(),now+25*3600000).status).toBe("unavailable");
 });
 it("rejects malformed, unsorted, future, and non-finite cache data",()=>{
  expect(isRoomForecast({...forecast(),hours:[null]})).toBe(false);
  expect(isRoomForecast({...forecast(),hours:forecast().hours.reverse()})).toBe(false);
  expect(isRoomForecast({...forecast(),expiresAt:"bad"})).toBe(false);
  expect(isRoomForecast({...forecast(),hours:[{...forecast().hours[0],windSpeed:NaN}]})).toBe(false);
  expect(currentWeather({...forecast(),updatedAt:"2027-01-01"},now).status).toBe("unavailable");
 });
 it("maps mixed precipitation and night symbols without losing type",()=>{
  expect(weatherKind("sleetshowers_night")).toBe("sleet");
  expect(weatherKind("heavyrainandthunder")).toBe("thunder");
  expect(weatherKind("snowshowers_day")).toBe("snow");
  expect(weatherKind("partlycloudy_night")).toBe("cloudy");
 });
});
