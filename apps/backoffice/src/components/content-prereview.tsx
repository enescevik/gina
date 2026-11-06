import { useState } from "react";
import { PREREVIEW_CONFIDENCE_THRESHOLD, prereviewStatusLabel, type PrereviewStatus } from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useAdminQuery } from "@/lib/use-async";
import { adminRpc, edgeFailure, fmtWhen } from "./review-rpc";

// E01 AI ön incelemesi: AI kaydı yönetici kararından AYRI bir kayıttır. `ai_approved` yayın değildir,
// ret önerisi reddetmez; son kararı yönetici verir. Bağımsız eğitimci incelemesi (X06) ayrı kademedir.

export type PrereviewKind = "library_package" | "contribution_set" | "curriculum_candidate";
export type PrereviewFinding = { code: string; severity: "blocking" | "advisory" | string; detail?: string; item?: string | null };
export type PrereviewRecord = {
  target_kind: PrereviewKind;
  target_id: string;
  prereview_status: PrereviewStatus;
  prereview_verdict: {
    model?: string | null;
    provider?: string | null;
    /** C09: images are never sent to the model; the database counts them and flags unproven image-dependent correctness. */
    media?: { count?: number; reviewed?: boolean; image_dependent_correctness?: "not_applicable" | "not_proven" | "reviewed" | string } | null;
    confidence?: number;
    decision_reason?: string;
    findings?: PrereviewFinding[];
    summary?: string | null;
  } | null;
  prereview_at: string | null;
  attempts: number;
  last_error: string | null;
  awaiting_admin: boolean;
  queued_at: string;
};

export const prereviewKey = (kind: string, id: string) => `${kind}:${id}`;

/** Bütün AI ön inceleme kayıtları (yönetici). Kayıt yoksa o içerik hiç istenmemiştir. */
export function usePrereviews() {
  return useAdminQuery(async () => {
    const rows = await adminRpc<PrereviewRecord[]>("admin_content_prereviews", { p_status: null, p_limit: 500 });
    return new Map((rows ?? []).map((r) => [prereviewKey(r.target_kind, r.target_id), r]));
  });
}

const reasonLabels: Record<string, string> = {
  all_checks_passed: "Beş rubrik sorusu net geçti, engelleyici bulgu yok",
  low_confidence: `Güven eşiğin altında (eşik %${Math.round(PREREVIEW_CONFIDENCE_THRESHOLD * 100)})`,
  blocking_finding: "Engelleyici bulgu var",
  model_requested_review: "Model yönetici incelemesi istedi",
  retry_limit: "3 deneme başarısız; AI karar veremedi",
  ai_disabled: "Genel AI anahtarı kapalıydı; AI çağrılmadı",
  ai_model_unavailable: "Model pasif; AI çağrılmadı",
  ai_not_configured: "Sağlayıcı anahtarı yok; AI çağrılmadı",
  // C09
  media_not_reviewed: "Görsel AI'ya gösterilmedi; görsele bağlı doğruluk kanıtlanmadı",
  source_superseded: "Senaryo kaynağının yeni sürümü var; eski sürümün adayı AI'ya gönderilmedi",
  source_withdrawn: "Senaryo kaynağı geri çekildi; AI çağrılmadı",
  source_target_retired: "Kaynak hedefi (yıl/dönem) emekli; AI çağrılmadı",
  ai_temporarily_unavailable: "Sağlayıcı geçici olarak duraklatıldı; AI çağrılmadı",
  provider_health_unavailable: "Sağlayıcı durumu okunamadı; AI çağrılmadı",
  provider_unconfigured: "Seçili sağlayıcı yapılandırılmadı; AI çağrılmadı",
  ai_model_unsupported: "Model bu iş için desteklenmiyor; AI çağrılmadı",
  ai_configuration_unavailable: "AI ayarları okunamadı; AI çağrılmadı",
  plan_has_no_ai: "Ön inceleme paketinde AI modeli yok; AI çağrılmadı",
  provider_auth: "Sağlayıcı anahtarı reddedildi; tekrar denenmedi",
  provider_rejected: "Sağlayıcı isteği reddetti; tekrar denenmedi",
  provider_input_too_large: "İçerik model sınırını aşıyor; tekrar denenmedi",
  provider_token_count_invalid: "İçerik ölçülemedi; tekrar denenmedi",
  provider_refusal: "Model yanıt vermeyi reddetti; tekrar denenmedi",
  provider_unsupported: "Model desteklenmiyor; tekrar denenmedi",
  rubric_solution_correct: "Rubrik net değil: çözüm doğruluğu",
  rubric_measures_target_skill: "Rubrik net değil: kazanımı ölçme",
  rubric_age_language_appropriate: "Rubrik net değil: yaş/dil uygunluğu",
  rubric_copyright_or_copy_suspicion: "Rubrik net değil: telif/kopya şüphesi",
  rubric_leaked_exam_suspicion: "Rubrik net değil: sızmış sınav şüphesi",
};
const findingLabels: Record<string, string> = {
  solution_incorrect: "Çözüm hatalı",
  answer_key_mismatch: "Cevap anahtarı uyuşmuyor",
  rubric_incomplete: "Rubrik eksik",
  skill_mismatch: "Kazanımla uyuşmuyor",
  age_or_language: "Yaş veya dil uygun değil",
  copyright_or_copy: "Telif / kopya şüphesi",
  leaked_exam: "Sızmış sınav şüphesi",
  scenario_count_mismatch: "Senaryo sayıları tutmuyor",
  outcome_mismatch: "Kazanım metni uyuşmuyor",
  personal_data: "Kişisel veri",
  unsafe_content: "Uygunsuz içerik",
  other: "Diğer",
};
export const reasonLabel = (r: string | undefined | null) => (r ? reasonLabels[r] ?? r : "—");

const tone: Record<PrereviewStatus, string> = {
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  ai_approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
  needs_admin: "border-amber-300 bg-amber-50 text-amber-900",
  ai_rejected_suggestion: "border-red-200 bg-red-50 text-red-900",
};

/** AI ön inceleme rozeti. Yönetici kararı bu rozette ASLA gösterilmez; ayrı sütun/kutudadır. */
export function PrereviewBadge({ record, compact = false }: { record: PrereviewRecord | null | undefined; compact?: boolean }) {
  if (!record) {
    return (
      <div className="text-sm text-slate-500" data-testid="prereview-badge" data-status="none">
        AI ön incelemesi istenmedi
      </div>
    );
  }
  const v = record.prereview_verdict;
  const findings = v?.findings ?? [];
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-sm ${tone[record.prereview_status]}`}
      data-testid="prereview-badge"
      data-status={record.prereview_status}
      aria-label="AI ön inceleme sonucu (yönetici kararı değildir)"
    >
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">AI ön inceleme · karar değildir</p>
      <p className="font-bold">{prereviewStatusLabel(record.prereview_status, "tr")}</p>
      {typeof v?.confidence === "number"
        ? <p>Güven: %{Math.round(v.confidence * 100)} · {reasonLabel(v.decision_reason)}</p>
        : record.prereview_status === "pending"
        ? <p>Kuyrukta · {record.attempts} deneme{record.last_error ? ` · son hata: ${record.last_error}` : ""}</p>
        : null}
      <MediaFlag media={v?.media} />
      {!compact && findings.length
        ? (
          <ul className="mt-1 list-disc pl-5">
            {findings.map((f, i) => (
              <li key={i}>
                <strong>{f.severity === "blocking" ? "Engelleyici" : "Danışma"}:</strong> {findingLabels[f.code] ?? f.code}
                {f.item ? ` (${f.item})` : ""}
                {f.detail ? ` — ${f.detail}` : ""}
              </li>
            ))}
          </ul>
        )
        : compact && findings.length
        ? <p>{findings.length} bulgu ({findings.filter((f) => f.severity === "blocking").length} engelleyici)</p>
        : null}
      {!compact && v?.summary ? <p className="mt-1 italic">{v.summary}</p> : null}
      {!compact && record.prereview_at
        ? <p className="mt-1 text-xs opacity-80">{fmtWhen(record.prereview_at)}{v?.model ? ` · ${v.model}` : ""}{v?.provider ? ` · ${v.provider}` : ""}</p>
        : null}
    </div>
  );
}

/** C09: açık kayıt bayrağı — model görseli görmediyse görsele bağlı doğruluk kanıtlanmış sayılmaz. */
function MediaFlag({ media }: { media: NonNullable<PrereviewRecord["prereview_verdict"]>["media"] | undefined }) {
  if (!media || !media.count || media.image_dependent_correctness === "reviewed") return null;
  return (
    <p data-testid="prereview-media-flag" className="mt-1 rounded-lg border border-amber-300 bg-white/70 px-2 py-1 text-xs font-semibold text-amber-900">
      {media.count} görsel AI&apos;ya gösterilmedi — görsele bağlı doğruluk kanıtlanmadı; karar yöneticide.
    </p>
  );
}

// ---- C09: karar bekleyen kayıtlar + operatör bildirimleri (aile üyeliği gerekmez) -------------------------

type OperatorNotice = {
  id: string;
  target_kind: PrereviewKind;
  target_id: string;
  prereview_status: "needs_admin" | "ai_rejected_suggestion";
  reason: string | null;
  created_at: string;
  read_at: string | null;
  current_status: PrereviewStatus | null;
  awaiting_admin: boolean;
  current_content: boolean;
};
const kindNames: Record<PrereviewKind, string> = {
  library_package: "Taslak paket",
  contribution_set: "Aile katkısı",
  curriculum_candidate: "Senaryo adayı",
};

/**
 * Yönetici/içerik operatörü kuyruğu: AI'nın karar veremediği (BEKLİYOR) veya ret önerdiği kayıtlar ve kalıcı
 * uygulama içi bildirimler. Push yalnız aile üyesi yöneticiye gider; bu kutu aile üyeliği aramaz (C07 rolü yeter).
 */
export function PrereviewDecisionQueue({ onShowQueue }: { onShowQueue: () => void }) {
  const notices = useAdminQuery(() => adminRpc<{ unread: number; items: OperatorNotice[] }>("operator_prereview_notices", { p_unread_only: false, p_limit: 20 }));
  const queue = useAdminQuery(async () => {
    const [needs, reject] = await Promise.all([
      adminRpc<PrereviewRecord[]>("admin_content_prereviews", { p_status: "needs_admin", p_limit: 500 }),
      adminRpc<PrereviewRecord[]>("admin_content_prereviews", { p_status: "ai_rejected_suggestion", p_limit: 500 }),
    ]);
    return [...(needs ?? []), ...(reject ?? [])].filter((r) => r.awaiting_admin);
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function mark(ids: string[] | null) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await adminRpc("mark_operator_prereview_notices_read", { p_ids: ids });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      notices.reload();
    }
  }
  const waiting = queue.data ?? [];
  const byReason = new Map<string, number>();
  for (const r of waiting) {
    const reason = r.prereview_verdict?.decision_reason ?? "—";
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  }
  const unread = notices.data?.unread ?? 0;
  return (
    <section aria-labelledby="prereview-queue-title" data-testid="prereview-decision-queue" className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="prereview-queue-title" className="text-lg font-bold">
          Karar bekleyen AI ön incelemeleri
          {unread ? <span data-testid="prereview-unread" className="ml-2 rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white">{unread} yeni bildirim</span> : null}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={onShowQueue}>Listede yalnız BEKLİYOR kayıtları göster</button>
          {unread ? <button type="button" className="btn-secondary" disabled={busy} onClick={() => void mark(null)}>Tümünü okundu işaretle</button> : null}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-700">
        AI karar veremediğinde veya ret önerdiğinde kayıt burada bekler; son kararı siz verirsiniz. AI&apos;nın &quot;uygun&quot; bulması yayın,
        hak veya bağımsız eğitimci onayı değildir.
      </p>
      {queue.error ? <p role="alert" className="mt-2 text-sm text-red-800">Karar bekleyen kayıtlar okunamadı.</p> : null}
      {queue.data
        ? (
          <p className="mt-2 text-sm" data-testid="prereview-waiting-count">
            <strong>{waiting.length}</strong> kayıt yönetici kararı bekliyor
            {byReason.size ? ": " + [...byReason].map(([r, n]) => `${reasonLabel(r)} (${n})`).join(" · ") : ""}
          </p>
        )
        : null}
      {notices.error ? <p role="alert" className="mt-2 text-sm text-red-800">Bildirimler okunamadı.</p> : null}
      {failed ? <p role="alert" className="mt-2 text-sm text-red-800">Bildirim okundu olarak işaretlenemedi; yeniden deneyin.</p> : null}
      {notices.data?.items.length
        ? (
          <ul className="mt-2 grid gap-1" aria-label="AI ön inceleme bildirimleri">
            {notices.data.items.map((n) => (
              <li key={n.id} data-testid="prereview-notice" data-read={n.read_at ? "true" : "false"} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm ${n.read_at ? "border-slate-200 bg-white" : "border-amber-300 bg-white font-semibold"}`}>
                <span>
                  {kindNames[n.target_kind]} · {prereviewStatusLabel(n.prereview_status, "tr")} · {reasonLabel(n.reason)} · {fmtWhen(n.created_at)}
                  <span className="ml-1 font-normal text-slate-600">
                    {n.awaiting_admin ? "— hâlâ kararınızı bekliyor" : "— karar verildi"}
                    {!n.current_content ? " (içerik değişti)" : ""}
                  </span>
                </span>
                {!n.read_at ? <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={busy} onClick={() => void mark([n.id])}>Okundu</button> : null}
              </li>
            ))}
          </ul>
        )
        : notices.data
        ? <p className="mt-2 text-sm text-slate-600">Bildirim yok.</p>
        : null}
    </section>
  );
}

// ---- C09/C05: senaryo adayı kaynak rozeti --------------------------------------------------------------

export type CandidateSource = {
  source_status: "approved" | "pending_review" | "diff_review_required" | "superseded" | "withdrawn" | "manifest_only" | string;
  target_status: "active" | "retired" | "missing" | null;
  school_year: string | null;
  term: number | string | null;
  last_checked_at?: string | null;
  stale: boolean | null;
  obsolete_reason: string | null;
};

/** Aday listesi için kaynak sürümü/hedef/güncellik (içerik + yayın rolü). */
export function useCandidateSources(ids: string[]) {
  return useAdminQuery<Record<string, CandidateSource>>(
    () => (ids.length ? adminRpc<Record<string, CandidateSource>>("admin_prereview_candidate_context", { p_ids: ids }) : Promise.resolve({})),
    [ids.join(",")],
  );
}

const sourceStatusLabels: Record<string, string> = {
  approved: "onaylı kaynak sürümü",
  pending_review: "kaynak sürümü incelemede",
  diff_review_required: "yeni sürüm — fark incelemesi gerekli",
  superseded: "eski kaynak sürümü (yerine yenisi geldi)",
  withdrawn: "kaynak geri çekildi",
  manifest_only: "indirilmiş resmî sürüm yok (manifest)",
};

export function CandidateSourceBadge({ source }: { source: CandidateSource | undefined }) {
  if (!source) return null;
  const obsolete = !!source.obsolete_reason;
  return (
    <p
      data-testid="candidate-source-badge"
      data-source={source.source_status}
      data-obsolete={obsolete ? "true" : "false"}
      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${obsolete ? "bg-red-100 text-red-800" : source.stale ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}
    >
      Kaynak: {sourceStatusLabels[source.source_status] ?? source.source_status}
      {source.school_year ? ` · ${source.school_year}${source.term ? `/${source.term}. dönem` : ""}` : ""}
      {source.target_status === "retired" ? " · hedef emekli" : ""}
      {source.stale ? " · son kontrol 7 günden eski" : ""}
      {obsolete ? " · AI'ya gönderilmez" : ""}
    </p>
  );
}

export type PrereviewGate = { enabled: boolean; aiEnabled: boolean; reason: string | null };

/** İşleme kapısı: `content_prereview.enabled` (varsayılan kapalı) ve genel AI anahtarı (`ai.enabled`). */
export function usePrereviewGate() {
  return useAdminQuery<PrereviewGate>(async () => {
    const { data, error } = await supabase().from("app_settings").select("key,value").in("key", ["content_prereview.enabled", "ai.enabled"]);
    if (error) throw error;
    const value = (k: string) => (data ?? []).find((r) => r.key === k)?.value;
    const enabled = value("content_prereview.enabled") === true;
    const aiEnabled = value("ai.enabled") !== false;
    const reason = !enabled
      ? "AI ön inceleme kapısı kapalı: content_prereview.enabled ayarı açık değil. Kayıtlar AI'ya gönderilmez; yönetici kuyruğunda kalır ve kararı siz verirsiniz."
      : !aiEnabled
      ? "Genel AI anahtarı kapalı (kill switch). AI çağrısı yapılmaz; istenen kayıt AI kararı olmadan yönetici kuyruğuna düşer."
      : null;
    return { enabled, aiEnabled, reason };
  });
}

/** Tek kayıt için AI ön incelemesi iste: önce sunucu kuyruğuna alınır, sonra Edge hemen işlemeyi dener. */
export function RequestPrereviewButton(
  { kind, id, gate, onDone, label = "AI ön incelemesi iste" }: {
    kind: PrereviewKind;
    id: string;
    gate: PrereviewGate | null;
    onDone: () => void;
    label?: string;
  },
) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "warn"; text: string } | null>(null);
  const blocked = !gate || !!gate.reason;
  async function request() {
    if (busy || blocked) return;
    setBusy(true);
    setMessage(null);
    try {
      await adminRpc("request_content_prereview", { p_kind: kind, p_id: id });
    } catch {
      setMessage({ tone: "error", text: "Kayıt AI ön inceleme kuyruğuna alınamadı. Yetkinizi ve kaydın güncel durumunu kontrol edin." });
      setBusy(false);
      return;
    }
    try {
      const { data, error } = await supabase().functions.invoke("content-prereview", { body: { kind, id }, signal: AbortSignal.timeout(60000) });
      if (error) throw error;
      const r = data as { outcome?: string; prereview_status?: string; reason?: string };
      setMessage({
        tone: r.prereview_status === "ai_approved" ? "ok" : "warn",
        text: r.outcome === "cached"
          ? "İçerik değişmediği için önceki AI sonucu geçerli; yeni AI çağrısı yapılmadı."
          : r.outcome === "in_progress"
          ? "Bu kayıt şu anda inceleniyor. Birazdan yenileyin."
          : `AI ön incelemesi tamamlandı: ${prereviewStatusLabel((r.prereview_status ?? "pending") as PrereviewStatus, "tr")}${r.reason ? ` (${reasonLabel(r.reason)})` : ""}. Yönetici kararı ve yayın değişmedi.`,
      });
    } catch (e) {
      const f = await edgeFailure(e);
      setMessage({
        tone: "warn",
        text: f.kind === "unreachable"
          ? "Kayıt kuyruğa alındı, ancak AI ön inceleme hizmetine (content-prereview) ulaşılamadı. Zamanlayıcı çalıştığında işlenir. Yönetici kararı ve yayın değişmedi."
          : `Kayıt kuyruğa alındı; AI ön inceleme hizmeti işlemi tamamlayamadı (${f.code ?? "http_" + f.status}). Yönetici kararı ve yayın değişmedi.`,
      });
    } finally {
      setBusy(false);
      onDone();
    }
  }
  return (
    <div className="grid gap-1">
      <button type="button" className="btn-secondary" disabled={busy || blocked} onClick={() => void request()} title={gate?.reason ?? undefined}>
        {busy ? "İsteniyor…" : label}
      </button>
      {message
        ? <p role="status" className={`text-xs ${message.tone === "error" ? "text-red-800" : message.tone === "ok" ? "text-emerald-800" : "text-amber-900"}`}>{message.text}</p>
        : null}
    </div>
  );
}

/** Kapı kapalı / AI kapalı nedenini açıkça gösterir. */
export function PrereviewGateNotice({ gate, error }: { gate: PrereviewGate | null; error?: unknown }) {
  if (error) {
    return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">AI ön inceleme kapısının durumu okunamadı; istek düğmeleri kapalı.</p>;
  }
  if (!gate) return null;
  return gate.reason
    ? (
      <p role="note" data-testid="prereview-gate-closed" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <strong>AI ön incelemesi istenemiyor.</strong> {gate.reason}
      </p>
    )
    : (
      <p role="note" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        AI ön inceleme açık. AI uygun bulsa bile içerik yayımlanmaz ve hak vermez; karar veremediği kayıt yönetici kuyruğuna düşer.
      </p>
    );
}
