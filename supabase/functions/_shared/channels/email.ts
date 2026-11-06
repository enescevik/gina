// Email adapters: Resend (HTTPS JSON) and a minimal SMTP client (TLS / STARTTLS; plaintext only when
// explicitly allowed for local fakes). Keys are read from env by name only. There is no provider
// account yet (X01): when env is missing the factory returns `missing` and nothing is sent.
import {
  type AdapterResult,
  type AdapterSetup,
  DEFAULT_TIMEOUT_MS,
  type EmailAdapter,
  type EnvReader,
  httpFailure,
  networkFailure,
  type OutboundEmail,
  requireEnv,
} from "./contract.ts";

// Resend ------------------------------------------------------------------------------------------

export interface ResendConfig {
  apiKey: string;
  endpoint?: string; // default https://api.resend.com/emails; tests point to a fake server
  timeoutMs?: number;
}

export function resendAdapter(cfg: ResendConfig): EmailAdapter {
  const endpoint = cfg.endpoint ?? "https://api.resend.com/emails";
  const timeout = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    provider: "resend",
    async send(message) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(timeout),
          headers: {
            authorization: `Bearer ${cfg.apiKey}`,
            "content-type": "application/json",
            "idempotency-key": message.idempotencyKey,
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
            ...(message.headers ? { headers: message.headers } : {}),
          }),
        });
        if (res.ok) {
          const body = (await res.json().catch(() => ({}))) as { id?: string };
          return {
            ok: true,
            providerMessageId: typeof body.id === "string" ? body.id.slice(0, 200) : null,
            acceptedAt: new Date().toISOString(),
          };
        }
        const body = (await res.json().catch(() => ({}))) as { name?: string };
        return httpFailure("resend", res, typeof body.name === "string" ? body.name.slice(0, 40) : undefined);
      } catch (reason) {
        return networkFailure("resend", reason);
      }
    },
  };
}

// SMTP (minimal, RFC 5321 happy path) -----------------------------------------------------------------

export interface SmtpConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  /** tls = implicit TLS (465), starttls = upgrade after EHLO, plain = local fakes only. */
  security: "tls" | "starttls" | "plain";
  timeoutMs?: number;
  /** Extra trust anchors (PEM) for a private relay; system roots are used otherwise. Never disables verification. */
  caCerts?: string[];
}

const enc = new TextEncoder(), dec = new TextDecoder();

class SmtpSession {
  private buffer = "";
  constructor(private conn: Deno.Conn, private deadline: number) {}
  private async fill(): Promise<boolean> {
    const chunk = new Uint8Array(4096);
    const remaining = this.deadline - Date.now();
    if (remaining <= 0) throw new DOMException("smtp timeout", "TimeoutError");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const n = await Promise.race([
      this.conn.read(chunk),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DOMException("smtp timeout", "TimeoutError")), remaining);
      }),
    ]).finally(() => clearTimeout(timer));
    if (n === null) return false;
    this.buffer += dec.decode(chunk.subarray(0, n));
    return true;
  }
  /** Reads one (possibly multi-line) reply; returns the 3-digit code and the last line text. */
  async reply(): Promise<{ code: number; text: string }> {
    for (;;) {
      const lines = this.buffer.split("\r\n");
      const complete = lines.slice(0, -1);
      const last = complete.findIndex((l) => /^\d{3}(?: |$)/.test(l));
      if (last >= 0) {
        this.buffer = lines.slice(last + 1).join("\r\n");
        const line = complete[last];
        return { code: Number(line.slice(0, 3)), text: line.slice(4) };
      }
      if (!(await this.fill())) throw new Error("smtp_closed");
    }
  }
  async command(line: string): Promise<{ code: number; text: string }> {
    const bytes = enc.encode(line + "\r\n");
    // Conn.write can be partial, particularly with larger HTML MIME messages.
    let offset = 0;
    while (offset < bytes.length) {
      const written = await this.conn.write(bytes.subarray(offset));
      if (written <= 0) throw new Error("smtp_closed");
      offset += written;
    }
    return await this.reply();
  }
  upgrade(conn: Deno.Conn) {
    this.conn = conn;
  }
  close() {
    try {
      this.conn.close();
    } catch { /* already closed */ }
  }
}

function b64(input: string): string {
  return btoa(String.fromCharCode(...enc.encode(input)));
}
function encodedWord(value: string): string {
  // RFC 2047 for non-ASCII subjects; ASCII passes through unchanged.
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`;
}
function dotStuff(body: string): string {
  return body.replace(/\r?\n/g, "\r\n").split("\r\n").map((l) => l.startsWith(".") ? "." + l : l).join("\r\n");
}

/** `GINA <bildirim@example.com>` or a bare address → envelope address, header value and Message-ID domain. */
export function parseSender(from: string): { envelope: string; header: string; domain: string } | null {
  if (/[\r\n]/.test(from)) return null;
  const named = /^\s*"?([^"<>]*?)"?\s*<([^<>\s@]+@[^<>\s@]+)>\s*$/.exec(from);
  const envelope = named ? named[2] : from.trim();
  if (!/^[^<>\s@]+@([^<>\s@]+\.[^<>\s@]+)$/.test(envelope)) return null;
  const name = named?.[1].trim() ?? "";
  const quoted = /^[A-Za-z0-9 !#$%&'*+\-/=?^_`{|}~]*$/.test(name) ? name : `"${name.replace(/["\\]/g, "")}"`;
  const header = name ? `${/^[\x20-\x7e]*$/.test(name) ? quoted : encodedWord(name)} <${envelope}>` : envelope;
  return { envelope, header, domain: envelope.split("@")[1].toLowerCase() };
}

function classify(step: string, r: { code: number }): AdapterResult {
  // 4xx transient (greylisting, rate limits, mailbox busy); 5xx permanent.
  return { ok: false, retry: r.code < 500, error: `smtp:${step}_${r.code}` };
}

export function smtpAdapter(cfg: SmtpConfig): EmailAdapter {
  const timeout = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    provider: "smtp",
    async send(message) {
      const deadline = Date.now() + timeout;
      let session: SmtpSession | null = null;
      // Once the message terminator is written the relay may have queued it even if its reply is lost.
      // SMTP has no idempotency key, so that case is not retried: at most one copy, never two.
      let dataSent = false;
      const sender = parseSender(message.from);
      if (!sender || /[\r\n<>\s]/.test(message.to)) return { ok: false, retry: false, error: "smtp:invalid_address" };
      try {
        const base = cfg.security === "tls"
          ? await Deno.connectTls({ hostname: cfg.host, port: cfg.port, ...(cfg.caCerts ? { caCerts: cfg.caCerts } : {}) })
          : await Deno.connect({ hostname: cfg.host, port: cfg.port });
        session = new SmtpSession(base, deadline);
        const greeting = await session.reply();
        if (greeting.code !== 220) return classify("greeting", greeting);
        let ehlo = await session.command("EHLO gina.local");
        if (ehlo.code !== 250) return classify("ehlo", ehlo);
        if (cfg.security === "starttls") {
          // Never fall back to plaintext: a refused or stripped STARTTLS ends the attempt before
          // credentials, addresses or content are sent.
          const start = await session.command("STARTTLS");
          if (start.code !== 220) return classify("starttls", start);
          session.upgrade(await Deno.startTls(base as Deno.TcpConn, { hostname: cfg.host, ...(cfg.caCerts ? { caCerts: cfg.caCerts } : {}) }));
          ehlo = await session.command("EHLO gina.local");
          if (ehlo.code !== 250) return classify("ehlo", ehlo);
        }
        if (cfg.username) {
          const auth = await session.command(`AUTH PLAIN ${b64(`\0${cfg.username}\0${cfg.password ?? ""}`)}`);
          if (auth.code !== 235) return { ok: false, retry: auth.code < 500, error: `smtp:auth_${auth.code}` };
        }
        const from = await session.command(`MAIL FROM:<${sender.envelope}>`);
        if (from.code !== 250) return classify("mail_from", from);
        const rcpt = await session.command(`RCPT TO:<${message.to}>`);
        if (rcpt.code !== 250 && rcpt.code !== 251) return classify("rcpt_to", rcpt);
        const data = await session.command("DATA");
        if (data.code !== 354) return classify("data", data);
        const boundary = message.html ? `gina-${crypto.randomUUID()}` : null;
        const encodeBody = (text: string) => b64(text).replace(/(.{76})/g, "$1\r\n");
        const headers = [
          `From: ${sender.header}`,
          `To: ${message.to}`,
          `Subject: ${encodedWord(message.subject)}`,
          `Message-ID: <${message.idempotencyKey}@${sender.domain}>`,
          `Date: ${new Date().toUTCString()}`,
          "MIME-Version: 1.0",
          ...(boundary ? [`Content-Type: multipart/alternative; boundary="${boundary}"`] : ["Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64"]),
          ...Object.entries(message.headers ?? {}).map(([k, v]) => `${k}: ${v}`),
        ];
        const body = boundary
          ? [`--${boundary}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", encodeBody(message.text),
            `--${boundary}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64", "", encodeBody(message.html!), `--${boundary}--`, ""].join("\r\n")
          : encodeBody(message.text);
        dataSent = true;
        const end = await session.command(`${headers.join("\r\n")}\r\n\r\n${dotStuff(body)}\r\n.`);
        if (end.code !== 250) return classify("end_of_data", end);
        await session.command("QUIT").catch(() => ({ code: 221, text: "" }));
        const queued = /queued as ([A-Za-z0-9._-]+)/i.exec(end.text)?.[1] ?? null;
        return { ok: true, providerMessageId: queued, acceptedAt: new Date().toISOString() };
      } catch (reason) {
        if (dataSent) return { ok: false, retry: false, error: "smtp:end_of_data_unknown" };
        return networkFailure("smtp", reason);
      } finally {
        session?.close();
      }
    },
  };
}

// Factory -------------------------------------------------------------------------------------------------

/**
 * Builds the adapter named by configuration (`channels.email.provider`). Missing env names are
 * returned for the readiness report; values are never echoed.
 */
export function emailAdapterFromEnv(
  provider: string | null,
  env: EnvReader,
  options: { timeoutMs?: number } = {},
): AdapterSetup<EmailAdapter> {
  if (provider === "resend") {
    const { values, missing } = requireEnv(env, ["RESEND_API_KEY"]);
    if (missing.length) return { adapter: null, missing };
    return {
      adapter: resendAdapter({ apiKey: values.RESEND_API_KEY, endpoint: env.get("RESEND_ENDPOINT") || undefined, timeoutMs: options.timeoutMs }),
      missing: [],
    };
  }
  if (provider === "smtp") {
    const { values, missing } = requireEnv(env, ["SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD"]);
    const security = env.get("SMTP_SECURITY") ?? "tls";
    if (!["tls", "starttls", "plain"].includes(security)) missing.push("SMTP_SECURITY_invalid");
    if (security === "plain" && env.get("SMTP_ALLOW_PLAINTEXT") !== "1") missing.push("SMTP_ALLOW_PLAINTEXT");
    if (missing.length) return { adapter: null, missing };
    return {
      adapter: smtpAdapter({
        host: values.SMTP_HOST,
        port: Number(env.get("SMTP_PORT") ?? (security === "tls" ? 465 : 587)),
        username: values.SMTP_USERNAME,
        password: values.SMTP_PASSWORD,
        security: security as SmtpConfig["security"],
        timeoutMs: options.timeoutMs,
        ...(env.get("SMTP_CA_CERT") ? { caCerts: [env.get("SMTP_CA_CERT")!] } : {}),
      }),
      missing: [],
    };
  }
  return { adapter: null, missing: [provider ? `provider_unknown:${provider}` : "provider_not_selected"] };
}
