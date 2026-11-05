import { useEffect, useRef, useState } from "react";
import {
  EDUCATION_STAGES,
  educationPlaceLabel,
  type EducationPlace,
  type Json,
} from "@gina/core";
import { Card, Layout, Notice } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useUnsavedChanges } from "@/components/unsaved-changes";
const stages = {
  preschool: "Okul öncesi",
  primary: "İlkokul",
  middle: "Ortaokul",
  high: "Lise",
  university: "Üniversite",
};
type Draft = {
  created_at?: string;
  id: string;
  revision: number;
  title: string;
  body: string;
  place_id: string | null;
  stage: keyof typeof stages | null;
  push: boolean;
  expires_on: string;
  status: string;
  recipient_count: number | null;
};
type Preview = { count: number; fingerprint: string };
type Data = {
  rows: Draft[];
  total: number;
  places: EducationPlace[];
  settings: {
    revision: number;
    reminders_enabled: boolean;
    scheduler_available: boolean;
  };
};
export default function Announcements() {
  const { session } = useAuth();
  return (
    <Layout title="Aile duyuruları" release>
      {session && <Workspace key={session.user.id} />}
    </Layout>
  );
}
function Workspace() {
  const [dateBounds] = useState(() => ({
    min: new Date().toISOString().slice(0, 10),
    max: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  }));
  const [before, setBefore] = useState<{ at: string; id: string } | null>(null);
  const [data, setData] = useState<Data | null>(null),
    [tick, setTick] = useState(0),
    [draft, setDraft] = useState<Draft | null>(null),
    [original, setOriginal] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [withdraw, setWithdraw] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false),
    pending = useRef<{ key: string; id: string } | null>(null);
  const dirty = !!draft && JSON.stringify(draft) !== original;
  const guard = useUnsavedChanges(dirty, busy);
  useEffect(() => {
    let live = true;
    void supabase()
      .rpc(
        "admin_announcements",
        before ? { p_before: before.at, p_before_id: before.id } : {},
      )
      .then((r) => {
        if (!live) return;
        if (r.error) setError("Duyurular yüklenemedi. Yeniden deneyin.");
        else setData(r.data as unknown as Data);
      });
    return () => {
      live = false;
    };
  }, [tick, before]);
  function request(value: unknown) {
    const key = JSON.stringify(value);
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    return pending.current!.id;
  }
  function edit(row: Draft) {
    setDraft({ ...row });
    setOriginal(JSON.stringify(row));
    setPreview(null);
    setConfirmed(false);
    setMessage("");
  }
  function change(update: Partial<Draft>) {
    if (draft) setDraft({ ...draft, ...update });
    setPreview(null);
    setConfirmed(false);
  }
  async function run(
    call: () => PromiseLike<{ error: unknown; data: unknown }>,
    done: (v: unknown) => void,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await call();
      if (r.error) throw r.error;
      done(r.data);
    } catch (e) {
      const m = (e as { message?: string }).message ?? "";
      setError(
        m.includes("audience_changed")
          ? "Alıcılar değişti. Hedef kitleyi yeniden önizleyip onaylayın."
          : m.includes("audience_limit")
            ? "Gönderim için 1–5000 alıcı gerekir. Kapsamı daraltıp önizlemeyi yenileyin."
            : m.includes("changed")
              ? "Bu kayıt değişti. Güncel kaydı yeniden açın."
              : m.includes("scheduler")
                ? "Zamanlayıcı hazır değil. Hatırlatmalar etkinleştirilmedi."
                : "İşlem tamamlanamadı. Bilgileri kontrol edip yeniden deneyin.",
      );
      setPreview(null);
      setConfirmed(false);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function saved() {
    pending.current = null;
    setDraft(null);
    setWithdraw(null);
    setPreview(null);
    setTick((x) => x + 1);
    setBefore(null);
  }
  const placeLabel = (id: string | null) => {
    const p = data?.places.find((x) => x.id === id);
    return p ? educationPlaceLabel(p, data!.places) : "Tüm bölgeler";
  };
  return (
    <>
      {guard.dialog}
      <Card title="Doğru aileye, doğru zamanda">
        <p>
          Okul, bölge ve eğitim kademesine göre hizmet duyurusu hazırlayın. Aynı
          velinin birden çok çocuğu eşleşse de tek duyuru oluşur. Hedefleme,
          velinin seçtiği okul/bölge bilgisine dayanır; cihaz konumu
          kullanılmaz.
        </p>
        <p className="mt-3 text-sm">
          Uygulama içi duyuru her zaman bulunur. Push yalnız veli tercihleri ve
          cihaz izni uygunsa iletilir. SMS ve e-posta, gönderim hizmeti ve kanal
          izinleri kurulana kadar kapalıdır; gönderilmiş sayılmaz.
        </p>
      </Card>
      {error && (
        <Notice tone="error">
          {error}{" "}
          <button
            className="btn-secondary"
            onClick={() => setTick((x) => x + 1)}
          >
            Yeniden yükle
          </button>
        </Notice>
      )}
      {message && <Notice>{message}</Notice>}
      {!data && !error && <p>Yükleniyor…</p>}
      {!draft && (
        <>
          <Card title="Duyuru hazırlığı">
            <button
              className="btn mb-4"
              onClick={() =>
                edit({
                  id: crypto.randomUUID(),
                  revision: 0,
                  title: "",
                  body: "",
                  place_id: null,
                  stage: null,
                  push: true,
                  expires_on: new Date(Date.now() + 7 * 86400000)
                    .toISOString()
                    .slice(0, 10),
                  status: "draft",
                  recipient_count: null,
                })
              }
            >
              Duyuru oluştur
            </button>
            {!data?.rows.length && (
              <p>
                Henüz duyuru yok. Taslak oluşturmak ailelere bildirim göndermez.
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {data?.rows.map((row) => (
                <article
                  key={row.id}
                  className="rounded-3xl border border-violet-100 bg-white p-5"
                >
                  <p className="text-sm">
                    {placeLabel(row.place_id)} ·{" "}
                    {row.stage ? stages[row.stage] : "Tüm kademeler"}
                  </p>
                  <h3 className="my-2 font-bold">{row.title}</h3>
                  <p>
                    {row.status === "draft"
                      ? "Taslak"
                      : row.status === "published"
                        ? `${row.recipient_count} veliye uygulama içi duyuru oluşturuldu`
                        : "Geri çekildi"}
                  </p>
                  <p className="text-sm">
                    Son görünme tarihi: {row.expires_on}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {row.status === "draft" && (
                      <button
                        className="btn-secondary"
                        onClick={() => edit(row)}
                      >
                        Düzenle / önizle
                      </button>
                    )}
                    {row.status !== "withdrawn" && (
                      <button
                        className="btn-secondary"
                        onClick={() => setWithdraw(row)}
                      >
                        {row.status === "draft"
                          ? "Taslağı kaldır"
                          : "Yayından çek"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {data && data.total > 30 && (
              <p className="mt-3 text-sm">
                Bu sayfada en fazla 30 kayıt gösterilir; toplam {data.total}{" "}
                kayıt var.
              </p>
            )}
          </Card>
          <div className="mb-5 flex flex-wrap gap-3">
            {before && (
              <button className="btn-secondary" onClick={() => setBefore(null)}>
                En yeni duyurular
              </button>
            )}
            {data?.rows.length === 30 && (
              <button
                className="btn-secondary"
                onClick={() => {
                  const last = data.rows.at(-1);
                  if (last?.created_at)
                    setBefore({ at: last.created_at, id: last.id });
                }}
              >
                Daha eski duyurular
              </button>
            )}
          </div>
          <Card title="Eğitim yılı hatırlatmaları">
            <p>
              Doğrulanmış takvim başladığında eğitim kaydı eski kalan veliye;
              yıl sonunda ise geçmişini gözden geçirmesi için haber verilir.
              Sınıf kendiliğinden değişmez. Her çocuk/yıl/sınır için bir kez
              oluşturulur.
            </p>
            <p className="my-3 font-bold">
              {data?.settings.reminders_enabled
                ? "Otomatik hatırlatmalar açık"
                : "Otomatik hatırlatmalar kapalı"}
            </p>
            {!data?.settings.scheduler_available && (
              <p className="mb-3 text-sm">
                Bu ortamda zamanlayıcı hazır değil. Etkinleştirme yapılmaz.
              </p>
            )}
            <button
              className="btn-secondary"
              disabled={busy || !data || !data.settings.scheduler_available}
              onClick={() => {
                if (!data) return;
                const args = {
                  p_revision: data.settings.revision,
                  p_enabled: !data.settings.reminders_enabled,
                };
                void run(
                  () =>
                    supabase().rpc("admin_education_reminder_settings", {
                      ...args,
                      p_request: request(args),
                    }),
                  () => {
                    saved();
                    setMessage("Hatırlatma tercihi kaydedildi.");
                  },
                );
              }}
            >
              {data?.settings.reminders_enabled
                ? "Hatırlatmaları kapat"
                : "Doğrulanan takvimler için hatırlatmaları aç"}
            </button>
          </Card>
        </>
      )}
      {withdraw && (
        <Card
          title={
            withdraw.status === "draft"
              ? "Taslağı kaldır"
              : "Duyuruyu yayından çek"
          }
        >
          <p>
            <strong>{withdraw.title}</strong> gelen kutusunda artık
            görünmeyecek. Henüz gönderilmemiş push işleri durdurulacak.
            Sağlayıcının daha önce kabul ettiği telefon bildirimi geri alınamaz.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                const args = {
                  p_id: withdraw.id,
                  p_revision: withdraw.revision,
                };
                void run(
                  () =>
                    supabase().rpc("admin_withdraw_announcement", {
                      ...args,
                      p_request: request(args),
                    }),
                  () => {
                    saved();
                    setMessage("Duyuru kaldırıldı.");
                  },
                );
              }}
            >
              Kaldırmayı onayla
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => setWithdraw(null)}
            >
              Vazgeç
            </button>
          </div>
        </Card>
      )}
      {draft && (
        <Card title="1. İçerik ve hedef kitle">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const {
                id,
                revision,
                title,
                body,
                place_id,
                stage,
                push,
                expires_on,
              } = draft;
              const args = {
                p_id: id,
                p_revision: revision,
                p_value: {
                  title,
                  body,
                  place_id,
                  stage,
                  push,
                  expires_on,
                } as Json,
              };
              void run(
                () =>
                  supabase().rpc("admin_save_announcement", {
                    ...args,
                    p_request: request(args),
                  }),
                (v) => {
                  const next = {
                    ...draft,
                    revision: (v as { revision: number }).revision,
                  };
                  edit(next);
                  setTick((x) => x + 1);
                  setMessage("Taslak kaydedildi. Henüz kimseye gönderilmedi.");
                  pending.current = null;
                },
              );
            }}
          >
            <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                Başlık
                <input
                  className="input mt-2 w-full"
                  required
                  minLength={3}
                  maxLength={160}
                  value={draft.title}
                  onChange={(e) => change({ title: e.target.value })}
                />
              </label>
              <label className="md:col-span-2">
                Aileye gösterilecek mesaj
                <textarea
                  className="input mt-2 min-h-40 w-full"
                  required
                  minLength={10}
                  maxLength={4000}
                  value={draft.body}
                  onChange={(e) => change({ body: e.target.value })}
                  placeholder="Örn. İl genelinde yarın eğitime ara verildi. Kaynak: Valilik duyurusu. Uygulamadaki planı değiştirmeden önce okulunuzun açıklamasını kontrol edin."
                />
              </label>
              <label>
                Bölge veya okul
                <select
                  className="input mt-2 w-full"
                  aria-label="Bölge veya okul"
                  value={draft.place_id ?? ""}
                  onChange={(e) => change({ place_id: e.target.value || null })}
                >
                  <option value="">Tüm bölgeler</option>
                  {data?.places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {educationPlaceLabel(p, data.places)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Eğitim kademesi
                <select
                  className="input mt-2 w-full"
                  aria-label="Eğitim kademesi"
                  value={draft.stage ?? ""}
                  onChange={(e) =>
                    change({
                      stage: (e.target.value as Draft["stage"]) || null,
                    })
                  }
                >
                  <option value="">Tüm kademeler</option>
                  {EDUCATION_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {stages[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Son görünme tarihi
                <input
                  className="input mt-2 w-full"
                  type="date"
                  required
                  min={dateBounds.min}
                  max={dateBounds.max}
                  value={draft.expires_on}
                  onChange={(e) => change({ expires_on: e.target.value })}
                />
              </label>
              <label className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  checked={draft.push}
                  onChange={(e) => change({ push: e.target.checked })}
                />
                Telefon bildirimi de gönder
              </label>
              <div className="flex flex-wrap gap-3 md:col-span-2">
                <button className="btn" disabled={!dirty}>
                  Taslağı kaydet
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={dirty || !draft.revision}
                  onClick={() =>
                    void run(
                      () =>
                        supabase().rpc("admin_preview_announcement", {
                          p_id: draft.id,
                          p_revision: draft.revision,
                        }),
                      (v) => {
                        setPreview(v as Preview);
                        setConfirmed(false);
                      },
                    )
                  }
                >
                  2. Alıcıları önizle
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => guard.request(() => setDraft(null))}
                >
                  Kapat
                </button>
              </div>
            </fieldset>
          </form>
          {preview && (
            <section className="mt-6 rounded-3xl bg-[#EEE8FA] p-6">
              <h3 className="text-xl font-bold">
                3. Son kontrol · {preview.count} veli
              </h3>
              <p className="my-3">
                {placeLabel(draft.place_id)} ·{" "}
                {draft.stage ? stages[draft.stage] : "Tüm kademeler"}
              </p>
              <article className="rounded-3xl bg-[#FCFAF6] p-5">
                <h4 className="font-bold">{draft.title}</h4>
                <p className="mt-3 whitespace-pre-wrap break-words">
                  {draft.body}
                </p>
              </article>
              <p className="my-3 text-sm">
                {draft.push
                  ? "Uygulama içi + izinli cihazlara push. Push kabulü, okunma anlamına gelmez."
                  : "Yalnız uygulama içi duyuru."}{" "}
                Mesaj çocuğun görevlerini veya ders programını değiştirmez.
              </p>
              <label className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Kaynağı, mesajı ve hedef kitleyi kontrol ettim.
              </label>
              <button
                className="btn mt-3"
                disabled={
                  busy ||
                  !confirmed ||
                  preview.count < 1 ||
                  preview.count > 5000
                }
                onClick={() => {
                  const args = {
                    p_id: draft.id,
                    p_revision: draft.revision,
                    p_fingerprint: preview.fingerprint,
                    p_confirmed: true,
                  };
                  void run(
                    () =>
                      supabase().rpc("admin_publish_announcement", {
                        ...args,
                        p_request: request(args),
                      }),
                    () => {
                      saved();
                      setMessage(
                        "Uygulama içi duyurular oluşturuldu. Telefon bildirimlerinin durumunu Bildirim teslimi bölümünden izleyebilirsiniz.",
                      );
                    },
                  );
                }}
              >
                Onayladığım {preview.count} veliye gönder
              </button>
            </section>
          )}
        </Card>
      )}
    </>
  );
}
