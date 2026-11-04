import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import {
  type ContributionDecision,
  contributionDecision,
  contributionDetail,
  contributionRow,
  type ContributionSnapshot,
  type Json,
  libraryTeacherSchema,
} from "@gina/core";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";
import { createLibraryQueue } from "@/lib/library-review";
import { Card, Notice } from "./Layout";
type Teacher = ContributionDecision["teachers"][string];
const statuses = {
  pending: "İnceleme bekliyor",
  approved: "Katkı kabul edildi",
  rejected: "Düzeltme gerekli",
  withdrawn: "Geri çekildi",
  preparing: "Görseller hazırlanıyor",
};
function initialTeacher(q: ContributionSnapshot["questions"][number]): Teacher {
  return {
    correct_key: q.kind === "multiple_choice"
      ? q.correct_key as Teacher["correct_key"]
      : null,
    expected_answer: q.expected_answer ??
      q.choices?.find((c) => c.key === q.correct_key)?.text ?? "",
    solution: q.solution,
    explanation: q.explanation ?? "",
    common_misconception: "",
    next_step: "",
    rubric: {
      max_points: 1,
      scoring:
        "Her ölçüt ayrı değerlendirilir. Eşdeğer doğru açıklamalar kabul edilir; yazı güzelliği veya hız puanlanmaz.",
      criteria: [{ id: "c1", points: 1, criterion: "" }],
      missing_answer:
        "Yanıt verilmedi; bundan tek başına öğrenme eksikliği sonucu çıkarılmaz.",
      review_required: true,
    },
  };
}
export function ContributionSets() {
  const { session } = useAuth();
  return session
    ? <Workspace key={session.user.id} user={session.user.id} />
    : null;
}
function Workspace({ user }: { user: string }) {
  const [zoom, setZoom] = useState(false);
  const zoomModal = useRef<HTMLDialogElement>(null);
  const router = useRouter(),
    queue = useMemo(
      () =>
        createLibraryQueue(
          user,
          "contribution",
          (v) => contributionDecision.parse(v),
        ),
      [user],
    );
  const [selected, setSelected] = useState<string | null>(null),
    [pending, setPending] = useState<ContributionDecision | null>(null),
    [ready, setReady] = useState(false),
    [blocked, setBlocked] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [teachers, setTeachers] = useState<Record<string, Teacher>>({}),
    [checked, setChecked] = useState<Record<string, boolean>>({}),
    [question, setQuestion] = useState(0),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [dirty, setDirty] = useState(false);
  const [leave, setLeave] = useState<(() => void) | null>(null),
    modal = useRef<HTMLDialogElement>(null);
  const list = useAdminQuery(async () =>
    contributionRow.array().parse(
      unwrap(await supabase().rpc("admin_list_contribution_sets")),
    )
  );
  const detail = useAdminQuery(
    async () =>
      selected
        ? contributionDetail.parse(
          unwrap(
            await supabase().rpc("admin_get_contribution_set", {
              p_id: selected,
            }),
          ),
        )
        : null,
    [selected],
  );
  const current =
    detail.data?.id === selected && !detail.error && !list.error &&
      !detail.loading
      ? detail.data
      : null;
  useEffect(() => {
    if (zoom && current?.media && !zoomModal.current?.open) {
      zoomModal.current?.showModal();
    } else if (!zoom || !current?.media) zoomModal.current?.close();
  }, [zoom, current?.media]);
  const questions = current?.snapshot.questions ?? [],
    q = questions[question],
    teacher = q ? teachers[q.key] ?? initialTeacher(q) : null;
  useEffect(() => {
    let alive = true;
    queue.restore().then((value) => {
      if (alive) {
        setPending(value);
        if (value) setSelected(value.id);
        setReady(true);
      }
    }).catch(() => {
      if (alive) {
        setBlocked(true);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [queue]);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const guard = useRef({ dirty, busy, pending });
  useEffect(() => {
    guard.current = { dirty, busy, pending };
  }, [dirty, busy, pending]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (guard.current.dirty && !guard.current.pending) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const request = (e: Event) => {
      if (!guard.current.dirty && !guard.current.busy) return;
      e.preventDefault();
      if (!guard.current.busy) {
        setLeave(() => () => {
          setDirty(false);
          (e as CustomEvent<() => void>).detail?.();
        });
      }
    };
    const discardAndGo = (href: string) => {
      guard.current.dirty = false;
      setDirty(false);
      void router.push(href);
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (
        !a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey ||
        e.shiftKey || e.altKey || a.target === "_blank" ||
        (!guard.current.dirty && !guard.current.busy)
      ) return;
      e.preventDefault();
      e.stopPropagation();
      if (!guard.current.busy) setLeave(() => () => discardAndGo(a.href));
    };
    router.beforePopState(({ as }) => {
      if (!guard.current.dirty && !guard.current.busy) return true;
      window.history.pushState(window.history.state, "", router.asPath);
      if (!guard.current.busy) setLeave(() => () => discardAndGo(as));
      return false;
    });
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", unload);
    window.addEventListener("gina:library-leave", request);
    window.addEventListener("gina:signout", request);
    return () => {
      document.removeEventListener("click", click, true);
      router.beforePopState(() => true);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("gina:library-leave", request);
      window.removeEventListener("gina:signout", request);
    };
  }, [router]);
  useEffect(() => {
    if (leave && !modal.current?.open) modal.current?.showModal();
    else if (!leave) modal.current?.close();
  }, [leave]);
  function choose(id: string) {
    const go = () => {
      setSelected(id);
      setTeachers({});
      setChecked({});
      setQuestion(0);
      setNote("");
      setConfirmed(false);
      setDirty(false);
      setMessage("");
    };
    if (dirty) setLeave(() => go);
    else go();
  }
  function patch(value: Partial<Teacher>) {
    if (!q || !teacher) return;
    setTeachers((v) => ({ ...v, [q.key]: { ...teacher, ...value } }));
    setChecked((v) => ({ ...v, [q.key]: false }));
    setConfirmed(false);
    setDirty(true);
  }
  function valid(t: Teacher) {
    return libraryTeacherSchema.safeParse(t).success &&
      t.rubric.criteria.reduce((n, c) => n + c.points, 0) ===
        t.rubric.max_points;
  }
  const allChecked = questions.length > 0 &&
    questions.every((q) =>
      checked[q.key] && teachers[q.key] && valid(teachers[q.key]!)
    );
  const locked = busy || !!pending || blocked || !ready;
  async function decide(approve: boolean) {
    if (busy || blocked || !ready) return;
    setBusy(true);
    setMessage("");
    let command = pending;
    try {
      if (!command) {
        if (
          !current || !confirmed || note.trim().length < 3 ||
          (approve && !allChecked)
        ) throw Error("contribution_review_required");
        command = contributionDecision.parse({
          request: crypto.randomUUID(),
          id: current.id,
          approve,
          note,
          teachers: approve ? teachers : {},
          confirmed: true,
        });
        await queue.prepare(command);
        if (!live.current) return;
        setPending(command);
        setDirty(false);
      }
      const { data, error } = await supabase().rpc(
        "admin_decide_contribution_set",
        {
          p_request_id: command.request,
          p_id: command.id,
          p_approve: command.approve,
          p_note: command.note,
          p_teachers: command.teachers as Json,
          p_confirmed: true,
        },
      ).abortSignal(AbortSignal.timeout(20000));
      if (error) {
        if (/^(P0001|22\w{3}|23\w{3})$/.test(error.code ?? "")) {
          await queue.acknowledge(command.request);
          if (live.current) setPending(null);
        }
        throw error;
      }
      if (
        !data || typeof data !== "object" || Array.isArray(data) ||
        data.id !== command.id ||
        data.status !== (command.approve ? "approved" : "rejected")
      ) throw Error("uncertain");
      await queue.acknowledge(command.request);
      if (!live.current) return;
      setPending(null);
      setMessage(
        command.approve
          ? "Katkı kabul edildi ve ayrı kütüphane taslağı oluşturuldu. Henüz yayımlanmadı."
          : "Gerekçeli inceleme sonucu kaydedildi.",
      );
      list.reload();
      detail.reload();
    } catch (error) {
      if (live.current) {
        const code = (error as { message?: string })?.message;
        setMessage(
          code === "contribution_changed"
            ? "Katkının durumu değişti. Güncel kaydı yeniden açın."
            : code === "forbidden"
            ? "İşlem yetkiniz doğrulanamadı. Oturumu kontrol edin."
            : "İşlem doğrulanamadı. Bekleyen bir kayıt varsa aynı işlemle yeniden kontrol edin; eksik alanlar varsa tamamlayın.",
        );
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section className="library-drafts contribution-review">
      <div className="library-intro">
        <div>
          <h2>Metin ve görsel katkıları</h2>
          <p>
            Ortak bağlamı, her sorunun cevabını ve paylaşım haklarını birlikte
            inceleyin. Kabul etmek yayınlamak değildir.
          </p>
        </div>
        <button
          className="btn-secondary"
          disabled={busy}
          onClick={() => {
            list.reload();
            detail.reload();
          }}
        >
          Yenile
        </button>
      </div>
      {message ? <Notice>{message}</Notice> : null}
      {blocked
        ? (
          <Notice tone="error">
            Bu tarayıcıda işlem kaydı okunamıyor. Aynı kaydın tekrar
            gönderilmemesi için işlem durduruldu.
          </Notice>
        )
        : null}
      {pending
        ? (
          <Notice>
            <p>
              Önceki {pending.approve ? "kabul" : "ret"}{" "}
              işleminin sonucunu kontrol edelim. Karar ve gerekçe korunuyor.
            </p>
            <button
              className="btn"
              disabled={busy || blocked}
              onClick={() => void decide(pending.approve)}
            >
              Aynı işlemi kontrol et
            </button>
          </Notice>
        )
        : null}
      {list.error || detail.error
        ? (
          <Notice tone="error">
            Katkılar veya işlem yetkisi doğrulanamadı. Görünüm gizlendi; yeniden
            deneyin.
          </Notice>
        )
        : null}
      {!list.error
        ? (
          <div className="grid min-w-0 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-3" aria-label="Katkı kuyruğu">
              {list.loading
                ? <p>Katkılar yükleniyor…</p>
                : !list.data?.length
                ? (
                  <Card title="Kuyruk boş">
                    <p>
                      Velilerin açıkça paylaştığı soru grupları burada
                      görünecek.
                    </p>
                  </Card>
                )
                : list.data.map((row) => (
                  <button
                    key={row.id}
                    className={"w-full rounded-2xl border p-4 text-left " +
                      (selected === row.id
                        ? "border-brand bg-brand-light"
                        : "border-slate-200 bg-white")}
                    disabled={locked}
                    onClick={() => choose(row.id)}
                  >
                    <strong className="block">{row.title}</strong>
                    <span className="block text-sm">
                      {row.subject} · {row.grade}. sınıf · {row.question_count}
                      {" "}
                      soru
                    </span>
                    <span className="block text-sm">
                      {statuses[row.status]}
                    </span>
                  </button>
                ))}
            </aside>
            <div className="min-w-0 space-y-5 contribution-detail">
              {selected && detail.loading
                ? <p>İnceleme kopyası açılıyor…</p>
                : current
                ? (
                  <>
                    <Card title={current.snapshot.title}>
                      <p className="whitespace-pre-wrap">
                        {current.snapshot.body}
                      </p>
                      {current.media
                        ? (
                          <Image
                            unoptimized
                            src={"data:image/png;base64," +
                              current.media.base64}
                            width={current.media.width}
                            height={current.media.height}
                            alt={current.snapshot.image_alts?.join("; ") ??
                              "Paylaşılan soru görseli"}
                            className="my-4 max-h-[320px] w-full rounded-2xl border object-contain"
                          />
                        )
                        : null}
                      {current.media
                        ? (
                          <button
                            className="btn-secondary mb-4"
                            onClick={() => setZoom(true)}
                          >
                            Paylaşılan görseli büyüt
                          </button>
                        )
                        : null}
                      <p className="text-sm text-slate-600">
                        Bu, paylaşım onayı verilmiş bağımsız kopyadır. Ailenin
                        diğer dosyalarına veya çocuğun çözüm defterine erişim
                        vermez.
                      </p>
                    </Card>
                    <Card title="Soru ve cevap incelemesi">
                      <div
                        className="mb-4 flex flex-wrap gap-2"
                        aria-label="Sorular"
                      >
                        {questions.map((v, index) => (
                          <button
                            className={question === index
                              ? "btn"
                              : "btn-secondary"}
                            key={v.key}
                            disabled={busy}
                            onClick={() => setQuestion(index)}
                          >
                            {index + 1}. soru{checked[v.key] ? " ✓" : ""}
                          </button>
                        ))}
                      </div>
                      {q && teacher
                        ? (
                          <>
                            <p className="whitespace-pre-wrap text-lg font-bold">
                              {q.stem}
                            </p>
                            {q.choices?.map((choice) => (
                              <p key={choice.key}>
                                {choice.key}. {choice.text}
                              </p>
                            ))}
                            <details className="my-4">
                              <summary className="cursor-pointer py-3 font-bold">
                                Velinin gönderdiği cevap ve çözüm
                              </summary>
                              <p>{q.correct_key ?? q.expected_answer}</p>
                              <p className="whitespace-pre-wrap">
                                {q.solution}
                              </p>
                            </details>
                            {current.status === "pending"
                              ? (
                                <fieldset
                                  disabled={locked}
                                  className="space-y-4"
                                >
                                  {q.kind === "multiple_choice"
                                    ? (
                                      <label className="label">
                                        Doğru seçenek<select
                                          className="input"
                                          value={teacher.correct_key ?? ""}
                                          onChange={(e) =>
                                            patch({
                                              correct_key: e.target
                                                .value as Teacher[
                                                  "correct_key"
                                                ],
                                            })}
                                        >
                                          {["A", "B", "C", "D"].map((k) => (
                                            <option key={k}>{k}</option>
                                          ))}
                                        </select>
                                      </label>
                                    )
                                    : null}
                                  {([
                                    ["expected_answer", "Beklenen cevap"],
                                    ["solution", "Çözüm"],
                                    ["explanation", "Çocuğa açıklama"],
                                    [
                                      "common_misconception",
                                      "Olası yanılgı veya henüz belirlenmediği bilgisi",
                                    ],
                                    [
                                      "next_step",
                                      "Sonraki küçük öğrenme adımı",
                                    ],
                                  ] as const).map(([field, label]) => (
                                    <label key={field} className="label">
                                      {label}
                                      <textarea
                                        className="input min-h-24"
                                        maxLength={field ===
                                              "expected_answer" ||
                                            field === "solution"
                                          ? 10000
                                          : field === "explanation"
                                          ? 4000
                                          : 2000}
                                        value={teacher[field]}
                                        onChange={(e) =>
                                          patch({ [field]: e.target.value })}
                                      />
                                    </label>
                                  ))}
                                  <div className="rounded-2xl bg-brand-light p-4">
                                    <h4>Puanlama ölçütleri</h4>
                                    <p className="mb-3 text-sm">
                                      Her ölçütün karşılığını yazın. Boş cevap,
                                      yazı güzelliği veya hızdan kişisel
                                      yeterlilik sonucu çıkarmayın.
                                    </p>
                                    {teacher.rubric.criteria.map((
                                      criterion,
                                      index,
                                    ) => (
                                      <div
                                        key={criterion.id}
                                        className="mb-3 grid grid-cols-[minmax(0,1fr)_80px] gap-3"
                                      >
                                        <label className="label">
                                          {index + 1}. ölçüt<textarea
                                            className="input"
                                            value={criterion.criterion}
                                            onChange={(e) =>
                                              patch({
                                                rubric: {
                                                  ...teacher.rubric,
                                                  criteria: teacher.rubric
                                                    .criteria.map((c, i) =>
                                                      i === index
                                                        ? {
                                                          ...c,
                                                          criterion:
                                                            e.target.value,
                                                        }
                                                        : c
                                                    ),
                                                },
                                              })}
                                          />
                                        </label>
                                        <label className="label">
                                          Puan<input
                                            className="input"
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={criterion.points}
                                            onChange={(e) => {
                                              const criteria = teacher.rubric
                                                .criteria.map((c, i) =>
                                                  i === index
                                                    ? {
                                                      ...c,
                                                      points: Number(
                                                        e.target.value,
                                                      ),
                                                    }
                                                    : c
                                                );
                                              patch({
                                                rubric: {
                                                  ...teacher.rubric,
                                                  criteria,
                                                  max_points: criteria.reduce(
                                                    (sum, c) => sum + c.points,
                                                    0,
                                                  ),
                                                },
                                              });
                                            }}
                                          />
                                        </label>
                                      </div>
                                    ))}
                                    <button
                                      className="btn-secondary"
                                      disabled={teacher.rubric.criteria
                                        .length >= 20}
                                      onClick={() =>
                                        patch({
                                          rubric: {
                                            ...teacher.rubric,
                                            max_points:
                                              teacher.rubric.max_points + 1,
                                            criteria: [
                                              ...teacher.rubric.criteria,
                                              {
                                                id: "c" +
                                                  (teacher.rubric.criteria
                                                    .length + 1),
                                                points: 1,
                                                criterion: "",
                                              },
                                            ],
                                          },
                                        })}
                                    >
                                      Ölçüt ekle
                                    </button>
                                    <p className="mt-3">
                                      Toplam {teacher.rubric.max_points} puan
                                    </p>
                                  </div>
                                  <label className="flex min-h-12 items-center gap-3 font-bold">
                                    <input
                                      type="checkbox"
                                      checked={!!checked[q.key]}
                                      disabled={!valid(teacher)}
                                      onChange={(e) => {
                                        setTeachers((v) => ({
                                          ...v,
                                          [q.key]: teacher,
                                        }));
                                        setChecked((v) => ({
                                          ...v,
                                          [q.key]: e.target.checked,
                                        }));
                                        setDirty(true);
                                      }}
                                    />Soruyu, görselini, cevabını ve düzeyini
                                    inceledim.
                                  </label>
                                </fieldset>
                              )
                              : (
                                <p className="rounded-2xl bg-brand-light p-4">
                                  {statuses[current.status]} —{" "}
                                  {current.review_note}
                                </p>
                              )}
                          </>
                        )
                        : null}
                    </Card>
                    {current.status === "pending"
                      ? (
                        <Card title="Katkı kararı">
                          <p>
                            Kabul, bu grubun bütün soruları için geçerlidir.
                            Özgün kabul edilen sorular katkı politikasına göre
                            sayılır. Ayrı taslağın yayın incelemesi daha sonra
                            yapılır.
                          </p>
                          <label className="label mt-4">
                            Veliye görünecek gerekçe<textarea
                              className="input"
                              disabled={locked}
                              value={note}
                              maxLength={2000}
                              onChange={(e) => {
                                setNote(e.target.value);
                                setDirty(true);
                              }}
                            />
                          </label>
                          <label className="my-4 flex min-h-12 items-center gap-3">
                            <input
                              type="checkbox"
                              disabled={locked}
                              checked={confirmed}
                              onChange={(e) => {
                                setConfirmed(e.target.checked);
                                setDirty(true);
                              }}
                            />Paylaşım hakkı ve kişisel bilgi kontrolünü de
                            yaparak bu kararı veriyorum.
                          </label>
                          <div className="flex flex-wrap gap-3">
                            <button
                              className="btn"
                              disabled={locked || !allChecked || !confirmed ||
                                note.trim().length < 3}
                              onClick={() => void decide(true)}
                            >
                              Kabul et ve taslak oluştur
                            </button>
                            <button
                              className="btn-secondary"
                              disabled={locked || !confirmed ||
                                note.trim().length < 3}
                              onClick={() => void decide(false)}
                            >
                              Gerekçeyle geri gönder
                            </button>
                          </div>
                        </Card>
                      )
                      : current.package_id
                      ? (
                        <button
                          className="btn"
                          onClick={() =>
                            void router.push({
                              pathname: "/library",
                              query: {
                                tab: "drafts",
                                packageId: current.package_id,
                              },
                            })}
                        >
                          Oluşturulan kütüphane taslağını aç
                        </button>
                      )
                      : null}
                  </>
                )
                : (
                  <Card title="Bir katkı seçin">
                    <p>
                      Önce ortak metin ve görseller, ardından sorular ve
                      cevaplar gösterilir.
                    </p>
                  </Card>
                )}
            </div>
          </div>
        )
        : null}
      <dialog
        ref={zoomModal}
        onCancel={() => setZoom(false)}
        className="max-h-[90vh] max-w-[95vw] overflow-auto rounded-3xl bg-[#fffdf9] p-5 backdrop:bg-black/30"
        aria-label="Paylaşılan görsel"
      >
        <button
          className="btn-secondary sticky top-0 mb-4"
          onClick={() => setZoom(false)}
        >
          Görseli kapat
        </button>
        {current?.media
          ? (
            <Image
              unoptimized
              src={"data:image/png;base64," + current.media.base64}
              width={current.media.width}
              height={current.media.height}
              alt={current.snapshot.image_alts?.join("; ") ?? "Soru görseli"}
              className="max-w-none"
            />
          )
          : null}
      </dialog>
      <dialog
        ref={modal}
        aria-label="Kaydedilmemiş inceleme"
        onCancel={() => setLeave(null)}
        className="max-w-md rounded-3xl bg-[#fffdf9] p-7 backdrop:bg-black/30"
      >
        <h3>İnceleme alanlarından çıkılsın mı?</h3>
        <p className="my-4">
          Henüz göndermediğiniz düzenlemeler kaybolur. Gönderilmiş bekleyen
          işlem ayrıca korunur.
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={() => setLeave(null)}>
            Burada kal
          </button>
          <button
            className="btn"
            onClick={() => {
              const go = leave;
              setLeave(null);
              setDirty(false);
              go?.();
            }}
          >
            Düzenlemeleri bırak
          </button>
        </div>
      </dialog>
    </section>
  );
}
