import { handlePreflight, type PreflightDependencies } from "./handler.ts";
const assert = (value: unknown) => {
  if (!value) throw Error("assertion failed");
};
const request = (mode = "connection", key = "server-only") =>
  new Request("https://test", {
    method: "POST",
    headers: { "x-gina-preflight": key },
    body: JSON.stringify({ mode }),
  });
function deps(): PreflightDependencies {
  return {
    operatorKey: "server-only",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    providerKey: "private-provider-key",
    fetch: async () => Response.json({ data: [{ id: "model" }] }),
    smoke: async () => ({
      valid: true,
      model: "model",
      inputTokens: 20,
      outputTokens: 5,
    }),
  };
}
Deno.test("preflight denies user/anon/forged credentials before any provider call", async () => {
  const d = deps();
  d.fetch = () => {
    throw Error("must not fetch");
  };
  d.smoke = () => {
    throw Error("must not generate");
  };
  for (
    const key of [
      "",
      "anon",
      "header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature",
    ]
  ) assert((await handlePreflight(request("smoke", key), d)).status === 403);
  d.operatorKey = undefined;
  assert((await handlePreflight(request(), d)).status === 403);
});
Deno.test("connection check does not generate and returns only safe metadata", async () => {
  const d = deps();
  d.smoke = () => {
    throw Error("must not generate");
  };
  const response = await handlePreflight(request(), d);
  const body = await response.text();
  assert(
    response.status === 200 && body.includes('"connected":true') &&
      !body.includes(d.providerKey!),
  );
});
Deno.test("provider rejection and thrown errors cannot reveal response body or key", async () => {
  const d = deps();
  d.fetch = async () => new Response(d.providerKey, { status: 401 });
  const first = await handlePreflight(request(), d);
  assert(
    first.status === 502 && !(await first.text()).includes(d.providerKey!),
  );
  d.smoke = () => {
    throw Error(d.providerKey);
  };
  assert(
    !(await (await handlePreflight(request("smoke"), d)).text()).includes(
      d.providerKey!,
    ),
  );
});
Deno.test("missing key and unsupported input fail without generation", async () => {
  const d = deps();
  d.providerKey = undefined;
  assert((await handlePreflight(request(), d)).status === 503);
  assert((await handlePreflight(request("anything"), d)).status === 400);
});
Deno.test("explicit smoke validates structured result and reports usage", async () => {
  const d = deps();
  let calls = 0;
  d.smoke = async () => {
    calls++;
    return { valid: true, model: "model", inputTokens: 20, outputTokens: 5 };
  };
  assert(
    (await handlePreflight(request("smoke"), d)).status === 200 && calls === 1,
  );
  d.smoke = async () => ({
    valid: false,
    model: "model",
    inputTokens: 20,
    outputTokens: 5,
  });
  assert((await handlePreflight(request("smoke"), d)).status === 502);
});

Deno.test("expired or malformed operator access is rejected", async () => {
  for (
    const expiresAt of [
      undefined,
      "bad-date",
      new Date(Date.now() - 1).toISOString(),
    ]
  ) {
    const d = deps();
    d.expiresAt = expiresAt;
    assert((await handlePreflight(request(), d)).status === 403);
  }
});

Deno.test("feature probes require operator access and dispatch exactly one fixed mode", async () => {
  for (
    const mode of [
      "weekly-smoke",
      "learning-smoke",
      "task-smoke",
      "reward-smoke",
    ]
  ) {
    const d = deps();
    const received: string[] = [];
    d.smoke = async (selected) => {
      received.push(selected);
      return {
        valid: true,
        model: "model",
        inputTokens: 5,
        outputTokens: 10,
        sample: { synthetic: true },
      };
    };
    assert((await handlePreflight(request(mode, "wrong"), d)).status === 403);
    assert(received.length === 0);
    const response = await handlePreflight(request(mode), d);
    assert(
      response.status === 200 && received.length === 1 && received[0] === mode,
    );
    assert((await response.json()).sample.synthetic === true);
  }
});
Deno.test("invalid feature output is failed and uncertain provider call is never retried", async () => {
  const d = deps();
  let calls = 0;
  d.smoke = async () => {
    calls++;
    throw Error("private upstream details");
  };
  const response = await handlePreflight(request("weekly-smoke"), d);
  assert(response.status === 502 && calls === 1);
  assert(!(await response.text()).includes("private upstream details"));
  d.smoke = async () => ({
    valid: false,
    model: "model",
    inputTokens: 5,
    outputTokens: 10,
  });
  assert((await handlePreflight(request("learning-smoke"), d)).status === 502);
});
