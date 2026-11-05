import type { PushMessage } from "./providers.ts";
type Locale = "tr" | "en";
interface MessageRow {
  id?: number;
  kind: string;
  payload: Record<string, unknown>;
}
// Genel, kişisel veri içermeyen metinler (tür → dil).
const TEXTS: Record<string, Record<Locale, string>> = {
  task_awaiting_approval: {
    tr: "Onay bekleyen bir görev var",
    en: "A task is waiting for your approval",
  },
  task_approved: {
    tr: "Bir görevin onaylandı",
    en: "One of your tasks was approved",
  },
  task_returned: {
    tr: "Bir görevin geri gönderildi, tekrar bakabilirsin",
    en: "A task was sent back, take another look",
  },
  exam_assigned: {
    tr: "Yeni bir deneme seni bekliyor",
    en: "A new practice test is waiting for you",
  },
  exam_finished: {
    tr: "Bir deneme tamamlandı",
    en: "A practice test was finished",
  },
  cohort_results: {
    tr: "Birlikte Prova sonuçları güncellendi",
    en: "Group practice results have been updated",
  },
  parent_announcement: { tr: "Yeni bir GINA duyurusu var", en: "You have a new GINA announcement" },
  education_reminder: { tr: "Eğitim takvimini kontrol edebilirsin", en: "You can review the school calendar" },
  content_prereview_needs_admin: { tr: "İçerik ön incelemesi yönetici kararı bekliyor", en: "A content pre-review is waiting for an admin decision" },
  weekly_summary: {
    tr: "Haftalık özet hazır",
    en: "Your weekly summary is ready",
  },
};

export function messageFor(row: MessageRow, locale: Locale): PushMessage {
  const data: Record<string, string> = { kind: row.kind };
  // Yalnız bilinen kimlik alanları geçer (savunma: payload'a başka alan yazılsa bile sızmaz).
  for (const key of ["completion_id", "exam_id", "attempt_id", "group_id", "inbox_id", "target_id"]) {
    const value = row.payload?.[key];
    if (
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) data[key] = value;
  }
  return {
    eventId: Number.isSafeInteger(row.id) && row.id! > 0
      ? `gina-${row.id}`
      : undefined,
    title: "Gina",
    body: TEXTS[row.kind]?.[locale] ?? TEXTS[row.kind]?.tr ?? "Gina",
    kind: row.kind,
    data,
  };
}
