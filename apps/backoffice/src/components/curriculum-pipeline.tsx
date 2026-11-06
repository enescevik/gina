import { useState } from "react";
import { type PrereviewStatus, prereviewStatusLabel } from "@gina/core";
import { useAdminQuery } from "@/lib/use-async";
import { Notice } from "./Layout";
import { adminRpc, fmtWhen, shortHash } from "./review-rpc";

// C05: resmî dizin hedefleri (yıl/dönem) ve çıkarma kuyruğu. Hedef eklemek URL tahmini değildir: yönetici yalnız
// yayımlanmış resmî meb.gov.tr dizin sayfasını kaydeder. Kayıt yoksa aileler başka dönemi değil "serbest çalışma"yı görür.

export type SourceTarget = {
  id: string;
  exam_family: "oyss";
  school_year: string;
  term: 1 | 2;
  index_url: string;
  status: "active" | "retired";
  note: string;
  system_seed: boolean;
  sources: number;
  last_checked_at: string | null;
};
export type QueueItem = {
  revision_id: string;
  label: string;
  school_year: string;
  term: number;
  sha256: string;
  status: string;
  extraction_status: "queued" | "failed";
  extraction: { error?: string; at?: string } | null;
  retrieved_at: string;
};
export type CandidatePipelineState = {
  id: string;
  source_status: "approved" | "pending_review" | "diff_review_required" | "superseded" | "withdrawn" | "manifest_only";
  prereview_status: PrereviewStatus | null;
  prereview_reason: string | null;
};
type Pipeline = { queue: QueueItem[]; candidates: CandidatePipelineState[]; operator_step: string };

const targetErrors: Record<string, string> = {
  curriculum_target_host: "Yalnız resmî https://…meb.gov.tr dizin sayfası kaydedilebilir (meb.ai kısaltması veya EBA dosya adresi dizin değildir).",
  curriculum_target_invalid: "Eğitim yılı (ör. 2026-2027), dönem (1/2), durum ve not gerekli.",
  curriculum_target_in_use: "Bu dönemden indirilmiş kaynaklar var; dizin adresi değiştirilemez. Hedefi emekliye ayırıp yöneticiyle değerlendirin.",
  request_conflict: "Aynı istek farklı içerikle gönderildi. Formu kapatıp yeniden açın.",
};
export const sourceStatusLabel: Record<CandidatePipelineState["source_status"], string> = {
  approved: "Kaynak sürümü onaylı",
  pending_review: "Kaynak sürümü inceleme bekliyor",
  diff_review_required: "Kaynak: fark incelemesi gerekli",
  superseded: "Kaynak sürümü eskidi",
  withdrawn: "Kaynak geri çekildi",
  manifest_only: "Depo manifestinden (sunucu sürümü yok)",
};

export function usePipeline() {
  return useAdminQuery(async () => await adminRpc<Pipeline>("admin_curriculum_pipeline"));
}

/** Aday listesi rozeti: kaynak sürümü durumu + E01 AI ön incelemesi (karar değildir). */
export function CandidatePipelineBadges({ state }: { state: CandidatePipelineState | undefined }) {
  if (!state) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1" data-testid="candidate-pipeline-badges">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state.source_status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
        {sourceStatusLabel[state.source_status]}
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs" title="AI ön inceleme yönetici kararı değildir">
        AI ön inceleme: {state.prereview_status ? prereviewStatusLabel(state.prereview_status, "tr") : "istenmedi"}
      </span>
    </span>
  );
}

export function CurriculumPipeline() {
  const targets = useAdminQuery(async () => await adminRpc<SourceTarget[]>("admin_list_curriculum_source_targets"));
  const pipeline = usePipeline();
  const [form, setForm] = useState<{ request: string; school_year: string; term: 1 | 2; index_url: string; status: "active" | "retired"; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const queue = pipeline.data?.queue ?? [];

  async function save() {
    if (!form || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await adminRpc<{ action: "created" | "updated" | "unchanged"; target: SourceTarget }>("admin_save_curriculum_source_target", {
        p_request_id: form.request,
        p_target: { exam_family: "oyss", school_year: form.school_year.trim(), term: form.term, index_url: form.index_url.trim(), status: form.status, note: form.note.trim() },
      });
      setForm(null);
      setMessage({
        tone: "ok",
        text: `${r.target.school_year} · ${r.target.term}. dönem hedefi ${r.action === "created" ? "eklendi" : r.action === "updated" ? "güncellendi" : "zaten aynıydı"}. ` +
          "Hiçbir dosya indirilmedi; kaynak kartından «Resmî dizini kontrol et» ile sunucu indirir.",
      });
      targets.reload();
    } catch (e) {
      const code = (e as { message?: string })?.message ?? "";
      setMessage({ tone: "error", text: targetErrors[code] ?? "Hedef kaydedilemedi. Yetkinizi ve alanları kontrol edin." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="curriculum-pipeline-title" className="my-5 rounded-3xl border border-[#e5dcf3] bg-white p-5" data-testid="curriculum-pipeline">
      <h2 id="curriculum-pipeline-title" className="text-lg font-bold">Resmî dizin hedefleri ve çıkarma kuyruğu</h2>
      <p className="my-2 max-w-3xl text-sm">
        Sunucu yalnız burada kayıtlı resmî ÖDSGM dizin sayfasından indirir. Yeni yıl veya 2. dönem için, dizin sayfası yayımlandıktan sonra
        adresini ekleyin; adres tahmin edilmez. Kayıt yoksa aileler son dönemin tablolarını görmez, «serbest çalışma» seçeneğini görür.
      </p>
      {targets.error ? <Notice tone="error">Dizin hedefleri okunamadı.</Notice> : null}
      <div className="overflow-x-auto">
        <table className="table" aria-label="Resmî dizin hedefleri">
          <thead>
            <tr><th>Yıl · dönem</th><th>Dizin sayfası</th><th>Durum</th><th>Kaynak</th><th>Son kontrol</th><th>Not</th></tr>
          </thead>
          <tbody>
            {(targets.data ?? []).map((t) => (
              <tr key={t.id} data-testid="source-target" data-status={t.status}>
                <td className="font-semibold">{t.school_year} · {t.term}. dönem</td>
                <td><a className="break-all underline" href={t.index_url} target="_blank" rel="noreferrer">{t.index_url}</a></td>
                <td>{t.status === "active" ? "Etkin" : "Emekli (yeni indirme yok)"}{t.system_seed ? " · başlangıç kaydı" : ""}</td>
                <td>{t.sources}</td>
                <td>{fmtWhen(t.last_checked_at)}</td>
                <td className="text-xs">{t.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => setForm({ request: crypto.randomUUID(), school_year: "", term: 2, index_url: "", status: "active", note: "" })}
        >
          Yeni yıl/dönem dizini ekle
        </button>
      </div>
      {form
        ? (
          <form
            className="mt-3 grid gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 sm:grid-cols-2"
            aria-label="Dizin hedefi formu"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="label">
              Eğitim yılı
              <input className="input mt-2" placeholder="2026-2027" value={form.school_year} onChange={(e) => setForm({ ...form, school_year: e.target.value })} />
            </label>
            <label className="label">
              Dönem
              <select className="input mt-2" value={form.term} onChange={(e) => setForm({ ...form, term: Number(e.target.value) as 1 | 2 })}>
                <option value={1}>1. dönem</option>
                <option value={2}>2. dönem</option>
              </select>
            </label>
            <label className="label sm:col-span-2">
              Resmî dizin sayfası (https://…meb.gov.tr/…)
              <input className="input mt-2" inputMode="url" value={form.index_url} onChange={(e) => setForm({ ...form, index_url: e.target.value })} />
            </label>
            <label className="label">
              Durum
              <select className="input mt-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "retired" })}>
                <option value="active">Etkin</option>
                <option value="retired">Emekli</option>
              </select>
            </label>
            <label className="label">
              Not (yayın tarihi, kontrol eden)
              <textarea className="input mt-2" maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button className="btn" disabled={busy || !form.school_year.trim() || !form.index_url.trim() || !form.note.trim()}>
                {busy ? "Kaydediliyor…" : "Hedefi kaydet"}
              </button>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setForm(null)}>Vazgeç</button>
            </div>
          </form>
        )
        : null}
      {message
        ? (
          <p role="status" className={`mt-3 rounded-xl border px-3 py-2 text-sm ${message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            {message.text}
          </p>
        )
        : null}

      <h3 className="mt-6 font-bold">Çıkarma kuyruğu</h3>
      <p className="my-2 max-w-3xl text-sm">
        Yeni indirilen sürüm «çıkarma sırada» başlar. İşletim adımı dosyayı yeniden indirir, SHA-256 özetini doğrular, mevcut çıkarıcıyla
        adayları üretir ve tekrar çalıştırıldığında mükerrer aday oluşturmadan «çıkarıldı» ya da gerekçeli «başarısız» olarak kaydeder.
        Adaylar inceleme bekler; hiçbiri yayımlanmaz.
      </p>
      <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100" data-testid="operator-step">
        {`GINA_SUPABASE_ANON_KEY=… GINA_ADMIN_ACCESS_TOKEN=… \\\n  python3 scripts/fetch-curriculum-sources.py --process-queue --api-url <SUPABASE_URL>`}
      </pre>
      {pipeline.error ? <Notice tone="error">Çıkarma kuyruğu okunamadı.</Notice> : null}
      {pipeline.data && !queue.length ? <p className="mt-2 text-sm" data-testid="queue-empty">Kuyruk boş: bekleyen veya başarısız çıkarma yok.</p> : null}
      {queue.length
        ? (
          <ul className="mt-2 grid gap-2" aria-label="Çıkarma bekleyen sürümler">
            {queue.map((q) => (
              <li key={q.revision_id} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm" data-testid="queue-item" data-extraction={q.extraction_status}>
                <strong>{q.label}</strong> · {q.school_year} · {q.term}. dönem · <code title={q.sha256}>{shortHash(q.sha256)}</code> ·{" "}
                {q.extraction_status === "queued" ? "çıkarma sırada" : `çıkarma başarısız: ${q.extraction?.error ?? "neden yok"}`} · indirildi {fmtWhen(q.retrieved_at)}
              </li>
            ))}
          </ul>
        )
        : null}
    </section>
  );
}
