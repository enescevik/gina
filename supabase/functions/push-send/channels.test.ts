import { assert, assertEquals, assertRejects } from "jsr:@std/assert";
import { type ChannelDependencies, type ChannelOutcome, drainChannels, workerMissing } from "./channels.ts";
import type { ChannelRow } from "../_shared/channels/render.ts";
import { renderEmail, RenderError, renderSms } from "../_shared/channels/render.ts";
import type { AdapterResult, EmailAdapter, OutboundEmail, OutboundSms, SmsAdapter } from "../_shared/channels/contract.ts";

const announcement: ChannelRow = {
  id: 11,
  lease_id: "lease-11",
  channel: "email",
  purpose: "announcement",
  kind: "parent_announcement",
  attempts: 1,
  recipient: "parent@example.invalid",
  locale: "tr",
  payload: { inbox_id: "00000000-0000-4000-8000-000000000001" },
  provider: "resend",
  sender: "noreply@example.invalid",
  unsubscribe_token: "dG9rZW4.abcdef0123456789abcdef0123456789abcdef01",
  announcement: { title: "Yarıyıl tatili", body: "Okul takvimi güncellendi.", expires_on: "2026-12-01" },
};
const verification: ChannelRow = {
  ...announcement,
  id: 12,
  lease_id: "lease-12",
  channel: "sms",
  purpose: "service",
  kind: "contact_verification",
  recipient: "+905551112233",
  payload: { verification_id: "v", secret: "123456", expires_at: new Date(Date.now() + 15 * 60000).toISOString() },
  provider: "http",
  sender: "GINA",
  unsubscribe_token: null,
  announcement: null,
};
const render = { unsubscribeUrl: "https://example.invalid/unsubscribe", confirmUrl: null };

function fixture(rows: ChannelRow[], email: (m: OutboundEmail) => Promise<AdapterResult> | AdapterResult, sms?: (m: OutboundSms) => Promise<AdapterResult> | AdapterResult) {
  const receipts: { id: number; status: ChannelOutcome; provider: string | null; messageId: string | null; error: string | null; retryAfter?: number }[] = [];
  const sent: string[] = [];
  const pending = new Map(rows.map((r) => [r.id, r]));
  const emailAdapter: EmailAdapter = { provider: "resend", send: (m) => (sent.push(`email:${m.idempotencyKey}`), Promise.resolve(email(m))) };
  const smsAdapter: SmsAdapter = { provider: "http", send: (m) => (sent.push(`sms:${m.idempotencyKey}`), Promise.resolve(sms ? sms(m) : { ok: true, providerMessageId: "s", acceptedAt: "" })) };
  const d: ChannelDependencies = {
    claim: (limit) => Promise.resolve([...pending.values()].slice(0, limit)),
    emailFor: () => ({ adapter: emailAdapter, missing: [] }),
    smsFor: () => ({ adapter: smsAdapter, missing: [] }),
    record: (row, status, provider, messageId, error, retryAfter) => {
      receipts.push({ id: row.id, status, provider, messageId, error, retryAfter });
      // Mirrors the DB: every recorded row leaves the claimable set (retry waits for backoff).
      pending.delete(row.id);
      return Promise.resolve();
    },
    render,
    receiptRetryDelayMs: 0,
  };
  return { d, receipts, sent, pending };
}

Deno.test("accepted message is recorded with the provider id and never sent twice", async () => {
  const f = fixture([announcement, verification], () => ({ ok: true, providerMessageId: "re_1", acceptedAt: "now" }));
  const counts = await drainChannels(f.d);
  assertEquals(counts, { claimed: 2, accepted: 2, retry: 0, failed: 0, unconfigured: 0 });
  assertEquals(f.sent, ["email:gina-channel-11", "sms:gina-channel-12"]);
  assertEquals(f.receipts[0], { id: 11, status: "accepted", provider: "resend", messageId: "re_1", error: null, retryAfter: undefined });
  // A second tick after the DB marked both rows accepted claims nothing: no double send.
  const again = await drainChannels(f.d);
  assertEquals(again.claimed, 0);
  assertEquals(f.sent.length, 2);
});

Deno.test("429 / 5xx / timeout become retry receipts with the provider delay; permanent errors fail", async () => {
  let n = 0;
  const f = fixture([announcement, { ...announcement, id: 13, lease_id: "l13" }, { ...announcement, id: 14, lease_id: "l14" }], () => {
    n++;
    if (n === 1) return { ok: false, retry: true, error: "resend:http_429", retryAfterSeconds: 120 };
    if (n === 2) return { ok: false, retry: true, error: "resend:timeout" };
    return { ok: false, retry: false, error: "resend:http_422:validation_error" };
  });
  const counts = await drainChannels(f.d);
  assertEquals([counts.retry, counts.failed], [2, 1]);
  assertEquals(f.receipts.map((r) => [r.status, r.error, r.retryAfter]), [["retry", "resend:http_429", 120], ["retry", "resend:timeout", undefined], ["failed", "resend:http_422:validation_error", undefined]]);
});

Deno.test("adapter exception is a retry; a failing receipt stops the worker before the next row", async () => {
  const f = fixture([announcement, { ...announcement, id: 15, lease_id: "l15" }], () => Promise.reject(new Error("boom")));
  const counts = await drainChannels(f.d);
  assertEquals(counts.retry, 2);
  assertEquals(f.receipts[0].error, "adapter_exception");
  const g = fixture([announcement, { ...announcement, id: 16, lease_id: "l16" }], () => ({ ok: true, providerMessageId: null, acceptedAt: "" }));
  g.d.record = () => Promise.reject(new Error("channel_receipt_invalid"));
  await assertRejects(() => drainChannels(g.d), Error, "channel_receipt_invalid");
  assertEquals(g.sent.length, 1, "no further sends after a lost receipt");
});

Deno.test("H04: a transient receipt failure after acceptance is retried; the message is sent once", async () => {
  const f = fixture([announcement, { ...announcement, id: 17, lease_id: "l17" }], () => ({ ok: true, providerMessageId: "re_x", acceptedAt: "" }));
  const original = f.d.record;
  let calls = 0;
  f.d.record = (...args) => (++calls === 1 ? Promise.reject(new Error("push_storage_failed")) : original(...args));
  const counts = await drainChannels(f.d);
  assertEquals(counts.accepted, 2);
  assertEquals(f.sent, ["email:gina-channel-11", "email:gina-channel-17"], "one provider call per row");
  assertEquals(f.receipts.map((r) => [r.id, r.status]), [[11, "accepted"], [17, "accepted"]]);
  assertEquals(calls, 3);
});

Deno.test("missing provider or unsubscribe URL records unconfigured, not a retry loop; nothing is sent", async () => {
  const f = fixture([announcement, verification], () => ({ ok: true, providerMessageId: "x", acceptedAt: "" }));
  f.d.emailFor = () => ({ adapter: null, missing: ["RESEND_API_KEY"] });
  const counts = await drainChannels(f.d);
  assertEquals(counts.unconfigured, 1);
  assertEquals(f.receipts[0], { id: 11, status: "unconfigured", provider: "resend", messageId: null, error: "provider_unconfigured:RESEND_API_KEY", retryAfter: undefined });
  assertEquals(f.sent, ["sms:gina-channel-12"], "service SMS still goes while email is unconfigured");
  const g = fixture([announcement], () => ({ ok: true, providerMessageId: "x", acceptedAt: "" }));
  g.d.render = { unsubscribeUrl: null, confirmUrl: null };
  await drainChannels(g.d);
  assertEquals(g.receipts[0].status, "unconfigured");
  assertEquals(g.receipts[0].error, "unsubscribe_url_missing");
  assertEquals(g.sent, [], "announcement mail without an unsubscribe link is never sent");
  assertEquals(workerMissing("email", { adapter: null, missing: ["RESEND_API_KEY"] }, g.d.render), ["RESEND_API_KEY", "unsubscribe_url_missing"]);
});

Deno.test("time budget stops claiming", async () => {
  let t = 0;
  const f = fixture([announcement, { ...announcement, id: 17, lease_id: "l17" }], () => ({ ok: true, providerMessageId: "x", acceptedAt: "" }));
  f.d.now = () => (t += 30000);
  f.d.budgetMs = 45000;
  const counts = await drainChannels(f.d);
  assertEquals(counts.claimed, 1);
});

Deno.test("render: generic text, unsubscribe headers, code only for the verification; no secret means not sendable", () => {
  const mail = renderEmail(announcement, render);
  assertEquals(mail.subject, "Yarıyıl tatili");
  assert(mail.text.includes("Okul takvimi güncellendi.") && mail.text.includes("token=dG9rZW4.abcdef"));
  assertEquals(mail.headers?.["List-Unsubscribe"], "<https://example.invalid/unsubscribe?token=dG9rZW4.abcdef0123456789abcdef0123456789abcdef01>");
  const sms = renderSms(verification, render);
  assert(sms.text.includes("123456") && sms.text.includes("15 dk") && !sms.text.includes("token="), sms.text);
  const en = renderSms({ ...verification, locale: "en" }, render);
  assert(en.text.startsWith("GINA verification code: 123456"));
  let caught: unknown;
  try {
    renderSms({ ...verification, payload: { verification_id: "v" } }, render);
  } catch (e) {
    caught = e;
  }
  assert(caught instanceof RenderError && caught.reason === "secret_scrubbed");
  const smsNotice = renderSms({ ...announcement, channel: "sms", recipient: "+905551112233", sender: "GINA" }, render);
  assert(smsNotice.text.startsWith("GINA duyuru: Yarıyıl tatili") && smsNotice.text.length <= 300);
});

Deno.test("C10 render: List-Unsubscribe points to the one-click endpoint, the visible link to the page; verify mail carries a deep link", () => {
  const o = { unsubscribeUrl: "https://edge.example.invalid/functions/v1/channel-unsubscribe", unsubscribePageUrl: "https://app.example.invalid/unsubscribe", confirmUrl: "https://app.example.invalid/verify-contact" };
  const mail = renderEmail(announcement, o);
  assertEquals(mail.headers?.["List-Unsubscribe"], `<${o.unsubscribeUrl}?token=${encodeURIComponent(announcement.unsubscribe_token!)}>`);
  assertEquals(mail.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert(mail.text.includes(`${o.unsubscribePageUrl}?token=`), "people get the page link");
  assert(!mail.text.includes(o.unsubscribeUrl), "the POST endpoint is not shown as the human link when a page exists");
  const sms = renderSms({ ...announcement, channel: "sms", sender: "GINA" }, o);
  assert(sms.text.includes(`${o.unsubscribePageUrl}?token=`));
  const code = renderEmail({ ...verification, channel: "email", sender: "noreply@example.invalid", payload: { ...verification.payload, secret: "ABCD2345" } }, o);
  assert(code.text.includes(`${o.confirmUrl}?kind=email&code=ABCD2345`), "deep link pre-fills the code");
  assert(!code.headers, "service mail has no unsubscribe header");
  // Without a page the endpoint link is used (its GET shows a confirmation form, never unsubscribes).
  assert(renderEmail(announcement, { ...o, unsubscribePageUrl: null }).text.includes(`${o.unsubscribeUrl}?token=`));
});

Deno.test("brand mail: approved assets, localized code and CTA, safe operator copy and unsubscribe remain", () => {
  const opts = { ...render, confirmUrl: "https://ginafamily.com/verify-contact", unsubscribePageUrl: "https://ginafamily.com/unsubscribe" };
  for (const locale of ["tr", "en", "de"]) {
    const m = renderEmail({ ...verification, channel: "email", sender: "GINA <bildirim@example.invalid>", locale }, opts);
    assert(m.html);
    assert(m.html.includes(`lang="${locale === "en" ? "en" : "tr"}"`));
    assert(m.html.includes("https://ginafamily.com/email/v1/logo.png"));
    assert(m.html.includes("https://ginafamily.com/email/v1/device.png"));
    assert(m.html.includes("#5936C9") && m.html.includes("#EEF8F2"));
    assert(m.html.includes("123456") && m.text.includes("123456"));
    assert(m.html.includes("kind=email&amp;code=123456"));
    assert(m.html.includes(locale === "en" ? "Confirm my email" : "E-postamı doğrula"));
    assert(!m.html.includes("Stop announcement") && !m.html.includes("Duyuru e-postalarını kapat"));
  }
  const hostile = { ...announcement, announcement: { ...announcement.announcement!, title: '<img src=x onerror="alert(1)">', body: 'Merhaba <script>alert(1)</script> & "test"\nİkinci satır' } };
  const mail = renderEmail(hostile, opts);
  assert(mail.html);
  assert(mail.html.includes("https://ginafamily.com/email/v1/family.png"));
  assert(mail.html.includes("&lt;img") && mail.html.includes("&lt;script&gt;"));
  assert(!mail.html.includes("<script>") && !mail.html.includes('<img src=x'));
  assert(mail.html.includes('<br>İkinci satır'));
  assert(mail.html.includes('href="https://ginafamily.com/parent/inbox"'));
  assert(mail.html.includes('href="https://ginafamily.com/unsubscribe?token='));
  assertEquals(mail.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert(mail.text.includes(hostile.announcement.body));
});
