// C13 local launcher for the chain: the UNCHANGED curriculum-source-fetch and content-prereview handlers on a random
// loopback port. Only authorization paths are exercised (no provider key, no outbound fetch beyond 127.0.0.1).
if (Deno.env.get("GINA_QA_ISOLATED") !== "1") throw Error("isolated_runner_required");
const serve = Deno.serve;
const handlers = new Map<string, Deno.ServeHandler>();
let route = "/curriculum-source-fetch";
Deno.serve = ((handler: Deno.ServeHandler) => {
  handlers.set(route, handler);
  return {};
}) as typeof Deno.serve;
await import("../supabase/functions/curriculum-source-fetch/index.ts");
route = "/content-prereview";
await import("../supabase/functions/content-prereview/index.ts");
Deno.serve = serve;
serve({
  hostname: "127.0.0.1",
  port: 0,
  onListen: ({ port }) => console.log(JSON.stringify({ port })),
}, (req, info) => {
  const handler = handlers.get(new URL(req.url).pathname);
  return handler ? handler(req, info) : new Response(null, { status: 404 });
});
