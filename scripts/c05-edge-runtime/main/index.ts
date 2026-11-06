// QA-only main service for the Supabase edge-runtime image (C05). Mirrors the CLI's local main service:
// each request is handed to a sandboxed user worker built from one function directory. Also routes the
// disposable Auth/PostgREST containers under /auth/v1 and /rest/v1 so user workers can use SUPABASE_URL.
// Never deployed. Only the listed services can be started.
declare const EdgeRuntime: {
  userWorkers: {
    create(
      options: Record<string, unknown>,
    ): Promise<{ fetch(req: Request): Promise<Response> }>;
  };
};
const SERVICES: Record<string, string> = {
  "curriculum-source-fetch": "/home/deno/functions/curriculum-source-fetch",
  "c05-probe": "/home/deno/qa/probe",
};
const upstream = (prefix: string) => {
  const value = Deno.env.get(
    prefix === "/auth/v1" ? "QA_AUTH_UPSTREAM" : "QA_REST_UPSTREAM",
  );
  if (!value) throw Error("upstream_missing");
  return value;
};
const workerEnv = () =>
  Object.entries(Deno.env.toObject()).filter(([k]) =>
    ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].includes(k)
  );
Deno.serve(async (req) => {
  const url = new URL(req.url);
  for (const prefix of ["/auth/v1", "/rest/v1"]) {
    if (url.pathname === prefix || url.pathname.startsWith(prefix + "/")) {
      const target = upstream(prefix) + url.pathname.slice(prefix.length) +
        url.search;
      const headers = new Headers(req.headers);
      headers.delete("host");
      return fetch(target, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
        redirect: "manual",
      });
    }
  }
  const name =
    url.pathname.replace(/^\/functions\/v1/, "").split("/").filter(Boolean)[0] ??
      "";
  const servicePath = SERVICES[name];
  if (!servicePath) {
    return Response.json({ error: "service_not_found" }, { status: 404 });
  }
  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: 150,
      workerTimeoutMs: 120_000,
      noModuleCache: false,
      importMapPath: null,
      envVars: workerEnv(),
      forceCreate: false,
      netAccessDisabled: false,
      cpuTimeSoftLimitMs: 10_000,
      cpuTimeHardLimitMs: 20_000,
    });
    return await worker.fetch(req);
  } catch (e) {
    return Response.json({
      error: "worker_failed",
      detail: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
});
