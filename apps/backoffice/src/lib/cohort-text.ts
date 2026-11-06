// Birlikte Prova yönetim metinleri ve yardımcıları (B03). Sunucu kodları
// (`group_exam_phases`, `gina.cohort_ranking_rows`) Türkçe açıklamaya çevrilir;
// ham kod veya kimlik operatöre gösterilmez.

export type CohortPlan = "free" | "plus" | "pro";
export const planLabel: Record<CohortPlan, string> = {
  free: "Ücretsiz",
  plus: "Plus",
  pro: "Pro",
};
export const planList = (plans: readonly string[]) =>
  plans.map((p) => planLabel[p as CohortPlan] ?? "Bilinmeyen paket").join(
    ", ",
  );

/** `public.group_exam_phases(p_group)` yönetici yanıtı. */
export interface GroupPhases {
  group_id: string;
  status: string;
  participation: {
    starts_at: string;
    ends_at: string;
    open: boolean;
    phase: "cancelled" | "upcoming" | "open" | "closed";
    entries: number | null;
  };
  child_time: { duration_minutes: number; one_attempt: boolean };
  review: {
    required: boolean;
    phase:
      | "automatic"
      | "waiting_for_window"
      | "in_review"
      | "appeals_open"
      | "ready_to_publish"
      | "published";
    pending: number | null;
    unfinished: number | null;
    appeals: number | null;
    published: boolean;
    publication_version: number | null;
  };
  ranking: {
    optional: boolean;
    consent_required: boolean;
    secondary: boolean;
    eligible_entries: number;
    excluded: Record<string, number>;
  };
}

export const participationPhase: Record<
  GroupPhases["participation"]["phase"],
  string
> = {
  cancelled: "İptal edildi · yeni katılım ve cevap yok",
  upcoming: "Henüz başlamadı",
  open: "Katılım açık",
  closed: "Katılım kapandı",
};

export const reviewPhase: Record<GroupPhases["review"]["phase"], string> = {
  automatic: "Otomatik puanlama · ölçütlü inceleme yok",
  waiting_for_window: "Katılım penceresinin kapanması bekleniyor",
  in_review: "İnceleme sürüyor",
  appeals_open: "Açık itiraz var",
  ready_to_publish: "Sonuç yayımlanmaya hazır",
  published: "Sonuçlar ailelere açık",
};

/** `cohort_ranking_rows.reason` → kaydın neden kesin sıralamada olmadığı. */
export const rankingReason: Record<string, string> = {
  no_consent: "Veli takma adla sıralamaya izin vermedi",
  unfinished: "Çocuğun çalışması bitmedi",
  unreadable: "Okunamayan cevap var · puan verilmedi",
  unscored: "Puanlanmamış cevap var",
  results_not_published: "Sonuçlar henüz yayımlanmadı",
};
export const rankingReasonText = (code: string) =>
  rankingReason[code] ?? "Sıralama için uygun değil";

/** Soru durumu: okunamayan cevap boş veya sıfır sayılmaz. */
export function questionState(q: {
  kind: string;
  reviewed: boolean;
  outcome: string;
  appealOpen: boolean;
}): { label: string; tone: "ok" | "warn" | "todo" } {
  if (q.appealOpen) return { label: "İtiraz açık", tone: "warn" };
  if (q.outcome === "unreadable") {
    return { label: "Okunamadı — puan verilmedi", tone: "warn" };
  }
  if (q.kind === "multiple_choice") return { label: "Otomatik", tone: "ok" };
  if (q.reviewed) {
    return {
      label: q.outcome === "not_answered" ? "Cevap yok · 0 puan" : "İncelendi",
      tone: "ok",
    };
  }
  return { label: "İnceleme bekliyor", tone: "todo" };
}

export interface QueueEntry {
  entry_id: string;
  alias: string;
  attempt_status: string;
  total: number;
  pending: number;
  appeals: number;
}

/**
 * Seçili kayıttan sonra (takma ad sırasıyla, sona gelince başa dönerek) ölçüte
 * uyan ilk kaydı bulur; başka kayıt yoksa ölçüte uyan seçili kaydı, o da yoksa null.
 */
export function nextEntry(
  entries: QueueEntry[],
  current: string,
  match: (e: QueueEntry) => boolean,
): QueueEntry | null {
  if (!entries.length) return null;
  const start = entries.findIndex((e) => e.entry_id === current);
  for (let i = 1; i <= entries.length; i++) {
    const e = entries[(start + i + entries.length) % entries.length]!;
    if (e.entry_id !== current && match(e)) return e;
  }
  const self = entries.find((e) => e.entry_id === current);
  return self && match(self) ? self : null;
}

export const normalizeSearch = (v: string) =>
  v.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
