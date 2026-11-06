// Turkish operator text for S02 channel readiness and announcement channel
// previews. Codes come from gina.channel_readiness(), gina.channel_block_reason()
// and gina.announcement_channel_preview(); unknown codes fall back to a neutral
// sentence instead of showing the raw code as the primary message.
export type ChannelKey = "in_app" | "push" | "email" | "sms";
export const channelNames: Record<ChannelKey, string> = {
  in_app: "Uygulama içi",
  push: "Telefon bildirimi (push)",
  email: "E-posta",
  sms: "SMS",
};
const missingText: Record<string, string> = {
  provider_not_selected: "Gönderim hizmeti seçilmedi",
  from_address_missing: "Gönderen e-posta adresi tanımlı değil",
  sender_domain_unverified: "Gönderen alan adı doğrulanmadı",
  sender_id_missing: "SMS gönderen adı tanımlı değil",
  worker_report_missing: "Gönderim görevi son 24 saatte durum bildirmedi",
  provider_secret_missing: "Hizmet anahtarı sunucuda tanımlı değil",
  unsubscribe_url_missing: "Duyurudan çıkma bağlantısı tanımlı değil",
  marketing_legal_review_pending:
    "Pazarlama iletisi için hukuk incelemesi bekleniyor",
  CHANNEL_UNSUBSCRIBE_URL: "Duyurudan çıkma bağlantısı tanımlı değil",
};
export const missingLabel = (code: string) =>
  missingText[code] ??
    (/^[A-Z0-9_]+$/.test(code)
      ? "Sunucu ortam ayarı eksik"
      : "Kanal ayarı eksik");
const blockedText: Record<string, string> = {
  channel_not_ready: "Kanal hazır değil",
  channel_unsupported: "Bu kanal duyuru için desteklenmiyor",
  marketing_legal_review_pending: "Hukuk incelemesi bekleniyor",
  not_a_parent: "Veli hesabı değil",
  address_unverified: "Doğrulanmış adres yok",
  preference_off: "Veli bu kanalı kapatmış",
  no_active_session: "Velinin açık oturumu yok",
  announcement_withdrawn: "Duyuru geri çekildi",
  address_revoked: "Adres kaldırıldı",
  retry_limit: "Deneme sınırı doldu",
  provider_unconfigured: "Hizmet ayarı eksikti",
};
export const blockedLabel = (code: string) =>
  blockedText[code] ?? "Başka bir nedenle uygun değil";
export type ChannelState = {
  ready: boolean;
  missing: string[];
  reported_at: string | null;
};
export type Readiness = Partial<Record<ChannelKey, ChannelState>> & {
  marketing?: { allowed: boolean; missing: string[] };
};
export type ChannelPreview = Record<
  string,
  {
    ready: boolean;
    missing: string[];
    eligible: number;
    blocked: Record<string, number>;
  }
>;
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((m): m is string => typeof m === "string") : [];
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function readReadiness(v: unknown): Readiness {
  if (!isObject(v)) return {};
  const out: Readiness = {};
  for (const k of ["in_app", "push", "email", "sms"] as const) {
    const c = v[k];
    if (!isObject(c)) continue;
    out[k] = {
      ready: c.ready === true,
      missing: strings(c.missing),
      reported_at: typeof c.reported_at === "string" ? c.reported_at : null,
    };
  }
  if (isObject(v.marketing)) {
    out.marketing = {
      allowed: v.marketing.allowed === true,
      missing: strings(v.marketing.missing),
    };
  }
  return out;
}
export function readChannelPreview(v: unknown): ChannelPreview {
  const out: ChannelPreview = {};
  if (!isObject(v)) return out;
  for (const [k, c] of Object.entries(v)) {
    if (!isObject(c)) continue;
    const blocked: Record<string, number> = {};
    if (isObject(c.blocked)) {
      for (const [r, n] of Object.entries(c.blocked)) {
        if (typeof n === "number") blocked[r] = n;
      }
    }
    out[k] = {
      ready: c.ready === true,
      missing: strings(c.missing),
      eligible: typeof c.eligible === "number" ? c.eligible : 0,
      blocked,
    };
  }
  return out;
}
const outcomeText: Record<string, string> = {
  queued: "Gönderim sırasına alındı",
  pending: "Sırada",
  sending: "Gönderiliyor",
  accepted: "Sağlayıcı kabul etti (okundu değildir)",
  failed: "Başarısız",
};
// admin_announcement_channels keys look like "accepted", "skipped:preference_off".
export function outcomeLabel(code: string) {
  const [status, reason] = code.split(":");
  if (status === "skipped" && reason) return `Atlandı · ${blockedLabel(reason)}`;
  return outcomeText[status ?? ""] ?? blockedLabel(code);
}
// Push outbox status → event (what happened) first, resolution second.
export function pushEvent(
  status: string,
  receipts: Record<string, number>,
): { event: string; fix: string; tone: "ok" | "warn" | "error" } {
  const sent = receipts.sent ?? 0,
    retry = receipts.retry ?? 0,
    failed = (receipts.failed ?? 0) + (receipts.gone ?? 0);
  switch (status) {
    case "sent":
      return {
        event: `Sağlayıcı ${sent} cihaz için bildirimi kabul etti.`,
        fix:
          "İşlem gerekmez. Sağlayıcı kabulü, velinin bildirimi gördüğü veya okuduğu anlamına gelmez.",
        tone: "ok",
      };
    case "failed":
      return {
        event: `Bildirim ${
          failed || retry ? `${failed + retry} cihaza` : "bazı cihazlara"
        } iletilemedi${sent ? `; ${sent} cihaz için kabul alındı` : ""}.`,
        fix:
          "Hizmet ayarını ve kanal hazırlığını kontrol edin; sonra yalnız başarısız cihazları yeniden sıraya alın. Kabul edilmiş cihazlara tekrar gönderilmez.",
        tone: "error",
      };
    case "skipped_unconfigured":
      return {
        event: "Push hizmeti ayarı eksik olduğu için gönderim yapılmadı.",
        fix:
          "Üstteki kanal hazırlığı kartındaki eksikleri tamamlayın; sonra kaydı yeniden sıraya alabilirsiniz.",
        tone: "warn",
      };
    case "no_targets":
      return {
        event: "Bildirim izni veren uygun bir cihaz bulunamadı.",
        fix:
          "İşlem gerekmez; uygulama içi kayıt aile tarafında görünmeye devam eder.",
        tone: "warn",
      };
    case "sending":
      return {
        event: "Gönderim sürüyor.",
        fix: "Bekleyin; gönderim sürerken yeni talep oluşturulmaz.",
        tone: "warn",
      };
    default:
      return {
        event: "Bildirim gönderim sırasında.",
        fix: retry
          ? `${retry} cihaz için geçici hata sonrası otomatik yeniden deneme planlandı.`
          : "Otomatik gönderim bekleniyor; işlem gerekmez.",
        tone: "warn",
      };
  }
}
