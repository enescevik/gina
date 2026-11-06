import { storeAppleToken } from "./handler.ts";

Deno.serve((req) => storeAppleToken(req));
