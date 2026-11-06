import { useState } from "react";
import { Card, Layout, Notice } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { useSupportQuery } from "@/lib/use-support-query";
import { type CannedLocale, type CannedReply, cannedError, loadCannedReplies, saveCannedReply } from "@/lib/support-ops";

/**
 * C07 / B04: hazır destek yanıtları — TR/EN, destek ekibi tarafından yönetilir.
 * Her kayıt sürümlüdür: başka bir ekip üyesi değiştirdiyse eski formdan kayıt reddedilir.
 * Arşivlenen yanıt görüşme yardımcılarında görünmez, burada geri alınabilir.
 * Aynı form yeniden gönderilirse (ağ hatası) aynı istek kimliği kullanılır, ikinci kayıt oluşmaz.
 */
const categoryNames: Record<string, string> = {
  account: "Hesap",
  device: "Cihaz",
  learning: "Öğrenme",
  billing: "Paket ve ödeme",
  other: "Diğer",
};
type Form = {
  request: string;
  id: string | null;
  revision: number | null;
  title: string;
  body: string;
  categories: string[];
  position: number;
  archived: boolean;
};
const blank = (): Form => ({
  request: crypto.randomUUID(),
  id: null,
  revision: null,
  title: "",
  body: "",
  categories: [],
  position: 100,
  archived: false,
});

export default function SupportRepliesPage() {
  const { session } = useAuth();
  return (
    <Layout title="Hazır yanıtlar" support>
      {session ? <Editor key={session.user.id} /> : null}
    </Layout>
  );
}

function Editor() {
  const [locale, setLocale] = useState<CannedLocale>("tr");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const list = useSupportQuery(() => loadCannedReplies(locale, null, true), `canned-admin:${locale}`);
  const valid = !!form && form.title.trim().length >= 2 && form.title.trim().length <= 80 &&
    form.body.trim().length >= 5 && form.body.trim().length <= 2000;

  const edit = (r: CannedReply) =>
    setForm({
      request: crypto.randomUUID(),
      id: r.id,
      revision: r.revision,
      title: r.title,
      body: r.body,
      categories: r.categories,
      position: r.position,
      archived: r.archived,
    });

  async function save(next: Form) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await saveCannedReply({
        request: next.request,
        id: next.id,
        expectedRevision: next.revision,
        locale,
        title: next.title,
        body: next.body,
        categories: next.categories,
        position: next.position,
        archived: next.archived,
      });
      setForm(null);
      setMessage({ tone: "ok", text: res.archived ? "Yanıt arşivlendi; görüşmelerde artık önerilmez." : "Hazır yanıt kaydedildi." });
      list.reload();
    } catch (e) {
      // İstek kimliği korunur: aynı form yeniden gönderilirse sunucu kayıtlı sonucu döndürür.
      setMessage({ tone: "error", text: cannedError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(r: CannedReply) {
    await save({
      request: crypto.randomUUID(),
      id: r.id,
      revision: r.revision,
      title: r.title,
      body: r.body,
      categories: r.categories,
      position: r.position,
      archived: !r.archived,
    });
  }

  const rows = list.data?.replies ?? [];
  return (
    <div className="grid gap-4" data-testid="canned-admin">
      <p className="max-w-3xl text-slate-600">
        Görüşmelerde &quot;Aileye yanıt&quot; taslağına eklenen kısa metinler. Ailenin diline göre Türkçe veya İngilizce
        sürüm önerilir; gönderilmeden önce düzenlenebilir. Çocuk adı, puan veya kişisel bilgi yazmayın.
      </p>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Yanıt dili">
        {(["tr", "en"] as const).map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={locale === l}
            className={locale === l ? "btn" : "btn-secondary"}
            onClick={() => {
              setLocale(l);
              setForm(null);
              setMessage(null);
            }}
          >
            {l === "tr" ? "Türkçe" : "English"}
          </button>
        ))}
        <button className="btn-secondary" disabled={!!form} onClick={() => setForm(blank())}>Yeni hazır yanıt</button>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {list.error ? <Notice tone="error">Hazır yanıtlar okunamadı. Yeniden deneyin.</Notice> : null}
      {form
        ? (
          <Card title={form.id ? "Hazır yanıtı düzenle" : "Yeni hazır yanıt"}>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) void save(form);
              }}
            >
              <label className="label">
                Başlık ({locale === "tr" ? "Türkçe" : "English"})
                <input className="input mt-1" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="label">
                Metin
                <textarea className="input mt-1 min-h-32" maxLength={2000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </label>
              <fieldset>
                <legend className="label">Önerildiği kategoriler (boşsa hepsi)</legend>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(categoryNames).map(([k, v]) => (
                    <label key={k} className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.categories.includes(k)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            categories: e.target.checked ? [...form.categories, k] : form.categories.filter((c) => c !== k),
                          })}
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="label max-w-40">
                Sıra
                <input className="input mt-1" type="number" min={0} max={1000} value={form.position} onChange={(e) => setForm({ ...form, position: Math.max(0, Math.min(1000, +e.target.value || 0)) })} />
              </label>
              <div className="flex flex-wrap gap-3">
                <button className="btn" type="submit" disabled={busy || !valid}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
                <button className="btn-secondary" type="button" disabled={busy} onClick={() => setForm(null)}>Vazgeç</button>
              </div>
            </form>
          </Card>
        )
        : null}
      <Card>
        {!list.data && !list.error ? <p className="text-slate-500">Yükleniyor…</p> : null}
        {list.data && !rows.length ? <p className="text-slate-500">Bu dilde hazır yanıt yok.</p> : null}
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id} data-testid="canned-row" data-archived={r.archived} className={"rounded-xl border p-4 " + (r.archived ? "border-slate-200 bg-slate-50 text-slate-500" : "border-violet-100")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{r.title}{r.archived ? " · arşivde" : ""}</p>
                  <p className="text-xs text-slate-500">
                    {r.categories.length ? r.categories.map((c) => categoryNames[c] ?? c).join(", ") : "Bütün kategoriler"} · sıra {r.position} · sürüm {r.revision}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{r.body}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" disabled={busy || !!form} onClick={() => edit(r)}>Düzenle</button>
                  <button className="btn-secondary" disabled={busy || !!form} onClick={() => void toggleArchive(r)}>
                    {r.archived ? "Geri al" : "Arşivle"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
