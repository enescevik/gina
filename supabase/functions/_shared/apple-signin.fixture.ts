// Test-only: a throwaway P-256 key, a random AES key and a scripted fake of Apple's /auth/token and /auth/revoke.
import type { AppleConfig } from "./apple-signin.ts";

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const idToken = (sub: string) => `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify({ iss: "https://appleid.apple.com", sub }))}.sig`;

export async function testConfig(): Promise<{ config: AppleConfig; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64(pkcs8).match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
  return {
    publicKey: pair.publicKey,
    config: {
      teamId: "TEAM123456", keyId: "KEY1234567", privateKey: pem, bundleId: "com.enescevik.gina", servicesId: "com.enescevik.gina.web",
      encryptionKey: b64(crypto.getRandomValues(new Uint8Array(32))),
    },
  };
}

export type AppleCall = { path: string; form: Record<string, string> };
/** Each endpoint answers from a queue of scripted replies; "timeout" waits for the abort signal. */
export function fakeApple(script: { token?: (string | { status: number; body?: unknown })[]; revoke?: (string | { status: number; body?: unknown })[] } = {}) {
  const calls: AppleCall[] = [];
  const queues = { "/auth/token": [...(script.token ?? [])], "/auth/revoke": [...(script.revoke ?? [])] };
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const form = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));
    calls.push({ path: url.pathname, form });
    const reply = queues[url.pathname as keyof typeof queues]?.shift() ?? { status: 500 };
    if (reply === "timeout") {
      return await new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    }
    if (reply === "network") throw new TypeError("connection refused");
    if (typeof reply === "string") throw new Error("unknown reply");
    return new Response(reply.body === undefined ? "" : JSON.stringify(reply.body), { status: reply.status });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}
export const tokenReply = (sub: string, refresh = "apple-refresh-SECRET", access = "apple-access-SECRET") =>
  ({ status: 200, body: { access_token: access, refresh_token: refresh, id_token: idToken(sub), token_type: "bearer", expires_in: 3600 } });
