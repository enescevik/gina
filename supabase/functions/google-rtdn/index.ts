// Pub/Sub OIDC audience AND sender identity must be configured before accepting events.
import { googleRtdn } from "./handler.ts";
Deno.serve(req => googleRtdn(req));
