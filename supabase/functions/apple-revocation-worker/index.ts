import { runAppleRevocations } from "./handler.ts";

Deno.serve((req) => runAppleRevocations(req));
