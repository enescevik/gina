import { roomWeather } from "./handler.ts";
Deno.serve(req => roomWeather(req));
