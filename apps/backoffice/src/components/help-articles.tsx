import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  type ArticleCommand,
  articleCommandSchema,
  definitiveHelpFailure,
  type EditorArticle,
  editorArticleRowSchema,
  editorArticleSchema,
  type PendingArticleCommand,
} from "@gina/core";
import { Layout } from "./Layout";
import { useAuth } from "@/lib/auth";
import { useSupportQuery } from "@/lib/use-support-query";
import { supabase } from "@/lib/supabase";
import { createArticleOutbox, sendArticleCommand } from "@/lib/help-articles";
const platformNames = {
  all: "Tüm cihazlar için ortak",
  ios: "iOS",
  android: "Android",
  web: "Web",
};
type Form = {
  id: string;
  slug: string;
  locale: "tr" | "en";
  platform: keyof typeof platformNames;
  revision: number;
  title: string;
  body: string;
};
const formOf = (a: EditorArticle): Form => ({
  id: a.id,
  slug: a.slug,
  locale: a.locale,
  platform: a.platform,
  revision: a.revision,
  title: a.draft.title,
  body: a.draft.body,
});
const names = {
  save: "Taslak kaydedildi.",
  review: "Bu sürüm incelendi.",
  publish: "Bu sürüm yayımlandı.",
  archive: "Yazı yayından kaldırıldı.",
};
export function ArticleEditor() {
  const { session } = useAuth();
  return (
    <Layout content title="Yardım yazıları">
      {session
        ? <Workspace key={session.user.id} user={session.user.id} />
        : null}
    </Layout>
  );
}
function Workspace({ user }: { user: string }) {
  const router = useRouter(), { refreshRoles } = useAuth();
  const [outbox] = useState(() => createArticleOutbox(user));
  const [restored] = useState(() => {
    try {
      return { pending: outbox.restore(), error: false };
    } catch {
      return { pending: null, error: true };
    }
  });
  const [pending, setPending] = useState<PendingArticleCommand | null>(
      restored.pending,
    ),
    [storageError, setStorageError] = useState(restored.error);
  const [selected, setSelected] = useState<string | null>(
    restored.pending?.payload.id ?? null,
  );
  const [form, setForm] = useState<Form | null>(() =>
    restored.pending?.payload.action === "save"
      ? restored.pending.payload
      : null
  );
  const [baseline, setBaseline] = useState<Form | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [locale, setLocale] = useState<"tr" | "en">("tr"),
    [platform, setPlatform] = useState(""),
    [cursor, setCursor] = useState<{ slug: string; id: string } | null>(null);
  const [view, setView] = useState<"edit" | "preview" | "published">("edit"),
    [action, setAction] = useState<"review" | "publish" | "archive" | null>(
      null,
    ),
    [reason, setReason] = useState("");
  const [leave, setLeave] = useState<(() => void) | null>(null),
    [menu, setMenu] = useState(false);
  const dirty = !!form && JSON.stringify(form) !== JSON.stringify(baseline);
  const locked = busy || !!pending || storageError;
  const list = useSupportQuery(
    async () => {
      const { data, error } = await supabase().rpc(
        "list_help_editor_articles",
        {
          p_locale: locale,
          ...(platform ? { p_platform: platform } : {}),
          ...(cursor
            ? { p_after_slug: cursor.slug, p_after_id: cursor.id }
            : {}),
        },
      );
      if (error) throw error;
      return editorArticleRowSchema.array().parse(data);
    },
    `articles:${locale}:${platform}:${cursor?.id ?? ""}`,
    "content",
  );
  const detail = useSupportQuery(
    async () => {
      if (!selected || form?.revision === 0) return null;
      const { data, error } = await supabase().rpc("get_help_editor_article", {
        p_id: selected,
      });
      if (error) throw error;
      return editorArticleSchema.parse(data);
    },
    `article:${selected}:${form?.revision === 0 ? "new" : "existing"}`,
    "content",
  );
  const current = detail.data;
  // Initialize the editor once per selection. Polling never overwrites a draft.
  if (current && current.id === selected && !form) {
    const next = formOf(current);
    setForm(next);
    setBaseline(next);
  }
  const stale = !!current && !!form && current.revision !== form.revision;
  const guard = useRef({ dirty: false, locked: false });
  useEffect(() => {
    guard.current = { dirty: dirty || !!pending || storageError, locked: busy };
  }, [dirty, pending, storageError, busy]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (guard.current.dirty || guard.current.locked) e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (
        !a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey ||
        e.altKey || e.shiftKey || a.target === "_blank" ||
        (!guard.current.dirty && !guard.current.locked)
      ) return;
      e.preventDefault();
      e.stopPropagation();
      if (!guard.current.locked) {
        setLeave(() => () => {
          guard.current.dirty = false;
          void router.push(a.href);
        });
      }
    };
    const signout = (e: Event) => {
      if (guard.current.dirty || guard.current.locked) {
        e.preventDefault();
        if (!guard.current.locked) {
          setLeave(() => (e as CustomEvent<() => void>).detail);
        }
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("gina:signout", signout);
    document.addEventListener("click", click, true);
    router.beforePopState(({ as }) => {
      if (!guard.current.dirty && !guard.current.locked) return true;
      window.history.pushState(window.history.state, "", router.asPath);
      if (!guard.current.locked) {
        setLeave(() => () => {
          guard.current.dirty = false;
          void router.push(as);
        });
      }
      return false;
    });
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("gina:signout", signout);
      document.removeEventListener("click", click, true);
      router.beforePopState(() => true);
    };
  }, [router]);
  const navigate = (fn: () => void) => {
    if (locked) return;
    if (dirty) setLeave(() => fn);
    else fn();
  };
  function choose(id: string | null) {
    navigate(() => {
      setSelected(id);
      setForm(null);
      setBaseline(null);
      setView("edit");
      setAction(null);
      setReason("");
      setNotice("");
    });
  }
  function newArticle() {
    navigate(() => {
      const next: Form = {
        id: crypto.randomUUID(),
        slug: "",
        locale,
        platform: "all",
        revision: 0,
        title: "",
        body: "",
      };
      setSelected(next.id);
      setForm(next);
      setBaseline(next);
      setAction(null);
      setView("edit");
      setNotice("");
    });
  }
  async function send(command?: ArticleCommand) {
    if (busy || storageError) return;
    setBusy(true);
    setNotice("");
    let saved: PendingArticleCommand | undefined;
    try {
      saved = pending ?? outbox.prepare(command!);
      setPending(saved);
      await sendArticleCommand(saved);
      outbox.acknowledge(saved.request);
      setPending(null);
      setAction(null);
      setReason("");
      setNotice(names[saved.payload.action]);
      if (saved.payload.action === "save") {
        const next = { ...saved.payload, revision: saved.payload.revision + 1 };
        const clean: Form = {
          id: next.id,
          slug: next.slug,
          locale: next.locale,
          platform: next.platform,
          revision: next.revision,
          title: next.title,
          body: next.body,
        };
        setForm(clean);
        setBaseline(clean);
      }
      list.reload();
      detail.reload();
    } catch (error) {
      if (saved && definitiveHelpFailure(error)) {
        try {
          outbox.acknowledge(saved.request);
          setPending(null);
        } catch {
          setStorageError(true);
        }
        const e = error as { code?: string; message?: string };
        setNotice(
          e.code === "42501"
            ? "Bu işlem için güncel içerik yetkiniz yok."
            : e.message?.includes("changed")
            ? "Yazı başka bir işlemle değişti. Güncel sürümü kontrol edin; metniniz korunuyor."
            : "İşlem kaydedilmedi. Başlık, yanıt ve sürüm bilgilerini kontrol edin.",
        );
        detail.reload();
        list.reload();
        void refreshRoles();
      } else if (!saved) {
        setNotice(
          "Taslak bu cihazda güvenle saklanamadı. İşlem gönderilmedi. Tarayıcı depolamasını kontrol edip tekrar deneyin.",
        );
      } else {setNotice(
          "İşlemin sonucu doğrulanamadı. Aynı işlemi yeniden kontrol edin; ikinci bir işlem oluşturulmayacak.",
        );}
    } finally {
      setBusy(false);
    }
  }
  function save() {
    if (!form) return;
    const parsed = articleCommandSchema.safeParse({ ...form, action: "save" });
    if (!parsed.success) {
      setNotice(
        "Başlık 3–160, yanıt 10–20.000 karakter olmalı. Yazı kodu 2–80 küçük harf, rakam veya kısa çizgiden oluşmalı.",
      );
      return;
    }
    void send(parsed.data);
  }
  const reviewed = !!current?.draft.reviewed_at && !dirty && !stale;
  const canAct = !!current && !dirty && !stale && !locked && !detail.error;
  return (
    <div className="article-center">
      <div className="article-intro">
        <p>Ailelere açık, güncel ve anlaşılır yanıtlar.</p>
        <button
          className="btn-secondary"
          onClick={newArticle}
          disabled={locked}
        >
          ＋ Yeni yazı
        </button>
      </div>
      {notice ? <p role="status" className="support-notice">{notice}</p> : null}
      {storageError
        ? (
          <p role="alert" className="support-notice error">
            Bekleyen işlem okunamadı. Güvenlik için gönderim durduruldu; bu
            tarayıcıdaki kayıt silinmedi.
          </p>
        )
        : null}
      {pending
        ? (
          <div className="support-notice" role="status">
            <p>
              Bekleyen işlem: {pending.payload.action === "save"
                ? "Taslak kaydı"
                : pending.payload.action === "review"
                ? "İnceleme"
                : pending.payload.action === "publish"
                ? "Yayımlama"
                : "Yayından kaldırma"} · sürüm{" "}
              {pending.payload.revision}. İçerik ve işlem numarası korunuyor.
            </p>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => void send()}
            >
              {busy ? "Kontrol ediliyor…" : "Aynı işlemi yeniden kontrol et"}
            </button>
          </div>
        )
        : null}
      {leave
        ? (
          <div className="support-notice" role="alert">
            <p>
              {pending || storageError
                ? "Sonucu doğrulanmamış bir işlem var. Çıkış yaparsanız bu cihazdaki bekleyen işlem kaydı temizlenecek; tekrar girişte güncel yayını kontrol edin."
                : "Kaydedilmemiş değişiklikler var. Ayrılırsanız bu değişiklikler kaybolacak."}
            </p>
            <div className="support-actions">
              <button className="btn-secondary" onClick={() => setLeave(null)}>
                Düzenlemeye devam et
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  const next = leave;
                  setLeave(null);
                  next();
                }}
              >
                Değişiklikleri bırak ve devam et
              </button>
            </div>
          </div>
        )
        : null}
      <div className={"article-columns" + (selected ? " has-selection" : "")}>
        <aside className="article-list">
          <h2>Yazı listesi</h2>
          <label className="sr-only" htmlFor="article-language">
            Dil filtresi
          </label>
          <select
            id="article-language"
            className="input"
            value={locale}
            onChange={(e) => {
              setLocale(e.target.value as "tr" | "en");
              setCursor(null);
            }}
          >
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
          <label className="sr-only" htmlFor="article-platform">
            Platform filtresi
          </label>
          <select
            id="article-platform"
            className="input"
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setCursor(null);
            }}
          >
            <option value="">Tüm platformlar</option>
            {Object.entries(platformNames).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {list.loading ? <p role="status">Yazılar yükleniyor…</p> : null}
          {list.error
            ? (
              <div className="support-notice error" role="alert">
                Liste güncellenemedi.{" "}
                <button className="support-link" onClick={list.reload}>
                  Yeniden dene
                </button>
              </div>
            )
            : null}
          {list.data?.length === 0
            ? (
              <div className="support-empty">
                <span aria-hidden="true">▤</span>
                <h3>Bu seçimde yazı yok</h3>
                <p>Filtreleri değiştirin veya ilk yardım yazısını oluşturun.</p>
              </div>
            )
            : null}
          {list.data?.map((a) => (
            <button
              key={a.id}
              className="article-row"
              aria-pressed={selected === a.id}
              disabled={locked}
              onClick={() => choose(a.id)}
            >
              <strong>{a.title}</strong>
              {a.published_revision
                ? (
                  <span className="article-chip live">
                    Yayında · sürüm {a.published_revision}
                  </span>
                )
                : null}
              {a.revision !== a.published_revision
                ? (
                  <span className="article-chip">
                    Taslak · sürüm {a.revision}
                  </span>
                )
                : null}
              <small>{platformNames[a.platform]}</small>
            </button>
          ))}
          <div className="support-paging">
            {cursor
              ? (
                <button
                  className="support-link"
                  onClick={() => setCursor(null)}
                >
                  İlk sayfa
                </button>
              )
              : null}
            {list.data?.length === 50
              ? (
                <button
                  className="support-link"
                  onClick={() => {
                    const last = list.data?.at(-1);
                    if (last) setCursor({ slug: last.slug, id: last.id });
                  }}
                >
                  Sonraki yazılar
                </button>
              )
              : null}
          </div>
        </aside>
        <section className="article-editor" aria-label="Yazı düzenleyici">
          <button
            className="article-back support-link"
            onClick={() => choose(null)}
            disabled={locked}
          >
            ← Yazılara dön
          </button>
          {!selected
            ? (
              <div className="support-empty">
                <span aria-hidden="true">▤</span>
                <h2>Bir yanıtı birlikte netleştirelim</h2>
                <p>Listeden bir yazı seçin veya yeni bir taslak oluşturun.</p>
                <p>Taslak kaydı, ailelerin gördüğü yanıtı değiştirmez.</p>
              </div>
            )
            : null}
          {selected && detail.loading && !form
            ? <p role="status">Yazı yükleniyor…</p>
            : null}
          {selected && detail.error
            ? (
              <div className="support-notice error" role="alert">
                Güncel yazı alınamadı. Yayın işlemleri kapalı.{" "}
                <button className="support-link" onClick={detail.reload}>
                  Yeniden dene
                </button>
              </div>
            )
            : null}
          {form
            ? (
              <>
                <header className="article-tools">
                  <div
                    className="support-compose-tabs"
                    role="tablist"
                    aria-label="Yazı görünümü"
                  >
                    <button
                      role="tab"
                      aria-selected={view === "edit"}
                      onClick={() => setView("edit")}
                    >
                      Düzenle
                    </button>
                    <button
                      role="tab"
                      aria-selected={view === "preview"}
                      onClick={() => setView("preview")}
                    >
                      Önizleme
                    </button>
                  </div>
                  <button
                    className="support-icon"
                    aria-label="Yazı işlemleri"
                    aria-expanded={menu}
                    onClick={() => setMenu(!menu)}
                  >
                    ⋯
                  </button>
                </header>
                {menu
                  ? (
                    <div className="article-menu">
                      {current?.published
                        ? (
                          <button
                            className="support-link"
                            onClick={() => {
                              setView("published");
                              setMenu(false);
                            }}
                          >
                            Yayındaki yanıtı gör
                          </button>
                        )
                        : null}
                      <button
                        className="support-link"
                        disabled={!canAct || !current?.published}
                        onClick={() => {
                          setAction("archive");
                          setReason("");
                          setMenu(false);
                        }}
                      >
                        Yayından kaldır…
                      </button>
                    </div>
                  )
                  : null}
                <p className="article-live-note">
                  {current?.published
                    ? `Aileler sürüm ${current.published.revision}’i görüyor. ${
                      dirty || current.revision !== current.published_revision
                        ? "Taslak değişiklikler henüz yayında değil."
                        : "Bu sürüm yayında."
                    }`
                    : "Bu yazı henüz yayında değil. Taslak ailelere görünmez."}
                </p>
                {stale
                  ? (
                    <div className="support-notice error">
                      <p>
                        Sunucuda sürüm {current?.revision}{" "}
                        var; düzenlediğiniz sürüm{" "}
                        {form.revision}. Metninizi aşağıdan kopyalayarak
                        koruyabilir, güncel sürümü açıp yeniden
                        düzenleyebilirsiniz.
                      </p>
                      <button
                        className="btn-secondary"
                        disabled={locked}
                        onClick={() =>
                          navigate(() => {
                            if (current) {
                              const next = formOf(current);
                              setForm(next);
                              setBaseline(next);
                              setAction(null);
                            }
                          })}
                      >
                        Güncel sürümü aç
                      </button>
                    </div>
                  )
                  : null}
                {view === "edit"
                  ? (
                    <div className="article-fields">
                      <label>
                        Soru başlığı<input
                          className="input"
                          value={form.title}
                          maxLength={160}
                          disabled={locked}
                          onChange={(e) =>
                            setForm({ ...form, title: e.target.value })}
                        />
                      </label>
                      {form.revision === 0
                        ? (
                          <div className="article-identity">
                            <label>
                              Yazı kodu<input
                                className="input"
                                value={form.slug}
                                maxLength={80}
                                placeholder="cocuk-pini"
                                disabled={locked}
                                onChange={(e) =>
                                  setForm({ ...form, slug: e.target.value })}
                              />
                              <small>
                                Küçük harf ve kısa çizgi kullanın. İlk kayıttan
                                sonra değişmez.
                              </small>
                            </label>
                            <label>
                              Dil<select
                                className="input"
                                value={form.locale}
                                disabled={locked}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    locale: e.target.value as "tr" | "en",
                                  })}
                              >
                                <option value="tr">Türkçe</option>
                                <option value="en">English</option>
                              </select>
                            </label>
                            <label>
                              Platform<select
                                className="input"
                                value={form.platform}
                                disabled={locked}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    platform: e.target
                                      .value as Form["platform"],
                                  })}
                              >
                                {Object.entries(platformNames).map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )
                        : (
                          <div className="article-meta">
                            <span>
                              Dil: {form.locale === "tr" ? "Türkçe" : "English"}
                            </span>
                            <span>
                              Platform: {platformNames[form.platform]}
                            </span>
                          </div>
                        )}
                      <label>
                        Yanıt<textarea
                          className="input"
                          value={form.body}
                          maxLength={20000}
                          disabled={locked}
                          onChange={(e) =>
                            setForm({ ...form, body: e.target.value })}
                        />
                      </label>
                      <p className="article-save-state">
                        {form.revision
                          ? `Son kayıt: sürüm ${form.revision}`
                          : "Yeni taslak"} · {dirty
                          ? "Kaydedilmemiş değişiklikler"
                          : current?.draft.reviewed_at
                          ? "İncelendi"
                          : "İnceleme bekliyor"}
                      </p>
                      <div className="article-save-actions">
                        <button
                          className="btn"
                          disabled={locked || stale || !dirty || detail.error}
                          onClick={save}
                        >
                          Taslağı kaydet
                        </button>
                        <button
                          className="btn-secondary"
                          disabled={!canAct || reviewed}
                          onClick={() => {
                            setAction("review");
                            setReason("");
                          }}
                        >
                          İncele
                        </button>
                      </div>
                    </div>
                  )
                  : (
                    <div className="article-preview" role="tabpanel">
                      <span
                        className={"article-chip" +
                          (view === "published" ? " live" : "")}
                      >
                        {view === "published"
                          ? `Yayında · sürüm ${
                            current?.published?.revision ?? "—"
                          }`
                          : "Taslak · Ailelere görünmez"}
                      </span>
                      <h2>
                        {view === "published"
                          ? current?.published?.title
                          : form.title || "Soru başlığı"}
                      </h2>
                      <p>
                        {view === "published"
                          ? current?.published?.body ?? "Bu yazı yayında değil."
                          : form.body || "Yanıtın önizlemesi burada görünecek."}
                      </p>
                      <button
                        className="btn-secondary"
                        onClick={() => setView("edit")}
                      >
                        Düzenlemeye dön
                      </button>
                    </div>
                  )}
                <div className="article-publish">
                  <strong>Yayımlama</strong>
                  <p>
                    {dirty
                      ? "Önce taslağı kaydedin."
                      : reviewed
                      ? "İncelenen sürüm yayımlamaya hazır."
                      : "Önce kayıtlı sürümü inceleyin."}
                  </p>
                  <button
                    className="btn-secondary"
                    disabled={!canAct || !reviewed ||
                      current?.published_revision === form.revision}
                    onClick={() => {
                      setAction("publish");
                      setReason("");
                    }}
                  >
                    Yayımla
                  </button>
                </div>
                {action && current
                  ? (
                    <section
                      className="article-confirm"
                      aria-label="İşlem onayı"
                    >
                      <h2>
                        {action === "review"
                          ? "Kayıtlı sürümü incele"
                          : action === "publish"
                          ? "Bu yanıtı yayımla"
                          : "Yazıyı yayından kaldır"}
                      </h2>
                      <p>
                        {form.locale === "tr" ? "Türkçe" : "English"} ·{" "}
                        {platformNames[form.platform]} · sürüm {form.revision}
                      </p>
                      <h3>{current.draft.title}</h3>
                      <p className="article-exact-preview">
                        {current.draft.body}
                      </p>
                      <p>
                        {action === "publish"
                          ? `Bu sürüm ailelere açılacak.${
                            current.published
                              ? ` Yayındaki sürüm ${current.published.revision}’in yerini alacak.`
                              : ""
                          }`
                          : action === "archive"
                          ? "Aileler artık bu yazıyı göremeyecek. Taslak ve sürüm geçmişi korunacak."
                          : "Başlığın ve yanıtın açık, doğru ve güncel olduğunu kontrol edin. İnceleme tek başına yayımlamaz."}
                      </p>
                      <label>
                        {action === "review"
                          ? "İnceleme notu"
                          : "İşlem gerekçesi"}
                        <textarea
                          className="input"
                          value={reason}
                          maxLength={500}
                          disabled={locked}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <div className="support-actions">
                        <button
                          className={action === "archive"
                            ? "btn-danger"
                            : "btn"}
                          disabled={!canAct || reason.trim().length < 3 ||
                            (action === "publish" && !reviewed)}
                          onClick={() =>
                            void send({
                              action,
                              id: form.id,
                              revision: form.revision,
                              reason,
                            })}
                        >
                          {action === "review"
                            ? "İncelemeyi kaydet"
                            : action === "publish"
                            ? "Bu sürümü yayımla"
                            : "Yayından kaldır"}
                        </button>
                        <button
                          className="btn-secondary"
                          disabled={locked}
                          onClick={() => setAction(null)}
                        >
                          Vazgeç
                        </button>
                      </div>
                    </section>
                  )
                  : null}
              </>
            )
            : null}
        </section>
      </div>
    </div>
  );
}
