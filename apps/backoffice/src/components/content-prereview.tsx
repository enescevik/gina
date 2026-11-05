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
      {!compact && record.prereview_at ? <p className="mt-1 text-xs opacity-80">{fmtWhen(record.prereview_at)}{v?.model ? ` · ${v.model}` : ""}</p> : null}
    </div>
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
          : `AI ön incelemesi tamamlandı: ${prereviewStatusLabel((r.prereview_status ?? "pending") as PrereviewStatus, "tr")}. Yönetici kararı ve yayın değişmedi.`,
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
