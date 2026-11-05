import { useRef, useState } from "react";
import { Card, Notice } from "@/components/Layout";
import { s04Rpc } from "@/components/s04-rpc";
import bundledSeed from "../../../../docs/learning/catalog/education-calendars/tr-2026-2027.json";

/**
 * S04 kaynaklı takvim tohumu: önce sunucu önizlemesi (yazmaz), sonra açık onayla yalnız TASLAK
 * oluşturma. Yayın, takvim kartındaki ayrı "Yayın önizlemesi" adımıdır; burada yapılmaz.
 */
const stages: Record<string, string> = {
  preschool: "Okul öncesi",
  primary: "İlkokul",
  middle: "Ortaokul",
  high: "Lise",
  university: "Üniversite",
};
const confidence: Record<string, string> = {
  high: "yüksek",
  medium: "orta",
  low: "düşük",
};
const reasons: Record<string, string> = {
  low_confidence: "Kaynak güveni düşük; il MEM teyidi bekliyor",
  no_calendar_value: "Doğrulanmış tarih yok",
  scope: "Yıl veya kademe uyuşmuyor",
  place: "Kapsam bulunamadı",
  calendar_value: "Tarihler doğrulamadan geçmedi",
};
type SeedRecord = {
  seed_id: string;
  place_kind: string | null;
  place_name: string | null;
  place_state: string;
  stage: string | null;
  confidence: string | null;
  action: "create" | "exists" | "skip" | "invalid";
  reason: string | null;
  title: string | null;
  source_url: string | null;
  verified_on: string | null;
  checked_at: string | null;
  terms: number;
  starts_on: string | null;
  ends_on: string | null;
};
type Result = {
  executed: boolean;
  published: false;
  academic_year: number;
  checked_at: string | null;
  counts: {
    create: number;
    exists: number;
    skipped: number;
    invalid: number;
    new_places: number;
  };
  records: SeedRecord[];
  sources: {
    id: string | null;
    title: string | null;
    url: string;
    published_at: string | null;
    accessed_at: string | null;
  }[];
};
/** Sunucu yanıtı beklenen biçimde değilse (ör. yayımlandı diyorsa) ekrana hiç yansıtılmaz. */
function readResult(value: unknown): Result {
  const r = value as Result;
  if (
    !r || typeof r !== "object" || r.published !== false ||
    typeof r.counts?.create !== "number" || !Array.isArray(r.records) ||
    !Array.isArray(r.sources)
  ) throw new Error("unexpected_seed_result");
  return r;
}
type Seed = { schema?: string; academic_year?: number; calendars?: unknown[] };

export function CalendarSeedImport({ onDone }: { onDone: () => void }) {
  const [seed, setSeed] = useState<{ name: string; value: Seed }>({
    name: "tr-2026-2027.json (depodaki doğrulanmış tohum)",
    value: bundledSeed as Seed,
  });
  const [preview, setPreview] = useState<Result | null>(null),
    [done, setDone] = useState<Result | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<string | null>(null);
  const lock = useRef(false);

  async function call(execute: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      // Aynı onay tekrarında aynı istek kimliği: kayıp yanıtta çift kayıt oluşmaz.
      if (execute && !request.current) request.current = crypto.randomUUID();
      const r = readResult(
        await s04Rpc("admin_import_education_calendar_seed", {
          p_request: execute ? request.current : null,
          p_seed: seed.value,
          p_execute: execute,
        }),
      );
      if (execute) {
        setDone(r);
        setPreview(null);
        setConfirmed(false);
        request.current = null;
        onDone();
      } else {
        setPreview(r);
        setDone(null);
      }
    } catch (e) {
      const m = (e as { message?: string }).message ?? "";
      setError(
        m.includes("seed_invalid")
          ? "Dosya tanınan takvim tohumu biçiminde değil (gina.education-calendar-seed.v1)."
          : m.includes("forbidden")
          ? "Bu işlem için içerik yetkisi gerekir."
          : "İşlem tamamlanamadı. Bağlantıyı kontrol edip yeniden deneyin; aynı onay iki kez kayıt oluşturmaz.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const value = JSON.parse(await file.text()) as Seed;
      setSeed({ name: file.name, value });
      setPreview(null);
      setDone(null);
      setConfirmed(false);
      request.current = null;
    } catch {
      setError("Dosya okunamadı. JSON biçiminde bir takvim tohumu seçin.");
    }
  }

  const shown = done ?? preview;
  const groups = new Map<string, SeedRecord[]>();
  for (const r of shown?.records ?? []) {
    const key = `${r.place_name ?? "?"}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return (
    <Card title="Taslak içe aktar (kaynaklı)">
      <p>
        Doğrulanmış kaynak dosyasından eksik takvimleri <strong>taslak</strong>{" "}
        olarak oluşturur. Var olan takvimlere dokunmaz, hiçbir takvimi
        yayımlamaz. Güveni düşük kayıtlar atlanır. Yeni il kayıtları gizli
        açılır; velilere görünmeleri ve yayın ayrı adımlardır.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <p className="min-w-0 flex-1 break-words text-sm">
          Kaynak dosya: <strong>{seed.name}</strong>
          {seed.value.academic_year
            ? ` · ${seed.value.academic_year}–${seed.value.academic_year + 1}`
            : ""}
        </p>
        <label className="btn-secondary cursor-pointer">
          Başka dosya seç
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={busy}
            onChange={(e) => void chooseFile(e.target.files?.[0])}
          />
        </label>
        <button
          className="btn"
          disabled={busy}
          onClick={() => void call(false)}
        >
          {busy && !confirmed ? "Hazırlanıyor…" : "Önizle"}
        </button>
      </div>
      {error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : null}
      {done
        ? (
          <div className="mt-4">
            <Notice tone="ok">
              {done.counts.create} taslak oluşturuldu, hiçbiri yayımlanmadı.
              {done.counts.new_places
                ? ` ${done.counts.new_places} il gizli olarak eklendi.`
                : ""}{" "}
              Yayımlamak için Takvimler sekmesinde ilgili kartı açıp kaynağı
              doğruladıktan sonra yayın önizlemesini kullanın.
            </Notice>
          </div>
        )
        : null}
      {shown
        ? (
          <>
            <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
              {([
                ["Oluşturulacak taslak", shown.counts.create],
                ["Zaten var (dokunulmaz)", shown.counts.exists],
                ["Atlanan", shown.counts.skipped],
                ["Geçersiz", shown.counts.invalid],
                ["Yeni gizli il", shown.counts.new_places],
              ] as const).map(([label, n]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-violet-100 bg-white p-3"
                >
                  <dt className="text-sm">
                    {done && label === "Oluşturulacak taslak"
                      ? "Oluşturulan taslak"
                      : label}
                  </dt>
                  <dd className="text-2xl font-bold">{n}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-6 font-bold">Kayıtlar</h3>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {[...groups].map(([place, rows]) => (
                <article
                  key={place}
                  className="rounded-3xl border border-violet-100 bg-white p-4"
                >
                  <h4 className="font-bold">
                    {place}
                    {rows[0]?.place_state === "create_inactive"
                      ? " · yeni, gizli açılacak"
                      : rows[0]?.place_state === "existing_inactive"
                      ? " · gizli"
                      : ""}
                  </h4>
                  <p className="text-sm">
                    Kaynak güveni:{" "}
                    {confidence[rows[0]?.confidence ?? ""] ?? "—"} · Kontrol:{" "}
                    {rows[0]?.verified_on ?? rows[0]?.checked_at ?? "—"}
                  </p>
                  <ul className="mt-2 text-sm">
                    {rows.map((r) => (
                      <li key={`${r.seed_id}-${r.stage}`} className="py-1">
                        {stages[r.stage ?? ""] ?? r.stage}:{" "}
                        {r.action === "create"
                          ? `${done ? "taslak oluşturuldu" : "taslak oluşturulacak"} · ${r.starts_on} – ${r.ends_on} · ${r.terms} parça`
                          : r.action === "exists"
                          ? "zaten var, dokunulmaz"
                          : r.action === "skip"
                          ? `atlandı — ${reasons[r.reason ?? ""] ?? r.reason}`
                          : `geçersiz — ${reasons[r.reason ?? ""] ?? r.reason}`}
                      </li>
                    ))}
                  </ul>
                  {rows[0]?.source_url
                    ? (
                      <a
                        className="mt-2 block break-all text-sm text-[#6042DE] underline"
                        href={rows[0].source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Kaynak bağlantısı
                      </a>
                    )
                    : null}
                </article>
              ))}
            </div>
            <details className="mt-5">
              <summary className="min-h-12 cursor-pointer py-3 font-bold">
                Kaynaklar ({shown.sources.length}) · kontrol tarihi{" "}
                {shown.checked_at ?? "—"}
              </summary>
              <ul className="text-sm">
                {shown.sources.map((s) => (
                  <li key={s.url} className="border-b border-violet-100 py-2">
                    <a
                      className="break-all text-[#6042DE] underline"
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {s.title ?? s.url}
                    </a>
                    <span className="block">
                      Yayın: {s.published_at ?? "—"} · Erişim:{" "}
                      {s.accessed_at ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
            {preview && preview.counts.create > 0
              ? (
                <section className="mt-5 rounded-3xl border border-violet-200 bg-[#E7F5EF] p-5">
                  <label className="flex min-h-12 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={confirmed}
                      disabled={busy}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    <span>
                      Kaynakları kontrol ettim. {preview.counts.create} kayıt
                      yalnız taslak olarak oluşturulsun; hiçbir takvim
                      yayımlanmasın.
                    </span>
                  </label>
                  <button
                    className="btn mt-3"
                    disabled={busy || !confirmed}
                    onClick={() => void call(true)}
                  >
                    {busy && confirmed
                      ? "Oluşturuluyor…"
                      : `${preview.counts.create} taslağı oluştur (yayımlamaz)`}
                  </button>
                </section>
              )
              : preview
              ? (
                <p className="mt-5">
                  Oluşturulacak yeni taslak yok. Var olan kayıtlar
                  değiştirilmez.
                </p>
              )
              : null}
          </>
        )
        : null}
    </Card>
  );
}
