import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  type CohortCriterion,
  type CohortReviewCommand,
  cohortReviewCommandSchema,
  validCohortPoints,
} from "@gina/core";
import { Card, Layout, Notice } from "@/components/Layout";
import {
  type CohortImage,
  CohortNotebookViewer,
} from "@/components/cohort-notebook";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";
import { createLibraryQueue } from "@/lib/library-review";
import { fmtDateTime } from "@/lib/format";
import { adminRpc } from "@/lib/admin-rpc";
import {
  type GroupPhases,
  nextEntry,
  normalizeSearch,
  participationPhase,
  questionState,
  type QueueEntry,
  rankingReasonText,
  reviewPhase,
} from "@/lib/cohort-text";
interface Queue {
  review_open: boolean;
  group: {
    id: string;
    title: string;
    subject: string;
    grade: number;
    ends_at: string;
    status: string;
  };
  state: {
    participants: number;
    pending: number;
    unfinished: number;
    appeals: number;
    version: number;
    fingerprint: string;
    published: boolean;
  };
  entries: QueueEntry[];
}
interface Question {
  ord: number;
  question_id: string;
  question: {
    stem: string;
    kind: string;
    choices?: { key: string; text: string }[];
    correct_key?: string;
    expected_answer?: string;
    solution?: string;
    rubric?: { criteria: CohortCriterion[]; scoring: string };
    group_source?: { title: string; body: string };
  };
  answer_hash: string;
  answer_text: string | null;
  answer_document: unknown;
  answer_key: string | null;
  maximum: number;
  points: number | null;
  reviewed: boolean;
  revision: number;
  outcome: string;
  feedback: string | null;
  criterion_points: Record<string, number> | null;
  images: { source_id: string }[];
  history?: {
    kind: "review" | "appeal";
    created_at: string;
    body: {
      revision: number;
      points?: number | null;
      feedback?: string;
      response?: string | null;
      reason?: string;
      outcome?: string;
    };
  }[];
  appeal: {
    revision: number;
    status: string;
    reason: string;
    response: string | null;
  } | null;
}
interface Detail {
  images: CohortImage[];
  entry: string;
  alias: string;
  group: string;
  questions: Question[];
}
export default function CohortReview() {
  const { session } = useAuth();
  const router = useRouter();
  const group = typeof router.query.group === "string"
    ? router.query.group
    : "";
  return (
    <Layout title="Birlikte Prova · İnceleme" compact roles={["content"]}>
      {session && group
        ? (
          <Workspace
            key={session.user.id + group}
            user={session.user.id}
            group={group}
          />
        )
        : <Link href="/groups" className="btn-secondary">Prova seç</Link>}
    </Layout>
  );
}
function Workspace({ user, group }: { user: string; group: string }) {
  const queue = useMemo(
    () =>
      createLibraryQueue(
        user,
        "cohort-review:" + group,
        (v) => cohortReviewCommandSchema.parse(v),
      ),
    [user, group],
  );
  const [pending, setPending] = useState<CohortReviewCommand | null>(null),
    [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [saved, setSaved] = useState(""),
    [entry, setEntry] = useState(""),
    [ord, setOrd] = useState(1),
    [confirmPublish, setConfirmPublish] = useState(false),
    [dirty, setDirty] = useState(false),
    [reset, setReset] = useState(0),
    [search, setSearch] = useState(""),
    [focus, setFocus] = useState<"pending" | "appeal" | null>(null),
    [queueNote, setQueueNote] = useState("");
  const gate = useRef(false);
  useEffect(() => {
    let active = true;
    void queue.restore().then((v) => {
      if (active) {
        setPending(v);
        if (v?.action === "review") {
          setEntry(v.entry);
          setOrd(v.ord);
        }
      }
    }).catch(() => {
      if (active) setStorageError(true);
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [queue]);
  const list = useAdminQuery(
    async () =>
      unwrap(
        await supabase().rpc("admin_cohort_review_queue", { p_group: group }),
      ) as unknown as Queue,
    [user, group],
  );
  const phases = useAdminQuery(
    async () =>
      await adminRpc("group_exam_phases", { p_group: group }) as GroupPhases,
    [user, group],
  );
  const detail = useAdminQuery(
    async () =>
      entry
        ? unwrap(
          await supabase().rpc("admin_cohort_review_detail", {
            p_entry: entry,
          }),
        ) as unknown as Detail
        : null,
    [user, entry],
  );
  // Kuyruktan gelindiyse kayıt açılınca ilgili (itirazlı / incelenmemiş) soruya git.
  if (focus && detail.data?.entry === entry && !detail.loading) {
    const target = detail.data.questions.find((x) =>
      focus === "appeal"
        ? x.appeal?.status === "open"
        : x.question.kind === "open_ended" && !x.reviewed
    );
    setFocus(null);
    if (target && target.ord !== ord) setOrd(target.ord);
  }
  const q = detail.data?.entry === entry
    ? detail.data.questions.find((x) => x.ord === ord)
    : undefined;
  const entries = list.data?.entries ?? [];
  const term = normalizeSearch(search);
  const visible = term
    ? entries.filter((e) => normalizeSearch(e.alias).includes(term))
    : entries;
  const openEntry = (id: string, intent: "pending" | "appeal" | null) => {
    setEntry(id);
    setOrd(1);
    setFocus(intent);
  };
  const goNext = (kind: "pending" | "appeal") => {
    const found = nextEntry(
      entries,
      entry,
      kind === "appeal"
        ? (e) => e.appeals > 0
        : (e) => e.pending > 0 && e.attempt_status !== "in_progress",
    );
    if (!found) {
      setQueueNote(
        kind === "appeal"
          ? "Açık itirazlı kayıt kalmadı."
          : "İncelenmemiş kayıt kalmadı.",
      );
      return;
    }
    setQueueNote("");
    setSearch("");
    openEntry(found.entry_id, kind);
  };
  async function send(c: CohortReviewCommand) {
    if (gate.current || storageError || !ready) return;
    gate.current = true;
    setBusy(true);
    setMessage("");
    setSaved("");
    try {
      await queue.prepare(c);
      setPending(c);
      const res = c.action === "review"
        ? await supabase().rpc("admin_save_cohort_review", {
          p_request: c.request,
          p_entry: c.entry,
          p_ord: c.ord,
          p_revision: c.revision,
          p_answer_hash: c.hash,
          p_points: c.points,
          p_outcome: c.outcome,
          p_feedback: c.feedback,
          p_appeal_revision: c.appealRevision ?? undefined,
          p_response: c.response ?? undefined,
        }).abortSignal(AbortSignal.timeout(25000))
        : await supabase().rpc("admin_publish_cohort_results", {
          p_request: c.request,
          p_group: c.group,
          p_fingerprint: c.fingerprint,
          p_version: c.version,
        }).abortSignal(AbortSignal.timeout(25000));
      if (res.error) {
        if (/^(P0001|42501|22\w{3}|23\w{3})$/.test(res.error.code ?? "")) {
          await queue.acknowledge(c.request);
          setPending(null);
        }
        throw res.error;
      }
      const data = res.data as Record<string, unknown> | null;
      if (
        !data ||
        (c.action === "review"
          ? (data.entry !== c.entry || data.ord !== c.ord ||
            data.revision !== c.revision + 1)
          : (data.group !== c.group || data.version !== c.version + 1))
      ) throw Error("receipt");
      await queue.acknowledge(c.request);
      setPending(null);
      setConfirmPublish(false);
      setDirty(false);
      setSaved(
        c.action === "review"
          ? "İnceleme kaydedildi. Sonuç yayını ayrı adımdır."
          : "Sonuçlar yayımlandı.",
      );
      list.reload();
      detail.reload();
      phases.reload();
    } catch (e) {
      const code = (e as Error).message;
      setMessage(
        code === "group_review_changed"
          ? "İnceleme veya sonuç sürümü değişti. Güncel kaydı yeniden açın."
          : code === "group_review_incomplete"
          ? "Eksik inceleme, açık itiraz veya kapanmamış çalışma var. Yayın yapılmadı."
          : code === "group_answer_present"
          ? "Bu cevapta yazı veya çizim var; “cevap yok” olarak kaydedilemez."
          : code === "forbidden"
          ? "Bu işlem için güncel yönetici yetkisi gerekiyor."
          : "İşlem tamamlanamadı. Bekleyen kayıt varsa aynı isteğin sonucunu kontrol edin.",
      );
      list.reload();
      detail.reload();
      phases.reload();
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  const locked = busy || !!pending || storageError || !ready;
  const canPublish = !!list.data && list.data.group.status === "published" &&
    list.data.review_open &&
    list.data.state.participants > 0 && list.data.state.pending === 0 &&
    list.data.state.unfinished === 0 && list.data.state.appeals === 0 &&
    !list.data.state.published;
  return (
    <>
      <Link
        href="/groups"
        className="inline-flex min-h-12 items-center font-bold text-purple-700"
      >
        ← Birlikte Prova
      </Link>
      <h1 className="mb-2 text-2xl font-extrabold">
        {list.data?.group.title ?? "Cevap inceleme"}
      </h1>
      <p className="mb-5 max-w-3xl text-slate-600">
        Çocuğun açıklamasını ve çizimini birlikte değerlendirin. Yazı güzelliği
        veya hız puanlanmaz. Veli notları bu ortak puanı değiştirmez.
      </p>
      {storageError
        ? (
          <Notice tone="error">
            İşlem kaydı saklanamıyor. Kaydetme kapalı; tarayıcı depolamasını
            kontrol edin.
          </Notice>
        )
        : null}
      {message ? <Notice tone="error">{message}</Notice> : null}
      {saved ? <Notice tone="ok">{saved}</Notice> : null}
      {dirty && !pending
        ? (
          <Notice>
            Değişikliklerin henüz kaydedilmedi. Önce kaydet veya{" "}
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setDirty(false);
                setReset((v) => v + 1);
              }}
            >
              Bu düzenlemeyi bırak
            </button>
          </Notice>
        )
        : null}
      {pending
        ? (
          <Card title="Gönderim kaydı korunuyor">
            <p>
              Aynı işlemi kontrol etmek ikinci bir inceleme veya yayın
              oluşturmaz.
            </p>
            <button
              className="btn mt-3"
              disabled={busy || storageError}
              onClick={() => void send(pending)}
            >
              Kaydın sonucunu kontrol et
            </button>
          </Card>
        )
        : null}
      {list.error || detail.error
        ? (
          <Notice tone="error">
            Veriler açılamadı. Katılım süresi ve çocuğun çalışması bitmeden
            cevaplar incelemeye açılmaz.{" "}
            <button
              className="btn-secondary"
              onClick={() => {
                list.reload();
                detail.reload();
              }}
            >
              Yeniden yükle
            </button>
          </Notice>
        )
        : null}
      {list.loading ? <p role="status">İnceleme durumu yükleniyor…</p> : null}
      {list.data
        ? (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [list.data.state.participants, "Katılımcı"],
                [
                  list.data.state.pending,
                  "İnceleme bekliyor (okunamayanlar dahil)",
                ],
                [list.data.state.appeals, "Açık itiraz"],
                [
                  list.data.state.published ? "Yayımlandı" : "Taslak",
                  "Sonuç durumu",
                ],
              ].map(([v, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-purple-100 bg-white p-4"
                >
                  <strong className="block text-2xl text-purple-700">
                    {v}
                  </strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {phases.data ? <PhasesCard p={phases.data} /> : null}
            {phases.error
              ? (
                <Notice tone="error">
                  Aşama ve sıralama özeti açılamadı. İnceleme kuyruğu yine de
                  kullanılabilir.
                </Notice>
              )
              : null}
            <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
              <Card title="Cevaplar">
                <p className="mb-3 text-sm text-slate-600">
                  Takma ad kullanılır. Aile ve çocuk adı bu incelemeye taşınmaz.
                </p>
                <div className="mb-3 grid gap-2">
                  <button
                    className="btn"
                    data-testid="cohort-next-unreviewed"
                    disabled={locked || dirty || !list.data.review_open}
                    onClick={() => goNext("pending")}
                  >
                    Sıradaki incelenmemiş
                  </button>
                  <button
                    className="btn-secondary"
                    data-testid="cohort-next-appeal"
                    disabled={locked || dirty || !list.data.review_open}
                    onClick={() => goNext("appeal")}
                  >
                    Sıradaki itiraz
                  </button>
                </div>
                {!list.data.review_open
                  ? (
                    <p className="mb-3 text-sm text-slate-600">
                      Katılım penceresi kapanmadan cevaplar incelemeye açılmaz.
                    </p>
                  )
                  : null}
                {queueNote
                  ? <p role="status" className="mb-3 text-sm">{queueNote}</p>
                  : null}
                <label className="label">
                  Takma adla ara<input
                    className="input"
                    data-testid="cohort-search"
                    type="search"
                    value={search}
                    placeholder="Örn. Kâşif 1a2b"
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <p className="my-2 text-sm text-slate-600" aria-live="polite">
                  {term
                    ? `${visible.length} / ${entries.length} kayıt`
                    : `${entries.length} kayıt`}
                </p>
                {!list.data.entries.length
                  ? <p>Henüz cevaplayan katılımcı yok.</p>
                  : null}
                {term && !visible.length && entries.length
                  ? <p>Bu takma adla kayıt bulunamadı.</p>
                  : null}
                {visible.map((e) => (
                  <button
                    key={e.entry_id}
                    disabled={locked || dirty}
                    onClick={() => openEntry(e.entry_id, null)}
                    aria-pressed={entry === e.entry_id}
                    className={"mb-2 w-full rounded-2xl border p-3 text-left " +
                      (entry === e.entry_id
                        ? "border-purple-400 bg-purple-50"
                        : "border-slate-200 bg-white")}
                  >
                    <strong>{e.alias}</strong>
                    <span className="mt-1 block text-sm">
                      {e.attempt_status === "in_progress"
                        ? "Çalışma bitmedi · incelenemez"
                        : e.pending || e.appeals
                        ? `${e.pending} inceleme bekliyor · ${e.appeals} itiraz`
                        : "Tamamlandı"}
                    </span>
                  </button>
                ))}
              </Card>
              <div>
                {entry
                  ? (
                    <>
                      <nav
                        aria-label="Sorular"
                        className="mb-4 flex flex-wrap gap-2"
                      >
                        {detail.data?.entry === entry
                          ? detail.data.questions.map((x) => {
                            const st = questionState({
                              kind: x.question.kind,
                              reviewed: x.reviewed,
                              outcome: x.outcome,
                              appealOpen: x.appeal?.status === "open",
                            });
                            return (
                              <button
                                key={x.ord}
                                className={ord === x.ord
                                  ? "btn"
                                  : "btn-secondary"}
                                disabled={locked || dirty}
                                aria-current={ord === x.ord ? "true" : undefined}
                                onClick={() => setOrd(x.ord)}
                              >
                                {x.ord}. soru ·{" "}
                                <span
                                  className={st.tone === "warn"
                                    ? "text-amber-800"
                                    : undefined}
                                >
                                  {st.label}
                                </span>
                              </button>
                            );
                          })
                          : null}
                      </nav>
                      {detail.loading ? <p>Çözüm yükleniyor…</p> : q
                        ? (
                          <ReviewQuestion
                            key={`${entry}:${ord}:${q.revision}:${reset}`}
                            q={q}
                            images={(detail.data?.images ?? []).filter((im) =>
                              q.images.some((link) =>
                                link.source_id === im.source_id
                              )
                            )}
                            dirty={() => setDirty(true)}
                            locked={locked || !!detail.error || !!list.error ||
                              list.data.group.status !== "published"}
                            save={(v) =>
                              void send(
                                cohortReviewCommandSchema.parse({
                                  action: "review",
                                  request: crypto.randomUUID(),
                                  entry,
                                  ord,
                                  revision: q.revision,
                                  hash: q.answer_hash,
                                  ...v,
                                }),
                              )}
                          />
                        )
                        : null}
                    </>
                  )
                  : (
                    <Card title="Bir cevap seçin">
                      <p>
                        Soldan bir katılımcı seçerek soru, çözüm ve sabit
                        puanlama ölçütlerini yan yana inceleyin.
                      </p>
                    </Card>
                  )}
              </div>
            </div>
            <Card title="Sonuçları ailelere aç">
              <p>
                {list.data.state.published
                  ? "Güncel sonuçlar ailelere açık. Yeni inceleme veya itiraz, kesin sıralamayı yeniden incelemeye alır."
                  : "Bütün incelemeler ve itirazlar tamamlanmadan kesin puan ve sıralama yayımlanmaz. Puanı kaydetmek sonuç yayımlamaz."}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>
                  Yayın, ailelere bu inceleme sürümündeki puanları ve geri
                  bildirimleri açar; çocuğun özgün cevabı değişmez.
                </li>
                <li>
                  Yayından sonra bir cevap yeniden değerlendirilirse veya itiraz
                  açılırsa sonuçlar yeniden taslağa döner; kesin sıralama yeni
                  sürüm yayımlanana kadar gösterilmez.
                </li>
                <li>
                  Okunamayan, puanlanmamış veya bitmemiş kayıtlar kesin
                  sıralamaya girmez. Sıralama isteğe bağlıdır ve sonuçtan sonra
                  ikincil gösterilir.
                </li>
              </ul>
              {canPublish
                ? (
                  <>
                    <label className="my-3 flex min-h-12 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={confirmPublish}
                        disabled={locked}
                        onChange={(e) => setConfirmPublish(e.target.checked)}
                      />{" "}
                      Ölçütleri ve sonuçları kontrol ettim; bu sürümü ailelere
                      açıyorum.
                    </label>
                    <button
                      className="btn"
                      disabled={locked || dirty || !confirmPublish}
                      onClick={() =>
                        void send({
                          action: "publish",
                          request: crypto.randomUUID(),
                          group,
                          fingerprint: list.data!.state.fingerprint,
                          version: list.data!.state.version,
                        })}
                    >
                      Sonuçları yayımla
                    </button>
                  </>
                )
                : null}
            </Card>
          </>
        )
        : null}
    </>
  );
}
function ReviewQuestion({
  q,
  images,
  locked,
  dirty,
  save,
}: {
  q: Question;
  images: CohortImage[];
  locked: boolean;
  dirty: () => void;
  save: (
    v: {
      points: Record<string, number>;
      outcome: "scored" | "not_answered" | "unreadable";
      feedback: string;
      appealRevision: number | null;
      response: string | null;
    },
  ) => void;
}) {
  const criteria = q.question.rubric?.criteria ?? [];
  const [points, setPoints] = useState<Record<string, number>>(
      q.criterion_points ?? Object.fromEntries(criteria.map((c) => [c.id, 0])),
    ),
    [outcome, setOutcome] = useState<"scored" | "not_answered" | "unreadable">(
      ["scored", "not_answered", "unreadable"].includes(q.outcome)
        ? q.outcome as "scored"
        : "scored",
    ),
    [feedback, setFeedback] = useState(q.feedback ?? ""),
    [response, setResponse] = useState("");
  const open = q.appeal?.status === "open";
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {q.outcome === "unreadable"
        ? (
          <div className="lg:col-span-2">
            <Notice>
              Okunamadı — puan verilmedi. Bu cevap boş veya sıfır sayılmaz;
              puanlanana kadar kesin sıralamaya girmez.
            </Notice>
          </div>
        )
        : null}
      <Card title={`${q.ord}. soru · Gönderilen çözüm`}>
        {q.question.group_source
          ? (
            <div className="mb-4 rounded-2xl bg-purple-50 p-4">
              <strong>{q.question.group_source.title}</strong>
              <p className="whitespace-pre-wrap">
                {q.question.group_source.body}
              </p>
            </div>
          )
          : null}
        <h3 className="mb-4 text-lg font-bold">{q.question.stem}</h3>
        {images.map((im) => (
          <figure key={im.source_id} className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={"data:image/png;base64," + im.png}
              width={im.width}
              height={im.height}
              alt={im.alt}
              className="h-auto max-h-80 max-w-full object-contain"
            />
          </figure>
        ))}
        {q.question.choices?.map((c) => (
          <p
            key={c.key}
            className={"mb-2 rounded-xl p-3 " +
              (c.key === q.answer_key ? "bg-purple-100" : "bg-slate-50")}
          >
            {c.key}. {c.text}
            {c.key === q.answer_key ? " · Seçilen" : ""}
          </p>
        ))}
        {q.answer_text
          ? (
            <p className="mb-4 whitespace-pre-wrap rounded-2xl bg-emerald-50 p-4">
              {q.answer_text}
            </p>
          )
          : (
            <p className="mb-3 text-sm text-slate-500">
              Yazılı metin yok. Çizimi de kontrol edin.
            </p>
          )}
        <CohortNotebookViewer value={q.answer_document} images={images} />
        {q.history?.length
          ? (
            <details className="mt-4 rounded-2xl border border-purple-100 p-4">
              <summary className="cursor-pointer font-bold">
                İnceleme geçmişi · {q.history.length} kayıt
              </summary>
              <ol className="mt-3 space-y-3">
                {q.history.map((event, index) => (
                  <li
                    key={index}
                    className="border-t border-purple-100 pt-3 text-sm"
                  >
                    <p className="font-bold">
                      {event.kind === "review"
                        ? "Değerlendirme"
                        : "Veli itirazı"} · sürüm {event.body.revision}
                    </p>
                    <time dateTime={event.created_at}>
                      {new Date(event.created_at).toLocaleString("tr-TR")}
                    </time>
                    {event.kind === "review"
                      ? (
                        <p>
                          {event.body.points == null
                            ? "Puan bekletildi"
                            : `${event.body.points} / ${q.maximum} puan`}
                        </p>
                      )
                      : null}
                    <p className="whitespace-pre-wrap">
                      {event.body.feedback ?? event.body.reason}
                    </p>
                    {event.body.response
                      ? (
                        <p className="mt-2 whitespace-pre-wrap">
                          İtiraza yanıt: {event.body.response}
                        </p>
                      )
                      : null}
                  </li>
                ))}
              </ol>
            </details>
          )
          : null}
      </Card>
      <Card
        title={q.question.kind !== "open_ended"
          ? "Otomatik cevap kontrolü"
          : "Sabit puanlama ölçütleri"}
      >
        {q.question.kind !== "open_ended"
          ? (
            <>
              {q.question.kind === "multiple_choice" && <p>Doğru seçenek: {q.question.correct_key}</p>}
              <p className="mt-3 font-bold">{q.points == null ? "Puan bekleniyor" : `${q.points.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} / ${q.maximum} puan`}</p>
              <p>Otomatik hesaplanan ortak puan elle değiştirilmez.</p>
            </>
          )
          : (
            <>
              <p className="mb-3 whitespace-pre-wrap">
                {q.question.expected_answer}
              </p>
              <p className="mb-4 text-sm text-slate-600">
                {q.question.rubric?.scoring}
              </p>
              {q.appeal
                ? (
                  <Notice>
                    <strong>
                      {open ? "Velinin itirazı" : "Önceki itiraz yanıtlandı"}
                    </strong>
                    <p className="whitespace-pre-wrap">{q.appeal.reason}</p>
                    {q.appeal.response
                      ? (
                        <p className="mt-2 whitespace-pre-wrap">
                          {q.appeal.response}
                        </p>
                      )
                      : null}
                  </Notice>
                )
                : null}
              <fieldset disabled={locked}>
                <label className="label">
                  Cevabın durumu<select
                    className="input"
                    value={outcome}
                    onChange={(e) => {
                      dirty();
                      const v = e.target.value as typeof outcome;
                      setOutcome(v);
                      if (v !== "scored") {
                        setPoints(
                          Object.fromEntries(criteria.map((c) => [c.id, 0])),
                        );
                      }
                    }}
                  >
                    <option value="scored">Ölçütlerle değerlendir</option>
                    <option value="not_answered">Cevap gönderilmemiş</option>
                    <option value="unreadable">
                      Okunamadı · puan vermeden beklet
                    </option>
                  </select>
                </label>
                {criteria.map((c) => (
                  <label
                    key={c.id}
                    className="my-3 flex items-center gap-3 rounded-2xl border border-purple-100 p-3"
                  >
                    <span className="flex-1">{c.criterion}</span>
                    <select
                      aria-label={c.criterion + " puanı"}
                      className="input !w-20"
                      disabled={outcome !== "scored"}
                      value={points[c.id] ?? 0}
                      onChange={(e) => {
                        dirty();
                        setPoints({
                          ...points,
                          [c.id]: Number(e.target.value),
                        });
                      }}
                    >
                      {Array.from(
                        { length: c.points + 1 },
                        (_, i) => <option key={i}>{i}</option>,
                      )}
                    </select>
                    <span>/ {c.points}</span>
                  </label>
                ))}
                <p className="my-4 text-xl font-extrabold">
                  {outcome === "unreadable"
                    ? "Puan bekletiliyor"
                    : `${
                      Object.values(points).reduce((a, b) => a + b, 0)
                    } / ${q.maximum} puan`}
                </p>
                <label className="label">
                  Aileye gerekçeli geri bildirim<textarea
                    className="input min-h-28"
                    maxLength={4000}
                    value={feedback}
                    onChange={(e) => {
                      dirty();
                      setFeedback(e.target.value);
                    }}
                    placeholder="Cevaptaki kanıtı ve bir sonraki küçük adımı açıklayın."
                  />
                </label>
                {open
                  ? (
                    <label className="label mt-3">
                      İtiraza yanıt<textarea
                        className="input min-h-24"
                        maxLength={4000}
                        value={response}
                        onChange={(e) => {
                          dirty();
                          setResponse(e.target.value);
                        }}
                        placeholder="Hangi ölçütü yeniden değerlendirdiniz?"
                      />
                    </label>
                  )
                  : null}
                <button
                  className="btn mt-4 w-full"
                  disabled={locked || feedback.trim().length < 10 ||
                    !validCohortPoints(criteria, points, outcome) ||
                    (open && response.trim().length < 10)}
                  onClick={() =>
                    save({
                      points,
                      outcome,
                      feedback,
                      appealRevision: open ? q.appeal!.revision : null,
                      response: open ? response : null,
                    })}
                >
                  {open
                    ? "İncelemeyi ve itiraz yanıtını kaydet"
                    : "İncelemeyi kaydet"}
                </button>
                <p className="mt-3 text-sm text-slate-500">
                  Kayıt çocuğun özgün cevabını değiştirmez. Sonuç yayını ayrı
                  adımda yapılır.
                </p>
              </fieldset>
            </>
          )}
      </Card>
    </div>
  );
}

function PhasesCard({ p }: { p: GroupPhases }) {
  const excluded = Object.entries(p.ranking.excluded).filter(([, n]) => n > 0);
  return (
    <div
      className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      aria-label="Prova aşamaları"
    >
      <section className="rounded-2xl border border-purple-100 bg-white p-4">
        <h2 className="font-bold">Katılım penceresi</h2>
        <p>{participationPhase[p.participation.phase]}</p>
        <p className="text-sm text-slate-600">
          {fmtDateTime(p.participation.starts_at)} –{" "}
          {fmtDateTime(p.participation.ends_at)}
        </p>
        {p.participation.entries != null
          ? (
            <p className="text-sm text-slate-600">
              {p.participation.entries} katılım
            </p>
          )
          : null}
      </section>
      <section className="rounded-2xl border border-purple-100 bg-white p-4">
        <h2 className="font-bold">Çocuğun süresi</h2>
        <p>{p.child_time.duration_minutes} dakika · tek deneme</p>
        <p className="text-sm text-slate-600">
          Süre çocuk başladığında işler; katılım penceresi daha erken biterse
          orada durur.
        </p>
      </section>
      <section className="rounded-2xl border border-purple-100 bg-white p-4">
        <h2 className="font-bold">İnceleme</h2>
        <p>{reviewPhase[p.review.phase]}</p>
        {p.review.required
          ? (
            <p className="text-sm text-slate-600">
              {p.review.pending ?? 0} cevap bekliyor ·{" "}
              {p.review.unfinished ?? 0} bitmemiş çalışma ·{" "}
              {p.review.appeals ?? 0} açık itiraz
              {p.review.publication_version
                ? ` · yayın sürümü ${p.review.publication_version}`
                : ""}
            </p>
          )
          : null}
      </section>
      <section className="rounded-2xl border border-purple-100 bg-white p-4">
        <h2 className="font-bold">Sıralama · isteğe bağlı</h2>
        <p>{p.ranking.eligible_entries} kayıt kesin sıralamada</p>
        <p className="text-sm text-slate-600">
          Veli izni gerekir ve sonuçtan sonra ikincil gösterilir.
        </p>
        {excluded.length
          ? (
            <ul className="mt-2 text-sm" aria-label="Sıralamaya girmeyenler">
              {excluded.map(([reason, n]) => (
                <li key={reason}>
                  {n} · {rankingReasonText(reason)}
                </li>
              ))}
            </ul>
          )
          : null}
      </section>
    </div>
  );
}
