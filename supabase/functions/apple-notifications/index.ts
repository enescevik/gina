// Apple authenticates with its signed JWS, before any inbox identity is claimed.
import { appleNotifications } from "./handler.ts";
Deno.serve(req => appleNotifications(req));
