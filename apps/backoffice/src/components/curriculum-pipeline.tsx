import { useEffect, useState } from "react";
import { curriculumSourceFetchTargetSchema, type CurriculumSourceRow, curriculumSourceRowSchema, type PrereviewStatus, prereviewStatusLabel } from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useAdminQuery } from "@/lib/use-async";
import { Notice } from "./Layout";
import { adminRpc, edgeErrorBody, edgeFailure, fmtWhen, shortHash } from "./review-rpc";

// C05: resmî dizin hedefleri (yıl/dönem) ve çıkarma kuyruğu. Hedef eklemek URL tahmini değildir: yönetici yalnız
// yayımlanmış resmî meb.gov.tr dizin sayfasını kaydeder. Kayıt yoksa aileler başka dönemi değil "serbest çalışma"yı görür.
// H02: ilk indirme kayıtlı hedeften (yıl/dönem → resmî dizindeki ders bağlantısı → gerekirse kademe) panelden başlar;
// çıkarma her sürüm için panelden, yöneticinin kendi oturumuyla sunucuda (curriculum-source-extract) çalışır.
// Token kopyalama, terminal komutu veya otomatik onay/yayın yoktur.

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
  extraction_running?: boolean;
  extraction_attempts?: number;
  extraction_last_error?: string | null;
};
export type CandidatePipelineState = {
  id: string;
  source_status: "approved" | "pending_review" | "diff_review_required" | "superseded" | "withdrawn" | "manifest_only";
  prereview_status: PrereviewStatus | null;
  prereview_reason: string | null;
};
type Pipeline = { queue: QueueItem[]; candidates: CandidatePipelineState[]; operator_step: string };
type IndexLink = { text: string; href: string; ambiguous: boolean };
type Tone = "ok" | "error" | "warn";

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
export const levelLabel = { ortaokul: "Ortaokul (5–8)", lise: "Lise (9–12)" } as const;
type Level = keyof typeof levelLabel;
/** Kademe, kaynak anahtarının sonundan okunur (ör. `oyss:2026-2027:1:ingilizce-lise`). */
export function sourceLevel(sourceKey: string): Level | undefined {
  const m = /-(ortaokul|lise)$/.exec(sourceKey);
  return m ? m[1] as Level : undefined;
}

// --- Panel parçaları arası yenileme: indirme/çıkarma sonrası kaynaklar, kuyruk ve aday listesi birlikte tazelenir.
const CURRICULUM_CHANGED = "gina:curriculum-changed";
export function announceCurriculumChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CURRICULUM_CHANGED));
}
export function useCurriculumChanges(reload: () => void) {
  useEffect(() => {
    window.addEventListener(CURRICULUM_CHANGED, reload);
    return () => window.removeEventListener(CURRICULUM_CHANGED, reload);
  }, [reload]);
}

export function usePipeline() {
  const q = useAdminQuery(async () => await adminRpc<Pipeline>("admin_curriculum_pipeline"));
  useCurriculumChanges(q.reload);
  return q;
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

// ------------------------------------------------------------------------------------------------ extraction
const verdictLabel = (error: string | null | undefined) => {
  const e = error ?? "";
  if (e === "hash_changed_since_fetch") return "resmî dosya indirildiği andan beri değişmiş (SHA-256 tutmuyor); resmî dizini yeniden kontrol edin";
  if (e === "no_scenarios_found") return "dosyada senaryo tablosu bulunamadı";
  if (e === "extract:exam_scope_unresolved") return "tablo bu dönemin ortak yazılısına ait görünmüyor";
  if (e === "extract:workbook_expansion_limit") return "çalışma kitabı açıldığında boyut sınırını aşıyor";
  if (e === "extract:worksheet_path") return "çalışma kitabı beklenmeyen bir sayfa yolu içeriyor";
  if (e.startsWith("extract:")) return `dosya okunamadı (${e.slice(8, 120)})`;
  return e || "neden yok";
};
const transientLabel = (reason: string | null | undefined) => {
  const r = reason ?? "";
  if (r.startsWith("source_unreachable:http_status:")) return `resmî dosya sunucusu HTTP ${r.split(":").pop()} döndü`;
  if (r.startsWith("source_unreachable:timeout")) return "resmî dosya sunucusu zamanında yanıt vermedi";
  if (r.startsWith("source_unreachable:")) return `resmî dosyaya ulaşılamadı (${r.slice(19, 100)})`;
  if (r === "extractor_error") return "çıkarıcı beklenmedik biçimde durdu";
  if (r.startsWith("record_failed:")) return `sonuç kaydedilemedi (${r.slice(14, 100)})`;
  return r;
};
const extractErrors: Record<string, string> = {
  forbidden: "Yönetici yetkiniz doğrulanamadı (rol geri alınmış veya oturum süresi dolmuş olabilir). Yeniden giriş yapın; hiçbir şey değişmedi.",
  extraction_in_progress: "Bu sürüm şu anda çıkarılıyor (başka sekme veya yönetici). Yeni iş açılmadı; birkaç saniye sonra listeyi yenileyin.",
  revision_closed: "Bu sürüm kenara konmuş veya geri çekilmiş; çıkarılmaz.",
  extraction_conflict: "Bu dosya için daha önce farklı bir çıkarım kaydedilmiş; üzerine yazılmadı. Kayıt değişmedi.",
  request_conflict: "Aynı istek farklı içerikle gönderildi. Sayfayı yenileyip yeniden deneyin.",
  not_found: "Sürüm bulunamadı. Listeyi yenileyin.",
  invalid_input: "İstek geçersiz.",
  save_failed: "Sonuç kaydedilemedi; sürüm kuyrukta kaldı. Yeniden deneyin.",
  data_failed: "Veritabanına ulaşılamadı; hiçbir şey değişmedi. Yeniden deneyin.",
};

/** Bir kaynak sürümü için panelden çıkarma: durum, yeniden deneme ve açık hata mesajı. */
export function useExtraction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ revision: string; tone: Tone; text: string } | null>(null);
  async function extract(revisionId: string) {
    if (busy) return;
    setBusy(revisionId);
    setMessage(null);
    try {
      const { data, error } = await supabase().functions.invoke("curriculum-source-extract", {
        body: { request_id: crypto.randomUUID(), revision_id: revisionId },
        signal: AbortSignal.timeout(150000),
      });
      if (error) throw error;
      const r = data as { outcome?: string; error?: string | null; scenarios?: number; extraction?: { created?: number; existing?: number } };
      if (r.outcome === "done" || r.outcome === "unchanged") {
        setMessage({
          revision: revisionId,
          tone: "ok",
          text: `Çıkarıldı: ${r.scenarios ?? 0} senaryo adayı taslak olarak içe alındı (${r.extraction?.created ?? 0} yeni, ${r.extraction?.existing ?? 0} mevcut). ` +
            "Hiçbiri onaylanmadı veya yayımlanmadı; aşağıdaki aday listesinden inceleyin.",
        });
      } else if (r.outcome === "already_done") {
        setMessage({ revision: revisionId, tone: "ok", text: "Bu sürüm zaten çıkarılmış; yeni iş açılmadı." });
      } else {
        setMessage({ revision: revisionId, tone: "error", text: `Çıkarma başarısız: ${verdictLabel(r.error)}. Gerekçe kaydedildi; aday oluşturulmadı.` });
      }
    } catch (e) {
      const f = await edgeFailure(e);
      const body = await edgeErrorBody(e);
      const code = f.code ?? "";
      setMessage({
        revision: revisionId,
        tone: code === "extraction_in_progress" ? "warn" : "error",
        text: code === "source_unreachable"
          ? `Çıkarma başlatıldı ama ${transientLabel(String(body?.reason ?? ""))}. Bu bir karar değil: sürüm kuyrukta kaldı, yeniden deneyebilirsiniz.`
          : code === "extractor_error"
          ? "Çıkarıcı beklenmedik biçimde durdu. Sürüm kuyrukta kaldı; yeniden deneyin."
          : f.kind === "unreachable"
          ? "Çıkarma başlatılamadı: curriculum-source-extract sunucu fonksiyonuna ulaşılamadı (bu ortamda Edge fonksiyonları çalışmıyor olabilir). Hiçbir şey değişmedi."
          : extractErrors[code] ?? `Çıkarma tamamlanamadı (HTTP ${f.status ?? "?"}). Sürüm kuyrukta kaldı.`,
      });
    } finally {
      setBusy(null);
      announceCurriculumChange();
    }
  }
  return { busy, message, extract };
}

type ExtractableRevision = {
  extraction_status: string;
  status: string;
  extraction_running?: boolean;
  extraction_attempts?: number;
  extraction_last_error?: string | null;
};
export function canExtract(r: ExtractableRevision) {
  return (r.extraction_status === "queued" || r.extraction_status === "failed") && r.status !== "withdrawn" && r.status !== "superseded";
}
/** Çıkar / Yeniden dene düğmesi; çalışan kilitte devre dışı. */
export function ExtractButton({ revisionId, revision, x }: { revisionId: string; revision: ExtractableRevision; x: ReturnType<typeof useExtraction> }) {
  if (!canExtract(revision)) return null;
  const running = x.busy === revisionId || revision.extraction_running;
  const retry = revision.extraction_status === "failed" || !!revision.extraction_last_error;
  return (
    <button type="button" className="btn-secondary" data-testid="extract-button" disabled={!!x.busy || !!revision.extraction_running} onClick={() => void x.extract(revisionId)}>
      {running ? "Çıkarılıyor…" : retry ? "Çıkarmayı yeniden dene" : "Adayları çıkar"}
    </button>
  );
}
export function ExtractionState({ revision }: { revision: ExtractableRevision & { extraction?: { error?: unknown } | null } }) {
  const attempts = revision.extraction_attempts ?? 0;
  return (
    <span className="text-xs" data-testid="extraction-state">
      {revision.extraction_running
        ? "çıkarılıyor"
        : revision.extraction_status === "queued"
        ? "çıkarma sırada"
        : revision.extraction_status === "done"
        ? "çıkarıldı"
        : revision.extraction_status === "failed"
        ? `çıkarma başarısız: ${verdictLabel(String(revision.extraction?.error ?? ""))}`
        : "çıkarılmadı"}
      {attempts ? ` · ${attempts} deneme` : ""}
      {revision.extraction_last_error && revision.extraction_status !== "done" ? ` · son deneme: ${transientLabel(revision.extraction_last_error)}` : ""}
    </span>
  );
}

// ------------------------------------------------------------------------------------------------ first download
const fetchErrors: Record<string, string> = {
  forbidden: "Yönetici yetkiniz doğrulanamadı (rol geri alınmış veya oturum süresi dolmuş olabilir). Hiçbir şey indirilmedi.",
  invalid_input: "Kaynak hedefi geçersiz.",
  save_failed: "İndirme sonucu kaydedilemedi; yeniden deneyin.",
  request_conflict: "Aynı istek farklı içerikle gönderildi. Formu kapatıp yeniden açın.",
  data_failed: "Dizin kaydı okunamadı; yeniden deneyin.",
};
const linkLabel = (l: IndexLink, all: IndexLink[]) => {
  if (!l.ambiguous) return l.text;
  const same = all.filter((x) => x.text === l.text);
  return `${l.text} (${same.indexOf(l) + 1}. bağlantı · ${l.href.replace(/^https:\/\//, "")})`;
};

function FirstDownload({ target, onClose }: { target: SourceTarget; onClose: () => void }) {
  const [links, setLinks] = useState<IndexLink[] | null>(null);
  const [href, setHref] = useState("");
  const [level, setLevel] = useState<Level | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: Tone; text: string } | null>(null);
  const [result, setResult] = useState<{ revision_id: string; outcome: string; extraction_status: string } | null>(null);
  const sources = useAdminQuery(async () => curriculumSourceRowSchema.array().parse(await adminRpc("admin_list_curriculum_sources")));
  useCurriculumChanges(sources.reload);
  const x = useExtraction();
  const chosen = links?.find((l) => l.href === href) ?? null;
  const existing = (l: IndexLink, lv?: Level) =>
    (sources.data ?? []).find((s: CurriculumSourceRow) =>
      s.school_year === target.school_year && s.term === target.term && s.label === l.text && sourceLevel(s.source_key) === lv
    );

  async function listLinks() {
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase().functions.invoke("curriculum-source-fetch", {
        body: { request_id: crypto.randomUUID(), action: "list_links", target: { exam_family: "oyss", school_year: target.school_year, term: target.term } },
        signal: AbortSignal.timeout(45000),
      });
      if (error) throw error;
      const r = data as { outcome: string; links: IndexLink[]; error?: string };
      if (r.outcome === "unpublished") setMessage({ tone: "warn", text: "Bu yıl/dönem için etkin resmî dizin kaydı yok. Başka dönem kullanılmaz." });
      else if (r.outcome === "unverified") setMessage({ tone: "error", text: `Resmî dizin sayfası okunamadı (${r.error ?? "?"}). Hiçbir şey kaydedilmedi; yeniden deneyin.` });
      else if (!r.links.length) setMessage({ tone: "warn", text: "Resmî dizin sayfasında izinli bir ders bağlantısı bulunamadı. Adres tahmin edilmez." });
      setLinks(r.links ?? []);
    } catch (e) {
      const f = await edgeFailure(e);
      setMessage({
        tone: "error",
        text: f.kind === "unreachable"
          ? "Resmî dizin okunamadı: curriculum-source-fetch sunucu fonksiyonuna ulaşılamadı. Hiçbir şey kaydedilmedi."
          : `Resmî dizin okunamadı: ${fetchErrors[f.code ?? ""] ?? `HTTP ${f.status}`}`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!chosen || busy || (chosen.ambiguous && !level)) return;
    const parsed = curriculumSourceFetchTargetSchema.safeParse({
      exam_family: "oyss",
      school_year: target.school_year,
      term: target.term,
      subject: chosen.text,
      link_url: chosen.href,
      ...(chosen.ambiguous && level ? { level } : {}),
    });
    if (!parsed.success) {
      setMessage({ tone: "error", text: "Seçilen ders bağlantısı doğrulanamadı; indirme başlatılmadı." });
      return;
    }
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      const { data, error } = await supabase().functions.invoke("curriculum-source-fetch", {
        body: { request_id: crypto.randomUUID(), target: parsed.data },
        signal: AbortSignal.timeout(60000),
      });
      if (error) throw error;
      const r = data as { outcome?: string; revision_id?: string; extraction_status?: string; error?: string; sha256?: string; stored?: boolean };
      if (r.outcome === "new_revision" || r.outcome === "unchanged") {
        setResult({ revision_id: r.revision_id!, outcome: r.outcome, extraction_status: r.extraction_status ?? "queued" });
        setMessage({
          tone: "ok",
          text: (r.outcome === "new_revision"
            ? `İndirildi: yeni kaynak sürümü ${shortHash(r.sha256)} kaydedildi (inceleme bekliyor, çıkarma sırada).`
            : `Dosya zaten kayıtlı sürümle aynı (${shortHash(r.sha256)}); yeni kayıt açılmadı.`) +
            " Hiçbir şey onaylanmadı veya yayımlanmadı.",
        });
      } else if (r.outcome === "unverified") {
        setMessage({ tone: "error", text: `Resmî dosya indirilemedi (${r.error ?? "?"}). Sürüm açılmadı; kaynak kartından yeniden deneyebilirsiniz.` });
      } else if (r.outcome === "ambiguous_subject_link") {
        setMessage({ tone: "warn", text: "Resmî dizinde bu ders için birden fazla bağlantı var; kademeyi seçip yeniden deneyin." });
      } else {
        setMessage({ tone: "warn", text: "Bu yıl/dönem için bilinen resmî dizin yok. Başka yıl seçilmedi." });
      }
    } catch (e) {
      const f = await edgeFailure(e);
      const body = await edgeErrorBody(e);
      setMessage({
        tone: "error",
        text: f.code === "source_duplicate"
          ? `Bu dosya bu dönem için zaten «${String(body?.existing_label ?? "başka bir")}» kaynağında kayıtlı; ikinci kayıt açılmadı. O kaynak kartını kullanın.`
          : f.kind === "unreachable"
          ? "İndirme başlatılamadı: curriculum-source-fetch sunucu fonksiyonuna ulaşılamadı. Hiçbir şey kaydedilmedi."
          : `İndirme tamamlanamadı: ${fetchErrors[f.code ?? ""] ?? f.code ?? `HTTP ${f.status}`}.`,
      });
    } finally {
      setBusy(false);
      announceCurriculumChange();
    }
  }

  return (
    <div className="mt-3 grid gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm" role="group" aria-label="İlk indirme" data-testid="first-download">
      <p className="font-bold">{target.school_year} · {target.term}. dönem · resmî dizinden ilk indirme</p>
      <p>
        Sunucu yalnız kayıtlı dizin sayfasındaki bağlantıları gösterir ve indirir (HTTPS, izinli MEB/EBA adresleri, 5 MB). İndirmek kaynağı
        onaylamaz, senaryo yayımlamaz, okul seçmez.
      </p>
      {!links
        ? (
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn" disabled={busy} onClick={() => void listLinks()}>
              {busy ? "Dizin okunuyor…" : "Resmî dizindeki dersleri getir"}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Vazgeç</button>
          </div>
        )
        : (
          <>
            <label className="label">
              Ders (resmî dizindeki bağlantı)
              <select className="input mt-2" value={href} disabled={busy} onChange={(e) => {
                setHref(e.target.value);
                setLevel("");
                setResult(null);
                setMessage(null);
              }}>
                <option value="">Ders seçin</option>
                {links.map((l) => (
                  <option key={l.href} value={l.href}>
                    {linkLabel(l, links)}{!l.ambiguous && existing(l) ? " · zaten kayıtlı" : ""}
                  </option>
                ))}
              </select>
            </label>
            {chosen?.ambiguous
              ? (
                <div className="grid gap-2">
                  <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
                    Dizinde «{chosen.text}» için birden fazla bağlantı var. Tahmin yapılmaz: bağlantıyı açıp dosyanın hangi kademeye ait olduğunu
                    kontrol edin ve kademeyi seçin. <a className="underline" href={chosen.href} target="_blank" rel="noreferrer">Bağlantıyı aç</a>
                  </p>
                  <label className="label">
                    Okul kademesi
                    <select className="input mt-2" value={level} disabled={busy} onChange={(e) => setLevel(e.target.value as Level | "")}>
                      <option value="">Kademe seçin</option>
                      {(Object.keys(levelLabel) as Level[]).map((lv) => (
                        <option key={lv} value={lv}>{levelLabel[lv]}{existing(chosen, lv) ? " · zaten kayıtlı" : ""}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )
              : null}
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn" disabled={busy || !chosen || (chosen.ambiguous && !level)} onClick={() => void download()}>
                {busy ? "İndiriliyor…" : "İndirmeyi başlat"}
              </button>
              <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Kapat</button>
            </div>
          </>
        )}
      {message
        ? (
          <p role="status" data-testid="first-download-message" className={`rounded-xl border px-3 py-2 ${message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
            {message.text}
          </p>
        )
        : null}
      {result && canExtract({ extraction_status: result.extraction_status, status: "pending_review" })
        ? (
          <div className="flex flex-wrap items-center gap-3">
            <ExtractButton revisionId={result.revision_id} revision={{ extraction_status: result.extraction_status, status: "pending_review" }} x={x} />
            <span>Sonraki adım: bu sürümden senaryo adaylarını çıkarın (taslak olarak, onaysız).</span>
          </div>
        )
        : null}
      {x.message
        ? (
          <p role="status" data-testid="extract-message" className={`rounded-xl border px-3 py-2 ${x.message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : x.message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
            {x.message.text}
          </p>
        )
        : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ section
export function CurriculumPipeline() {
  const targets = useAdminQuery(async () => await adminRpc<SourceTarget[]>("admin_list_curriculum_source_targets"));
  useCurriculumChanges(targets.reload);
  const pipeline = usePipeline();
  const x = useExtraction();
  const [form, setForm] = useState<{ request: string; school_year: string; term: 1 | 2; index_url: string; status: "active" | "retired"; note: string } | null>(null);
  const [downloadFor, setDownloadFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const queue = pipeline.data?.queue ?? [];
  const downloadTarget = (targets.data ?? []).find((t) => t.id === downloadFor) ?? null;

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
          "Hiçbir dosya indirilmedi; tablodaki «İlk indirme» ile sunucu indirir.",
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
      {targets.error ? <Notice tone="error">Dizin hedefleri okunamadı. Yetkinizi kontrol edip yeniden deneyin.</Notice> : null}
      <div className="overflow-x-auto">
        <table className="table" aria-label="Resmî dizin hedefleri">
          <thead>
            <tr><th>Yıl · dönem</th><th>Dizin sayfası</th><th>Durum</th><th>Kaynak</th><th>Son kontrol</th><th>Not</th><th>İşlem</th></tr>
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
                <td>
                  {t.status === "active"
                    ? (
                      <button type="button" className="btn-secondary" disabled={busy || downloadFor === t.id} onClick={() => setDownloadFor(t.id)}>
                        İlk indirme
                      </button>
                    )
                    : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {downloadTarget ? <FirstDownload key={downloadTarget.id} target={downloadTarget} onClose={() => setDownloadFor(null)} /> : null}
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
      <p className="my-2 max-w-3xl text-sm" data-testid="operator-step">
        Yeni indirilen sürüm «çıkarma sırada» başlar. «Adayları çıkar» düğmesi işi sunucuda, sizin oturumunuzla başlatır: saklanan özgün dosya
        (yoksa aynı güvenlik kurallarıyla resmî adres) okunur, SHA-256 özeti doğrulanır, adaylar üretilir ve tekrar çalıştırıldığında mükerrer
        aday oluşturmadan «çıkarıldı» ya da gerekçeli «başarısız» olarak kaydedilir. Aynı anda ikinci tıklama yeni iş açmaz. Ağ hatası karar
        sayılmaz; sürüm kuyrukta kalır. Adaylar taslaktır; kaynak onayı ve senaryo yayını ayrı kararlardır.
      </p>
      {pipeline.error ? <Notice tone="error">Çıkarma kuyruğu okunamadı. Yetkinizi kontrol edip yeniden deneyin.</Notice> : null}
      {pipeline.data && !queue.length ? <p className="mt-2 text-sm" data-testid="queue-empty">Kuyruk boş: bekleyen veya başarısız çıkarma yok.</p> : null}
      {queue.length
        ? (
          <ul className="mt-2 grid gap-2" aria-label="Çıkarma bekleyen sürümler">
            {queue.map((q) => (
              <li
                key={q.revision_id}
                className="grid gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
                data-testid="queue-item"
                data-extraction={q.extraction_running ? "running" : q.extraction_status}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{q.label}</strong> · {q.school_year} · {q.term}. dönem · <code title={q.sha256}>{shortHash(q.sha256)}</code> · indirildi{" "}
                    {fmtWhen(q.retrieved_at)}
                    <br />
                    <ExtractionState revision={q} />
                  </span>
                  <ExtractButton revisionId={q.revision_id} revision={q} x={x} />
                </div>
                {x.message?.revision === q.revision_id
                  ? (
                    <p role="status" data-testid="extract-message" className={`rounded-lg border px-3 py-2 ${x.message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : x.message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-white text-amber-900"}`}>
                      {x.message.text}
                    </p>
                  )
                  : null}
              </li>
            ))}
          </ul>
        )
        : null}
      {x.message && !queue.some((q) => q.revision_id === x.message?.revision)
        ? (
          <p role="status" data-testid="extract-message" className={`mt-2 rounded-xl border px-3 py-2 text-sm ${x.message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : x.message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
            {x.message.text}
          </p>
        )
        : null}
    </section>
  );
}
