// Local acceptance launcher: use the unchanged production handler with a
// randomly allocated loopback port. No provider or hosted-service access.
import { PDFDocument } from "npm:pdf-lib@1.17.1";
if (Deno.env.get("GINA_QA_ISOLATED") !== "1") throw Error("isolated_runner_required");
const pdf = await PDFDocument.create();
pdf.addPage([300, 400]).drawText("Synthetic timetable: Monday, Mathematics, 09:00-09:40", { x: 10, y: 350, size: 9 });
const bytes = await pdf.save();
const serve = Deno.serve;
Deno.serve = ((handler: Deno.ServeHandler) => serve({
  hostname: "127.0.0.1", port: 0,
  onListen: ({ port }) => console.log(JSON.stringify({ port, pdf: btoa(String.fromCharCode(...bytes)) })),
}, handler)) as typeof Deno.serve;
await import("../supabase/functions/learning-source/index.ts");
