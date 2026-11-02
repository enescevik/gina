import { useRef, useState } from "react";
import { Card, Layout, Notice } from "@/components/Layout";
import { unwrap, useAdminQuery } from "@/lib/use-async";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/format";
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
export default function Groups() {
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
  });
  const [policy, setPolicy] = useState<
    { enabled: boolean; limits: Record<Plan, number> } | null
  >(null);
  const [cancel, setCancel] = useState<Group | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const gate = useRef(false);
  const intent = useRef({ hash: "", id: "" });
  const collection = library.data?.collections.find((c) =>
    c.id === form.collection
  );
  const items =
    library.data?.items.filter((i) =>
      i.collection_id === form.collection && i.status === "published" &&
      i.content.kind === "multiple_choice"
    ) ?? [];
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
        code === "request_conflict"
          ? "Aynı kayıt kimliğiyle farklı içerik gönderilemez. Bilgileri kontrol edin."
          : code === "group_questions_required"
          ? "En az 3, en fazla 50 yayımlanmış çoktan seçmeli soru seçin."
          : "İşlem kaydedilemedi. Alanları ve güncel durumu kontrol edin.",
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function create() {
    await run(async () => {
      const payload = {
        p_collection: form.collection,
        p_title: form.title.trim(),
        p_items: form.items,
        p_start: new Date(form.start).toISOString(),
        p_end: new Date(form.end).toISOString(),
        p_minutes: form.minutes,
        p_plans: form.plans,
      };
      const hash = JSON.stringify(payload);
      if (intent.current.hash !== hash) {
        intent.current = { hash, id: crypto.randomUUID() };
      }
      unwrap(
        await supabase().rpc("admin_create_group_exam", {
          p_id: intent.current.id,
          ...payload,
        }),
      );
      setSuccess(
        "Prova yayımlandı. Soru sürümü ve katılım koşulları sabitlendi.",
      );
      setForm({ ...form, title: "", items: [] });
    });
  }
  return (
    <Layout title="Birlikte Prova">
      <p className="mb-6 max-w-3xl text-slate-600">
        Aynı sınıf düzeyine aynı soru sürümünü verin. Bu evde yapılan bir
        çalışma; gözetimli veya resmî sınav değildir. Katılım ve takma adla
        sıralama ayrı veli tercihleridir. Eşit doğru sayısı eşit sıradır; hız
        puanı yoktur.
      </p>
      {query.error || library.error || message
        ? <Notice tone="error">{message || "Veriler yüklenemedi."}</Notice>
        : null}
      {success ? <Notice tone="ok">{success}</Notice> : null}
      <Card title="Yayın ve paket hakları">
        <p className="text-slate-600">
          {query.data?.enabled
            ? "Yeni katılımlar açık"
            : "Yeni katılımlar kapalı"}. Mevcut sonuçlar korunur. Aylık katılım
          hakkı aile başınadır; standart Prova deneme sınırı da uygulanır.
        </p>
        {!policy
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
                  {plan} · aylık katılım<input
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
      <Card title="Yeni ortak prova">
        <p className="mb-4 text-slate-600">
          Yayımlanmış bir koleksiyondan 3–50 çoktan seçmeli soru seçin. İlk
          sürümde görselsiz sorular desteklenir. Yayımlandıktan sonra içerik ve
          süre değişmez; düzeltmek için iptal edip yeni sürüm oluşturun. En
          fazla 1.000 katılımcı.
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
            Koleksiyon<select
              className="input"
              value={form.collection}
              onChange={(e) =>
                setForm({ ...form, collection: e.target.value, items: [] })}
            >
              <option value="">Koleksiyon seçin</option>
              {library.data?.collections.filter((c) =>
                c.status === "published" && c.curriculum_version.trim()
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {c.grade}. sınıf
                </option>
              ))}
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
            Çocuğun süresi başladığı anda işler; ortak bitiş daha erkense orada
            durur.
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
                <label key={plan} className="flex min-h-12 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.plans.includes(plan)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        plans: e.target.checked
                          ? [...form.plans, plan]
                          : form.plans.filter((p) =>
                            p !== plan
                          ),
                      })}
                  />
                  {plan}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {collection
          ? (
            <div className="mt-5 rounded-2xl bg-brand-light p-4">
              <p className="mb-3 font-bold">
                {collection.subject} · {collection.curriculum_version} ·{" "}
                {form.items.length} soru seçili
              </p>
              {items.length
                ? items.map((i) => (
                  <label
                    key={i.id}
                    className="flex min-h-12 gap-3 border-b border-purple-100 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={form.items.includes(i.id)}
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
        <button
          className="btn mt-5"
          disabled={busy || form.title.trim().length < 3 || !form.collection ||
            !form.start || !form.end || !form.plans.length ||
            form.items.length < 3 || form.items.length > 50}
          onClick={() => void create()}
        >
          Sürümü sabitle ve yayımla
        </button>
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
    </Layout>
  );
}
