import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  definitiveHelpFailure,
  type HelpThread,
  helpThreadSchema,
  type OperatorHelpCommand,
  type PendingOperatorHelp,
} from "@gina/core";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useSupportQuery } from "@/lib/use-support-query";
import { operatorOutbox, sendOperatorHelp } from "@/lib/operator-help";
import {
  ideaStages,
  loadQueue,
  waitingLabel,
  waitingOverdue,
} from "@/lib/support-ops";
import { ReplyHelpers, TicketPanel } from "./ticket-ops";
const labels: Record<string, string> = {
  open: "Açık",
  in_progress: "İnceleniyor",
  waiting_parent: "Veli yanıtı bekleniyor",
  resolved: "Çözüldü",
  closed: "Kapalı",
};
const categories: Record<string, string> = {
  account: "Hesap",
  device: "Cihaz ve PIN",
  learning: "Öğrenme ve Prova",
  billing: "Paket ve ödeme",
  other: "Diğer",
};
const date = (value: string) =>
  new Date(value).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function Chip({ status }: { status: string }) {
  return (
    <span className={"support-chip status-" + status}>{labels[status]}</span>
  );
}
export function HelpCenter({ kind }: { kind: "support" | "idea" }) {
  const { session } = useAuth();
  return (
    <Layout title={kind === "support" ? "Destek merkezi" : "Fikirler"} support>
      {session
        ? (
          <Workspace
            key={session.user.id + kind}
            user={session.user.id}
            kind={kind}
          />
        )
        : null}
    </Layout>
  );
}
function Workspace({ user, kind }: { user: string; kind: "support" | "idea" }) {
  const router = useRouter(), { refreshRoles } = useAuth();
  const [outbox] = useState(() => operatorOutbox(user));
  const [restored] = useState(() => {
    try {
      return { pending: outbox.restore(), error: false };
    } catch {
      return { pending: null, error: true };
    }
  });
  const [pending, setPending] = useState<PendingOperatorHelp | null>(
      restored.pending,
    ),
    [storageError, setStorageError] = useState(restored.error),
    [delivered, setDelivered] = useState<PendingOperatorHelp | null>(null);
  const [selected, setSelected] = useState<string | null>(
      restored.pending?.payload.ticket ?? null,
    ),
    [filter, setFilter] = useState("open"),
    [category, setCategory] = useState(""),
    // C07: iş kuyruğundaki "sorumlusuz" bağlantısı ?assignee=none ile aynı süzgeçle açılır.
    [assignee, setAssignee] = useState<"any" | "me" | "none">(() =>
      typeof window !== "undefined" && ["me", "none"].includes(new URLSearchParams(window.location.search).get("assignee") ?? "")
        ? new URLSearchParams(window.location.search).get("assignee") as "me" | "none"
        : "any"
    ),
    [waiting, setWaiting] = useState(false),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [version, setVersion] = useState(0),
    [opsVersion, setOpsVersion] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false),
    [leave, setLeave] = useState<(() => void) | null>(null);
  const guard = useRef({ dirty: false, busy: false });
  useEffect(() => {
    guard.current = { dirty, busy };
  }, [dirty, busy]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (guard.current.dirty || guard.current.busy) e.preventDefault();
    };
    // Capture internal navigation (including browser-native links) before Next
    // changes route. Browser back uses beforePopState; external close uses unload.
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
      if (!guard.current.busy) {
        setLeave(() => () => {
          guard.current.dirty = false;
          void router.push(a.href);
        });
      }
    };
    const signOut = (event: Event) => {
      if (guard.current.dirty || guard.current.busy) {
        event.preventDefault();
        if (!guard.current.busy) {
          setLeave(() => (event as CustomEvent<() => void>).detail);
        }
      }
    };
    window.addEventListener("gina:signout", signOut);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    router.beforePopState(({ as }) => {
      if (!guard.current.dirty && !guard.current.busy) return true;
      window.history.pushState(window.history.state, "", router.asPath);
      if (!guard.current.busy) {
        setLeave(() => () => {
          guard.current.dirty = false;
          void router.push(as);
        });
      }
      return false;
    });
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("gina:signout", signOut);
      document.removeEventListener("click", click, true);
      router.beforePopState(() => true);
    };
  }, [router]);
  const choose = (id: string | null) => {
    if (busy) return;
    const act = () => {
      setSelected(id);
      setDirty(false);
      setMessage("");
    };
    if (dirty) setLeave(() => act);
    else act();
  };
  async function send(command?: OperatorHelpCommand) {
    if (busy || storageError) return false;
    setBusy(true);
    setMessage("");
    let saved: PendingOperatorHelp | undefined;
    try {
      saved = pending ?? outbox.prepare(command!);
      setPending(saved);
      const receipt = await sendOperatorHelp(saved);
      outbox.acknowledge(saved.id);
      setPending(null);
      setDelivered(saved);
      setSelected(receipt.id);
      setDirty(false);
      setVersion((v) => v + 1);
      setMessage("Kaydedildi.");
      return true;
    } catch (error) {
      if (saved && definitiveHelpFailure(error)) {
        try {
          outbox.acknowledge(saved.id);
          setPending(null);
        } catch {
          setStorageError(true);
        }
        const e = error as { message?: string; code?: string };
        setMessage(
          e.message?.includes("help_changed")
            ? "Görüşme değişti. Güncel mesajları kontrol edin; metniniz korunuyor. Yeniden göndermek için güncel sürümü kabul edin."
            : e.code === "42501"
            ? "Bu işlem için güncel yetkiniz yok."
            : "Gönderim reddedildi. Görüşmenin durumunu kontrol edin; metniniz korunuyor.",
        );
        setVersion((v) => v + 1);
        if (e.code === "42501") refreshRoles();
      } else {setMessage(
          saved
            ? "Gönderimin sonucu doğrulanamadı. Aynı gönderimi kontrol edin; yeni bir mesaj oluşturulmaz."
            : "Mesaj cihazda güvenle saklanamadı. Gönderim yapılmadı.",
        );}
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={"support-center" + (selected ? " selected" : "")}>
      <p className="support-subtitle">
        {kind === "support"
          ? "Görüşmeleri takip et, ailelere yardımcı ol."
          : "Ailelerin paylaştığı fikirleri değerlendir, geri dönüşlerini burada tut."}
      </p>
      <div className="support-filters" aria-label="Talep durumu">
        {([
          ["open", "Açık"],
          ["in_progress", "İnceleniyor"],
          ["waiting_parent", "Veli yanıtı"],
          ["completed", "Tamamlanan"],
          ["", "Tümü"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {leave
        ? (
          <div className="support-notice" role="alert">
            <strong>Yazdığınız metin henüz gönderilmedi.</strong>
            <p>
              {pending
                ? "Belirsiz gönderim bu cihazda saklı kalır. Diğer taslaklar bu görüşmeden ayrıldığınızda silinir."
                : "Bu görüşmeden ayrılırsanız gönderilmemiş taslak silinir."}
            </p>
            <div className="support-actions">
              <button className="btn-secondary" onClick={() => setLeave(null)}>
                Yazmaya devam et
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  const action = leave;
                  setLeave(null);
                  setDirty(false);
                  guard.current.dirty = false;
                  action();
                }}
              >
                Taslağı bırak ve ayrıl
              </button>
            </div>
          </div>
        )
        : null}
      {storageError
        ? (
          <div className="support-notice error" role="alert">
            Bekleyen gönderim bu cihazda okunamadı. Yeni bir gönderim
            yapmıyoruz. Depolama alanını kontrol edip ekranı yeniden açın.
          </div>
        )
        : null}
      {pending
        ? (
          <div className="support-notice">
            <strong>
              {pending.payload.internal ? "Ekip notunun" : "Aileye yanıtın"}
              {" "}
              gönderimi doğrulanmalı
            </strong>
            <p>
              İçerik ve görünürlük kilitli. Yeniden kontrol, aynı gönderimin
              sonucunu getirir.
            </p>
            <button
              className="btn"
              disabled={busy || storageError}
              onClick={() => void send()}
            >
              {busy ? "Kontrol ediliyor…" : "Gönderimi kontrol et"}
            </button>
          </div>
        )
        : null}
      {message
        ? <p className="support-feedback" role="status">{message}</p>
        : null}
      <div className={"support-columns" + (selected ? " has-selection" : "")}>
        <aside className="support-queue">
          <header>
            <h2>
              {kind === "support" ? "Destek talepleri" : "Paylaşılan fikirler"}
            </h2>
            <label className="label" htmlFor="queue-category">Konu</label>
            <select
              id="queue-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Tüm konular</option>
              {Object.entries(categories).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <label className="label" htmlFor="queue-search">Ara</label>
            <input
              id="queue-search"
              className="input"
              type="search"
              data-testid="support-search"
              placeholder="Konu, mesaj veya ekip notu"
              maxLength={80}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search.trim().length === 1
              ? <small className="support-ops-hint">En az 2 harf yazın.</small>
              : null}
            <label className="label" htmlFor="queue-assignee">Sorumlu</label>
            <select
              id="queue-assignee"
              className="input"
              data-testid="support-assignee-filter"
              value={assignee}
              onChange={(e) =>
                setAssignee(e.target.value as "any" | "me" | "none")}
            >
              <option value="any">Herkes</option>
              <option value="me">Bana atananlar</option>
              <option value="none">Sorumlusuz</option>
            </select>
            {kind === "support"
              ? (
                <label className="support-check">
                  <input
                    type="checkbox"
                    checked={waiting}
                    onChange={(e) => setWaiting(e.target.checked)}
                  />
                  Yalnız veli yanıt bekleyenler
                </label>
              )
              : null}
          </header>
          <Queue
            key={`${kind}:${filter}:${category}:${assignee}:${waiting}:${query}`}
            kind={kind}
            status={filter}
            category={category}
            assignee={assignee}
            waiting={waiting}
            query={query}
            selected={selected}
            choose={choose}
            version={version * 1000 + opsVersion}
          />
        </aside>
        {selected
          ? (
            <Conversation
              key={selected}
              id={selected}
              version={version}
              delivered={delivered}
              pending={pending?.payload.ticket === selected ? pending : null}
              locked={busy || !!pending || storageError}
              busy={busy}
              onSend={send}
              onDirty={setDirty}
              onOpsChanged={() => setOpsVersion((v) => v + 1)}
              back={() => choose(null)}
            />
          )
          : (
            <section className="support-conversation support-empty">
              <span aria-hidden="true">☏</span>
              <h2>Bir görüşme seçin</h2>
              <p>Yanıtları ve ekip notlarını burada takip edebilirsiniz.</p>
            </section>
          )}
      </div>
    </div>
  );
}
function Queue(
  { kind, status, category, assignee, waiting, query, selected, choose, version }: {
    kind: "support" | "idea";
    status: string;
    category: string;
    assignee: "any" | "me" | "none";
    waiting: boolean;
    query: string;
    selected: string | null;
    choose: (id: string) => void;
    version: number;
  },
) {
  const [cursors, setCursors] = useState<{ time: string; id: string }[]>([]);
  const cursor = cursors.at(-1);
  const result = useSupportQuery(
    () =>
      loadQueue({ kind, status, category, assignee, waiting, query, cursor }),
    JSON.stringify([kind, status, category, assignee, waiting, query, cursor, version]),
  );
  // SQL defaults to open. The all-status option is explicitly encoded as "all"
  // by the RPC caller below rather than filtering a partially loaded page.
  return (
    <>
      <div className="support-queue-results" aria-live="polite">
        {result.error
          ? <LoadError retry={result.reload} />
          : result.loading
          ? <p>Yükleniyor…</p>
          : !result.data?.length
          ? (
            <div className="support-empty">
              <h3>Bu görünümde talep yok</h3>
              <p>Başka bir durum, konu, sorumlu veya arama deneyebilirsiniz.</p>
            </div>
          )
          : result.data.map((row) => (
            <button
              className="support-ticket"
              aria-pressed={row.id === selected}
              key={row.id}
              onClick={() => choose(row.id)}
            >
              <strong>{row.subject}</strong>
              <span>
                {row.kind === "idea" && row.idea_stage
                  ? (
                    <span className="support-chip">
                      {ideaStages[row.idea_stage]}
                    </span>
                  )
                  : <Chip status={row.status} />}
                <small>
                  {new Date(row.updated_at).toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "short",
                  })}
                </small>
              </span>
              <span className="support-ticket-ops">
                {row.waiting_since
                  ? (
                    <small
                      className={waitingOverdue(row.waiting_since)
                        ? "support-overdue"
                        : ""}
                    >
                      Veli {waitingLabel(row.waiting_since)} bekliyor
                    </small>
                  )
                  : null}
                <small>
                  {row.assignee_id
                    ? (row.assignee_is_me
                      ? "Sorumlu: siz"
                      : `Sorumlu: ${row.assignee_label ?? "ekip üyesi"}`)
                    : "Sorumlusuz"}
                </small>
                {row.similar_count > 0
                  ? <small>{row.similar_count} benzer fikir</small>
                  : null}
                {row.match === "message"
                  ? <small>Mesajda eşleşti</small>
                  : null}
              </span>
            </button>
          ))}
      </div>
      <div className="support-paging">
        {cursors.length > 0
          ? (
            <button
              className="btn-secondary"
              onClick={() => setCursors((c) => c.slice(0, -1))}
            >
              Önceki
            </button>
          )
          : null}
        {result.data?.length === 50
          ? (
            <button
              className="btn-secondary"
              onClick={() => {
                const row = result.data!.at(-1)!;
                setCursors((c) => [...c, { time: row.updated_at, id: row.id }]);
              }}
            >
              Sonraki
            </button>
          )
          : null}
        <button
          className="support-link"
          onClick={() => {
            setCursors([]);
            result.reload();
          }}
        >
          Yenile
        </button>
      </div>
    </>
  );
}
function LoadError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="support-notice error">
      <p>Görüşmeler yüklenemedi. Bağlantınızı ve yetkinizi kontrol edin.</p>
      <button className="btn-secondary" onClick={retry}>Yeniden dene</button>
    </div>
  );
}

type Draft = { body: string; revision: number | null; status: string };
function Conversation({
  id,
  version,
  delivered,
  pending,
  locked,
  busy,
  onSend,
  onDirty,
  onOpsChanged,
  back,
}: {
  onOpsChanged: () => void;
  id: string;
  version: number;
  delivered: PendingOperatorHelp | null;
  pending: PendingOperatorHelp | null;
  locked: boolean;
  busy: boolean;
  onSend: (c: OperatorHelpCommand) => Promise<boolean>;
  onDirty: (d: boolean) => void;
  back: () => void;
}) {
  const [mode, setMode] = useState(
    pending?.payload.internal ? "internal" : "family",
  );
  const make = (internal: boolean): Draft =>
    pending && pending.payload.internal === internal
      ? {
        body: pending.payload.body,
        revision: pending.payload.revision,
        status: pending.payload.status ?? "",
      }
      : { body: "", revision: null, status: internal ? "" : "waiting_parent" };
  const [family, setFamily] = useState<Draft>(() => make(false)),
    [internal, setInternal] = useState<Draft>(() => make(true)),
    [older, setOlder] = useState<HelpThread["messages"]>([]),
    [olderBusy, setOlderBusy] = useState(false),
    [olderError, setOlderError] = useState(false),
    [allOlder, setAllOlder] = useState(false),
    [options, setOptions] = useState(false),
    [reopen, setReopen] = useState(false);
  const [handled, setHandled] = useState<string | null>(null);
  if (delivered && delivered.id !== handled) {
    setHandled(delivered.id);
    if (delivered.payload.ticket === id) {
      const update = delivered.payload.internal ? setInternal : setFamily;
      update((d) =>
        d.body.trim() === delivered.payload.body
          ? {
            body: "",
            revision: null,
            status: delivered.payload.internal ? "" : "waiting_parent",
          }
          : d
      );
    }
  }
  const query = useSupportQuery(async () => {
    const { data, error } = await supabase().rpc("get_help_ticket", {
      p_ticket_id: id,
    });
    if (error) throw error;
    return helpThreadSchema.parse(data);
  }, id + ":" + version);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [query.data?.id]);
  const changeModeWithKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      locked || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
    ) return;
    event.preventDefault();
    const next = event.key === "Home"
      ? "family"
      : event.key === "End"
      ? "internal"
      : mode === "family"
      ? "internal"
      : "family";
    setMode(next);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<
      HTMLButtonElement
    >('[role="tab"]');
    tabs?.[next === "family" ? 0 : 1]?.focus();
  };
  const current = query.data,
    draft = mode === "family" ? family : internal,
    setDraft = mode === "family" ? setFamily : setInternal;
  const dirty = !!(family.body || internal.body);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const messages = [
    ...new Map(
      [...older, ...(current?.messages ?? [])].map((m) => [m.sequence, m]),
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence);
  const stale = draft.revision !== null && current &&
    draft.revision !== current.revision;
  async function loadOlder() {
    if (!messages.length || olderBusy) return;
    setOlderBusy(true);
    setOlderError(false);
    try {
      const { data, error } = await supabase().rpc("get_help_ticket", {
        p_ticket_id: id,
        p_before: messages[0]!.sequence,
      });
      if (error) throw error;
      const page = helpThreadSchema.parse(data);
      setOlder((old) => [...page.messages, ...old]);
      setAllOlder(page.messages.length < 100);
    } catch {
      setOlderError(true);
    } finally {
      setOlderBusy(false);
    }
  }
  async function submit() {
    if (!current || !draft.body.trim() || stale || locked) return;
    const ok = await onSend({
      ticket: id,
      revision: draft.revision ?? current.revision,
      body: draft.body,
      internal: mode === "internal",
      status: (draft.status || null) as OperatorHelpCommand["status"],
    });
    if (ok) {
      setDraft({
        body: "",
        revision: null,
        status: mode === "internal" ? "" : "waiting_parent",
      });
    }
  }
  return (
    <section className="support-conversation">
      <button className="support-back support-link" onClick={back}>
        ← Talepler
      </button>
      {query.error
        ? <LoadError retry={query.reload} />
        : query.loading
        ? <p>Yükleniyor…</p>
        : current
        ? (
          <>
            <header className="support-thread-heading">
              <div>
                <h2 ref={heading} tabIndex={-1}>{current.subject}</h2>
                <div className="support-meta">
                  <span className="support-chip">
                    {categories[current.category]}
                  </span>
                  <Chip status={current.status} />
                </div>
              </div>
              <button
                className="support-icon"
                aria-label="Görüşme seçenekleri"
                aria-expanded={options}
                onClick={() => setOptions(!options)}
              >
                •••
              </button>
            </header>
            {options
              ? (
                <div className="support-notice">
                  <p>
                    Durumu, yanıt veya ekip notuyla birlikte kaydedin. İşlem
                    geçmişte görünür kalır.
                  </p>
                  <button className="support-link" onClick={query.reload}>
                    Görüşmeyi yenile
                  </button>
                </div>
              )
              : null}
            <TicketPanel id={id} locked={locked} onChanged={onOpsChanged} />
            <p className="support-privacy">
              ⓘ Yanıtlar ailedeki ebeveynlere görünür. Sorumlu, fikir durumu ve
              ekip notları aileye görünmez.
            </p>
            <div className="support-messages">
              {current.messages.length === 100 && !allOlder
                ? (
                  <button
                    className="btn-secondary"
                    disabled={olderBusy}
                    onClick={() => void loadOlder()}
                  >
                    {olderBusy ? "Yükleniyor…" : "Önceki mesajları yükle"}
                  </button>
                )
                : null}
              {olderError
                ? (
                  <p role="alert">
                    Önceki mesajlar yüklenemedi. Yeniden deneyin.
                  </p>
                )
                : null}
              {messages.map((m) => (
                <article
                  className={"support-message " +
                    (m.visibility === "internal" ? "internal" : m.author_role)}
                  key={m.sequence}
                >
                  <div className="support-message-meta">
                    <strong>
                      {m.visibility === "internal"
                        ? "🔒 Ekip notu · Aileye görünmez"
                        : m.author_role === "parent"
                        ? "Ebeveyn"
                        : "Destek"}
                    </strong>
                    <time dateTime={m.created_at}>{date(m.created_at)}</time>
                  </div>
                  <p>{m.body}</p>
                </article>
              ))}
            </div>
            {current.status === "closed" || current.status === "resolved"
              ? (
                <div className="support-notice">
                  <p>
                    Bu görüşme tamamlandı. Yeni mesaj için açıkça yeniden açın.
                  </p>
                  {!reopen
                    ? (
                      <button
                        className="btn-secondary"
                        disabled={locked}
                        onClick={() => setReopen(true)}
                      >
                        Yeniden aç
                      </button>
                    )
                    : (
                      <>
                        <label className="label" htmlFor="reopen-reason">
                          Ekip için yeniden açma gerekçesi
                        </label>
                        <textarea
                          id="reopen-reason"
                          className="input"
                          value={internal.body}
                          disabled={locked}
                          maxLength={6000}
                          onChange={(e) =>
                            setInternal({
                              body: e.target.value,
                              revision: internal.revision ?? current.revision,
                              status: "open",
                            })}
                        />
                        <button
                          className="btn"
                          disabled={locked || !internal.body.trim() ||
                            internal.revision !== current.revision}
                          onClick={async () => {
                            if (
                              await onSend({
                                ticket: id,
                                revision: internal.revision!,
                                body: internal.body,
                                internal: true,
                                status: "open",
                              })
                            ) {
                              setInternal({
                                body: "",
                                revision: null,
                                status: "",
                              });
                              setReopen(false);
                            }
                          }}
                        >
                          Gerekçeyle yeniden aç
                        </button>
                        {internal.revision !== null &&
                            internal.revision !== current.revision
                          ? (
                            <button
                              className="support-link"
                              disabled={locked}
                              onClick={() =>
                                setInternal((d) => ({
                                  ...d,
                                  revision: current.revision,
                                }))}
                            >
                              Güncel görüşmeyi okudum
                            </button>
                          )
                          : null}
                      </>
                    )}
                </div>
              )
              : (
                <div
                  className={"support-composer " +
                    (mode === "internal" ? "internal" : "")}
                >
                  <div
                    className="support-compose-tabs"
                    role="tablist"
                    aria-label="Mesaj görünürlüğü"
                  >
                    <button
                      role="tab"
                      onKeyDown={changeModeWithKeys}
                      aria-selected={mode === "family"}
                      tabIndex={mode === "family" ? 0 : -1}
                      disabled={locked}
                      onClick={() => setMode("family")}
                    >
                      Aileye yanıt
                    </button>
                    <button
                      role="tab"
                      onKeyDown={changeModeWithKeys}
                      aria-selected={mode === "internal"}
                      tabIndex={mode === "internal" ? 0 : -1}
                      disabled={locked}
                      onClick={() => setMode("internal")}
                    >
                      Ekip notu
                    </button>
                  </div>
                  <label htmlFor="support-body" className="label">
                    {mode === "internal"
                      ? "Yalnız destek ekibi görecek"
                      : "Ailedeki ebeveynlere gönderilecek"}
                  </label>
                  <textarea
                    id="support-body"
                    className="input"
                    placeholder={mode === "internal"
                      ? "Ekip için notunuzu yazın…"
                      : "Yanıtınızı yazın…"}
                    value={draft.body}
                    maxLength={6000}
                    disabled={locked || !!query.error}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        body: e.target.value,
                        revision: draft.revision ?? current.revision,
                      })}
                  />
                  {mode === "family"
                    ? (
                      <ReplyHelpers
                        ticket={current.id}
                        subject={current.subject}
                        category={current.category}
                        disabled={locked}
                        onInsert={(text) =>
                          setFamily((d) => ({
                            ...d,
                            body: (d.body.trim() ? d.body.trimEnd() + "\n\n" : "") +
                              text,
                            revision: d.revision ?? current.revision,
                          }))}
                      />
                    )
                    : null}
                  {stale
                    ? (
                      <div className="support-notice" role="alert">
                        <p>
                          Bu taslağı yazarken görüşme değişti. Güncel mesajları
                          kontrol edin.
                        </p>
                        <button
                          className="btn-secondary"
                          disabled={locked}
                          onClick={() =>
                            setDraft({ ...draft, revision: current.revision })}
                        >
                          Güncel görüşmeyi okudum
                        </button>
                      </div>
                    )
                    : null}
                  <div className="support-compose-actions">
                    <label>
                      Gönderim sonrası<select
                        className="input"
                        value={draft.status}
                        disabled={locked}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            status: e.target.value,
                            revision: draft.revision ?? current.revision,
                          })}
                      >
                        <option value="">Durumu koru</option>
                        {Object.entries(labels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="btn"
                      disabled={locked || !draft.body.trim() || !!stale}
                      onClick={() => void submit()}
                    >
                      {busy
                        ? "Kaydediliyor…"
                        : mode === "internal"
                        ? "Ekip notunu kaydet"
                        : "Yanıtı gönder"}
                    </button>
                  </div>
                </div>
              )}
          </>
        )
        : null}
    </section>
  );
}
