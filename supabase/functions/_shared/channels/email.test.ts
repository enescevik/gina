// Fake servers only: an HTTP endpoint standing in for Resend and a plaintext TCP SMTP server.
// Requires --allow-net=127.0.0.1. No real provider, no real mailbox, no env secrets.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert";
import { emailAdapterFromEnv, parseSender, resendAdapter, smtpAdapter } from "./email.ts";
import type { OutboundEmail } from "./contract.ts";

const message: OutboundEmail = {
  to: "parent@example.invalid",
  from: "noreply@example.invalid",
  subject: "GINA doğrulama kodu",
  text: "Kod: ABCD1234\n.leading dot line\nson satır",
  headers: { "List-Unsubscribe": "<https://example.invalid/u?token=x>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  idempotencyKey: "gina-channel-42",
};

interface Seen {
  headers: Headers;
  body: Record<string, unknown>;
}
async function fakeResend(handler: (seen: Seen, n: number) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  let n = 0;
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, async (req) => {
    const s = { headers: req.headers, body: await req.json() as Record<string, unknown> };
    seen.push(s);
    return await handler(s, ++n);
  });
  const endpoint = `http://127.0.0.1:${server.addr.port}/emails`;
  return {
    endpoint,
    seen,
    async close() {
      await server.shutdown();
    },
  };
}

Deno.test("resend: acceptance returns provider id; idempotency key and unsubscribe headers are sent", async () => {
  const f = await fakeResend(() => Response.json({ id: "re_123" }));
  try {
    const r = await resendAdapter({ apiKey: "test-key", endpoint: f.endpoint }).send(message);
    assert(r.ok && r.providerMessageId === "re_123" && r.acceptedAt);
    assertEquals(f.seen[0].headers.get("idempotency-key"), "gina-channel-42");
    assertEquals(f.seen[0].headers.get("authorization"), "Bearer test-key");
    assertEquals(f.seen[0].body.to, ["parent@example.invalid"]);
    assertEquals((f.seen[0].body.headers as Record<string, string>)["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  } finally {
    await f.close();
  }
});

Deno.test("resend: 429 is a retry honoring Retry-After; 500 retries; 422 is permanent", async () => {
  const f = await fakeResend((_s, n) =>
    n === 1
      ? new Response(JSON.stringify({ name: "rate_limit_exceeded" }), { status: 429, headers: { "retry-after": "120" } })
      : n === 2
      ? new Response("oops", { status: 500 })
      : new Response(JSON.stringify({ name: "validation_error" }), { status: 422 })
  );
  try {
    const a = resendAdapter({ apiKey: "k", endpoint: f.endpoint });
    const r1 = await a.send(message);
    assert(!r1.ok && r1.retry && r1.retryAfterSeconds === 120 && r1.error === "resend:http_429:rate_limit_exceeded");
    const r2 = await a.send(message);
    assert(!r2.ok && r2.retry && r2.error === "resend:http_500");
    const r3 = await a.send(message);
    assert(!r3.ok && !r3.retry && r3.error === "resend:http_422:validation_error");
  } finally {
    await f.close();
  }
});

Deno.test("resend: timeout is a retryable error without echoing the address", async () => {
  const f = await fakeResend(async () => {
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ id: "late" });
  });
  try {
    const r = await resendAdapter({ apiKey: "k", endpoint: f.endpoint, timeoutMs: 50 }).send(message);
    assert(!r.ok && r.retry && r.error === "resend:timeout");
    assert(!JSON.stringify(r).includes("example.invalid"));
  } finally {
    await f.close();
    await new Promise((r) => setTimeout(r, 450));
  }
});

Deno.test("resend: connection refused is a retryable network error", async () => {
  const r = await resendAdapter({ apiKey: "k", endpoint: "http://127.0.0.1:9/emails", timeoutMs: 2000 }).send(message);
  assert(!r.ok && r.retry && r.error === "resend:network_error");
});

// SMTP ---------------------------------------------------------------------------------------------

type Scenario = "accept" | "rcpt_450" | "rcpt_550" | "auth_535" | "hang" | "drop_after_data" | "data_451";
async function fakeSmtp(scenario: Scenario) {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const transcript: string[] = [];
  let data = "";
  const enc = new TextEncoder(), dec = new TextDecoder();
  const serve = (async () => {
    for await (const conn of listener) {
      try {
        await conn.write(enc.encode("220 fake ESMTP\r\n"));
        let buf = "", inData = false;
        const chunk = new Uint8Array(4096);
        for (;;) {
          const n = await conn.read(chunk);
          if (n === null) break;
          buf += dec.decode(chunk.subarray(0, n));
          for (;;) {
            if (inData) {
              const end = buf.indexOf("\r\n.\r\n");
              if (end < 0) break;
              data = buf.slice(0, end);
              buf = buf.slice(end + 5);
              inData = false;
              if (scenario === "drop_after_data") {
                // The relay queued the message but the reply never reaches the client.
                conn.close();
                return;
              }
              await conn.write(enc.encode(scenario === "data_451" ? "451 4.3.0 queue full\r\n" : "250 2.0.0 Ok: queued as FAKE123\r\n"));
              continue;
            }
            const nl = buf.indexOf("\r\n");
            if (nl < 0) break;
            const line = buf.slice(0, nl);
            buf = buf.slice(nl + 2);
            transcript.push(line.startsWith("AUTH") ? "AUTH PLAIN <redacted>" : line);
            if (line.startsWith("EHLO")) await conn.write(enc.encode("250-fake\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n"));
            else if (line.startsWith("AUTH")) await conn.write(enc.encode(scenario === "auth_535" ? "535 5.7.8 bad credentials\r\n" : "235 2.7.0 ok\r\n"));
            else if (line.startsWith("MAIL FROM")) await conn.write(enc.encode("250 ok\r\n"));
            else if (line.startsWith("RCPT TO")) {
              if (scenario === "hang") return;
              await conn.write(enc.encode(scenario === "rcpt_450" ? "450 4.7.1 try later\r\n" : scenario === "rcpt_550" ? "550 5.1.1 no such user\r\n" : "250 ok\r\n"));
            } else if (line === "DATA") {
              inData = true;
              await conn.write(enc.encode("354 go ahead\r\n"));
            } else if (line === "QUIT") {
              await conn.write(enc.encode("221 bye\r\n"));
              conn.close();
              return;
            } else await conn.write(enc.encode("250 ok\r\n"));
          }
        }
      } catch { /* client closed */ }
    }
  })();
  return {
    port: (listener.addr as Deno.NetAddr).port,
    transcript,
    get data() {
      return data;
    },
    close() {
      try {
        listener.close();
      } catch { /* the for-await loop already closed it after the single connection */ }
      return serve;
    },
  };
}
function smtp(port: number, timeoutMs = 2000) {
  return smtpAdapter({ host: "127.0.0.1", port, username: "user", password: "secret", security: "plain", timeoutMs });
}

Deno.test("smtp: accepted message carries headers, base64 body, dot-stuffing and queue id", async () => {
  const s = await fakeSmtp("accept");
  try {
    const r = await smtp(s.port).send(message);
    assert(r.ok && r.providerMessageId === "FAKE123");
    assertEquals(s.transcript.filter((l) => l.startsWith("RCPT")), ["RCPT TO:<parent@example.invalid>"]);
    assertMatch(s.data, /Subject: =\?UTF-8\?B\?/);
    assertMatch(s.data, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
    assertMatch(s.data, /Message-ID: <gina-channel-42@example\.invalid>/);
    assertMatch(s.data, /Content-Transfer-Encoding: base64/);
    assert(!s.transcript.some((l) => l.includes("secret")), "password never appears in clear");
  } finally {
    await s.close();
  }
});

Deno.test("smtp: 4xx is retry, 5xx and bad credentials are permanent, hang is a timeout", async () => {
  for (const [scenario, retry, error] of [["rcpt_450", true, "smtp:rcpt_to_450"], ["rcpt_550", false, "smtp:rcpt_to_550"], ["auth_535", false, "smtp:auth_535"]] as const) {
    const s = await fakeSmtp(scenario);
    try {
      const r = await smtp(s.port).send(message);
      assert(!r.ok && r.retry === retry && r.error === error, `${scenario}: ${JSON.stringify(r)}`);
    } finally {
      await s.close();
    }
  }
  const h = await fakeSmtp("hang");
  try {
    const r = await smtp(h.port, 150).send(message);
    assert(!r.ok && r.retry && r.error === "smtp:timeout", JSON.stringify(r));
  } finally {
    await h.close();
  }
});

Deno.test("smtp: reply lost after the message was handed over is permanent (no second copy); 4xx after DATA retries", async () => {
  const lost = await fakeSmtp("drop_after_data");
  try {
    const r = await smtp(lost.port).send(message);
    assert(!r.ok && r.retry === false && r.error === "smtp:end_of_data_unknown", JSON.stringify(r));
    assert(lost.data.includes("Subject:"), "the relay did receive the message once");
  } finally {
    await lost.close();
  }
  const busy = await fakeSmtp("data_451");
  try {
    const r = await smtp(busy.port).send(message);
    assert(!r.ok && r.retry === true && r.error === "smtp:end_of_data_451", JSON.stringify(r));
  } finally {
    await busy.close();
  }
});

Deno.test("smtp: display-name sender uses the bare envelope address; header injection is refused before connecting", async () => {
  const s = await fakeSmtp("accept");
  try {
    const r = await smtp(s.port).send({ ...message, from: "GINA Bildirim <bildirim@example.invalid>" });
    assert(r.ok, JSON.stringify(r));
    assertEquals(s.transcript.filter((l) => l.startsWith("MAIL FROM")), ["MAIL FROM:<bildirim@example.invalid>"]);
    assertMatch(s.data, /^From: GINA Bildirim <bildirim@example\.invalid>\r$/m);
  } finally {
    await s.close();
  }
  assertEquals(parseSender("GİNA <a@example.invalid>")?.header, "=?UTF-8?B?R8SwTkE=?= <a@example.invalid>");
  assertEquals(parseSender("a@example.invalid"), { envelope: "a@example.invalid", header: "a@example.invalid", domain: "example.invalid" });
  assertEquals(parseSender("x\r\nBcc: v@example.invalid"), null);
  assertEquals(parseSender("not-an-address"), null);
  // No server is listening on port 9: an invalid address must fail before any connection attempt.
  for (const bad of [{ from: "a@example.invalid\r\nBcc: v@example.invalid" }, { to: "p@example.invalid>\r\nRCPT TO:<v@example.invalid" }]) {
    const r = await smtp(9).send({ ...message, ...bad });
    assert(!r.ok && r.retry === false && r.error === "smtp:invalid_address", JSON.stringify(r));
  }
});

// Factory ----------------------------------------------------------------------------------------------

Deno.test("factory: missing env is reported by name; plaintext SMTP needs explicit opt-in; unknown provider named", () => {
  const env = (values: Record<string, string>) => ({ get: (k: string) => values[k] });
  assertEquals(emailAdapterFromEnv("resend", env({})), { adapter: null, missing: ["RESEND_API_KEY"] });
  assertEquals(emailAdapterFromEnv("resend", env({ RESEND_API_KEY: "k" })).adapter?.provider, "resend");
  assertEquals(emailAdapterFromEnv("smtp", env({ SMTP_HOST: "h" })).missing, ["SMTP_USERNAME", "SMTP_PASSWORD"]);
  assertEquals(emailAdapterFromEnv("smtp", env({ SMTP_HOST: "h", SMTP_USERNAME: "u", SMTP_PASSWORD: "p", SMTP_SECURITY: "plain" })).missing, ["SMTP_ALLOW_PLAINTEXT"]);
  assertEquals(emailAdapterFromEnv("smtp", env({ SMTP_HOST: "h", SMTP_USERNAME: "u", SMTP_PASSWORD: "p" })).adapter?.provider, "smtp");
  assertEquals(emailAdapterFromEnv(null, env({})), { adapter: null, missing: ["provider_not_selected"] });
  assertEquals(emailAdapterFromEnv("sendgrid", env({})), { adapter: null, missing: ["provider_unknown:sendgrid"] });
});

Deno.test("smtp: HTML mail preserves exact UTF-8 plain and HTML alternatives and unsubscribe headers", async () => {
  const s = await fakeSmtp("accept");
  const html = '<!doctype html><html lang="tr"><body><h1>Çocuğunla birlikte 🌱</h1>' + '<p>İngilizce &amp; Türkçe</p>'.repeat(800) + '</body></html>';
  try {
    const result = await smtp(s.port).send({ ...message, html });
    assert(result.ok);
    const boundary = /Content-Type: multipart\/alternative; boundary="([^"]+)"/.exec(s.data)?.[1];
    assert(boundary);
    const parts = s.data.split(`--${boundary}`);
    const decode = (part: string) => new TextDecoder().decode(Uint8Array.from(atob(part.split("\r\n\r\n")[1].trim().replace(/\s/g, "")), (c) => c.charCodeAt(0)));
    assertEquals(decode(parts[1]), message.text);
    assertEquals(decode(parts[2]), html);
    assert(parts[1].includes("Content-Type: text/plain; charset=utf-8"));
    assert(parts[2].includes("Content-Type: text/html; charset=utf-8"));
    assert(parts[3].startsWith("--"));
    assert(s.data.includes("List-Unsubscribe-Post: List-Unsubscribe=One-Click"));
    assertEquals(s.transcript.filter(l => l.startsWith("MAIL FROM")).length, 1);
  } finally { await s.close(); }
});
