// C05 runtime probe: proves the SSRF/DNS policy of _shared/curriculum-source.ts inside a real runtime
// (plain `deno run` and the Supabase edge-runtime image). It never disables a check: every probe goes through
// checkUrl/fetchWithPolicy exactly as the curriculum-source-fetch function does. Not deployed; local QA only.
import {
  checkUrl,
  denoResolver,
  fetchWithPolicy,
  INDEX_PAGES,
  inspectXlsx,
  ipIsPublic,
  MAX_PAGE_BYTES,
  parseIndex,
  PolicyError,
  sha256Hex,
} from "../_shared/curriculum-source.ts";

type Check = { name: string; pass: boolean; detail: unknown };
const policyCode = async (f: () => Promise<unknown>) => {
  try {
    await f();
    return "ok";
  } catch (e) {
    return e instanceof PolicyError ? e.message : `unexpected:${e instanceof Error ? e.name : "unknown"}`;
  }
};

export async function runProbe(options: { network: boolean }) {
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail: unknown) => checks.push({ name, pass, detail });
  const api = (Deno as unknown as { resolveDns?: unknown }).resolveDns;
  add("resolveDns_api_present", typeof api === "function", typeof api);
  if (typeof api === "function") {
    try {
      const official = await denoResolver("odsgm.meb.gov.tr");
      add("official_host_resolves_public", official.length > 0 && official.every(ipIsPublic), official);
    } catch (e) {
      add("official_host_resolves_public", false, e instanceof Error ? e.message : String(e));
    }
    // Real DNS answers that point at loopback must be refused even when the host name is on the allow-list.
    for (const rebound of ["localtest.me", "127.0.0.1.nip.io"]) {
      let answer: unknown = null;
      try {
        answer = await denoResolver(rebound);
      } catch (e) {
        answer = e instanceof Error ? e.message : String(e);
      }
      const code = await policyCode(() => checkUrl("https://odsgm.meb.gov.tr/", true, () => denoResolver(rebound)));
      add(`rebinding_${rebound}_rejected`, code === "non_public_address:odsgm.meb.gov.tr" || code === "dns_failed:odsgm.meb.gov.tr", { answer, code });
    }
  }
  for (const [url, expected] of [
    ["http://odsgm.meb.gov.tr/", "https_required"],
    ["https://localhost/", "host_not_allowed:localhost"],
    ["https://169.254.169.254/latest/meta-data", "host_not_allowed:169.254.169.254"],
    ["https://odsgm.meb.gov.tr:8443/", "url_authority_rejected"],
    ["https://user@odsgm.meb.gov.tr/", "url_authority_rejected"],
    ["https://meb.ai/x", "host_not_allowed:meb.ai"],
  ] as const) {
    const code = await policyCode(() => checkUrl(url, true, () => Promise.resolve(["93.184.216.34"])));
    add(`rejects:${url}`, code === expected, code);
  }
  // Fail closed when the runtime has no DNS API: the resolver itself refuses, nothing is requested.
  let requested = 0;
  const descriptor = Object.getOwnPropertyDescriptor(Deno, "resolveDns");
  let closed: string;
  try {
    Object.defineProperty(Deno, "resolveDns", { value: undefined, configurable: true, writable: true });
    closed = await policyCode(() =>
      fetchWithPolicy(INDEX_PAGES["oyss:2026-2027:1"], {
        transport: () => {
          requested++;
          return Promise.resolve(new Response("x"));
        },
      })
    );
  } catch (e) {
    closed = "cannot_simulate:" + (e instanceof Error ? e.message : String(e));
  } finally {
    if (descriptor) Object.defineProperty(Deno, "resolveDns", descriptor);
  }
  add("missing_resolveDns_fails_closed", closed === "dns_unavailable:odsgm.meb.gov.tr" && requested === 0, { code: closed, requested });
  if (options.network) {
    const index = INDEX_PAGES["oyss:2026-2027:1"];
    try {
      const page = await fetchWithPolicy(index, { maxBytes: MAX_PAGE_BYTES });
      const parsed = parseIndex(new TextDecoder().decode(page.body));
      add("official_index_fetched_with_policy", page.chain.at(-1)?.status === 200 && parsed.links.length > 0, {
        chain: page.chain,
        links: parsed.links.length,
        dates: parsed.dates,
        turkce: parsed.links.filter((l) => l.text === "Türkçe").map((l) => l.href),
      });
      const link = parsed.links.find((l) => l.text === "Türkçe");
      if (link) {
        const file = await fetchWithPolicy(link.href);
        const inspection = inspectXlsx(file.body, file.mime);
        add("official_file_via_meb_ai_hop", file.chain.length >= 2 && new URL(file.finalUrl).hostname === "cdn.eba.gov.tr", {
          chain: file.chain,
          bytes: file.body.length,
          sha256: await sha256Hex(file.body),
          inspection,
        });
      }
    } catch (e) {
      add("official_index_fetched_with_policy", false, e instanceof Error ? e.message : String(e));
    }
  }
  return { runtime: { deno: Deno.version, edge_runtime: typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined" }, checks, passed: checks.every((c) => c.pass) };
}

if (import.meta.main && Deno.args.includes("--print")) {
  console.log(JSON.stringify(await runProbe({ network: Deno.args.includes("--network") }), null, 2));
} else if (import.meta.main) {
  Deno.serve(async () => Response.json(await runProbe({ network: true })));
}
