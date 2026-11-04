import { type FeatureMode, featureModes } from "./feature-smoke.ts";
export type SmokeMode = "smoke" | "document-smoke" | FeatureMode;
/** Operator-only checks. No customer data, key material, or provider error bodies leave this endpoint. */
export interface PreflightDependencies {
  operatorKey: string | undefined;
  expiresAt: string | undefined;
  providerKey: string | undefined;
  fetch: typeof fetch;
  smoke: (mode: SmokeMode) => Promise<
    {
      valid: boolean;
      model: string;
      inputTokens: number | null;
      outputTokens: number | null;
      sample?: unknown;
    }
  >;
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

async function sameSecret(a: string, b: string): Promise<boolean> {
  const hash = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const [left, right] = await Promise.all([hash(a), hash(b)]);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

export async function handlePreflight(
  req: Request,
  deps: PreflightDependencies,
): Promise<Response> {
  const credential = req.headers.get("x-gina-preflight") ?? "";
  const expiresAt = Date.parse(deps.expiresAt ?? "");
  // A short-lived operator secret, in addition to the platform JWT check.
  // Default closed; this is never an application-user or public health endpoint.
  if (
    !deps.operatorKey || !credential || !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() || !await sameSecret(credential, deps.operatorKey)
  ) {
    return reply({ error: "forbidden" }, 403);
  }
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const raw = await req.text();
  if (raw.length > 256) return reply({ error: "invalid_input" }, 400);
  let mode: unknown;
  try {
    mode = JSON.parse(raw).mode;
  } catch {
    return reply({ error: "invalid_input" }, 400);
  }
  if (
    mode !== "connection" && mode !== "smoke" && mode !== "document-smoke" &&
    !featureModes.includes(mode as FeatureMode)
  ) {
    return reply({ error: "invalid_input" }, 400);
  }
  if (!deps.providerKey) {
    return reply({ error: "provider_not_configured" }, 503);
  }
  try {
    if (mode !== "connection") {
      const result = await deps.smoke(mode as SmokeMode);
      return reply(
        {
          check: mode === "document-smoke"
            ? "synthetic_document_extraction"
            : mode === "smoke"
            ? "synthetic_structured_output"
            : "synthetic_" + String(mode).replace("-smoke", ""),
          ...result,
        },
        result.valid ? 200 : 502,
      );
    }
    const result = await deps.fetch(
      "https://api.anthropic.com/v1/models?limit=100",
      {
        headers: {
          "x-api-key": deps.providerKey,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      },
    );
    if (!result.ok) {
      return reply({
        error: "provider_rejected",
        provider_status: result.status,
      }, 502);
    }
    const data = await result.json();
    if (!Array.isArray(data.data)) {
      return reply({ error: "provider_result_invalid" }, 502);
    }
    return reply({
      check: "connection",
      connected: true,
      visible_models: data.data.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = /^anthropic_(\d{3})$/.exec(message)?.[1];
    return reply({
      error: status ? "provider_rejected" : "check_failed",
      ...(status ? { provider_status: Number(status) } : {}),
    }, 502);
  }
}
