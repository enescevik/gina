// Product e-mail uses the approved brand layout in supabase/templates/confirm.html and reset.html.
// Keep its logo/art, 560px shell, colors and typography aligned with those sources.
// Operator copy is always plain text, escaped here; only our own markup is rendered.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function href(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("email_url_invalid");
  return escapeHtml(url.href);
}
interface BrandEmail {
  kind: "verification" | "announcement";
  locale: string;
  title: string;
  body: string;
  code?: string;
  minutes?: number;
  actionUrl: string | null;
  unsubscribeUrl?: string;
}
export function brandedProductEmail({kind, locale, title, body, code, minutes, actionUrl, unsubscribeUrl}: BrandEmail): string {
  const lang = locale === "en" ? "en" : "tr";
  const verify = kind === "verification";
  const preheader = verify
    ? (lang === "en" ? "Confirm your email address for GINA notifications." : "GINA bildirimleri için e-posta adresini doğrula.")
    : (lang === "en" ? "There is a new announcement in GINA." : "GINA’da yeni bir duyurun var.");
  const action = verify ? (lang === "en" ? "Confirm my email" : "E-postamı doğrula") : (lang === "en" ? "View in GINA" : "GINA’da görüntüle");
  const hint = verify
    ? (lang === "en" ? `The code is valid for ${minutes} minutes. You can also enter it in GINA’s notification settings.` : `Kod ${minutes} dakika geçerli. GINA’nın bildirim ayarlarına da girebilirsin.`)
    : (lang === "en" ? "You can find this announcement in your GINA inbox." : "Bu duyuruya GINA’daki bildirimlerinden de ulaşabilirsin.");
  const footer = verify
    ? (lang === "en" ? "If you didn’t request this, ignore this email. No address will be added." : "Bu isteği sen göndermediysen e-postayı dikkate alma. Adresin eklenmez.")
    : (lang === "en" ? "You received this email because you enabled announcement emails in GINA." : "GINA’da duyuru e-postalarını açtığın için bu iletiyi aldın.");
  const footerDetail = verify
    ? escapeHtml(lang === "en" ? "This code is just for your account. Please don’t share it." : "Hesabına özel bir koddur. Başkalarıyla paylaşma.")
    : `<a href="${href(unsubscribeUrl!)}" style="color:#5936C9;text-decoration:underline;display:inline-block;padding:12px 0">${lang === "en" ? "Stop announcement emails" : "Duyuru e-postalarını kapat"}</a>`;
  const codeBlock = verify ? `<p style="margin:0 0 24px;padding:18px 12px;border:1px solid #DDD5F3;border-radius:12px;background:#F2EDFC;color:#201951;text-align:center;font-size:28px;font-weight:700;letter-spacing:3px">${escapeHtml(code ?? "")}</p>` : "";
  const actionBlock = actionUrl ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#5936C9" style="border-radius:12px;text-align:center"><a href="${href(actionUrl)}" style="display:inline-block;border:1px solid #5936C9;border-radius:12px;padding:17px 26px;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:700;mso-padding-alt:17px 26px">${action}</a></td></tr></table>` : "";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>@media(max-width:600px){.pad{padding:28px 24px!important}.shell{padding:16px 10px!important}.heading{font-size:28px!important}.art{width:104px!important}}</style></head><body style="margin:0;background:#F4F5F8;color:#201951;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="shell" align="center" style="padding:36px 16px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px"><tr><td style="padding:0 0 20px 8px"><a href="https://ginafamily.com" style="text-decoration:none"><img src="https://ginafamily.com/email/v1/logo.png" alt="GINA" width="144" height="54" style="display:block;border:0"></a></td></tr><tr><td style="background:#FFFFFF;border-radius:24px;overflow:hidden"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" style="padding:36px 40px 24px;background:#EEF8F2;border-bottom:1px solid #DDEDE5"><img class="art" src="https://ginafamily.com/email/v1/${kind === "verification" ? "device" : "family"}.png" alt="" width="120" style="display:block;border:0;margin:0 0 20px"><h1 class="heading" style="margin:0;color:#201951;font-size:32px;line-height:1.15;letter-spacing:-1px;font-weight:700;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(title)}</h1></td></tr><tr><td class="pad" style="padding:32px 40px 36px"><p style="margin:0 0 26px;font-size:16px;line-height:1.7;color:#4D4963;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(body).replace(/\r?\n/g, "<br>")}</p>${codeBlock}${actionBlock}<p style="margin:18px 0 28px;font-size:13px;line-height:1.6;color:#6B657B">${escapeHtml(hint)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #EAE7F0;padding:24px 0 0"><p style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#4D4963">${escapeHtml(footer)}</p><p style="margin:0;font-size:12px;line-height:1.6;color:#767084">${footerDetail}</p></td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:24px 16px"><a href="https://ginafamily.com" style="color:#5936C9;text-decoration:none;font-size:13px;font-weight:700">ginafamily.com</a><p style="margin:10px 0 0;color:#787384;font-size:12px;line-height:1.6">${lang === "en" ? "This is an automated GINA email. No reply is needed." : "Bu otomatik GINA e-postasını yanıtlamana gerek yok."}</p></td></tr></table></td></tr></table></body></html>`;
}
