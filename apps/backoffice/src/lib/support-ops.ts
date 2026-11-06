import { adminRpc } from "./admin-rpc";

// B04 operatör RPC'leri (`20261106210000_support_assignment.sql`). Üretilmiş veritabanı
// tiplerinde olmadıkları için `adminRpc` ile çağrılır; yanıt biçimi burada denetlenir
// (beklenmeyen biçim ham veri olarak gösterilmez, yükleme hatası sayılır).
export const ideaStages = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  planned: "Planlandı",
  building: "Yapılıyor",
  shipped: "Yayımlandı",
  declined: "Şimdilik yok",
} as const;
export type IdeaStage = keyof typeof ideaStages;

export type QueueRow = {
  id: string;
  kind: "support" | "idea";
  category: string;
  subject: string;
  status: string;
  revision: number;
  created_at: string;
  updated_at: string;
  assignee_id: string | null;
  assignee_label: string | null;
  assignee_is_me: boolean;
  waiting_since: string | null;
  idea_stage: IdeaStage | null;
  similar_to: string | null;
  similar_count: number;
  match: "subject" | "id" | "message" | null;
};
export type Operator = { id: string; label: string; is_me: boolean };
export type TicketMeta = {
  id: string;
  kind: "support" | "idea";
  assignee_id: string | null;
  assignee_label: string | null;
  assignee_is_me: boolean;
  assigned_at: string | null;
  waiting_since: string | null;
  idea_stage: IdeaStage | null;
  similar_to: string | null;
  similar: {
    id: string;
    subject: string;
    idea_stage: IdeaStage | null;
    linked: boolean;
    score: number;
  }[];
};

type Shape = Record<
  string,
  "string" | "string?" | "number" | "boolean" | "array"
>;
function check<T>(value: unknown, shape: Shape): T {
  if (!value || typeof value !== "object") throw Error("unexpected_shape");
  const o = value as Record<string, unknown>;
  for (const [key, type] of Object.entries(shape)) {
    const v = o[key];
    const ok = type === "string?"
      ? v === null || typeof v === "string"
      : type === "array"
      ? Array.isArray(v)
      : typeof v === type;
    if (!ok) throw Error("unexpected_shape:" + key);
  }
  if (
    "idea_stage" in o && o.idea_stage !== null &&
    !(String(o.idea_stage) in ideaStages)
  ) throw Error("unexpected_shape:idea_stage");
  return o as T;
}
function list<T>(value: unknown, shape: Shape): T[] {
  if (!Array.isArray(value)) throw Error("unexpected_shape");
  return value.map((v) => check<T>(v, shape));
}
const rowShape: Shape = {
  id: "string",
  kind: "string",
  category: "string",
  subject: "string",
  status: "string",
  revision: "number",
  updated_at: "string",
  assignee_id: "string?",
  assignee_label: "string?",
  assignee_is_me: "boolean",
  waiting_since: "string?",
  idea_stage: "string?",
  similar_to: "string?",
  similar_count: "number",
  match: "string?",
};
const metaShape: Shape = {
  id: "string",
  kind: "string",
  assignee_id: "string?",
  assignee_label: "string?",
  assignee_is_me: "boolean",
  assigned_at: "string?",
  waiting_since: "string?",
  idea_stage: "string?",
  similar_to: "string?",
  similar: "array",
};

export type QueueFilter = {
  kind: "support" | "idea";
  status: string;
  category: string;
  assignee: "any" | "me" | "none";
  query: string;
  waiting: boolean;
  cursor?: { time: string; id: string };
};

export async function loadQueue(f: QueueFilter) {
  const query = f.query.trim();
  const data = await adminRpc("admin_support_queue", {
    p_kind: f.kind,
    p_status: f.status || "all",
    p_category: f.category || null,
    p_assignee: f.assignee,
    p_query: query.length >= 2 ? query : null,
    p_waiting: f.waiting,
    p_before_time: f.cursor?.time ?? null,
    p_before_id: f.cursor?.id ?? null,
  });
  return list<QueueRow>(data, rowShape);
}
export const loadOperators = async () =>
  list<Operator>(await adminRpc("admin_support_operators", {}), {
    id: "string",
    label: "string",
    is_me: "boolean",
  });
export async function loadMeta(id: string) {
  const meta = check<TicketMeta>(
    await adminRpc("admin_help_ticket_meta", { p_ticket_id: id }),
    metaShape,
  );
  list(meta.similar, {
    id: "string",
    subject: "string",
    linked: "boolean",
    score: "number",
  });
  return meta;
}

export const assignTicket = (
  ticket: string,
  expected: string | null,
  assignee: string | null,
) =>
  adminRpc("assign_help_ticket", {
    p_request_id: crypto.randomUUID(),
    p_ticket_id: ticket,
    p_expected_assignee: expected,
    p_assignee: assignee,
  });
export const setIdeaStage = (
  ticket: string,
  expected: { stage: IdeaStage | null; similar: string | null },
  next: { stage: IdeaStage; similar: string | null },
) =>
  adminRpc("set_idea_stage", {
    p_request_id: crypto.randomUUID(),
    p_ticket_id: ticket,
    p_expected_stage: expected.stage,
    p_expected_similar: expected.similar,
    p_stage: next.stage,
    p_similar_to: next.similar,
  });

export function opsError(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  const m = e?.message ?? "";
  if (e?.code === "42501") return "Bu işlem için güncel destek yetkiniz yok.";
  if (m.includes("assignment_changed")) {
    return "Bu görüşmenin sorumlusu siz bakarken değişti. Güncel durumu yeniledik; yeniden seçin.";
  }
  if (m.includes("assignee_not_operator")) {
    return "Seçilen kişinin etkin destek yetkisi yok.";
  }
  if (m.includes("idea_changed")) {
    return "Fikir durumu siz bakarken değişti. Güncel durumu yeniledik.";
  }
  if (m.includes("similar_cycle")) {
    return "Bu fikir zaten seçtiğiniz fikre bağlı; döngü oluşturulamaz.";
  }
  if (m.includes("idea_only") || m.includes("similar_must_be_idea")) {
    return "Destek talebi fikir listesine taşınamaz.";
  }
  return "İşlem tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.";
}

/** "3 sa", "2 gün" — veli bekleme süresi; gelecekteki saat farkı 0 sayılır. */
export function waitingLabel(since: string | null, now = Date.now()) {
  if (!since) return null;
  const mins = Math.max(0, Math.round((now - new Date(since).getTime()) / 60000));
  if (mins < 60) return `${mins} dk`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} sa`;
  return `${Math.round(hours / 24)} gün`;
}
export const waitingOverdue = (since: string | null, now = Date.now()) =>
  !!since && now - new Date(since).getTime() > 24 * 3600 * 1000;

// Hazır yanıtlar (C07): sunucuda TR/EN, sürümlü ve destek ekibince yönetilir (`support_canned_replies`).
// Yalnız "Aileye yanıt" taslağına eklenir; gönderilmeden önce operatör metni düzenler. Çocuk adı/puan içermez.
export type CannedLocale = "tr" | "en";
export type CannedReply = {
  id: string;
  locale: CannedLocale;
  title: string;
  body: string;
  categories: string[];
  position: number;
  archived: boolean;
  revision: number;
  updated_at: string;
};
export async function loadCannedReplies(
  locale: CannedLocale | null,
  ticket: string | null,
  includeArchived = false,
): Promise<{ locale: CannedLocale; replies: CannedReply[] }> {
  const data = await adminRpc("support_canned_replies", {
    p_locale: locale,
    p_ticket: ticket,
    p_include_archived: includeArchived,
  }) as { locale?: unknown; replies?: unknown };
  if ((data?.locale !== "tr" && data?.locale !== "en") || !Array.isArray(data.replies)) throw Error("unexpected_shape");
  return { locale: data.locale, replies: data.replies as CannedReply[] };
}
export async function saveCannedReply(input: {
  request: string;
  id: string | null;
  expectedRevision: number | null;
  locale: CannedLocale;
  title: string;
  body: string;
  categories: string[];
  position: number;
  archived: boolean;
}) {
  return await adminRpc("save_support_canned_reply", {
    p_request_id: input.request,
    p_id: input.id,
    p_expected_revision: input.expectedRevision,
    p_locale: input.locale,
    p_title: input.title,
    p_body: input.body,
    p_categories: input.categories,
    p_position: input.position,
    p_archived: input.archived,
  }) as { id: string; revision: number; archived: boolean; replayed: boolean };
}
export function cannedError(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? "");
  if (m.includes("canned_reply_changed")) return "Bu yanıt başka bir ekip üyesince değiştirildi. Listeyi yenileyip yeniden düzenleyin.";
  if (m.includes("canned_reply_duplicate_title")) return "Bu dilde aynı başlıkla etkin bir hazır yanıt var.";
  if (m.includes("request_conflict")) return "Aynı işlem farklı içerikle yeniden gönderildi. Formu yenileyin.";
  if (m.includes("invalid_input")) return "Başlık 2–80, metin 5–2000 karakter olmalı.";
  if (m.includes("forbidden") || m.includes("42501")) return "Destek yetkiniz etkin değil.";
  return "Hazır yanıt kaydedilemedi. Bağlantınızı kontrol edip yeniden deneyin.";
}

const words = (text: string) =>
  text.toLocaleLowerCase("tr").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4);
const categoryWords: Record<string, string[]> = {
  account: ["hesap", "giriş", "şifre"],
  device: ["tablet", "cihaz", "eşleştirme", "pin"],
  learning: ["prova", "soru", "ders", "görev"],
  billing: ["paket", "ödeme", "satın", "abonelik"],
  other: [],
};
/** Talep konusu ve kategorisiyle örtüşen yayımlanmış yardım yazıları (en çok 3). */
export function relatedArticles<T extends { title: string; body: string }>(
  articles: T[],
  subject: string,
  category: string,
) {
  const keys = new Set([...words(subject), ...(categoryWords[category] ?? [])]);
  // Türkçe ekleri kabaca yakalamak için 5 harflik kök karşılaştırması.
  const stems = [...keys].map((k) => k.slice(0, 5));
  return articles
    .map((a) => {
      const hay = words(a.title + " " + a.body);
      const score = stems.filter((s) => hay.some((w) => w.startsWith(s))).length;
      return { article: a, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.article);
}
