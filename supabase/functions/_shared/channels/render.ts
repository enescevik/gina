// Renders a claimed channel_outbox row into an outbound message. Text is generic: a verification code
// or the operator-authored announcement copy. No child name, score or family data ever enters here.
import type { OutboundEmail, OutboundSms } from "./contract.ts";
import { brandedProductEmail } from "./brand-email.ts";

export interface ChannelRow {
  id: number;
  lease_id: string;
  channel: "email" | "sms";
  purpose: "service" | "announcement" | "marketing";
  kind: "contact_verification" | "parent_announcement";
  attempts: number;
  recipient: string;
  locale: "tr" | "en" | string;
  payload: Record<string, unknown>;
  provider: string | null;
  sender: string | null;
  unsubscribe_token: string | null;
  announcement: { title: string; body: string; expires_on: string } | null;
}

export interface RenderOptions {
  /** Base URL of the one-click unsubscribe endpoint (Edge `channel-unsubscribe`, RFC 8058 POST target);
   * without it announcement mail is not sendable. */
  unsubscribeUrl: string | null;
  /** Optional human page (web `/unsubscribe`) used for the visible link in the body and in SMS. When
   * absent the visible link is the endpoint itself, whose GET shows a confirmation form (never a GET side effect). */
  unsubscribePageUrl?: string | null;
  /** Optional deep link that pre-fills the verification code in the app. */
  confirmUrl: string | null;
}

const T = {
  tr: {
    verifySubject: "GINA doğrulama kodu",
    verifyBody: (code: string, minutes: number) =>
      `GINA hesabın için doğrulama kodu: ${code}\n\nKod ${minutes} dakika geçerlidir. Bu isteği sen yapmadıysan bu iletiyi yok sayabilirsin; adres eklenmez.`,
    verifySms: (code: string, minutes: number) => `GINA dogrulama kodu: ${code} (${minutes} dk gecerli). Siz istemediyseniz yok sayin.`,
    announcementFooter: (url: string) => `\n\n—\nBu ileti, GINA uygulamasındaki duyurunun kopyasıdır. Duyuru e-postalarını kapatmak için: ${url}`,
    announcementSms: (title: string, url: string) => `GINA duyuru: ${title}. Ayrintilar uygulamada. Iptal: ${url}`,
  },
  en: {
    verifySubject: "GINA verification code",
    verifyBody: (code: string, minutes: number) =>
      `Your GINA verification code: ${code}\n\nThe code is valid for ${minutes} minutes. If you did not request this, ignore this message; no address will be added.`,
    verifySms: (code: string, minutes: number) => `GINA verification code: ${code} (valid ${minutes} min). Ignore if you did not request it.`,
    announcementFooter: (url: string) => `\n\n—\nThis is a copy of an announcement in the GINA app. To stop announcement emails: ${url}`,
    announcementSms: (title: string, url: string) => `GINA notice: ${title}. Details in the app. Stop: ${url}`,
  },
};

export class RenderError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

function minutesLeft(row: ChannelRow): number {
  const until = Date.parse(String(row.payload.expires_at ?? ""));
  return Number.isFinite(until) ? Math.max(1, Math.round((until - Date.now()) / 60000)) : (row.channel === "email" ? 60 : 15);
}

function withToken(base: string, token: string): string {
  return `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}
/** One-click endpoint URL (List-Unsubscribe header). */
function unsubscribeLink(row: ChannelRow, o: RenderOptions): string {
  if (!o.unsubscribeUrl || !row.unsubscribe_token) throw new RenderError("unsubscribe_url_missing");
  return withToken(o.unsubscribeUrl, row.unsubscribe_token);
}
/** Visible link for people: the web page when configured, otherwise the endpoint (GET = form). */
function unsubscribePageLink(row: ChannelRow, o: RenderOptions): string {
  const endpoint = unsubscribeLink(row, o);
  return o.unsubscribePageUrl ? withToken(o.unsubscribePageUrl, row.unsubscribe_token!) : endpoint;
}

export function renderEmail(row: ChannelRow, o: RenderOptions): OutboundEmail {
  const t = row.locale === "en" ? T.en : T.tr;
  if (!row.sender) throw new RenderError("from_address_missing");
  const base = { to: row.recipient, from: row.sender, idempotencyKey: `gina-channel-${row.id}` };
  if (row.kind === "contact_verification") {
    const code = String(row.payload.secret ?? "");
    if (!code) throw new RenderError("secret_scrubbed");
    // Deep link: opens the app's verify screen with the code filled in; the parent still confirms
    // while signed in, so a scanner fetching the link verifies nothing.
    const link = o.confirmUrl ? `\n\n${o.confirmUrl}${o.confirmUrl.includes("?") ? "&" : "?"}kind=email&code=${encodeURIComponent(code)}` : "";
    return { ...base, subject: t.verifySubject, text: t.verifyBody(code, minutesLeft(row)) + link,
      html: brandedProductEmail({ kind: "verification", locale: row.locale,
        title: row.locale === "en" ? "Confirm your email." : "E-posta adresini doğrula.",
        body: row.locale === "en" ? "Use the code below to receive GINA notifications at this address." : "GINA bildirimlerini bu adreste alabilmek için aşağıdaki kodu kullan.",
        code, minutes: minutesLeft(row), actionUrl: link.trim() || null }) };
  }
  if (!row.announcement) throw new RenderError("announcement_missing");
  const oneClick = unsubscribeLink(row, o);
  return {
    ...base,
    subject: row.announcement.title.slice(0, 160),
    text: row.announcement.body + t.announcementFooter(unsubscribePageLink(row, o)),
    html: brandedProductEmail({kind: "announcement", locale: row.locale, title: row.announcement.title.slice(0, 160), body: row.announcement.body,
      actionUrl: "https://ginafamily.com/parent/inbox", unsubscribeUrl: unsubscribePageLink(row, o)}),
    headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export function renderSms(row: ChannelRow, o: RenderOptions): OutboundSms {
  const t = row.locale === "en" ? T.en : T.tr;
  if (!row.sender) throw new RenderError("sender_id_missing");
  const base = { to: row.recipient, from: row.sender, idempotencyKey: `gina-channel-${row.id}` };
  if (row.kind === "contact_verification") {
    const code = String(row.payload.secret ?? "");
    if (!code) throw new RenderError("secret_scrubbed");
    return { ...base, text: t.verifySms(code, minutesLeft(row)) };
  }
  if (!row.announcement) throw new RenderError("announcement_missing");
  return { ...base, text: t.announcementSms(row.announcement.title.slice(0, 60), unsubscribePageLink(row, o)).slice(0, 300) };
}
