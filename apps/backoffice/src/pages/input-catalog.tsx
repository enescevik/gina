import { type FormEvent, useEffect, useState } from "react";
import type { Tables } from "@gina/core";
import { Card, Layout, Notice } from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";

type Option = Tables<"guided_input_options">;
const kinds = {
  bag: "Çanta eşyaları",
  homework: "Ödev başlıkları",
  study: "Çalışma başlıkları",
  course: "Kurs ve etkinlik",
  subject: "Dersler",
  topic: "Konular",
  step: "Çalışma adımları",
};
const empty = (): Option => ({
  id: "",
  kind: "bag",
  label_tr: "",
  label_en: "",
  subject: "",
  min_grade: 1,
  max_grade: 12,
  position: 0,
  active: true,
  revision: 0,
  updated_at: "",
});
export default function InputCatalog() {
  const q = useAdminQuery(async () =>
    unwrap(
      await supabase().from("guided_input_options").select("*").order(
        "position",
      ).order("id"),
    )
  );
  const [kind, setKind] = useState("bag"),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState<Option | null>(null),
    [original, setOriginal] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const dirty = !!draft && JSON.stringify(draft) !== original;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function edit(o: Option) {
    setDraft({ ...o });
    setOriginal(JSON.stringify(o));
    setError("");
    setMessage("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    try {
      const { id, revision, updated_at: _, ...value } = draft;
      void _;
      const r = await supabase().rpc("admin_save_guided_input", {
        p_id: id,
        p_revision: revision,
        p_value: value,
      });
      if (r.error) throw r.error;
      setDraft(null);
      setMessage(
        "Seçenek kaydedildi. Önceden kaydedilmiş kullanıcı metinleri korunur.",
      );
      q.reload();
    } catch (e) {
      setError(
        (e as { message?: string })?.message === "catalog_changed"
          ? "Bu seçenek başka bir yönetici tarafından değiştirildi. Taslağını not edip güncel kaydı yeniden aç."
          : "Kaydedilemedi. Alanları kontrol edip yeniden deneyin.",
      );
    } finally {
      setBusy(false);
    }
  }
  const visible = (q.data ?? []).filter((o) =>
    o.kind === kind &&
    `${o.label_tr} ${o.label_en} ${o.id}`.toLocaleLowerCase("tr").includes(
      search.toLocaleLowerCase("tr"),
    )
  );
  return (
    <Layout title="Hazır seçenekler">
      <Card title="Yazmak yerine seçmek">
        <p>
          Çanta, ödev ve çalışma ekranlarında sunulan seçenekleri yönetin. Sınıf
          aralığı çocuğun kayıtlı sınıfına göre uygulanır. Pasifleştirme eski
          kayıtları silmez. Her seçenek sabit kimliğiyle raporlanabilir; görünen
          metin geçmiş kayıtlarda korunur.
        </p>
      </Card>
      {message ? <Notice>{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {draft
        ? (
          <Card title={draft.revision ? "Seçeneği düzenle" : "Yeni seçenek"}>
            <form
              onSubmit={(e) => void save(e)}
              className="grid gap-4 sm:grid-cols-2"
            >
              <label>
                Sabit kimlik<input
                  className="input mt-2 w-full"
                  value={draft.id}
                  required
                  pattern="[a-z][a-z0-9_-]{2,79}"
                  maxLength={80}
                  disabled={busy || draft.revision > 0}
                  onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                />
                <span className="text-sm">
                  Örnek: bag-pencil. Kaydettikten sonra değişmez.
                </span>
              </label>
              <label>
                Tür<select
                  className="input mt-2 w-full"
                  value={draft.kind}
                  disabled={busy || draft.revision > 0}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                >
                  {Object.entries(kinds).map(([id, title]) => (
                    <option key={id} value={id}>{title}</option>
                  ))}
                </select>
              </label>
              {([["label_tr", "Türkçe metin"], [
                "label_en",
                "İngilizce metin",
              ]] as const).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    className="input mt-2 w-full"
                    required
                    maxLength={80}
                    disabled={busy}
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })}
                  />
                </label>
              ))}
              {draft.kind === "topic"
                ? (
                  <label>
                    Ders ilişkisi<select
                      className="input mt-2 w-full"
                      value={draft.subject}
                      disabled={busy}
                      onChange={(e) =>
                        setDraft({ ...draft, subject: e.target.value })}
                    >
                      <option value="">Tüm dersler</option>
                      {(q.data ?? []).filter((o) => o.kind === "subject").map(
                        (o) => (
                          <option key={o.id} value={o.id}>{o.label_tr}</option>
                        ),
                      )}
                    </select>
                    <span className="text-sm">
                      Konu önerileri seçilen derste gösterilir.
                    </span>
                  </label>
                )
                : null}
              <label>
                İlk sınıf<select
                  className="input mt-2 w-full"
                  value={draft.min_grade}
                  disabled={busy}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setDraft({
                      ...draft,
                      min_grade: n,
                      max_grade: Math.max(n, draft.max_grade),
                    });
                  }}
                >
                  {Array.from(
                    { length: 12 },
                    (_, i) => (
                      <option key={i} value={i + 1}>{i + 1}. sınıf</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Son sınıf<select
                  className="input mt-2 w-full"
                  value={draft.max_grade}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({ ...draft, max_grade: Number(e.target.value) })}
                >
                  {Array.from(
                    { length: 13 - draft.min_grade },
                    (_, i) => (
                      <option key={i} value={i + draft.min_grade}>
                        {i + draft.min_grade}. sınıf
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Sıra<input
                  className="input mt-2 w-full"
                  type="number"
                  min={0}
                  max={1000}
                  value={draft.position}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({ ...draft, position: Number(e.target.value) })}
                />
              </label>
              <label className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  checked={draft.active}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({ ...draft, active: e.target.checked })}
                />Kullanıcılara göster
              </label>
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button className="btn" disabled={busy || !dirty}>
                  {busy ? "Kaydediliyor…" : "Kaydet"}
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  Taslağı kapat
                </button>
              </div>
            </form>
          </Card>
        )
        : (
          <Card title="Seçenek kataloğu">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label>
                Tür<select
                  className="input mt-2"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  {Object.entries(kinds).map(([id, title]) => (
                    <option key={id} value={id}>{title}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 flex-1">
                Ara<input
                  className="input mt-2 w-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Seçenek adı"
                />
              </label>
              <button
                className="btn"
                onClick={() => edit({ ...empty(), kind })}
              >
                Seçenek ekle
              </button>
            </div>
            {q.loading ? <p>Yükleniyor…</p> : q.error
              ? (
                <Notice tone="error">
                  Katalog yüklenemedi.{" "}
                  <button className="btn-secondary" onClick={q.reload}>
                    Yeniden dene
                  </button>
                </Notice>
              )
              : !visible.length
              ? (
                <p>
                  Bu görünümde seçenek yok. Yeni bir seçenek ekleyebilirsiniz.
                </p>
              )
              : null}
            <div className="grid gap-3 md:grid-cols-2">
              {visible.map((o) => (
                <div
                  key={o.id}
                  className="rounded-2xl border border-violet-100 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-bold">{o.label_tr}</h3>
                      <p className="break-words text-sm">{o.label_en}</p>
                      <p className="mt-2 text-sm">
                        {o.min_grade}–{o.max_grade}. sınıf ·{" "}
                        {o.active ? "Gösteriliyor" : "Gizli"}
                      </p>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => edit(o)}
                      aria-label={`${o.label_tr} seçeneğini düzenle`}
                    >
                      Düzenle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
    </Layout>
  );
}
