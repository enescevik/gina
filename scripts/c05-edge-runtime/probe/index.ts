// QA-only user worker: runs the C05 DNS/SSRF probe inside the Supabase edge-runtime sandbox.
import { runProbe } from "../../functions/curriculum-source-fetch/runtime-probe.ts";
Deno.serve(async () => Response.json(await runProbe({ network: true })));
