import { useRef, useState } from "react";
import { Card, Notice } from "@/components/Layout";
import { s04Rpc } from "@/components/s04-rpc";
import { useAdminQuery } from "@/lib/use-async";
import bundledSeed from "../../../../docs/learning/catalog/education-calendars/tr-2026-2027.json";

/**
 * C11 — takvim işletimi:
 *  - yayın kontrolleri (tohum güveni, kaynak tarihi, gizli kapsam, üst takvimle aynı olma) ve kayıtlı inceleme ile yayın,
 *  - resmî tatil taslakları (tohumdan) ve ayrı yayın / geri çekme,
 *  - okul istisna kuyruğu özeti (aile/çocuk kimliği yok).
 * Tatil verisi veliye yalnız ÖNERİ olarak gider; veli kabul etmeden hiçbir programa işaret konmaz, hiçbir şey silinmez.
 */

export type CalendarCheck = {
  calendar_id: string;
  revision: number;
  provenance: { seed_id: string; confidence: string; checked_at: string } | null;
  blocks: string[];
  warnings: string[];
  priority: number;
  place_kind: string;
  last_review: { revision: number; note: string; created_at: string } | null;
};
export const blockText: Record<string, string> = {
  low_confidence: "Kaynak güveni düşük: yayımlanamaz (il MEM teyidi gerekir).",
  place_inactive: "Kapsam (il/okul) gizli: önce “Bölgeler ve okullar” sekmesinden etkinleştirin.",
  source_stale: "Kaynak kontrol tarihi eğitim yılı başlangıcından bir yıldan eski: kaynağı yeniden kontrol edip tarihi güncelleyin.",
};
export const warningText: Record<string, string> = {
  review_required: "Orta güvenli tohum: yayın için kaynak incelemesi kaydı gerekir.",
  same_as_parent: "Üst kapsamdaki yayımlanmış takvimle aynı; ayrıca yayımlamak gerekmez (en özel takvim kullanılır).",
  already_published: "Bu sürüm zaten yayında.",
};
const confidenceText: Record<string, string> = { high: "yüksek", medium: "orta", low: "düşük" };

export function useCalendarChecks(tick: number) {
  return useAdminQuery(async () => {
    const v = await s04Rpc("admin_education_calendar_checks");
    if (!Array.isArray(v)) throw new Error("unexpected_checks");
    return new Map((v as CalendarCheck[]).map((c) => [c.calendar_id, c]));
  }, [tick]);
}

export function CheckBadges({ check }: { check: CalendarCheck | undefined }) {
  if (!check) return null;
  return (
    <div className="mt-2 grid gap-1 text-sm">
      {check.provenance
        ? (
          <p>
            Kaynaklı tohum · güven {confidenceText[check.provenance.confidence] ?? check.provenance.confidence}
            {check.provenance.checked_at ? ` · kontrol ${check.provenance.checked_at}` : ""}
          </p>
        )
        : <p>Elle girildi</p>}
      {check.blocks.map((b) => (
        <p key={b} className="font-semibold text-[#9A3412]">{blockText[b] ?? b}</p>
      ))}
      {check.warnings.filter((w) => w !== "already_published").map((w) => <p key={w}>{warningText[w] ?? w}</p>)}
      {check.last_review
        ? <p>Son inceleme: {new Date(check.last_review.created_at).toLocaleDateString("tr-TR")} (sürüm {check.last_review.revision})</p>
        : null}
    </div>
  );
}

/** Kayıtlı inceleme ile yayın: kaynak açıldı + tarihler kaynakla aynı + kapsam doğru + gerekçe notu. */
export function PublishReview(
  { calendarId, revision, check, sourceUrl, onDone }: {
    calendarId: string;
    revision: number;
    check: CalendarCheck | undefined;
    sourceUrl: string;
    onDone: (message: string) => void;
  },
) {
  const [checks, setChecks] = useState({ source_opened: false, dates_match: false, scope_match: false }),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<{ key: string; id: string } | null>(null);
  const blocked = !!check?.blocks.length;
  const ready = !blocked && checks.source_opened && checks.dates_match && checks.scope_match && note.trim().length >= 10;
  async function publish() {
    if (!ready || busy) return;
    const args = { p_id: calendarId, p_revision: revision, p_checks: checks, p_note: note.trim() };
    const key = JSON.stringify(args);
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await s04Rpc("admin_publish_education_calendar", { ...args, p_request: pending.current.id });
      pending.current = null;
      onDone("Takvim inceleme kaydıyla yayımlandı.");
    } catch (e) {
      const m = (e as { message?: string }).message ?? "";
      setError(
        m.includes("calendar_publish_blocked")
          ? "Sunucu yayını engelledi: kaynak güveni, kaynak tarihi veya kapsam uygun değil."
          : m.includes("calendar_changed") || m.includes("calendar_save_first")
          ? "Takvim başka bir işlemle değişti. Listeyi yenileyip yeniden açın."
          : m.includes("calendar_invalid")
          ? "Kapsam gizli ya da takvim geçersiz; önce düzeltin."
          : "Yayımlanamadı. Bağlantıyı kontrol edip yeniden deneyin; aynı istek tekrar gönderilir.",
      );
    } finally {
      setBusy(false);
    }
  }
  const box = (key: keyof typeof checks, label: string) => (
    <label className="flex min-h-12 items-center gap-3">
      <input
        type="checkbox"
        checked={checks[key]}
        disabled={blocked || busy}
        onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <div className="mt-3 grid gap-2" aria-label="Yayın incelemesi">
      {blocked
        ? <Notice tone="error">{check!.blocks.map((b) => blockText[b] ?? b).join(" ")}</Notice>
        : null}
      {check?.warnings.includes("review_required") ? <Notice>{warningText.review_required}</Notice> : null}
      {check?.warnings.includes("same_as_parent") ? <Notice>{warningText.same_as_parent}</Notice> : null}
      <a className="font-semibold text-[#6042DE] underline" href={sourceUrl} target="_blank" rel="noreferrer noopener">
        Kaynağı yeni sekmede aç
      </a>
      {box("source_opened", "Kaynağı açtım; resmî yayın sayfası/belgesi")}
      {box("dates_match", "Yıl başı/sonu ve dönem tarihlerini kaynakla tek tek karşılaştırdım")}
      {box("scope_match", "Kapsam (ülke/il/okul), kademe ve yıl kaynakla aynı")}
      <label>
        İnceleme notu (en az 10 karakter)
        <textarea
          className="input mt-2 min-h-20 w-full"
          maxLength={1000}
          value={note}
          disabled={blocked || busy}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div>
        <button type="button" className="btn" disabled={!ready || busy} onClick={() => void publish()}>
          {busy ? "Yayımlanıyor…" : "İnceledim, takvimi yayımla"}
        </button>
      </div>
    </div>
  );
}

type Holiday = {
  id: string;
  place_name: string;
  stage: string | null;
  academic_year: number;
  kind: "public_holiday" | "break" | "local_day";
  title: string;
  starts_on: string;
  ends_on: string;
  source_url: string;
  verified_on: string;
  status: "draft" | "published" | "withdrawn";
  revision: number;
};
const statusText: Record<Holiday["status"], string> = { draft: "Taslak", published: "Yayında", withdrawn: "Geri çekildi" };
type HolidayImport = {
  executed: boolean;
  published: false;
  counts: { create: number; exists: number; skipped: number };
  records: { seed_key: string; title: string; starts_on: string; ends_on: string; action: string }[];
};

export function HolidayAdmin() {
  const list = useAdminQuery(async () => {
    const v = await s04Rpc("admin_education_holidays", { p_academic_year: null });
    if (!Array.isArray(v)) throw new Error("unexpected_holidays");
    return v as Holiday[];
  });
  const [preview, setPreview] = useState<HolidayImport | null>(null),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const pending = useRef<{ key: string; id: string } | null>(null);
  const requestId = (key: string) => {
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    return pending.current.id;
  };
  async function act(fn: () => Promise<unknown>, done: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      pending.current = null;
      setMessage(done);
      list.reload();
    } catch (e) {
      const m = (e as { message?: string }).message ?? "";
      setError(
        m.includes("calendar_changed")
          ? "Kayıt başka bir işlemle değişti; liste yenilendi."
          : m.includes("calendar_publish_blocked")
          ? "Yayın engellendi: kapsam gizli ya da kaynak tarihi çok eski."
          : "İşlem tamamlanamadı. Yeniden deneyin; aynı istek tekrar gönderilir.",
      );
      if (m.includes("changed")) list.reload();
    } finally {
      setBusy(false);
    }
  }
  const readImport = (v: unknown) => {
    const r = v as HolidayImport;
    if (!r || r.published !== false || typeof r.counts?.create !== "number") throw new Error("unexpected_import");
    return r;
  };
  return (
    <Card title="Resmî tatil ve yerel günler">
      <p className="mb-2">
        Tatil kayıtları velilere yalnız <strong>öneri</strong> olarak gider: veli “tatil olarak işaretle” demedikçe ders
        programına hiçbir işaret konmaz, ders veya görev silinmez, sınıf değişmez. Ara tatiller yayımlanmış takvimin
        dönemleri arasındaki boşluktan gelir; burada ayrıca girilmez.
      </p>
      <p className="mb-4 text-sm">İçe aktarma yalnız taslak üretir. Her kayıt ayrı ayrı yayımlanır ve gerektiğinde geri çekilir.</p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}
      <div className="mb-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              setPreview(readImport(await s04Rpc("admin_import_education_holidays", { p_request: null, p_seed: bundledSeed, p_execute: false })));
              setConfirm(false);
            }, "Önizleme hazır; henüz hiçbir şey yazılmadı.")}
        >
          Tohumdaki resmî tatilleri önizle
        </button>
      </div>
      {preview
        ? (
          <section className="mb-5 rounded-3xl border border-violet-100 bg-[#FCFAF6] p-5" aria-label="Tatil önizlemesi">
            <p className="font-semibold">
              Oluşturulacak taslak: {preview.counts.create} · zaten var: {preview.counts.exists} · atlanan (yıl dışı / geçersiz): {preview.counts.skipped}
            </p>
            <ul className="mt-2 grid gap-1 text-sm">
              {preview.records.map((r) => (
                <li key={r.seed_key}>{r.title} · {r.starts_on}{r.ends_on !== r.starts_on ? ` – ${r.ends_on}` : ""} · {r.action}</li>
              ))}
            </ul>
            {!preview.executed && preview.counts.create > 0
              ? (
                <div className="mt-3 grid gap-2">
                  <label className="flex min-h-12 items-center gap-3">
                    <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                    Yalnız taslak oluşturulacağını, yayının ayrı adım olduğunu anladım
                  </label>
                  <div>
                    <button
                      type="button"
                      className="btn"
                      disabled={!confirm || busy}
                      onClick={() =>
                        void act(async () => {
                          setPreview(readImport(await s04Rpc("admin_import_education_holidays", {
                            p_request: requestId("holiday-import"),
                            p_seed: bundledSeed,
                            p_execute: true,
                          })));
                        }, "Tatil taslakları oluşturuldu. Hiçbiri yayımlanmadı.")}
                    >
                      Taslakları oluştur
                    </button>
                  </div>
                </div>
              )
              : null}
          </section>
        )
        : null}
      {list.loading && !list.data ? <p>Yükleniyor…</p> : null}
      {list.data && !list.data.length ? <p>Henüz tatil kaydı yok.</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(list.data ?? []).map((h) => (
          <article key={h.id} className="rounded-3xl border border-violet-100 bg-white p-4">
            <p className="text-sm">{h.place_name} · {h.stage ?? "tüm kademeler"} · {statusText[h.status]}</p>
            <h3 className="my-1 break-words font-bold">{h.title}</h3>
            <p className="text-sm">{h.starts_on}{h.ends_on !== h.starts_on ? ` – ${h.ends_on}` : ""} · kaynak kontrolü {h.verified_on}</p>
            <a className="text-sm text-[#6042DE] underline" href={h.source_url} target="_blank" rel="noreferrer noopener">Kaynak</a>
            <div className="mt-3 flex flex-wrap gap-2">
              {h.status !== "published"
                ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        s04Rpc("admin_set_education_holiday_status", {
                          p_request: requestId(`publish:${h.id}:${h.revision}`),
                          p_id: h.id,
                          p_revision: h.revision,
                          p_status: "published",
                        }), "Tatil yayımlandı; velilere yalnız öneri olarak görünür.")}
                  >
                    Kaynağı doğruladım, yayımla
                  </button>
                )
                : (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        s04Rpc("admin_set_education_holiday_status", {
                          p_request: requestId(`withdraw:${h.id}:${h.revision}`),
                          p_id: h.id,
                          p_revision: h.revision,
                          p_status: "withdrawn",
                        }), "Tatil geri çekildi; yeni öneri üretilmez.")}
                  >
                    Geri çek
                  </button>
                )}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

type SummaryRow = {
  place_id: string;
  place_name: string;
  place_kind: string;
  stage: string;
  academic_year: number;
  reason: "school_calendar" | "personal" | "correction" | "calendar_missing";
  open: number;
  verified: number;
  dismissed: number;
};
const reasonText: Record<SummaryRow["reason"], string> = {
  school_calendar: "Okul takvimi farklı",
  personal: "Kişisel tercih",
  correction: "Düzeltme",
  calendar_missing: "Takvim yok",
};
/** Aile kimliği olmadan: hangi yerde hangi gerekçe birikiyor. "Takvim yok" = yayımlanacak takvim ihtiyacı. */
export function ReportSummary({ tick }: { tick: number }) {
  const q = useAdminQuery(async () => {
    const v = await s04Rpc("admin_education_report_summary");
    if (!Array.isArray(v)) throw new Error("unexpected_summary");
    return v as SummaryRow[];
  }, [tick]);
  if (!q.data?.length) return null;
  return (
    <section className="mb-5 overflow-x-auto" aria-label="Bildirim özeti">
      <h3 className="mb-2 font-bold">Yer ve gerekçeye göre özet</h3>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr><th className="py-2">Yer</th><th>Kademe / yıl</th><th>Gerekçe</th><th>Toplam</th><th>İnceleme bekliyor</th><th>Doğrulandı</th><th>Kapatıldı</th></tr>
        </thead>
        <tbody>
          {q.data.map((r) => (
            <tr key={`${r.place_id}:${r.stage}:${r.academic_year}:${r.reason}`} className="border-t border-violet-100">
              <td className="py-2">{r.place_name}</td>
              <td>{r.stage} · {r.academic_year}</td>
              <td>{reasonText[r.reason]}</td>
              <td>{r.open + r.verified + r.dismissed}</td>
              <td>{r.reason === "school_calendar" ? r.open : "—"}</td>
              <td>{r.reason === "school_calendar" ? r.verified : "—"}</td>
              <td>{r.reason === "school_calendar" ? r.dismissed : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-sm">
        Yalnız “Okul takvimi farklı” bildirimleri incelenir; diğer gerekçeler velinin kendi kararıdır ve sayı olarak gösterilir.
      </p>
    </section>
  );
}
