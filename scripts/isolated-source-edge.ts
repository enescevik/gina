// Local acceptance launcher: use the unchanged production handler with a
// randomly allocated loopback port. No provider or hosted-service access.
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { installIsolatedProvider } from "./isolated-ai-provider.ts";
if (Deno.env.get("GINA_QA_ISOLATED") !== "1") {
  throw Error("isolated_runner_required");
}
const pdf = await PDFDocument.create();
pdf.addPage([300, 400]).drawText(
  "Synthetic timetable: Monday, Mathematics, 09:00-09:40",
  { x: 10, y: 350, size: 9 },
);
const bytes = await pdf.save();
const serve = Deno.serve;
const stats = installIsolatedProvider();
const handlers = new Map<string, Deno.ServeHandler>();
let route = "/learning-source";
Deno.serve = ((handler: Deno.ServeHandler) => {
  handlers.set(route, handler);
  return {};
}) as typeof Deno.serve;
await import("../supabase/functions/learning-source/index.ts");
route = "/ai-weekly-summary";
await import("../supabase/functions/ai-weekly-summary/index.ts");
route = "/learning-plan-import";
await import("../supabase/functions/learning-plan-import/index.ts");
route = "/setup-suggestions";
await import("../supabase/functions/setup-suggestions/index.ts");
route = "/timetable-import";
await import("../supabase/functions/timetable-import/index.ts");
route = "/prova-generate";
await import("../supabase/functions/prova-generate/index.ts");
// C10: unchanged one-click unsubscribe handler (service role RPC; no provider).
route = "/channel-unsubscribe";
await import("../supabase/functions/channel-unsubscribe/index.ts");
Deno.serve = serve;
serve({
  hostname: "127.0.0.1",
  port: 0,
  onListen: ({ port }) =>
    console.log(
      JSON.stringify({ port, pdf: btoa(String.fromCharCode(...bytes)) }),
    ),
}, (req, info) => {
  const path = new URL(req.url).pathname;
  if (path === "/__qa-provider-stats" && req.method === "GET") {
    return Response.json(stats);
  }
  const handler = handlers.get(path);
  return handler ? handler(req, info) : new Response(null, { status: 404 });
});
