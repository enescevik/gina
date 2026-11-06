import { type GroupCreateCommand, groupCreateCommandSchema } from "@gina/core";
import { useAuth } from "@/lib/auth";
import { groupCreateQueue, sendGroupCreate } from "@/lib/group-command";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Layout, Notice } from "@/components/Layout";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { unwrap, useAdminQuery } from "@/lib/use-async";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/format";
import { adminRpc } from "@/lib/admin-rpc";
import {
  type GroupPhases,
  participationPhase,
  planLabel,
  planList,
  rankingReasonText,
  reviewPhase,
} from "@/lib/cohort-text";
type Plan = "free" | "plus" | "pro";
type Group = {
  id: string;
  title: string;
  grade: number;
  subject: string;
  curriculum_version: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
  version_hash: string;
  participants: number;
  requires_review?: boolean;
};
type Operations = {
  enabled: boolean;
  quotas: { plan: Plan; monthly: number }[];
  groups: Group[];
};
type Library = {
  collections: {
    id: string;
    title: string;
    grade: number;
    subject: string;
    curriculum_version: string;
    status: string;
  }[];
  items: {
    id: string;
    collection_id: string;
    status: string;
    content: { stem: string; kind: string; topic: string };
  }[];
};
type Package = {
  id: string;
  title: string;
  grade: number;
  subject: string;
  version: number;
  curriculum: string;
  plans: Plan[];
  units: {
    key: string;
    title: string;
    count: number;
    eligible: boolean;
    review_eligible?: boolean;
    max_points?: number;
    has_media: boolean;
  }[];
};
export default function Groups() {
  const { session } = useAuth();
  const user = session?.user.id ?? "";
  // C07: sayfa düzeyi sorgular Layout'un rol bağlamında çalışsın diye Layout dış bileşende.
  return (
    <Layout title="Birlikte Prova" roles={["content"]}>
      <GroupsEditor key={user} user={user} />
    </Layout>
  );
}
function GroupsEditor({ user }: { user: string }) {
  // C07: katılım hakkı/yayın anahtarı genel politikadır; yalnız tam yönetici değiştirir.
  const { isAdmin } = useAuth();
  const queue = useMemo(() => groupCreateQueue(user), [user]);
  const [pending, setPending] = useState<GroupCreateCommand | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void queue.restore().then((c) => {
      if (active) setPending(c);
    }).catch(() => {
      if (active) setStorageError(true);
    }).finally(() => {
      if (active) setRestoring(false);
    });
    return () => {
      active = false;
    };
  }, [user, queue]);
  const packages = useAdminQuery(
    async () =>
      unwrap(
        await supabase().rpc("admin_group_package_catalog"),
      ) as unknown as Package[],
    [user],
  );
  const query = useAdminQuery(async () =>
    unwrap(await supabase().rpc("admin_group_exams")) as unknown as Operations
  );
  const library = useAdminQuery(async () =>
    unwrap(await supabase().rpc("admin_learning_library")) as unknown as Library
  );
  const [form, setForm] = useState({
    title: "",
    collection: "",
    start: "",
    end: "",
    minutes: 30,
    plans: ["plus", "pro"] as Plan[],
    items: [] as string[],
    review: false,
  });
  const [policy, setPolicy] = useState<
    { enabled: boolean; limits: Record<Plan, number> } | null
  >(null);
  const [cancel, setCancel] = useState<Group | null>(null);
  // Yalnız iş yükü tahmini içindir; yayına gönderilmez.
  const [expected, setExpected] = useState(30);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // Yayın kalıcıdır: operatör özetle kontrol ettiğini onaylar; onay yalnız onaylandığı form hâli için geçerlidir.
  const [confirmedFor, setConfirmedFor] = useState("");
  const confirmed = confirmedFor !== "" && confirmedFor === JSON.stringify(form);
  const setConfirmed = (value: boolean) => setConfirmedFor(value ? JSON.stringify(form) : "");
  const formDirty = !!(form.title || form.collection || form.start || form.end || form.items.length);
  const guard = useUnsavedChanges(formDirty || !!policy || (!!cancel && !!reason), busy);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const gate = useRef(false);

  const packageSource = packages.data?.find((p) =>
    "package:" + p.id === form.collection
  );
  const legacy = library.data?.collections.find((c) =>
    c.id === form.collection
  );
  const collection = packageSource
    ? { ...packageSource, curriculum_version: packageSource.curriculum }
    : legacy;
  const items = packageSource
    ? packageSource.units.map((unit) => ({
      id: unit.key,
      count: unit.count,
      eligible: form.review ? !!unit.review_eligible : unit.eligible,
      content: {
        topic: unit.title,
        stem: `${unit.count} soru${unit.has_media ? " · Görselli" : ""}${
          unit.key.startsWith("source:") ? " · Ortak kaynakla birlikte" : ""
        }${!unit.eligible ? " · Ölçütlü inceleme gerekir" : ""}`,
      },
    }))
    : (library.data?.items.filter((i) =>
      i.collection_id === form.collection && i.status === "published" &&
      i.content.kind === "multiple_choice"
    ) ?? []).map((i) => ({ ...i, count: 1, eligible: true }));
  const questionCount = items.filter((i) => form.items.includes(i.id)).reduce(
    (n, i) => n + i.count,
    0,
  );
  // Şıklı olmayan birimler en az bir açık uçlu soru içerir; üst sınır olarak sayılır.
  const openEnded = packageSource && form.review
    ? packageSource.units.filter((u) => form.items.includes(u.key) && !u.eligible)
      .reduce((n, u) => n + u.count, 0)
    : 0;
  const maxPoints = packageSource && form.review
    ? packageSource.units.filter((u) => form.items.includes(u.key)).reduce(
      (n, u) => n + (u.max_points ?? u.count),
      0,
    )
    : questionCount;
  const creationLocked = busy || restoring || storageError || !!pending;
  async function run(action: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setMessage("");
    setSuccess("");
    try {
      await action();
      query.reload();
    } catch (e) {
      const code = (e as Error).message;
      setMessage(
        code === "library_publication_changed" ||
          code === "group_package_unavailable"
          ? "Kaynak paketin yayını veya incelemesi değişti. Listeyi yenileyip uygun bir kaynak seçin."
          : code === "group_package_plans"
          ? "Seçtiğiniz erişim paketleri, kaynak kütüphanenin izin verdiği paketlerle sınırlı olmalı."
          : code === "request_conflict"
          ? "Aynı kayıt kimliğiyle farklı içerik gönderilemez. Bilgileri kontrol edin."
          : code === "group_questions_required"
          ? "En az 3, en fazla 50 yayımlanmış ve seçilen inceleme türüne uygun soru seçin."
          : "İşlem kaydedilemedi. Alanları ve güncel durumu kontrol edin.",
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function create() {
    await run(async () => {
      let command = pending;
      if (!command) {
        if (restoring || storageError) throw Error("storage_unavailable");
        command = groupCreateCommandSchema.parse({
          request: crypto.randomUUID(),
          review: !!packageSource && form.review,
          source: packageSource ? "package" : "legacy",
          sourceId: packageSource?.id ?? form.collection,
          version: packageSource?.version ?? null,
          title: form.title.trim(),
          items: form.items,
          start: new Date(form.start).toISOString(),
          end: new Date(form.end).toISOString(),
          minutes: form.minutes,
          plans: form.plans,
        });
        await queue.prepare(command);
        setPending(command);
      }
      try {
        await sendGroupCreate(command);
        await queue.acknowledge(command.request);
        setPending(null);
      } catch (e) {
        if (
          /^(P0001|42501|22\w{3}|23\w{3})$/.test(
            (e as { code?: string }).code ?? "",
          )
        ) {
          await queue.acknowledge(command.request);
          setPending(null);
          library.reload();
          packages.reload();
        }
        throw e;
      }
      setSuccess(
        "Prova yayımlandı. Soru sürümü ve katılım koşulları sabitlendi.",
      );
      setForm({ ...form, title: "", items: [] });
    });
  }
  return (
    <>
      {guard.dialog}
      <p className="mb-6 max-w-3xl text-slate-600">
        Aynı sınıf düzeyine aynı soru sürümünü verin. Bu evde yapılan bir
        çalışma; gözetimli veya resmî sınav değildir. Katılım ve takma adla
        sıralama ayrı veli tercihleridir. Eşit puan eşit sıradır; hız puanı
        yoktur.
      </p>
      {query.error || library.error || packages.error || message
        ? <Notice tone="error">{message || "Veriler yüklenemedi."}</Notice>
        : null}
      {query.error || library.error || packages.error
        ? (
          <button
            className="btn-secondary mb-4"
            disabled={busy}
            onClick={() => {
              query.reload();
              library.reload();
              packages.reload();
            }}
          >
            Listeleri yeniden yükle
          </button>
        )
        : null}
      {success ? <Notice tone="ok">{success}</Notice> : null}
      <Card title="Yayın ve paket hakları">
        <p className="text-slate-600">
          {query.data?.enabled
            ? "Yeni katılımlar açık"
            : "Yeni katılımlar kapalı"}. Mevcut sonuçlar korunur. Aylık katılım
          hakkı aile başınadır; standart Prova deneme sınırı da uygulanır.
        </p>
        {!isAdmin
          ? (
            <p className="mt-4 text-sm text-slate-500" data-testid="group-policy-admin-only">
              Paket hakları ve yeni katılım anahtarı yönetici yetkisiyle değişir.
            </p>
          )
          : !policy
          ? (
            <button
              className="btn-secondary mt-4"
              disabled={!query.data}
              onClick={() => {
                if (query.data) {
                  setPolicy({
                    enabled: query.data.enabled,
                    limits: Object.fromEntries(
                      query.data.quotas.map((q) => [q.plan, q.monthly]),
                    ) as Record<Plan, number>,
                  });
                }
              }}
            >
              Hakları düzenle
            </button>
          )
          : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="flex min-h-12 items-center gap-3 md:col-span-3">
                <input
                  type="checkbox"
                  checked={policy.enabled}
                  onChange={(e) =>
                    setPolicy({ ...policy, enabled: e.target.checked })}
                />Yeni katılımları aç
              </label>
              {(["free", "plus", "pro"] as const).map((plan) => (
                <label className="label" key={plan}>
                  {planLabel[plan]} · aylık katılım<input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={policy.limits[plan]}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        limits: { ...policy.limits, [plan]: +e.target.value },
                      })}
                  />
                </label>
              ))}
              <div className="flex gap-3 md:col-span-3">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      unwrap(
                        await supabase().rpc("admin_group_policy", {
                          p_enabled: policy.enabled,
                          p_limits: policy.limits,
                        }),
                      );
                      setPolicy(null);
                      setSuccess(
                        "Paket hakları ve yayın anahtarı birlikte kaydedildi.",
                      );
                    })}
                >
                  Hakları kaydet
                </button>
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setPolicy(null)}
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}
      </Card>
      {storageError
        ? (
          <Notice tone="error">
            Bekleyen yayın kaydı okunamadı. Yeni yayın başlatılmadı; sayfayı
            yeniden açın.
          </Notice>
        )
        : null}
      {pending
        ? (
          <Card title="Bekleyen yayını kontrol et">
            <p>
              <strong>{pending.title}</strong>{" "}
              için yayın isteği bu tarayıcıda saklandı. Aynı istek kontrol
              edilir; ikinci Prova oluşturulmaz.
            </p>
            <button
              className="btn mt-4"
              disabled={busy || restoring || storageError}
              onClick={() => void create()}
            >
              Yayın sonucunu kontrol et
            </button>
          </Card>
        )
        : null}
      <Card title="Yeni ortak prova">
        <fieldset disabled={creationLocked}>
          <p className="mb-4 text-slate-600">
            İncelenmiş ve yayımlanmış bir paketten 3–50 soru
            seçin. Ortak metin veya görsele bağlı sorular bir bütün olarak
            eklenir. Açık uçlu soru içeren gruplar otomatik sıralamaya alınmaz.
            Yayımlandıktan sonra içerik ve süre değişmez; düzeltmek için iptal
            edip yeni sürüm oluşturun. En fazla 1.000 katılımcı.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="label">
              Başlık<input
                className="input"
                value={form.title}
                maxLength={160}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="label">
              Kaynak<select
                className="input"
                value={form.collection}
                onChange={(e) =>
                  setForm({
                    ...form,
                    collection: e.target.value,
                    items: [],
                    review: false,
                    plans: packages.data?.find((p) =>
                      "package:" + p.id === e.target.value
                    )?.plans ?? ["plus", "pro"],
                  })}
              >
                <option value="">Yayımlanmış kaynak seçin</option>
                <optgroup label="İncelenmiş kütüphane paketleri">
                  {packages.data?.map((p) => (
                    <option key={p.id} value={"package:" + p.id}>
                      {p.title} · {p.grade}. sınıf · sürüm {p.version}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Önceki metin koleksiyonları">
                  {library.data?.collections.filter((c) =>
                    c.status === "published" && c.curriculum_version.trim()
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} · {c.grade}. sınıf
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="label">
              Katılım başlangıcı<input
                className="input"
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </label>
            <label className="label">
              Katılım bitişi<input
                className="input"
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </label>
            <p className="text-sm text-slate-500 md:col-span-2">
              Saatler bu cihazın saat dilimindedir. Pencere en fazla 31 gün.
              Çocuğun süresi başladığı anda işler; ortak bitiş daha erkense
              orada durur.
            </p>
            <label className="label">
              Çözme süresi (dakika)<input
                className="input"
                type="number"
                min={5}
                max={120}
                value={form.minutes}
                onChange={(e) => setForm({ ...form, minutes: +e.target.value })}
              />
            </label>
            <fieldset>
              <legend className="label">Dahil paketler</legend>
              <div className="flex gap-4">
                {(["free", "plus", "pro"] as const).map((plan) => (
                  <label
                    key={plan}
                    className="flex min-h-12 items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={form.plans.includes(plan)}
                      disabled={!!packageSource &&
                        !packageSource.plans.includes(plan)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          plans: e.target.checked
                            ? [...form.plans, plan]
                            : form.plans.filter((p) => p !== plan),
                        })}
                    />
                    {planLabel[plan]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          {packageSource
            ? (
              <div className="my-4 rounded-2xl bg-purple-50 p-4">
                <label className="flex min-h-12 items-center gap-3 font-bold">
                  <input
                    type="checkbox"
                    checked={form.review}
                    onChange={(e) =>
                      setForm({ ...form, review: e.target.checked, items: [] })}
                  />{" "}
                  Açık uçlu sorularla ölçütlü inceleme
                </label>
                <p>
                  Çizimli ve yazılı cevaplar GINA incelemesinden geçer. Sonuç ve
                  sıralama ayrı yayımlanır; açık itiraz varken kesin sıralama
                  gösterilmez. Katılımda veli bu erişimi ayrıca onaylar. Şıklı
                  soru 1 puan, açık uçlu soru kendi sabit ölçüt toplamı
                  kadardır.
                </p>
              </div>
            )
            : null}
          {collection
            ? (
              <div className="mt-5 rounded-2xl bg-brand-light p-4">
                <p className="mb-3 font-bold">
                  {collection.subject} · {collection.curriculum_version} ·{" "}
                  {questionCount} soru seçili
                </p>
                {packageSource && form.review
                  ? (
                    <p className="mb-3 font-bold">
                      Seçili soruların toplamı:{" "}
                      {packageSource.units.filter((u) =>
                        form.items.includes(u.key)
                      ).reduce((n, u) => n + (u.max_points ?? u.count), 0)} puan
                    </p>
                  )
                  : null}
                {packageSource
                  ? (
                    <a
                      className="mb-4 inline-flex min-h-12 items-center font-bold text-purple-700 underline"
                      href={`/library?packageId=${packageSource.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Paketin soru ve görsellerini incele ↗
                    </a>
                  )
                  : null}
                {items.length
                  ? items.map((i) => (
                    <label
                      key={i.id}
                      className="flex min-h-12 gap-3 border-b border-purple-100 py-3"
                    >
                      <input
                        type="checkbox"
                        checked={form.items.includes(i.id)}
                        disabled={!i.eligible}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            items: e.target.checked
                              ? [...form.items, i.id]
                              : form.items.filter((id) => id !== i.id),
                          })}
                      />
                      <span>
                        <strong>{i.content.topic}</strong>
                        <span className="mt-1 block">{i.content.stem}</span>
                      </span>
                    </label>
                  ))
                  : <p>Bu koleksiyonda uygun yayımlanmış soru yok.</p>}
              </div>
            )
            : null}
          {collection && form.title.trim().length >= 3 && questionCount >= 3
            ? (
              <section
                className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
                aria-label="Yayın öncesi önizleme"
                data-testid="group-preview"
              >
                <p className="text-base font-bold">
                  Yayımlanacak: {form.title.trim()}
                </p>
                <ol className="mt-3 grid gap-3 md:grid-cols-3">
                  <li className="rounded-xl bg-white p-3">
                    <strong className="block">1 · Kapsam</strong>
                    {collection.subject} · {collection.grade}. sınıf ·{" "}
                    {collection.curriculum_version}
                    <span className="block">
                      {form.plans.length
                        ? planList(form.plans) + " paketlerindeki aileler"
                        : "Paket seçilmedi"}
                    </span>
                  </li>
                  <li className="rounded-xl bg-white p-3">
                    <strong className="block">2 · Sorular ve süre</strong>
                    {questionCount} soru · toplam {maxPoints} puan
                    <span className="block">
                      Çocuk başına {form.minutes} dakika · tek deneme
                    </span>
                    {packageSource && form.review
                      ? (
                        <span className="block">
                          En çok {openEnded} açık uçlu soru ölçütle incelenir
                        </span>
                      )
                      : <span className="block">Otomatik puanlanır</span>}
                  </li>
                  <li className="rounded-xl bg-white p-3">
                    <strong className="block">3 · Aile ve çocuk görünümü</strong>
                    <span className="block">
                      Aile: katılım penceresi{" "}
                      {form.start && form.end
                        ? `${fmtDateTime(new Date(form.start).toISOString())} – ${
                          fmtDateTime(new Date(form.end).toISOString())
                        }`
                        : "seçilmedi"}; takma adla sıralama isteğe bağlı ve
                      veli iznine bağlı.
                    </span>
                    <span className="block">
                      Çocuk: başladığı anda {form.minutes} dakikalık süre işler;
                      pencere daha erken biterse orada durur. Hız puanı yok.
                    </span>
                  </li>
                </ol>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3">
                    <strong className="block">Katılım penceresi</strong>
                    Ailelerin katılabildiği aralık. En fazla 31 gün, 1.000
                    katılımcı.
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <strong className="block">Çocuğun süresi</strong>
                    {form.minutes} dakika, tek deneme. Pencereden ayrı işler.
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <strong className="block">İnceleme aşamaları</strong>
                    {packageSource && form.review
                      ? "Pencere kapanınca inceleme → itirazlar → sonuç yayını. Puanlanmamış veya okunamayan cevap kesin sıralamaya girmez."
                      : "Otomatik puan; bitmemiş çalışma kesin sıralamaya girmez."}
                  </div>
                </div>
                {packageSource && form.review
                  ? (
                    <div className="mt-3 rounded-xl bg-white p-3">
                      <label className="label">
                        Tahmini katılımcı (yalnız iş yükü tahmini)<input
                          className="input !w-32"
                          type="number"
                          min={1}
                          max={1000}
                          value={expected}
                          onChange={(e) =>
                            setExpected(
                              Math.max(1, Math.min(1000, +e.target.value || 1)),
                            )}
                        />
                      </label>
                      <p>
                        İnceleme iş yükü: en çok{" "}
                        <strong>{expected * openEnded}</strong>{" "}
                        cevap ({expected} katılımcı × {openEnded}{" "}
                        açık uçlu soru). İtirazlar buna eklenir.
                      </p>
                    </div>
                  )
                  : null}
                <p className="mt-3">
                  Yayımlandıktan sonra sorular ve süre değişmez; düzeltmek için
                  iptal edip yeni sürüm oluşturun.
                </p>
                <label className="mt-3 flex min-h-12 items-start gap-3">
                  <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  <span>Kaynağı, soruları, süreyi ve katılım penceresini kontrol ettim.</span>
                </label>
              </section>
            )
            : null}
          <button
            className="btn mt-5"
            disabled={busy || form.title.trim().length < 3 ||
              !form.collection ||
              !form.start || !form.end || !form.plans.length ||
              questionCount < 3 || questionCount > 50 || !!packages.error ||
              !!library.error || !confirmed}
            onClick={() => void create()}
          >
            Sürümü sabitle ve yayımla
          </button>
        </fieldset>
      </Card>
      <Card title="Yayımlanan provalar">
        {!query.data?.groups.length
          ? <p>Henüz ortak prova oluşturulmadı.</p>
          : null}
        {query.data?.groups.map((g) => (
          <article key={g.id} className="border-t border-slate-100 py-5">
            <h3 className="text-lg font-bold">{g.title}</h3>
            <p>{g.subject} · {g.grade}. sınıf · {g.participants} katılımcı</p>
            <p className="mt-2 text-sm text-slate-500">
              {fmtDateTime(g.starts_at)} – {fmtDateTime(g.ends_at)} ·{" "}
              {g.duration_minutes} dakika · sürüm {g.version_hash.slice(0, 10)}
            </p>
            <PhaseDetails id={g.id} />
            {g.requires_review
              ? (
                <a
                  className="btn-secondary mt-3 mr-3 inline-flex"
                  href={`/cohort-review?group=${g.id}`}
                >
                  Cevapları ve itirazları incele
                </a>
              )
              : null}
            {g.status === "cancelled"
              ? <p className="mt-2 text-amber-800">İptal edildi</p>
              : (
                <button
                  className="btn-secondary mt-3"
                  disabled={busy}
                  onClick={() => {
                    setCancel(g);
                    setReason("");
                  }}
                >
                  Provayı iptal et
                </button>
              )}
          </article>
        ))}
      </Card>
      {cancel
        ? (
          <Card title={`${cancel.title} · İptal gerekçesi`}>
            <p className="mb-4 text-slate-600">
              Yeni katılımlar ve yanıtlar durur; sıralama kapanır. Aile kendi
              yanıtlarını görmeye devam eder. Bu kayıt silinmez.
            </p>
            <label className="label">
              Gerekçe<textarea
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={10}
              />
            </label>
            <div className="mt-4 flex gap-3">
              <button
                className="btn"
                disabled={busy || reason.trim().length < 10}
                onClick={() =>
                  void run(async () => {
                    unwrap(
                      await supabase().rpc("admin_cancel_group_exam", {
                        p_id: cancel.id,
                        p_reason: reason,
                      }),
                    );
                    setCancel(null);
                  })}
              >
                İptali kaydet
              </button>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => setCancel(null)}
              >
                Vazgeç
              </button>
            </div>
          </Card>
        )
        : null}
    </>
  );
}

function PhaseSummary({ id }: { id: string }) {
  const phases = useAdminQuery(
    async () =>
      await adminRpc("group_exam_phases", { p_group: id }) as GroupPhases,
    [id],
  );
  if (phases.error) {
    return (
      <p role="alert" className="mt-2">
        Aşamalar açılamadı.{" "}
        <button className="btn-secondary" onClick={phases.reload}>
          Yeniden dene
        </button>
      </p>
    );
  }
  const p = phases.data;
  if (!p) return <p className="mt-2">Yükleniyor…</p>;
  const excluded = Object.entries(p.ranking.excluded).filter(([, n]) => n > 0);
  return (
    <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
      <div>
        <dt className="font-bold">Katılım penceresi</dt>
        <dd>{participationPhase[p.participation.phase]}</dd>
      </div>
      <div>
        <dt className="font-bold">Çocuğun süresi</dt>
        <dd>{p.child_time.duration_minutes} dakika · tek deneme</dd>
      </div>
      <div>
        <dt className="font-bold">İnceleme</dt>
        <dd>
          {reviewPhase[p.review.phase]}
          {p.review.required
            ? ` · ${p.review.pending ?? 0} bekleyen · ${
              p.review.appeals ?? 0
            } itiraz`
            : ""}
        </dd>
      </div>
      <div>
        <dt className="font-bold">Sıralama · isteğe bağlı</dt>
        <dd>
          {p.ranking.eligible_entries} kayıt kesin sıralamada
          {excluded.map(([reason, n]) => (
            <span key={reason} className="block">
              {n} · {rankingReasonText(reason)}
            </span>
          ))}
        </dd>
      </div>
    </dl>
  );
}

/** Aşamalar yalnız açıldığında yüklenir; uzun listede her prova için istek atılmaz. */
function PhaseDetails({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="mt-3 rounded-2xl border border-purple-100 p-3"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer font-bold">
        Aşamalar ve sıralama
      </summary>
      {open ? <PhaseSummary id={id} /> : null}
    </details>
  );
}
