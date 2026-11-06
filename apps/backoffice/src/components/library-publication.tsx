import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { PublicationIcon } from "./library-publication-icon";
import {
  definitiveHelpFailure,
  libraryReadinessSchema,
  libraryPublishCommandSchema,
  type LibraryReadiness,
  type LibraryPublishCommand,
} from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { clearLibraryCommands } from "@/lib/library-review";
import {
  publicationQueue,
  publicationError,
  sendPublication,
} from "@/lib/library-publication";
type Form = {
  title: string;
  description: string;
  plans: ("free" | "plus" | "pro")[];
  curriculum_label: string;
  version: number;
  fingerprint: string;
};
const names = { free: "Ücretsiz", plus: "Plus", pro: "Pro" };
function initial(r: LibraryReadiness): Form {
  return {
    title: r.publication?.title ?? r.title,
    description: r.publication?.description ?? "",
    plans: r.publication?.plans ?? ["plus", "pro"],
    curriculum_label: r.publication?.curriculum_label ?? "",
    version: r.publication?.version ?? 0,
    fingerprint: r.checks.review_fingerprint,
  };
}
export function LibraryPublicationWorkspace({
  user,
  id,
}: {
  user: string;
  id: string;
}) {
  const router = useRouter();
  // C07: önizleme içerik ve yayın ekibine açık; yayın/geri çekme kararı yalnız yayın ekibinde (sunucu da aynı kuralı uygular).
  const canPublish = useAuth().roles.includes("release");
  const [queue, setQueue] = useState(() => publicationQueue(user));
  const [data, setData] = useState<LibraryReadiness | null>(null),
    [access, setAccess] = useState<"checking" | "allowed" | "error" | "denied">(
      "checking",
    );
  const [form, setForm] = useState<Form | null>(null),
    [baseline, setBaseline] = useState<Form | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<LibraryPublishCommand | null>(null),
    [restoring, setRestoring] = useState(true),
    [storageError, setStorageError] = useState(false);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false),
    [archive, setArchive] = useState(false),
    [reason, setReason] = useState("");
  const [leave, setLeave] = useState<(() => void) | null>(null),
    [tick, setTick] = useState(0);
  const live = useRef(true),
    sending = useRef(false),
    accessNow = useRef(access),
    dialog = useRef<HTMLDialogElement>(null);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const deny = useCallback(() => {
    accessNow.current = "denied";
    setAccess("denied");
    setData(null);
    setForm(null);
    setBaseline(null);
    setPending(null);
    setConfirmed(false);
    setPreview(false);
    setArchive(false);
    setLeave(null);
    void clearLibraryCommands().catch(() => setStorageError(true));
  }, []);
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const p = await queue.restore();
        if (active) {
          setPending(p);
          setRestoring(false);
        }
      } catch {
        if (active) {
          setStorageError(true);
          setRestoring(false);
        }
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, [queue]);
  useEffect(() => {
    let active = true,
      seq = 0;
    async function refresh() {
      const n = ++seq;
      try {
        const { data: r, error } = await supabase()
          .rpc("admin_library_publication", { p_package_id: id })
          .abortSignal(AbortSignal.timeout(20000));
        if (error) throw error;
        const next = libraryReadinessSchema.parse(r);
        if (next.package_id !== id) throw Error("library_receipt_invalid");
        if (!active || n !== seq) return;
        if (accessNow.current === "denied") {
          setQueue(publicationQueue(user));
          setRestoring(true);
        }
        accessNow.current = "allowed";
        setAccess("allowed");
        setData(next);
      } catch (e) {
        if (!active || n !== seq) return;
        if ((e as { code?: string }).code === "42501") deny();
        else {
          accessNow.current = "error";
          setAccess("error");
        }
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
  }, [id, user, tick, deny]);
  if (data && !form && !restoring) {
    const f =
      pending?.package_id === id
        ? {
            title: pending.title,
            description: pending.description,
            plans: pending.plans,
            curriculum_label: pending.curriculum_label,
            version: pending.expected_version,
            fingerprint: pending.review_fingerprint,
          }
        : initial(data);
    setForm(f);
    setBaseline(f);
  }
  const dirty = !!form && JSON.stringify(form) !== JSON.stringify(baseline);
  const stale =
    !!form &&
    !!data &&
    (form.version !== (data.publication?.version ?? 0) ||
      form.fingerprint !== data.checks.review_fingerprint);
  const locked = busy || restoring || !!pending || storageError || !canPublish;
  const guard = useRef({ dirty: false, busy: false });
  useEffect(() => {
    guard.current = { dirty: dirty || !!pending || confirmed, busy };
  }, [dirty, pending, confirmed, busy]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (guard.current.dirty || guard.current.busy) e.preventDefault();
    };
    const request = (e: Event) => {
      if (guard.current.dirty || guard.current.busy) {
        e.preventDefault();
        if (!guard.current.busy)
          setLeave(() => (e as CustomEvent<() => void>).detail);
      }
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !a ||
        a.target === "_blank" ||
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        (!guard.current.dirty && !guard.current.busy)
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      if (!guard.current.busy)
        setLeave(() => () => {
          guard.current.dirty = false;
          void router.push(a.href);
        });
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("gina:signout", request);
    document.addEventListener("click", click, true);
    router.beforePopState(({ as }) => {
      if (!guard.current.dirty && !guard.current.busy) return true;
      window.history.pushState(window.history.state, "", router.asPath);
      if (!guard.current.busy)
        setLeave(() => () => {
          guard.current.dirty = false;
          void router.push(as);
        });
      return false;
    });
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("gina:signout", request);
      document.removeEventListener("click", click, true);
      router.beforePopState(() => true);
    };
  }, [router]);
  useEffect(() => {
    if (preview || archive || leave) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else dialog.current?.close();
  }, [preview, archive, leave]);
  function edit(p: Partial<Form>) {
    if (!locked) {
      setForm((f) => (f ? { ...f, ...p } : null));
      setConfirmed(false);
    }
  }
  const revoked = () => accessNow.current === "denied";
  async function media() {
    if (sending.current || locked || accessNow.current !== "allowed") return;
    sending.current = true;
    setBusy(true);
    setNotice("");
    try {
      const { data: r, error } = await supabase().functions.invoke(
        "library-media",
        { body: { package_id: id }, signal: AbortSignal.timeout(45000) },
      );
      if (error) throw error;
      if (r?.package_id !== id || r?.validator !== "png-rgb-v1")
        throw Error("library_media_invalid");
      if (live.current && accessNow.current === "allowed") {
        setNotice("Görseller sunucuda doğrulandı. Yayın yapılmadı.");
        reload();
      }
    } catch {
      if (live.current && !revoked())
        setNotice(
          "Görsel doğrulaması tamamlanamadı. Sunucu bağlantısını ve kaynak PNG dosyalarını kontrol et. Yayın yapılmadı.",
        );
    } finally {
      sending.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function send(status: "published" | "archived") {
    if (
      sending.current ||
      accessNow.current !== "allowed" ||
      storageError ||
      restoring ||
      !form ||
      !data
    )
      return;
    if (pending && pending.package_id !== id) return;
    sending.current = true;
    setBusy(true);
    setNotice("");
    let saved = pending;
    try {
      if (!saved) {
        const command = libraryPublishCommandSchema.parse({
          request: crypto.randomUUID(),
          package_id: id,
          expected_version: form.version,
          review_fingerprint: form.fingerprint,
          title: form.title,
          description: form.description,
          plans: form.plans,
          curriculum_label: form.curriculum_label,
          confirmed: true,
          status,
          reason: status === "archived" ? reason : "",
        });
        saved = await queue.prepare(command);
      }
      if (!saved) throw Error("library_storage");
      if (!live.current || revoked()) return;
      setPending(saved);
      if (accessNow.current !== "allowed") return;
      await sendPublication(saved);
      await queue.acknowledge(saved.request);
      if (!live.current || accessNow.current !== "allowed") return;
      setPending(null);
      setForm(null);
      setBaseline(null);
      setConfirmed(false);
      setArchive(false);
      setReason("");
      setData(null);
      setNotice(
        saved.status === "archived"
          ? "Paket yayından kaldırıldı. Önceden alınan sorular korunur."
          : data.delivery_enabled
            ? "Yayın kaydı alındı. Güncel görünürlük kontrol ediliyor."
            : "Yayın kaydı alındı. Aile erişimi henüz kapalı.",
      );
      reload();
    } catch (e) {
      if (!live.current || revoked()) return;
      if (saved && definitiveHelpFailure(e)) {
        try {
          await queue.acknowledge(saved.request);
          setPending(null);
        } catch {
          setStorageError(true);
        }
        if ((e as { code?: string }).code === "42501") deny();
        else {
          setConfirmed(false);
          setNotice(publicationError(e));
          reload();
        }
      } else if (saved) {
        setPending(saved);
        setNotice(
          "İşlemin sonucu doğrulanamadı. Aynı işlemi yeniden dene; yeni yayın oluşturma.",
        );
      } else {
        setStorageError(true);
        setNotice(
          "Gönderim cihazda güvenli biçimde saklanamadı. Sayfayı yenileyip bekleyen işlemi kontrol et.",
        );
      }
    } finally {
      sending.current = false;
      if (live.current) setBusy(false);
    }
  }
  const ready =
    !!data &&
    data.checks.question_count > 0 &&
    data.checks.question_count === data.checks.suitable_count &&
    data.checks.missing_media === 0;
  const valid =
    !!form &&
    form.title.trim().length >= 3 &&
    form.curriculum_label.trim().length >= 3 &&
    form.plans.length > 0;
  return (
    <section className="library-publish" aria-label="Kütüphane yayını">
      <Link
        className="btn-secondary publication-back"
        href={{ pathname: "/library", query: { packageId: id } }}
      >
        <PublicationIcon name="back" /> İncelemeye dön
      </Link>
      <h1 className="publication-title">Yayına hazırla</h1>
      {access !== "allowed" ? (
        <div className="publication-notice" role="status">
          <h2>
            {access === "checking"
              ? "Yayın kontrolleri yükleniyor…"
              : access === "denied"
                ? "Yönetici yetkisi gerekli"
                : "Yayın kontrolleri yüklenemedi"}
          </h2>
          <p>
            {access === "denied"
              ? "Bu oturuma özel taslaklar kapatıldı. Yetkili hesabınla tekrar giriş yap."
              : "Bağlantı doğrulanmadan yayın işlemi yapılamaz."}
          </p>
          {access !== "checking" && (
            <button className="btn-secondary" onClick={reload}>
              Yeniden dene
            </button>
          )}
        </div>
      ) : null}
      <div hidden={access !== "allowed"}>
        {!canPublish && (
          <p className="publication-notice" role="note" data-testid="publication-preview-only">
            Önizleme modundasınız. Yayımlama ve geri çekme kararı yayın ekibi yetkisi ister; bu ekranda değişiklik kaydedilmez.
          </p>
        )}
        {notice && (
          <p className="publication-notice" role="status">
            {notice}
          </p>
        )}
        {storageError && (
          <p role="alert">
            Bekleyen işlem güvenli biçimde saklanamıyor. Sayfayı yenileyip
            durumu kontrol et.
          </p>
        )}
        {pending && (
          <div className="publication-notice" role="status">
            <strong>Sonucu bekleyen bir yayın işlemi var.</strong>
            <p>Önce aynı işlemin sonucunu doğrula.</p>
            {pending.package_id !== id ? (
              <Link
                className="btn-secondary"
                href={{
                  pathname: "/library-publication",
                  query: { packageId: pending.package_id },
                }}
              >
                Bekleyen paketi aç
              </Link>
            ) : (
              <button
                className="btn"
                disabled={busy || restoring || storageError}
                onClick={() => void send(pending.status)}
              >
                Aynı işlemi yeniden dene
              </button>
            )}
          </div>
        )}
        {data && form ? (
          <>
            <header className="publication-heading">
              <div>
                <h2>{data.title}</h2>
                <p>
                  {data.grade}. sınıf · {data.subject} · Sürüm {data.revision}
                </p>
              </div>
              <span className="publication-badge">
                <PublicationIcon name="lock" />
                {data.publication?.status === "published"
                  ? data.review_current
                    ? "Yayın kaydı var"
                    : "İnceleme değişti · Erişim durdu"
                  : data.publication?.status === "archived"
                    ? "Yayından kaldırıldı"
                    : "Henüz yayımlanmadı"}
              </span>
            </header>
            {stale && !pending && (
              <div className="publication-conflict" role="alert">
                <h3>Güncel kayıt değişti</h3>
                <p>
                  Yazdıkların korundu. Güncel yayın:{" "}
                  {data.publication?.title ?? "Henüz yok"} · Erişim:{" "}
                  {data.publication?.plans.map((p) => names[p]).join(", ") ??
                    "Belirlenmedi"}
                  .
                </p>
                <p>{data.publication?.description}</p>
                <p>{data.publication?.curriculum_label}</p>
                <button
                  className="btn-secondary"
                  disabled={locked}
                  onClick={() => {
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            version: data.publication?.version ?? 0,
                            fingerprint: data.checks.review_fingerprint,
                          }
                        : null,
                    );
                    setConfirmed(false);
                  }}
                >
                  Güncel kaydı gördüm, düzenlememle devam et
                </button>
                <button
                  className="btn-secondary"
                  disabled={locked}
                  onClick={() => {
                    const f = initial(data);
                    setForm(f);
                    setBaseline(f);
                    setConfirmed(false);
                  }}
                >
                  Güncel ayarları kullan
                </button>
              </div>
            )}
            <div className="publication-columns">
              <div className="publication-main">
                <section className="publication-panel">
                  <h3>Yayın kontrolleri</h3>
                  <div className="publication-check">
                    <span className="publication-check-label">
                      <span className="publication-icon-tile">
                        <PublicationIcon name="document" />
                      </span>
                      Sorular
                    </span>
                    <strong className={data.checks.suitable_count === data.checks.question_count && data.checks.question_count > 0 ? "" : "pending"}>
                      {data.checks.suitable_count ===
                        data.checks.question_count && (
                        <PublicationIcon name="check" />
                      )}
                      {data.checks.suitable_count} /{" "}
                      {data.checks.question_count} uygun
                    </strong>
                  </div>
                  <div className="publication-check">
                    <span className="publication-check-label">
                      <span className="publication-icon-tile">
                        <PublicationIcon name="layers" />
                      </span>
                      Ortak kaynaklar
                    </span>
                    <strong className={data.checks.missing_media ? "pending" : ""}>
                      {!data.checks.missing_media && (
                        <PublicationIcon name="check" />
                      )}
                      {data.checks.missing_media
                        ? `${data.checks.missing_media} görsel doğrulanmalı`
                        : `${data.checks.source_count} kaynak kontrol edildi`}
                    </strong>
                  </div>
                  {data.checks.missing_media > 0 && (
                    <button
                      className="btn-secondary"
                      disabled={locked}
                      onClick={() => void media()}
                    >
                      {busy ? "Doğrulanıyor…" : "Görselleri doğrula"}
                    </button>
                  )}
                  <details className="publication-scope">
                    <summary className="publication-check">
                      <span className="publication-check-label">
                        <span className="publication-icon-tile">
                          <PublicationIcon name="school" />
                        </span>
                        Program ve kullanım kapsamı
                      </span>
                      <strong className={form.curriculum_label.trim() ? "" : "pending"}>
                        {form.curriculum_label.trim() && (
                          <PublicationIcon name="check" />
                        )}
                        <span>
                          {form.curriculum_label.trim()
                            ? `${data.grade}. sınıf ${data.subject} · Konu pratiği`
                            : "Kapsamı belirt"}
                        </span>
                      </strong>
                    </summary>
                    <p>
                      Bu paket konu pratiği olarak sunulur. Resmî MEB sınavı
                      veya okulun seçtiği senaryo olarak etiketlenmez.
                    </p>
                    <label>
                      Kontrol edilen program / dönem
                      <input
                        value={form.curriculum_label}
                        maxLength={200}
                        disabled={locked}
                        onChange={(e) =>
                          edit({ curriculum_label: e.target.value })
                        }
                        placeholder="Örn. 5. sınıf Matematik, 2026–2027"
                      />
                    </label>
                    <p className="publication-help">
                      Kaynak eşleştirmesini inceleme ekranında kontrol ederek
                      yaz. Alanın dolu olması resmî uygunluk belgesi değildir.
                    </p>
                  </details>
                </section>
                <section className="publication-panel">
                  <h3>Aileye görünen bilgiler</h3>
                  <label>
                    Başlık
                    <input
                      value={form.title}
                      maxLength={160}
                      disabled={locked}
                      onChange={(e) => edit({ title: e.target.value })}
                    />
                  </label>
                  <label>
                    Kısa açıklama
                    <textarea
                      rows={1}
                      value={form.description}
                      maxLength={1000}
                      disabled={locked}
                      onChange={(e) => edit({ description: e.target.value })}
                    />
                  </label>
                  <button
                    className="publication-link"
                    onClick={() => setPreview(true)}
                  >
                    <PublicationIcon name="eye" /> Aile önizlemesini aç
                  </button>
                </section>
              </div>
              <aside className="publication-panel publication-summary">
                <h3>Kimler erişebilir?</h3>
                <fieldset disabled={locked}>
                  <legend className="sr-only">Erişim paketleri</legend>
                  <div className="publication-plans">
                    {(["free", "plus", "pro"] as const).map((p) => (
                      <label
                        key={p}
                        className={form.plans.includes(p) ? "selected" : ""}
                      >
                        <input
                          type="checkbox"
                          checked={form.plans.includes(p)}
                          onChange={() =>
                            edit({
                              plans: form.plans.includes(p)
                                ? form.plans.filter((v) => v !== p)
                                : [...form.plans, p].sort(
                                    (a, b) =>
                                      ["free", "plus", "pro"].indexOf(a) -
                                      ["free", "plus", "pro"].indexOf(b),
                                  ),
                            })
                          }
                        />
                        {names[p]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p>Ailenin kalan kütüphane hakkı ayrıca kontrol edilir.</p>
                <hr />
                <h3>Yayın özeti</h3>
                <p className="publication-summary-line">
                  <PublicationIcon name="document" />
                  {data.checks.question_count} soru · {data.checks.source_count}{" "}
                  ortak kaynak
                </p>
                <p className="publication-summary-line">
                  <PublicationIcon name="family" />
                  {form.plans.length
                    ? form.plans.map((p) => names[p]).join(" ve ") + " aileleri"
                    : "En az bir erişim paketi seç."}
                </p>
                <p className="publication-notice publication-summary-line">
                  <PublicationIcon name="info" />
                  Yayınlama tek başına kullanım hakkı harcamaz.
                </p>
                <label className="publication-confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={locked || stale}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>
                    Soruların, görsellerin ve program kapsamının incelemesini
                    tamamladım.
                  </span>
                </label>
                <button
                  className="btn publication-primary"
                  disabled={locked || !ready || !valid || !confirmed || stale}
                  onClick={() => void send("published")}
                >
                  {busy
                    ? "İşlem sürüyor…"
                    : data.publication
                      ? "Yayın ayarlarını onayla"
                      : "Yayını onayla"}
                </button>
                {!ready && (
                  <p className="publication-help">
                    Yayın için bütün sorular uygun bulunmalı ve görseller
                    doğrulanmalı.
                  </p>
                )}
                {!form.curriculum_label.trim() && (
                  <p className="publication-help">
                    Program ve kullanım kapsamını açıp kontrol edilen programı
                    belirt.
                  </p>
                )}
                <Link className="publication-link" href="/library?tab=drafts">
                  Taslaklara dön
                </Link>
                {data.publication?.status === "published" && (
                  <button
                    className="publication-link"
                    disabled={locked || stale}
                    onClick={() => {
                      setReason("");
                      setArchive(true);
                    }}
                  >
                    Yayından kaldır
                  </button>
                )}
                <p className="publication-help">
                  {data.delivery_enabled
                    ? "Onayladığında bu sürüm aile kütüphanesinde görünür."
                    : "Aile erişimi henüz kapalı. Yayın kaydı saklanır; Prova’ya seçim bağlantısı tamamlanmadan ailelere gösterilmez."}
                </p>
              </aside>
            </div>
          </>
        ) : null}
      </div>
      <dialog
        ref={dialog}
        className="publication-dialog"
        onCancel={(e) => {
          if (busy) {
            e.preventDefault();
            return;
          }
          setLeave(null);
          setPreview(false);
          setArchive(false);
        }}
      >
        {leave ? (
          <>
            <h2>Bu sayfadan ayrılmak istiyor musun?</h2>
            <p>
              Gönderilmemiş düzenlemeler kaybolur. Sonucu belirsiz gönderim aynı
              işlem olarak saklanır; oturumdan çıkarsan bu cihazdaki bekleyen
              kayıt temizlenir.
            </p>
            <button className="btn-secondary" onClick={() => setLeave(null)}>
              Düzenlemeye dön
            </button>
            <button
              className="btn"
              onClick={() => {
                const next = leave;
                setLeave(null);
                next();
              }}
            >
              Ayrıl
            </button>
          </>
        ) : archive ? (
          <>
            <h2>Paketi yayından kaldır</h2>
            <p>
              Yeni erişim durur. Ailelerin önceden aldığı sorular ve atanmış
              Provalar korunur.
            </p>
            <label>
              Gerekçe
              <textarea
                value={reason}
                maxLength={1000}
                disabled={busy || !!pending}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => setArchive(false)}
            >
              Vazgeç
            </button>
            <button
              className="btn"
              disabled={busy || !!pending || reason.trim().length < 3}
              onClick={() => void send("archived")}
            >
              Yayından kaldır
            </button>
          </>
        ) : preview && form && data ? (
          <>
            <h2>Aile önizlemesi</h2>
            <p className="publication-help">
              Katalog kartı önizlemesidir. Cevaplar ve editör notları aileye
              gösterilmez.
            </p>
            <article className="publication-panel">
              <h3>{form.title}</h3>
              <p>
                {data.grade}. sınıf · {data.subject} · Konu pratiği
              </p>
              <p>{form.description}</p>
              <p>
                {data.checks.question_count} soru · {data.checks.source_count}{" "}
                ortak kaynak
              </p>
              <p>{form.curriculum_label}</p>
              <p>{form.plans.map((p) => names[p]).join(", ")}</p>
            </article>
            <button className="btn-secondary" onClick={() => setPreview(false)}>
              Kapat
            </button>
          </>
        ) : null}
      </dialog>
    </section>
  );
}
