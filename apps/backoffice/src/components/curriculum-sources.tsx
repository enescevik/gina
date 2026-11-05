import { useState } from "react";
import {
  type CurriculumSourceRow,
  curriculumSourceFetchTargetSchema,
  curriculumSourceReviewCommandSchema,
  curriculumSourceRowSchema,
} from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useAdminQuery } from "@/lib/use-async";
import { Notice } from "./Layout";
import { adminRpc, edgeFailure, fmtWhen, shortHash } from "./review-rpc";

// M01 kaynak sürümleri: indirilen resmî dosya kanıttır, onay/yayın/okul seçimi değildir.
// Aynı özet yeni iş açmaz; değişen özet yeni sürümdür ve yöneticinin fark incelemesini ister.

/** Son başarılı kontrol bundan eskiyse güncellik "eski" sayılır ve uyarı gösterilir. */
export const SOURCE_STALE_DAYS = 7;
const DAY = 86_400_000;

const freshnessLabel: Record<CurriculumSourceRow["freshness"], string> = {
  verified: "Güncel (onaylı kopya ile aynı)",
  unverified: "Güncellik doğrulanamadı",
  pending_review: "İlk sürüm inceleme bekliyor",
  diff_review_required: "Yeni sürüm — fark incelemesi gerekli",
  withdrawn: "Geri çekildi",
};
const revisionLabel: Record<CurriculumSourceRow["revisions"][number]["status"], string> = {
  pending_review: "İnceleme bekliyor",
  approved: "Onaylı kopya",
  diff_review_required: "Yeni sürüm — fark incelemesi gerekli",
  superseded: "Kenara kondu / eskidi",
  withdrawn: "Geri çekildi",
};
const extractionLabel: Record<string, string> = { queued: "çıkarma sırada", done: "çıkarıldı", failed: "çıkarma başarısız", skipped: "çıkarılmadı" };
const actionLabel = { approve: "Bu sürümü onayla", dismiss: "Reddet (kenara koy)", withdraw: "Geri çek" } as const;
type Action = keyof typeof actionLabel;
const reviewErrors: Record<string, string> = {
  curriculum_review_required: "Not yazın ve kontrol kutusunu işaretleyin.",
  curriculum_revision_conflict: "Bu sürüm bu arada başka bir karar aldı. Listeyi yenileyin.",
  request_conflict: "Aynı istek farklı içerikle gönderildi. Formu kapatıp yeniden açın.",
  curriculum_not_found: "Sürüm bulunamadı.",
};
const fetchErrors: Record<string, string> = {
  forbidden: "Yönetici yetkisi doğrulanamadı.",
  invalid_input: "Kaynak hedefi geçersiz.",
  save_failed: "İndirme sonucu kaydedilemedi.",
};

export function staleSince(s: Pick<CurriculumSourceRow, "last_checked_at">, now = Date.now()): number | null {
  if (!s.last_checked_at) return Infinity;
  const days = Math.floor((now - new Date(s.last_checked_at).getTime()) / DAY);
  return days >= SOURCE_STALE_DAYS ? days : null;
}

export function CurriculumSources() {
  const sources = useAdminQuery(async () => curriculumSourceRowSchema.array().parse(await adminRpc("admin_list_curriculum_sources")));
  const list = sources.data ?? [];
  const attention = list.filter((s) => s.freshness === "diff_review_required" || s.freshness === "pending_review").length;
  const stale = list.filter((s) => staleSince(s) !== null || s.freshness === "unverified").length;
  return (
    <section aria-labelledby="curriculum-sources-title" className="my-5 rounded-3xl border border-[#e5dcf3] bg-white p-5" data-testid="curriculum-sources">
      <h2 id="curriculum-sources-title" className="text-lg font-bold">Kaynak sürümleri ve güncellik</h2>
      <p className="my-2 max-w-3xl text-sm">
        Sunucunun resmî dizinden indirdiği dosyaların sürümleri, son kontrol zamanı ve SHA-256 özeti. Aynı özet yeni iş açmaz; değişen
        dosya yeni bir sürüm kaydıdır ve sizin fark incelemenizi bekler. Onaylamak senaryo yayımlamaz, okul seçmez ve &quot;MEB onaylı&quot;
        anlamına gelmez.
      </p>
      {list.length
        ? (
          <p role="status" className="mb-3 text-sm font-semibold">
            {list.length} kaynak · {attention} sürüm inceleme bekliyor · {stale} kaynağın güncelliği eski veya doğrulanamadı
          </p>
        )
        : null}
      {sources.error
        ? <Notice tone="error">Kaynak sürümleri okunamadı. Yetkinizi kontrol edip yeniden deneyin.</Notice>
        : sources.data && !list.length
        ? <p className="text-sm">Henüz sunucu indirmesi yok. Depodaki manifest karşılaştırması için <code>scripts/fetch-curriculum-sources.py</code> kullanılır.</p>
        : null}
      <ul className="grid gap-4">
        {list.map((s) => <SourceCard key={s.id} source={s} reload={sources.reload} />)}
      </ul>
    </section>
  );
}

function SourceCard({ source: s, reload }: { source: CurriculumSourceRow; reload: () => void }) {
  const [form, setForm] = useState<{ revision: string; action: Action; request: string; note: string; confirmed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "warn"; text: string; candidates?: { text: string; href: string }[] } | null>(null);
  const days = staleSince(s);

  async function check(linkUrl?: string) {
    if (busy) return;
    const target = curriculumSourceFetchTargetSchema.safeParse({
      exam_family: s.exam_family,
      school_year: s.school_year,
      term: s.term,
      subject: s.label,
      ...(linkUrl ? { link_url: linkUrl } : {}),
    });
    if (!target.success) {
      setMessage({ tone: "error", text: "Bu kaynağın hedefi (yıl/dönem/ders) doğrulanamadı; kontrol başlatılmadı." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase().functions.invoke("curriculum-source-fetch", {
        body: { request_id: crypto.randomUUID(), target: target.data },
        signal: AbortSignal.timeout(45000),
      });
      if (error) throw error;
      const r = data as { outcome?: string; candidates?: { text: string; href: string }[]; freshness?: string; error?: string };
      if (r.outcome === "ambiguous_subject_link") {
        setMessage({ tone: "warn", text: "Resmî dizinde bu ders için birden fazla bağlantı var. Tahmin yapılmadı; doğru kademeyi seçin:", candidates: r.candidates ?? [] });
      } else if (r.outcome === "unpublished" || r.outcome === "grade_out_of_scope") {
        setMessage({ tone: "warn", text: "Bu yıl/dönem için bilinen resmî dizin yok. Başka yıl seçilmedi; aileler serbest çalışmaya yönlendirilir." });
      } else {
        setMessage({ tone: "ok", text: `Resmî dizin kontrol edildi. Güncellik: ${freshnessLabel[r.freshness as CurriculumSourceRow["freshness"]] ?? r.freshness ?? "?"}. Hiçbir şey yayımlanmadı.` });
      }
      reload();
    } catch (e) {
      const f = await edgeFailure(e);
      setMessage({
        tone: "error",
        text: f.kind === "unreachable"
          ? "Resmî dizin kontrolü başlatılamadı: curriculum-source-fetch sunucu fonksiyonuna ulaşılamadı (bu ortamda Edge fonksiyonları çalışmıyor olabilir). Kaynak kaydı ve onaylı kopya değişmedi."
          : `Resmî dizin kontrolü tamamlanamadı: ${fetchErrors[f.code ?? ""] ?? f.code ?? `HTTP ${f.status}`}. Kaynak kaydı değişmedi.`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function review() {
    if (!form || busy) return;
    const command = curriculumSourceReviewCommandSchema.safeParse({
      request: form.request,
      revision_id: form.revision,
      action: form.action,
      note: form.note.trim(),
      confirmed: form.confirmed,
    });
    if (!command.success) {
      setMessage({ tone: "error", text: "Not yazın ve kontrol kutusunu işaretleyin." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const r = await adminRpc<{ status: string; freshness: string; withdrawn_candidates: number }>("admin_review_curriculum_source_revision", {
        p_request_id: command.data.request,
        p_revision_id: command.data.revision_id,
        p_action: command.data.action,
        p_note: command.data.note,
        p_confirmed: true,
      });
      setForm(null);
      setMessage({
        tone: "ok",
        text: `Karar kaydedildi: ${revisionLabel[r.status as keyof typeof revisionLabel] ?? r.status}. Kaynak: ${freshnessLabel[r.freshness as CurriculumSourceRow["freshness"]] ?? r.freshness}.` +
          (r.withdrawn_candidates ? ` ${r.withdrawn_candidates} yayımlı senaryo yeni seçimlere kapandı; ailelerin dondurulmuş kopyaları değişmedi.` : ""),
      });
      reload();
    } catch (e) {
      const code = (e as { message?: string })?.message ?? "";
      setMessage({ tone: "error", text: reviewErrors[code] ?? "Karar kaydedilemedi. Güncel durumu yenileyip yeniden deneyin." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-[#eee7f7] p-4 text-sm" data-testid="curriculum-source" data-freshness={s.freshness}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold">{s.label} · {s.school_year} · {s.term}. dönem</p>
          <p className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${s.freshness === "verified" ? "bg-emerald-100 text-emerald-800" : s.freshness === "withdrawn" ? "bg-slate-200 text-slate-800" : "bg-amber-100 text-amber-900"}`}>
            {freshnessLabel[s.freshness]}
          </p>
        </div>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void check()}>
          {busy && !form ? "Kontrol ediliyor…" : "Resmî dizini kontrol et"}
        </button>
      </div>
      <p className="mt-2">
        Son kontrol: {fmtWhen(s.last_checked_at)}
        {s.last_check_error ? ` · son hata: ${s.last_check_error}` : ""}
        {" · "}Onaylı kopya: {s.approved ? <><code title={s.approved.sha256}>{shortHash(s.approved.sha256)}</code> ({fmtWhen(s.approved.retrieved_at)})</> : "yok"}
        {s.index_updated_on ? ` · dizin güncelleme tarihi ${s.index_updated_on}` : ""}
      </p>
      {days !== null || s.freshness === "unverified"
        ? (
          <p role="alert" data-testid="source-stale" className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
            {days === Infinity
              ? "Bu kaynak hiç başarılı kontrol edilmedi."
              : days !== null
              ? `Son kontrol ${days} gün önce (sınır ${SOURCE_STALE_DAYS} gün): güncellik eski.`
              : "Son kontrol başarısız oldu: güncellik doğrulanamadı."}
            {s.approved ? " Aileler son onaylı kopyayı görmeye devam eder." : " Onaylı kopya yok; aileler serbest çalışmaya yönlendirilir."} Resmî dizini yeniden kontrol edin.
          </p>
        )
        : null}
      {s.freshness === "diff_review_required"
        ? (
          <p role="alert" className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 font-semibold text-amber-900">
            Yeni sürüm — fark incelemesi gerekli. Resmî dosyanın özeti onaylı kopyadan farklı; yeni sürümü onaylamadan önce iki dosyayı
            karşılaştırın. Onaylı kopya ve yayımlı senaryolar siz karar verene kadar değişmez.
          </p>
        )
        : null}
      {message
        ? (
          <div role="status" className={`mt-3 rounded-xl border px-3 py-2 ${message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
            <p>{message.text}</p>
            {message.candidates?.map((c) => (
              <button key={c.href} type="button" className="btn-secondary mr-2 mt-2" disabled={busy} onClick={() => void check(c.href)}>{c.text}</button>
            ))}
          </div>
        )
        : null}
      <div className="mt-3 overflow-x-auto">
        <table className="table" aria-label={`${s.label} sürümleri`}>
          <thead>
            <tr><th>Özet (SHA-256)</th><th>İndirildi</th><th>Son kontrol</th><th>Durum</th><th>Senaryo</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {s.revisions.map((r) => {
              const flags = (r.inspection as { flags?: string[] }).flags ?? [];
              const actions: Action[] = r.status === "pending_review" || r.status === "diff_review_required"
                ? ["approve", "dismiss"]
                : r.status === "approved"
                ? ["withdraw"]
                : [];
              return (
                <tr key={r.id} data-testid="source-revision" data-status={r.status}>
                  <td>
                    <code title={r.sha256}>{shortHash(r.sha256)}</code>
                    <div className="text-xs text-slate-500">{r.bytes.toLocaleString("tr-TR")} bayt</div>
                    {s.approved && r.status === "diff_review_required" ? <div className="text-xs">onaylı: <code>{shortHash(s.approved.sha256)}</code></div> : null}
                  </td>
                  <td>{fmtWhen(r.retrieved_at)}</td>
                  <td>{fmtWhen(r.last_checked_at)}</td>
                  <td>
                    <span className="font-semibold">{revisionLabel[r.status]}</span>
                    <div className="text-xs">{extractionLabel[r.extraction_status] ?? r.extraction_status}{flags.length ? ` · bayrak: ${flags.join(", ")}` : ""}</div>
                    {r.review_note ? <div className="text-xs">Not: {r.review_note}</div> : null}
                  </td>
                  <td>{r.candidates} aday · {r.published_candidates} yayımlı</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {actions.map((a) => (
                        <button
                          key={a}
                          type="button"
                          className={a === "withdraw" ? "btn-danger" : "btn-secondary"}
                          disabled={busy}
                          onClick={() => setForm({ revision: r.id, action: a, request: crypto.randomUUID(), note: "", confirmed: false })}
                        >
                          {actionLabel[a]}
                        </button>
                      ))}
                      <a className="btn-secondary inline-flex items-center" href={r.resolved_url} target="_blank" rel="noreferrer">Resmî dosya</a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {form
        ? (
          <form
            className="mt-3 grid gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void review();
            }}
          >
            <p className="font-bold">{actionLabel[form.action]} · <code>{shortHash(s.revisions.find((r) => r.id === form.revision)?.sha256)}</code></p>
            <p className="text-sm">
              {form.action === "approve"
                ? "Bu sürüm onaylı kopya olur; önceki onaylı kopya eskir. Senaryo yayımlanmaz, okul seçilmez."
                : form.action === "dismiss"
                ? "Bu sürüm kenara konur; onaylı kopya değişmez."
                : "Bu sürümün yayımlı senaryoları yeni seçim ve üretime kapanır. Ailelerin dondurulmuş kopyaları değişmez."}
            </p>
            <label className="label">
              Karşılaştırma notu
              <textarea className="input mt-2" maxLength={2000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>
            <label className="flex min-h-12 items-center gap-3">
              <input type="checkbox" checked={form.confirmed} onChange={(e) => setForm({ ...form, confirmed: e.target.checked })} />
              Resmî dosyayı ve özeti kontrol ettim.
            </label>
            <div className="flex flex-wrap gap-3">
              <button className={form.action === "withdraw" ? "btn-danger" : "btn"} disabled={busy || !form.confirmed || !form.note.trim()}>
                {busy ? "Kaydediliyor…" : "Kararı kaydet"}
              </button>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setForm(null)}>Vazgeç</button>
            </div>
          </form>
        )
        : null}
    </li>
  );
}
