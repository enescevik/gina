import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  definitiveHelpFailure,
  libraryDetailSchema,
  libraryPackageRowSchema,
  libraryReviewSchema,
  localLibraryPreview,
  type LibraryCommand,
  type LibraryDetail,
  type LibraryFile,
  type LibraryPackageRow,
  type LibraryPending,
  type LibraryReview,
} from "@gina/core";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  clearLibraryCommands,
  createLibraryOutbox,
  libraryError,
  readLibraryFile,
  sendLibraryCommand,
} from "@/lib/library-review";
const outcomes = {
  unreviewed: "İncelenmedi",
  changes_requested: "Düzeltme gerekli",
  suitable: "Uygun",
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function field(value: unknown) {
  return typeof value === "string" ? value : "Belirtilmedi";
}
function sourceUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
type Form = {
  outcome: LibraryReview["outcome"];
  note: string;
  revision: number;
};
const emptyForm = (): Form => ({
  outcome: "unreviewed",
  note: "",
  revision: 0,
});
export function LibraryDrafts() {
  const { session } = useAuth();
  return session ? (
    <Workspace key={session.user.id} user={session.user.id} />
  ) : null;
}
function Workspace({ user }: { user: string }) {
  const router = useRouter();
  const [outbox, setOutbox] = useState(() => createLibraryOutbox(user));
  const [pending, setPending] = useState<LibraryPending | null>(null),
    [storageError, setStorageError] = useState(false),
    [restoring, setRestoring] = useState(true);
  const [access, setAccess] = useState<
    "checking" | "allowed" | "error" | "denied"
  >("checking");
  const [rows, setRows] = useState<LibraryPackageRow[]>([]),
    [cursor, setCursor] = useState<LibraryPackageRow | null>(null),
    [listBusy, setListBusy] = useState(false);
  const [tick, setTick] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [file, setFile] = useState<LibraryFile | null>(null);
  const [detail, setDetail] = useState<LibraryDetail | null>(null),
    [detailBusy, setDetailBusy] = useState(false),
    [detailError, setDetailError] = useState(false);
  const [reviews, setReviews] = useState<LibraryReview[]>([]),
    [question, setQuestion] = useState(0),
    [restoreQuestion, setRestoreQuestion] = useState<string | null>(null),
    [view, setView] = useState<"student" | "teacher" | "review">("student");
  const [form, setForm] = useState<Form | null>(null),
    [baseline, setBaseline] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [leave, setLeave] = useState<(() => void) | null>(null),
    [zoom, setZoom] = useState<string | null>(null);
  const serial = useRef(0),
    live = useRef(true),
    sending = useRef(false),
    accessNow = useRef(access);
  const input = useRef<HTMLInputElement>(null),
    modal = useRef<HTMLDialogElement>(null);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    accessNow.current = access;
  }, [access]);
  const deny = useCallback(() => {
    accessNow.current = "denied";
    setAccess("denied");
    serial.current++;
    setDetail(null);
    setFile(null);
    setSelected(null);
    setReviews([]);
    setForm(null);
    setBaseline(null);
    setPending(null);
    setZoom(null);
    setLeave(null);
    setBusy(false);
    void clearLibraryCommands().catch(() => setStorageError(true));
  }, []);
  useEffect(() => {
    let active = true;
    outbox
      .restore()
      .then((p) => {
        if (!active) return;
        setPending(p);
        setRestoring(false);
        if (p?.payload.action === "review") {
          setSelected(p.payload.package_id);
          setRestoreQuestion(p.payload.question_key);
          setView("review");
        }
        if (p?.payload.action === "import") {
          setFile(p.payload.file);
          setDetail(localLibraryPreview(p.payload.file));
        }
      })
      .catch(() => {
        if (active) {
          setRestoring(false);
          setStorageError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [outbox]);
  useEffect(() => {
    let active = true,
      sequence = 0;
    async function refresh() {
      const seq = ++sequence;
      setListBusy(true);
      try {
        const { data, error } = await supabase().rpc(
          "admin_list_library_draft_packages",
          {
            p_limit: 30,
            ...(cursor
              ? {
                  p_before_id: cursor.id,
                  p_before_created_at: cursor.created_at,
                }
              : {}),
          },
        );
        if (error) throw error;
        const next = libraryPackageRowSchema.array().parse(data);
        if (active && seq === sequence) {
          if (accessNow.current === "denied") {
            setOutbox(createLibraryOutbox(user));
            setRestoring(true);
          }
          accessNow.current = "allowed";
          setAccess("allowed");
          setRows(next);
        }
      } catch (e) {
        if (active && seq === sequence) {
          if ((e as { code?: string }).code === "42501") deny();
          else {
            accessNow.current = "error";
            setAccess("error");
          }
        }
      } finally {
        if (active && seq === sequence) setListBusy(false);
      }
    }
    void refresh();
    const foreground = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(foreground, 30000);
    window.addEventListener("focus", foreground);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", foreground);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [cursor, tick, deny, user]);
  const includeAnswers = view !== "student";
  useEffect(() => {
    if (!selected || access !== "allowed") return;
    let active = true;
    async function load() {
      setDetailBusy(true);
      setDetailError(false);
      await Promise.all([
        supabase().rpc("admin_get_library_import", {
          p_id: selected!,
          p_include_answers: includeAnswers,
        }),
        supabase().rpc("admin_get_library_reviews", {
          p_package_id: selected!,
        }),
      ])
        .then(([d, r]) => {
          if (d.error) throw d.error;
          if (r.error) throw r.error;
          const next = libraryDetailSchema.parse(d.data),
            revs = libraryReviewSchema.array().parse(r.data);
          if (
            next.id !== selected ||
            revs.some((r) => r.package_id !== selected)
          )
            throw Error("library_receipt_invalid");
          if (active) {
            setDetail(next);
            setReviews(revs);
          }
        })
        .catch((e) => {
          if (active) {
            if (e.code === "42501") deny();
            else setDetailError(true);
          }
        })
        .finally(() => {
          if (active) setDetailBusy(false);
        });
    }
    void load();
    return () => {
      active = false;
    };
  }, [selected, includeAnswers, tick, access, deny]);
  // Poll review state while open, but never silently replace an editor's draft.
  useEffect(() => {
    if (!selected || access !== "allowed") return;
    let active = true,
      seq = 0;
    async function refresh() {
      const n = ++seq;
      const { data, error } = await supabase().rpc(
        "admin_get_library_reviews",
        { p_package_id: selected! },
      );
      if (!active || n !== seq) return;
      if (error) {
        if (error.code === "42501") deny();
        else setDetailError(true);
        return;
      }
      try {
        setReviews(libraryReviewSchema.array().parse(data));
      } catch {
        setDetailError(true);
      }
    }
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected, access, deny]);
  if (detail && restoreQuestion) {
    const index = detail.questions.findIndex((q) => q.key === restoreQuestion);
    if (index >= 0) setQuestion(index);
    setRestoreQuestion(null);
  }
  const q = detail?.questions[question],
    review = reviews.find((r) => r.question_key === q?.key);
  if (view === "review" && q && !form && !detailBusy && !restoreQuestion) {
    const next = review
      ? {
          outcome: review.outcome,
          note: review.note,
          revision: review.review_revision,
        }
      : emptyForm();
    setForm(next);
    setBaseline(next);
  }
  const dirty = !!form && JSON.stringify(form) !== JSON.stringify(baseline),
    stale = !!form && (review?.review_revision ?? 0) !== form.revision;
  const locked = busy || !!pending || restoring || storageError;
  const guard = useRef({ dirty: false, locked: false });
  useEffect(() => {
    guard.current = { dirty: dirty || !!file || !!pending, locked: busy };
  }, [dirty, file, pending, busy]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (guard.current.dirty || guard.current.locked) e.preventDefault();
    };
    const requestLeave = (e: Event) => {
      if (guard.current.dirty || guard.current.locked) {
        e.preventDefault();
        if (!guard.current.locked)
          setLeave(() => (e as CustomEvent<() => void>).detail);
      }
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !a ||
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        a.target === "_blank" ||
        !guard.current.dirty
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      if (!guard.current.locked)
        setLeave(() => () => {
          guard.current.dirty = false;
          void router.push(a.href);
        });
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("gina:signout", requestLeave);
    window.addEventListener("gina:library-leave", requestLeave);
    document.addEventListener("click", click, true);
    router.beforePopState(({ as }) => {
      if (!guard.current.dirty && !guard.current.locked) return true;
      window.history.pushState(window.history.state, "", router.asPath);
      if (!guard.current.locked)
        setLeave(() => () => {
          guard.current.dirty = false;
          void router.push(as);
        });
      return false;
    });
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("gina:signout", requestLeave);
      window.removeEventListener("gina:library-leave", requestLeave);
      document.removeEventListener("click", click, true);
      router.beforePopState(() => true);
    };
  }, [router]);
  useEffect(() => {
    if ((zoom || leave) && !modal.current?.open) modal.current?.showModal();
    else if (!zoom && !leave) modal.current?.close();
  }, [zoom, leave]);
  function navigate(fn: () => void) {
    if (locked) return;
    if (dirty || file) setLeave(() => fn);
    else fn();
  }
  function choose(id: string | null) {
    navigate(() => {
      serial.current++;
      setSelected(id);
      setDetail(null);
      setDetailError(false);
      setFile(null);
      setReviews([]);
      setQuestion(0);
      setForm(null);
      setBaseline(null);
      setView("student");
      setNotice("");
    });
  }
  function chooseQuestion(index: number) {
    if (locked) return;
    const next = () => {
      setQuestion(index);
      setForm(null);
      setBaseline(null);
      setNotice("");
    };
    if (dirty) setLeave(() => next);
    else next();
  }
  async function loadFile(f: File) {
    if (locked) return;
    const seq = ++serial.current;
    setBusy(true);
    setNotice("");
    try {
      const next = await readLibraryFile(f);
      if (
        !live.current ||
        seq !== serial.current ||
        accessNow.current !== "allowed"
      )
        return;
      setSelected(null);
      setFile(next);
      setDetail(localLibraryPreview(next));
      setQuestion(0);
      setReviews([]);
      setForm(null);
      setBaseline(null);
      setView("student");
      setDetailError(false);
    } catch (e) {
      if (live.current && seq === serial.current)
        setNotice(
          e instanceof SyntaxError ||
            (e as { name?: string }).name === "ZodError"
            ? "Bu dosya geçerli bir GINA soru paketi değil. Hazırlanan JSON dosyasını seç."
            : libraryError(e),
        );
    } finally {
      if (live.current && seq === serial.current) setBusy(false);
    }
  }
  async function send(command?: LibraryCommand) {
    if (sending.current || access !== "allowed" || storageError || restoring)
      return;
    sending.current = true;
    setBusy(true);
    setNotice("");
    let saved: LibraryPending | null = pending;
    try {
      if (!saved) saved = await outbox.prepare(command!);
      if (!saved) throw Error("library_storage");
      if (!live.current || accessNow.current === "denied") return;
      setPending(saved);
      if (accessNow.current !== "allowed") return;
      const result = await sendLibraryCommand(saved);
      await outbox.acknowledge(saved.request);
      if (!live.current || accessNow.current !== "allowed") return;
      setPending(null);
      setFile(null);
      setSelected(result.id);
      if (result.review) {
        const next = {
          outcome: result.review.outcome,
          note: result.review.note,
          revision: result.review.review_revision,
        };
        setForm(next);
        setBaseline(next);
        setReviews((old) => [
          ...old.filter((r) => r.question_key !== result.review!.question_key),
          result.review!,
        ]);
      } else {
        setView("student");
        setForm(null);
        setBaseline(null);
      }
      setNotice(
        result.review
          ? "İnceleme kaydedildi. Paket yayımlanmadı."
          : "Taslak kaydedildi. Ailelere görünmez.",
      );
      reload();
    } catch (e) {
      if (!live.current || accessNow.current === "denied") return;
      if (saved && definitiveHelpFailure(e)) {
        try {
          await outbox.acknowledge(saved.request);
          setPending(null);
        } catch {
          setStorageError(true);
        }
        if ((e as { code?: string }).code === "42501") deny();
        if ((e as { message?: string }).message === "library_review_changed")
          reload();
        setNotice(libraryError(e));
      } else if (saved) {
        setPending(saved);
        setNotice(
          "Gönderimin sonucu doğrulanamadı. Aynı işlemi güvenle yeniden dene; yeni kayıt oluşturma.",
        );
      } else {
        setStorageError(true);
        setNotice(libraryError(e));
      }
    } finally {
      sending.current = false;
      if (live.current) setBusy(false);
    }
  }
  const source = detail?.sources.find((s) => s.key === q?.source_key);
  const imageUrl = source?.png_base64
    ? "data:image/png;base64," + source.png_base64
    : null;
  const reviewed = reviews.filter((r) => r.outcome !== "unreviewed").length;
  const curriculum = record(q?.metadata?.curriculum);
  const provenance = record(detail?.provenance);
  const programmeUrl = sourceUrl(
    record(provenance.curriculum_reference).programme_url,
  );

  return (
    <section
      className={"library-drafts" + (detail || selected ? " has-package" : "")}
      aria-label="Taslak paketler"
    >
      {access !== "allowed" && (
        <div className="library-message" role="status">
          <h2>
            {access === "checking"
              ? "Yetkin kontrol ediliyor…"
              : access === "denied"
                ? "Yönetici yetkisi gerekli"
                : "Kütüphane yüklenemedi"}
          </h2>
          <p>
            {access === "error"
              ? "Bağlantını kontrol et. Açık notların bu sayfada korunuyor."
              : access === "denied"
                ? "Taslaklar bu oturuma kapatıldı. Yetkili hesabınla yeniden giriş yap."
                : "Özel taslaklara erişim doğrulanıyor."}
          </p>
          {access !== "checking" && (
            <button className="btn-secondary" onClick={reload}>
              Yeniden dene
            </button>
          )}
        </div>
      )}
      <div hidden={access !== "allowed"}>
        <header className="library-intro">
          <p>Ortak kaynakları, soruları ve puan ölçütlerini birlikte incele.</p>
          <button
            className="btn-secondary"
            disabled={locked}
            onClick={() => navigate(() => input.current?.click())}
          >
            ↑ Paket yükle
          </button>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Soru paketi dosyası"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void loadFile(f);
            }}
          />
        </header>
        {notice && (
          <p className="library-message" role="status">
            {notice}
          </p>
        )}
        {storageError && (
          <p className="library-message error" role="alert">
            Güvenli gönderim deposu kullanılamıyor. Kayıt gönderilmedi veya
            sonucu bekliyor olabilir. Bu sayfayı yenileyip bekleyen işlemi
            kontrol et.
          </p>
        )}
        {pending && (
          <div className="library-message">
            <p>
              Kaydı doğrulanmayı bekleyen bir{" "}
              {pending.payload.action === "import" ? "paket" : "inceleme"} var.
              Tekrar gönderim aynı işlemle devam eder.
            </p>
            <button
              className="btn"
              disabled={busy || storageError}
              onClick={() => void send()}
            >
              Aynı işlemi yeniden dene
            </button>
          </div>
        )}
        {restoring && <p role="status">Bekleyen işlemler kontrol ediliyor…</p>}
        {!detail && !selected ? (
          <div className="library-packages">
            <h2>Taslak paketler</h2>
            <p>Kaydetmek veya incelemek, soruları ailelere açmaz.</p>
            {rows.length === 0 ? (
              <div className="library-empty">
                <span aria-hidden="true">▧</span>
                <h3>{cursor ? "Başka paket yok" : "İlk soru paketini ekle"}</h3>
                <p>
                  {cursor
                    ? "En yeni paketlere dönerek devam edebilirsin."
                    : "Hazırlanan JSON dosyasını “Paket yükle” ile seç. Soruları ve görselleri kayıt öncesinde kontrol edebilirsin."}
                </p>
              </div>
            ) : (
              rows.map((r) => (
                <button
                  className="library-package-row"
                  key={r.id}
                  disabled={locked}
                  onClick={() => choose(r.id)}
                >
                  <span>
                    <strong>{r.title}</strong>
                    <small>
                      {r.grade}. sınıf · {r.subject} · Sürüm {r.revision}
                    </small>
                  </span>
                  <span>
                    {r.question_count} soru · {r.source_count} kaynak{" "}
                    <b aria-hidden="true">→</b>
                  </span>
                </button>
              ))
            )}
            <div className="library-actions">
              {cursor && (
                <button
                  className="btn-secondary"
                  disabled={listBusy}
                  onClick={() => setCursor(null)}
                >
                  En yeni paketler
                </button>
              )}
              {rows.length === 30 && (
                <button
                  className="btn-secondary"
                  disabled={listBusy}
                  onClick={() => setCursor(rows[rows.length - 1] ?? null)}
                >
                  Daha eski paketler
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <button
              className="library-link library-back"
              disabled={locked}
              onClick={() => choose(null)}
            >
              ← Taslak paketler
            </button>
            <ol className="library-steps" aria-label="Paket adımları">
              {["Dosya", "Önizleme", "İnceleme"].map((s, i) => (
                <li
                  key={s}
                  aria-current={
                    (view === "review" ? i === 2 : i === 1) ? "step" : undefined
                  }
                >
                  <span>{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            {detailError && (
              <div className="library-message error" role="alert">
                Paket veya inceleme durumu okunamadı. Kayıt kapalı; notun
                korunuyor.{" "}
                <button className="btn-secondary" onClick={reload}>
                  Yeniden yükle
                </button>
              </div>
            )}
            {detailBusy && <p role="status">Sabit paket sürümü açılıyor…</p>}
            {detail && (
              <>
                <header className="library-package-heading">
                  <div>
                    <h2>{detail.title}</h2>
                    <p>
                      {detail.grade}. sınıf · {detail.subject} · Sürüm{" "}
                      {detail.revision}
                    </p>
                    <p>
                      {detail.questions.length} soru · {detail.sources.length}{" "}
                      ortak kaynak
                    </p>
                  </div>
                  <span className="library-status">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <rect x="5" y="10" width="14" height="11" rx="3" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
                    </svg>
                    {file
                      ? "Yerel önizleme · Henüz kaydedilmedi"
                      : "Taslak · Ailelere görünmez"}
                  </span>
                </header>
                <div className="library-columns">
                  <aside className="library-questions">
                    <h3>Sorular</h3>
                    <p>
                      {reviewed} / {detail.questions.length} incelendi
                    </p>
                    <label className="library-question-select">
                      Soru seç
                      <select
                        className="input"
                        value={question}
                        disabled={locked}
                        onChange={(e) => chooseQuestion(Number(e.target.value))}
                      >
                        {detail.questions.map((item, i) => (
                          <option key={item.key} value={i}>
                            {i + 1}. {item.student.stem.slice(0, 65)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="library-question-list">
                      {detail.questions.map((item, i) => (
                        <button
                          key={item.key}
                          disabled={locked}
                          aria-pressed={i === question}
                          onClick={() => chooseQuestion(i)}
                        >
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <span>
                            {item.student.stem.slice(0, 80)}
                            {item.student.stem.length > 80 ? "…" : ""}
                            <small>
                              {
                                outcomes[
                                  reviews.find(
                                    (r) => r.question_key === item.key,
                                  )?.outcome ?? "unreviewed"
                                ]
                              }
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </aside>
                  <article
                    className="library-question-panel"
                    aria-busy={detailBusy}
                  >
                    <header className="library-question-heading">
                      <h3>
                        Soru {question + 1} / {detail.questions.length}
                      </h3>
                      <div className="library-tabs" aria-label="Soru görünümü">
                        {(["student", "teacher"] as const).map((v) => (
                          <button
                            key={v}
                            aria-pressed={
                              view === v ||
                              (v === "teacher" && view === "review")
                            }
                            disabled={busy || !!pending}
                            onClick={() => setView(v)}
                          >
                            {v === "student"
                              ? "Öğrenci görünümü"
                              : "Cevap ve puanlama"}
                          </button>
                        ))}
                      </div>
                    </header>
                    {q && !detailBusy && !detailError && (
                      <>
                        {view !== "review" && (
                          <div className="library-student-content">
                            {source && (
                              <section className="library-source">
                                <div>
                                  <span className="article-chip">
                                    Ortak kaynak
                                  </span>
                                  {imageUrl && (
                                    <button
                                      className="library-link"
                                      onClick={() => setZoom(imageUrl)}
                                    >
                                      ⛶ Büyüt
                                    </button>
                                  )}
                                </div>
                                <h4>{source.title}</h4>
                                {imageUrl && (
                                  <div className="library-image-scroll">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={imageUrl}
                                      alt={source.alt}
                                      style={{
                                        minWidth: Math.min(
                                          source.minimum_reading_width,
                                          1600,
                                        ),
                                        ...(source.minimum_reading_width > 0 ? { height: "auto", maxHeight: "none" } : {}),
                                      }}
                                      onError={() => { setDetailError(true); setNotice("Görsel açılamadı. Paketi kaynak dosyalardan yeniden hazırla."); }}
                                    />
                                  </div>
                                )}
                                {source.body && <p>{source.body}</p>}
                                <small>
                                  Bağlı sorular:{" "}
                                  {detail.questions
                                    .filter(
                                      (item) => item.source_key === source.key,
                                    )
                                    .map((item) => item.position)
                                    .join(", ")}
                                </small>
                              </section>
                            )}
                            <p className="library-stem">{q.student.stem}</p>
                            {q.student.choices.map((c) => (
                              <p className="library-choice" key={c.key}>
                                <b>{c.key}</b> {c.text}
                              </p>
                            ))}
                          </div>
                        )}
                        {view !== "student" && q.teacher && (
                          <section className="library-answer">
                            <h3>Cevap ve puanlama</h3>
                            <p className="library-answer-key">
                              {q.teacher.correct_key
                                ? `Doğru seçenek: ${q.teacher.correct_key} · `
                                : ""}
                              {q.teacher.expected_answer}
                            </p>
                            <p>{q.teacher.solution}</p>
                            <h4>
                              Puan ölçütleri · {q.teacher.rubric.max_points}{" "}
                              puan
                            </h4>
                            <ul>
                              {q.teacher.rubric.criteria.map((c) => (
                                <li key={c.id}>
                                  <span>{c.criterion}</span>
                                  <b>{c.points} puan</b>
                                </li>
                              ))}
                            </ul>
                            <details>
                              <summary>
                                Puanlama ve geri bildirim rehberi
                              </summary>
                              <p>{q.teacher.rubric.scoring}</p>
                              <h4>Geri bildirim</h4>
                              <p>{q.teacher.explanation}</p>
                              <h4>Olası yanlış anlama</h4>
                              <p>{q.teacher.common_misconception}</p>
                              <h4>Sonraki adım</h4>
                              <p>{q.teacher.next_step}</p>
                              <p>
                                Boş yanıt: {q.teacher.rubric.missing_answer}
                              </p>
                            </details>
                            <details>
                              <summary>Kaynak ve müfredat bilgileri</summary>
                              <p>
                                Önerilen öğrenme çıktısı:{" "}
                                <strong>
                                  {field(curriculum.candidate_code)}
                                </strong>
                              </p>
                              <p>
                                Eşleme durumu:{" "}
                                {curriculum.mapping_status ===
                                "proposed_pending_subject_review"
                                  ? "Alan editörü incelemesi bekliyor"
                                  : field(curriculum.mapping_status)}
                              </p>
                              <p>
                                Program sürümü:{" "}
                                {field(provenance.programme_version)}
                              </p>
                              <p>
                                Okul/program uygunluğu:{" "}
                                {provenance.school_track_applicability ===
                                "pending_review"
                                  ? "İnceleme bekliyor"
                                  : field(
                                      provenance.school_track_applicability,
                                    )}
                              </p>
                              {programmeUrl && (
                                <a
                                  className="library-link"
                                  href={programmeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Program kaynağını aç ↗
                                </a>
                              )}
                              <p>
                                Değerlendirme kapsamı:{" "}
                                {curriculum.evidence_scope === "reasoning" ? "Akıl yürütme" : "Kaynakta belirtilen beceri kapsamı; uygulamalı araç kullanımı için ayrıca kanıt gerekir."}
                              </p>
                            </details>
                          </section>
                        )}
                        <p className="library-curriculum">
                          ⓘ Müfredat ve okul/program uygunluğu ayrıca
                          incelenmeli. Teknik doğrulama, alan editörü onayı
                          değildir.
                        </p>
                        {view === "review" && form && (
                          <section className="library-review-form">
                            <button
                              className="library-link"
                              onClick={() => setView("teacher")}
                            >
                              Soruyu ve ortak kaynağı aç
                            </button>
                            <label>
                              İnceleme sonucu
                              <select
                                className="input"
                                value={form.outcome}
                                disabled={locked}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    outcome: e.target.value as Form["outcome"],
                                  })
                                }
                              >
                                {Object.entries(outcomes).map(([v, l]) => (
                                  <option key={v} value={v}>
                                    {l}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              İnceleme notu
                              <textarea
                                className="input"
                                value={form.note}
                                maxLength={4000}
                                disabled={locked}
                                placeholder="İfade, görsel veya puan ölçütü için notunu yaz…"
                                onChange={(e) =>
                                  setForm({ ...form, note: e.target.value })
                                }
                              />
                            </label>
                            <small>
                              Not yalnız yönetim ekibine görünür. Düzeltme
                              gerekiyorsa nedenini belirt.
                            </small>
                            {stale && (
                              <div className="library-message error">
                                <p>
                                  Başka bir inceleme kaydedildi. Notun üzerine
                                  yazılmadı.
                                </p>
                                <blockquote>
                                  {review?.note || "Güncel kayıtta not yok."} ·{" "}
                                  {outcomes[review?.outcome ?? "unreviewed"]}
                                </blockquote>
                                <button
                                  className="btn-secondary"
                                  disabled={locked}
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      revision: review?.review_revision ?? 0,
                                    })
                                  }
                                >
                                  Güncel kaydı gördüm, notumla devam et
                                </button>
                              </div>
                            )}
                            <div className="library-actions">
                              <button
                                className="btn"
                                disabled={
                                  locked ||
                                  stale ||
                                  detailError ||
                                  !dirty ||
                                  (form.outcome === "changes_requested" &&
                                    form.note.trim().length < 3)
                                }
                                onClick={() =>
                                  void send({
                                    action: "review",
                                    package_id: detail.id,
                                    question_key: q.key,
                                    question_revision: q.revision,
                                    expected_review_revision: form.revision,
                                    outcome: form.outcome,
                                    note: form.note,
                                  })
                                }
                              >
                                İncelemeyi kaydet
                              </button>
                            </div>
                            <p className="library-save-hint">
                              Bu işlem paketi yayımlamaz.
                            </p>
                          </section>
                        )}
                      </>
                    )}
                    {view !== "review" && (
                      <footer className="library-actions">
                        <button
                          className="library-link"
                          disabled={
                            locked || question >= detail.questions.length - 1
                          }
                          onClick={() => chooseQuestion(question + 1)}
                        >
                          Sonraki soru →
                        </button>
                        {file ? (
                          <button
                            className="btn"
                            disabled={locked || detailError}
                            onClick={() =>
                              void send({ action: "import", file })
                            }
                          >
                            Taslak olarak kaydet
                          </button>
                        ) : (
                          <button
                            className="btn"
                            disabled={locked || detailBusy || detailError}
                            onClick={() => setView("review")}
                          >
                            İncelemeye geç
                          </button>
                        )}
                      </footer>
                    )}
                  </article>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <dialog
        ref={modal}
        className="library-dialog"
        onCancel={(e) => {
          e.preventDefault();
          setZoom(null);
          setLeave(null);
        }}
        aria-label={zoom ? "Ortak kaynak görseli" : "Kaydedilmemiş çalışma"}
      >
        {zoom ? (
          <>
            <button className="btn-secondary" onClick={() => setZoom(null)}>
              Kapat
            </button>
            <div className="library-zoom-scroll">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zoom} alt={source?.alt ?? "Ortak kaynak"} />
            </div>
          </>
        ) : leave ? (
          <>
            <h2>Kaydedilmemiş çalışma var</h2>
            <p>
              {pending
                ? "Gönderimin sonucu bekleniyor. Aynı hesapla geri döndüğünde bu cihazda yeniden deneyebilirsin. Hesaptan çıkış yaparsan bu cihazdaki bekleyen işlem temizlenir."
                : "Devam edersen henüz gönderilmemiş not veya yerel dosya seçimi kaybolur."}
            </p>
            <div className="library-actions">
              <button className="btn-secondary" onClick={() => setLeave(null)}>
                Düzenlemeye dön
              </button>
              <button
                className="btn"
                onClick={() => {
                  const fn = leave;
                  setLeave(null);
                  guard.current.dirty = false;
                  fn();
                }}
              >
                Kaydetmeden devam et
              </button>
            </div>
          </>
        ) : null}
      </dialog>
    </section>
  );
}
