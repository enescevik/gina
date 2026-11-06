// C10: RFC 8058 one-click unsubscribe endpoint for announcement/marketing email and SMS links.
// - POST (mail client one-click or the fallback form): body must carry `List-Unsubscribe=One-Click`,
//   the signed token is in the URL. The database verifies the HMAC, expiry and single use.
// - GET/HEAD never change anything (link scanners and previews fetch URLs): they redirect to the
//   app's unsubscribe page, or show a minimal form that POSTs back here.
// No session is required; the token is the only authority. Tokens are never logged or echoed.

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}\.[a-f0-9]{40}$/;
const MAX_BODY_BYTES = 2048;

export type ApplyResult =
  | { ok: true; status: "unsubscribed" | "already_done"; channel: string; purpose: string }
  | { ok: false; reason: "invalid" | "expired" | "unavailable" };

export interface UnsubscribeDependencies {
  /** Calls public.channel_one_click_unsubscribe with the service role. */
  apply(token: string): Promise<ApplyResult>;
  /** Web page that explains and offers the button (GET target). Optional. */
  pageUrl: string | null;
}

const baseHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
};

function text(body: string, status: number, extra: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { ...baseHeaders, "content-type": "text/plain; charset=utf-8", ...extra } });
}

function formPage(action: string): Response {
  // Static markup; the token only appears inside the form action of this same URL.
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex,nofollow"><title>GINA</title></head>` +
    `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:2rem auto;padding:0 1rem;color:#201951;background:#FCFAF6">` +
    `<h1 style="font-size:1.4rem">GINA duyuru iletileri</h1>` +
    `<p>Bu bağlantı, GINA duyurularının bu kanaldan gönderilmesini durdurur. Hesap ve güvenlik iletileri etkilenmez.</p>` +
    `<form method="post" action="${action}"><input type="hidden" name="List-Unsubscribe" value="One-Click">` +
    `<button type="submit" style="min-height:48px;padding:0 1.25rem;font-size:1rem">Duyuru iletilerini durdur</button></form>` +
    `<p lang="en" style="color:#625C85">Stops GINA announcement messages on this channel. Account and security messages are not affected.</p>` +
    `</body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      ...baseHeaders,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

async function readLimited(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** True when the POST body is the RFC 8058 one-click form (urlencoded or multipart). */
export function isOneClickBody(contentType: string, body: string): boolean {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type === "application/x-www-form-urlencoded") {
    return new URLSearchParams(body).getAll("List-Unsubscribe").includes("One-Click");
  }
  if (type === "multipart/form-data") {
    // Minimal check: a part named List-Unsubscribe whose value is One-Click.
    return /name="List-Unsubscribe"\r?\n(?:[^\r\n]+\r?\n)*\r?\nOne-Click\r?\n/.test(body);
  }
  return false;
}

export async function handleUnsubscribe(req: Request, d: UnsubscribeDependencies): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
    return text("method_not_allowed", 405, { allow: "GET, HEAD, POST" });
  }
  if (!TOKEN_PATTERN.test(token)) return text("unsubscribe_invalid", 400);

  if (req.method !== "POST") {
    if (d.pageUrl) {
      const target = new URL(d.pageUrl);
      target.searchParams.set("token", token);
      return new Response(null, { status: 303, headers: { ...baseHeaders, location: target.toString() } });
    }
    return req.method === "HEAD" ? new Response(null, { status: 200, headers: baseHeaders }) : formPage(`?token=${encodeURIComponent(token)}`);
  }

  const body = await readLimited(req);
  if (body === null) return text("payload_too_large", 413);
  if (!isOneClickBody(req.headers.get("content-type") ?? "", body)) return text("one_click_body_required", 400);

  let result: ApplyResult;
  try {
    result = await d.apply(token);
  } catch {
    result = { ok: false, reason: "unavailable" };
  }
  if (result.ok) {
    return text(result.status === "already_done" ? "already_unsubscribed" : "unsubscribed", 200);
  }
  if (result.reason === "expired") return text("unsubscribe_expired", 410);
  if (result.reason === "invalid") return text("unsubscribe_invalid", 400);
  return text("temporarily_unavailable", 503, { "retry-after": "60" });
}

/** Maps a database error message to a public reason; everything else is "unavailable" (retryable). */
export function reasonFromError(message: string | undefined): "invalid" | "expired" | "unavailable" {
  if (message === "unsubscribe_invalid") return "invalid";
  if (message === "unsubscribe_expired") return "expired";
  return "unavailable";
}
