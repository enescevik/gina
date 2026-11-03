import { setupSuggestions } from "./handler.ts";
Deno.serve((req) => setupSuggestions(req));
