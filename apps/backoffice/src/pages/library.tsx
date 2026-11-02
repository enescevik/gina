import { LibraryPolicy, type RewardPolicy } from "@/components/LibraryPolicy";
import { useState } from "react";
import type { Json } from "@gina/core";
import { Card, Layout, Notice } from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";
type Plan = "free" | "plus" | "pro";
type Collection = {
  id: string;
  title: string;
  description: string;
  grade: number;
  subject: string;
  curriculum_version: string;
  plans: Plan[];
  status: string;
};
type Content = {
  grade: number;
  subject: string;
  topic: string;
  kind: string;
  difficulty: string;
  stem: string;
  choices?: { key: string; text: string }[];
  correct_key?: string;
  expected_answer?: string;
  solution: string;
};
type Item = {
  id: string;
  collection_id: string;
  content: Content;
  status: string;
};
type Contribution = {
  id: string;
  content: Content;
  status: string;
  review_note: string | null;
};
interface Library {
  quotas: { plan: Plan; monthly: number }[];
  rewards: RewardPolicy[];
  collections: Collection[];
  items: Item[];
  submissions: Contribution[];
}
const blank = (): Collection => ({
  id: crypto.randomUUID(),
  title: "",
  description: "",
  grade: 5,
  subject: "",
  curriculum_version: "",
  plans: ["plus", "pro"],
  status: "draft",
});
export default function LibraryPage() {
  const { data, error, reload } = useAdminQuery(async () =>
    unwrap(await supabase().rpc("admin_learning_library")) as unknown as Library
  );
  const [tab, setTab] = useState<"content" | "review" | "policy">("content");
  const [editing, setEditing] = useState<Collection | null>(null);
  const [selected, setSelected] = useState("");
  const [review, setReview] = useState<Contribution | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState({
    topic: "",
    stem: "",
    answer: "",
    solution: "",
  });
  const collection = data?.collections.find((c) => c.id === selected);
  async function run(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await operation();
      reload();
    } catch (e) {
      const code = (e as { message?: string })?.message;
      setMessage(
        (code?.includes("duplicate") || code === "duplicate_question")
          ? "Bu soru daha önce kütüphaneye eklenmiş. Yeniden hak verilmez."
          : code === "collection_mismatch"
          ? "Sorunun ders ve sınıfı seçilen koleksiyonla aynı olmalı."
          : "İşlem kaydedilemedi. Alanları ve güncel durumu kontrol edin.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Layout title="GINA kütüphanesi">
      <p className="mb-6 max-w-3xl text-slate-600">
        Koleksiyonları hazırlayın, soruları inceleyin ve paketlere açın. Bir
        koleksiyonun görünmesi için hem koleksiyonun hem içindeki soruların
        yayımlanmış olması gerekir.
      </p>
      {error || message
        ? <Notice tone="error">{message || "Kütüphane yüklenemedi."}</Notice>
        : null}
      <nav
        aria-label="Kütüphane işlemleri"
        className="mb-6 flex flex-wrap gap-2 rounded-2xl bg-brand-light p-2"
      >
        {([["content", "Koleksiyonlar"], [
          "review",
          `İnceleme${
            data?.submissions.filter((s) => s.status === "pending").length
              ? ` (${
                data.submissions.filter((s) => s.status === "pending").length
              })`
              : ""
          }`,
        ], ["policy", "Haklar ve ödüller"]] as const).map(([value, label]) => (
          <button
            key={value}
            aria-current={tab === value ? "page" : undefined}
            className={tab === value ? "btn" : "btn-secondary"}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "content"
        ? (
          <>
            <div className="mb-6 flex gap-3">
              <button className="btn" onClick={() => setEditing(blank())}>
                Koleksiyon oluştur
              </button>
              <button className="btn-secondary" onClick={reload}>Yenile</button>
            </div>
            {editing
              ? (
                <Card title="Koleksiyon bilgileri">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="label">
                      Ad<input
                        className="input"
                        value={editing.title}
                        onChange={(e) =>
                          setEditing({ ...editing, title: e.target.value })}
                        maxLength={160}
                      />
                    </label>
                    <label className="label">
                      Ders<input
                        className="input"
                        value={editing.subject}
                        onChange={(e) =>
                          setEditing({ ...editing, subject: e.target.value })}
                      />
                    </label>
                    <label className="label">
                      Sınıf<input
                        className="input"
                        type="number"
                        min={1}
                        max={12}
                        value={editing.grade}
                        onChange={(e) =>
                          setEditing({ ...editing, grade: +e.target.value })}
                      />
                    </label>
                    <label className="label">
                      Müfredat / eğitim yılı<input
                        className="input"
                        value={editing.curriculum_version}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            curriculum_version: e.target.value,
                          })}
                        placeholder="İncelenen resmî program ve eğitim yılı"
                      />
                    </label>
                    <label className="label md:col-span-2">
                      Açıklama<textarea
                        className="input"
                        value={editing.description}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            description: e.target.value,
                          })}
                      />
                    </label>
                    <fieldset>
                      <legend className="label">Dahil olan paketler</legend>
                      <div className="flex gap-4">
                        {(["free", "plus", "pro"] as const).map((p) => (
                          <label
                            key={p}
                            className="flex min-h-12 items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={editing.plans.includes(p)}
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  plans: e.target.checked
                                    ? [...editing.plans, p]
                                    : editing.plans.filter((x) => x !== p),
                                })}
                            />
                            {p}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="label">
                      Yayın durumu<select
                        className="input"
                        value={editing.status}
                        onChange={(e) =>
                          setEditing({ ...editing, status: e.target.value })}
                      >
                        <option value="draft">Taslak</option>
                        <option value="published">Yayında</option>
                        <option value="archived">Arşiv</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      className="btn"
                      disabled={busy || !editing.title.trim() ||
                        !editing.subject.trim() || !editing.plans.length}
                      onClick={() =>
                        void run(async () => {
                          unwrap(
                            await supabase().rpc(
                              "admin_save_library_collection",
                              {
                                p_id: editing.id,
                                p_title: editing.title,
                                p_description: editing.description,
                                p_grade: editing.grade,
                                p_subject: editing.subject,
                                p_curriculum: editing.curriculum_version,
                                p_plans: editing.plans,
                                p_status: editing.status,
                              },
                            ),
                          );
                          setEditing(null);
                        })}
                    >
                      Kaydet
                    </button>
                    <button
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => setEditing(null)}
                    >
                      Vazgeç
                    </button>
                  </div>
                </Card>
              )
              : null}
            <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside>
                <Card title="Koleksiyonlar">
                  {data?.collections.map((c) => (
                    <div
                      key={c.id}
                      className="mb-3 border-b border-slate-100 pb-3"
                    >
                      <button
                        aria-pressed={selected === c.id}
                        className={`min-h-12 w-full rounded-xl px-3 text-left font-semibold ${
                          selected === c.id
                            ? "bg-brand text-white"
                            : "text-brand"
                        }`}
                        onClick={() => setSelected(c.id)}
                      >
                        {c.title}
                      </button>
                      <p className="text-sm text-slate-500">
                        {c.grade}. sınıf · {c.subject} ·{" "}
                        {c.status === "published"
                          ? "Yayında"
                          : "Taslak / arşiv"}
                      </p>
                      <button
                        className="mt-2 text-sm text-brand"
                        onClick={() => setEditing({ ...c })}
                      >
                        Düzenle
                      </button>
                    </div>
                  ))}
                  {data && !data.collections.length
                    ? <p>İlk koleksiyonunuzu oluşturun.</p>
                    : null}
                </Card>
              </aside>
              <div>
                {collection
                  ? (
                    <>
                      <Card title={`${collection.title} · Yeni açık uçlu soru`}>
                        <p className="mb-4 text-sm text-slate-500">
                          Soru taslak olarak kaydedilir. Beklenen cevap ve
                          çözümü inceleyip ardından yayımlayın.
                        </p>
                        {([["topic", "Konu"], ["stem", "Soru"], [
                          "answer",
                          "Beklenen cevap",
                        ], [
                          "solution",
                          "Çözüm ve puanlama gerekçesi",
                        ]] as const).map(([key, label]) => (
                          <label key={key} className="label mb-4">
                            {label}
                            <textarea
                              className="input"
                              value={question[key]}
                              onChange={(e) =>
                                setQuestion({
                                  ...question,
                                  [key]: e.target.value,
                                })}
                            />
                          </label>
                        ))}
                        <button
                          className="btn"
                          disabled={busy ||
                            Object.values(question).some((x) => !x.trim())}
                          onClick={() =>
                            void run(async () => {
                              unwrap(
                                await supabase().rpc("admin_add_library_item", {
                                  p_collection_id: selected,
                                  p_content: {
                                    grade: collection.grade,
                                    subject: collection.subject,
                                    topic: question.topic,
                                    kind: "open_ended",
                                    difficulty: "orta",
                                    stem: question.stem,
                                    expected_answer: question.answer,
                                    solution: question.solution,
                                    choices: null,
                                    correct_key: null,
                                  } as Json,
                                }),
                              );
                              setQuestion({
                                topic: "",
                                stem: "",
                                answer: "",
                                solution: "",
                              });
                            })}
                        >
                          Taslağı kaydet
                        </button>
                      </Card>
                      {data?.items.filter((i) => i.collection_id === selected)
                        .map((i) => (
                          <Card key={i.id} title={i.content.topic}>
                            <Question content={i.content} />
                            <button
                              className="btn-secondary mt-4"
                              disabled={busy}
                              onClick={() =>
                                void run(async () =>
                                  unwrap(
                                    await supabase().rpc(
                                      "admin_publish_library_item",
                                      {
                                        p_id: i.id,
                                        p_published: i.status !== "published",
                                      },
                                    ),
                                  )
                                )}
                            >
                              {i.status === "published"
                                ? "Yayından kaldır"
                                : "İnceledim, yayımla"}
                            </button>
                          </Card>
                        ))}
                    </>
                  )
                  : (
                    <Card>
                      <p>İçeriğini görmek için bir koleksiyon seçin.</p>
                    </Card>
                  )}
              </div>
            </div>
          </>
        )
        : null}
      {tab === "policy" && data
        ? (
          <LibraryPolicy
            quotas={data.quotas}
            rewards={data.rewards}
            reload={reload}
            failed={setMessage}
          />
        )
        : null}
      {tab === "review"
        ? (
          <>
            <Card title="Velilerden gelen katkılar">
              <p className="mb-4 text-slate-600">
                Yalnız açık paylaşım onayı verilmiş soru kopyaları burada
                görünür. Telif, kişisel bilgi, doğru cevap ve öğrenme düzeyini
                kontrol edin.
              </p>
              {data?.submissions.filter((s) => s.status === "pending").map(
                (s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 border-t border-slate-100 py-4"
                  >
                    <div>
                      <strong>
                        {s.content.subject} · {s.content.grade}. sınıf
                      </strong>
                      <p className="max-w-2xl text-sm text-slate-600">
                        {s.content.stem.slice(0, 160)}
                      </p>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setReview(s);
                        setNote("");
                      }}
                    >
                      İncele
                    </button>
                  </div>
                ),
              )}
              {data && !data.submissions.some((s) => s.status === "pending")
                ? <p className="py-4">İnceleme bekleyen katkı yok.</p>
                : null}
            </Card>
            {review
              ? (
                <Card title="Katkıyı değerlendir">
                  <Question content={review.content} />
                  <label className="label mt-4">
                    Kabul edilecek koleksiyon<select
                      className="input"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      <option value="">Koleksiyon seçin</option>
                      {data?.collections.filter((c) =>
                        c.grade === review.content.grade &&
                        c.subject === review.content.subject
                      ).map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </label>
                  <label className="label mt-4">
                    Veliye görünecek değerlendirme notu<textarea
                      className="input"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={2000}
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {[true, false].map((approve) => (
                      <button
                        key={String(approve)}
                        className={approve ? "btn" : "btn-secondary"}
                        disabled={busy || note.trim().length < 3 ||
                          approve && !selected}
                        onClick={() =>
                          void run(async () => {
                            unwrap(
                              await supabase().rpc(
                                "admin_review_contribution",
                                {
                                  p_id: review.id,
                                  p_approve: approve,
                                  p_collection_id: selected ||
                                    "00000000-0000-0000-0000-000000000000",
                                  p_note: note,
                                },
                              ),
                            );
                            setReview(null);
                          })}
                      >
                        {approve
                          ? "Kabul et, kütüphane taslağına ekle"
                          : "Gerekçeyle reddet"}
                      </button>
                    ))}
                    <button
                      className="btn-secondary"
                      onClick={() => setReview(null)}
                      disabled={busy}
                    >
                      Kapat
                    </button>
                  </div>
                </Card>
              )
              : null}
          </>
        )
        : null}
    </Layout>
  );
}
function Question({ content: q }: { content: Content }) {
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-lg">{q.stem}</p>
      {q.choices?.map((c) => <p key={c.key}>{c.key}. {c.text}</p>)}
      <p className="rounded-xl bg-brand-light p-3">
        Beklenen cevap: {q.correct_key || q.expected_answer}
      </p>
      <p className="whitespace-pre-wrap text-slate-600">{q.solution}</p>
    </div>
  );
}
