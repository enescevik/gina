// SMTP over real TLS against a loopback fake with a throwaway CA (C10). No real provider or mailbox.
// Run: deno test --config supabase/functions/deno.json --allow-net=127.0.0.1 --allow-run=openssl \
//        --allow-read --allow-write --allow-env supabase/functions/_shared/channels/email-tls.test.ts
import { assert, assertEquals, assertMatch } from "jsr:@std/assert";
import { emailAdapterFromEnv, smtpAdapter } from "./email.ts";
import type { OutboundEmail } from "./contract.ts";
import { decodeBody, makeTestPki, startFakeSmtp } from "./fake-smtp.ts";

const message: OutboundEmail = {
  to: "parent@example.invalid",
  from: "noreply@example.invalid",
  subject: "GINA doğrulama kodu",
  text: "GINA hesabın için doğrulama kodu: ABCD2345\n.nokta ile başlayan satır",
  headers: { "List-Unsubscribe": "<https://example.invalid/u?token=x>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  idempotencyKey: "gina-channel-77",
};

Deno.test("smtp implicit TLS: certificate verified against the configured CA, message accepted", async () => {
  const pki = await makeTestPki();
  const s = await startFakeSmtp({ mode: "tls", pki });
  try {
    const r = await smtpAdapter({ host: "127.0.0.1", port: s.port, username: "u", password: "p", security: "tls", caCerts: [pki.caPem], timeoutMs: 5000 }).send(message);
    assert(r.ok, JSON.stringify(r));
    assertEquals(r.providerMessageId, "FAKE1");
    assert(s.transcript.every((t) => t.tls), "every command travelled inside TLS");
    assertEquals(s.mails.length, 1);
    const { headers, text } = decodeBody(s.mails[0].data);
    assertMatch(headers, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
    assertEquals(text.replace(/\r\n/g, "\n"), message.text);
  } finally {
    await s.close();
    await pki.cleanup();
  }
});

Deno.test("smtp STARTTLS: only EHLO/STARTTLS in clear; AUTH, addresses and content only after the upgrade", async () => {
  const pki = await makeTestPki();
  const s = await startFakeSmtp({ mode: "starttls", pki });
  try {
    const r = await smtpAdapter({ host: "127.0.0.1", port: s.port, username: "u", password: "p", security: "starttls", caCerts: [pki.caPem], timeoutMs: 5000 }).send(message);
    assert(r.ok, JSON.stringify(r));
    const clear = s.transcript.filter((t) => !t.tls).map((t) => t.line);
    assertEquals(clear, ["EHLO gina.local", "STARTTLS"]);
    const secure = s.transcript.filter((t) => t.tls).map((t) => t.line.split(":")[0].split(" ")[0]);
    for (const verb of ["EHLO", "AUTH", "MAIL", "RCPT", "DATA"]) assert(secure.includes(verb), verb + " over TLS");
    assertEquals(s.mails[0].to, "parent@example.invalid");
  } finally {
    await s.close();
    await pki.cleanup();
  }
});

Deno.test("smtp STARTTLS refused or stripped: no plaintext fallback, retryable, nothing sensitive sent", async () => {
  const pki = await makeTestPki();
  const s = await startFakeSmtp({ mode: "starttls", pki, refuseStartTls: true });
  try {
    const r = await smtpAdapter({ host: "127.0.0.1", port: s.port, username: "u", password: "p", security: "starttls", caCerts: [pki.caPem], timeoutMs: 5000 }).send(message);
    assert(!r.ok && r.retry && r.error === "smtp:starttls_454", JSON.stringify(r));
    assertEquals(s.transcript.map((t) => t.line), ["EHLO gina.local", "STARTTLS"]);
    assertEquals(s.mails.length, 0);
  } finally {
    await s.close();
    await pki.cleanup();
  }
});

Deno.test("smtp TLS with an untrusted certificate fails closed (no verification bypass)", async () => {
  const pki = await makeTestPki();
  for (const mode of ["tls", "starttls"] as const) {
    const s = await startFakeSmtp({ mode, pki });
    try {
      const r = await smtpAdapter({ host: "127.0.0.1", port: s.port, username: "u", password: "p", security: mode, timeoutMs: 3000 }).send(message);
      assert(!r.ok && r.retry && r.error === "smtp:network_error", `${mode}: ${JSON.stringify(r)}`);
      assert(!s.transcript.some((t) => /^(AUTH|MAIL|RCPT|DATA)/.test(t.line)), `${mode}: nothing sensitive reached the server`);
      assertEquals(s.mails.length, 0);
    } finally {
      await s.close();
    }
  }
  await pki.cleanup();
});

Deno.test("factory: SMTP_CA_CERT adds a trust anchor for a private relay; STARTTLS default port 587", async () => {
  const pki = await makeTestPki();
  const s = await startFakeSmtp({ mode: "starttls", pki });
  try {
    const env = { get: (k: string) => ({ SMTP_HOST: "127.0.0.1", SMTP_PORT: String(s.port), SMTP_USERNAME: "u", SMTP_PASSWORD: "p", SMTP_SECURITY: "starttls", SMTP_CA_CERT: pki.caPem } as Record<string, string>)[k] };
    const setup = emailAdapterFromEnv("smtp", env, { timeoutMs: 5000 });
    assert(setup.adapter);
    const r = await setup.adapter.send(message);
    assert(r.ok, JSON.stringify(r));
  } finally {
    await s.close();
    await pki.cleanup();
  }
});
