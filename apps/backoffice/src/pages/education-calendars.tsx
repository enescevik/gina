import { useEffect, useRef, useState } from "react";
import {
  EDUCATION_STAGES,
  DEFAULT_EDUCATION_PLACE,
  educationPlaceLabel,
  type Json,
  type EducationPlace,
  type SchoolCalendar,
  type SchoolCalendarValue,
} from "@gina/core";
import { Layout, Card, Notice } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { CalendarSeedImport } from "@/components/calendar-seed-import";
const stages = {
  preschool: "Okul öncesi",
  primary: "İlkokul",
  middle: "Ortaokul",
  high: "Lise",
  university: "Üniversite",
};
type Report = {
  id: string;
  place_id: string;
  academic_year: number;
  stage: keyof typeof stages;
  proposed_start: string;
  detail: string;
  revision: number;
  created_at: string;
};
type Data = {
  places: EducationPlace[];
  calendars: SchoolCalendar[];
  reports: Report[];
  open_reports: number;
};
export default function Calendars() {
  const { session } = useAuth();
  return (
    <Layout title="Eğitim takvimleri" content>
      {session && <Workspace key={session.user.id} />}
    </Layout>
  );
}
function Workspace() {
  const [data, setData] = useState<Data | null>(null),
    [tick, setTick] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<SchoolCalendar | null>(null),
    [original, setOriginal] = useState(""),
    [publish, setPublish] = useState(false),
    [tab, setTab] = useState("calendars");
  const [place, setPlace] = useState<EducationPlace | null>(null),
    [report, setReport] = useState<Report | null>(null),
    [note, setNote] = useState("");
  const pending = useRef<{ payload: string; id: string } | null>(null);
  const lock = useRef(false);
  const dirty =
    (!!draft && JSON.stringify(draft) !== original) || !!place || !!note;
  const guard = useUnsavedChanges(dirty, busy);
  useEffect(() => {
    let live = true;
    void supabase()
      .rpc("admin_education_calendars")
      .then((r) => {
        if (!live) return;
        if (r.error) setError("Takvimler yüklenemedi. Yeniden deneyin.");
        else setData(r.data as unknown as Data);
      });
    return () => {
      live = false;
    };
  }, [tick]);
  function edit(c: SchoolCalendar) {
    setDraft(structuredClone(c));
    setOriginal(JSON.stringify(c));
    setPublish(false);
    setMessage("");
  }
  function fresh() {
    const year = new Date().getFullYear();
    edit({
      id: crypto.randomUUID(),
      place_id: DEFAULT_EDUCATION_PLACE,
      stage: "primary",
      academic_year: year,
      revision: 0,
      published: null,
      published_revision: null,
      draft: {
        title: "",
        source_url: "",
        verified_on: new Date().toISOString().slice(0, 10),
        starts_on: "",
        ends_on: "",
        terms: [
          { title: "1. dönem", starts_on: "", ends_on: "" },
          { title: "2. dönem", starts_on: "", ends_on: "" },
        ],
      },
    });
  }
  function request(payload: unknown) {
    const key = JSON.stringify(payload);
    if (pending.current?.payload !== key)
      pending.current = { payload: key, id: crypto.randomUUID() };
    return pending.current!.id;
  }
  async function run(action: () => PromiseLike<{ error: unknown }>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await action();
      if (r.error) throw r.error;
      setDraft(null);
      setPlace(null);
      setReport(null);
      setNote("");
      pending.current = null;
      setTick((x) => x + 1);
      setMessage("İşlem kaydedildi.");
    } catch (e) {
      const m = (e as { message?: string }).message ?? "";
      setError(
        m.includes("changed")
          ? "Kayıt başka bir işlemle değişti. Taslağınızı koruyup güncel kaydı yeniden açın."
          : m.includes("in_use")
            ? "Bu bölge/okul kullanımda; önce bağlı kayıtları kontrol edin."
            : "Kaydedilemedi. Tarih sırasını, kaynak bağlantısını ve gerekli alanları kontrol edin; yeniden deneyebilirsiniz.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function save(publishing: boolean) {
    if (!draft) return;
    const args = {
      p_id: draft.id,
      p_revision: draft.revision,
      p_place_id: draft.place_id,
      p_stage: draft.stage,
      p_academic_year: draft.academic_year,
      p_value: draft.draft as unknown as Json,
      p_publish: publishing,
    };
    void run(() =>
      supabase().rpc("admin_save_education_calendar", {
        ...args,
        p_request: request(args),
      }),
    );
  }
  const label = (id: string) => {
    const p = data?.places.find((x) => x.id === id);
    return p ? educationPlaceLabel(p, data!.places) : "Seçilmedi";
  };
  function value(key: keyof SchoolCalendarValue, v: unknown) {
    if (draft) {
      setDraft({ ...draft, draft: { ...draft.draft, [key]: v } });
      setPublish(false);
    }
  }
  return (
    <>
      {guard.dialog}
      <Card title="Okulun takvimi, çocuğun kendi yolculuğu">
        <p>
          Ülke → bölge → okul/kampüs sırası uygulanır. En özel yayımlanmış
          takvim kullanılır. Dönem başlangıcı hiçbir çocuğun sınıfını otomatik
          değiştirmez.
        </p>
        <p className="mt-2 text-sm">
          Taslağı kaydetmek canlı takvimi değiştirmez. Kaynağı doğruladıktan
          sonra ayrı olarak yayımlayın. Üniversite takvimi, üniversite soru
          içeriği desteği anlamına gelmez.
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
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ["calendars", "Takvimler"],
          ["places", "Bölgeler ve okullar"],
          ["import", "Taslak içe aktar (kaynaklı)"],
          ["reports", `Okuldan gelen bilgiler (${data?.open_reports ?? 0})`],
        ].map(([id, title]) => (
          <button
            key={id}
            className={tab === id ? "btn" : "btn-secondary"}
            onClick={() =>
              guard.request(() => {
                setTab(id!);
                setDraft(null);
                setPlace(null);
                setReport(null);
                setNote("");
              })
            }
          >
            {title}
          </button>
        ))}
      </div>
      {!data && !error && <p>Yükleniyor…</p>}
      {tab === "calendars" && !draft && (
        <Card title="Doğrulanmış eğitim takvimleri">
          <button className="btn mb-5" onClick={fresh}>
            Takvim ekle
          </button>
          {!data?.calendars.length && (
            <p>
              Henüz takvim yok. Resmî kaynağı doğrulayarak ülke takviminden
              başlayın; farklı okullar için ayrı kayıt ekleyin.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {data?.calendars.map((c) => (
              <article
                className="rounded-3xl border border-violet-100 bg-white p-5"
                key={c.id}
              >
                <p className="text-sm">
                  {label(c.place_id)} · {stages[c.stage]}
                </p>
                <h3 className="my-2 font-bold">{c.draft.title}</h3>
                <p>
                  {c.academic_year}–{c.academic_year + 1} ·{" "}
                  {c.published
                    ? c.published_revision === c.revision
                      ? "Yayında"
                      : "Yayında + yeni taslak"
                    : "Taslak"}
                </p>
                <button className="btn-secondary mt-4" onClick={() => edit(c)}>
                  İncele ve düzenle
                </button>
              </article>
            ))}
          </div>
        </Card>
      )}
      {tab === "calendars" && draft && (
        <Card title={draft.revision ? "Takvimi düzenle" : "Yeni takvim"}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(false);
            }}
          >
            <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
              <label>
                Kapsam
                <select
                  className="input mt-2 w-full"
                  disabled={draft.revision > 0}
                  aria-label="Kapsam"
                  value={draft.place_id}
                  onChange={(e) =>
                    setDraft({ ...draft, place_id: e.target.value })
                  }
                >
                  {data?.places
                    .filter((x) => x.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {label(p.id)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Eğitim kademesi
                <select
                  className="input mt-2 w-full"
                  disabled={draft.revision > 0}
                  aria-label="Eğitim kademesi"
                  value={draft.stage}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      stage: e.target.value as SchoolCalendar["stage"],
                    })
                  }
                >
                  {EDUCATION_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {stages[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Başlangıç yılı
                <input
                  className="input mt-2 w-full"
                  disabled={draft.revision > 0}
                  type="number"
                  min={2000}
                  max={2100}
                  required
                  value={draft.academic_year}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      academic_year: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Takvim başlığı
                <input
                  className="input mt-2 w-full"
                  required
                  minLength={3}
                  maxLength={160}
                  value={draft.draft.title}
                  onChange={(e) => value("title", e.target.value)}
                />
              </label>
              <label>
                Doğrulanan kaynak bağlantısı
                <input
                  className="input mt-2 w-full"
                  type="url"
                  required
                  placeholder="https://…"
                  value={draft.draft.source_url}
                  onChange={(e) => value("source_url", e.target.value)}
                />
              </label>
              <label>
                Kaynağın kontrol edildiği gün
                <input
                  className="input mt-2 w-full"
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  value={draft.draft.verified_on}
                  onChange={(e) => value("verified_on", e.target.value)}
                />
              </label>
              {(
                [
                  ["starts_on", "Eğitim yılı başlangıcı"],
                  ["ends_on", "Eğitim yılı son günü"],
                ] as const
              ).map(([key, title]) => (
                <label key={key}>
                  {title}
                  <input
                    type="date"
                    className="input mt-2 w-full"
                    required
                    value={draft.draft[key]}
                    onChange={(e) => value(key, e.target.value)}
                  />
                </label>
              ))}
              <section className="rounded-3xl bg-[#EEE8FA] p-5 md:col-span-2">
                <h3 className="font-bold">Dönemler</h3>
                <p className="mb-4 text-sm">
                  Tarihleri sırayla girin. İki dönem arasında kalan günler ara
                  tatildir. Son gün dahildir.
                </p>
                {draft.draft.terms.map((term, i) => (
                  <div key={i} className="mb-4 grid gap-3 md:grid-cols-4">
                    {(["title", "starts_on", "ends_on"] as const).map((key) => (
                      <label key={key}>
                        {key === "title"
                          ? "Dönem adı"
                          : key === "starts_on"
                            ? "İlk gün"
                            : "Son gün"}
                        <input
                          className="input mt-1 w-full"
                          type={key === "title" ? "text" : "date"}
                          required
                          value={term[key]}
                          onChange={(e) =>
                            value(
                              "terms",
                              draft.draft.terms.map((x, j) =>
                                j === i ? { ...x, [key]: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary self-end"
                      disabled={draft.draft.terms.length === 1}
                      onClick={() =>
                        value(
                          "terms",
                          draft.draft.terms.filter((_, j) => j !== i),
                        )
                      }
                    >
                      Dönemi kaldır
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={draft.draft.terms.length >= 8}
                  onClick={() =>
                    value("terms", [
                      ...draft.draft.terms,
                      { title: "Yeni dönem", starts_on: "", ends_on: "" },
                    ])
                  }
                >
                  Dönem ekle
                </button>
              </section>
              <div className="flex flex-wrap gap-3 md:col-span-2">
                <button className="btn" disabled={!dirty}>
                  Taslağı kaydet
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={dirty || !draft.revision}
                  onClick={() => setPublish(true)}
                >
                  Yayın önizlemesi
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => guard.request(() => setDraft(null))}
                >
                  Kapat
                </button>
              </div>
              {publish && (
                <section className="rounded-3xl border border-violet-200 bg-[#E7F5EF] p-5 md:col-span-2">
                  <h3 className="font-bold">{draft.draft.title}</h3>
                  <p>
                    {label(draft.place_id)} · {stages[draft.stage]} ·{" "}
                    {draft.draft.starts_on} — {draft.draft.ends_on}
                  </p>
                  <p className="my-3">
                    Bu kapsama uyan velilere tarih kontrolünde gösterilecek.
                    Kaynakta hata varsa önce taslağı düzeltin. Ailelerin sınıfı
                    veya okul kaydı kendiliğinden değişmez.
                  </p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => save(true)}
                  >
                    Kaynağı doğruladım, takvimi yayımla
                  </button>
                </section>
              )}
            </fieldset>
          </form>
        </Card>
      )}
      {tab === "places" && (
        <Card title="Bölge, okul ve kampüs kataloğu">
          <p className="mb-4">
            Önce ülkeyi, sonra il/bölgeyi, ardından okulu ekleyin. Aynı adlı
            okullar üst bölgesiyle ayırt edilir. Kullanılan kayıtların kapsamı
            taşınamaz.
          </p>
          {!place ? (
            <>
              <button
                className="btn mb-4"
                onClick={() =>
                  setPlace({
                    id: crypto.randomUUID(),
                    kind: "region",
                    parent_id: DEFAULT_EDUCATION_PLACE,
                    name: "",
                    revision: 0,
                    active: true,
                  })
                }
              >
                Bölge veya okul ekle
              </button>
              {data?.places.map((p) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 py-3"
                  key={p.id}
                >
                  <span>
                    {label(p.id)}
                    {!p.active ? " · Gizli" : ""}
                  </span>
                  <button
                    className="btn-secondary"
                    onClick={() => setPlace({ ...p })}
                  >
                    Düzenle
                  </button>
                </div>
              ))}
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const args = {
                  p_id: place.id,
                  p_revision: place.revision,
                  p_value: {
                    kind: place.kind,
                    parent_id: place.parent_id,
                    name: place.name,
                    active: place.active,
                  },
                };
                void run(() =>
                  supabase().rpc("admin_save_education_place", {
                    ...args,
                    p_request: request(args),
                  }),
                );
              }}
            >
              <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
                <label>
                  Tür
                  <select
                    className="input mt-2 w-full"
                    disabled={place.revision > 0}
                    value={place.kind}
                    onChange={(e) =>
                      setPlace({
                        ...place,
                        kind: e.target.value as EducationPlace["kind"],
                        parent_id:
                          e.target.value === "country"
                            ? null
                            : DEFAULT_EDUCATION_PLACE,
                      })
                    }
                  >
                    <option value="country">Ülke</option>
                    <option value="region">Bölge / il / ilçe</option>
                    <option value="school">Okul / kampüs</option>
                  </select>
                </label>
                {place.kind !== "country" && (
                  <label>
                    Bağlı olduğu yer
                    <select
                      className="input mt-2 w-full"
                      disabled={place.revision > 0}
                      value={place.parent_id ?? ""}
                      onChange={(e) =>
                        setPlace({ ...place, parent_id: e.target.value })
                      }
                    >
                      {data?.places
                        .filter(
                          (p) =>
                            p.active &&
                            p.kind !== "school" &&
                            p.id !== place.id,
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {label(p.id)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label>
                  Ad
                  <input
                    className="input mt-2 w-full"
                    required
                    minLength={2}
                    maxLength={120}
                    value={place.name}
                    onChange={(e) =>
                      setPlace({ ...place, name: e.target.value })
                    }
                  />
                </label>
                <label className="flex min-h-12 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={place.active}
                    onChange={(e) =>
                      setPlace({ ...place, active: e.target.checked })
                    }
                  />
                  Seçimlerde göster
                </label>
                <div className="flex gap-3">
                  <button className="btn">Kaydet</button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => guard.request(() => setPlace(null))}
                  >
                    Vazgeç
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </Card>
      )}
      {tab === "import" && (
        <CalendarSeedImport onDone={() => setTick((x) => x + 1)} />
      )}
      {tab === "reports" && (
        <Card title="Okul takvimi farklılıkları">
          <p className="mb-4">
            Bir velinin bildirimi doğrulanmış takvim değildir. Kaynağı okuldan
            kontrol edin; doğrulama sonrasında ilgili kapsam için takvimi ayrıca
            kaydedip yayımlayın. Bildirimi kapatmak otomatik duyuru göndermez.
          </p>
          {!data?.reports.length && (
            <p>İnceleme bekleyen okul bildirimi yok.</p>
          )}
          {data?.reports.map((r) => (
            <article
              key={r.id}
              className="mb-4 rounded-3xl border border-violet-100 p-5"
            >
              <h3 className="font-bold">
                {label(r.place_id)} · {stages[r.stage]}
              </h3>
              <p>
                {r.academic_year}–{r.academic_year + 1} · Bildirilen başlangıç:{" "}
                {r.proposed_start}
              </p>
              <p className="my-3 whitespace-pre-wrap break-words">{r.detail}</p>
              <button
                className="btn-secondary"
                onClick={() =>
                  guard.request(() => {
                    setReport(r);
                    setNote("");
                  })
                }
              >
                İncele
              </button>
              {report?.id === r.id && (
                <div className="mt-4">
                  <label>
                    Doğrulama kaynağı / karar gerekçesi
                    <textarea
                      className="input mt-2 min-h-32 w-full"
                      maxLength={2000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {(["verified", "dismissed"] as const).map((status) => (
                      <button
                        key={status}
                        disabled={busy || note.trim().length < 10}
                        className={
                          status === "verified" ? "btn" : "btn-secondary"
                        }
                        onClick={() => {
                          const args = {
                            p_id: r.id,
                            p_revision: r.revision,
                            p_status: status,
                            p_note: note.trim(),
                          };
                          void run(() =>
                            supabase().rpc("admin_review_education_report", {
                              ...args,
                              p_request: request(args),
                            }),
                          );
                        }}
                      >
                        {status === "verified"
                          ? "Kaynağı doğruladım"
                          : "Doğrulanamadı, kapat"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
          {data && data.open_reports > 100 && (
            <Notice>
              En eski bekleyen kayıtları incelemek için ilk 100 kaydı
              tamamladıktan sonra listeyi yenileyin. Toplam {data.open_reports}{" "}
              kayıt var.
            </Notice>
          )}
        </Card>
      )}
    </>
  );
}
